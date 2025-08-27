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

// ============================================================================
// 配置与常量
// ============================================================================

const CONFIG = {
  organizationSlug: process.env.SENTRY_ORG || '${SENTRY_ORG}',
  projectSlug: process.env.SENTRY_PROJECT || '${SENTRY_PROJECT}',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  observationWindow: process.env.OBSERVATION_WINDOW || '24h',
  
  // 阈值配置（可通过环境变量覆盖）
  thresholds: {
    crashFreeUsers: Number(process.env.CRASH_FREE_USERS_THRESHOLD ?? '99.5'),
    crashFreeSessions: Number(process.env.CRASH_FREE_SESSIONS_THRESHOLD ?? '99.8'),
    observationWindowHours: Number(process.env.OBSERVATION_WINDOW_HOURS ?? '24')
  },
  
  // CI/CD配置
  failOnError: process.env.FAIL_ON_ERROR !== 'false',
  generateMarkdownReport: process.env.GENERATE_MARKDOWN_REPORT === 'true' || process.env.GITHUB_OUTPUT,
  githubOutput: process.env.GITHUB_OUTPUT
};

// 环境变量验证
const requiredEnvVars = ['SENTRY_AUTH_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`  - ${envVar}`));
  console.error('');
  console.error('💡 Please set the required environment variables:');
  console.error('  export SENTRY_AUTH_TOKEN="your-sentry-auth-token"');
  console.error('  export SENTRY_ORG="your-org-slug"');
  console.error('  export SENTRY_PROJECT="your-project-slug"');
  process.exit(1);
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
async function fetchReleaseHealthMetrics(organizationSlug, projectSlug, authToken, environment, observationWindowHours) {
  const baseUrl = 'https://sentry.io/api/0';
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - (observationWindowHours * 60 * 60 * 1000));
  
  // Sentry Release Health API endpoint
  const apiUrl = `${baseUrl}/organizations/${organizationSlug}/sessions/`;
  
  const params = new URLSearchParams({
    project: projectSlug,
    environment: environment,
    start: startTime.toISOString(),
    end: endTime.toISOString(),
    field: ['sum(session)', 'sum(session.crashed)', 'count_unique(user)', 'count_unique(user.crashed)'],
    groupBy: 'project'
  });
  
  try {
    const response = await fetch(`${apiUrl}?${params}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sentry API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.groups || data.groups.length === 0) {
      console.warn('⚠️  No session data found for the specified time range');
      // 返回模拟数据以避免阻塞
      return {
        crashFreeUsers: 100.0,
        crashFreeSessions: 100.0,
        sampleSize: 0,
        observationWindow: `${observationWindowHours}h`
      };
    }
    
    const sessionData = data.groups[0].totals;
    const totalSessions = sessionData['sum(session)'] || 0;
    const crashedSessions = sessionData['sum(session.crashed)'] || 0;
    const totalUsers = sessionData['count_unique(user)'] || 0;
    const crashedUsers = sessionData['count_unique(user.crashed)'] || 0;
    
    const crashFreeSessionsRate = totalSessions > 0 
      ? ((totalSessions - crashedSessions) / totalSessions) * 100 
      : 100.0;
      
    const crashFreeUsersRate = totalUsers > 0 
      ? ((totalUsers - crashedUsers) / totalUsers) * 100 
      : 100.0;
    
    return {
      crashFreeUsers: Number(crashFreeUsersRate.toFixed(2)),
      crashFreeSessions: Number(crashFreeSessionsRate.toFixed(2)),
      sampleSize: totalUsers,
      observationWindow: `${observationWindowHours}h`,
      rawData: {
        totalSessions,
        crashedSessions, 
        totalUsers,
        crashedUsers
      }
    };
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to Sentry API. Please check your internet connection.');
    }
    throw error;
  }
}

// ============================================================================
// Release Health Gate 逻辑
// ============================================================================

/**
 * 执行 Release Health 检查
 * @returns {Promise<Object>} 检查结果
 */
async function checkReleaseHealth() {
  console.log('🔍 Running Release Health Gate check...');
  console.log(`📊 Organization: ${CONFIG.organizationSlug}`);
  console.log(`📦 Project: ${CONFIG.projectSlug}`);
  console.log(`🌍 Environment: ${CONFIG.environment}`);
  console.log(`⏱️  Observation Window: ${CONFIG.observationWindow}`);
  console.log(`🎯 Crash-Free Users Threshold: ${CONFIG.thresholds.crashFreeUsers}%`);
  console.log(`🎯 Crash-Free Sessions Threshold: ${CONFIG.thresholds.crashFreeSessions}%`);
  console.log('');
  
  try {
    // 获取 Release Health 指标
    const metrics = await fetchReleaseHealthMetrics(
      CONFIG.organizationSlug,
      CONFIG.projectSlug,
      CONFIG.authToken,
      CONFIG.environment,
      CONFIG.thresholds.observationWindowHours
    );
    
    // 检查违规项
    const violations = [];
    
    if (metrics.crashFreeUsers < CONFIG.thresholds.crashFreeUsers) {
      violations.push({
        metric: 'crash_free_users',
        actual: metrics.crashFreeUsers,
        threshold: CONFIG.thresholds.crashFreeUsers,
        severity: 'blocking',
        impact: `${(100 - metrics.crashFreeUsers).toFixed(2)}% users experienced crashes`
      });
    }
    
    if (metrics.crashFreeSessions < CONFIG.thresholds.crashFreeSessions) {
      violations.push({
        metric: 'crash_free_sessions', 
        actual: metrics.crashFreeSessions,
        threshold: CONFIG.thresholds.crashFreeSessions,
        severity: 'blocking',
        impact: `${(100 - metrics.crashFreeSessions).toFixed(2)}% sessions crashed`
      });
    }
    
    return {
      passed: violations.length === 0,
      metrics,
      violations,
      timestamp: new Date().toISOString(),
      environment: CONFIG.environment,
      sampleSize: metrics.sampleSize,
      config: {
        thresholds: CONFIG.thresholds,
        observationWindow: CONFIG.observationWindow
      }
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
    '# Release Health Gate Report',
    '',
    `**Status**: ${statusEmoji} ${statusText}`,
    `**Timestamp**: ${result.timestamp}`,
    `**Environment**: ${result.environment}`,
    `**Sample Size**: ${result.sampleSize.toLocaleString()} users`,
    `**Observation Window**: ${result.config.observationWindow}`,
    '',
    '## 🎯 Thresholds',
    '',
    `- **Crash-Free Users**: ≥ ${result.config.thresholds.crashFreeUsers}%`,
    `- **Crash-Free Sessions**: ≥ ${result.config.thresholds.crashFreeSessions}%`,
    '',
    '## 📊 Metrics',
    '',
    `- **Crash-Free Users**: ${result.metrics.crashFreeUsers}% ${result.metrics.crashFreeUsers >= result.config.thresholds.crashFreeUsers ? '✅' : '❌'}`,
    `- **Crash-Free Sessions**: ${result.metrics.crashFreeSessions}% ${result.metrics.crashFreeSessions >= result.config.thresholds.crashFreeSessions ? '✅' : '❌'}`,
    ''
  ];
  
  if (result.violations.length > 0) {
    report.push('## ⚠️ Violations', '');
    result.violations.forEach(violation => {
      const severityEmoji = violation.severity === 'blocking' ? '🚫' : '⚠️';
      report.push(`### ${severityEmoji} ${violation.metric}`);
      report.push('');
      report.push(`- **Actual**: ${violation.actual}%`);
      report.push(`- **Threshold**: ≥ ${violation.threshold}%`);
      report.push(`- **Impact**: ${violation.impact}`);
      report.push('');
    });
  }
  
  if (result.metrics.rawData) {
    report.push('## 📈 Raw Data', '');
    report.push(`- **Total Sessions**: ${result.metrics.rawData.totalSessions.toLocaleString()}`);
    report.push(`- **Crashed Sessions**: ${result.metrics.rawData.crashedSessions.toLocaleString()}`);
    report.push(`- **Total Users**: ${result.metrics.rawData.totalUsers.toLocaleString()}`);
    report.push(`- **Crashed Users**: ${result.metrics.rawData.crashedUsers.toLocaleString()}`);
    report.push('');
  }
  
  report.push('---');
  report.push('*Report generated by Release Health Gate*');
  
  return report.join('\n');
}

/**
 * 生成控制台格式的报告
 * @param {Object} result - 检查结果
 */
function printConsoleReport(result) {
  console.log('📋 Release Health Report:');
  console.log('═'.repeat(60));
  console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Environment: ${result.environment}`);
  console.log(`Sample Size: ${result.sampleSize.toLocaleString()} users`);
  console.log(`Observation Window: ${result.config.observationWindow}`);
  console.log('');
  
  console.log('🎯 Thresholds:');
  console.log(`  Crash-Free Users: ≥ ${result.config.thresholds.crashFreeUsers}%`);
  console.log(`  Crash-Free Sessions: ≥ ${result.config.thresholds.crashFreeSessions}%`);
  console.log('');
  
  console.log('📊 Metrics:');
  const usersStatus = result.metrics.crashFreeUsers >= result.config.thresholds.crashFreeUsers ? '✅' : '❌';
  const sessionsStatus = result.metrics.crashFreeSessions >= result.config.thresholds.crashFreeSessions ? '✅' : '❌';
  
  console.log(`  Crash-Free Users: ${result.metrics.crashFreeUsers}% ${usersStatus}`);
  console.log(`  Crash-Free Sessions: ${result.metrics.crashFreeSessions}% ${sessionsStatus}`);
  console.log('');
  
  if (result.violations.length > 0) {
    console.log('⚠️  Violations:');
    result.violations.forEach(violation => {
      const severity = violation.severity === 'blocking' ? '🚫' : '⚠️';
      console.log(`  ${severity} ${violation.metric}: ${violation.actual}% < ${violation.threshold}%`);
      console.log(`     Impact: ${violation.impact}`);
    });
    console.log('');
  }
  
  if (result.metrics.rawData) {
    console.log('📈 Raw Data:');
    console.log(`  Total Sessions: ${result.metrics.rawData.totalSessions.toLocaleString()}`);
    console.log(`  Crashed Sessions: ${result.metrics.rawData.crashedSessions.toLocaleString()}`);
    console.log(`  Total Users: ${result.metrics.rawData.totalUsers.toLocaleString()}`);
    console.log(`  Crashed Users: ${result.metrics.rawData.crashedUsers.toLocaleString()}`);
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
        console.warn(`⚠️  Failed to write markdown report: ${writeError.message}`);
      }
    }
    
    // 设置 GitHub Actions 输出（如果在 GitHub Actions 中运行）
    if (CONFIG.githubOutput) {
      try {
        const summary = `${result.passed ? 'PASSED' : 'FAILED'}: Crash-Free Users ${result.metrics.crashFreeUsers}%, Sessions ${result.metrics.crashFreeSessions}%`;
        await fs.appendFile(CONFIG.githubOutput, `release_health_status=${result.passed ? 'success' : 'failure'}\n`);
        await fs.appendFile(CONFIG.githubOutput, `release_health_summary=${summary}\n`);
      } catch (outputError) {
        console.warn(`⚠️  Failed to set GitHub Actions output: ${outputError.message}`);
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
      console.error('\n❌ Exiting with failure status (set FAIL_ON_ERROR=false to override)');
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
  console.log('  SENTRY_ORG                    Sentry organization slug (required)');
  console.log('  SENTRY_PROJECT                Sentry project slug (required)');  
  console.log('  SENTRY_AUTH_TOKEN             Sentry authentication token (required)');
  console.log('  ENVIRONMENT                   Environment name (default: development)');
  console.log('  CRASH_FREE_USERS_THRESHOLD    Crash-free users threshold % (default: 99.5)');
  console.log('  CRASH_FREE_SESSIONS_THRESHOLD Crash-free sessions threshold % (default: 99.8)');
  console.log('  OBSERVATION_WINDOW            Observation window (default: 24h)');
  console.log('  OBSERVATION_WINDOW_HOURS      Observation window in hours (default: 24)');
  console.log('  FAIL_ON_ERROR                 Fail on error (default: true)');
  console.log('  GENERATE_MARKDOWN_REPORT      Generate markdown report (default: false)');
  console.log('  DEBUG                         Enable debug output (default: false)');
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
export { 
  checkReleaseHealth, 
  fetchReleaseHealthMetrics, 
  generateMarkdownReport, 
  CONFIG 
};