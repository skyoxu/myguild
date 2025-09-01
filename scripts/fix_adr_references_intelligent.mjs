#!/usr/bin/env node
/**
 * 智能ADR-PRD引用修复脚本
 * 基于内容驱动的关键词权重映射系统
 * 符合CLAUDE.md治理规则：每个PRD必须引用≥1条Accepted ADR
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ADR映射规则配置
 * 基于thinkdeep分析得出的内容驱动策略
 */
const ADR_MAPPING_RULES = {
  'ADR-0007': {
    name: '端口-适配器模式',
    keywords: [
      'contract',
      'interface',
      'repository',
      'storage',
      'API',
      'validation_rules',
      'ports',
      'adapters',
      'src/shared/contracts',
    ],
    weight: 0.6,
    threshold: 0.4,
    description: 'Data contracts, repository patterns, hexagonal architecture',
  },
  'ADR-0008': {
    name: '部署与发布策略',
    keywords: [
      'Release_Gates',
      'monitoring',
      'SLO',
      'deployment',
      'performance',
      'Quality_Gate',
      'Security_Gate',
      'Performance_Gate',
    ],
    weight: 0.5,
    threshold: 0.4,
    description: 'Release gates, monitoring, deployment strategies',
  },
  'ADR-0009': {
    name: '跨平台适配策略',
    keywords: [
      'user-experience',
      'UI',
      'ActionType',
      'component',
      'interaction',
      'interface',
      'navigation',
      'UX',
    ],
    weight: 0.6,
    threshold: 0.4,
    description: 'Cross-platform UI adaptation, user experience',
  },
};

/**
 * YAML Front-Matter解析器（UTF-8安全）
 */
class SafeYAMLParser {
  /**
   * 解析PRD文件的Front-Matter
   * @param {string} filePath - PRD文件路径
   * @returns {Object} 包含frontMatter和content的对象
   */
  static parsePRDFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // 寻找YAML Front-Matter边界
      let frontMatterStart = -1;
      let frontMatterEnd = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') {
          if (frontMatterStart === -1) {
            frontMatterStart = i;
          } else {
            frontMatterEnd = i;
            break;
          }
        }
      }

      if (frontMatterStart === -1 || frontMatterEnd === -1) {
        throw new Error(`Invalid YAML Front-Matter format in ${filePath}`);
      }

      const frontMatterLines = lines.slice(
        frontMatterStart + 1,
        frontMatterEnd
      );
      const contentLines = lines.slice(frontMatterEnd + 1);

      // 解析Front-Matter到简单键值对
      const frontMatter = this.parseSimpleYAML(frontMatterLines);

      return {
        frontMatter,
        content: contentLines.join('\n'),
        originalLines: lines,
        frontMatterStart,
        frontMatterEnd,
      };
    } catch (error) {
      console.error(`❌ Error parsing ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * 简单YAML解析（仅支持基本键值对和数组）
   * @param {string[]} lines - YAML行数组
   * @returns {Object} 解析后的对象
   */
  static parseSimpleYAML(lines) {
    const result = {};
    let currentKey = null;
    let arrayItems = [];
    let inArray = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 处理数组项
      if (trimmed.startsWith('- ')) {
        if (inArray) {
          arrayItems.push(
            trimmed
              .substring(2)
              .trim()
              .replace(/^"(.*)"$/, '$1')
          );
        }
        continue;
      }

      // 处理键值对
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        // 保存上一个数组
        if (inArray && currentKey) {
          result[currentKey] = arrayItems;
          arrayItems = [];
          inArray = false;
        }

        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (value === '') {
          // 空值可能是数组开始
          currentKey = key;
          inArray = true;
          arrayItems = [];
        } else {
          // 直接赋值
          result[key] = value.replace(/^"(.*)"$/, '$1');
          currentKey = null;
          inArray = false;
        }
      }
    }

    // 处理最后一个数组
    if (inArray && currentKey) {
      result[currentKey] = arrayItems;
    }

    return result;
  }

  /**
   * 安全写回PRD文件
   * @param {string} filePath - 文件路径
   * @param {Object} parsedData - 解析的数据
   * @param {Object} updatedFrontMatter - 更新的Front-Matter
   */
  static writePRDFile(filePath, parsedData, updatedFrontMatter) {
    try {
      const { originalLines, frontMatterStart, frontMatterEnd } = parsedData;

      // 重构Front-Matter部分
      const newFrontMatterLines = this.serializeYAML(updatedFrontMatter);

      // 组合新文件内容
      const newLines = [
        ...originalLines.slice(0, frontMatterStart + 1),
        ...newFrontMatterLines,
        ...originalLines.slice(frontMatterEnd),
      ];

      // 写入文件（UTF-8安全）
      writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      console.log(`✅ Successfully updated ${filePath}`);
    } catch (error) {
      console.error(`❌ Error writing ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * 将对象序列化为YAML格式
   * @param {Object} obj - 要序列化的对象
   * @returns {string[]} YAML行数组
   */
  static serializeYAML(obj) {
    const lines = [];

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${item}"`);
        }
      } else {
        lines.push(`${key}: "${value}"`);
      }
    }

    return lines;
  }
}

/**
 * 内容分析引擎
 */
class ContentAnalysisEngine {
  /**
   * 分析PRD内容并计算ADR匹配权重
   * @param {string} content - PRD文件内容
   * @returns {Object} ADR匹配分数
   */
  static analyzeContent(content) {
    const contentLower = content.toLowerCase();
    const scores = {};

    for (const [adrId, rule] of Object.entries(ADR_MAPPING_RULES)) {
      let score = 0;
      let hitCount = 0;

      // 计算关键词匹配得分
      for (const keyword of rule.keywords) {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(
          `\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'gi'
        );
        const matches = (content.match(regex) || []).length;

        if (matches > 0) {
          hitCount++;
          // 权重计算：基础分数 + 频率加成
          score += rule.weight * (1 + Math.log(matches));
        }
      }

      // 归一化得分
      const normalizedScore =
        rule.keywords.length > 0 ? score / rule.keywords.length : 0;

      scores[adrId] = {
        score: normalizedScore,
        hitCount,
        totalKeywords: rule.keywords.length,
        hits: hitCount / rule.keywords.length,
        shouldReference: normalizedScore >= rule.threshold,
      };
    }

    return scores;
  }

  /**
   * 生成内容分析报告
   * @param {string} prdId - PRD ID
   * @param {Object} scores - 分析得分
   * @returns {string} 格式化报告
   */
  static generateAnalysisReport(prdId, scores) {
    const lines = [`\n📊 Content Analysis Report for ${prdId}:`];

    for (const [adrId, result] of Object.entries(scores)) {
      const rule = ADR_MAPPING_RULES[adrId];
      const status = result.shouldReference ? '✅ SHOULD_REF' : '⚪ SKIP';

      lines.push(
        `  ${status} ${adrId} (${rule.name})`,
        `    Score: ${result.score.toFixed(3)} | Threshold: ${rule.threshold}`,
        `    Keywords Hit: ${result.hitCount}/${result.totalKeywords} (${(result.hits * 100).toFixed(1)}%)`
      );
    }

    return lines.join('\n');
  }
}

/**
 * ADR引用修复器
 */
class ADRReferenceFixer {
  /**
   * 修复单个PRD文件的ADR引用
   * @param {string} filePath - PRD文件路径
   * @returns {Object} 修复结果
   */
  static async fixPRDReferences(filePath) {
    try {
      console.log(`\n🔍 Processing ${filePath}`);

      // 解析PRD文件
      const parsedData = SafeYAMLParser.parsePRDFile(filePath);
      const { frontMatter, content } = parsedData;

      // 内容分析
      const analysisScores = ContentAnalysisEngine.analyzeContent(content);

      // 生成分析报告
      const report = ContentAnalysisEngine.generateAnalysisReport(
        frontMatter['PRD-ID'] || 'UNKNOWN',
        analysisScores
      );
      console.log(report);

      // 确定需要添加的ADR引用
      const currentADRs = frontMatter.ADRs || [];
      const additionalADRs = [];

      for (const [adrId, result] of Object.entries(analysisScores)) {
        if (result.shouldReference && !currentADRs.includes(adrId)) {
          additionalADRs.push(adrId);
        }
      }

      if (additionalADRs.length === 0) {
        console.log(
          `✅ No ADR references need to be added to ${frontMatter['PRD-ID']}`
        );
        return { success: true, added: [], skipped: currentADRs.length };
      }

      // 更新ADR列表
      const updatedADRs = [...currentADRs, ...additionalADRs].sort();
      const updatedFrontMatter = {
        ...frontMatter,
        ADRs: updatedADRs,
        Updated: new Date().toISOString(),
      };

      // 写回文件
      SafeYAMLParser.writePRDFile(filePath, parsedData, updatedFrontMatter);

      console.log(`✅ Added ADR references: ${additionalADRs.join(', ')}`);
      console.log(
        `📋 Total ADRs now: ${updatedADRs.length} (${updatedADRs.join(', ')})`
      );

      return {
        success: true,
        added: additionalADRs,
        total: updatedADRs.length,
        prdId: frontMatter['PRD-ID'],
      };
    } catch (error) {
      console.error(`❌ Failed to process ${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量处理PRD文件
   * @param {string[]} filePaths - PRD文件路径数组
   * @returns {Object} 批量处理结果
   */
  static async batchFixReferences(filePaths) {
    console.log(
      `\n🚀 Starting batch ADR reference fix for ${filePaths.length} files\n`
    );

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalAdded: 0,
      errors: [],
    };

    for (const filePath of filePaths) {
      results.processed++;

      const result = await this.fixPRDReferences(filePath);

      if (result.success) {
        results.successful++;
        results.totalAdded += result.added ? result.added.length : 0;
      } else {
        results.failed++;
        results.errors.push({ file: filePath, error: result.error });
      }

      // 短暂延迟防止文件系统过载
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

/**
 * 主执行函数
 */
async function main() {
  console.log('🎯 智能ADR-PRD引用修复脚本');
  console.log('📋 基于内容驱动的关键词权重映射系统\n');

  try {
    // 获取所有PRD chunk文件
    const prdDir = join(__dirname, '..', 'docs', 'prd_chunks');

    if (!existsSync(prdDir)) {
      throw new Error(`PRD directory not found: ${prdDir}`);
    }

    // 动态扫描所有PRD chunk文件
    const prdFiles = [];
    for (let i = 1; i <= 24; i++) {
      const filename = `PRD-Guild-Manager_chunk_${i.toString().padStart(3, '0')}.md`;
      prdFiles.push(join(prdDir, filename));
    }

    // 过滤存在的文件
    const existingFiles = prdFiles.filter(existsSync);

    if (existingFiles.length === 0) {
      throw new Error('No PRD files found to process');
    }

    console.log(`📁 Found ${existingFiles.length} PRD files to process`);

    // 批量处理
    const results = await ADRReferenceFixer.batchFixReferences(existingFiles);

    // 输出结果摘要
    console.log('\n📊 批量处理结果摘要:');
    console.log(`  处理文件总数: ${results.processed}`);
    console.log(`  成功处理: ${results.successful}`);
    console.log(`  处理失败: ${results.failed}`);
    console.log(`  新增ADR引用总数: ${results.totalAdded}`);

    if (results.errors.length > 0) {
      console.log('\n❌ 处理错误:');
      results.errors.forEach(({ file, error }) => {
        console.log(`  ${file}: ${error}`);
      });
    }

    console.log('\n✅ ADR引用修复完成！');
  } catch (error) {
    console.error('\n❌ 脚本执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本 - 跨平台兼容
if (process.argv[1] === __filename) {
  main();
}

export {
  ADRReferenceFixer,
  ContentAnalysisEngine,
  SafeYAMLParser,
  ADR_MAPPING_RULES,
};
