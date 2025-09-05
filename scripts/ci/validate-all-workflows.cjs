#!/usr/bin/env node

/**
 * 全面 GitHub Actions 工作流验证
 * 检查所有 .github/workflows/*.yml 文件的依赖关系和语法
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseWorkflowFile, validateDependencies, checkCircularDependencies } = require('./workflow-dependency-check.cjs');

/**
 * 获取所有工作流文件
 */
function getAllWorkflowFiles() {
  const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  return fs.readdirSync(workflowsDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => path.join(workflowsDir, file));
}

/**
 * 检查单个工作流文件的语法
 */
function checkWorkflowSyntax(filePath) {
  try {
    // 使用 actionlint 或简单的 YAML 解析检查语法
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 基本语法检查
    const issues = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // 检查缩进问题
      if (line.includes('\t')) {
        issues.push(`Line ${lineNumber}: 使用 Tab 缩进（建议使用空格）`);
      }
      
      // 检查常见的语法问题
      if (line.includes('needs:') && line.includes('[') && !line.includes(']')) {
        let nextLineIndex = index + 1;
        let found = false;
        while (nextLineIndex < lines.length && nextLineIndex < index + 10) {
          if (lines[nextLineIndex].includes(']')) {
            found = true;
            break;
          }
          nextLineIndex++;
        }
        if (!found) {
          issues.push(`Line ${lineNumber}: needs 数组可能未正确闭合`);
        }
      }
    });
    
    return {
      valid: issues.length === 0,
      issues: issues
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`语法检查失败: ${error.message}`]
    };
  }
}

/**
 * 生成验证报告
 */
function generateValidationReport(results) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp: timestamp,
    summary: {
      totalFiles: results.length,
      validFiles: results.filter(r => r.status === 'valid').length,
      filesWithIssues: results.filter(r => r.status === 'issues').length,
      failedFiles: results.filter(r => r.status === 'failed').length
    },
    details: results
  };

  const reportsDir = path.join(__dirname, '..', '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `workflow-validation-${timestamp.slice(0, 10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  return reportPath;
}

/**
 * 主验证过程
 */
async function validateAllWorkflows() {
  console.log('🔍 GitHub Actions 全工作流验证');
  console.log('================================');

  const workflowFiles = getAllWorkflowFiles();
  
  if (workflowFiles.length === 0) {
    console.log('⚠️ 未找到任何工作流文件');
    return;
  }

  console.log(`📁 发现 ${workflowFiles.length} 个工作流文件`);
  
  const results = [];
  let hasErrors = false;

  for (const filePath of workflowFiles) {
    const fileName = path.relative(path.join(__dirname, '..', '..'), filePath);
    console.log(`\n🔍 检查: ${fileName}`);
    
    // 语法检查
    const syntaxCheck = checkWorkflowSyntax(filePath);
    
    // 依赖检查
    const workflowData = parseWorkflowFile(filePath);
    let dependencyIssues = [];
    let circularIssues = [];
    
    if (!workflowData.error) {
      dependencyIssues = validateDependencies(workflowData);
      circularIssues = checkCircularDependencies(workflowData);
    }
    
    const allIssues = [
      ...syntaxCheck.issues,
      ...dependencyIssues.map(issue => `依赖错误: ${issue.message} (第${issue.line}行)`),
      ...circularIssues.map((cycle, index) => `循环依赖 ${index + 1}: ${cycle.join(' → ')}`)
    ];
    
    if (workflowData.error) {
      allIssues.push(`解析错误: ${workflowData.error}`);
    }
    
    const result = {
      file: fileName,
      status: allIssues.length === 0 ? 'valid' : (workflowData.error ? 'failed' : 'issues'),
      jobCount: workflowData.jobs ? workflowData.jobs.length : 0,
      dependencyCount: workflowData.dependencies ? workflowData.dependencies.length : 0,
      issues: allIssues
    };
    
    results.push(result);
    
    if (result.status === 'valid') {
      console.log(`  ✅ 验证通过 (${result.jobCount} jobs, ${result.dependencyCount} dependencies)`);
    } else {
      console.log(`  ❌ 发现 ${allIssues.length} 个问题:`);
      allIssues.forEach(issue => console.log(`     ${issue}`));
      hasErrors = true;
    }
  }

  // 生成报告
  const reportPath = generateValidationReport(results);
  
  console.log('\n🎯 验证结果汇总');
  console.log('================');
  console.log(`📊 总计: ${results.length} 个文件`);
  console.log(`✅ 通过: ${results.filter(r => r.status === 'valid').length} 个文件`);
  console.log(`⚠️ 有问题: ${results.filter(r => r.status === 'issues').length} 个文件`);
  console.log(`❌ 失败: ${results.filter(r => r.status === 'failed').length} 个文件`);
  console.log(`📋 详细报告: ${reportPath}`);

  if (hasErrors) {
    console.log('\n💡 建议操作:');
    console.log('1. 检查并修复依赖引用错误');
    console.log('2. 确保所有 job ID 存在且可访问');
    console.log('3. 消除循环依赖');
    console.log('4. 统一使用空格缩进');
    process.exit(1);
  } else {
    console.log('\n🚀 所有工作流文件验证通过！');
  }
}

// Execute if run directly
if (require.main === module) {
  validateAllWorkflows().catch(error => {
    console.error('❌ 工作流验证失败:', error.message);
    process.exit(1);
  });
}

module.exports = {
  validateAllWorkflows,
  getAllWorkflowFiles,
  checkWorkflowSyntax,
  generateValidationReport
};