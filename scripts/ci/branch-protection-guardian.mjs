#!/usr/bin/env node

/**
 * 分支保护守护脚本
 * 检查分支保护规则与工作流核心作业名的一致性
 */

import { execSync } from 'child_process';
import fs from 'fs';

/**
 * 关键工作流及其核心作业名映射 - Windows专注策略
 * 这些是分支保护必须检查的 jobs
 * 采用Windows专注CI策略，与部署环境对齐
 */
const CRITICAL_JOBS = {
  'ci.yml': [
    'workflow-guardian',        // 工作流守护检查 - 必须通过
    'quality-gates',           // 质量门禁 - 必须通过
    'unit-tests-core',         // 核心单测 (Windows) - 必须通过
    'coverage-gate',           // 覆盖率门禁 - 必须通过
    'build-verification-core', // 构建验证核心 - 必须通过
    'release-health-gate',     // 发布健康门禁 - 必须通过
    'electron-security-gate',  // Electron安全检查 - 必须通过
  ],
  'soft-gates.yml': [
    // 软门禁是中性状态，不应该在 branch protection 中
  ],
};

/**
 * 获取当前分支保护规则
 */
async function getBranchProtectionRules() {
  try {
    console.log('🔍 获取当前分支保护规则...');

    // 检查是否安装了 gh CLI
    try {
      execSync('gh --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️ GitHub CLI 未安装，跳过分支保护检查');
      console.log('💡 安装方法: https://cli.github.com/');
      return null;
    }

    // 检查是否已认证
    try {
      execSync('gh auth status', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️ GitHub CLI 未认证，跳过分支保护检查');
      console.log('💡 请运行: gh auth login');
      return null;
    }

    // 获取主分支保护规则
    const result = execSync(
      'gh api repos/:owner/:repo/branches/main/protection',
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );

    const protection = JSON.parse(result);
    return protection;
  } catch (error) {
    if (error.status === 404) {
      console.log('⚠️ 主分支未设置保护规则');
      return null;
    }

    console.log(`⚠️ 获取分支保护规则失败: ${error.message}`);
    return null;
  }
}

/**
 * 提取工作流中的关键作业名
 */
function extractCriticalJobs() {
  const workflowJobs = new Map();

  for (const [workflow, expectedJobs] of Object.entries(CRITICAL_JOBS)) {
    const workflowPath = `.github/workflows/${workflow}`;

    if (!fs.existsSync(workflowPath)) {
      console.log(`⚠️ 工作流文件不存在: ${workflowPath}`);
      continue;
    }

    const content = fs.readFileSync(workflowPath, 'utf8');
    const actualJobs = [];

    // 提取 job 名称
    const lines = content.split('\n');
    for (const line of lines) {
      const jobMatch = line.match(/^  ([a-zA-Z_][a-zA-Z0-9_-]*):/);
      if (jobMatch && !line.includes('#')) {
        actualJobs.push(jobMatch[1]);
      }
    }

    workflowJobs.set(workflow, {
      expected: expectedJobs,
      actual: actualJobs,
      path: workflowPath,
    });
  }

  return workflowJobs;
}

/**
 * 生成分支保护规则建议
 */
function generateProtectionSuggestion(workflowJobs) {
  const requiredChecks = [];

  for (const [workflow, jobs] of workflowJobs.entries()) {
    console.log(`\n📋 工作流: ${workflow}`);
    console.log(`   期望关键jobs: ${jobs.expected.join(', ')}`);
    console.log(`   实际jobs: ${jobs.actual.join(', ')}`);

    // 检查期望的关键 jobs 是否存在
    for (const expectedJob of jobs.expected) {
      if (jobs.actual.includes(expectedJob)) {
        requiredChecks.push(expectedJob);
        console.log(`   ✅ ${expectedJob} - 存在且应纳入保护`);
      } else {
        console.log(`   ❌ ${expectedJob} - 不存在，需要检查工作流定义`);
      }
    }
  }

  return requiredChecks;
}

/**
 * 检查分支保护一致性
 */
function checkProtectionConsistency(protection, requiredChecks) {
  if (!protection) {
    console.log('\n🚨 分支保护建议:');
    console.log('1. 启用分支保护规则');
    console.log('2. 要求状态检查通过');
    console.log('3. 添加以下必需检查:');
    for (const check of requiredChecks) {
      console.log(`   - ${check}`);
    }
    return false;
  }

  const statusChecks = protection.required_status_checks;
  if (!statusChecks) {
    console.log('\n⚠️ 未配置必需状态检查');
    return false;
  }

  const requiredContexts = statusChecks.contexts || [];
  const requiredChecksSet = statusChecks.checks || [];

  console.log('\n🔍 当前必需检查:');
  console.log(`   Contexts: ${requiredContexts.join(', ') || '无'}`);
  console.log(
    `   Checks: ${requiredChecksSet.map(c => c.context).join(', ') || '无'}`
  );

  // 检查所有必需的 jobs 是否都在保护规则中
  const allProtectedChecks = [
    ...requiredContexts,
    ...requiredChecksSet.map(c => c.context),
  ];

  const missingChecks = requiredChecks.filter(
    check => !allProtectedChecks.includes(check)
  );

  const extraChecks = allProtectedChecks.filter(
    check => !requiredChecks.includes(check) && !check.startsWith('Soft Gates') // 允许软门禁检查存在但不要求
  );

  let hasIssues = false;

  if (missingChecks.length > 0) {
    console.log('\n❌ 缺失的必需检查:');
    for (const check of missingChecks) {
      console.log(`   - ${check}`);
    }
    hasIssues = true;
  }

  if (extraChecks.length > 0) {
    console.log('\n⚠️ 多余的检查（可能已废弃）:');
    for (const check of extraChecks) {
      console.log(`   - ${check}`);
    }
  }

  return !hasIssues;
}

/**
 * 主函数
 */
async function main() {
  console.log('🛡️ 分支保护守护检查 - Windows专注策略');
  console.log('='.repeat(50));
  console.log('🎯 策略: CI环境与Windows部署目标对齐，提高稳定性');

  try {
    // 提取关键作业
    const workflowJobs = extractCriticalJobs();
    const requiredChecks = generateProtectionSuggestion(workflowJobs);

    console.log(`\n📊 汇总: 发现 ${requiredChecks.length} 个必需检查`);
    console.log(`必需检查清单: ${requiredChecks.join(', ')}`);

    // 获取并检查分支保护规则
    const protection = await getBranchProtectionRules();
    const isConsistent = checkProtectionConsistency(protection, requiredChecks);

    if (isConsistent) {
      console.log('\n✅ 分支保护规则与工作流保持同步');
    } else {
      console.log('\n❌ 分支保护规则需要更新');

      console.log('\n🔧 修复步骤 (Windows专注策略):');
      console.log('1. 前往 GitHub 仓库 Settings > Branches');
      console.log('2. 编辑 main 分支保护规则');
      console.log('3. 在 "Require status checks to pass" 中添加/移除相应检查');
      console.log('4. 确保所有Windows核心检查都已勾选');
      console.log('5. 注意: 更新后的检查基于windows-latest runner');

      // 在 CI 环境中失败
      if (process.env.CI === 'true') {
        console.log('\n🚨 CI环境下分支保护不一致，构建失败');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

// 允许直接执行或作为模块导入
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(console.error);
}

// Windows 路径兼容性处理
if (
  process.argv[1] &&
  process.argv[1].includes('branch-protection-guardian.mjs')
) {
  main().catch(console.error);
}
