#!/usr/bin/env node

/**
 * 代码覆盖率门禁脚本
 * 确保代码覆盖率达到设定的阈值
 */

const fs = require('fs');
const path = require('path');
const {
  getCoverageConfig,
  shouldSkipCoverageGate,
} = require('./coverage-config.cjs');

// 动态获取配置阈值
const COVERAGE_THRESHOLDS = getCoverageConfig();

// 覆盖率报告文件路径
const COVERAGE_REPORT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'coverage',
  'coverage-summary.json'
);

/**
 * 检查覆盖率是否达到阈值
 */
function checkCoverageThresholds() {
  console.log('📊 检查代码覆盖率门禁...');

  // 检查是否应该跳过覆盖率门禁
  const skipReasons = shouldSkipCoverageGate();
  if (skipReasons.length > 0) {
    console.log('\n⚠️  跳过覆盖率门禁检查:');
    skipReasons.forEach(reason => console.log(`  - ${reason}`));
    console.log('✅ 覆盖率门禁检查已跳过');
    return;
  }

  if (!fs.existsSync(COVERAGE_REPORT_PATH)) {
    console.error('❌ 覆盖率报告文件不存在，请先运行测试生成覆盖率报告');
    console.log('💡 运行: npm run test:coverage');
    process.exit(1);
  }

  const coverageReport = JSON.parse(
    fs.readFileSync(COVERAGE_REPORT_PATH, 'utf8')
  );
  const totalCoverage = coverageReport.total;

  console.log('\n📈 当前覆盖率统计:');
  console.log(`  语句覆盖率: ${totalCoverage.statements.pct}%`);
  console.log(`  分支覆盖率: ${totalCoverage.branches.pct}%`);
  console.log(`  函数覆盖率: ${totalCoverage.functions.pct}%`);
  console.log(`  行覆盖率: ${totalCoverage.lines.pct}%`);

  const failedChecks = [];

  // 检查各项覆盖率指标
  if (totalCoverage.statements.pct < COVERAGE_THRESHOLDS.statements) {
    failedChecks.push(
      `语句覆盖率 ${totalCoverage.statements.pct}% < ${COVERAGE_THRESHOLDS.statements}%`
    );
  }

  if (totalCoverage.branches.pct < COVERAGE_THRESHOLDS.branches) {
    failedChecks.push(
      `分支覆盖率 ${totalCoverage.branches.pct}% < ${COVERAGE_THRESHOLDS.branches}%`
    );
  }

  if (totalCoverage.functions.pct < COVERAGE_THRESHOLDS.functions) {
    failedChecks.push(
      `函数覆盖率 ${totalCoverage.functions.pct}% < ${COVERAGE_THRESHOLDS.functions}%`
    );
  }

  if (totalCoverage.lines.pct < COVERAGE_THRESHOLDS.lines) {
    failedChecks.push(
      `行覆盖率 ${totalCoverage.lines.pct}% < ${COVERAGE_THRESHOLDS.lines}%`
    );
  }

  if (failedChecks.length > 0) {
    console.log('\n❌ 覆盖率门禁检查失败:');
    failedChecks.forEach(check => console.log(`  - ${check}`));
    console.log('\n💡 建议:');
    console.log('  1. 添加单元测试提高覆盖率');
    console.log('  2. 检查未测试的代码分支');
    console.log('  3. 确保所有公共函数都有对应测试');
    console.log('  4. 运行 npm run test:coverage:open 查看详细覆盖率报告');

    // 在开发环境中显示详细的未覆盖文件列表
    if (process.env.NODE_ENV !== 'production') {
      showUncoveredFiles(coverageReport);
    }

    process.exit(1);
  }

  console.log('\n✅ 覆盖率门禁检查通过！');
  console.log('🎉 所有覆盖率指标均达到设定阈值');
}

/**
 * 显示未覆盖的文件列表
 */
function showUncoveredFiles(coverageReport) {
  console.log('\n📋 需要关注的文件:');

  const lowCoverageFiles = [];

  Object.keys(coverageReport).forEach(filePath => {
    if (filePath === 'total') return;

    const fileCoverage = coverageReport[filePath];
    const avgCoverage =
      (fileCoverage.statements.pct +
        fileCoverage.branches.pct +
        fileCoverage.functions.pct +
        fileCoverage.lines.pct) /
      4;

    if (avgCoverage < 80) {
      // 低于80%的文件需要关注
      lowCoverageFiles.push({
        file: filePath,
        coverage: Math.round(avgCoverage),
        statements: fileCoverage.statements.pct,
        branches: fileCoverage.branches.pct,
        functions: fileCoverage.functions.pct,
        lines: fileCoverage.lines.pct,
      });
    }
  });

  if (lowCoverageFiles.length > 0) {
    lowCoverageFiles
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 10) // 只显示前10个最需要关注的文件
      .forEach(fileInfo => {
        console.log(`  📄 ${fileInfo.file} (${fileInfo.coverage}%)`);
        console.log(
          `     语句: ${fileInfo.statements}% | 分支: ${fileInfo.branches}% | 函数: ${fileInfo.functions}% | 行: ${fileInfo.lines}%`
        );
      });
  }
}

/**
 * 生成覆盖率趋势报告
 */
function generateCoverageTrend() {
  const trendsDir = path.join(__dirname, '..', '..', 'logs', 'coverage-trends');
  if (!fs.existsSync(trendsDir)) {
    fs.mkdirSync(trendsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const trendFile = path.join(trendsDir, `coverage-${timestamp}.json`);

  if (fs.existsSync(COVERAGE_REPORT_PATH)) {
    const coverageReport = JSON.parse(
      fs.readFileSync(COVERAGE_REPORT_PATH, 'utf8')
    );
    const trendData = {
      timestamp: new Date().toISOString(),
      coverage: coverageReport.total,
      commit: process.env.GITHUB_SHA || 'local',
      branch: process.env.GITHUB_REF_NAME || 'local',
    };

    fs.writeFileSync(trendFile, JSON.stringify(trendData, null, 2));
    console.log(`📊 覆盖率趋势已记录: ${trendFile}`);
  }
}

// 主执行逻辑
if (require.main === module) {
  try {
    checkCoverageThresholds();
    generateCoverageTrend();
  } catch (error) {
    console.error('❌ 覆盖率门禁脚本执行失败:', error.message);
    process.exit(1);
  }
}

module.exports = {
  checkCoverageThresholds,
  generateCoverageTrend,
  COVERAGE_THRESHOLDS,
};
