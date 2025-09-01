#!/usr/bin/env node

/**
 * Base 文档清洁检查脚本
 * 验证 docs/architecture/base/ 目录中的文档不包含 PRD-ID 和真实域名
 * 符合 CLAUDE.md Base/Overlay 分离要求
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 清洁检查规则
const CLEAN_RULES = {
  // 禁止的模式 - 这些不应该出现在 base 文档中
  forbiddenPatterns: [
    {
      pattern: /PRD-[A-Z0-9-]+/g,
      name: 'PRD-ID',
      message: 'Base 文档不得包含具体的 PRD-ID，应使用占位符 ${PRD_ID}',
      severity: 'critical',
    },
    {
      pattern: /PRODUCT-[A-Z0-9-]+/g,
      name: 'Product ID',
      message: 'Base 文档不得包含具体的产品 ID，应使用占位符 ${PRODUCT_*}',
      severity: 'critical',
    },
    {
      pattern:
        /buildgame\.com|vitegame\.app|[a-zA-Z0-9-]+\.(com|net|org|app|io)(?!\s*\)|\s*>|\s*])/g,
      name: '真实域名',
      message: 'Base 文档不得包含真实域名，应使用占位符 ${DOMAIN_*}',
      severity: 'high',
    },
    {
      pattern: /具体的.*模块名称|特定.*功能|实际.*业务/g,
      name: '具体业务描述',
      message: 'Base 文档应避免具体业务描述，使用通用术语和占位符',
      severity: 'medium',
    },
  ],

  // 必需的模式 - 这些应该出现在 base 文档中
  requiredPatterns: [
    {
      pattern: /\$\{DOMAIN_[A-Z_]+\}/g,
      name: '域名占位符',
      message: '应使用 ${DOMAIN_*} 占位符代替真实域名',
      severity: 'low',
    },
    {
      pattern: /\$\{PRODUCT_[A-Z_]+\}/g,
      name: '产品占位符',
      message: '应使用 ${PRODUCT_*} 占位符代替具体产品名',
      severity: 'low',
    },
  ],

  // 文档结构要求
  structureRules: {
    requiredFiles: [
      '01-约束与目标-增强版.md',
      '02-安全基线(Electron).md',
      '03-可观测性(Sentry+日志)增强版.md',
      '04-系统上下文与C4+事件流.md',
      '05-数据模型与存储端口.md',
      '06-运行时视图(循环+状态机+错误路径).md',
      '07-开发与构建+质量门禁.md',
      '08-功能纵切-template.md',
      '09-性能与容量规划.md',
      '10-国际化·运维·发布.md',
    ],
    forbiddenFiles: [
      // 08 章不应该有具体功能模块，只能有模板
      /08-功能纵切-(?!template\.md$).+\.md$/,
    ],
  },
};

/**
 * 扫描 base 目录结构
 */
function scanBaseDirectory() {
  const baseDir = path.join(__dirname, '..', 'docs', 'architecture', 'base');

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Base 目录不存在: ${baseDir}`);
  }

  const files = fs.readdirSync(baseDir);
  const mdFiles = files.filter(file => file.endsWith('.md'));

  return {
    baseDir,
    allFiles: files,
    mdFiles,
  };
}

/**
 * 检查文档结构是否符合要求
 */
function checkDocumentStructure(baseInfo) {
  console.log('📁 检查文档结构...');

  const issues = [];
  const { mdFiles } = baseInfo;

  // 检查必需文件
  for (const requiredFile of CLEAN_RULES.structureRules.requiredFiles) {
    if (!mdFiles.includes(requiredFile)) {
      issues.push({
        type: 'structure',
        severity: 'high',
        file: 'base directory',
        message: `缺少必需的文档文件: ${requiredFile}`,
        recommendation: `创建文件: docs/architecture/base/${requiredFile}`,
      });
    }
  }

  // 检查禁止文件
  for (const forbiddenPattern of CLEAN_RULES.structureRules.forbiddenFiles) {
    const matchingFiles = mdFiles.filter(file => forbiddenPattern.test(file));
    for (const file of matchingFiles) {
      issues.push({
        type: 'structure',
        severity: 'critical',
        file,
        message: `Base 目录不应包含具体功能模块文档: ${file}`,
        recommendation: `将具体功能模块文档移动到 docs/architecture/overlays/<PRD-ID>/08/ 目录`,
      });
    }
  }

  console.log(`✅ 检查了 ${mdFiles.length} 个文档文件`);
  return issues;
}

/**
 * 检查单个文档文件的内容
 */
function checkDocumentContent(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  const lines = content.split('\\n');

  // 检查禁止的模式
  for (const rule of CLEAN_RULES.forbiddenPatterns) {
    const matches = Array.from(content.matchAll(rule.pattern));

    for (const match of matches) {
      // 找到匹配所在的行号
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\\n').length;
      const line = lines[lineNumber - 1];

      issues.push({
        type: 'content',
        severity: rule.severity,
        file: relativePath,
        line: lineNumber,
        message: `${rule.name}: ${rule.message}`,
        context: `第 ${lineNumber} 行: "${line.trim()}"`,
        match: match[0],
        recommendation: `替换 "${match[0]}" 为合适的占位符`,
      });
    }
  }

  return issues;
}

/**
 * 检查所有 base 文档内容
 */
function checkAllDocuments(baseInfo) {
  console.log('📄 检查文档内容清洁度...');

  const allIssues = [];
  const { baseDir, mdFiles } = baseInfo;

  for (const file of mdFiles) {
    const filePath = path.join(baseDir, file);
    const relativePath = `docs/architecture/base/${file}`;

    try {
      const issues = checkDocumentContent(filePath, relativePath);
      allIssues.push(...issues);

      if (issues.length > 0) {
        console.log(`⚠️  ${file}: 发现 ${issues.length} 个问题`);
      } else {
        console.log(`✅ ${file}: 清洁检查通过`);
      }
    } catch (error) {
      allIssues.push({
        type: 'error',
        severity: 'high',
        file: relativePath,
        message: `文件读取失败: ${error.message}`,
      });
    }
  }

  return allIssues;
}

/**
 * 检查 Front-Matter 合规性
 */
function checkFrontMatter(baseInfo) {
  console.log('📋 检查 Front-Matter 合规性...');

  const issues = [];
  const { baseDir, mdFiles } = baseInfo;

  for (const file of mdFiles) {
    const filePath = path.join(baseDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = `docs/architecture/base/${file}`;

    // 检查是否有 Front-Matter
    const frontMatterMatch = content.match(/^---\\s*\\n([\\s\\S]*?)\\n---/);

    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];

      // Base 文档的 Front-Matter 不应该包含 PRD-ID
      if (frontMatter.includes('PRD-ID:')) {
        issues.push({
          type: 'frontmatter',
          severity: 'critical',
          file: relativePath,
          message: 'Base 文档的 Front-Matter 不得包含 PRD-ID',
          recommendation: '移除 PRD-ID 字段，或将文档移动到相应的 overlay 目录',
        });
      }

      // 检查是否有具体的测试引用
      const testRefsMatch = frontMatter.match(/Test-Refs:\\s*\\[(.*?)\\]/);
      if (testRefsMatch && testRefsMatch[1].trim()) {
        const testRefs = testRefsMatch[1];
        if (!testRefs.includes('${') && !testRefs.includes('template')) {
          issues.push({
            type: 'frontmatter',
            severity: 'medium',
            file: relativePath,
            message: 'Base 文档的 Test-Refs 应使用占位符或模板引用',
            recommendation: '使用占位符如 ${TEST_PATH} 或模板引用',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 生成清洁检查报告
 */
function generateCleanReport(allIssues, baseInfo) {
  console.log('📊 生成清洁检查报告...');

  const reportDir = path.join(__dirname, '..', 'logs', 'docs-validation');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(reportDir, `base-clean-check-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    rules: CLEAN_RULES,
    baseDirectory: baseInfo.baseDir,
    scannedFiles: baseInfo.mdFiles,
    summary: {
      totalFiles: baseInfo.mdFiles.length,
      totalIssues: allIssues.length,
      critical: allIssues.filter(i => i.severity === 'critical').length,
      high: allIssues.filter(i => i.severity === 'high').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      low: allIssues.filter(i => i.severity === 'low').length,
    },
    issues: allIssues,
    recommendations: generateCleanRecommendations(allIssues),
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 清洁检查报告已保存: ${reportFile}`);

  return report;
}

/**
 * 生成清洁修复建议
 */
function generateCleanRecommendations(issues) {
  const recommendations = [];

  const prdIdIssues = issues.filter(i => i.message.includes('PRD-ID'));
  if (prdIdIssues.length > 0) {
    recommendations.push(
      '将包含具体 PRD-ID 的内容移动到对应的 overlay 目录，或使用占位符 ${PRD_ID}'
    );
  }

  const domainIssues = issues.filter(i => i.message.includes('域名'));
  if (domainIssues.length > 0) {
    recommendations.push(
      '替换真实域名为占位符，如 ${DOMAIN_MAIN}、${DOMAIN_API} 等'
    );
  }

  const structureIssues = issues.filter(i => i.type === 'structure');
  if (structureIssues.length > 0) {
    recommendations.push('检查并修正文档结构，确保 base 目录只包含跨切面文档');
  }

  const frontMatterIssues = issues.filter(i => i.type === 'frontmatter');
  if (frontMatterIssues.length > 0) {
    recommendations.push(
      '修正 Front-Matter 配置，确保 base 文档不包含具体的业务引用'
    );
  }

  return recommendations;
}

/**
 * 主清洁检查函数
 */
function runBaseCleanCheck() {
  console.log('🧹 开始 Base 文档清洁检查...');
  console.log('📋 参考标准: CLAUDE.md Base/Overlay 分离要求\\n');

  try {
    // 1. 扫描 base 目录
    const baseInfo = scanBaseDirectory();
    console.log(`📂 扫描目录: ${baseInfo.baseDir}`);
    console.log(`📄 发现文档: ${baseInfo.mdFiles.length} 个\\n`);

    const allIssues = [];

    // 2. 检查文档结构
    const structureIssues = checkDocumentStructure(baseInfo);
    allIssues.push(...structureIssues);

    // 3. 检查文档内容
    const contentIssues = checkAllDocuments(baseInfo);
    allIssues.push(...contentIssues);

    // 4. 检查 Front-Matter
    const frontMatterIssues = checkFrontMatter(baseInfo);
    allIssues.push(...frontMatterIssues);

    // 5. 生成报告
    const report = generateCleanReport(allIssues, baseInfo);

    // 6. 显示结果
    console.log('\\n📊 清洁检查结果汇总:');
    console.log(`  扫描文件: ${report.summary.totalFiles}`);
    console.log(`  总问题数: ${report.summary.totalIssues}`);
    console.log(`  严重问题: ${report.summary.critical}`);
    console.log(`  高危问题: ${report.summary.high}`);
    console.log(`  中等问题: ${report.summary.medium}`);
    console.log(`  轻微问题: ${report.summary.low}`);

    if (allIssues.length > 0) {
      console.log('\\n❌ 发现清洁问题:');

      // 按严重程度分组显示
      const criticalIssues = allIssues.filter(i => i.severity === 'critical');
      const highIssues = allIssues.filter(i => i.severity === 'high');

      if (criticalIssues.length > 0) {
        console.log('\\n🚨 严重问题:');
        criticalIssues.forEach(issue => {
          console.log(`  - ${issue.file}: ${issue.message}`);
          if (issue.context) {
            console.log(`    📍 ${issue.context}`);
          }
          if (issue.recommendation) {
            console.log(`    💡 建议: ${issue.recommendation}`);
          }
        });
      }

      if (highIssues.length > 0) {
        console.log('\\n⚠️  高危问题:');
        highIssues.forEach(issue => {
          console.log(`  - ${issue.file}: ${issue.message}`);
          if (issue.context) {
            console.log(`    📍 ${issue.context}`);
          }
          if (issue.recommendation) {
            console.log(`    💡 建议: ${issue.recommendation}`);
          }
        });
      }

      console.log('\\n📋 修复建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });

      console.log('\\n📄 详细报告已保存到 logs/docs-validation/ 目录');

      // 如果有严重或高危问题，退出码为 1
      if (criticalIssues.length > 0 || highIssues.length > 0) {
        console.log('\\n❌ Base 文档清洁检查失败：存在严重或高危问题');
        process.exit(1);
      }
    } else {
      console.log('\\n✅ Base 文档清洁检查通过！');
      console.log('🎉 所有文档均符合 Base/Overlay 分离要求');
    }
  } catch (error) {
    console.error('❌ Base 文档清洁检查执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  runBaseCleanCheck();
}

export {
  runBaseCleanCheck,
  checkDocumentStructure,
  checkDocumentContent,
  checkFrontMatter,
  CLEAN_RULES,
};
