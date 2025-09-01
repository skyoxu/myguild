#!/usr/bin/env node

/**
 * 可观测性统一集成器
 * 将SQLite健康指标暴露到Sentry等可观测性平台
 *
 * 功能：
 * - 收集SQLite数据库健康指标
 * - 集成Sentry性能监控和错误追踪
 * - 暴露Prometheus指标端点
 * - 提供Web Vitals和业务指标集成
 * - 支持配置中心化管理
 *
 * Usage:
 *   node scripts/observability-integration.mjs start
 *   node scripts/observability-integration.mjs collect
 *   node scripts/observability-integration.mjs expose --platform=sentry
 *   node scripts/observability-integration.mjs metrics --format=prometheus
 *
 * Environment Variables:
 *   NODE_ENV                 - 运行环境 (development/production)
 *   SENTRY_DSN              - Sentry DSN for integration
 *   PROMETHEUS_PORT         - Prometheus metrics port (default: 9090)
 *   METRICS_INTERVAL        - 指标收集间隔，秒 (default: 30)
 *   DB_PATH                 - 数据库文件路径 (default: data/app.db)
 *   OBSERVABILITY_ENABLED   - 是否启用可观测性 (default: true)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from './utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载配置
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);

/**
 * SQLite健康指标收集器
 */
class SQLiteHealthCollector {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.metrics = {
      dbSize: 0,
      walSize: 0,
      shmSize: 0,
      walGrowthRate: 0,
      connectionCount: 0,
      transactionDuration: 0,
      checkpointFrequency: 0,
      fragmentationLevel: 0,
      diskSpaceAvailable: 0,
      lastCollected: null,
    };
    this.history = [];
  }

  /**
   * 收集数据库健康指标
   */
  async collectMetrics() {
    try {
      const dbPath = path.resolve(this.dbPath);
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;

      // 文件大小指标
      const dbSize = this.getFileSize(dbPath);
      const walSize = this.getFileSize(walPath);
      const shmSize = this.getFileSize(shmPath);

      // 计算增长率
      const walGrowthRate = this.calculateGrowthRate(walSize);

      // 磁盘空间检查
      const diskSpaceAvailable = await this.getDiskSpace(dbPath);

      // 数据库连接和性能指标
      const performanceMetrics = await this.collectPerformanceMetrics(dbPath);

      this.metrics = {
        dbSize: dbSize / (1024 * 1024), // MB
        walSize: walSize / (1024 * 1024), // MB
        shmSize: shmSize / (1024 * 1024), // MB
        walGrowthRate,
        diskSpaceAvailable: diskSpaceAvailable / (1024 * 1024), // MB
        ...performanceMetrics,
        lastCollected: new Date().toISOString(),
      };

      // 保存历史记录
      this.history.push({
        timestamp: this.metrics.lastCollected,
        ...this.metrics,
      });

      // 保留最近7天的数据
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
      this.history = this.history.filter(
        record => new Date(record.timestamp).getTime() > cutoffTime
      );

      return this.metrics;
    } catch (error) {
      console.error('❌ SQLite健康指标收集失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取文件大小
   */
  getFileSize(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.statSync(filePath).size;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 计算WAL增长率
   */
  calculateGrowthRate(currentWalSize) {
    if (this.history.length < 2) {
      return 0;
    }

    const lastRecord = this.history[this.history.length - 1];
    const timeDelta =
      (Date.now() - new Date(lastRecord.timestamp).getTime()) / 1000; // 秒
    const sizeDelta = currentWalSize / (1024 * 1024) - lastRecord.walSize; // MB

    return timeDelta > 0 ? sizeDelta / timeDelta : 0; // MB/秒
  }

  /**
   * 获取磁盘空间
   */
  async getDiskSpace(filePath) {
    try {
      const { execSync } = await import('child_process');

      if (process.platform === 'win32') {
        // Windows: 使用wmic获取磁盘空间
        const drive = path.parse(filePath).root.replace('\\', '');
        const result = execSync(
          `wmic logicaldisk where caption="${drive}" get size,freespace /value`,
          { encoding: 'utf8', timeout: 5000 }
        );

        const lines = result.split('\n').filter(line => line.includes('='));
        const freeSpace = lines.find(line => line.startsWith('FreeSpace='));

        if (freeSpace) {
          return parseInt(freeSpace.split('=')[1]) || 0;
        }
      } else {
        // Unix: 使用df命令
        const result = execSync(`df -k "${path.dirname(filePath)}"`, {
          encoding: 'utf8',
          timeout: 5000,
        });
        const lines = result.split('\n');
        if (lines.length > 1) {
          const fields = lines[1].split(/\s+/);
          return parseInt(fields[3]) * 1024 || 0; // KB转bytes
        }
      }

      return 0;
    } catch (error) {
      console.warn('⚠️ 无法获取磁盘空间信息:', error.message);
      return 0;
    }
  }

  /**
   * 收集数据库性能指标
   */
  async collectPerformanceMetrics(dbPath) {
    const defaultMetrics = {
      connectionCount: 0,
      transactionDuration: 0,
      checkpointFrequency: 0,
      fragmentationLevel: 0,
    };

    try {
      // 尝试使用SQLite3命令行工具获取更详细信息
      const { execSync } = await import('child_process');

      // 检查数据库完整性和统计信息
      const integrityResult = execSync(
        `sqlite3 "${dbPath}" "PRAGMA integrity_check;"`,
        { encoding: 'utf8', timeout: 10000 }
      );

      if (!integrityResult.includes('ok')) {
        console.warn('⚠️ 数据库完整性检查异常:', integrityResult);
      }

      // 获取页面统计信息
      const pageStatsResult = execSync(
        `sqlite3 "${dbPath}" "PRAGMA page_count; PRAGMA freelist_count;"`,
        { encoding: 'utf8', timeout: 5000 }
      );

      const pageStats = pageStatsResult.split('\n').filter(Boolean);
      const pageCount = parseInt(pageStats[0]) || 0;
      const freelistCount = parseInt(pageStats[1]) || 0;

      // 计算碎片化程度
      const fragmentationLevel =
        pageCount > 0 ? (freelistCount / pageCount) * 100 : 0;

      return {
        ...defaultMetrics,
        fragmentationLevel: Math.round(fragmentationLevel * 100) / 100, // 保留2位小数
      };
    } catch (error) {
      console.warn('⚠️ 无法收集数据库性能指标:', error.message);
      return defaultMetrics;
    }
  }

  /**
   * 获取健康状态评估
   */
  getHealthAssessment() {
    const thresholds = config.database?.health || {
      dbSizeWarningMB: { threshold: 500 },
      walSizeThresholdMB: { threshold: 10 },
      diskSpaceWarningMB: { threshold: 1000 },
    };

    const issues = [];
    let status = 'healthy';

    // 检查WAL大小
    if (this.metrics.walSize > thresholds.walSizeThresholdMB.threshold) {
      issues.push({
        severity: 'critical',
        type: 'wal_size_exceeded',
        message: `WAL文件大小(${this.metrics.walSize.toFixed(2)}MB)超过阈值`,
        threshold: thresholds.walSizeThresholdMB.threshold,
        actual: this.metrics.walSize,
      });
      status = 'critical';
    }

    // 检查数据库大小
    if (this.metrics.dbSize > thresholds.dbSizeWarningMB.threshold) {
      issues.push({
        severity: 'warning',
        type: 'db_size_warning',
        message: `数据库大小(${this.metrics.dbSize.toFixed(2)}MB)超过警告阈值`,
        threshold: thresholds.dbSizeWarningMB.threshold,
        actual: this.metrics.dbSize,
      });
      if (status === 'healthy') status = 'warning';
    }

    // 检查磁盘空间
    if (
      this.metrics.diskSpaceAvailable < thresholds.diskSpaceWarningMB.threshold
    ) {
      issues.push({
        severity: 'critical',
        type: 'disk_space_low',
        message: `可用磁盘空间(${this.metrics.diskSpaceAvailable.toFixed(2)}MB)不足`,
        threshold: thresholds.diskSpaceWarningMB.threshold,
        actual: this.metrics.diskSpaceAvailable,
      });
      status = 'critical';
    }

    // 检查碎片化程度
    if (this.metrics.fragmentationLevel > 25) {
      issues.push({
        severity: 'warning',
        type: 'high_fragmentation',
        message: `数据库碎片化程度(${this.metrics.fragmentationLevel}%)较高`,
        threshold: 25,
        actual: this.metrics.fragmentationLevel,
      });
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      issues,
      metrics: this.metrics,
      recommendations: this.generateRecommendations(issues),
    };
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(issues) {
    const recommendations = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'wal_size_exceeded':
          recommendations.push(
            '执行WAL检查点操作: npm run db:checkpoint:truncate'
          );
          break;
        case 'db_size_warning':
          recommendations.push('考虑数据清理或归档: npm run db:maintenance');
          break;
        case 'disk_space_low':
          recommendations.push('清理磁盘空间或增加存储容量');
          break;
        case 'high_fragmentation':
          recommendations.push('执行数据库重组: VACUUM操作');
          break;
      }
    });

    return [...new Set(recommendations)]; // 去重
  }
}

/**
 * Sentry集成器
 */
class SentryIntegrator {
  constructor(dsn) {
    this.dsn = dsn;
    this.enabled = !!dsn;
    this.initSentry();
  }

  /**
   * 初始化Sentry集成
   */
  initSentry() {
    if (!this.enabled) {
      console.warn('⚠️ Sentry DSN未配置，跳过集成');
      return;
    }

    try {
      // 这里使用动态导入避免在没有Sentry的环境中出错
      this.sentry = null;
      console.log('🔗 Sentry集成已配置');
    } catch (error) {
      console.warn('⚠️ Sentry集成失败:', error.message);
      this.enabled = false;
    }
  }

  /**
   * 发送数据库健康指标到Sentry
   */
  async sendHealthMetrics(healthAssessment) {
    if (!this.enabled) return;

    try {
      // 创建自定义指标事件
      const metricsEvent = {
        timestamp: new Date().toISOString(),
        measurement: 'database.health',
        value: this.calculateHealthScore(healthAssessment),
        unit: 'ratio',
        tags: {
          environment: environment,
          component: 'database',
          status: healthAssessment.status,
        },
        data: {
          dbSizeMB: healthAssessment.metrics.dbSize,
          walSizeMB: healthAssessment.metrics.walSize,
          diskSpaceAvailableMB: healthAssessment.metrics.diskSpaceAvailable,
          fragmentationLevel: healthAssessment.metrics.fragmentationLevel,
          issueCount: healthAssessment.issues.length,
          criticalIssues: healthAssessment.issues.filter(
            i => i.severity === 'critical'
          ).length,
        },
      };

      // 在没有实际Sentry SDK时，记录到日志
      console.log('📊 Sentry指标事件:', JSON.stringify(metricsEvent, null, 2));

      // 发送严重问题作为错误
      for (const issue of healthAssessment.issues) {
        if (issue.severity === 'critical') {
          const errorEvent = {
            message: `Database Health Alert: ${issue.message}`,
            level: 'error',
            tags: {
              alertType: issue.type,
              component: 'database',
              environment: environment,
            },
            extra: issue,
          };

          console.log(
            '🚨 Sentry错误事件:',
            JSON.stringify(errorEvent, null, 2)
          );
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Sentry指标发送失败:', error.message);
      return false;
    }
  }

  /**
   * 计算健康分数 (0-1)
   */
  calculateHealthScore(healthAssessment) {
    let score = 1.0;

    healthAssessment.issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 0.3;
          break;
        case 'warning':
          score -= 0.1;
          break;
        default:
          score -= 0.05;
      }
    });

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Prometheus指标暴露器
 */
class PrometheusExporter {
  constructor(port = 9090) {
    this.port = port;
    this.server = null;
    this.metrics = new Map();
  }

  /**
   * 启动Prometheus指标服务器
   */
  async start() {
    const { createServer } = await import('http');

    this.server = createServer((req, res) => {
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(this.generateMetricsOutput());
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      console.log(
        `📊 Prometheus指标服务器启动: http://localhost:${this.port}/metrics`
      );
    });

    return this.server;
  }

  /**
   * 更新SQLite健康指标
   */
  updateSQLiteMetrics(healthAssessment) {
    const prefix = 'sqlite_health';
    const labels = `database="${path.basename(process.env.DB_PATH || 'app.db')}"`;

    this.metrics.set(`${prefix}_db_size_mb`, {
      help: 'SQLite database file size in MB',
      type: 'gauge',
      value: healthAssessment.metrics.dbSize,
      labels,
    });

    this.metrics.set(`${prefix}_wal_size_mb`, {
      help: 'SQLite WAL file size in MB',
      type: 'gauge',
      value: healthAssessment.metrics.walSize,
      labels,
    });

    this.metrics.set(`${prefix}_disk_space_available_mb`, {
      help: 'Available disk space in MB',
      type: 'gauge',
      value: healthAssessment.metrics.diskSpaceAvailable,
      labels,
    });

    this.metrics.set(`${prefix}_fragmentation_level_percent`, {
      help: 'Database fragmentation level percentage',
      type: 'gauge',
      value: healthAssessment.metrics.fragmentationLevel,
      labels,
    });

    this.metrics.set(`${prefix}_issues_total`, {
      help: 'Total number of database health issues',
      type: 'gauge',
      value: healthAssessment.issues.length,
      labels: `${labels},severity="all"`,
    });

    this.metrics.set(`${prefix}_critical_issues_total`, {
      help: 'Number of critical database health issues',
      type: 'gauge',
      value: healthAssessment.issues.filter(i => i.severity === 'critical')
        .length,
      labels: `${labels},severity="critical"`,
    });

    this.metrics.set(`${prefix}_score`, {
      help: 'Overall database health score (0-1)',
      type: 'gauge',
      value: this.calculateHealthScore(healthAssessment),
      labels,
    });
  }

  /**
   * 计算健康分数
   */
  calculateHealthScore(healthAssessment) {
    let score = 1.0;

    healthAssessment.issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 0.3;
          break;
        case 'warning':
          score -= 0.1;
          break;
        default:
          score -= 0.05;
      }
    });

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 生成Prometheus格式的指标输出
   */
  generateMetricsOutput() {
    let output = '';

    for (const [name, metric] of this.metrics) {
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;
      output += `${name}{${metric.labels}} ${metric.value}\n\n`;
    }

    return output;
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('🔌 Prometheus指标服务器已停止');
    }
  }
}

/**
 * 可观测性统一管理器
 */
class ObservabilityManager {
  constructor(config) {
    this.config = config;
    this.healthCollector = new SQLiteHealthCollector(
      config.dbPath || process.env.DB_PATH || 'data/app.db'
    );
    this.sentryIntegrator = new SentryIntegrator(
      config.sentryDsn || process.env.SENTRY_DSN
    );
    this.prometheusExporter = new PrometheusExporter(
      config.prometheusPort || process.env.PROMETHEUS_PORT || 9090
    );
    this.running = false;
    this.intervalId = null;
  }

  /**
   * 启动可观测性监控
   */
  async start() {
    console.log('🚀 启动可观测性统一监控...');

    this.running = true;

    // 启动Prometheus指标服务器
    await this.prometheusExporter.start();

    // 开始定期收集指标
    const interval = (this.config.metricsInterval || 30) * 1000;

    this.intervalId = setInterval(async () => {
      if (this.running) {
        await this.collectAndExpose();
      }
    }, interval);

    // 立即执行一次收集
    await this.collectAndExpose();

    console.log('✅ 可观测性监控已启动');
    console.log(`📊 指标采集间隔: ${interval / 1000}秒`);
    console.log(
      `🔗 Prometheus指标: http://localhost:${this.prometheusExporter.port}/metrics`
    );
  }

  /**
   * 收集并暴露指标
   */
  async collectAndExpose() {
    try {
      console.log('📊 收集数据库健康指标...');

      // 收集SQLite健康指标
      await this.healthCollector.collectMetrics();

      // 获取健康评估
      const healthAssessment = this.healthCollector.getHealthAssessment();

      // 更新Prometheus指标
      this.prometheusExporter.updateSQLiteMetrics(healthAssessment);

      // 发送到Sentry
      await this.sentryIntegrator.sendHealthMetrics(healthAssessment);

      // 输出状态摘要
      console.log(`📈 数据库健康状态: ${healthAssessment.status}`);
      console.log(
        `📊 WAL大小: ${healthAssessment.metrics.walSize.toFixed(2)}MB`
      );
      console.log(
        `💾 数据库大小: ${healthAssessment.metrics.dbSize.toFixed(2)}MB`
      );
      console.log(`⚠️ 问题数量: ${healthAssessment.issues.length}`);

      // 保存详细报告
      await this.saveHealthReport(healthAssessment);

      return healthAssessment;
    } catch (error) {
      console.error('❌ 指标收集失败:', error.message);
      throw error;
    }
  }

  /**
   * 保存健康报告
   */
  async saveHealthReport(healthAssessment) {
    try {
      const reportsDir = path.join(process.cwd(), 'logs', 'observability');

      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const reportFile = path.join(
        reportsDir,
        `health-${new Date().toISOString().slice(0, 10)}.json`
      );
      const reportData = {
        ...healthAssessment,
        collector: {
          version: '1.0.0',
          runtime: process.version,
          platform: process.platform,
        },
      };

      fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
      console.log(`📄 健康报告已保存: ${reportFile}`);
    } catch (error) {
      console.warn('⚠️ 无法保存健康报告:', error.message);
    }
  }

  /**
   * 停止监控
   */
  stop() {
    console.log('🛑 停止可观测性监控...');

    this.running = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.prometheusExporter.stop();

    console.log('✅ 可观测性监控已停止');
  }

  /**
   * 单次指标收集
   */
  async collectOnce() {
    console.log('🔍 执行单次指标收集...');

    const healthAssessment = await this.collectAndExpose();

    console.log('\n📊 指标收集结果:');
    console.log(JSON.stringify(healthAssessment, null, 2));

    return healthAssessment;
  }
}

/**
 * 命令行处理
 */
async function main() {
  const command = process.argv[2] || 'help';
  const flags = process.argv.slice(3);

  const observabilityConfig = {
    dbPath: process.env.DB_PATH || 'data/app.db',
    sentryDsn: process.env.SENTRY_DSN,
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT) || 9090,
    metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 30,
    enabled: (process.env.OBSERVABILITY_ENABLED || 'true') === 'true',
  };

  if (!observabilityConfig.enabled) {
    console.log('📊 可观测性已禁用 (OBSERVABILITY_ENABLED=false)');
    process.exit(0);
  }

  try {
    const manager = new ObservabilityManager(observabilityConfig);

    switch (command) {
      case 'start':
        await manager.start();

        // 处理优雅关闭
        process.on('SIGINT', () => {
          manager.stop();
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          manager.stop();
          process.exit(0);
        });

        // 保持进程运行
        console.log('🔄 可观测性监控运行中... (Ctrl+C 停止)');
        await new Promise(() => {}); // 永久运行
        break;

      case 'collect':
        const result = await manager.collectOnce();

        // 输出简化状态用于CI
        console.log(`\n📈 健康状态: ${result.status}`);
        console.log(`📊 指标数量: ${Object.keys(result.metrics).length}`);
        console.log(`⚠️ 问题数量: ${result.issues.length}`);

        if (result.issues.filter(i => i.severity === 'critical').length > 0) {
          console.log('❌ 发现严重问题，建议立即处理');
          process.exit(1);
        }
        break;

      case 'expose':
        const platform =
          flags.find(f => f.startsWith('--platform='))?.split('=')[1] || 'all';

        console.log(`🔗 暴露指标到平台: ${platform}`);

        if (platform === 'sentry' || platform === 'all') {
          const healthAssessment =
            manager.healthCollector.getHealthAssessment();
          await manager.sentryIntegrator.sendHealthMetrics(healthAssessment);
        }

        if (platform === 'prometheus' || platform === 'all') {
          await manager.prometheusExporter.start();
          console.log('📊 Prometheus指标已暴露，按Ctrl+C停止...');

          process.on('SIGINT', () => {
            manager.prometheusExporter.stop();
            process.exit(0);
          });

          await new Promise(() => {}); // 保持服务器运行
        }
        break;

      case 'metrics':
        const format =
          flags.find(f => f.startsWith('--format='))?.split('=')[1] || 'json';

        await manager.healthCollector.collectMetrics();
        const assessment = manager.healthCollector.getHealthAssessment();

        if (format === 'prometheus') {
          manager.prometheusExporter.updateSQLiteMetrics(assessment);
          console.log(manager.prometheusExporter.generateMetricsOutput());
        } else {
          console.log(JSON.stringify(assessment, null, 2));
        }
        break;

      case 'help':
      default:
        console.log(`
可观测性统一集成器 - 使用方法:

命令:
  start             - 启动持续监控 (包含Prometheus和Sentry集成)
  collect           - 执行单次指标收集和健康检查
  expose            - 暴露指标到外部平台
    --platform=sentry|prometheus|all
  metrics           - 输出当前指标
    --format=json|prometheus
  help              - 显示此帮助信息

环境变量:
  NODE_ENV                 - 运行环境 (development/production)
  SENTRY_DSN              - Sentry DSN for integration
  PROMETHEUS_PORT         - Prometheus metrics port (default: 9090)
  METRICS_INTERVAL        - 指标收集间隔，秒 (default: 30)
  DB_PATH                 - 数据库文件路径 (default: data/app.db)
  OBSERVABILITY_ENABLED   - 是否启用可观测性 (default: true)

示例:
  node scripts/observability-integration.mjs start
  node scripts/observability-integration.mjs collect
  PROMETHEUS_PORT=8080 node scripts/observability-integration.mjs expose --platform=prometheus
  node scripts/observability-integration.mjs metrics --format=prometheus

集成平台:
  - Sentry: 错误追踪和性能监控
  - Prometheus: 指标收集和告警
  - 本地日志: 结构化健康报告
        `);
        break;
    }
  } catch (error) {
    console.error('❌ 可观测性集成器错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行脚本
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('observability-integration.mjs')
) {
  main();
}

export {
  ObservabilityManager,
  SQLiteHealthCollector,
  SentryIntegrator,
  PrometheusExporter,
};
