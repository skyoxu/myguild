#!/usr/bin/env node

/**
 * ADR引用修复质量验证脚本
 * 验证所有PRD chunks是否正确包含必需的ADR引用
 * 检查YAML格式完整性和内容质量
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRD_CHUNKS_DIR = path.join(PROJECT_ROOT, 'docs', 'prd_chunks');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// 期望的ADR引用（根据CLAUDE.md要求）
const REQUIRED_ADRS = [
  'ADR-0001-tech-stack', // 技术栈
  'ADR-0003-observability', // 可观测性（部分文件有）
  'ADR-0004-event-bus-and-contracts', // 事件总线（部分文件有）
  'ADR-0005-quality-gates', // 质量门禁
  'ADR-0006-data-storage-architecture', // 数据存储（部分文件有）
  'ADR-0008', // 部署与发布策略（新增）
];

// 质量验证器
class QualityVerifier {
  constructor() {
    this.results = {
      totalFiles: 0,
      passedFiles: 0,
      failedFiles: 0,
      issues: [],
      summary: {},
    };
  }

  async init() {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }

  /**
   * 解析YAML前置信息
   */
  parseYamlFrontMatter(content) {
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
    const frontMatter = { ADRs: [] };

    let i = 0;
    while (i < yamlLines.length) {
      const line = yamlLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('ADRs:')) {
        i++;
        while (i < yamlLines.length) {
          const nextLine = yamlLines[i];
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed.startsWith('- ')) {
            const adrValue = nextTrimmed
              .substring(2)
              .trim()
              .replace(/^["']|["']$/g, '');
            frontMatter.ADRs.push(adrValue);
            i++;
          } else if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
            i++;
          } else {
            break;
          }
        }
        break;
      }

      i++;
    }

    return frontMatter;
  }

  /**
   * 验证单个PRD文件
   */
  async verifyPrdFile(filePath) {
    const fileName = path.basename(filePath);
    const issues = [];

    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf8');

      // 解析YAML前置信息
      const frontMatter = this.parseYamlFrontMatter(content);
      const currentAdrs = frontMatter.ADRs || [];

      // 验证ADR-0008是否存在
      const hasAdr008 = currentAdrs.includes('ADR-0008');
      if (!hasAdr008) {
        issues.push({
          type: 'missing_adr',
          severity: 'high',
          message: '缺少必需的ADR-0008引用',
        });
      }

      // 验证基础ADR是否存在
      const hasAdr001 = currentAdrs.includes('ADR-0001-tech-stack');
      const hasAdr005 = currentAdrs.includes('ADR-0005-quality-gates');

      if (!hasAdr001) {
        issues.push({
          type: 'missing_basic_adr',
          severity: 'high',
          message: '缺少基础ADR-0001-tech-stack引用',
        });
      }

      if (!hasAdr005) {
        issues.push({
          type: 'missing_basic_adr',
          severity: 'medium',
          message: '缺少ADR-0005-quality-gates引用',
        });
      }

      // 验证ADR格式
      for (const adr of currentAdrs) {
        if (!adr.startsWith('ADR-')) {
          issues.push({
            type: 'invalid_adr_format',
            severity: 'medium',
            message: `无效的ADR格式: ${adr}`,
          });
        }
      }

      // 验证YAML结构完整性
      if (!content.includes('Release_Gates:')) {
        issues.push({
          type: 'missing_release_gates',
          severity: 'low',
          message: '文件似乎缺少Release_Gates结构（可能影响ADR-0008的相关性）',
        });
      }

      return {
        file: fileName,
        passed: issues.length === 0,
        currentAdrs,
        adrCount: currentAdrs.length,
        hasRequiredAdr008: hasAdr008,
        issues,
      };
    } catch (error) {
      return {
        file: fileName,
        passed: false,
        currentAdrs: [],
        adrCount: 0,
        hasRequiredAdr008: false,
        issues: [
          {
            type: 'parse_error',
            severity: 'critical',
            message: `解析文件失败: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * 验证所有PRD文件
   */
  async verifyAllFiles() {
    console.log('🔍 开始ADR引用修复质量验证...\n');

    // 获取所有PRD文件
    const files = await fs.readdir(PRD_CHUNKS_DIR);
    const prdFiles = files
      .filter(
        file =>
          file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
      )
      .sort();

    this.results.totalFiles = prdFiles.length;
    console.log(`📁 发现${prdFiles.length}个PRD文件\n`);

    // 验证每个文件
    const fileResults = [];
    for (const fileName of prdFiles) {
      const filePath = path.join(PRD_CHUNKS_DIR, fileName);
      const result = await this.verifyPrdFile(filePath);
      fileResults.push(result);

      if (result.passed) {
        this.results.passedFiles++;
        console.log(`✅ ${result.file} - 通过验证 (${result.adrCount}个ADR)`);
      } else {
        this.results.failedFiles++;
        console.log(`❌ ${result.file} - 验证失败`);
        for (const issue of result.issues) {
          console.log(
            `   ${this.getSeverityIcon(issue.severity)} ${issue.message}`
          );
        }
      }
    }

    // 生成统计报告
    await this.generateReport(fileResults);

    // 输出总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 验证结果总结:');
    console.log(`   总文件数: ${this.results.totalFiles}`);
    console.log(`   通过验证: ${this.results.passedFiles}`);
    console.log(`   验证失败: ${this.results.failedFiles}`);
    console.log(
      `   成功率: ${((this.results.passedFiles / this.results.totalFiles) * 100).toFixed(1)}%`
    );

    const hasAdr008Count = fileResults.filter(r => r.hasRequiredAdr008).length;
    console.log(
      `   包含ADR-0008: ${hasAdr008Count}/${this.results.totalFiles} (${((hasAdr008Count / this.results.totalFiles) * 100).toFixed(1)}%)`
    );

    if (this.results.failedFiles === 0) {
      console.log('\n🎉 所有PRD文件都通过了质量验证！');
    } else {
      console.log(`\n⚠️  有${this.results.failedFiles}个文件需要进一步检查`);
    }

    return this.results;
  }

  /**
   * 生成详细报告
   */
  async generateReport(fileResults) {
    const report = {
      verificationAt: new Date().toISOString(),
      summary: {
        totalFiles: this.results.totalFiles,
        passedFiles: this.results.passedFiles,
        failedFiles: this.results.failedFiles,
        successRate:
          ((this.results.passedFiles / this.results.totalFiles) * 100).toFixed(
            1
          ) + '%',
      },
      adrDistribution: {
        'ADR-0008': fileResults.filter(r => r.currentAdrs.includes('ADR-0008'))
          .length,
        'ADR-0001-tech-stack': fileResults.filter(r =>
          r.currentAdrs.includes('ADR-0001-tech-stack')
        ).length,
        'ADR-0005-quality-gates': fileResults.filter(r =>
          r.currentAdrs.includes('ADR-0005-quality-gates')
        ).length,
      },
      fileResults,
      issues: fileResults
        .filter(r => !r.passed)
        .map(r => ({
          file: r.file,
          issues: r.issues,
        })),
    };

    const reportPath = path.join(
      LOGS_DIR,
      `adr-verification-report-${new Date().toISOString().split('T')[0]}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\n📄 详细报告已生成: ${reportPath}`);

    this.results.summary = report;
  }

  /**
   * 获取严重程度图标
   */
  getSeverityIcon(severity) {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
    };
    return icons[severity] || '⚪';
  }
}

// 主函数
async function main() {
  const verifier = new QualityVerifier();

  try {
    await verifier.init();
    const results = await verifier.verifyAllFiles();

    // 根据结果设置退出码
    process.exit(results.failedFiles === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ 验证过程失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').includes('verify_adr_fix.mjs')
) {
  main();
}

export default QualityVerifier;
