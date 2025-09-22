#!/usr/bin/env node

/**
 * 全面 GitHub Actions 工作流验证
 * 检查所有 .github/workflows/*.yml 文件的依赖关系和语法
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  parseWorkflowFile,
  validateDependencies,
  checkCircularDependencies,
} = require('./workflow-dependency-check.cjs');

/**
 * 获取所有工作流文件
 */
function getAllWorkflowFiles() {
  const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  return fs
    .readdirSync(workflowsDir)
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
      if (
        line.includes('needs:') &&
        line.includes('[') &&
        !line.includes(']')
      ) {
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
      issues: issues,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`语法检查失败: ${error.message}`],
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
      failedFiles: results.filter(r => r.status === 'failed').length,
    },
    details: results,
  };

  const reportsDir = path.join(__dirname, '..', '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(
    reportsDir,
    `workflow-validation-${timestamp.slice(0, 10)}.json`
  );
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
  let foundSceneTransitionRunner = false;
  let foundScheduledSceneTransition = false;

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
      ...dependencyIssues.map(
        issue => `依赖错误: ${issue.message} (第${issue.line}行)`
      ),
      ...circularIssues.map(
        (cycle, index) => `循环依赖 ${index + 1}: ${cycle.join(' → ')}`
      ),
    ];

    if (workflowData.error) {
      allIssues.push(`解析错误: ${workflowData.error}`);
    }

    const result = {
      file: fileName,
      status:
        allIssues.length === 0
          ? 'valid'
          : workflowData.error
            ? 'failed'
            : 'issues',
      jobCount: workflowData.jobs ? workflowData.jobs.length : 0,
      dependencyCount: workflowData.dependencies
        ? workflowData.dependencies.length
        : 0,
      issues: allIssues,
    };

    results.push(result);

    // 场景转换项目必跑检查（允许多种触发方式）
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const okPatterns = [
        /npm\s+run\s+test:e2e(\s|$)/i,
        /npm\s+run\s+test:e2e:scene-transition/i,
        /npx\s+playwright\s+test[^\n]*--project[^\n]*scene-transition/i,
        /playwright\s+test[^\n]*--project[^\n]*scene-transition/i,
        /npm\s+run\s+guard:ci/i,
      ];
      if (okPatterns.some(r => r.test(raw))) {
        foundSceneTransitionRunner = true;
      }

      // 夜间/周任务：若包含 schedule，则该文件也必须触发 scene-transition
      const hasSchedule = /\bon\s*:\s*[\s\S]*?schedule\s*:/i.test(raw);
      if (hasSchedule && okPatterns.some(r => r.test(raw))) {
        foundScheduledSceneTransition = true;
      }
    } catch (_) {}

    if (result.status === 'valid') {
      console.log(
        `  ✅ 验证通过 (${result.jobCount} jobs, ${result.dependencyCount} dependencies)`
      );
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
  console.log(
    `✅ 通过: ${results.filter(r => r.status === 'valid').length} 个文件`
  );
  console.log(
    `⚠️ 有问题: ${results.filter(r => r.status === 'issues').length} 个文件`
  );
  console.log(
    `❌ 失败: ${results.filter(r => r.status === 'failed').length} 个文件`
  );
  console.log(`📋 详细报告: ${reportPath}`);

  // 全局必跑项：scene-transition 项目必须在任一工作流中被执行
  if (!foundSceneTransitionRunner) {
    hasErrors = true;
    console.log(
      '\n❌ 必跑检查未通过: 未检测到 scene-transition 项目的执行入口'
    );
    console.log('   允许的写法示例:');
    console.log('   - npm run test:e2e');
    console.log('   - npm run test:e2e:scene-transition');
    console.log("   - npx playwright test --project='scene-transition'");
    console.log('   - npm run guard:ci (链内包含 test:e2e)');
  }

  // 夜间/周任务：若任一 workflow 含 schedule，则至少一个带 schedule 的 workflow 应执行 scene-transition
  const anyHasSchedule = getAllWorkflowFiles()
    .map(f => fs.readFileSync(f, 'utf8'))
    .some(raw => /\bon\s*:\s*[\s\S]*?schedule\s*:/i.test(raw));
  if (anyHasSchedule && !foundScheduledSceneTransition) {
    hasErrors = true;
    console.log(
      '\n❌ 夜间/周任务检查未通过: 含有 schedule 的工作流未检测到 scene-transition 执行'
    );
    console.log('   请在定时任务工作流中添加以下任一命令:');
    console.log('   - npm run test:e2e:scene-transition');
    console.log("   - npx playwright test --project='scene-transition'");
  }

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
  generateValidationReport,
};
