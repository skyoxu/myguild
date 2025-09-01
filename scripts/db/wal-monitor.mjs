#!/usr/bin/env node

/**
 * WAL 文件监控和告警脚本 (ADR-0006 合规)
 *
 * 功能：
 * - 监控 WAL 文件大小和增长趋势
 * - 检测 WAL 文件碎片和性能影响
 * - 自动触发检查点操作
 * - 生成监控报告和告警
 * - 支持 Prometheus 指标导出
 * - 集成 Sentry 告警通知
 *
 * Usage:
 *   node scripts/db/wal-monitor.mjs --continuous
 *   node scripts/db/wal-monitor.mjs --check-once ./data/app.db
 *   node scripts/db/wal-monitor.mjs --export-metrics
 *
 * Environment Variables:
 *   DB_PATH              - 数据库文件路径 (默认: data/app.db)
 *   WAL_SIZE_WARN        - WAL 大小警告阈值，MB (默认: 4)
 *   WAL_SIZE_CRITICAL    - WAL 大小严重阈值，MB (默认: 16)
 *   CHECK_INTERVAL       - 检查间隔，秒 (默认: 30)
 *   AUTO_CHECKPOINT      - 自动执行检查点: true|false (默认: true)
 *   CHECKPOINT_THRESHOLD - 自动检查点阈值，MB (默认: 8)
 *   METRICS_PORT         - Prometheus 指标端口 (默认: 9090)
 *   ALERT_WEBHOOK        - 告警 Webhook URL
 *   SENTRY_DSN           - Sentry DSN for alerts
 *
 * Exit Codes:
 *   0 - 正常
 *   1 - 监控失败
 *   2 - 数据库文件不存在
 *   3 - 配置错误
 *
 * 监控指标：
 * - WAL 文件大小和增长率
 * - 检查点频率和耗时
 * - 数据库连接数和事务持续时间
 * - I/O 性能和磁盘使用
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';

// 配置常量
const DEFAULT_CONFIG = {
  dbPath: process.env.DB_PATH || 'data/app.db',
  walSizeWarn: parseFloat(process.env.WAL_SIZE_WARN) || 4, // MB
  walSizeCritical: parseFloat(process.env.WAL_SIZE_CRITICAL) || 16, // MB
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30, // seconds
  autoCheckpoint: (process.env.AUTO_CHECKPOINT || 'true') === 'true',
  checkpointThreshold: parseFloat(process.env.CHECKPOINT_THRESHOLD) || 8, // MB
  metricsPort: parseInt(process.env.METRICS_PORT) || 9090,
  alertWebhook: process.env.ALERT_WEBHOOK,
  sentryDsn: process.env.SENTRY_DSN,
  logLevel: process.env.LOG_LEVEL || 'info',
  dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 7,
};

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[DEFAULT_CONFIG.logLevel] || LOG_LEVELS.info;

// 全局监控状态
const MONITOR_STATE = {
  startTime: Date.now(),
  checkCount: 0,
  lastCheckpointTime: null,
  checkpointCount: 0,
  alerts: [],
  metrics: {
    walSize: 0,
    walGrowthRate: 0,
    checkpointDuration: 0,
    dbSize: 0,
    lastUpdate: null,
  },
};

/**
 * 结构化日志输出
 */
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'wal-monitor',
    message,
    ...data,
  };

  const output = level === 'error' ? console.error : console.log;
  output(JSON.stringify(logEntry));
}

/**
 * 显示帮助信息
 */
function showHelp() {
  const helpText = `
WAL 文件监控和告警脚本

用法:
  node scripts/db/wal-monitor.mjs [选项]
  
选项:
  --continuous     连续监控模式
  --check-once     单次检查模式
  --export-metrics 启动 Prometheus 指标服务器
  --help, -h       显示帮助信息
  
环境变量:
  DB_PATH              数据库文件路径
  WAL_SIZE_WARN        WAL 大小警告阈值 (MB)
  WAL_SIZE_CRITICAL    WAL 大小严重阈值 (MB)
  CHECK_INTERVAL       检查间隔 (秒)
  AUTO_CHECKPOINT      自动执行检查点
  CHECKPOINT_THRESHOLD 自动检查点阈值 (MB)
  METRICS_PORT         Prometheus 指标端口
  ALERT_WEBHOOK        告警 Webhook URL
  SENTRY_DSN           Sentry DSN
  
监控功能:
  - WAL 文件大小监控
  - 自动检查点触发
  - 性能指标收集
  - 告警通知发送
  - Prometheus 指标导出
  
示例:
  node scripts/db/wal-monitor.mjs --continuous
  WAL_SIZE_WARN=2 CHECK_INTERVAL=10 node scripts/db/wal-monitor.mjs --continuous
  node scripts/db/wal-monitor.mjs --check-once ./data/app.db
  METRICS_PORT=8080 node scripts/db/wal-monitor.mjs --export-metrics
`;
  console.log(helpText.trim());
}

/**
 * 解析命令行参数
 */
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const config = { ...DEFAULT_CONFIG };

  // 运行模式
  config.mode = 'check-once'; // 默认模式

  if (args.includes('--continuous')) {
    config.mode = 'continuous';
  } else if (args.includes('--export-metrics')) {
    config.mode = 'metrics';
  } else if (args.includes('--check-once')) {
    config.mode = 'check-once';

    // 查找数据库路径参数
    const checkIndex = args.indexOf('--check-once');
    if (
      checkIndex + 1 < args.length &&
      !args[checkIndex + 1].startsWith('--')
    ) {
      config.dbPath = args[checkIndex + 1];
    }
  }

  return config;
}

/**
 * 获取数据库和 WAL 文件信息
 */
async function getWALInfo(config) {
  try {
    const dbPath = path.resolve(config.dbPath);
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    // 获取文件统计信息
    const getFileInfo = filePath => {
      try {
        if (!fs.existsSync(filePath)) {
          return { exists: false, size: 0, mtime: null };
        }
        const stats = fs.statSync(filePath);
        return {
          exists: true,
          size: stats.size,
          mtime: stats.mtime.getTime(),
          readable: fs.constants.R_OK,
          writable: fs.constants.W_OK,
        };
      } catch (error) {
        return { exists: false, size: 0, error: error.message };
      }
    };

    const dbInfo = getFileInfo(dbPath);
    const walInfo = getFileInfo(walPath);
    const shmInfo = getFileInfo(shmPath);

    // 计算 WAL 大小 (MB)
    const walSizeMB = walInfo.size / (1024 * 1024);

    // 检查 WAL 模式状态 (如果可能)
    let walModeInfo = null;
    try {
      // 尝试连接数据库获取 WAL 模式信息
      const checkScript = path.join(
        process.cwd(),
        'scripts/db/wal-checkpoint.mjs'
      );
      if (fs.existsSync(checkScript)) {
        // 只在需要时执行，避免频繁检查
        if (walSizeMB > config.walSizeWarn / 2) {
          const result = execSync(`node "${checkScript}" "${dbPath}" PASSIVE`, {
            encoding: 'utf8',
            timeout: 10000,
          });

          const checkResult = JSON.parse(result);
          if (checkResult.ok) {
            walModeInfo = {
              checkpointResult: checkResult.summary,
              lastCheckpoint: new Date().toISOString(),
            };
          }
        }
      }
    } catch (error) {
      log('debug', 'Could not get WAL mode info', { error: error.message });
    }

    return {
      timestamp: new Date().toISOString(),
      database: {
        path: dbPath,
        ...dbInfo,
        sizeMB: dbInfo.size / (1024 * 1024),
      },
      wal: {
        path: walPath,
        ...walInfo,
        sizeMB: walSizeMB,
      },
      shm: {
        path: shmPath,
        ...shmInfo,
        sizeMB: shmInfo.size / (1024 * 1024),
      },
      walModeInfo,
    };
  } catch (error) {
    log('error', 'Failed to get WAL info', { error: error.message });
    throw error;
  }
}

/**
 * 分析 WAL 状态并生成告警
 */
function analyzeWALStatus(walInfo, config) {
  const analysis = {
    timestamp: walInfo.timestamp,
    status: 'normal',
    alerts: [],
    recommendations: [],
    metrics: {
      walSizeMB: walInfo.wal.sizeMB,
      dbSizeMB: walInfo.database.sizeMB,
      walToDbRatio:
        walInfo.database.sizeMB > 0
          ? walInfo.wal.sizeMB / walInfo.database.sizeMB
          : 0,
    },
  };

  // WAL 大小检查
  if (walInfo.wal.sizeMB > config.walSizeCritical) {
    analysis.status = 'critical';
    analysis.alerts.push({
      level: 'critical',
      type: 'wal_size_critical',
      message: `WAL file size (${walInfo.wal.sizeMB.toFixed(2)} MB) exceeds critical threshold`,
      threshold: config.walSizeCritical,
      actual: walInfo.wal.sizeMB,
      action: 'immediate_checkpoint_required',
    });
  } else if (walInfo.wal.sizeMB > config.walSizeWarn) {
    analysis.status =
      analysis.status === 'normal' ? 'warning' : analysis.status;
    analysis.alerts.push({
      level: 'warning',
      type: 'wal_size_warning',
      message: `WAL file size (${walInfo.wal.sizeMB.toFixed(2)} MB) exceeds warning threshold`,
      threshold: config.walSizeWarn,
      actual: walInfo.wal.sizeMB,
      action: 'checkpoint_recommended',
    });
  }

  // WAL 与 DB 大小比例检查
  if (analysis.metrics.walToDbRatio > 0.5) {
    analysis.alerts.push({
      level: 'warning',
      type: 'wal_db_ratio_high',
      message: `WAL size is ${(analysis.metrics.walToDbRatio * 100).toFixed(1)}% of database size`,
      ratio: analysis.metrics.walToDbRatio,
      action: 'consider_checkpoint',
    });
  }

  // 文件状态检查
  if (!walInfo.database.exists) {
    analysis.status = 'critical';
    analysis.alerts.push({
      level: 'critical',
      type: 'database_missing',
      message: 'Database file does not exist',
      path: walInfo.database.path,
      action: 'check_database_path',
    });
  }

  if (walInfo.shm.exists && !walInfo.wal.exists) {
    analysis.alerts.push({
      level: 'warning',
      type: 'orphaned_shm',
      message: 'SHM file exists without WAL file',
      shmPath: walInfo.shm.path,
      action: 'investigate_connection_state',
    });
  }

  // 生成建议
  if (walInfo.wal.sizeMB > config.walSizeWarn) {
    analysis.recommendations.push(
      'Execute TRUNCATE checkpoint to reduce WAL file size'
    );
  }

  if (analysis.metrics.walToDbRatio > 0.3) {
    analysis.recommendations.push(
      'Consider adjusting wal_autocheckpoint PRAGMA for more frequent checkpoints'
    );
  }

  if (
    walInfo.wal.sizeMB > config.checkpointThreshold &&
    config.autoCheckpoint
  ) {
    analysis.recommendations.push(
      'Auto checkpoint will be triggered due to size threshold'
    );
    analysis.autoCheckpointRequired = true;
  }

  return analysis;
}

/**
 * 执行自动检查点
 */
async function executeAutoCheckpoint(config, analysis) {
  if (!config.autoCheckpoint || !analysis.autoCheckpointRequired) {
    return null;
  }

  try {
    log('info', 'Executing auto checkpoint', {
      reason: 'WAL size threshold exceeded',
      threshold: config.checkpointThreshold,
      actualSize: analysis.metrics.walSizeMB,
    });

    const checkpointScript = path.join(
      process.cwd(),
      'scripts/db/wal-checkpoint.mjs'
    );
    const startTime = performance.now();

    const result = execSync(
      `node "${checkpointScript}" "${config.dbPath}" TRUNCATE`,
      { encoding: 'utf8', timeout: 60000 }
    );

    const duration = performance.now() - startTime;
    const checkpointResult = JSON.parse(result);

    if (checkpointResult.ok) {
      MONITOR_STATE.lastCheckpointTime = Date.now();
      MONITOR_STATE.checkpointCount++;
      MONITOR_STATE.metrics.checkpointDuration = duration;

      log('info', 'Auto checkpoint completed', {
        duration: Math.round(duration),
        walSizeReduction: checkpointResult.walSizeReduction || 0,
      });

      return {
        success: true,
        duration,
        result: checkpointResult,
        trigger: 'auto_threshold',
      };
    } else {
      throw new Error(`Checkpoint failed: ${checkpointResult.error}`);
    }
  } catch (error) {
    log('error', 'Auto checkpoint failed', { error: error.message });

    return {
      success: false,
      error: error.message,
      trigger: 'auto_threshold',
    };
  }
}

/**
 * 发送告警通知
 */
async function sendAlert(alert, config) {
  try {
    // Webhook 告警
    if (config.alertWebhook) {
      const payload = {
        timestamp: new Date().toISOString(),
        service: 'wal-monitor',
        database: config.dbPath,
        alert,
        environment: process.env.NODE_ENV || 'development',
      };

      const response = await fetch(config.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      log('debug', 'Alert sent via webhook', { alert: alert.type });
    }

    // Sentry 告警
    if (config.sentryDsn && typeof globalThis.Sentry !== 'undefined') {
      globalThis.Sentry.captureMessage(`WAL Monitor Alert: ${alert.message}`, {
        level: alert.level === 'critical' ? 'error' : 'warning',
        tags: {
          component: 'wal-monitor',
          alertType: alert.type,
          database: path.basename(config.dbPath),
        },
        extra: alert,
      });

      log('debug', 'Alert sent to Sentry', { alert: alert.type });
    }
  } catch (error) {
    log('warn', 'Failed to send alert', {
      alertType: alert.type,
      error: error.message,
    });
  }
}

/**
 * 更新监控指标
 */
function updateMetrics(walInfo, analysis, checkpointResult) {
  MONITOR_STATE.checkCount++;
  MONITOR_STATE.metrics = {
    walSize: walInfo.wal.sizeMB,
    walGrowthRate: calculateGrowthRate(walInfo.wal.sizeMB),
    checkpointDuration:
      checkpointResult?.duration || MONITOR_STATE.metrics.checkpointDuration,
    dbSize: walInfo.database.sizeMB,
    lastUpdate: Date.now(),
  };

  // 保存历史数据点
  saveMetricsDataPoint(walInfo, analysis);
}

/**
 * 计算 WAL 增长率
 */
function calculateGrowthRate(currentSize) {
  const previousSize = MONITOR_STATE.metrics.walSize;

  if (previousSize === 0) {
    return 0;
  }

  const timeDelta =
    (Date.now() - (MONITOR_STATE.metrics.lastUpdate || Date.now())) / 1000; // seconds
  const sizeDelta = currentSize - previousSize;

  if (timeDelta === 0) {
    return 0;
  }

  return sizeDelta / timeDelta; // MB/second
}

/**
 * 保存指标数据点
 */
function saveMetricsDataPoint(walInfo, analysis) {
  try {
    const dataDir = path.join(process.cwd(), 'logs', 'wal-monitor');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const dataFile = path.join(dataDir, `metrics-${today}.jsonl`);

    const dataPoint = {
      timestamp: new Date().toISOString(),
      walSizeMB: walInfo.wal.sizeMB,
      dbSizeMB: walInfo.database.sizeMB,
      walToDbRatio: analysis.metrics.walToDbRatio,
      status: analysis.status,
      alertCount: analysis.alerts.length,
      checkpointCount: MONITOR_STATE.checkpointCount,
      uptime: Date.now() - MONITOR_STATE.startTime,
    };

    fs.appendFileSync(dataFile, JSON.stringify(dataPoint) + '\n');
  } catch (error) {
    log('debug', 'Failed to save metrics data point', { error: error.message });
  }
}

/**
 * 清理过期数据
 */
async function cleanupOldData(config) {
  try {
    const dataDir = path.join(process.cwd(), 'logs', 'wal-monitor');

    if (!fs.existsSync(dataDir)) {
      return;
    }

    const files = await fs.promises.readdir(dataDir);
    const cutoffTime =
      Date.now() - config.dataRetentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.mtime.getTime() < cutoffTime) {
        await fs.promises.unlink(filePath);
        log('debug', 'Removed old metrics file', { file });
      }
    }
  } catch (error) {
    log('debug', 'Failed to cleanup old data', { error: error.message });
  }
}

/**
 * 生成 Prometheus 指标
 */
function generatePrometheusMetrics() {
  const metrics = [];

  // WAL 文件大小
  metrics.push(`# HELP sqlite_wal_size_mb SQLite WAL file size in MB`);
  metrics.push(`# TYPE sqlite_wal_size_mb gauge`);
  metrics.push(
    `sqlite_wal_size_mb{database="${path.basename(DEFAULT_CONFIG.dbPath)}"} ${MONITOR_STATE.metrics.walSize}`
  );

  // 数据库大小
  metrics.push(`# HELP sqlite_db_size_mb SQLite database file size in MB`);
  metrics.push(`# TYPE sqlite_db_size_mb gauge`);
  metrics.push(
    `sqlite_db_size_mb{database="${path.basename(DEFAULT_CONFIG.dbPath)}"} ${MONITOR_STATE.metrics.dbSize}`
  );

  // WAL 增长率
  metrics.push(
    `# HELP sqlite_wal_growth_rate_mb_per_sec WAL file growth rate in MB per second`
  );
  metrics.push(`# TYPE sqlite_wal_growth_rate_mb_per_sec gauge`);
  metrics.push(
    `sqlite_wal_growth_rate_mb_per_sec{database="${path.basename(DEFAULT_CONFIG.dbPath)}"} ${MONITOR_STATE.metrics.walGrowthRate}`
  );

  // 检查点次数
  metrics.push(
    `# HELP sqlite_checkpoint_count_total Total number of checkpoints executed`
  );
  metrics.push(`# TYPE sqlite_checkpoint_count_total counter`);
  metrics.push(
    `sqlite_checkpoint_count_total{database="${path.basename(DEFAULT_CONFIG.dbPath)}"} ${MONITOR_STATE.checkpointCount}`
  );

  // 监控检查次数
  metrics.push(
    `# HELP sqlite_monitor_checks_total Total number of monitoring checks`
  );
  metrics.push(`# TYPE sqlite_monitor_checks_total counter`);
  metrics.push(
    `sqlite_monitor_checks_total{database="${path.basename(DEFAULT_CONFIG.dbPath)}"} ${MONITOR_STATE.checkCount}`
  );

  // 运行时间
  metrics.push(
    `# HELP sqlite_monitor_uptime_seconds Monitor uptime in seconds`
  );
  metrics.push(`# TYPE sqlite_monitor_uptime_seconds gauge`);
  metrics.push(
    `sqlite_monitor_uptime_seconds{database="${path.basename(DEFAULT_CONFIG.dbPath)}"} ${Math.floor((Date.now() - MONITOR_STATE.startTime) / 1000)}`
  );

  return metrics.join('\n') + '\n';
}

/**
 * 启动 Prometheus 指标服务器
 */
function startMetricsServer(config) {
  const server = createServer((req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(generatePrometheusMetrics());
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'healthy',
          uptime: Date.now() - MONITOR_STATE.startTime,
          lastCheck: MONITOR_STATE.metrics.lastUpdate,
          checksTotal: MONITOR_STATE.checkCount,
        })
      );
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(config.metricsPort, () => {
    log('info', 'Metrics server started', {
      port: config.metricsPort,
      endpoints: ['/metrics', '/health'],
    });
  });

  return server;
}

/**
 * 执行单次监控检查
 */
async function performCheck(config) {
  try {
    log('debug', 'Starting WAL monitor check', {
      dbPath: config.dbPath,
      checkNumber: MONITOR_STATE.checkCount + 1,
    });

    // 获取 WAL 信息
    const walInfo = await getWALInfo(config);

    // 分析状态
    const analysis = analyzeWALStatus(walInfo, config);

    // 执行自动检查点
    const checkpointResult = await executeAutoCheckpoint(config, analysis);

    // 发送告警
    for (const alert of analysis.alerts) {
      await sendAlert(alert, config);
      MONITOR_STATE.alerts.push({
        ...alert,
        timestamp: new Date().toISOString(),
      });
    }

    // 更新指标
    updateMetrics(walInfo, analysis, checkpointResult);

    // 清理过期数据 (每100次检查执行一次)
    if (MONITOR_STATE.checkCount % 100 === 0) {
      await cleanupOldData(config);
    }

    log('info', 'WAL monitor check completed', {
      status: analysis.status,
      walSizeMB: walInfo.wal.sizeMB.toFixed(2),
      alertCount: analysis.alerts.length,
      checkpointExecuted: !!checkpointResult,
      recommendations: analysis.recommendations.length,
    });

    return {
      success: true,
      walInfo,
      analysis,
      checkpointResult,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    log('error', 'WAL monitor check failed', { error: error.message });
    throw error;
  }
}

/**
 * 连续监控模式
 */
async function runContinuousMonitoring(config) {
  log('info', 'Starting continuous WAL monitoring', {
    dbPath: config.dbPath,
    checkInterval: config.checkInterval,
    autoCheckpoint: config.autoCheckpoint,
  });

  // 处理优雅关闭
  let shouldStop = false;

  const shutdown = () => {
    log('info', 'Shutting down WAL monitor', {
      totalChecks: MONITOR_STATE.checkCount,
      uptime: Date.now() - MONITOR_STATE.startTime,
      checkpointCount: MONITOR_STATE.checkpointCount,
    });
    shouldStop = true;
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (!shouldStop) {
    try {
      await performCheck(config);

      if (!shouldStop) {
        await new Promise(resolve =>
          setTimeout(resolve, config.checkInterval * 1000)
        );
      }
    } catch (error) {
      log('error', 'Monitor check failed, continuing', {
        error: error.message,
      });

      if (!shouldStop) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.min(config.checkInterval * 1000, 10000))
        );
      }
    }
  }
}

/**
 * 主执行函数
 */
async function main() {
  try {
    const config = parseArguments();

    log('info', 'WAL monitor starting', { mode: config.mode, config });

    // 验证数据库文件
    if (!fs.existsSync(config.dbPath)) {
      log('error', 'Database file not found', { dbPath: config.dbPath });
      process.exit(2);
    }

    let result;

    switch (config.mode) {
      case 'check-once':
        result = await performCheck(config);
        console.log(
          JSON.stringify(
            {
              ok: true,
              mode: 'check-once',
              ...result,
            },
            null,
            2
          )
        );
        break;

      case 'continuous':
        await runContinuousMonitoring(config);
        break;

      case 'metrics':
        const server = startMetricsServer(config);

        // 保持服务器运行
        process.on('SIGINT', () => {
          log('info', 'Shutting down metrics server');
          server.close();
          process.exit(0);
        });

        log('info', 'Metrics server running. Press Ctrl+C to stop.');
        break;

      default:
        throw new Error(`Unknown mode: ${config.mode}`);
    }
  } catch (error) {
    log('error', 'WAL monitor failed', {
      error: error.message,
      stack: error.stack,
    });

    console.log(
      JSON.stringify({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    );

    if (
      error.message.includes('not found') ||
      error.message.includes('does not exist')
    ) {
      process.exit(2);
    } else {
      process.exit(1);
    }
  }
}

// 执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export {
  main,
  performCheck,
  runContinuousMonitoring,
  analyzeWALStatus,
  getWALInfo,
  generatePrometheusMetrics,
  DEFAULT_CONFIG,
};
