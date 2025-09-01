#!/usr/bin/env node

/**
 * 智能ADR-PRD引用修复脚本
 * 基于内容驱动的关键词权重矩阵，智能修复PRD chunks中缺失的ADR引用
 *
 * 功能特性：
 * - UTF-8安全的YAML解析和更新
 * - 内容驱动的ADR映射（避免"一刀切"模板）
 * - 增量式处理，支持回滚
 * - 完整的质量验证
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRD_CHUNKS_DIR = path.join(PROJECT_ROOT, 'docs', 'prd_chunks');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// ADR映射规则配置（基于深度分析结果）
const ADR_MAPPING_RULES = {
  'ADR-0007': {
    name: '端口-适配器模式与存储抽象层设计',
    keywords: [
      'contract',
      'interface',
      'repository',
      'storage',
      'API',
      'validation_rules',
      'Contract_Definitions',
      'dataschema',
      'ports',
      'adapters',
      'abstraction',
      'persistence',
    ],
    weight: 0.6,
    threshold: 0.4,
    description: '涉及数据访问、契约定义、存储抽象的内容',
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
      'Acceptance_Gate',
      'windowHours',
      'threshold',
      'blockingFailures',
    ],
    weight: 0.5,
    threshold: 0.4,
    description: '涉及发布门禁、监控、性能要求的内容',
  },
  'ADR-0009': {
    name: '多平台适配策略',
    keywords: [
      'user-experience',
      'UI',
      'ActionType',
      'component',
      'interaction',
      'interface',
      'navigation',
      'usability',
      'responsive',
      'accessibility',
      'cross-platform',
      'adaptation',
    ],
    weight: 0.6,
    threshold: 0.4,
    description: '涉及用户界面、交互体验、跨平台适配的内容',
  },
};

// 日志工具类
class Logger {
  constructor() {
    this.logFile = path.join(
      LOGS_DIR,
      `adr-fix-${new Date().toISOString().split('T')[0]}.log`
    );
  }

  async init() {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }

  async log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // 控制台输出
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }

    // 文件输出
    await fs.appendFile(this.logFile, logLine, 'utf8');
  }

  async info(message, data) {
    await this.log('info', message, data);
  }
  async warn(message, data) {
    await this.log('warn', message, data);
  }
  async error(message, data) {
    await this.log('error', message, data);
  }
  async debug(message, data) {
    await this.log('debug', message, data);
  }
}

// 内容分析引擎
class ContentAnalyzer {
  /**
   * 分析PRD内容并计算ADR相关性得分
   * @param {string} content - PRD文件内容
   * @returns {Object} ADR相关性得分映射
   */
  analyzeContent(content) {
    const scores = {};
    const contentLower = content.toLowerCase();

    for (const [adrId, rule] of Object.entries(ADR_MAPPING_RULES)) {
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of rule.keywords) {
        const keywordLower = keyword.toLowerCase();
        // 计算关键词出现频次，使用词边界匹配
        const regex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
        const matches = content.match(regex) || [];

        if (matches.length > 0) {
          // 频次加权：基础权重 + log(频次) * 0.1
          const frequency = matches.length;
          const keywordScore = rule.weight + Math.log(frequency + 1) * 0.1;
          score += keywordScore;
          matchedKeywords.push({
            keyword,
            frequency,
            score: keywordScore,
          });
        }
      }

      // 标准化得分
      const normalizedScore = Math.min(score / rule.keywords.length, 1.0);

      scores[adrId] = {
        score: normalizedScore,
        threshold: rule.threshold,
        shouldInclude: normalizedScore >= rule.threshold,
        matchedKeywords,
        rule: rule.name,
      };
    }

    return scores;
  }
}

// YAML前置信息解析器（UTF-8安全）
class YamlFrontMatterParser {
  /**
   * 解析YAML前置信息（支持YAML列表格式）
   * @param {string} content - 文件内容
   * @returns {Object} 解析结果 {frontMatter, body, rawFrontMatter}
   */
  parse(content) {
    const lines = content.split('\n');

    if (lines[0] !== '---') {
      throw new Error('Missing YAML front-matter start marker');
    }

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      throw new Error('Missing YAML front-matter end marker');
    }

    const yamlLines = lines.slice(1, endIndex);
    const bodyLines = lines.slice(endIndex + 1);

    // 解析YAML（支持列表和键值对格式）
    const frontMatter = {};
    const rawFrontMatter = yamlLines.join('\n');

    let i = 0;
    while (i < yamlLines.length) {
      const line = yamlLines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        // 检查是否是列表字段
        const isListField = [
          'ADRs',
          'Arch-Refs',
          'Test-Refs',
          'Monitors',
          'SLO-Refs',
          'Depends-On',
        ].includes(key);

        if (isListField) {
          const listItems = [];

          if (value.startsWith('[') && value.endsWith(']')) {
            // 方括号格式 ["item1", "item2"]
            const items = value
              .slice(1, -1)
              .split(',')
              .map(item => item.trim().replace(/^["']|["']$/g, ''))
              .filter(item => item.length > 0);
            listItems.push(...items);
          } else if (value === '') {
            // 空值，检查后续行是否有列表项
            i++;
            while (i < yamlLines.length) {
              const nextLine = yamlLines[i];
              const nextTrimmed = nextLine.trim();

              // 如果是列表项（以 - 开始）
              if (nextTrimmed.startsWith('- ')) {
                const itemValue = nextTrimmed
                  .substring(2)
                  .trim()
                  .replace(/^["']|["']$/g, '');
                listItems.push(itemValue);
                i++;
              } else if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
                // 空行或注释，继续
                i++;
              } else {
                // 遇到下一个字段，退出列表解析
                i--; // 回退一行，因为外层循环会递增
                break;
              }
            }
          }

          frontMatter[key] = listItems;
        } else {
          frontMatter[key] = value.replace(/^["']|["']$/g, '');
        }
      }

      i++;
    }

    return {
      frontMatter,
      body: bodyLines.join('\n'),
      rawFrontMatter,
      yamlLines,
    };
  }

  /**
   * 更新ADRs字段并重构YAML前置信息（支持YAML列表格式）
   * @param {Array} yamlLines - 原始YAML行
   * @param {Array} newAdrs - 新的ADR列表
   * @returns {string} 更新后的YAML前置信息
   */
  updateAdrs(yamlLines, newAdrs) {
    const updatedLines = [];
    let adrsUpdated = false;
    let i = 0;

    while (i < yamlLines.length) {
      const line = yamlLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('ADRs:')) {
        // 找到ADRs字段，替换整个ADRs部分
        const indentation = line.length - line.trimStart().length;
        const indentStr = ' '.repeat(indentation);
        const itemIndentStr = indentStr + '  ';

        // 添加ADRs字段头
        updatedLines.push(`${indentStr}ADRs:`);

        // 添加所有ADR项（使用YAML列表格式）
        for (const adr of newAdrs.sort()) {
          updatedLines.push(`${itemIndentStr}- "${adr}"`);
        }

        // 跳过原有的ADR列表项
        i++;
        while (i < yamlLines.length) {
          const nextLine = yamlLines[i];
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed.startsWith('- ') && nextTrimmed.includes('ADR-')) {
            // 跳过原有的ADR项
            i++;
          } else if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
            // 跳过空行和注释
            i++;
          } else {
            // 遇到下一个字段，停止跳过
            break;
          }
        }

        adrsUpdated = true;
        continue; // 不要递增i，因为已经在内层循环处理了
      } else {
        updatedLines.push(line);
      }

      i++;
    }

    // 如果没有找到ADRs字段，在适当位置添加
    if (!adrsUpdated) {
      // 查找插入位置（通常在某些字段之后）
      let insertIndex = -1;
      for (let j = 0; j < updatedLines.length; j++) {
        const trimmed = updatedLines[j].trim();
        if (
          trimmed.startsWith('Priority:') ||
          trimmed.startsWith('Risk:') ||
          trimmed.startsWith('Depends-On:')
        ) {
          // 找到Depends-On列表的结尾
          if (trimmed.startsWith('Depends-On:')) {
            let k = j + 1;
            while (k < updatedLines.length) {
              const nextTrimmed = updatedLines[k].trim();
              if (
                nextTrimmed.startsWith('- ') ||
                nextTrimmed === '' ||
                nextTrimmed.startsWith('#')
              ) {
                k++;
              } else {
                break;
              }
            }
            insertIndex = k;
          } else {
            insertIndex = j + 1;
          }
        }
      }

      if (insertIndex === -1) insertIndex = updatedLines.length;

      // 插入ADRs字段
      const insertLines = ['ADRs:'];
      for (const adr of newAdrs.sort()) {
        insertLines.push(`  - "${adr}"`);
      }

      updatedLines.splice(insertIndex, 0, ...insertLines);
    }

    return updatedLines.join('\n');
  }

  /**
   * 重构完整文件内容
   * @param {string} originalContent - 原始文件内容
   * @param {Array} newAdrs - 新的ADR列表
   * @returns {string} 更新后的文件内容
   */
  rebuildContent(originalContent, newAdrs) {
    const parsed = this.parse(originalContent);
    const updatedYaml = this.updateAdrs(parsed.yamlLines, newAdrs);

    return '---\n' + updatedYaml + '\n---\n' + parsed.body;
  }
}

// 主处理类
class AdrReferencesFixer {
  constructor() {
    this.logger = new Logger();
    this.analyzer = new ContentAnalyzer();
    this.yamlParser = new YamlFrontMatterParser();
    this.processedFiles = [];
    this.errors = [];
  }

  async init() {
    await this.logger.init();
    await this.logger.info('ADR引用修复脚本启动', {
      projectRoot: PROJECT_ROOT,
      prdChunksDir: PRD_CHUNKS_DIR,
      mappingRules: Object.keys(ADR_MAPPING_RULES),
    });
  }

  /**
   * 获取所有PRD chunk文件
   */
  async getPrdFiles() {
    try {
      const files = await fs.readdir(PRD_CHUNKS_DIR);
      const prdFiles = files
        .filter(
          file =>
            file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
        )
        .sort();

      await this.logger.info(`发现PRD文件`, {
        count: prdFiles.length,
        files: prdFiles,
      });
      return prdFiles.map(file => path.join(PRD_CHUNKS_DIR, file));
    } catch (error) {
      await this.logger.error('读取PRD目录失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 处理单个PRD文件
   */
  async processPrdFile(filePath) {
    try {
      const fileName = path.basename(filePath);
      await this.logger.info(`处理文件: ${fileName}`);

      // 读取文件内容（UTF-8安全）
      const content = await fs.readFile(filePath, 'utf8');

      // 解析YAML前置信息
      const parsed = this.yamlParser.parse(content);
      const currentAdrs = parsed.frontMatter.ADRs || [];

      await this.logger.debug(`当前ADRs`, { file: fileName, currentAdrs });

      // 分析内容相关性
      const scores = this.analyzer.analyzeContent(content);
      await this.logger.debug(`内容分析结果`, { file: fileName, scores });

      // 确定需要添加的ADRs
      const recommendedAdrs = [];
      for (const [adrId, analysis] of Object.entries(scores)) {
        if (analysis.shouldInclude && !currentAdrs.includes(adrId)) {
          recommendedAdrs.push(adrId);
          await this.logger.info(`推荐添加ADR`, {
            file: fileName,
            adr: adrId,
            score: analysis.score.toFixed(3),
            threshold: analysis.threshold,
            rule: analysis.rule,
            matchedKeywords: analysis.matchedKeywords.length,
          });
        }
      }

      // 如果有推荐的ADRs，更新文件
      if (recommendedAdrs.length > 0) {
        const allAdrs = [...currentAdrs, ...recommendedAdrs].sort();
        const updatedContent = this.yamlParser.rebuildContent(content, allAdrs);

        // 创建备份
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, content, 'utf8');

        // 写入更新后的内容
        await fs.writeFile(filePath, updatedContent, 'utf8');

        this.processedFiles.push({
          file: fileName,
          backupPath,
          addedAdrs: recommendedAdrs,
          totalAdrs: allAdrs.length,
        });

        await this.logger.info(`文件更新成功`, {
          file: fileName,
          addedAdrs: recommendedAdrs,
          totalAdrs: allAdrs.length,
          backupPath,
        });
      } else {
        await this.logger.info(`文件无需更新`, { file: fileName });
      }
    } catch (error) {
      this.errors.push({ file: path.basename(filePath), error: error.message });
      await this.logger.error(`处理文件失败: ${path.basename(filePath)}`, {
        error: error.message,
      });
    }
  }

  /**
   * 批量处理所有PRD文件
   */
  async processAllFiles() {
    const prdFiles = await this.getPrdFiles();

    await this.logger.info('开始批量处理PRD文件', {
      totalFiles: prdFiles.length,
    });

    for (const filePath of prdFiles) {
      await this.processPrdFile(filePath);
    }

    // 生成处理报告
    await this.generateReport();
  }

  /**
   * 生成处理报告
   */
  async generateReport() {
    const report = {
      processedAt: new Date().toISOString(),
      totalFiles: this.processedFiles.length + this.errors.length,
      successCount: this.processedFiles.length,
      errorCount: this.errors.length,
      processedFiles: this.processedFiles,
      errors: this.errors,
      mappingRulesUsed: ADR_MAPPING_RULES,
    };

    const reportPath = path.join(
      LOGS_DIR,
      `adr-fix-report-${new Date().toISOString().split('T')[0]}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    await this.logger.info('处理完成，生成报告', {
      reportPath,
      summary: {
        total: report.totalFiles,
        success: report.successCount,
        errors: report.errorCount,
        totalAdrsAdded: this.processedFiles.reduce(
          (sum, file) => sum + file.addedAdrs.length,
          0
        ),
      },
    });

    // 控制台总结
    console.log('\n=== ADR引用修复完成 ===');
    console.log(`处理文件总数: ${report.totalFiles}`);
    console.log(`成功处理: ${report.successCount}`);
    console.log(`失败文件: ${report.errorCount}`);
    console.log(
      `新增ADR引用总数: ${this.processedFiles.reduce((sum, file) => sum + file.addedAdrs.length, 0)}`
    );
    console.log(`详细报告: ${reportPath}`);

    if (this.errors.length > 0) {
      console.log('\n失败文件:');
      this.errors.forEach(error =>
        console.log(`  - ${error.file}: ${error.error}`)
      );
    }
  }

  /**
   * 测试模式：处理单个文件进行验证
   */
  async testSingleFile(fileName) {
    const filePath = path.join(PRD_CHUNKS_DIR, fileName);
    await this.logger.info(`测试模式：处理单个文件`, { fileName });

    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      throw new Error(`文件不存在: ${fileName}`);
    }

    await this.processPrdFile(filePath);
    await this.generateReport();
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const fixer = new AdrReferencesFixer();

  try {
    await fixer.init();

    if (args.length > 0 && args[0] === '--test') {
      // 测试模式
      const testFile = args[1] || 'PRD-Guild-Manager_chunk_012.md';
      await fixer.testSingleFile(testFile);
    } else {
      // 批量处理模式
      await fixer.processAllFiles();
    }

    process.exit(0);
  } catch (error) {
    console.error('脚本执行失败:', error.message);
    await fixer.logger?.error('脚本执行失败', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// 如果直接运行此文件
if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').includes('fix_adr_references.mjs')
) {
  main();
}

export default AdrReferencesFixer;
