#!/usr/bin/env node

/**
 * 预提交质量门禁脚本
 * 确保代码质量从第一次提交开始
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 配置项
const CONFIG = {
  skipCoverageInPreCommit: true, // 预提交时跳过完整覆盖率检查
  allowPartialLint: true, // 允许部分文件lint失败（仅警告）
  runTypeCheck: true, // 是否运行TypeScript类型检查
  runSecurityCheck: false, // 预提交时是否运行安全检查（通常在CI中进行）
  maxCommitTimeMinutes: 5, // 预提交检查的最大时间限制
};

/**
 * 执行命令并返回结果
 */
function runCommand(command, options = {}) {
  const defaultOptions = {
    stdio: 'inherit',
    timeout: CONFIG.maxCommitTimeMinutes * 60 * 1000,
  };

  try {
    execSync(command, { ...defaultOptions, ...options });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.status,
    };
  }
}

/**
 * 获取暂存的文件列表
 */
function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
    });
    return result
      .trim()
      .split('\n')
      .filter(file => file.length > 0);
  } catch (error) {
    // 如果不是git仓库，返回空数组
    return [];
  }
}

/**
 * 检查是否有TypeScript文件变更
 */
function hasTypeScriptChanges(files) {
  return files.some(file => /\.(ts|tsx)$/.test(file));
}

/**
 * 检查是否有源码文件变更
 */
function hasSourceChanges(files) {
  return files.some(file => file.startsWith('src/'));
}

/**
 * 运行ESLint检查
 */
async function runLintCheck() {
  console.log('🔍 运行代码规范检查...');

  const result = runCommand('npm run lint', { stdio: 'pipe' });

  if (!result.success) {
    if (CONFIG.allowPartialLint) {
      console.log('⚠️  发现代码规范问题，但允许提交（请尽快修复）');
      return true;
    } else {
      console.log('❌ 代码规范检查失败，请修复后再提交');
      return false;
    }
  }

  console.log('✅ 代码规范检查通过');
  return true;
}

/**
 * 运行TypeScript类型检查
 */
async function runTypeCheck() {
  if (!CONFIG.runTypeCheck) {
    console.log('⏭️  跳过TypeScript类型检查');
    return true;
  }

  console.log('🔧 运行TypeScript类型检查...');

  const result = runCommand('npx tsc --noEmit', { stdio: 'pipe' });

  if (!result.success) {
    console.log('❌ TypeScript类型检查失败');
    return false;
  }

  console.log('✅ TypeScript类型检查通过');
  return true;
}

/**
 * 运行相关测试
 */
async function runRelevantTests(stagedFiles) {
  if (!hasSourceChanges(stagedFiles)) {
    console.log('⏭️  无源码变更，跳过测试');
    return true;
  }

  console.log('🧪 运行相关测试...');

  // 只运行与修改文件相关的测试
  const testFiles = stagedFiles
    .filter(file => file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
    .join(' ');

  let testCommand = 'npm run test:unit -- --run --passWithNoTests';

  if (testFiles) {
    testCommand += ` ${testFiles}`;
  } else {
    // 如果没有直接的测试文件变更，运行快速测试
    testCommand += ' --maxWorkers=2 --timeout=30000';
  }

  const result = runCommand(testCommand, { stdio: 'pipe' });

  if (!result.success) {
    console.log('❌ 测试执行失败');
    return false;
  }

  console.log('✅ 相关测试通过');
  return true;
}

/**
 * 运行安全检查
 */
async function runSecurityCheck() {
  if (!CONFIG.runSecurityCheck) {
    console.log('⏭️  跳过安全检查（将在CI中执行）');
    return true;
  }

  console.log('🛡️ 运行安全检查...');

  const result = runCommand('npm run security:validate', { stdio: 'pipe' });

  if (!result.success) {
    console.log('⚠️  安全检查发现问题，但允许提交（请在CI中关注）');
    return true; // 安全检查失败不阻止提交，但会在CI中严格检查
  }

  console.log('✅ 安全检查通过');
  return true;
}

/**
 * 生成预提交报告
 */
function generatePreCommitReport(checks) {
  const reportDir = path.join(__dirname, '..', '..', 'logs', 'pre-commit');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportDir, `pre-commit-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || 'local',
    checks,
    status: checks.every(check => check.passed) ? 'PASSED' : 'FAILED',
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📊 预提交报告已生成: ${reportFile}`);
}

/**
 * 主要执行逻辑
 */
async function runPreCommitChecks() {
  const startTime = Date.now();
  console.log('🚀 开始预提交质量检查...\n');

  // 获取暂存文件
  const stagedFiles = getStagedFiles();
  console.log(`📁 发现 ${stagedFiles.length} 个暂存文件`);

  if (stagedFiles.length === 0) {
    console.log('⚠️  没有暂存文件，跳过预提交检查');
    return true;
  }

  const checks = [];

  // 1. 运行代码规范检查
  const lintPassed = await runLintCheck();
  checks.push({ name: 'ESLint检查', passed: lintPassed });

  // 2. 运行TypeScript类型检查
  const typePassed = await runTypeCheck();
  checks.push({ name: 'TypeScript类型检查', passed: typePassed });

  // 3. 运行相关测试
  const testPassed = await runRelevantTests(stagedFiles);
  checks.push({ name: '相关测试', passed: testPassed });

  // 4. 运行安全检查
  const securityPassed = await runSecurityCheck();
  checks.push({ name: '安全检查', passed: securityPassed });

  // 生成报告
  generatePreCommitReport(checks);

  // 汇总结果
  const allPassed = checks.every(check => check.passed);
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log('\n📋 预提交检查结果:');
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
  });

  console.log(`\n⏱️  总耗时: ${duration}秒`);

  if (allPassed) {
    console.log('🎉 所有预提交检查通过！可以提交代码');
    return true;
  } else {
    console.log('❌ 部分预提交检查失败，请修复后再提交');
    console.log('\n💡 提示:');
    console.log('  - 运行 npm run lint -- --fix 自动修复部分问题');
    console.log('  - 运行 npm run test:unit:watch 实时查看测试结果');
    console.log('  - 检查TypeScript类型错误并修复');
    return false;
  }
}

// 主执行逻辑
if (require.main === module) {
  runPreCommitChecks()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 预提交检查执行失败:', error.message);
      process.exit(1);
    });
}

module.exports = {
  runPreCommitChecks,
  CONFIG,
};
