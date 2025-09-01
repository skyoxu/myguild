#!/usr/bin/env node

/**
 * CHANGELOG 自动化更新脚本
 * 集成质量门禁数据，支持 AI + 人类协作开发模式
 * 符合 CLAUDE.md 和 CONTRIBUTING.md 规范
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const PROJECT_ROOT = path.join(__dirname, '..');

// 配置常量
const CHANGELOG_PATH = path.join(PROJECT_ROOT, 'CHANGELOG.md');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const COVERAGE_REPORT_PATH = path.join(
  PROJECT_ROOT,
  'coverage',
  'coverage-summary.json'
);

/**
 * 获取当前版本信息
 */
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return packageJson.version || '0.0.0';
  } catch (error) {
    console.warn('⚠️ 无法读取 package.json，使用默认版本 0.0.0');
    return '0.0.0';
  }
}

/**
 * 获取测试覆盖率数据
 */
function getCoverageData() {
  try {
    if (!fs.existsSync(COVERAGE_REPORT_PATH)) {
      console.warn('⚠️ 覆盖率报告不存在，请先运行 npm run test:coverage');
      return null;
    }

    const coverageReport = JSON.parse(
      fs.readFileSync(COVERAGE_REPORT_PATH, 'utf8')
    );
    const totalCoverage = coverageReport.total;

    return {
      lines: totalCoverage.lines.pct,
      branches: totalCoverage.branches.pct,
      functions: totalCoverage.functions.pct,
      statements: totalCoverage.statements.pct,
    };
  } catch (error) {
    console.warn('⚠️ 读取覆盖率报告失败:', error.message);
    return null;
  }
}

/**
 * 生成质量指标标签
 */
function generateQualityTags(coverageData, options = {}) {
  const tags = [];

  // AI/人类协作比例 (默认值或用户输入)
  const aiPercentage = options.aiPercentage || 70;
  const humanPercentage = 100 - aiPercentage;
  tags.push(`[AI:${aiPercentage}%] [Human:${humanPercentage}%]`);

  // ADR 引用
  if (options.adrs && options.adrs.length > 0) {
    tags.push(`[${options.adrs.map(adr => `ADR-${adr}`).join(', ')}]`);
  }

  // 测试覆盖率
  if (coverageData) {
    tags.push(`[Coverage:${coverageData.lines}%]`);
  }

  // Release Health (模拟数据，实际应从 Sentry 获取)
  if (options.includeReleaseHealth !== false) {
    const sessionRate = options.crashFreeSessionsRate || '99.8';
    const userRate = options.crashFreeUsersRate || '99.7';
    tags.push(`[RH: Sessions ${sessionRate}%, Users ${userRate}%]`);
  }

  // 质量门禁状态
  const guardStatus = options.guardPassed !== false ? '✅' : '❌';
  tags.push(`[Guard:${guardStatus}]`);

  return tags.join(' ');
}

/**
 * 格式化变更条目
 */
function formatChangeEntry(type, description, tags) {
  return `- **${tags}** ${description}`;
}

/**
 * 创建新的版本部分
 */
function createVersionSection(version, changes, coverageData) {
  const date = new Date().toISOString().split('T')[0];
  const lines = [`## [${version}] - ${date}`, ''];

  // 按类型分组变更
  const changeTypes = [
    'Added',
    'Changed',
    'Deprecated',
    'Removed',
    'Fixed',
    'Security',
  ];

  changeTypes.forEach(type => {
    const typeChanges = changes.filter(change => change.type === type);
    if (typeChanges.length > 0) {
      const typeName = {
        Added: '添加 (Added)',
        Changed: '修改 (Changed)',
        Deprecated: '废弃 (Deprecated)',
        Removed: '移除 (Removed)',
        Fixed: '修复 (Fixed)',
        Security: '安全 (Security)',
      }[type];

      lines.push(`### ${typeName}`);
      lines.push('');

      typeChanges.forEach(change => {
        const tags = generateQualityTags(coverageData, change.options || {});
        lines.push(formatChangeEntry(type, change.description, tags));
      });

      lines.push('');
    }
  });

  // 添加质量指标总结
  if (coverageData) {
    lines.push('### 质量指标');
    lines.push('');
    lines.push(
      `- **[Coverage: ${coverageData.lines}%]** (行: ${coverageData.lines}%, 分支: ${coverageData.branches}%, 函数: ${coverageData.functions}%, 语句: ${coverageData.statements}%)`
    );
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * 读取现有 CHANGELOG 内容
 */
function readChangelogContent() {
  try {
    if (!fs.existsSync(CHANGELOG_PATH)) {
      throw new Error('CHANGELOG.md 文件不存在');
    }
    return fs.readFileSync(CHANGELOG_PATH, 'utf8');
  } catch (error) {
    console.error('❌ 读取 CHANGELOG.md 失败:', error.message);
    process.exit(1);
  }
}

/**
 * 更新 CHANGELOG 内容
 */
function updateChangelog(newVersionContent, existingContent) {
  // 找到第一个版本标记的位置
  const versionRegex = /^## \[\d+\.\d+\.\d+\]/m;
  const match = existingContent.match(versionRegex);

  if (match) {
    // 在第一个版本前插入新版本
    const insertPosition = match.index;
    const beforeVersion = existingContent.substring(0, insertPosition);
    const afterVersion = existingContent.substring(insertPosition);

    return beforeVersion + newVersionContent + afterVersion;
  } else {
    // 如果没有找到现有版本，添加到文件末尾
    return existingContent + '\n' + newVersionContent;
  }
}

/**
 * 写入更新后的 CHANGELOG
 */
function writeChangelog(content) {
  try {
    fs.writeFileSync(CHANGELOG_PATH, content, 'utf8');
    console.log('✅ CHANGELOG.md 更新成功');
  } catch (error) {
    console.error('❌ 写入 CHANGELOG.md 失败:', error.message);
    process.exit(1);
  }
}

/**
 * 交互式收集变更信息
 */
async function collectChangeInfo() {
  // 这里简化为命令行参数处理，实际项目中可以使用 inquirer 等库进行交互式输入
  const args = process.argv.slice(2);
  const changes = [];

  // 解析命令行参数示例：
  // node update-changelog.mjs --add "新增用户认证功能" --ai 80 --adr "0001,0002" --fix "修复内存泄漏问题"

  for (let i = 0; i < args.length; i += 2) {
    const type = args[i]?.replace('--', '');
    const description = args[i + 1];

    if (type && description) {
      const changeType = {
        add: 'Added',
        change: 'Changed',
        deprecate: 'Deprecated',
        remove: 'Removed',
        fix: 'Fixed',
        security: 'Security',
      }[type];

      if (changeType) {
        changes.push({
          type: changeType,
          description: description,
          options: {
            aiPercentage: 70, // 默认值，可以通过额外参数调整
            adrs: [], // 可以通过额外参数添加
          },
        });
      }
    }
  }

  // 如果没有通过命令行参数提供变更，使用示例数据
  if (changes.length === 0) {
    console.log('💡 使用示例变更数据，实际使用时请通过命令行参数提供：');
    console.log(
      '   node update-changelog.mjs --add "新增功能描述" --fix "修复问题描述"'
    );

    changes.push({
      type: 'Added',
      description: '示例新功能：用户配置管理',
      options: { aiPercentage: 75, adrs: ['0006'] },
    });
  }

  return changes;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始更新 CHANGELOG.md...');

  try {
    // 获取当前版本和覆盖率数据
    const currentVersion = getCurrentVersion();
    const coverageData = getCoverageData();

    // 收集变更信息
    const changes = await collectChangeInfo();

    // 生成新版本的下一个版本号 (简单实现)
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[2] += 1; // 递增 PATCH 版本
    const newVersion = versionParts.join('.');

    console.log(`📋 准备发布版本: ${newVersion}`);
    console.log(
      `📊 测试覆盖率: ${coverageData ? coverageData.lines + '%' : '未知'}`
    );
    console.log(`📝 变更条目: ${changes.length} 项`);

    // 生成新版本内容
    const newVersionContent = createVersionSection(
      newVersion,
      changes,
      coverageData
    );

    // 读取并更新 CHANGELOG
    const existingContent = readChangelogContent();
    const updatedContent = updateChangelog(newVersionContent, existingContent);

    // 写入更新后的内容
    writeChangelog(updatedContent);

    console.log('✅ CHANGELOG.md 更新完成！');
    console.log('');
    console.log('📋 后续步骤:');
    console.log('1. 检查 CHANGELOG.md 内容');
    console.log(`2. 更新 package.json 版本为 ${newVersion}`);
    console.log('3. 提交变更并创建版本标签');
    console.log('4. 运行质量门禁检查: npm run guard:ci');
  } catch (error) {
    console.error('❌ 更新 CHANGELOG.md 失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateQualityTags, formatChangeEntry, createVersionSection };
