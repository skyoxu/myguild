#!/usr/bin/env node

/**
 * PRD 分片文件批量修复脚本
 * 修复三个核心问题：
 * 1. Arch-Refs 格式标准化（slug -> CH代码）
 * 2. CloudEvents 1.0 合规性（补全 id 和 time 字段）
 * 3. Release Health 门禁配置完善
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PRDChunkFixer {
  constructor() {
    this.prdChunksDir = path.join(__dirname, '..', 'docs', 'prd_chunks');
    this.errors = [];
    this.fixed = [];

    // Arch-Refs 映射表：slug格式 -> CH代码格式
    this.archRefsMapping = {
      '01-introduction-and-goals': 'CH01',
      '02-security-baseline-electron': 'CH02',
      '03-observability-sentry-logging': 'CH03',
      '04-system-context-c4-event-flows': 'CH04',
      '05-data-models-and-storage-ports': 'CH05',
      '06-runtime-view-loops-state-machines-error-paths': 'CH06',
      '07-dev-build-and-gates': 'CH07',
      '08-crosscutting-and-feature-slices': 'CH08',
      '09-performance-and-capacity': 'CH09',
      '10-i18n-ops-release': 'CH10',
      '11-risks-and-technical-debt': 'CH11',
      '12-glossary': 'CH12',
    };
  }

  /**
   * 扫描并修复所有 PRD 分片文件
   */
  async fixAllChunks() {
    console.log('🚀 开始批量修复 PRD 分片文件...\n');

    try {
      const files = fs
        .readdirSync(this.prdChunksDir)
        .filter(
          file =>
            file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
        )
        .sort();

      console.log(`📂 发现 ${files.length} 个 PRD 分片文件`);

      for (const file of files) {
        await this.fixSingleChunk(file);
      }

      this.printSummary();
    } catch (error) {
      console.error('❌ 扫描文件失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 修复单个 PRD 分片文件
   */
  async fixSingleChunk(filename) {
    const filePath = path.join(this.prdChunksDir, filename);
    console.log(`\n🔧 修复文件: ${filename}`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontMatter, body } = this.parseFrontMatter(content);

      let modified = false;
      const issues = [];

      // 1. 修复 Arch-Refs 格式
      if (this.fixArchRefs(frontMatter, issues)) {
        modified = true;
      }

      // 2. 修复 CloudEvents 合规性
      if (this.fixCloudEvents(frontMatter, filename, issues)) {
        modified = true;
      }

      // 3. 完善 Release Health 门禁
      if (this.enhanceReleaseHealthGates(frontMatter, issues)) {
        modified = true;
      }

      if (modified) {
        const newContent = this.reconstructFile(frontMatter, body);
        fs.writeFileSync(filePath, newContent, 'utf-8');
        this.fixed.push({ file: filename, issues });
        console.log(`   ✅ 修复完成 (${issues.length} 个问题)`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      } else {
        console.log(`   ⚪ 无需修复`);
      }
    } catch (error) {
      const errorMsg = `修复 ${filename} 时出错: ${error.message}`;
      this.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }

  /**
   * 解析 front matter 和正文
   */
  parseFrontMatter(content) {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      throw new Error('无法解析 front matter');
    }

    return {
      frontMatter: match[1],
      body: match[2],
    };
  }

  /**
   * 修复 Arch-Refs 格式问题
   */
  fixArchRefs(frontMatterRef, issues) {
    const frontMatter = frontMatterRef[0] || frontMatterRef;

    const archRefsRegex = /Arch-Refs:\s*\n((?:\s*-\s*"[^"]+"\s*\n)*)/;
    const match = frontMatter.match(archRefsRegex);

    if (!match) {
      // 检查是否使用了正确格式
      const correctFormatRegex = /Arch-Refs:\s*\[(CH\d{2}(?:,\s*CH\d{2})*)\]/;
      if (correctFormatRegex.test(frontMatter)) {
        return false; // 已经是正确格式
      }

      console.log('   ⚠️  未找到 Arch-Refs 字段');
      return false;
    }

    const archRefsContent = match[1];
    const slugs = [];
    const slugRegex = /\s*-\s*"([^"]+)"/g;
    let slugMatch;

    while ((slugMatch = slugRegex.exec(archRefsContent)) !== null) {
      slugs.push(slugMatch[1]);
    }

    if (slugs.length === 0) {
      return false;
    }

    // 转换为 CH 代码格式
    const chCodes = slugs
      .map(slug => this.archRefsMapping[slug])
      .filter(Boolean);

    if (chCodes.length === 0) {
      issues.push('Arch-Refs 包含未识别的 slug 格式');
      return false;
    }

    const newArchRefsValue = `[${chCodes.join(', ')}]`;
    const newFrontMatter = frontMatter.replace(
      archRefsRegex,
      `Arch-Refs: ${newArchRefsValue}\n`
    );

    // 正确更新 frontMatter 引用
    if (Array.isArray(frontMatterRef)) {
      frontMatterRef[0] = newFrontMatter;
    } else {
      return newFrontMatter; // 返回修改后的内容
    }

    issues.push(
      `Arch-Refs 格式修复: ${slugs.length} 个 slug -> ${chCodes.length} 个 CH 代码`
    );
    return true;
  }

  /**
   * 修复 CloudEvents 1.0 合规性问题
   */
  fixCloudEvents(frontMatterRef, filename, issues) {
    const frontMatter = frontMatterRef[0] || frontMatterRef;

    // 匹配 events 部分
    const eventsRegex =
      /(\s+)events:\s*\n(\s+specversion:\s*"1\.0"\s*\n)(\s+type:\s*"[^"]+"\s*\n)(\s+source:\s*"[^"]+"\s*\n)/;
    const match = frontMatter.match(eventsRegex);

    if (!match) {
      return false;
    }

    const [, indent, specversion, type, source] = match;

    // 检查是否已有 id 和 time 字段
    const hasId = /\s+id:\s*"[^"]+"/i.test(frontMatter);
    const hasTime = /\s+time:\s*"[^"]+"/i.test(frontMatter);

    if (hasId && hasTime) {
      return false; // 已经合规
    }

    // 生成缺失的字段
    let additionalFields = '';

    if (!hasId) {
      // 从文件名提取 chunk 编号
      const chunkMatch = filename.match(/chunk_(\d{3})/);
      const chunkNum = chunkMatch ? chunkMatch[1] : '000';
      const timestamp = Date.now().toString(36);
      const id = `guild-manager-chunk-${chunkNum}-${timestamp}`;
      additionalFields += `${indent}id: "${id}"\n`;
    }

    if (!hasTime) {
      const now = new Date().toISOString();
      additionalFields += `${indent}time: "${now}"\n`;
    }

    // 插入新字段到 specversion 之后
    const newEventsSection = specversion + additionalFields + type + source;
    const newFrontMatter = frontMatter.replace(
      eventsRegex,
      `${indent}events:\n${newEventsSection}`
    );

    if (Array.isArray(frontMatterRef)) {
      frontMatterRef[0] = newFrontMatter;
    } else {
      Object.assign(frontMatterRef, { 0: newFrontMatter });
    }

    const addedFields = [];
    if (!hasId) addedFields.push('id');
    if (!hasTime) addedFields.push('time');

    issues.push(
      `CloudEvents 1.0 合规性修复: 添加字段 ${addedFields.join(', ')}`
    );
    return true;
  }

  /**
   * 完善 Release Health 门禁配置
   */
  enhanceReleaseHealthGates(frontMatterRef, issues) {
    const frontMatter = frontMatterRef[0] || frontMatterRef;

    // 检查是否有 CRASH_FREE_99.5 在 SLO-Refs 中
    const hasCrashFreeSLO = /SLO-Refs:[\s\S]*?CRASH_FREE_99\.5/i.test(
      frontMatter
    );

    if (!hasCrashFreeSLO) {
      return false;
    }

    // 检查 Release_Gates 部分
    const gatesRegex =
      /Release_Gates:\s*\n((?:\s+\w+_Gate:[\s\S]*?(?=\n\s*\w+_Gate:|\nContract_Definitions:|\n\w|\n$))*)/;
    const match = frontMatter.match(gatesRegex);

    if (!match) {
      return false;
    }

    const gatesContent = match[1];

    // 检查是否已有 Sentry_Release_Health_Gate
    if (gatesContent.includes('Sentry_Release_Health_Gate')) {
      return false; // 已经配置
    }

    // 添加 Sentry Release Health 门禁
    const sentryGate = `  Sentry_Release_Health_Gate:
    enabled: true
    threshold: "crash_free_users >= 99.5% AND crash_free_sessions >= 99.9%"
    blockingFailures:
      - "crash_free_threshold_violation"
      - "insufficient_adoption_data" 
      - "release_health_regression"
    windowHours: 24
    params:
      sloRef: "CRASH_FREE_99.5"
      thresholds:
        crashFreeUsers: 99.5
        crashFreeSessions: 99.9
        minAdoptionPercent: 25
        durationHours: 24
`;

    const newGatesContent = gatesContent + sentryGate;
    const newFrontMatter = frontMatter.replace(
      gatesRegex,
      `Release_Gates:\n${newGatesContent}`
    );

    if (Array.isArray(frontMatterRef)) {
      frontMatterRef[0] = newFrontMatter;
    } else {
      Object.assign(frontMatterRef, { 0: newFrontMatter });
    }

    issues.push('Release Health 门禁配置完善: 添加 Sentry_Release_Health_Gate');
    return true;
  }

  /**
   * 重构文件内容
   */
  reconstructFile(frontMatter, body) {
    const fm = Array.isArray(frontMatter) ? frontMatter[0] : frontMatter;
    return `---\n${fm}---\n${body}`;
  }

  /**
   * 打印修复结果摘要
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 批量修复结果摘要');
    console.log('='.repeat(60));

    console.log(`✅ 成功修复文件: ${this.fixed.length} 个`);
    console.log(`❌ 修复失败文件: ${this.errors.length} 个`);

    if (this.fixed.length > 0) {
      console.log('\n🔧 修复详情:');
      this.fixed.forEach(({ file, issues }) => {
        console.log(`  ${file}:`);
        issues.forEach(issue => console.log(`    - ${issue}`));
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n🎉 批量修复完成!');

    if (this.errors.length > 0) {
      process.exit(1);
    }
  }
}

// 执行修复
const fixer = new PRDChunkFixer();
fixer.fixAllChunks().catch(error => {
  console.error('❌ 修复过程中发生错误:', error);
  process.exit(1);
});
