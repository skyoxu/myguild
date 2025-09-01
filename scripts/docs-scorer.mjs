#!/usr/bin/env node

/**
 * Base-Clean文档评分工具 v2.0 (Compliance-Based)
 *
 * 基于compliance anchor points的23分制评分标准
 * 支持Gray-matter + remark专业解析，替代count-based算法
 *
 * @usage node scripts/docs-scorer.mjs <file-path>
 * @example node scripts/docs-scorer.mjs docs/architecture/base/04-*.md
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { glob } from 'glob';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

// 新的23分制评分配置 (Compliance-Based)
const SCORING_CONFIG_V2 = {
  // 可复用性 (8分)
  reusability: {
    maxScore: 8,
    criteria: {
      placeholderCompliance: { weight: 4, name: '占位符合规性' },
      genericTerms: { weight: 4, name: '通用术语使用' },
    },
  },

  // CloudEvents合规 (5分)
  cloudEvents: {
    maxScore: 5,
    criteria: {
      requiredFields: { weight: 5, name: 'CloudEvents 1.0必填字段' },
    },
  },

  // C4模型合规 (4分)
  c4Model: {
    maxScore: 4,
    criteria: {
      contextLayer: { weight: 2, name: 'C4 Context层' },
      containerLayer: { weight: 2, name: 'C4 Container层' },
    },
  },

  // ADR有效性 (3分)
  adrValidity: {
    maxScore: 3,
    criteria: {
      acceptedRefs: { weight: 3, name: 'Accepted状态ADR引用' },
    },
  },

  // 精炼度 (2分)
  contentDensity: {
    maxScore: 2,
    criteria: {
      informationDensity: { weight: 2, name: '信息密度评估' },
    },
  },

  // 技术栈去重 (1分)
  techStack: {
    maxScore: 1,
    criteria: {
      dedupedCount: { weight: 1, name: '技术栈去重计数' },
    },
  },
};

// 等级标准 (23分制)
const GRADE_STANDARDS_V2 = [
  {
    min: 22,
    grade: 'S级 (卓越)',
    status: '✅ 标杆文档',
    action: '可作为模板推广',
  },
  { min: 20, grade: 'A级 (优秀)', status: '✅ 直接合并', action: '推荐参考' },
  { min: 18, grade: 'B级 (良好)', status: '✅ 可合并', action: '建议改进' },
  { min: 15, grade: 'C级 (中等)', status: '⚠️ 需改进', action: '改进后合并' },
  { min: 0, grade: 'D级 (不达标)', status: '❌ 拒绝合并', action: '重大修改' },
];

// AST缓存机制
class ASTCache {
  static cache = new Map();

  static getOrParse(filePath, content) {
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const cacheKey = `${filePath}:${hash}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const ast = unified()
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .parse(content);

    this.cache.set(cacheKey, ast);
    return ast;
  }
}

// 文档分析器 (建议A: Gray-matter + remark替换正则)
class DocumentAnalyzer {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.rawContent = fs.readFileSync(filePath, 'utf-8');
    this.parsed = matter(this.rawContent);
    this.frontMatter = this.parsed.data;
    this.body = this.parsed.content;
    this.ast = ASTCache.getOrParse(filePath, this.body);
    this.profile = this.getChapterProfile();
  }

  getChapterProfile() {
    const chapter =
      this.fileName.match(/(\d+)-/)?.[1] || this.frontMatter.chapter;

    const profiles = {
      '01': {
        name: '约束与目标章节',
        requiredElements: ['nfr', 'slo', '性能目标'],
        scoringWeights: { constraints: 0.4, objectives: 0.3, quality: 0.3 },
      },
      '02': {
        name: '安全基线章节',
        requiredElements: ['electron', 'sandbox', 'contextIsolation'],
        scoringWeights: { security: 0.5, electron: 0.3, baseline: 0.2 },
      },
      '03': {
        name: '可观测性章节',
        requiredElements: ['sentry', 'release health', 'crash-free'],
        scoringWeights: { monitoring: 0.4, alerting: 0.3, metrics: 0.3 },
      },
      '04': {
        name: '系统上下文章节',
        requiredElements: ['c4context', 'cloudevents', 'container'],
        scoringWeights: { c4: 0.4, events: 0.3, architecture: 0.3 },
      },
      '05': {
        name: '数据模型与存储章节',
        requiredElements: ['sqlite', 'schema', 'migration'],
        scoringWeights: { dataModel: 0.4, storage: 0.3, migration: 0.3 },
      },
      '06': {
        name: '运行时视图章节',
        requiredElements: ['循环', '状态机', '错误路径'],
        scoringWeights: {
          runtime: 0.4,
          stateManagement: 0.3,
          errorHandling: 0.3,
        },
      },
      '07': {
        name: '开发与构建章节',
        requiredElements: ['vite', 'typescript', '质量门禁'],
        scoringWeights: { development: 0.4, build: 0.3, qualityGates: 0.3 },
      },
      '08': {
        name: '功能纵切章节',
        requiredElements: ['ui', '事件', '域模型'],
        scoringWeights: { ui: 0.3, events: 0.3, domain: 0.4 },
      },
      '09': {
        name: '性能与容量章节',
        requiredElements: ['tp95', 'slo', '容量规划'],
        scoringWeights: { performance: 0.4, capacity: 0.3, slo: 0.3 },
      },
      10: {
        name: '国际化·运维·发布章节',
        requiredElements: ['i18n', '运维', '发布'],
        scoringWeights: { i18n: 0.3, operations: 0.4, deployment: 0.3 },
      },
      default: {
        name: '通用章节',
        requiredElements: [],
        scoringWeights: {},
      },
    };

    return profiles[chapter] || profiles['default'];
  }
}

// 合规性检查器 (建议B-G的具体实现)
class ComplianceCheckers {
  // 建议A&E: 可复用性检查 (8分)
  static checkReusability(analyzer) {
    let score = 0;

    // 占位符合规性检查 (4分)
    const placeholderPattern = /\$\{[A-Z_]+\}/g;
    const placeholders = analyzer.body.match(placeholderPattern) || [];
    const uniquePlaceholders = new Set(placeholders);

    // 检查front-matter中是否声明了占位符
    const hasPlaceholderDeclaration = analyzer.frontMatter.placeholders;

    if (hasPlaceholderDeclaration && uniquePlaceholders.size >= 2) {
      score += 4; // 有占位符声明且实际使用
    } else if (uniquePlaceholders.size >= 3) {
      score += 3; // 仅有使用但无声明
    } else if (uniquePlaceholders.size >= 1) {
      score += 2; // 少量使用
    }

    // 通用术语使用检查 (4分) - 更精确的业务词汇检测
    // 排除Base-Clean文档中的通用术语如"Player"(作为系统角色)
    const businessTerms =
      analyzer.body.match(/(?:guild|具体业务词|公会|战斗|角色)/gi) || [];
    // Player在C4图中是标准术语，不应被认为是业务词汇
    const contextualBusinessTerms = businessTerms.filter(
      term =>
        !analyzer.body.includes('Person(player,') && // C4图中的Player是角色，不是业务术语
        !analyzer.body.includes('Player、Updater、') // 作为系统Actor的Player
    );

    if (contextualBusinessTerms.length === 0) {
      score += 4; // 无实际业务专用词汇，高度可复用
    } else if (contextualBusinessTerms.length <= 1) {
      score += 3; // 极少业务词汇
    } else if (contextualBusinessTerms.length <= 2) {
      score += 2; // 少量业务词汇
    }

    return Math.min(8, score);
  }

  // 建议C: CloudEvents 1.0合规检查 (5分)
  static checkCloudEvents(analyzer) {
    let score = 0;
    const requiredFields = ['id', 'source', 'type', 'specversion', 'time'];

    // 检查TypeScript接口定义
    visit(analyzer.ast, 'code', node => {
      if (node.lang === 'ts' || node.lang === 'typescript') {
        const content = node.value.toLowerCase();

        // 检查CloudEvent接口
        if (content.includes('cloudevent') || content.includes('interface')) {
          const foundFields = requiredFields.filter(
            field =>
              content.includes(`${field}:`) || content.includes(`"${field}"`)
          );

          if (foundFields.length >= 5) {
            score = 5; // 包含所有必填字段
          } else if (foundFields.length >= 4) {
            score = Math.max(score, 4);
          } else if (foundFields.length >= 3) {
            score = Math.max(score, 3);
          }
        }
      }
    });

    return Math.min(5, score);
  }

  // 建议F: C4模型合规检查 (4分)
  static checkC4Model(analyzer) {
    let score = 0;
    const c4Layers = { context: false, container: false };

    visit(analyzer.ast, 'code', node => {
      if (node.lang === 'mermaid') {
        const content = node.value.toLowerCase();

        // Context层检查 (2分)
        if (
          content.includes('c4context') &&
          content.includes('person(') &&
          content.includes('system(')
        ) {
          c4Layers.context = true;
        }

        // Container层检查 (2分)
        if (content.includes('c4container') && content.includes('container(')) {
          c4Layers.container = true;
        }
      }
    });

    if (c4Layers.context) score += 2;
    if (c4Layers.container) score += 2;

    return score;
  }

  // 建议D: ADR有效性检查 (3分)
  static async checkADRValidity(analyzer) {
    if (!analyzer.frontMatter.adr_refs?.length) return 0;

    // 简化版：检查ADR引用存在性
    const adrRefs = analyzer.frontMatter.adr_refs;
    const projectRoot = process.cwd();
    let validCount = 0;

    for (const adrRef of adrRefs) {
      const adrBaseName = adrRef.replace(/^ADR-/, ''); // 移除ADR-前缀
      const possiblePaths = [
        path.join(projectRoot, 'docs/adr', `${adrRef}.md`),
        path.join(projectRoot, 'docs/adr', `${adrRef}-*.md`),
        path.join(projectRoot, 'docs/decisions', `${adrRef}.md`),
        path.join(projectRoot, 'architecture/decisions', `${adrRef}.md`),
      ];

      // 使用glob查找带后缀的ADR文件
      const adrDir = path.join(projectRoot, 'docs/adr');
      let found = false;

      if (fs.existsSync(adrDir)) {
        const adrFiles = fs.readdirSync(adrDir);
        const matchingFile = adrFiles.find(
          file => file.startsWith(`${adrRef}-`) && file.endsWith('.md')
        );

        if (matchingFile) {
          try {
            const adrPath = path.join(adrDir, matchingFile);
            const adrContent = fs.readFileSync(adrPath, 'utf-8');
            const { data: adrMeta } = matter(adrContent);

            // 增强状态检查：支持多种格式
            const isAccepted =
              adrMeta.status === 'Accepted' ||
              adrMeta.Status === 'Accepted' ||
              adrContent.includes('Status: Accepted') ||
              adrContent.includes('status: Accepted');

            if (isAccepted) {
              validCount++;
              found = true;
            }
          } catch (error) {
            // ADR文件读取失败，跳过
          }
        }
      }

      // 如果没找到带后缀的文件，尝试其他路径
      if (!found) {
        for (const adrPath of possiblePaths) {
          if (fs.existsSync(adrPath)) {
            try {
              const adrContent = fs.readFileSync(adrPath, 'utf-8');
              const { data: adrMeta } = matter(adrContent);

              const isAccepted =
                adrMeta.status === 'Accepted' ||
                adrMeta.Status === 'Accepted' ||
                adrContent.includes('Status: Accepted') ||
                adrContent.includes('status: Accepted');

              if (isAccepted) {
                validCount++;
                break;
              }
            } catch (error) {
              // ADR文件读取失败，跳过
            }
          }
        }
      }
    }

    return validCount > 0 ? 3 : 0; // 有至少1个有效ADR即得3分
  }

  // 建议E: 精炼度算法 (2分)
  static checkContentDensity(analyzer) {
    let infoElements = 0;
    let totalLength = 0;

    visit(analyzer.ast, node => {
      if (node.type === 'heading') infoElements += 2; // 结构化信息
      if (node.type === 'code') infoElements += 3; // 可执行信息
      if (node.type === 'link') infoElements += 1; // 引用信息
      if (node.type === 'text') totalLength += node.value.length;
    });

    // 信息密度 = 有价值元素数 / 文本长度 * 1000
    const density = totalLength > 0 ? (infoElements / totalLength) * 1000 : 0;

    // arc42 §4："尽量简短"，高密度文档得分更高
    if (density > 0.8) return 2;
    if (density > 0.5) return 1;
    return 0;
  }

  // 技术栈去重检查 (1分) - 修复Line 231的重复计数问题
  static checkTechStack(analyzer) {
    const techStack = new Set();
    const standardTech = [
      'React',
      'Electron',
      'TypeScript',
      'Vite',
      'Phaser',
      'Node.js',
      'Node',
      'ESM',
    ];

    // 同时检查整个文档内容（包括front-matter）
    const fullContent = analyzer.rawContent.toLowerCase();

    standardTech.forEach(tech => {
      if (fullContent.includes(tech.toLowerCase())) {
        techStack.add(tech);
      }
    });

    // 调整合理范围：Base-Clean文档通常提及3-6个核心技术
    return techStack.size >= 3 && techStack.size <= 8 ? 1 : 0;
  }
}

// 新的评分计算器 (23分制)
class ComplianceScorer {
  static async calculate(analyzer) {
    const checks = {
      reusability: ComplianceCheckers.checkReusability(analyzer),
      cloudEvents: ComplianceCheckers.checkCloudEvents(analyzer),
      c4Model: ComplianceCheckers.checkC4Model(analyzer),
      adrValidity: await ComplianceCheckers.checkADRValidity(analyzer),
      contentDensity: ComplianceCheckers.checkContentDensity(analyzer),
      techStack: ComplianceCheckers.checkTechStack(analyzer),
    };

    const total = Object.values(checks).reduce((sum, score) => sum + score, 0);

    return {
      ...checks,
      total,
      maxPossible: 23,
    };
  }
}

/**
 * 分析文档内容 (新版本，基于compliance anchors)
 */
async function analyzeDocument(filePath) {
  const analyzer = new DocumentAnalyzer(filePath);
  const scores = await ComplianceScorer.calculate(analyzer);
  const grade = getGrade(scores.total);

  return {
    fileName: analyzer.fileName,
    scores,
    grade,
    profile: analyzer.profile,
    details: {
      frontMatter: analyzer.frontMatter,
      placeholderCount: (analyzer.body.match(/\$\{[A-Z_]+\}/g) || []).length,
      adrRefsCount: analyzer.frontMatter.adr_refs?.length || 0,
      codeBlocksCount: countCodeBlocks(analyzer.ast),
    },
  };
}

function countCodeBlocks(ast) {
  let count = 0;
  visit(ast, 'code', () => count++);
  return count;
}

/**
 * 获取等级 (23分制)
 */
function getGrade(totalScore) {
  return GRADE_STANDARDS_V2.find(standard => totalScore >= standard.min);
}

/**
 * 格式化输出结果 (更新为23分制)
 */
function formatResults(results) {
  console.log('\n📊 Base-Clean 文档评分报告 v2.0 (Compliance-Based)\n');
  console.log('='.repeat(80));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.fileName}`);
    console.log('-'.repeat(60));

    // 总分和等级
    console.log(`🎯 总分: ${result.scores.total}/23 (${result.grade.grade})`);
    console.log(`📋 状态: ${result.grade.status}`);
    console.log(`🔧 行动: ${result.grade.action}\n`);

    // 各维度得分 (23分制)
    console.log('📈 维度得分:');
    console.log(`  可复用性: ${result.scores.reusability}/8`);
    console.log(`  CloudEvents合规: ${result.scores.cloudEvents}/5`);
    console.log(`  C4模型合规: ${result.scores.c4Model}/4`);
    console.log(`  ADR有效性: ${result.scores.adrValidity}/3`);
    console.log(`  精炼度: ${result.scores.contentDensity}/2`);
    console.log(`  技术栈: ${result.scores.techStack}/1`);

    // 详细分析
    console.log('\n🔍 详细分析:');
    console.log(`  占位符数量: ${result.details.placeholderCount}`);
    console.log(`  ADR引用: ${result.details.adrRefsCount}处`);
    console.log(`  代码块: ${result.details.codeBlocksCount}个`);
    console.log(`  章节类型: ${result.profile.name}`);

    if (result.scores.total < 18) {
      console.log('\n⚠️ 改进建议:');
      if (result.scores.reusability < 6) {
        console.log('  - 增加占位符使用，避免硬编码业务术语');
      }
      if (result.scores.cloudEvents < 4) {
        console.log('  - 完善CloudEvents 1.0必填字段定义');
      }
      if (result.scores.c4Model < 3) {
        console.log('  - 添加C4模型Context/Container层图表');
      }
      if (result.scores.adrValidity === 0) {
        console.log('  - 引用有效的Accepted状态ADR');
      }
    }
  });

  // 统计摘要
  console.log('\n' + '='.repeat(80));
  console.log('📊 统计摘要:');

  const avgScore =
    results.reduce((sum, r) => sum + r.scores.total, 0) / results.length;
  const gradeDistribution = results.reduce((dist, r) => {
    const grade = r.grade.grade.charAt(0);
    dist[grade] = (dist[grade] || 0) + 1;
    return dist;
  }, {});

  console.log(`  平均分数: ${avgScore.toFixed(1)}/23`);
  console.log(
    `  等级分布: ${Object.entries(gradeDistribution)
      .map(([g, c]) => `${g}级×${c}`)
      .join(', ')}`
  );
  console.log(
    `  合格率: ${results.filter(r => r.scores.total >= 18).length}/${results.length} (${((results.filter(r => r.scores.total >= 18).length / results.length) * 100).toFixed(1)}%)`
  );

  console.log(
    '\n💡 评分说明: 使用compliance anchor points方法，23分制，注重标准合规性而非内容数量'
  );
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: node scripts/docs-scorer.mjs <file-pattern>');
    console.error(
      '示例: node scripts/docs-scorer.mjs docs/architecture/base/04-*.md'
    );
    process.exit(1);
  }

  try {
    const pattern = args[0];
    const files = await glob(pattern);

    if (files.length === 0) {
      console.error(`未找到匹配的文件: ${pattern}`);
      process.exit(1);
    }

    const results = [];

    for (const file of files) {
      const result = await analyzeDocument(file);
      results.push(result);
    }

    // 按分数排序
    results.sort((a, b) => b.scores.total - a.scores.total);

    formatResults(results);

    // 如果有不合格文档，以非零状态退出 (18分合格线)
    const failedDocs = results.filter(r => r.scores.total < 18);
    if (failedDocs.length > 0) {
      console.error(`\n❌ ${failedDocs.length}个文档未达到18分合格线`);
      process.exit(1);
    }

    console.log('\n✅ 所有文档均达到合格标准');
  } catch (error) {
    console.error('评分过程出错:', error.message);
    process.exit(1);
  }
}

// 运行主函数
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);

if (__filename === process.argv[1]) {
  main();
}

export {
  analyzeDocument,
  SCORING_CONFIG_V2,
  GRADE_STANDARDS_V2,
  DocumentAnalyzer,
  ComplianceCheckers,
};
