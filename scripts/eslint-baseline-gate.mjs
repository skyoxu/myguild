#!/usr/bin/env node
/**
 * ESLint基线门禁脚本
 * 用于在CI/CD中强制执行ESLint质量标准
 * 确保代码质量不会退化
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// 基线质量标准
const BASELINE_THRESHOLDS = {
  // 错误数量阈值（不允许有错误）
  maxErrors: 0,
  // 警告数量阈值
  maxWarnings: process.env.ESLINT_MAX_WARNINGS
    ? parseInt(process.env.ESLINT_MAX_WARNINGS)
    : 50,
  // 最大复杂度阈值
  maxComplexity: 25,
  // 最大函数行数阈值
  maxFunctionLines: 300,
};

/**
 * 运行ESLint检查 - 分目录处理（buildandtest.md方案A1）
 */
async function runESLintCheck() {
  console.log('🔍 运行ESLint基线检查（分目录）...');

  try {
    const results = [];

    // 严格检查业务代码（src目录）
    console.log('📁 检查 src/ 目录（严格：--max-warnings 115）...');
    try {
      const { stdout: srcStdout } = await execAsync(
        'npx eslint "src/**/*.{ts,tsx}" --format json --max-warnings 115'
      );
      const srcResults = JSON.parse(srcStdout);
      results.push(...srcResults);
    } catch (srcError) {
      // 解析失败时的错误输出
      if (srcError.stdout) {
        const srcResults = JSON.parse(srcError.stdout);
        results.push(...srcResults);
      } else {
        throw new Error(`src目录ESLint检查失败: ${srcError.message}`);
      }
    }

    // 测试代码放宽检查（tests目录）
    console.log('📁 检查 tests/ 目录（放宽：--max-warnings 300）...');
    try {
      const { stdout: testsStdout } = await execAsync(
        'npx eslint "tests/**/*.{ts,tsx,js,mjs}" --format json --max-warnings 300'
      );
      const testsResults = JSON.parse(testsStdout);
      results.push(...testsResults);
    } catch (testsError) {
      // 解析失败时的错误输出
      if (testsError.stdout) {
        const testsResults = JSON.parse(testsError.stdout);
        results.push(...testsResults);
      } else {
        throw new Error(`tests目录ESLint检查失败: ${testsError.message}`);
      }
    }

    return results;
  } catch (error) {
    console.error('❌ ESLint分目录检查失败:', error.message);
    throw error;
  }
}

/**
 * 分析ESLint结果
 */
function analyzeResults(results) {
  let totalErrors = 0;
  let totalWarnings = 0;
  const complexityViolations = [];
  const functionLengthViolations = [];

  results.forEach(file => {
    if (file.errorCount > 0 || file.warningCount > 0) {
      totalErrors += file.errorCount;
      totalWarnings += file.warningCount;

      file.messages.forEach(message => {
        // 检查复杂度违规
        if (message.ruleId === 'complexity') {
          complexityViolations.push({
            file: file.filePath,
            line: message.line,
            complexity: extractComplexityValue(message.message),
          });
        }

        // 检查函数长度违规
        if (message.ruleId === 'max-lines-per-function') {
          functionLengthViolations.push({
            file: file.filePath,
            line: message.line,
            length: extractLengthValue(message.message),
          });
        }
      });
    }
  });

  return {
    totalErrors,
    totalWarnings,
    complexityViolations,
    functionLengthViolations,
    totalFiles: results.length,
    filesWithIssues: results.filter(f => f.errorCount > 0 || f.warningCount > 0)
      .length,
  };
}

/**
 * 从错误消息中提取复杂度值
 */
function extractComplexityValue(message) {
  const match = message.match(/complexity of (\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 从错误消息中提取函数长度值
 */
function extractLengthValue(message) {
  const match = message.match(/(\d+) lines/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 检查是否通过基线门禁
 */
function checkBaseline(analysis) {
  console.log('\n📊 ESLint基线门禁检查结果:');
  console.log('==================================');
  console.log(`📁 检查文件数: ${analysis.totalFiles}`);
  console.log(`⚠️  问题文件数: ${analysis.filesWithIssues}`);
  console.log(
    `❌ 错误总数: ${analysis.totalErrors} (阈值: ${BASELINE_THRESHOLDS.maxErrors})`
  );
  console.log(
    `⚠️  警告总数: ${analysis.totalWarnings} (阈值: ${BASELINE_THRESHOLDS.maxWarnings})`
  );

  const violations = [];

  // 检查错误数量
  if (analysis.totalErrors > BASELINE_THRESHOLDS.maxErrors) {
    violations.push(
      `❌ 错误数量超过阈值: ${analysis.totalErrors} > ${BASELINE_THRESHOLDS.maxErrors}`
    );
  }

  // 检查警告数量
  if (analysis.totalWarnings > BASELINE_THRESHOLDS.maxWarnings) {
    violations.push(
      `⚠️  警告数量超过阈值: ${analysis.totalWarnings} > ${BASELINE_THRESHOLDS.maxWarnings}`
    );
  }

  // 检查复杂度违规
  const severeComplexityViolations = analysis.complexityViolations.filter(
    v => v.complexity > BASELINE_THRESHOLDS.maxComplexity
  );
  if (severeComplexityViolations.length > 0) {
    violations.push(
      `🔥 严重复杂度违规 (>${BASELINE_THRESHOLDS.maxComplexity}): ${severeComplexityViolations.length}个`
    );
    severeComplexityViolations.forEach(v => {
      console.log(
        `   📄 ${path.relative(process.cwd(), v.file)}:${v.line} (复杂度: ${v.complexity})`
      );
    });
  }

  // 检查函数长度违规
  const severeFunctionLengthViolations =
    analysis.functionLengthViolations.filter(
      v => v.length > BASELINE_THRESHOLDS.maxFunctionLines
    );
  if (severeFunctionLengthViolations.length > 0) {
    violations.push(
      `📏 严重函数长度违规 (>${BASELINE_THRESHOLDS.maxFunctionLines}行): ${severeFunctionLengthViolations.length}个`
    );
    severeFunctionLengthViolations.forEach(v => {
      console.log(
        `   📄 ${path.relative(process.cwd(), v.file)}:${v.line} (长度: ${v.length}行)`
      );
    });
  }

  console.log('\n🎯 基线门禁结果:');
  console.log('==================================');

  if (violations.length === 0) {
    console.log('✅ 通过ESLint基线门禁检查');
    console.log('💪 代码质量符合项目标准');
    return true;
  } else {
    console.log('🚫 未通过ESLint基线门禁检查');
    console.log('\n违规项目:');
    violations.forEach(violation => {
      console.log(`   ${violation}`);
    });
    console.log('\n💡 修复建议:');
    console.log('   1. 修复所有ESLint错误（错误数必须为0）');
    console.log('   2. 减少警告数量或调整阈值');
    console.log('   3. 重构高复杂度函数');
    console.log('   4. 拆分过长函数');
    console.log(
      `\n环境变量ESLINT_MAX_WARNINGS可调整警告阈值（当前: ${BASELINE_THRESHOLDS.maxWarnings}）`
    );
    return false;
  }
}

/**
 * 生成基线报告
 */
function generateBaselineReport(analysis) {
  const report = {
    timestamp: new Date().toISOString(),
    baseline: BASELINE_THRESHOLDS,
    results: analysis,
    passed:
      analysis.totalErrors <= BASELINE_THRESHOLDS.maxErrors &&
      analysis.totalWarnings <= BASELINE_THRESHOLDS.maxWarnings,
  };

  // 确保logs目录存在
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 写入基线报告
  const reportPath = path.join(
    logsDir,
    `eslint-baseline-${new Date().toISOString().split('T')[0]}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📊 基线报告已生成: ${reportPath}`);
  return reportPath;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 ESLint基线门禁检查开始');
  console.log('==================================');

  try {
    // 运行ESLint检查
    const results = await runESLintCheck();

    // 分析结果
    const analysis = analyzeResults(results);

    // 生成报告
    generateBaselineReport(analysis);

    // 检查基线
    const passed = checkBaseline(analysis);

    // 设置退出码
    if (!passed) {
      console.log('\n🔥 基线门禁失败 - CI/CD应该被阻止');
      process.exit(1);
    }

    console.log('\n🎉 基线门禁通过 - 允许继续CI/CD流程');
    process.exit(0);
  } catch (error) {
    console.error('❌ ESLint基线检查失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runESLintCheck,
  analyzeResults,
  checkBaseline,
  generateBaselineReport,
};
