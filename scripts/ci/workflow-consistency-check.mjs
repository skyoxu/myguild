#!/usr/bin/env node

/**
 * GitHub Actions工作流一致性检查脚本
 * 
 * 检查项目：
 * 1. needs → jobs 依赖一致性（防止保护规则空窗）
 * 2. job id 与 name 的规范（建议只改name不改id）
 * 3. 核心门禁jobs的稳定性检查
 * 
 * @author GitHub Actions
 * @version 1.0.0
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

const WORKFLOW_DIR = '.github/workflows';
const CORE_GATES = ['unit-tests-core', 'coverage-gate'];

// 推荐的分支保护必需检查项 (稳定英文名)
const REQUIRED_STATUS_CHECKS = [
  'CI/CD Pipeline / Quality Gates Check',
  'CI/CD Pipeline / Unit Tests (ubuntu-latest, Node 20)', 
  'CI/CD Pipeline / Coverage Gate',
  'CI/CD Pipeline / Release Health Gate',
  'Security Gate (Unified) / 🚦 统一安全门禁'
];

// 应避免设为必需检查的jobs (有条件跳过或重复)
const AVOID_REQUIRED_CHECKS = [
  'deployment-readiness',      // 有main分支if条件
  'unit-tests-extended',       // 有跳过条件
  'performance-benchmarks',    // 有跳过条件
  'build-verification-extended', // 有跳过条件
  'electron-security-gate'     // 与unified-security-gate重复，保留unified作为唯一安全门禁
];

/**
 * 解析单个工作流文件
 */
function parseWorkflow(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const workflow = parse(content);
    return { path: filePath, data: workflow, error: null };
  } catch (error) {
    return { path: filePath, data: null, error: error.message };
  }
}

/**
 * 提取工作流中的所有job ID
 */
function extractJobIds(workflow) {
  if (!workflow.jobs) return [];
  return Object.keys(workflow.jobs);
}

/**
 * 提取工作流中的所有needs依赖
 */
function extractNeeds(workflow) {
  if (!workflow.jobs) return [];
  
  const needs = [];
  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    if (job.needs) {
      const jobNeeds = Array.isArray(job.needs) ? job.needs : [job.needs];
      needs.push({ jobId, needs: jobNeeds });
    }
  }
  return needs;
}

/**
 * 检查needs依赖是否指向存在的jobs
 */
function checkNeedsConsistency(workflow, filePath) {
  const issues = [];
  const jobIds = extractJobIds(workflow);
  const needsRelations = extractNeeds(workflow);
  
  for (const relation of needsRelations) {
    for (const neededJob of relation.needs) {
      if (!jobIds.includes(neededJob)) {
        issues.push({
          type: 'missing-job',
          severity: 'error',
          file: filePath,
          job: relation.jobId,
          missingDep: neededJob,
          message: `Job '${relation.jobId}' depends on missing job '${neededJob}'`
        });
      }
    }
  }
  
  return issues;
}

/**
 * 检查核心门禁jobs的稳定性
 */
function checkCoreGatesStability(workflow, filePath) {
  const issues = [];
  
  if (!workflow.jobs) return issues;
  
  for (const coreGate of CORE_GATES) {
    const job = workflow.jobs[coreGate];
    if (job) {
      // 检查是否有排他性if条件
      if (job.if && !job.if.includes('always()') && !job.if.includes('!cancelled()')) {
        issues.push({
          type: 'core-gate-conditional',
          severity: 'warning',
          file: filePath,
          job: coreGate,
          condition: job.if,
          message: `Core gate '${coreGate}' has conditional execution: ${job.if}`
        });
      }
    }
  }
  
  return issues;
}

/**
 * 检查job命名规范
 */
function checkJobNaming(workflow, filePath) {
  const issues = [];
  
  if (!workflow.jobs) return issues;
  
  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    // 检查job id是否包含特殊字符（建议使用连字符分隔）
    if (!/^[a-z0-9-_]+$/.test(jobId)) {
      issues.push({
        type: 'job-naming',
        severity: 'info',
        file: filePath,
        job: jobId,
        message: `Job ID '${jobId}' should use lowercase letters, numbers, hyphens, and underscores only`
      });
    }
    
    // 检查是否有name字段（提高可读性）
    if (!job.name) {
      issues.push({
        type: 'missing-job-name',
        severity: 'info',
        file: filePath,
        job: jobId,
        message: `Job '${jobId}' is missing a descriptive 'name' field`
      });
    }
  }
  
  return issues;
}

/**
 * 检查分支保护推荐配置
 */
function checkBranchProtectionAlignment(allWorkflows) {
  const issues = [];
  const foundJobs = new Map(); // 工作流名 -> job列表
  
  // 收集所有工作流中的jobs信息
  for (const workflow of allWorkflows) {
    if (!workflow.data || !workflow.data.name) continue;
    
    const workflowName = workflow.data.name;
    const jobs = extractJobIds(workflow.data);
    
    for (const jobId of jobs) {
      const job = workflow.data.jobs[jobId];
      const jobDisplayName = job.name || jobId;
      const fullName = `${workflowName} / ${jobDisplayName}`;
      foundJobs.set(fullName, {
        workflowFile: workflow.path,
        jobId,
        jobDisplayName,
        workflowName
      });
    }
  }
  
  // 检查避免设为必需检查的jobs
  for (const avoidJob of AVOID_REQUIRED_CHECKS) {
    for (const [fullName, jobInfo] of foundJobs) {
      if (jobInfo.jobId === avoidJob) {
        issues.push({
          type: 'avoid-required-check',
          severity: 'warning',
          file: jobInfo.workflowFile,
          job: avoidJob,
          message: `Job '${avoidJob}' has conditional execution and should NOT be set as required status check`,
          suggestion: `Remove '${fullName}' from branch protection required checks`
        });
      }
    }
  }
  
  // 检查推荐的必需检查项是否存在
  for (const requiredCheck of REQUIRED_STATUS_CHECKS) {
    if (!foundJobs.has(requiredCheck)) {
      issues.push({
        type: 'missing-required-check',
        severity: 'warning',
        message: `Recommended required status check not found: '${requiredCheck}'`,
        suggestion: `Ensure this job exists and is configured in branch protection rules`
      });
    }
  }
  
  return issues;
}

/**
 * 主检查函数
 */
function checkWorkflows() {
  console.log('🔍 开始检查GitHub Actions工作流一致性...\n');
  
  let allIssues = [];
  let checkedFiles = 0;
  const allWorkflows = []; // 收集所有成功解析的工作流
  
  try {
    const workflowFiles = readdirSync(WORKFLOW_DIR)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .map(file => join(WORKFLOW_DIR, file));
    
    for (const filePath of workflowFiles) {
      console.log(`📄 检查文件: ${filePath}`);
      
      const parsed = parseWorkflow(filePath);
      if (parsed.error) {
        allIssues.push({
          type: 'parse-error',
          severity: 'error',
          file: filePath,
          message: `Failed to parse workflow: ${parsed.error}`
        });
        continue;
      }
      
      checkedFiles++;
      allWorkflows.push(parsed); // 收集成功解析的工作流
      
      // 运行各项检查
      const needsIssues = checkNeedsConsistency(parsed.data, filePath);
      const coreGateIssues = checkCoreGatesStability(parsed.data, filePath);
      const namingIssues = checkJobNaming(parsed.data, filePath);
      
      allIssues.push(...needsIssues, ...coreGateIssues, ...namingIssues);
    }
    
    // 运行跨工作流检查
    console.log(`📋 检查分支保护规则推荐配置...`);
    const branchProtectionIssues = checkBranchProtectionAlignment(allWorkflows);
    allIssues.push(...branchProtectionIssues);
    
    // 生成报告
    console.log(`\\n📊 检查完成！已检查 ${checkedFiles} 个工作流文件\\n`);
    
    const errorIssues = allIssues.filter(i => i.severity === 'error');
    const warningIssues = allIssues.filter(i => i.severity === 'warning');
    const infoIssues = allIssues.filter(i => i.severity === 'info');
    
    if (errorIssues.length === 0) {
      console.log('✅ 未发现严重问题！');
    } else {
      console.log(`❌ 发现 ${errorIssues.length} 个严重问题：`);
      for (const issue of errorIssues) {
        console.log(`  - [${issue.file}] ${issue.message}`);
        if (issue.type === 'missing-job') {
          console.log(`    💡 修复建议：在 ${issue.file} 中添加缺失的job '${issue.missingDep}'，或从 '${issue.job}' 的needs中移除`);
        }
      }
    }
    
    if (warningIssues.length > 0) {
      console.log(`\\n⚠️  发现 ${warningIssues.length} 个警告：`);
      for (const issue of warningIssues) {
        console.log(`  - [${issue.file}] ${issue.message}`);
        if (issue.type === 'core-gate-conditional') {
          console.log(`    💡 建议：将路径过滤移至workflow触发条件而非job级if条件`);
        }
      }
    }
    
    if (infoIssues.length > 0) {
      console.log(`\\nℹ️  发现 ${infoIssues.length} 个信息提示：`);
      for (const issue of infoIssues.slice(0, 5)) { // 只显示前5个信息问题
        console.log(`  - [${issue.file}] ${issue.message}`);
      }
      if (infoIssues.length > 5) {
        console.log(`  - ... 还有 ${infoIssues.length - 5} 个信息提示`);
      }
    }
    
    // 生成JSON报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesChecked: checkedFiles,
        errors: errorIssues.length,
        warnings: warningIssues.length,
        info: infoIssues.length
      },
      issues: allIssues
    };
    
    // 输出到CI环境变量（如果存在）
    if (process.env.GITHUB_OUTPUT) {
      import('fs').then(fs => {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `workflow_check_errors=${errorIssues.length}\\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `workflow_check_warnings=${warningIssues.length}\\n`);
      });
    }
    
    console.log(`\\n📋 详细报告已生成到内存，可通过JSON格式获取`);
    
    // 如果有严重问题，返回非零退出码
    if (errorIssues.length > 0) {
      console.log('\\n🚨 由于存在严重问题，检查失败！');
      process.exit(1);
    }
    
    console.log('\\n✅ 工作流一致性检查通过！');
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].includes('workflow-consistency-check.mjs')) {
  checkWorkflows();
}

export { checkWorkflows, parseWorkflow, extractJobIds, extractNeeds };