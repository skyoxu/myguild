#!/usr/bin/env node
/**
 * Release Health Check Script
 * 基于Sentry API的自动化Release Health监控
 *
 * 功能：
 * - 获取当前Release的Crash-Free Sessions/Users指标
 * - 检查是否低于阈值并触发回滚
 * - 支持多环境和分阶段发布监控
 * - 集成质量门禁系统
 *
 * 创建时间: 2025-08-30
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const HEALTH_CONFIG = {
  // Sentry API配置
  sentry: {
    apiUrl: process.env.SENTRY_API_URL || 'https://sentry.io/api/0',
    authToken: process.env.SENTRY_AUTH_TOKEN || '',
    organization: process.env.SENTRY_ORG || 'vitegame-org',
    project: process.env.SENTRY_PROJECT || 'vitegame',
  },

  // Release Health阈值
  thresholds: {
    crashFreeSessions: {
      critical: 98.0, // 98%以下触发紧急回滚
      warning: 99.0, // 99%以下发出警告
      target: 99.5, // 目标值
    },
    crashFreeUsers: {
      critical: 95.0, // 95%以下触发紧急回滚
      warning: 97.0, // 97%以下发出警告
      target: 98.0, // 目标值
    },
    errorRate: {
      critical: 5.0, // 5%以上触发紧急回滚
      warning: 2.0, // 2%以上发出警告
      target: 1.0, // 目标值
    },
  },

  // 监控时间窗口
  timeWindow: {
    default: '24h', // 默认24小时
    rollout: '1h', // 发布后1小时
    staging: '4h', // staging阶段4小时
  },

  // 输出配置
  output: {
    reportPath: './logs/release-health-report.json',
    alertPath: './logs/release-health-alerts.json',
  },
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      component: 'release-health-check',
      message,
      ...data,
    })
  );
}

/**
 * 获取当前版本信息
 */
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    return {
      version: packageJson.version,
      name: packageJson.name,
      productName: packageJson.productName || packageJson.name,
    };
  } catch (error) {
    log('error', 'Failed to read package.json', { error: error.message });
    return null;
  }
}

/**
 * 调用Sentry API
 */
async function callSentryAPI(endpoint, options = {}) {
  const { sentry } = HEALTH_CONFIG;

  if (!sentry.authToken) {
    throw new Error('SENTRY_AUTH_TOKEN environment variable is required');
  }

  const url = `${sentry.apiUrl}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${sentry.authToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    log('debug', 'Calling Sentry API', {
      url,
      method: options.method || 'GET',
    });

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw new Error(
        `Sentry API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    log('error', 'Sentry API call failed', {
      url,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 获取项目Release列表
 */
async function getProjectReleases(limit = 10) {
  const { sentry } = HEALTH_CONFIG;
  const endpoint = `/projects/${sentry.organization}/${sentry.project}/releases/`;

  return await callSentryAPI(endpoint, {
    headers: {
      Accept: 'application/json',
    },
  });
}

/**
 * 获取Release Health统计
 */
async function getReleaseHealthStats(version, timeWindow = '24h') {
  const { sentry } = HEALTH_CONFIG;
  const endpoint = `/projects/${sentry.organization}/${sentry.project}/releases/${version}/health/`;

  return await callSentryAPI(endpoint, {
    headers: {
      Accept: 'application/json',
    },
  });
}

/**
 * 获取Release会话统计
 */
async function getReleaseSessionStats(version, timeWindow = '24h') {
  const { sentry } = HEALTH_CONFIG;
  const endpoint = `/organizations/${sentry.organization}/sessions/`;

  const params = new URLSearchParams({
    project: sentry.project,
    field: [
      'sum(session)',
      'count_unique(user)',
      'p95(session.duration)',
      'crash_rate_sessions',
      'crash_rate_users',
    ],
    groupBy: ['release', 'environment'],
    interval: '1h',
    query: `release:"${version}"`,
    statsPeriod: timeWindow,
  });

  return await callSentryAPI(`${endpoint}?${params}`);
}

/**
 * 获取错误率统计
 */
async function getErrorRateStats(version, timeWindow = '24h') {
  const { sentry } = HEALTH_CONFIG;
  const endpoint = `/organizations/${sentry.organization}/events-stats/`;

  const params = new URLSearchParams({
    project: sentry.project,
    field: ['count()', 'count_unique(user)'],
    query: `release:"${version}" event.type:error`,
    statsPeriod: timeWindow,
    interval: '1h',
  });

  return await callSentryAPI(`${endpoint}?${params}`);
}

/**
 * 分析Release Health数据
 */
function analyzeHealthData(healthStats, sessionStats, errorStats, version) {
  const analysis = {
    version,
    timestamp: new Date().toISOString(),
    healthy: true,
    issues: [],
    warnings: [],
    metrics: {
      crashFreeSessions: null,
      crashFreeUsers: null,
      errorRate: null,
      sessionCount: null,
      userCount: null,
    },
    recommendations: [],
  };

  try {
    // 分析会话数据
    if (sessionStats && sessionStats.groups) {
      sessionStats.groups.forEach(group => {
        if (group.by && group.by.release === version) {
          const crashRateSessions = group.series?.crash_rate_sessions || [];
          const crashRateUsers = group.series?.crash_rate_users || [];

          if (crashRateSessions.length > 0) {
            const latestSessionRate =
              crashRateSessions[crashRateSessions.length - 1][1];
            analysis.metrics.crashFreeSessions = Math.max(
              0,
              100 - latestSessionRate * 100
            );
          }

          if (crashRateUsers.length > 0) {
            const latestUserRate = crashRateUsers[crashRateUsers.length - 1][1];
            analysis.metrics.crashFreeUsers = Math.max(
              0,
              100 - latestUserRate * 100
            );
          }
        }
      });
    }

    // 分析错误率（简化版）
    if (errorStats && errorStats.data) {
      const totalEvents = errorStats.data.reduce(
        (sum, point) => sum + (point[1] || 0),
        0
      );
      const hours = errorStats.data.length;
      analysis.metrics.errorRate = hours > 0 ? totalEvents / hours : 0;
    }

    // 检查阈值
    const { thresholds } = HEALTH_CONFIG;

    // 检查Crash-Free Sessions
    if (analysis.metrics.crashFreeSessions !== null) {
      if (
        analysis.metrics.crashFreeSessions <
        thresholds.crashFreeSessions.critical
      ) {
        analysis.healthy = false;
        analysis.issues.push({
          type: 'critical',
          metric: 'crashFreeSessions',
          value: analysis.metrics.crashFreeSessions,
          threshold: thresholds.crashFreeSessions.critical,
          message: `Crash-Free Sessions (${analysis.metrics.crashFreeSessions.toFixed(2)}%) below critical threshold (${thresholds.crashFreeSessions.critical}%)`,
        });
      } else if (
        analysis.metrics.crashFreeSessions <
        thresholds.crashFreeSessions.warning
      ) {
        analysis.warnings.push({
          type: 'warning',
          metric: 'crashFreeSessions',
          value: analysis.metrics.crashFreeSessions,
          threshold: thresholds.crashFreeSessions.warning,
          message: `Crash-Free Sessions (${analysis.metrics.crashFreeSessions.toFixed(2)}%) below warning threshold (${thresholds.crashFreeSessions.warning}%)`,
        });
      }
    }

    // 检查Crash-Free Users
    if (analysis.metrics.crashFreeUsers !== null) {
      if (
        analysis.metrics.crashFreeUsers < thresholds.crashFreeUsers.critical
      ) {
        analysis.healthy = false;
        analysis.issues.push({
          type: 'critical',
          metric: 'crashFreeUsers',
          value: analysis.metrics.crashFreeUsers,
          threshold: thresholds.crashFreeUsers.critical,
          message: `Crash-Free Users (${analysis.metrics.crashFreeUsers.toFixed(2)}%) below critical threshold (${thresholds.crashFreeUsers.critical}%)`,
        });
      } else if (
        analysis.metrics.crashFreeUsers < thresholds.crashFreeUsers.warning
      ) {
        analysis.warnings.push({
          type: 'warning',
          metric: 'crashFreeUsers',
          value: analysis.metrics.crashFreeUsers,
          threshold: thresholds.crashFreeUsers.warning,
          message: `Crash-Free Users (${analysis.metrics.crashFreeUsers.toFixed(2)}%) below warning threshold (${thresholds.crashFreeUsers.warning}%)`,
        });
      }
    }

    // 生成建议
    if (analysis.issues.length > 0) {
      analysis.recommendations.push({
        priority: 'immediate',
        action: 'trigger_rollback',
        message:
          'Critical health metrics detected - immediate rollback recommended',
      });
    } else if (analysis.warnings.length > 0) {
      analysis.recommendations.push({
        priority: 'high',
        action: 'investigate',
        message:
          'Health metrics below warning thresholds - investigation recommended',
      });
    }
  } catch (error) {
    log('error', 'Health analysis failed', { error: error.message });
    analysis.healthy = false;
    analysis.issues.push({
      type: 'critical',
      metric: 'analysis',
      message: `Health analysis failed: ${error.message}`,
    });
  }

  return analysis;
}

/**
 * 触发回滚操作
 */
async function triggerRollback(version, reason) {
  log('warn', 'Triggering rollback', { version, reason });

  const rollbackScript = path.join(
    __dirname,
    'release',
    'execute-rollback.mjs'
  );

  if (fs.existsSync(rollbackScript)) {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve, reject) => {
        const child = spawn(
          'node',
          [rollbackScript, '--emergency', `--reason=${reason}`],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd(),
          }
        );

        let output = '';
        child.stdout.on('data', data => {
          output += data.toString();
        });

        child.on('close', code => {
          if (code === 0) {
            log('info', 'Rollback executed successfully', { output });
            resolve({ success: true, output });
          } else {
            log('error', 'Rollback execution failed', { code, output });
            reject(new Error(`Rollback failed with code ${code}`));
          }
        });

        child.on('error', reject);
      });
    } catch (error) {
      log('error', 'Failed to execute rollback', { error: error.message });
      return { success: false, error: error.message };
    }
  } else {
    log('warn', 'Rollback script not found', { rollbackScript });
    return { success: false, error: 'Rollback script not available' };
  }
}

/**
 * 主函数
 */
async function main() {
  const command = process.argv[2];
  const options = {
    version: process.argv
      .find(arg => arg.startsWith('--version='))
      ?.split('=')[1],
    timeWindow:
      process.argv
        .find(arg => arg.startsWith('--time-window='))
        ?.split('=')[1] || HEALTH_CONFIG.timeWindow.default,
    dryRun: process.argv.includes('--dry-run'),
    autoRollback: process.argv.includes('--auto-rollback'),
  };

  try {
    log('info', 'Release health check started', { command, options });

    // 确保日志目录存在
    const logsDir = './logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 获取版本信息
    const versionInfo = getCurrentVersion();
    if (!versionInfo) {
      throw new Error('Unable to determine current version');
    }

    const version = options.version || versionInfo.version;

    switch (command) {
      case 'check':
      case undefined:
        log('info', 'Checking release health', {
          version,
          timeWindow: options.timeWindow,
        });

        // 获取Sentry数据
        log('info', 'Fetching health statistics...');
        const [healthStats, sessionStats, errorStats] = await Promise.all([
          getReleaseHealthStats(version, options.timeWindow).catch(err => {
            log('warn', 'Health stats unavailable', { error: err.message });
            return null;
          }),
          getReleaseSessionStats(version, options.timeWindow).catch(err => {
            log('warn', 'Session stats unavailable', { error: err.message });
            return null;
          }),
          getErrorRateStats(version, options.timeWindow).catch(err => {
            log('warn', 'Error stats unavailable', { error: err.message });
            return null;
          }),
        ]);

        // 分析健康数据
        log('info', 'Analyzing health data...');
        const analysis = analyzeHealthData(
          healthStats,
          sessionStats,
          errorStats,
          version
        );

        // 保存报告
        fs.writeFileSync(
          HEALTH_CONFIG.output.reportPath,
          JSON.stringify(analysis, null, 2)
        );

        // 输出结果
        console.log('\n🏥 Release Health Check Results');
        console.log('================================');
        console.log(`Version: ${analysis.version}`);
        console.log(
          `Health Status: ${analysis.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`
        );

        if (analysis.metrics.crashFreeSessions !== null) {
          console.log(
            `Crash-Free Sessions: ${analysis.metrics.crashFreeSessions.toFixed(2)}%`
          );
        }

        if (analysis.metrics.crashFreeUsers !== null) {
          console.log(
            `Crash-Free Users: ${analysis.metrics.crashFreeUsers.toFixed(2)}%`
          );
        }

        if (analysis.issues.length > 0) {
          console.log('\n🚨 Critical Issues:');
          analysis.issues.forEach(issue => {
            console.log(`  - ${issue.message}`);
          });
        }

        if (analysis.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          analysis.warnings.forEach(warning => {
            console.log(`  - ${warning.message}`);
          });
        }

        if (analysis.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          analysis.recommendations.forEach(rec => {
            console.log(
              `  [${rec.priority.toUpperCase()}] ${rec.action}: ${rec.message}`
            );
          });
        }

        // 自动回滚判断
        if (!analysis.healthy && options.autoRollback && !options.dryRun) {
          const criticalIssues = analysis.issues.filter(
            i => i.type === 'critical'
          );
          if (criticalIssues.length > 0) {
            console.log('\n🔄 Triggering automatic rollback...');
            const rollbackReason = criticalIssues
              .map(i => i.message)
              .join('; ');
            const rollbackResult = await triggerRollback(
              version,
              rollbackReason
            );

            if (rollbackResult.success) {
              console.log('✅ Rollback completed successfully');
            } else {
              console.log(`❌ Rollback failed: ${rollbackResult.error}`);
              process.exit(1);
            }
          }
        }

        // 保存警报信息
        if (analysis.issues.length > 0 || analysis.warnings.length > 0) {
          const alerts = {
            timestamp: analysis.timestamp,
            version: analysis.version,
            severity: analysis.issues.length > 0 ? 'critical' : 'warning',
            issues: analysis.issues,
            warnings: analysis.warnings,
            autoRollback: options.autoRollback,
            dryRun: options.dryRun,
          };
          fs.writeFileSync(
            HEALTH_CONFIG.output.alertPath,
            JSON.stringify(alerts, null, 2)
          );
        }

        console.log(`\n📋 Full report: ${HEALTH_CONFIG.output.reportPath}`);

        // 设置退出码
        if (!analysis.healthy) {
          process.exit(1);
        }

        break;

      case 'list-releases':
        log('info', 'Listing recent releases...');
        const releases = await getProjectReleases(20);

        console.log('\n📦 Recent Releases');
        console.log('==================');
        releases.forEach(release => {
          console.log(`${release.version} (${release.dateCreated})`);
        });
        break;

      default:
        console.log(`
Release Health Check Tool

Usage: node scripts/release-health-check.mjs [command] [options]

Commands:
  check              检查当前版本健康状况 (默认)
  list-releases      列出最近的发布版本

Options:
  --version=<ver>    指定检查的版本 (默认: package.json版本)
  --time-window=<tw> 时间窗口 (默认: 24h)
  --dry-run          仅分析不执行回滚
  --auto-rollback    自动触发回滚

Environment Variables:
  SENTRY_AUTH_TOKEN  Sentry API认证令牌 (必需)
  SENTRY_ORG         Sentry组织名 (默认: vitegame-org)
  SENTRY_PROJECT     Sentry项目名 (默认: vitegame)

Examples:
  npm run release:health-check
  node scripts/release-health-check.mjs check --version=0.1.1 --auto-rollback
  node scripts/release-health-check.mjs check --time-window=1h --dry-run
`);
        break;
    }
  } catch (error) {
    log('error', 'Release health check failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// 如果直接运行脚本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export {
  getCurrentVersion,
  callSentryAPI,
  getReleaseHealthStats,
  getReleaseSessionStats,
  analyzeHealthData,
  triggerRollback,
  HEALTH_CONFIG,
};
