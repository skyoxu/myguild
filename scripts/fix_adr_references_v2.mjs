#!/usr/bin/env node

/**
 * ADR-PRD引用修复脚本 v2.0
 * 修复版本：降低阈值，增强关键词，确保ADR-0007和ADR-0009不被遗漏
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRD_CHUNKS_DIR = path.join(PROJECT_ROOT, 'docs', 'prd_chunks');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// 改进的ADR映射规则（降低阈值，增强关键词）
const ADR_MAPPING_RULES = {
  'ADR-0007': {
    name: '端口-适配器模式与存储抽象层设计',
    keywords: [
      // 原有关键词
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
      // 新增关键词
      'src/shared/contracts',
      '数据架构',
      '数据管理',
      '统计模块',
      'types',
      'events',
      'interfaces',
      'CrossReferenceEngine',
      'src/shared',
      'contracts',
    ],
    weight: 0.6,
    threshold: 0.25, // 从0.4降低到0.25
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
    threshold: 0.35, // 从0.4微调到0.35
    description: '涉及发布门禁、监控、性能要求的内容',
  },
  'ADR-0009': {
    name: '多平台适配策略',
    keywords: [
      // 原有关键词
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
      // 新增关键词
      '用户界面',
      '界面设计',
      '交互',
      '响应式',
      '用户体验',
      'modal',
      'layout',
      'UISpecifications',
      'NavigationBar',
      'tooltip',
      'keyboard',
      'screen',
    ],
    weight: 0.6,
    threshold: 0.2, // 进一步降低到0.2确保UI内容不被遗漏
    description: '涉及用户界面、交互体验、跨平台适配的内容',
  },
};

// 日志工具类
class Logger {
  constructor() {
    this.logFile = path.join(
      LOGS_DIR,
      `adr-fix-v2-${new Date().toISOString().split('T')[0]}.log`
    );
  }

  async init() {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }

  async log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    const logLine = JSON.stringify(logEntry) + '\n';

    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));

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

// 内容分析引擎（改进版）
class ContentAnalyzer {
  analyzeContent(content) {
    const scores = {};

    for (const [adrId, rule] of Object.entries(ADR_MAPPING_RULES)) {
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of rule.keywords) {
        let matches = [];

        if (keyword.includes('/') || keyword.includes('\\')) {
          // 路径匹配，使用简单字符串搜索
          const regex = new RegExp(keyword.replace(/[/\\]/g, '[/\\\\]'), 'gi');
          matches = content.match(regex) || [];
        } else {
          // 词边界匹配
          const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
          matches = content.match(regex) || [];
        }

        if (matches.length > 0) {
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

// YAML解析器（复用之前的代码）
class YamlFrontMatterParser {
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
    const frontMatter = {};

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
            const items = value
              .slice(1, -1)
              .split(',')
              .map(item => item.trim().replace(/^["']|["']$/g, ''))
              .filter(item => item.length > 0);
            listItems.push(...items);
          } else if (value === '') {
            i++;
            while (i < yamlLines.length) {
              const nextLine = yamlLines[i];
              const nextTrimmed = nextLine.trim();

              if (nextTrimmed.startsWith('- ')) {
                const itemValue = nextTrimmed
                  .substring(2)
                  .trim()
                  .replace(/^["']|["']$/g, '');
                listItems.push(itemValue);
                i++;
              } else if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
                i++;
              } else {
                i--;
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
      yamlLines,
    };
  }

  updateAdrs(yamlLines, newAdrs) {
    const updatedLines = [];
    let adrsUpdated = false;
    let i = 0;

    while (i < yamlLines.length) {
      const line = yamlLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('ADRs:')) {
        const indentation = line.length - line.trimStart().length;
        const indentStr = ' '.repeat(indentation);
        const itemIndentStr = indentStr + '  ';

        updatedLines.push(`${indentStr}ADRs:`);

        for (const adr of newAdrs.sort()) {
          updatedLines.push(`${itemIndentStr}- "${adr}"`);
        }

        i++;
        while (i < yamlLines.length) {
          const nextLine = yamlLines[i];
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed.startsWith('- ') && nextTrimmed.includes('ADR-')) {
            i++;
          } else if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
            i++;
          } else {
            break;
          }
        }

        adrsUpdated = true;
        continue;
      } else {
        updatedLines.push(line);
      }

      i++;
    }

    if (!adrsUpdated) {
      let insertIndex = -1;
      for (let j = 0; j < updatedLines.length; j++) {
        const trimmed = updatedLines[j].trim();
        if (
          trimmed.startsWith('Priority:') ||
          trimmed.startsWith('Risk:') ||
          trimmed.startsWith('Depends-On:')
        ) {
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

      const insertLines = ['ADRs:'];
      for (const adr of newAdrs.sort()) {
        insertLines.push(`  - "${adr}"`);
      }

      updatedLines.splice(insertIndex, 0, ...insertLines);
    }

    return updatedLines.join('\n');
  }

  rebuildContent(originalContent, newAdrs) {
    const parsed = this.parse(originalContent);
    const updatedYaml = this.updateAdrs(parsed.yamlLines, newAdrs);
    return '---\n' + updatedYaml + '\n---\n' + parsed.body;
  }
}

// 主处理类
class AdrReferencesFixerV2 {
  constructor() {
    this.logger = new Logger();
    this.analyzer = new ContentAnalyzer();
    this.yamlParser = new YamlFrontMatterParser();
    this.processedFiles = [];
    this.errors = [];
  }

  async init() {
    await this.logger.init();
    await this.logger.info('ADR引用修复脚本v2.0启动（改进阈值和关键词）', {
      projectRoot: PROJECT_ROOT,
      improvementVersion: '2.0',
      thresholdAdjustments: {
        'ADR-0007': 'threshold: 0.4 → 0.25',
        'ADR-0008': 'threshold: 0.4 → 0.35',
        'ADR-0009': 'threshold: 0.4 → 0.25',
      },
    });
  }

  async getPrdFiles() {
    try {
      const files = await fs.readdir(PRD_CHUNKS_DIR);
      const prdFiles = files
        .filter(
          file =>
            file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
        )
        .sort();

      await this.logger.info('发现PRD文件', {
        count: prdFiles.length,
        files: prdFiles,
      });
      return prdFiles.map(file => path.join(PRD_CHUNKS_DIR, file));
    } catch (error) {
      await this.logger.error('读取PRD目录失败', { error: error.message });
      throw error;
    }
  }

  async processPrdFile(filePath) {
    try {
      const fileName = path.basename(filePath);
      await this.logger.info(`处理文件: ${fileName}`);

      const content = await fs.readFile(filePath, 'utf8');
      const parsed = this.yamlParser.parse(content);
      const currentAdrs = parsed.frontMatter.ADRs || [];

      await this.logger.debug('当前ADRs', { file: fileName, currentAdrs });

      const scores = this.analyzer.analyzeContent(content);
      await this.logger.debug('内容分析结果', { file: fileName, scores });

      const recommendedAdrs = [];
      for (const [adrId, analysis] of Object.entries(scores)) {
        if (analysis.shouldInclude && !currentAdrs.includes(adrId)) {
          recommendedAdrs.push(adrId);
          await this.logger.info('推荐添加ADR', {
            file: fileName,
            adr: adrId,
            score: analysis.score.toFixed(3),
            threshold: analysis.threshold,
            rule: analysis.rule,
            matchedKeywords: analysis.matchedKeywords.length,
            version: 'v2.0',
          });
        }
      }

      if (recommendedAdrs.length > 0) {
        const allAdrs = [...currentAdrs, ...recommendedAdrs].sort();
        const updatedContent = this.yamlParser.rebuildContent(content, allAdrs);

        const backupPath = `${filePath}.backup.v2.${Date.now()}`;
        await fs.writeFile(backupPath, content, 'utf8');
        await fs.writeFile(filePath, updatedContent, 'utf8');

        this.processedFiles.push({
          file: fileName,
          backupPath,
          addedAdrs: recommendedAdrs,
          totalAdrs: allAdrs.length,
          version: 'v2.0',
        });

        await this.logger.info('文件更新成功', {
          file: fileName,
          addedAdrs: recommendedAdrs,
          totalAdrs: allAdrs.length,
          backupPath,
        });
      } else {
        await this.logger.info('文件无需更新', { file: fileName });
      }
    } catch (error) {
      this.errors.push({ file: path.basename(filePath), error: error.message });
      await this.logger.error(`处理文件失败: ${path.basename(filePath)}`, {
        error: error.message,
      });
    }
  }

  async processAllFiles() {
    const prdFiles = await this.getPrdFiles();

    await this.logger.info('开始批量处理PRD文件', {
      totalFiles: prdFiles.length,
      version: 'v2.0',
    });

    for (const filePath of prdFiles) {
      await this.processPrdFile(filePath);
    }

    await this.generateReport();
  }

  async generateReport() {
    const report = {
      processedAt: new Date().toISOString(),
      version: 'v2.0',
      improvements: {
        thresholdAdjustments: 'ADR-0007和ADR-0009阈值从0.4降至0.25',
        keywordEnhancements: '新增中文关键词和路径匹配',
        targetIssue: '修复ADR-0007和ADR-0009被误过滤的问题',
      },
      totalFiles: this.processedFiles.length + this.errors.length,
      successCount: this.processedFiles.length,
      errorCount: this.errors.length,
      processedFiles: this.processedFiles,
      errors: this.errors,
      mappingRulesUsed: ADR_MAPPING_RULES,
    };

    const reportPath = path.join(
      LOGS_DIR,
      `adr-fix-v2-report-${new Date().toISOString().split('T')[0]}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    await this.logger.info('处理完成，生成v2.0报告', {
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

    console.log('\n=== ADR引用修复v2.0完成 ===');
    console.log(`处理文件总数: ${report.totalFiles}`);
    console.log(`成功处理: ${report.successCount}`);
    console.log(`失败文件: ${report.errorCount}`);
    console.log(
      `新增ADR引用总数: ${this.processedFiles.reduce((sum, file) => sum + file.addedAdrs.length, 0)}`
    );
    console.log(`详细报告: ${reportPath}`);
  }

  async testSingleFile(fileName) {
    const filePath = path.join(PRD_CHUNKS_DIR, fileName);
    await this.logger.info('测试模式v2.0：处理单个文件', { fileName });

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

async function main() {
  const args = process.argv.slice(2);
  const fixer = new AdrReferencesFixerV2();

  try {
    await fixer.init();

    if (args.length > 0 && args[0] === '--test') {
      const testFile = args[1] || 'PRD-Guild-Manager_chunk_020.md';
      await fixer.testSingleFile(testFile);
    } else {
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

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').includes('fix_adr_references_v2.mjs')
) {
  main();
}

export default AdrReferencesFixerV2;
