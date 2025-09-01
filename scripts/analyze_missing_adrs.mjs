#!/usr/bin/env node

/**
 * 分析为什么ADR-0007和ADR-0009没有被添加
 * 重新评估阈值设置和关键词权重
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRD_CHUNKS_DIR = path.join(PROJECT_ROOT, 'docs', 'prd_chunks');

// 当前的ADR映射规则
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
  },
};

class AdrAnalyzer {
  analyzeContent(content) {
    const scores = {};
    const _contentLower = content.toLowerCase();

    for (const [adrId, rule] of Object.entries(ADR_MAPPING_RULES)) {
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of rule.keywords) {
        const keywordLower = keyword.toLowerCase();
        // 使用词边界匹配
        const regex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
        const matches = content.match(regex) || [];

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

async function analyzeSpecificFiles() {
  const analyzer = new AdrAnalyzer();

  // 分析几个关键文件
  const testFiles = [
    'PRD-Guild-Manager_chunk_012.md',
    'PRD-Guild-Manager_chunk_020.md',
  ];

  console.log('🔍 重新分析ADR匹配情况...\n');

  for (const fileName of testFiles) {
    const filePath = path.join(PRD_CHUNKS_DIR, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const scores = analyzer.analyzeContent(content);

    console.log(`📄 ${fileName}:`);

    for (const [adrId, analysis] of Object.entries(scores)) {
      const status = analysis.shouldInclude ? '✅' : '❌';
      console.log(
        `  ${status} ${adrId}: ${analysis.score.toFixed(3)} (阈值: ${analysis.threshold})`
      );

      // 显示匹配的关键词
      if (analysis.matchedKeywords.length > 0) {
        console.log(
          `    匹配关键词: ${analysis.matchedKeywords.map(k => `${k.keyword}(${k.frequency})`).join(', ')}`
        );
      }

      if (!analysis.shouldInclude && analysis.score > 0.25) {
        console.log(
          `    ⚠️  得分${analysis.score.toFixed(3)}接近阈值，可能需要降低阈值`
        );
      }
    }

    console.log();
  }

  // 建议新的阈值
  console.log('📊 阈值建议分析:');
  console.log('当前阈值: 0.4');
  console.log('建议阈值: 0.3 (更包容，减少遗漏)');
  console.log('或者: 0.25 (最宽松，确保重要内容不遗漏)');

  // 检查实际内容示例
  console.log('\n🔍 内容实例检查:');

  const chunk020Content = await fs.readFile(
    path.join(PRD_CHUNKS_DIR, 'PRD-Guild-Manager_chunk_020.md'),
    'utf8'
  );

  // 检查contracts路径出现
  const contractMatches =
    chunk020Content.match(/src\/shared\/contracts/g) || [];
  console.log(
    `chunk_020中"src/shared/contracts"出现: ${contractMatches.length} 次`
  );

  // 检查数据架构关键内容
  const hasDataArchitecture =
    chunk020Content.includes('数据管理规格') ||
    chunk020Content.includes('数据架构') ||
    chunk020Content.includes('数据统计模块');
  console.log(`chunk_020包含数据架构内容: ${hasDataArchitecture}`);

  // 检查UI相关内容
  const chunk012Content = await fs.readFile(
    path.join(PRD_CHUNKS_DIR, 'PRD-Guild-Manager_chunk_012.md'),
    'utf8'
  );
  const hasUIContent =
    chunk012Content.includes('用户界面规格') ||
    chunk012Content.includes('界面设计原则') ||
    chunk012Content.includes('ActionType');
  console.log(`chunk_012包含UI设计内容: ${hasUIContent}`);
}

async function suggestImprovedRules() {
  console.log('\n🛠️  建议的改进规则:');

  const improvedRules = {
    'ADR-0007': {
      threshold: 0.25, // 降低阈值
      newKeywords: [
        'src/shared/contracts', // 更具体的路径匹配
        '数据架构',
        '数据管理',
        '统计模块', // 中文关键词
        'types',
        'events',
        'interfaces', // TypeScript相关
      ],
    },
    'ADR-0009': {
      threshold: 0.25, // 降低阈值
      newKeywords: [
        '用户界面',
        '界面设计',
        '交互',
        '响应式', // 中文UI关键词
        'modal',
        'navigation',
        'layout',
        'responsive', // 更多UI关键词
      ],
    },
  };

  console.log(JSON.stringify(improvedRules, null, 2));
}

// 执行分析
analyzeSpecificFiles()
  .then(() => suggestImprovedRules())
  .catch(console.error);
