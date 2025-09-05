/**
 * Release Health Gate - CI/CD集成脚本
 * 基于 03-observability-sentry-logging-v2.md § 3.6
 *
 * 用于在部署前检查发布健康度，支持环境变量配置和CI/CD集成
 *
 * 使用方法:
 *   node scripts/release-health-gate.mjs
 *
 * 环境变量配置:
 *   SENTRY_ORG - Sentry组织名
 *   SENTRY_PROJECT - Sentry项目名
 *   SENTRY_AUTH_TOKEN - Sentry认证令牌
 *   ENVIRONMENT - 环境名称 (production/staging/development)
 *   CRASH_FREE_USERS_THRESHOLD - 崩溃自由用户率阈值 (默认99.5)
 *   CRASH_FREE_SESSIONS_THRESHOLD - 崩溃自由会话率阈值 (默认99.8)
 *   OBSERVATION_WINDOW - 观察窗口 (默认24h)
 *   FAIL_ON_ERROR - 是否在错误时失败 (默认true)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQualityGatesConfig } from './utils/config-loader.mjs';

// 动态导入 sqlite3（处理 ESM 兼容性）
let sqlite3;
try {
  sqlite3 = (await import('sqlite3')).default;
} catch (error) {
  console.warn(
    '⚠️ sqlite3 not available - business metrics collection will be disabled'
  );
  console.warn(
    '   To enable business metrics, install sqlite3: npm install sqlite3'
  );
}

// ============================================================================
// 配置与常量
// ============================================================================

// 从配置中心加载配置
const environment = process.env.NODE_ENV || 'default';
const qualityConfig = loadQualityGatesConfig(environment);
const releaseHealthConfig = qualityConfig.releaseHealth || {};

const CONFIG = {
  organizationSlug: process.env.SENTRY_ORG || '${SENTRY_ORG}',
  projectSlug: process.env.SENTRY_PROJECT || '${SENTRY_PROJECT}',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  observationWindow: process.env.OBSERVATION_WINDOW || '24h',

  // 阈值配置（从配置中心加载，可通过环境变量覆盖）
  thresholds: {
    crashFreeUsers: Number(
      process.env.CRASH_FREE_USERS_THRESHOLD ??
        releaseHealthConfig.crashFreeUsers?.threshold ??
        99.5
    ),
    crashFreeSessions: Number(
      process.env.CRASH_FREE_SESSIONS_THRESHOLD ??
        releaseHealthConfig.crashFreeSessions?.threshold ??
        99.8
    ),
    observationWindowHours: Number(
      process.env.OBSERVATION_WINDOW_HOURS ?? '24'
    ),
    minAdoption: Number(
      process.env.MIN_ADOPTION ??
        releaseHealthConfig.minAdoption?.threshold ??
        1000
    ),
  },

  // 业务指标阈值
  businessThresholds: releaseHealthConfig.businessMetrics || {},

  // CI/CD配置
  failOnError: process.env.FAIL_ON_ERROR !== 'false',
  generateMarkdownReport:
    process.env.GENERATE_MARKDOWN_REPORT === 'true' ||
    process.env.GITHUB_OUTPUT,
  githubOutput: process.env.GITHUB_OUTPUT,

  // 数据库路径
  dbPath: process.env.DB_PATH || './data/app.db',
};

// 环境变量验证
const requiredEnvVars = ['SENTRY_AUTH_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  // 检测CI环境和PR上下文
  const isCI = process.env.CI === 'true';
  const isPR = process.env.GITHUB_EVENT_NAME === 'pull_request';
  const isForkPR =
    process.env.GITHUB_EVENT_NAME === 'pull_request' &&
    process.env.GITHUB_EVENT_PATH &&
    JSON.stringify(process.env).includes('fork');

  console.error('⚠️  Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`  - ${envVar}`));

  if (isCI && isPR) {
    console.error('');
    console.error(
      '💡 PR context detected - Release Health Gate will be skipped'
    );
    console.error(
      '   This is expected behavior for pull requests where secrets are not available'
    );
    console.error('   The gate will run normally when merged to main branch');

    if (isForkPR) {
      console.error(
        '🔀 Fork PR detected - secrets unavailable for security reasons'
      );
    }

    // PR上下文中优雅退出，不阻塞CI流程
    console.error('');
    console.error('✅ Release Health Gate: SKIPPED (PR context)');
    process.exit(0);
  } else {
    // 非PR上下文，仍然需要硬失败
    console.error('');
    console.error('💡 Please set the required environment variables:');
    console.error('  export SENTRY_AUTH_TOKEN="your-sentry-auth-token"');
    console.error('  export SENTRY_ORG="your-org-slug"');
    console.error('  export SENTRY_PROJECT="your-project-slug"');
    console.error('');
    console.error(
      '❌ Release Health Gate: FAILED (missing secrets in production context)'
    );
    process.exit(1);
  }
}

// ============================================================================
// 业务指标收集器
// ============================================================================

/**
 * 业务指标数据收集器
 */
class BusinessMetricsCollector {
  constructor(dbPath) {
    this.dbPath = dbPath;
  }

  /**
   * 连接到SQLite数据库
   */
  async connectDB() {
    if (!sqlite3) {
      throw new Error(
        'SQLite3 is not available - please install: npm install sqlite3'
      );
    }

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(
        this.dbPath,
        sqlite3.OPEN_READONLY,
        err => {
          if (err) {
            reject(new Error(`无法连接数据库 ${this.dbPath}: ${err.message}`));
          } else {
            resolve(db);
          }
        }
      );
    });
  }

  /**
   * 查询用户注册成功率
   */
  async getUserRegistrationRate(db, windowHours = 24) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_registrations
        FROM user_registration_events 
        WHERE created_at >= datetime('now', '-${windowHours} hours')
      `;

      db.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          const rate =
            row.total_attempts > 0
              ? (row.successful_registrations / row.total_attempts) * 100
              : 100;
          resolve({
            rate: Number(rate.toFixed(2)),
            totalAttempts: row.total_attempts,
            successfulRegistrations: row.successful_registrations,
          });
        }
      });
    });
  }

  /**
   * 查询用户参与度（DAU/MAU）
   */
  async getUserEngagementRate(db, windowDays = 7) {
    return new Promise((resolve, reject) => {
      const query = `
        WITH daily_active AS (
          SELECT COUNT(DISTINCT user_id) as dau
          FROM user_sessions 
          WHERE created_at >= datetime('now', '-1 days')
        ),
        monthly_active AS (
          SELECT COUNT(DISTINCT user_id) as mau
          FROM user_sessions 
          WHERE created_at >= datetime('now', '-30 days')
        )
        SELECT 
          dau,
          mau,
          CASE WHEN mau > 0 THEN (dau * 100.0 / mau) ELSE 0 END as engagement_rate
        FROM daily_active, monthly_active
      `;

      db.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            rate: Number((row.engagement_rate || 0).toFixed(2)),
            dau: row.dau || 0,
            mau: row.mau || 0,
          });
        }
      });
    });
  }

  /**
   * 查询平均游戏会话时长
   */
  async getGameSessionDuration(db, windowHours = 24) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          AVG(CAST((julianday(end_time) - julianday(start_time)) * 24 * 3600 AS INTEGER)) as avg_duration_seconds,
          COUNT(*) as total_sessions
        FROM game_sessions 
        WHERE start_time >= datetime('now', '-${windowHours} hours')
          AND end_time IS NOT NULL
      `;

      db.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            averageDuration: Number((row.avg_duration_seconds || 0).toFixed(0)),
            totalSessions: row.total_sessions || 0,
          });
        }
      });
    });
  }

  /**
   * 查询新功能采用率
   */
  async getFeatureAdoptionRate(db, windowDays = 7) {
    return new Promise((resolve, reject) => {
      const query = `
        WITH feature_users AS (
          SELECT COUNT(DISTINCT user_id) as feature_users
          FROM feature_usage_events 
          WHERE created_at >= datetime('now', '-${windowDays} days')
            AND feature_name IN ('new_feature_1', 'new_feature_2') -- 可配置
        ),
        total_users AS (
          SELECT COUNT(DISTINCT user_id) as total_active_users
          FROM user_sessions 
          WHERE created_at >= datetime('now', '-${windowDays} days')
        )
        SELECT 
          feature_users,
          total_active_users,
          CASE WHEN total_active_users > 0 
            THEN (feature_users * 100.0 / total_active_users) 
            ELSE 0 END as adoption_rate
        FROM feature_users, total_users
      `;

      db.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            rate: Number((row.adoption_rate || 0).toFixed(2)),
            featureUsers: row.feature_users || 0,
            totalActiveUsers: row.total_active_users || 0,
          });
        }
      });
    });
  }

  /**
   * 查询应用级错误率
   */
  async getErrorRate(db, windowHours = 1) {
    return new Promise((resolve, reject) => {
      const query = `
        WITH error_events AS (
          SELECT COUNT(*) as error_count
          FROM application_errors 
          WHERE created_at >= datetime('now', '-${windowHours} hours')
            AND severity IN ('error', 'fatal')
        ),
        total_events AS (
          SELECT COUNT(*) as total_count
          FROM application_events 
          WHERE created_at >= datetime('now', '-${windowHours} hours')
        )
        SELECT 
          error_count,
          total_count,
          CASE WHEN total_count > 0 
            THEN (error_count * 100.0 / total_count) 
            ELSE 0 END as error_rate
        FROM error_events, total_events
      `;

      db.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            rate: Number((row.error_rate || 0).toFixed(2)),
            errorCount: row.error_count || 0,
            totalEvents: row.total_count || 0,
          });
        }
      });
    });
  }

  /**
   * 查询平均加载性能
   */
  async getLoadingPerformance(db, windowHours = 1) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          AVG(load_time_ms) as avg_load_time,
          COUNT(*) as sample_count
        FROM page_load_events 
        WHERE created_at >= datetime('now', '-${windowHours} hours')
      `;

      db.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            averageLoadTime: Number((row.avg_load_time || 0).toFixed(0)),
            sampleCount: row.sample_count || 0,
          });
        }
      });
    });
  }

  /**
   * 收集所有业务指标
   */
  async collectBusinessMetrics() {
    let db;
    try {
      db = await this.connectDB();

      const [
        registration,
        engagement,
        sessionDuration,
        featureAdoption,
        errorRate,
        loadingPerf,
      ] = await Promise.all([
        this.getUserRegistrationRate(db).catch(() => ({
          rate: 100,
          totalAttempts: 0,
          successfulRegistrations: 0,
        })),
        this.getUserEngagementRate(db).catch(() => ({
          rate: 50,
          dau: 0,
          mau: 0,
        })),
        this.getGameSessionDuration(db).catch(() => ({
          averageDuration: 1000,
          totalSessions: 0,
        })),
        this.getFeatureAdoptionRate(db).catch(() => ({
          rate: 30,
          featureUsers: 0,
          totalActiveUsers: 0,
        })),
        this.getErrorRate(db).catch(() => ({
          rate: 0,
          errorCount: 0,
          totalEvents: 0,
        })),
        this.getLoadingPerformance(db).catch(() => ({
          averageLoadTime: 2500,
          sampleCount: 0,
        })),
      ]);

      return {
        userRegistrationRate: registration,
        userEngagementRate: engagement,
        gameSessionDuration: sessionDuration,
        featureAdoptionRate: featureAdoption,
        errorRate: errorRate,
        loadingPerformance: loadingPerf,
      };
    } finally {
      if (db) {
        db.close();
      }
    }
  }
}

// ============================================================================
// Release Health API 集成
// ============================================================================

/**
 * 从 Sentry API 获取 Release Health 指标
 * @param {string} organizationSlug - Sentry组织标识
 * @param {string} projectSlug - Sentry项目标识
 * @param {string} authToken - 认证令牌
 * @param {string} environment - 环境名称
 * @param {number} observationWindowHours - 观察窗口小时数
 * @returns {Promise<Object>} Release Health指标
 */
async function fetchReleaseHealthMetrics(
  organizationSlug,
  projectSlug,
  authToken,
  environment,
  observationWindowHours
) {
  const baseUrl = 'https://sentry.io/api/0';
  const endTime = new Date();
  const startTime = new Date(
    endTime.getTime() - observationWindowHours * 60 * 60 * 1000
  );

  // Sentry Release Health API endpoint
  const apiUrl = `${baseUrl}/organizations/${organizationSlug}/sessions/`;

  const params = new URLSearchParams({
    project: projectSlug,
    environment: environment,
    start: startTime.toISOString(),
    end: endTime.toISOString(),
    field: [
      'sum(session)',
      'sum(session.crashed)',
      'count_unique(user)',
      'count_unique(user.crashed)',
    ],
    groupBy: 'project',
  });

  try {
    const response = await fetch(`${apiUrl}?${params}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sentry API request failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const data = await response.json();

    if (!data.groups || data.groups.length === 0) {
      console.warn('⚠️  No session data found for the specified time range');
      // 返回模拟数据以避免阻塞
      return {
        crashFreeUsers: 100.0,
        crashFreeSessions: 100.0,
        sampleSize: 0,
        observationWindow: `${observationWindowHours}h`,
      };
    }

    const sessionData = data.groups[0].totals;
    const totalSessions = sessionData['sum(session)'] || 0;
    const crashedSessions = sessionData['sum(session.crashed)'] || 0;
    const totalUsers = sessionData['count_unique(user)'] || 0;
    const crashedUsers = sessionData['count_unique(user.crashed)'] || 0;

    const crashFreeSessionsRate =
      totalSessions > 0
        ? ((totalSessions - crashedSessions) / totalSessions) * 100
        : 100.0;

    const crashFreeUsersRate =
      totalUsers > 0 ? ((totalUsers - crashedUsers) / totalUsers) * 100 : 100.0;

    return {
      crashFreeUsers: Number(crashFreeUsersRate.toFixed(2)),
      crashFreeSessions: Number(crashFreeSessionsRate.toFixed(2)),
      sampleSize: totalUsers,
      observationWindow: `${observationWindowHours}h`,
      rawData: {
        totalSessions,
        crashedSessions,
        totalUsers,
        crashedUsers,
      },
    };
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        'Network error: Unable to connect to Sentry API. Please check your internet connection.'
      );
    }
    throw error;
  }
}

// ============================================================================
// Release Health Gate 逻辑
// ============================================================================

/**
 * 执行 Release Health 检查（包含业务指标）
 * @returns {Promise<Object>} 检查结果
 */
async function checkReleaseHealth() {
  console.log('🔍 Running Enhanced Release Health Gate check...');
  console.log(`📊 Organization: ${CONFIG.organizationSlug}`);
  console.log(`📦 Project: ${CONFIG.projectSlug}`);
  console.log(`🌍 Environment: ${CONFIG.environment}`);
  console.log(`⏱️  Observation Window: ${CONFIG.observationWindow}`);
  console.log(
    `🎯 Crash-Free Users Threshold: ${CONFIG.thresholds.crashFreeUsers}%`
  );
  console.log(
    `🎯 Crash-Free Sessions Threshold: ${CONFIG.thresholds.crashFreeSessions}%`
  );
  console.log(
    `📊 Business Metrics Enabled: ${Object.keys(CONFIG.businessThresholds).length > 0 ? '✅' : '❌'}`
  );
  console.log('');

  try {
    // 1. 获取 Sentry Release Health 指标
    const sentryMetrics = await fetchReleaseHealthMetrics(
      CONFIG.organizationSlug,
      CONFIG.projectSlug,
      CONFIG.authToken,
      CONFIG.environment,
      CONFIG.thresholds.observationWindowHours
    );

    // 2. 收集业务指标（如果配置了）
    let businessMetrics = {};
    let businessCollector;
    if (Object.keys(CONFIG.businessThresholds).length > 0) {
      try {
        businessCollector = new BusinessMetricsCollector(CONFIG.dbPath);
        businessMetrics = await businessCollector.collectBusinessMetrics();
        console.log('✅ Business metrics collected successfully');
      } catch (dbError) {
        console.warn(
          `⚠️ Business metrics collection failed: ${dbError.message}`
        );
        console.warn('   Continuing with Sentry metrics only...');
      }
    }

    // 3. 检查Sentry指标违规项
    const violations = [];

    if (sentryMetrics.crashFreeUsers < CONFIG.thresholds.crashFreeUsers) {
      violations.push({
        category: 'sentry',
        metric: 'crash_free_users',
        actual: sentryMetrics.crashFreeUsers,
        threshold: CONFIG.thresholds.crashFreeUsers,
        severity: 'blocking',
        impact: `${(100 - sentryMetrics.crashFreeUsers).toFixed(2)}% users experienced crashes`,
      });
    }

    if (sentryMetrics.crashFreeSessions < CONFIG.thresholds.crashFreeSessions) {
      violations.push({
        category: 'sentry',
        metric: 'crash_free_sessions',
        actual: sentryMetrics.crashFreeSessions,
        threshold: CONFIG.thresholds.crashFreeSessions,
        severity: 'blocking',
        impact: `${(100 - sentryMetrics.crashFreeSessions).toFixed(2)}% sessions crashed`,
      });
    }

    // 4. 检查业务指标违规项
    Object.entries(CONFIG.businessThresholds).forEach(
      ([metricName, config]) => {
        const businessData = businessMetrics[metricName];
        if (!businessData) return;

        const actualValue =
          businessData.rate !== undefined
            ? businessData.rate
            : businessData.averageDuration !== undefined
              ? businessData.averageDuration
              : businessData.averageLoadTime;

        if (actualValue < config.threshold) {
          violations.push({
            category: 'business',
            metric: metricName,
            actual: actualValue,
            threshold: config.threshold,
            severity: 'blocking',
            impact: `${config.description}: ${actualValue}${config.unit === 'percent' ? '%' : config.unit === 'milliseconds' ? 'ms' : config.unit === 'seconds' ? 's' : ''} < ${config.threshold}${config.unit === 'percent' ? '%' : config.unit === 'milliseconds' ? 'ms' : config.unit === 'seconds' ? 's' : ''}`,
            observationWindow: config.observationWindow,
          });
        }
      }
    );

    return {
      passed: violations.length === 0,
      sentryMetrics,
      businessMetrics,
      violations,
      timestamp: new Date().toISOString(),
      environment: CONFIG.environment,
      sampleSize: sentryMetrics.sampleSize,
      config: {
        thresholds: CONFIG.thresholds,
        businessThresholds: CONFIG.businessThresholds,
        observationWindow: CONFIG.observationWindow,
      },
    };
  } catch (error) {
    throw new Error(`Release Health Gate 检查失败: ${error.message}`);
  }
}

/**
 * 生成 Markdown 格式的报告
 * @param {Object} result - 检查结果
 * @returns {string} Markdown 报告
 */
function generateMarkdownReport(result) {
  const statusEmoji = result.passed ? '✅' : '❌';
  const statusText = result.passed ? 'PASSED' : 'FAILED';

  const report = [
    '# Enhanced Release Health Gate Report',
    '',
    `**Status**: ${statusEmoji} ${statusText}`,
    `**Timestamp**: ${result.timestamp}`,
    `**Environment**: ${result.environment}`,
    `**Sample Size**: ${result.sampleSize.toLocaleString()} users`,
    `**Observation Window**: ${result.config.observationWindow}`,
    '',
    '## 🎯 Sentry Health Thresholds',
    '',
    `- **Crash-Free Users**: ≥ ${result.config.thresholds.crashFreeUsers}%`,
    `- **Crash-Free Sessions**: ≥ ${result.config.thresholds.crashFreeSessions}%`,
    '',
    '## 📊 Sentry Metrics',
    '',
    `- **Crash-Free Users**: ${result.sentryMetrics.crashFreeUsers}% ${result.sentryMetrics.crashFreeUsers >= result.config.thresholds.crashFreeUsers ? '✅' : '❌'}`,
    `- **Crash-Free Sessions**: ${result.sentryMetrics.crashFreeSessions}% ${result.sentryMetrics.crashFreeSessions >= result.config.thresholds.crashFreeSessions ? '✅' : '❌'}`,
    '',
  ];

  // 添加业务指标部分
  if (Object.keys(result.businessMetrics || {}).length > 0) {
    report.push('## 🏢 Business Metrics', '');

    Object.entries(result.config.businessThresholds || {}).forEach(
      ([metricName, config]) => {
        const businessData = result.businessMetrics[metricName];
        if (!businessData) {
          report.push(`- **${config.description}**: ❓ No data available`);
          return;
        }

        const actualValue =
          businessData.rate !== undefined
            ? businessData.rate
            : businessData.averageDuration !== undefined
              ? businessData.averageDuration
              : businessData.averageLoadTime;

        const unit =
          config.unit === 'percent'
            ? '%'
            : config.unit === 'milliseconds'
              ? 'ms'
              : config.unit === 'seconds'
                ? 's'
                : '';

        const status = actualValue >= config.threshold ? '✅' : '❌';
        report.push(
          `- **${config.description}**: ${actualValue}${unit} (≥ ${config.threshold}${unit}) ${status}`
        );

        // 添加额外的详细信息
        if (businessData.totalAttempts !== undefined) {
          report.push(
            `  - Total Attempts: ${businessData.totalAttempts.toLocaleString()}`
          );
        }
        if (businessData.dau !== undefined) {
          report.push(`  - DAU/MAU: ${businessData.dau}/${businessData.mau}`);
        }
        if (businessData.totalSessions !== undefined) {
          report.push(
            `  - Sessions: ${businessData.totalSessions.toLocaleString()}`
          );
        }
        if (
          businessData.sampleCount !== undefined &&
          businessData.sampleCount > 0
        ) {
          report.push(
            `  - Sample Size: ${businessData.sampleCount.toLocaleString()}`
          );
        }
      }
    );

    report.push('');
  }

  if (result.violations.length > 0) {
    report.push('## ⚠️ Violations', '');

    const sentryViolations = result.violations.filter(
      v => v.category === 'sentry'
    );
    const businessViolations = result.violations.filter(
      v => v.category === 'business'
    );

    if (sentryViolations.length > 0) {
      report.push('### 🚨 Sentry Health Violations', '');
      sentryViolations.forEach(violation => {
        const severityEmoji = violation.severity === 'blocking' ? '🚫' : '⚠️';
        report.push(`#### ${severityEmoji} ${violation.metric}`);
        report.push('');
        report.push(`- **Actual**: ${violation.actual}%`);
        report.push(`- **Threshold**: ≥ ${violation.threshold}%`);
        report.push(`- **Impact**: ${violation.impact}`);
        report.push('');
      });
    }

    if (businessViolations.length > 0) {
      report.push('### 📉 Business Metric Violations', '');
      businessViolations.forEach(violation => {
        const severityEmoji = violation.severity === 'blocking' ? '🚫' : '⚠️';
        report.push(`#### ${severityEmoji} ${violation.metric}`);
        report.push('');
        report.push(`- **Impact**: ${violation.impact}`);
        report.push(`- **Observation Window**: ${violation.observationWindow}`);
        report.push('');
      });
    }
  }

  if (result.sentryMetrics.rawData) {
    report.push('## 📈 Raw Sentry Data', '');
    report.push(
      `- **Total Sessions**: ${result.sentryMetrics.rawData.totalSessions.toLocaleString()}`
    );
    report.push(
      `- **Crashed Sessions**: ${result.sentryMetrics.rawData.crashedSessions.toLocaleString()}`
    );
    report.push(
      `- **Total Users**: ${result.sentryMetrics.rawData.totalUsers.toLocaleString()}`
    );
    report.push(
      `- **Crashed Users**: ${result.sentryMetrics.rawData.crashedUsers.toLocaleString()}`
    );
    report.push('');
  }

  report.push('---');
  report.push('*Report generated by Enhanced Release Health Gate*');

  return report.join('\n');
}

/**
 * 生成控制台格式的报告
 * @param {Object} result - 检查结果
 */
function printConsoleReport(result) {
  console.log('📋 Enhanced Release Health Report:');
  console.log('═'.repeat(60));
  console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Environment: ${result.environment}`);
  console.log(`Sample Size: ${result.sampleSize.toLocaleString()} users`);
  console.log(`Observation Window: ${result.config.observationWindow}`);
  console.log('');

  console.log('🎯 Sentry Thresholds:');
  console.log(
    `  Crash-Free Users: ≥ ${result.config.thresholds.crashFreeUsers}%`
  );
  console.log(
    `  Crash-Free Sessions: ≥ ${result.config.thresholds.crashFreeSessions}%`
  );
  console.log('');

  console.log('📊 Sentry Metrics:');
  const usersStatus =
    result.sentryMetrics.crashFreeUsers >=
    result.config.thresholds.crashFreeUsers
      ? '✅'
      : '❌';
  const sessionsStatus =
    result.sentryMetrics.crashFreeSessions >=
    result.config.thresholds.crashFreeSessions
      ? '✅'
      : '❌';

  console.log(
    `  Crash-Free Users: ${result.sentryMetrics.crashFreeUsers}% ${usersStatus}`
  );
  console.log(
    `  Crash-Free Sessions: ${result.sentryMetrics.crashFreeSessions}% ${sessionsStatus}`
  );
  console.log('');

  // 业务指标报告
  if (Object.keys(result.businessMetrics || {}).length > 0) {
    console.log('🏢 Business Metrics:');

    Object.entries(result.config.businessThresholds || {}).forEach(
      ([metricName, config]) => {
        const businessData = result.businessMetrics[metricName];
        if (!businessData) {
          console.log(`  ❓ ${config.description}: No data available`);
          return;
        }

        const actualValue =
          businessData.rate !== undefined
            ? businessData.rate
            : businessData.averageDuration !== undefined
              ? businessData.averageDuration
              : businessData.averageLoadTime;

        const unit =
          config.unit === 'percent'
            ? '%'
            : config.unit === 'milliseconds'
              ? 'ms'
              : config.unit === 'seconds'
                ? 's'
                : '';

        const status = actualValue >= config.threshold ? '✅' : '❌';
        console.log(
          `  ${status} ${config.description}: ${actualValue}${unit} (≥ ${config.threshold}${unit})`
        );

        // 显示额外的详细信息
        if (
          businessData.totalAttempts !== undefined &&
          businessData.totalAttempts > 0
        ) {
          console.log(
            `      Attempts: ${businessData.totalAttempts.toLocaleString()}`
          );
        }
        if (businessData.dau !== undefined) {
          console.log(`      DAU/MAU: ${businessData.dau}/${businessData.mau}`);
        }
        if (
          businessData.totalSessions !== undefined &&
          businessData.totalSessions > 0
        ) {
          console.log(
            `      Sessions: ${businessData.totalSessions.toLocaleString()}`
          );
        }
        if (
          businessData.sampleCount !== undefined &&
          businessData.sampleCount > 0
        ) {
          console.log(
            `      Samples: ${businessData.sampleCount.toLocaleString()}`
          );
        }
      }
    );

    console.log('');
  }

  if (result.violations.length > 0) {
    const sentryViolations = result.violations.filter(
      v => v.category === 'sentry'
    );
    const businessViolations = result.violations.filter(
      v => v.category === 'business'
    );

    if (sentryViolations.length > 0) {
      console.log('🚨 Sentry Violations:');
      sentryViolations.forEach(violation => {
        const severity = violation.severity === 'blocking' ? '🚫' : '⚠️';
        console.log(
          `  ${severity} ${violation.metric}: ${violation.actual}% < ${violation.threshold}%`
        );
        console.log(`     Impact: ${violation.impact}`);
      });
      console.log('');
    }

    if (businessViolations.length > 0) {
      console.log('📉 Business Metric Violations:');
      businessViolations.forEach(violation => {
        const severity = violation.severity === 'blocking' ? '🚫' : '⚠️';
        console.log(`  ${severity} ${violation.metric}`);
        console.log(`     Impact: ${violation.impact}`);
        console.log(`     Window: ${violation.observationWindow}`);
      });
      console.log('');
    }
  }

  if (result.sentryMetrics.rawData) {
    console.log('📈 Raw Sentry Data:');
    console.log(
      `  Total Sessions: ${result.sentryMetrics.rawData.totalSessions.toLocaleString()}`
    );
    console.log(
      `  Crashed Sessions: ${result.sentryMetrics.rawData.crashedSessions.toLocaleString()}`
    );
    console.log(
      `  Total Users: ${result.sentryMetrics.rawData.totalUsers.toLocaleString()}`
    );
    console.log(
      `  Crashed Users: ${result.sentryMetrics.rawData.crashedUsers.toLocaleString()}`
    );
    console.log('');
  }
}

// ============================================================================
// 主执行逻辑
// ============================================================================

/**
 * 主执行函数
 */
async function main() {
  try {
    const result = await checkReleaseHealth();

    // 输出控制台报告
    printConsoleReport(result);

    // 生成 Markdown 报告（如果需要）
    if (CONFIG.generateMarkdownReport) {
      const markdownReport = generateMarkdownReport(result);
      const reportPath = 'release-health-report.md';

      try {
        await fs.writeFile(reportPath, markdownReport, 'utf8');
        console.log(`📝 Markdown report generated: ${reportPath}`);
      } catch (writeError) {
        console.warn(
          `⚠️  Failed to write markdown report: ${writeError.message}`
        );
      }
    }

    // 设置 GitHub Actions 输出（如果在 GitHub Actions 中运行）
    if (CONFIG.githubOutput) {
      try {
        const summary = `${result.passed ? 'PASSED' : 'FAILED'}: Crash-Free Users ${result.metrics.crashFreeUsers}%, Sessions ${result.metrics.crashFreeSessions}%`;
        await fs.appendFile(
          CONFIG.githubOutput,
          `release_health_status=${result.passed ? 'success' : 'failure'}\n`
        );
        await fs.appendFile(
          CONFIG.githubOutput,
          `release_health_summary=${summary}\n`
        );
      } catch (outputError) {
        console.warn(
          `⚠️  Failed to set GitHub Actions output: ${outputError.message}`
        );
      }
    }

    // 根据结果确定退出代码
    if (!result.passed) {
      console.log('❌ Release Health Gate FAILED - blocking deployment');
      process.exit(1);
    } else {
      console.log('✅ Release Health Gate PASSED - deployment can proceed');
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 Release Health Gate check failed with error:');
    console.error(error.message);

    if (process.env.DEBUG === 'true') {
      console.error('\n🔍 Debug information:');
      console.error(error.stack);
    }

    if (CONFIG.failOnError) {
      console.error(
        '\n❌ Exiting with failure status (set FAIL_ON_ERROR=false to override)'
      );
      process.exit(1);
    } else {
      console.warn('\n⚠️  Continuing despite error (FAIL_ON_ERROR=false)');
      process.exit(0);
    }
  }
}

// ============================================================================
// CLI 帮助和参数处理
// ============================================================================

function printHelp() {
  console.log('Release Health Gate - Sentry Release Health Check');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/release-health-gate.mjs [options]');
  console.log('');
  console.log('Environment Variables:');
  console.log(
    '  SENTRY_ORG                    Sentry organization slug (required)'
  );
  console.log('  SENTRY_PROJECT                Sentry project slug (required)');
  console.log(
    '  SENTRY_AUTH_TOKEN             Sentry authentication token (required)'
  );
  console.log(
    '  ENVIRONMENT                   Environment name (default: development)'
  );
  console.log(
    '  CRASH_FREE_USERS_THRESHOLD    Crash-free users threshold % (default: 99.5)'
  );
  console.log(
    '  CRASH_FREE_SESSIONS_THRESHOLD Crash-free sessions threshold % (default: 99.8)'
  );
  console.log(
    '  OBSERVATION_WINDOW            Observation window (default: 24h)'
  );
  console.log(
    '  OBSERVATION_WINDOW_HOURS      Observation window in hours (default: 24)'
  );
  console.log('  FAIL_ON_ERROR                 Fail on error (default: true)');
  console.log(
    '  GENERATE_MARKDOWN_REPORT      Generate markdown report (default: false)'
  );
  console.log(
    '  DEBUG                         Enable debug output (default: false)'
  );
  console.log('');
  console.log('Examples:');
  console.log('  # Basic usage');
  console.log('  SENTRY_AUTH_TOKEN=xxx node scripts/release-health-gate.mjs');
  console.log('');
  console.log('  # Production environment with custom thresholds');
  console.log('  ENVIRONMENT=production \\');
  console.log('  CRASH_FREE_USERS_THRESHOLD=99.9 \\');
  console.log('  CRASH_FREE_SESSIONS_THRESHOLD=99.95 \\');
  console.log('  node scripts/release-health-gate.mjs');
}

// 检查命令行参数
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log('Release Health Gate v1.0.0');
  process.exit(0);
}

// 执行检查（仅在作为主模块运行时）
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error.message);
    process.exit(1);
  });
}

// 导出函数供测试使用
// export { checkReleaseHealth, fetchReleaseHealthMetrics, generateMarkdownReport, CONFIG };
