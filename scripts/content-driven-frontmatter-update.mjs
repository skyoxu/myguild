#!/usr/bin/env node

/**
 * Content-Driven PRD Front-Matter Update Script
 * 基于内容分析的个性化front-matter生成系统
 *
 * 核心原则：
 * 1. Arc42架构对齐 - 根据内容映射到相关章节
 * 2. ADR单一职责 - 只引用与内容真正相关的ADR
 * 3. 内容驱动配置 - 避免统一模板的"一刀切"方法
 */

import fs from 'fs';
import path from 'path';

// 内容关键词到Arc42章节的映射规则
const ARCHITECTURE_MAPPING = {
  // 01章：约束与目标（产品概述、价值主张）
  '概述|价值主张|市场定位|目标用户|商业模式': ['01-introduction-and-goals'],

  // 02章：安全基线（权限、安全策略、CSP）
  '安全|权限|Security|CSP|认证|授权': ['02-security-baseline-electron'],

  // 03章：可观测性（监控、日志、追踪）
  '监控|日志|追踪|observability|metrics|telemetry': [
    '03-observability-sentry-logging',
  ],

  // 04章：系统上下文与事件流（API、接口、系统交互）
  '事件|Event|API|接口|interface|系统交互|通信': [
    '04-system-context-c4-event-flows',
  ],

  // 05章：数据模型与存储（数据结构、存储架构）
  '数据模型|interface|TypeScript|enum|数据结构|存储': [
    '05-data-models-and-storage-ports',
  ],

  // 06章：运行时视图（业务流程、状态机、错误处理）
  '状态机|流程|workflow|运行时|错误处理|业务逻辑': [
    '06-runtime-view-loops-state-machines-error-paths',
  ],

  // 07章：开发构建与质量门禁（测试、CI/CD）
  '测试|Test|CI|CD|构建|质量门禁|验收': ['07-dev-build-and-gates'],

  // 08章：功能纵切（具体功能模块）
  '功能模块|模块|module|功能实现|业务功能': [
    '08-crosscutting-and-feature-slices.base',
  ],

  // 09章：性能与容量（性能优化、容量规划）
  '性能|Performance|容量|优化|benchmark|负载': ['09-performance-and-capacity'],

  // 10章：国际化运维发布（UI/UX、国际化、运营）
  'UI|用户界面|国际化|i18n|本地化|运营|发布': ['10-i18n-ops-release'],

  // 11章：风险与技术债务
  '风险|debt|技术债务|问题|挑战': ['11-risks-and-technical-debt'],

  // 12章：术语表
  '术语|glossary|定义|概念': ['12-glossary'],
};

// 内容关键词到ADR的映射规则（基于单一职责原则）
const ADR_MAPPING = {
  // ADR-0001：技术栈选型
  '技术栈|TypeScript|React|Electron|Vite|Phaser': ['ADR-0001-tech-stack'],

  // ADR-0002：Electron安全基线
  '安全|Security|权限|CSP|nodeIntegration|contextIsolation': [
    'ADR-0002-electron-security',
  ],

  // ADR-0003：可观测性与Release Health
  '监控|observability|日志|logging|Sentry|telemetry|指标': [
    'ADR-0003-observability',
  ],

  // ADR-0004：事件总线与契约
  '事件|Event|EventBus|通信|契约|IPC|消息': [
    'ADR-0004-event-bus-and-contracts',
  ],

  // ADR-0005：质量门禁
  '测试|Test|质量|门禁|CI|验收|coverage': ['ADR-0005-quality-gates'],

  // ADR-0006：数据存储架构
  '数据|存储|数据库|SQLite|数据模型|持久化': [
    'ADR-0006-data-storage-architecture',
  ],

  // ADR-0007：端口适配器模式
  '端口|适配器|架构模式|分层|接口|抽象': ['ADR-0007-ports-adapters-pattern'],

  // ADR-0008：部署发布策略
  '部署|发布|deployment|release|打包|分发': [
    'ADR-0008-deployment-release-strategy',
  ],

  // ADR-0009：跨平台适配
  '跨平台|平台|Windows|macOS|Linux|适配': [
    'ADR-0009-cross-platform-adaptation',
  ],

  // ADR-0010：国际化本地化
  'UI|界面|国际化|i18n|本地化|localization|用户体验': [
    'ADR-0010-internationalization-localization',
  ],
};

/**
 * 分析PRD chunk内容，提取技术关键词和概念
 */
function analyzeChunkContent(content) {
  const keywords = [];
  const lines = content.split('\n');

  // 跳过front-matter，只分析内容部分
  let inFrontMatter = false;
  const contentLines = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inFrontMatter) {
        inFrontMatter = true;
      } else {
        inFrontMatter = false;
      }
      continue;
    }

    if (!inFrontMatter && line.trim()) {
      contentLines.push(line.toLowerCase());
    }
  }

  const contentText = contentLines.join(' ');

  // 提取TypeScript相关关键词
  if (/interface|enum|type|class/.test(contentText)) {
    keywords.push('数据模型', 'TypeScript', 'interface');
  }

  // 提取事件系统关键词
  if (/event|事件|EventBus|通信|消息/.test(contentText)) {
    keywords.push('事件', 'Event', '通信');
  }

  // 提取UI相关关键词
  if (/ui|界面|用户|交互|react|component/.test(contentText)) {
    keywords.push('UI', '用户界面', '交互');
  }

  // 提取安全相关关键词
  if (/安全|权限|security|csp|认证|授权/.test(contentText)) {
    keywords.push('安全', 'Security', '权限');
  }

  // 提取性能相关关键词
  if (/性能|performance|优化|响应时间|p95/.test(contentText)) {
    keywords.push('性能', 'Performance', '优化');
  }

  // 提取监控相关关键词
  if (/监控|指标|metrics|日志|logging|追踪/.test(contentText)) {
    keywords.push('监控', '指标', '日志');
  }

  // 提取测试相关关键词
  if (/测试|test|验收|质量|coverage/.test(contentText)) {
    keywords.push('测试', '质量', '验收');
  }

  // 提取数据存储相关关键词
  if (/数据|存储|数据库|sqlite|持久化/.test(contentText)) {
    keywords.push('数据', '存储', '数据库');
  }

  // 提取状态机相关关键词
  if (/状态|state|机制|流程|workflow/.test(contentText)) {
    keywords.push('状态机', '流程', '业务逻辑');
  }

  // 提取国际化相关关键词
  if (/国际化|i18n|本地化|localization/.test(contentText)) {
    keywords.push('国际化', 'i18n', '本地化');
  }

  return [...new Set(keywords)]; // 去重
}

/**
 * 根据关键词映射到相关的Arc42章节
 */
function mapToArchitectureRefs(keywords) {
  const archRefs = new Set();

  for (const [pattern, refs] of Object.entries(ARCHITECTURE_MAPPING)) {
    const patterns = pattern.split('|');
    const hasMatch = patterns.some(p =>
      keywords.some(keyword => keyword.includes(p) || p.includes(keyword))
    );

    if (hasMatch) {
      refs.forEach(ref => archRefs.add(ref));
    }
  }

  // 限制最多3个架构引用，避免过度引用
  return Array.from(archRefs).slice(0, 3);
}

/**
 * 根据关键词映射到相关的ADR
 */
function mapToRelevantADRs(keywords) {
  const adrs = new Set();

  for (const [pattern, adrList] of Object.entries(ADR_MAPPING)) {
    const patterns = pattern.split('|');
    const hasMatch = patterns.some(p =>
      keywords.some(keyword => keyword.includes(p) || p.includes(keyword))
    );

    if (hasMatch) {
      adrList.forEach(adr => adrs.add(adr));
    }
  }

  // 总是包含基础的技术栈ADR
  adrs.add('ADR-0001-tech-stack');

  // 限制最多5个ADR引用，确保精准性
  return Array.from(adrs).slice(0, 5);
}

/**
 * 生成个性化的front-matter配置
 */
function generatePersonalizedFrontMatter(chunkId, content) {
  const keywords = analyzeChunkContent(content);
  const archRefs = mapToArchitectureRefs(keywords);
  const adrs = mapToRelevantADRs(keywords);

  console.log(`\n📄 分析 ${chunkId}:`);
  console.log(
    `   关键词: ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? '...' : ''}`
  );
  console.log(`   架构引用: ${archRefs.join(', ')}`);
  console.log(`   ADR引用: ${adrs.join(', ')}`);

  // 提取现有的front-matter并更新
  const lines = content.split('\n');
  let inFrontMatter = false;
  let frontMatterEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (!inFrontMatter) {
        inFrontMatter = true;
      } else {
        frontMatterEnd = i;
        break;
      }
    }
  }

  if (frontMatterEnd === -1) {
    throw new Error(`无法找到 ${chunkId} 的front-matter结束标记`);
  }

  // 更新Arch-Refs和ADRs
  const updatedLines = [...lines];
  let archRefsUpdated = false;
  let adrsUpdated = false;

  for (let i = 0; i < frontMatterEnd; i++) {
    const line = updatedLines[i];

    if (line.startsWith('Arch-Refs:') && !archRefsUpdated) {
      // 替换Arch-Refs
      updatedLines[i] = 'Arch-Refs:';
      // 删除旧的Arch-Refs内容
      const j = i + 1;
      while (
        j < frontMatterEnd &&
        (updatedLines[j].startsWith('  -') || updatedLines[j].trim() === '')
      ) {
        updatedLines.splice(j, 1);
        frontMatterEnd--;
      }
      // 插入新的Arch-Refs
      for (let k = archRefs.length - 1; k >= 0; k--) {
        updatedLines.splice(i + 1, 0, `  - "${archRefs[k]}"`);
        frontMatterEnd++;
      }
      archRefsUpdated = true;
      continue;
    }

    if (line.startsWith('ADRs:') && !adrsUpdated) {
      // 替换ADRs
      updatedLines[i] = 'ADRs:';
      // 删除旧的ADRs内容
      const j = i + 1;
      while (
        j < frontMatterEnd &&
        (updatedLines[j].startsWith('  -') || updatedLines[j].trim() === '')
      ) {
        updatedLines.splice(j, 1);
        frontMatterEnd--;
      }
      // 插入新的ADRs
      for (let k = adrs.length - 1; k >= 0; k--) {
        updatedLines.splice(i + 1, 0, `  - "${adrs[k]}"`);
        frontMatterEnd++;
      }
      adrsUpdated = true;
      continue;
    }
  }

  return updatedLines.join('\n');
}

/**
 * 批量更新所有PRD chunk文件
 */
function updateAllChunks() {
  const chunksDir = 'C:\\buildgame\\vitegame\\docs\\prd_chunks';
  const files = fs
    .readdirSync(chunksDir)
    .filter(
      file =>
        file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
    );

  console.log(`🚀 开始内容驱动的front-matter个性化更新`);
  console.log(`📁 发现 ${files.length} 个PRD chunk文件`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const filePath = path.join(chunksDir, file);
      const content = fs.readFileSync(filePath, { encoding: 'utf8' });

      const updatedContent = generatePersonalizedFrontMatter(file, content);

      fs.writeFileSync(filePath, updatedContent, { encoding: 'utf8' });
      successCount++;
    } catch (error) {
      console.error(`❌ 更新 ${file} 失败:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ 更新完成！`);
  console.log(`   成功: ${successCount} 个文件`);
  console.log(`   失败: ${errorCount} 个文件`);
  console.log(`\n🎯 现在每个PRD chunk都有了基于内容的个性化架构引用和ADR配置`);
  console.log(`   符合Arc42对齐原则和ADR单一职责原则！`);
}

// 执行批量更新
updateAllChunks();
