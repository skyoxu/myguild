#!/usr/bin/env node
/**
 * P2优化：验证GitHub Actions工作流的编码一致性
 * 检查Step Summary和文件输出的编码最佳实践
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// 编码最佳实践规则
const ENCODING_RULES = {
  // 危险的PowerShell重定向操作
  dangerousPatterns: [
    /echo.*>>.*GITHUB_STEP_SUMMARY/,
    /shell:\s*powershell/,
    /Out-File(?!.*-Encoding\s+utf8NoBom)/,
    />.*GITHUB_STEP_SUMMARY/,
  ],

  // 推荐的安全模式
  safePatterns: [
    /shell:\s*bash/,
    /shell:\s*pwsh/,
    /cat.*>>.*GITHUB_STEP_SUMMARY/,
    /Out-File.*-Encoding\s+utf8NoBom/,
  ],
};

/**
 * 检查工作流文件的编码安全性
 */
async function validateWorkflowEncoding() {
  console.log('🔍 开始验证工作流编码一致性...\n');

  const workflowFiles = await glob('.github/workflows/*.yml', {
    cwd: projectRoot,
    absolute: true,
  });

  const results = {
    total: workflowFiles.length,
    safe: 0,
    warnings: [],
    errors: [],
  };

  for (const filePath of workflowFiles) {
    const fileName = path.basename(filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    console.log(`📄 检查 ${fileName}...`);

    // 检查Windows runner使用情况
    const hasWindowsRunner = /runs-on:.*windows/m.test(content);
    const hasStepSummary = /GITHUB_STEP_SUMMARY/.test(content);

    if (hasWindowsRunner && hasStepSummary) {
      console.log(`  🖥️  Windows runner + Step Summary 检测`);

      // 检查危险模式
      for (const [lineIndex, line] of lines.entries()) {
        for (const dangerousPattern of ENCODING_RULES.dangerousPatterns) {
          if (dangerousPattern.test(line)) {
            results.errors.push({
              file: fileName,
              line: lineIndex + 1,
              issue: `潜在编码问题: ${line.trim()}`,
              suggestion:
                '建议使用 bash + heredoc 或 pwsh + Out-File -Encoding utf8NoBom',
            });
          }
        }
      }

      // 检查安全模式
      const hasSafePattern = ENCODING_RULES.safePatterns.some(pattern =>
        pattern.test(content)
      );

      if (hasSafePattern) {
        results.safe++;
        console.log(`  ✅ 编码安全`);
      } else {
        results.warnings.push({
          file: fileName,
          issue: 'Windows runner使用Step Summary但未检测到安全编码模式',
          suggestion: '建议明确使用 shell: bash 或 shell: pwsh 配合正确编码',
        });
        console.log(`  ⚠️  编码模式不明确`);
      }
    } else if (hasStepSummary) {
      results.safe++;
      console.log(`  ✅ 非Windows runner，编码风险较低`);
    } else {
      console.log(`  ⏭️  未使用Step Summary`);
    }
  }

  // 生成报告
  console.log('\n' + '='.repeat(50));
  console.log('📊 编码一致性验证报告');
  console.log('='.repeat(50));

  console.log(`\n📋 总体统计:`);
  console.log(`- 总工作流数: ${results.total}`);
  console.log(`- 编码安全: ${results.safe}`);
  console.log(`- 警告数量: ${results.warnings.length}`);
  console.log(`- 错误数量: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\n🚨 编码错误:`);
    results.errors.forEach(error => {
      console.log(`  ❌ ${error.file}:${error.line} - ${error.issue}`);
      console.log(`     💡 ${error.suggestion}`);
    });
  }

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  编码警告:`);
    results.warnings.forEach(warning => {
      console.log(`  ⚠️  ${warning.file} - ${warning.issue}`);
      console.log(`     💡 ${warning.suggestion}`);
    });
  }

  // 生成最佳实践建议
  console.log(`\n📖 编码最佳实践:`);
  console.log(`1. Windows runner + Step Summary: 使用 'shell: bash' + heredoc`);
  console.log(
    `2. 需要PowerShell功能: 使用 'shell: pwsh' + 'Out-File -Encoding utf8NoBom'`
  );
  console.log(`3. 避免使用 'shell: powershell' 和简单重定向`);
  console.log(`4. 详细指南: .github/docs/encoding-best-practices.md`);

  const exitCode = results.errors.length > 0 ? 1 : 0;
  console.log(
    `\n${exitCode === 0 ? '✅' : '❌'} 验证${exitCode === 0 ? '通过' : '失败'}`
  );
  process.exit(exitCode);
}

// 运行验证
validateWorkflowEncoding().catch(error => {
  console.error('❌ 验证过程出错:', error);
  process.exit(1);
});
