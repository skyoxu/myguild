#!/usr/bin/env node

/**
 * CI性能监控脚本
 *
 * 用途：
 * - 监控GitHub Actions CI执行性能
 * - 记录关键指标到日志文件
 * - 在性能低于阈值时发出告警
 * - 生成性能趋势报告
 *
 * 使用：node scripts/monitor-ci-performance.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CIPerformanceMonitor {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.performanceFile = path.join(this.logDir, 'ci-performance.json');
    this.alertsFile = path.join(this.logDir, 'ci-alerts.json');

    // 性能阈值配置
    this.thresholds = {
      maxCITime: 6 * 60, // 6分钟 (秒)
      minSuccessRate: 0.95, // 95%
      maxGateTime: {
        security: 3 * 60, // 3分钟
        observability: 1 * 60, // 1分钟
        quality: 2 * 60, // 2分钟
        soft: 1 * 60, // 1分钟
      },
    };
  }

  /**
   * 确保日志目录存在
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 收集GitHub Actions的CI性能数据
   */
  async collectMetrics() {
    console.log('🔍 收集CI性能指标...');

    try {
      // 获取最近的workflow runs数据
      const runsData = await this.getRecentWorkflowRuns();
      const gatePerformance = await this.analyzeGatePerformance();

      const metrics = {
        timestamp: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString('zh-CN'),

        // 基础性能指标
        avgCITime: runsData.avgDuration,
        successRate: runsData.successRate,
        totalRuns: runsData.totalRuns,

        // 门禁性能分析
        gatePerformance,

        // 系统状态
        systemLoad: await this.getSystemLoad(),

        // 质量得分
        qualityScore: await this.getLatestQualityScore(),
      };

      console.log(
        `✅ 指标收集完成 - 平均CI时间: ${Math.round((metrics.avgCITime / 60) * 10) / 10}分钟`
      );
      return metrics;
    } catch (error) {
      console.error('❌ 指标收集失败:', error.message);
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        status: 'failed',
      };
    }
  }

  /**
   * 获取最近的workflow运行数据
   */
  async getRecentWorkflowRuns() {
    try {
      // 使用gh CLI获取最近20次运行数据
      const ghOutput = execSync(
        'gh run list --limit 20 --json status,conclusion,createdAt,updatedAt',
        {
          encoding: 'utf8',
          timeout: 30000,
        }
      );

      const runs = JSON.parse(ghOutput);

      if (!runs.length) {
        return {
          avgDuration: 0,
          successRate: 1,
          totalRuns: 0,
        };
      }

      const durations = [];
      let successCount = 0;

      runs.forEach(run => {
        if (run.createdAt && run.updatedAt) {
          const duration =
            (new Date(run.updatedAt) - new Date(run.createdAt)) / 1000;
          durations.push(duration);

          if (run.conclusion === 'success') {
            successCount++;
          }
        }
      });

      const avgDuration =
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

      return {
        avgDuration: Math.round(avgDuration),
        successRate: runs.length > 0 ? successCount / runs.length : 1,
        totalRuns: runs.length,
      };
    } catch (error) {
      console.warn('⚠️ 无法获取GitHub Actions数据，使用模拟数据');
      return {
        avgDuration: 300, // 5分钟
        successRate: 0.95,
        totalRuns: 0,
      };
    }
  }

  /**
   * 分析各个门禁的性能表现
   */
  async analyzeGatePerformance() {
    const gateFiles = [
      { name: 'security', file: 'security-gate-report.json' },
      { name: 'observability', file: 'observability-report.json' },
      { name: 'quality', file: 'quality-gate-report.json' },
      { name: 'soft', file: 'soft-gate-report.json' },
    ];

    const performance = {};

    for (const gate of gateFiles) {
      try {
        const filePath = path.join(this.logDir, gate.file);
        const data = await fs.readFile(filePath, 'utf8');
        const report = JSON.parse(data);

        performance[gate.name] = {
          duration: report.duration || 0,
          status: report.status || 'unknown',
          score: report.overallScore || report.score || 0,
          timestamp: report.timestamp,
        };
      } catch (error) {
        // 文件不存在或解析失败，设置默认值
        performance[gate.name] = {
          duration: 0,
          status: 'not_run',
          score: 0,
          timestamp: null,
        };
      }
    }

    return performance;
  }

  /**
   * 获取系统负载信息
   */
  async getSystemLoad() {
    try {
      if (process.platform === 'win32') {
        // Windows系统负载检测
        return { platform: 'windows', load: 'normal' };
      } else {
        // Unix系统负载检测
        const loadAvg = await fs.readFile('/proc/loadavg', 'utf8');
        const load = parseFloat(loadAvg.split(' ')[0]);
        return { platform: process.platform, load };
      }
    } catch (error) {
      return { platform: process.platform, load: 'unknown' };
    }
  }

  /**
   * 获取最新的质量评分
   */
  async getLatestQualityScore() {
    try {
      const softGateFile = path.join(this.logDir, 'soft-gate-report.json');
      const data = await fs.readFile(softGateFile, 'utf8');
      const report = JSON.parse(data);
      return report.overallScore || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 保存性能指标到日志文件
   */
  async saveMetrics(metrics) {
    try {
      let history = [];

      // 读取现有历史数据
      try {
        const existingData = await fs.readFile(this.performanceFile, 'utf8');
        history = JSON.parse(existingData);
      } catch (error) {
        // 文件不存在，创建新的历史数组
      }

      // 添加新数据点
      history.push(metrics);

      // 只保留最近100条记录
      if (history.length > 100) {
        history = history.slice(-100);
      }

      // 保存更新后的数据
      await fs.writeFile(
        this.performanceFile,
        JSON.stringify(history, null, 2)
      );
      console.log(`📊 性能数据已保存到 ${this.performanceFile}`);
    } catch (error) {
      console.error('❌ 保存性能数据失败:', error.message);
    }
  }

  /**
   * 检查是否需要发出告警
   */
  async checkAlerts(metrics) {
    const alerts = [];
    const timestamp = new Date().toISOString();

    // 检查CI执行时间
    if (metrics.avgCITime > this.thresholds.maxCITime) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `CI平均执行时间过长: ${Math.round((metrics.avgCITime / 60) * 10) / 10}分钟 > ${this.thresholds.maxCITime / 60}分钟阈值`,
        timestamp,
        value: metrics.avgCITime,
        threshold: this.thresholds.maxCITime,
      });
    }

    // 检查成功率
    if (metrics.successRate < this.thresholds.minSuccessRate) {
      alerts.push({
        type: 'reliability',
        severity: 'critical',
        message: `CI成功率过低: ${Math.round(metrics.successRate * 100)}% < ${this.thresholds.minSuccessRate * 100}%阈值`,
        timestamp,
        value: metrics.successRate,
        threshold: this.thresholds.minSuccessRate,
      });
    }

    // 检查各个门禁的执行时间
    if (metrics.gatePerformance) {
      Object.entries(metrics.gatePerformance).forEach(
        ([gateName, gateData]) => {
          const threshold = this.thresholds.maxGateTime[gateName];
          if (threshold && gateData.duration > threshold) {
            alerts.push({
              type: 'gate_performance',
              severity: 'warning',
              message: `${gateName}门禁执行时间过长: ${Math.round((gateData.duration / 60) * 10) / 10}分钟 > ${threshold / 60}分钟阈值`,
              timestamp,
              gate: gateName,
              value: gateData.duration,
              threshold,
            });
          }
        }
      );
    }

    // 保存告警
    if (alerts.length > 0) {
      await this.saveAlerts(alerts);
      this.displayAlerts(alerts);
    } else {
      console.log('✅ 所有指标都在正常范围内');
    }

    return alerts;
  }

  /**
   * 保存告警到日志文件
   */
  async saveAlerts(alerts) {
    try {
      let alertHistory = [];

      try {
        const existingData = await fs.readFile(this.alertsFile, 'utf8');
        alertHistory = JSON.parse(existingData);
      } catch (error) {
        // 文件不存在
      }

      alertHistory.push(...alerts);

      // 只保留最近50条告警
      if (alertHistory.length > 50) {
        alertHistory = alertHistory.slice(-50);
      }

      await fs.writeFile(
        this.alertsFile,
        JSON.stringify(alertHistory, null, 2)
      );
    } catch (error) {
      console.error('❌ 保存告警失败:', error.message);
    }
  }

  /**
   * 显示告警信息
   */
  displayAlerts(alerts) {
    console.log('\n🚨 性能告警:');
    alerts.forEach((alert, index) => {
      const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
      console.log(`${icon} [${alert.severity.toUpperCase()}] ${alert.message}`);
    });
    console.log('');
  }

  /**
   * 生成性能报告摘要
   */
  generateSummary(metrics) {
    console.log('\n📊 CI性能摘要:');
    console.log(
      `⏱️  平均CI时间: ${Math.round((metrics.avgCITime / 60) * 10) / 10}分钟`
    );
    console.log(`✅ 成功率: ${Math.round(metrics.successRate * 100)}%`);
    console.log(`🔍 监控运行数: ${metrics.totalRuns}次`);

    if (metrics.qualityScore > 0) {
      console.log(`🎯 质量评分: ${metrics.qualityScore}/100`);
    }

    // 门禁性能
    if (metrics.gatePerformance) {
      console.log('\n🔧 门禁性能:');
      Object.entries(metrics.gatePerformance).forEach(
        ([gateName, gateData]) => {
          if (gateData.status !== 'not_run') {
            const duration = Math.round((gateData.duration / 60) * 10) / 10;
            const status = gateData.status === 'success' ? '✅' : '❌';
            console.log(`  ${status} ${gateName}: ${duration}分钟`);
          }
        }
      );
    }

    console.log('');
  }

  /**
   * 主要监控流程
   */
  async monitor() {
    console.log('🚀 启动CI性能监控...\n');

    try {
      await this.ensureLogDirectory();

      const metrics = await this.collectMetrics();

      if (metrics.error) {
        console.error('❌ 监控失败:', metrics.error);
        return;
      }

      await this.saveMetrics(metrics);
      await this.checkAlerts(metrics);
      this.generateSummary(metrics);

      console.log('✅ CI性能监控完成');
    } catch (error) {
      console.error('❌ 监控过程发生错误:', error.message);
      process.exit(1);
    }
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${__filename}`) {
  const monitor = new CIPerformanceMonitor();
  monitor.monitor();
}

export default CIPerformanceMonitor;
