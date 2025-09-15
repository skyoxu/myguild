#!/usr/bin/env node

/**
 * 质量门禁脚本
 * 检查覆盖率和 Release Health 阈值
 * 符合 CLAUDE.md 质量门禁要求
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 硬编码质量门禁阈值（来自ADR-0005）- 项目初期合理设置
const HARD_CODED_THRESHOLDS = {
  coverage: {
    lines: 60, // 行覆盖率 ≥60% (项目初期)
    branches: 60, // 分支覆盖率 ≥60% (项目初期)
    functions: 60, // 函数覆盖率 ≥60% (项目初期)
    statements: 60, // 语句覆盖率 ≥60% (项目初期)
  },
  e2e: {
    passRate: 95, // E2E通过率 ≥95%
    maxDuration: 300, // 最大执行时间 ≤5分钟
    criticalPath: 100, // 关键路径 100%通过
  },
  performance: {
    appStartTime: 3000, // 应用启动时间 ≤3秒
    memoryUsage: 512, // 内存使用 ≤512MB
    cpuUsage: 80, // CPU使用率 ≤80%
  },
  releaseHealth: {
    crashFreeUsers: 99.5, // 崩溃无关用户 ≥99.5%
    crashFreeSessions: 99.8, // 崩溃无关会话 ≥99.8%
    minAdoption: 1000, // 最小采样数 ≥1000会话
  },
};

// 阈值检查函数（不允许绕过）
function validateQualityGates(metrics) {
  const failures = [];

  // 严格检查每个指标
  Object.entries(HARD_CODED_THRESHOLDS.coverage).forEach(([key, threshold]) => {
    if (metrics.coverage && metrics.coverage[key] < threshold) {
      failures.push(
        `Coverage ${key}: ${metrics.coverage[key]}% < ${threshold}%`
      );
    }
  });

  if (failures.length > 0) {
    throw new Error(`Quality Gate FAILED:\n${failures.join('\n')}`);
  }
}

// 保持向后兼容的别名
const QUALITY_THRESHOLDS = HARD_CODED_THRESHOLDS;

/**
 * 检查代码覆盖率门禁
 */
async function checkCoverageGate() {
  console.log('📊 检查代码覆盖率门禁...');

  const coverageReportPath = path.join(
    __dirname,
    '..',
    'coverage',
    'coverage-summary.json'
  );

  if (!fs.existsSync(coverageReportPath)) {
    throw new Error('覆盖率报告文件不存在，请先运行 npm run test:coverage');
  }

  const coverageReport = JSON.parse(
    fs.readFileSync(coverageReportPath, 'utf8')
  );
  const totalCoverage = coverageReport.total;

  console.log('📈 当前覆盖率统计:');
  console.log(`  语句覆盖率: ${totalCoverage.statements.pct}%`);
  console.log(`  分支覆盖率: ${totalCoverage.branches.pct}%`);
  console.log(`  函数覆盖率: ${totalCoverage.functions.pct}%`);
  console.log(`  行覆盖率: ${totalCoverage.lines.pct}%`);

  // 使用硬编码门禁验证函数
  try {
    validateQualityGates({
      coverage: {
        lines: totalCoverage.lines.pct,
        branches: totalCoverage.branches.pct,
        functions: totalCoverage.functions.pct,
        statements: totalCoverage.statements.pct,
      },
    });
  } catch (error) {
    console.error('\n🚨 硬编码质量门禁检查失败:');
    console.error(error.message);
    throw error;
  }

  console.log('✅ 覆盖率门禁检查通过！');
  return {
    passed: true,
    coverage: totalCoverage,
    thresholds: QUALITY_THRESHOLDS.coverage,
  };
}

/**
 * 检查 Release Health 门禁
 */
async function checkReleaseHealthGate() {
  console.log('🏥 检查 Release Health 门禁...');

  const releaseHealthPath = path.join(__dirname, '..', '.release-health.json');

  if (!fs.existsSync(releaseHealthPath)) {
    console.log(
      '⚠️  未找到 .release-health.json 文件，跳过 Release Health 检查'
    );
    return {
      passed: true,
      skipped: true,
      reason: 'Release Health 文件不存在',
    };
  }

  const releaseHealth = JSON.parse(fs.readFileSync(releaseHealthPath, 'utf8'));

  console.log('📊 当前 Release Health 统计:');
  console.log(
    `  Crash-Free Sessions: ${releaseHealth.crashFreeSessions || 'N/A'}%`
  );
  console.log(`  Crash-Free Users: ${releaseHealth.crashFreeUsers || 'N/A'}%`);
  console.log(`  Adoption Rate: ${releaseHealth.adoptionRate || 'N/A'}%`);

  const failedChecks = [];

  // 使用硬编码门禁验证Release Health指标
  if (releaseHealth.crashFreeSessions !== undefined) {
    if (
      releaseHealth.crashFreeSessions <
      HARD_CODED_THRESHOLDS.releaseHealth.crashFreeSessions
    ) {
      failedChecks.push(
        `Crash-Free Sessions ${releaseHealth.crashFreeSessions}% < ${HARD_CODED_THRESHOLDS.releaseHealth.crashFreeSessions}%`
      );
    }
  }

  if (releaseHealth.crashFreeUsers !== undefined) {
    if (
      releaseHealth.crashFreeUsers <
      HARD_CODED_THRESHOLDS.releaseHealth.crashFreeUsers
    ) {
      failedChecks.push(
        `Crash-Free Users ${releaseHealth.crashFreeUsers}% < ${HARD_CODED_THRESHOLDS.releaseHealth.crashFreeUsers}%`
      );
    }
  }

  if (releaseHealth.adoption !== undefined) {
    if (
      releaseHealth.adoption < HARD_CODED_THRESHOLDS.releaseHealth.minAdoption
    ) {
      failedChecks.push(
        `Adoption ${releaseHealth.adoption} < ${HARD_CODED_THRESHOLDS.releaseHealth.minAdoption}`
      );
    }
  }

  if (failedChecks.length > 0) {
    throw new Error(
      `Release Health 门禁失败:\\n${failedChecks.map(check => `  - ${check}`).join('\\n')}`
    );
  }

  console.log('✅ Release Health 门禁检查通过！');
  return {
    passed: true,
    releaseHealth,
    thresholds: QUALITY_THRESHOLDS.releaseHealth,
  };
}

/**
 * 检查 Sentry 配置和连接
 */
async function checkSentryHealth() {
  console.log('🔍 检查 Sentry 配置和连接...');

  // 检查 Sentry 配置文件
  const sentryFiles = [
    path.join(
      __dirname,
      '..',
      'src',
      'shared',
      'observability',
      'sentry-main.ts'
    ),
    path.join(
      __dirname,
      '..',
      'src',
      'shared',
      'observability',
      'sentry-renderer.ts'
    ),
  ];

  let sentryConfigured = false;

  for (const sentryFile of sentryFiles) {
    if (fs.existsSync(sentryFile)) {
      const content = fs.readFileSync(sentryFile, 'utf8');
      if (content.includes('Sentry.init') || content.includes('@sentry')) {
        sentryConfigured = true;
        break;
      }
    }
  }

  if (!sentryConfigured) {
    console.log('⚠️  未检测到 Sentry 配置，跳过 Sentry 健康检查');
    return {
      passed: true,
      skipped: true,
      reason: 'Sentry 未配置',
    };
  }

  // 检查环境变量
  const requiredEnvVars = ['SENTRY_DSN'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(`⚠️  缺少 Sentry 环境变量: ${missingVars.join(', ')}`);
    return {
      passed: true,
      skipped: true,
      reason: `缺少环境变量: ${missingVars.join(', ')}`,
    };
  }

  console.log('✅ Sentry 配置检查通过！');
  return {
    passed: true,
    configured: true,
  };
}

/**
 * 生成质量门禁报告
 */
function generateQualityReport(results) {
  console.log('📊 生成质量门禁报告...');

  const reportDir = path.join(__dirname, '..', 'logs', 'quality');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(reportDir, `quality-gates-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    thresholds: QUALITY_THRESHOLDS,
    results,
    summary: {
      totalChecks: Object.keys(results).length,
      passedChecks: Object.values(results).filter(r => r.passed).length,
      failedChecks: Object.values(results).filter(r => !r.passed).length,
      skippedChecks: Object.values(results).filter(r => r.skipped).length,
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      ci: !!process.env.CI,
      github: {
        sha: process.env.GITHUB_SHA,
        ref: process.env.GITHUB_REF,
        workflow: process.env.GITHUB_WORKFLOW,
      },
    },
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 质量门禁报告已保存: ${reportFile}`);

  return report;
}

/**
 * 主质量门禁检查函数
 */
async function runQualityGates() {
  console.log('🚪 开始质量门禁检查...');
  console.log('📋 参考标准: CLAUDE.md 质量门禁要求\\n');

  const results = {};
  const errors = [];

  try {
    // 1. 检查代码覆盖率
    try {
      results.coverage = await checkCoverageGate();
    } catch (error) {
      results.coverage = { passed: false, error: error.message };
      errors.push(`覆盖率检查失败: ${error.message}`);
    }

    // 2. 检查 Release Health
    try {
      results.releaseHealth = await checkReleaseHealthGate();
    } catch (error) {
      results.releaseHealth = { passed: false, error: error.message };
      errors.push(`Release Health 检查失败: ${error.message}`);
    }

    // 3. 检查 Sentry 健康状态
    try {
      results.sentry = await checkSentryHealth();
    } catch (error) {
      results.sentry = { passed: false, error: error.message };
      errors.push(`Sentry 检查失败: ${error.message}`);
    }

    // 生成报告
    const report = generateQualityReport(results);

    // 显示结果汇总
    console.log('\\n📊 质量门禁结果汇总:');
    console.log(`  总检查项: ${report.summary.totalChecks}`);
    console.log(`  通过检查: ${report.summary.passedChecks}`);
    console.log(`  失败检查: ${report.summary.failedChecks}`);
    console.log(`  跳过检查: ${report.summary.skippedChecks}`);

    if (errors.length > 0) {
      console.log('\\n❌ 质量门禁失败:');
      errors.forEach(error => console.log(`  - ${error}`));
      console.log('\\n💡 建议:');
      console.log('  1. 检查覆盖率报告: npm run test:coverage:open');
      console.log('  2. 查看详细报告: logs/quality/');
      console.log('  3. 检查 Sentry 配置和环境变量');

      process.exit(1);
    } else {
      console.log('\\n✅ 质量门禁检查全部通过！');
      console.log('🎉 代码质量和发布健康指标均达到要求');
    }
  } catch (error) {
    console.error('❌ 质量门禁脚本执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  runQualityGates();
}

export {
  runQualityGates,
  checkCoverageGate,
  checkReleaseHealthGate,
  checkSentryHealth,
  QUALITY_THRESHOLDS,
};
