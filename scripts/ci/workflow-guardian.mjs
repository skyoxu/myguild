#!/usr/bin/env node

/**
 * 工作流守护脚本 - Needs 依赖校验
 * 检验所有工作流中的 needs 引用是否对应存在的 job
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const WORKFLOWS_DIR = '.github/workflows';

/**
 * 解析工作流文件，提取 job 名称和 needs 依赖
 */
function parseWorkflow(content) {
  const lines = content.split('\n');
  const jobs = [];
  const needsRefs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 匹配 job 定义: "  job-name:"
    const jobMatch = line.match(/^  ([a-zA-Z_][a-zA-Z0-9_-]*):/);
    if (jobMatch && !line.includes('#')) {
      jobs.push(jobMatch[1]);
    }

    // 匹配 needs 定义
    const needsMatch = line.match(/^\s*needs:\s*(.+)/);
    if (needsMatch) {
      const needsValue = needsMatch[1].trim();

      // 处理数组形式: [job1, job2] 或单个形式: job1
      if (needsValue.startsWith('[') && needsValue.endsWith(']')) {
        // 数组形式
        const arrayContent = needsValue.slice(1, -1);
        const items = arrayContent
          .split(',')
          .map(item => item.trim().replace(/['"]/g, ''));
        needsRefs.push(...items.filter(item => item.length > 0));
      } else {
        // 单个值形式
        const singleValue = needsValue.replace(/['"]/g, '');
        if (singleValue.length > 0) {
          needsRefs.push(singleValue);
        }
      }
    }
  }

  return { jobs, needsRefs };
}

/**
 * 检查单个工作流文件
 */
function checkWorkflow(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { jobs, needsRefs } = parseWorkflow(content);

  console.log(`\n🔍 检查工作流: ${path.basename(filePath)}`);
  console.log(`📋 Jobs: ${jobs.join(', ')}`);
  console.log(`🔗 Needs: ${needsRefs.join(', ')}`);

  const issues = [];

  // 检查每个 needs 引用是否存在对应的 job
  for (const need of needsRefs) {
    if (!jobs.includes(need)) {
      issues.push({
        type: 'missing_job',
        message: `needs 引用 '${need}' 但对应的 job 不存在`,
        suggestion: `检查 job 名称拼写，或添加缺失的 job 定义`,
      });
    }
  }

  // 检查循环依赖（简单版本）
  const jobDeps = new Map();
  let currentJob = null;

  const lines = content.split('\n');
  for (const line of lines) {
    const jobMatch = line.match(/^  ([a-zA-Z_][a-zA-Z0-9_-]*):/);
    if (jobMatch) {
      currentJob = jobMatch[1];
      jobDeps.set(currentJob, []);
    }

    const needsMatch = line.match(/^\s*needs:\s*(.+)/);
    if (needsMatch && currentJob) {
      const needsValue = needsMatch[1].trim();
      if (needsValue.startsWith('[') && needsValue.endsWith(']')) {
        const items = needsValue
          .slice(1, -1)
          .split(',')
          .map(item => item.trim().replace(/['"]/g, ''));
        jobDeps.set(
          currentJob,
          items.filter(item => item.length > 0)
        );
      } else {
        const singleValue = needsValue.replace(/['"]/g, '');
        if (singleValue.length > 0) {
          jobDeps.set(currentJob, [singleValue]);
        }
      }
    }
  }

  // 简单循环依赖检测
  for (const [job, deps] of jobDeps.entries()) {
    for (const dep of deps) {
      if (jobDeps.get(dep)?.includes(job)) {
        issues.push({
          type: 'circular_dependency',
          message: `检测到循环依赖: ${job} ↔ ${dep}`,
          suggestion: `重构依赖关系，消除循环引用`,
        });
      }
    }
  }

  return {
    filePath,
    jobs,
    needsRefs,
    issues,
    jobDeps: Object.fromEntries(jobDeps),
  };
}

/**
 * 主函数
 */
async function main() {
  console.log('🛡️ 工作流守护自检 - Needs 依赖校验');
  console.log('='.repeat(50));

  try {
    // 查找所有工作流文件
    const workflowFiles = await glob(`${WORKFLOWS_DIR}/*.yml`);

    if (workflowFiles.length === 0) {
      console.log('⚠️ 未找到工作流文件');
      return;
    }

    let totalIssues = 0;
    const results = [];

    // 检查每个工作流
    for (const file of workflowFiles) {
      const result = checkWorkflow(file);
      results.push(result);
      totalIssues += result.issues.length;

      // 显示问题
      if (result.issues.length > 0) {
        console.log(`\n❌ 发现 ${result.issues.length} 个问题:`);
        for (const issue of result.issues) {
          console.log(`   • ${issue.message}`);
          console.log(`   💡 ${issue.suggestion}`);
        }
      } else {
        console.log('✅ 无问题');
      }
    }

    // 总结
    console.log('\n' + '='.repeat(50));
    console.log(
      `📊 检查完成: ${workflowFiles.length} 个工作流, ${totalIssues} 个问题`
    );

    if (totalIssues > 0) {
      console.log('\n🔧 修复建议:');
      console.log('1. 检查 job 名称拼写是否正确');
      console.log('2. 确保所有被引用的 job 都已定义');
      console.log('3. 消除循环依赖关系');
      console.log('4. 考虑使用 workflow_run 事件处理跨工作流依赖');

      process.exit(1);
    }

    console.log('✅ 所有工作流依赖检查通过');
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
if (process.argv[1] && process.argv[1].includes('workflow-guardian.mjs')) {
  main().catch(console.error);
}

export { parseWorkflow, checkWorkflow };
