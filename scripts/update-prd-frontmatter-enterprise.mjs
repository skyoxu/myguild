#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// 编码安全的文件操作
const readFileUtf8 = filePath =>
  fs.readFileSync(filePath, { encoding: 'utf8' });
const writeFileUtf8 = (filePath, content) =>
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });

// PRD分片分类定义
const PRD_CLASSIFICATION = {
  overview: ['chunk_001', 'chunk_024'],
  technical: [
    'chunk_002',
    'chunk_003',
    'chunk_004',
    'chunk_005',
    'chunk_006',
    'chunk_010',
    'chunk_020',
    'chunk_021',
  ],
  functional: [
    'chunk_007',
    'chunk_008',
    'chunk_009',
    'chunk_011',
    'chunk_012',
    'chunk_013',
    'chunk_014',
    'chunk_015',
    'chunk_016',
    'chunk_017',
    'chunk_018',
    'chunk_019',
    'chunk_022',
    'chunk_023',
  ],
};

// 企业级Front-Matter模板生成器
function generateEnterpriseFrontMatter(chunkNumber, classification, fileSize) {
  const baseConfig = {
    'PRD-ID': `PRD-GM-PRD-GUILD-MANAGER_CHUNK_${chunkNumber.toString().padStart(3, '0')}`,
    Title: `公会管理器PRD - 分片${chunkNumber}`,
    Status: 'Active',
    Owner: 'Product-Team',
    Created: '2024-12-01',
    Updated: new Date().toISOString().split('T')[0],
    Version: 'v1.2.0',
    Priority: 'High',
    Risk: 'Medium',
    'Depends-On': ['PRD-GM-BASE-ARCHITECTURE'],
    chunk: `${chunkNumber}/24`,
    size: `${fileSize} chars`,
    source: 'PRD-Guild-Manager.md',
    'Arch-Refs': ['08-功能纵切-公会管理模块'],
    'Test-Refs': [
      `tests/unit/guild-manager-chunk-${chunkNumber.toString().padStart(3, '0')}.spec.ts`,
    ],
    Monitors: [
      `txn.prd-guild-manager_chunk_${chunkNumber.toString().padStart(3, '0')}.primary`,
    ],
    'SLO-Refs': ['UI_P95_100ms', 'EVENT_P95_50ms', 'CRASH_FREE_99.5'],
    ADRs: [
      'ADR-0001-tech-stack',
      'ADR-0002-electron-security',
      'ADR-0003-observability',
      'ADR-0006-data-storage-architecture',
      'ADR-0007-ports-adapters-pattern',
      'ADR-0008-deployment-release-strategy',
      'ADR-0009-cross-platform-adaptation',
      'ADR-0010-internationalization-localization',
    ],
  };

  // Release Gates配置 - 根据分类定制
  const releaseGates = generateReleaseGates(classification);

  // Contract Definitions - 根据分类定制
  const contractDefinitions = generateContractDefinitions(
    chunkNumber,
    classification
  );

  // Security Policies - 根据分类定制
  const securityPolicies = generateSecurityPolicies(classification);

  // Traceability Matrix - 根据分类定制
  const traceabilityMatrix = generateTraceabilityMatrix(classification);

  return {
    ...baseConfig,
    Release_Gates: releaseGates,
    Contract_Definitions: contractDefinitions,
    Security_Policies: securityPolicies,
    Traceability_Matrix: traceabilityMatrix,
  };
}

// Release Gates配置生成
function generateReleaseGates(classification) {
  const baseGates = {
    Quality_Gate: {
      enabled: true,
      threshold: 'unit_test_coverage >= 80%',
      blockingFailures: ['test_failures', 'coverage_below_threshold'],
      windowHours: 24,
    },
    Security_Gate: {
      enabled: true,
      threshold: 'security_scan_passed == true',
      blockingFailures: [
        'security_vulnerabilities',
        'dependency_vulnerabilities',
      ],
      windowHours: 12,
    },
    Performance_Gate: {
      enabled: true,
      threshold: 'p95_response_time <= 100ms',
      blockingFailures: ['performance_regression', 'memory_leaks'],
      windowHours: 6,
    },
    Acceptance_Gate: {
      enabled: true,
      threshold: 'acceptance_criteria_met >= 95%',
      blockingFailures: ['acceptance_test_failures', 'user_story_incomplete'],
      windowHours: 48,
    },
  };

  // 概览型分片增强配置
  if (classification === 'overview') {
    baseGates.Integration_Gate = {
      enabled: true,
      threshold: 'integration_tests_passed == true',
      blockingFailures: ['integration_failures', 'api_contract_violations'],
      windowHours: 72,
    };
  }

  // 技术接口型分片增强API验证
  if (classification === 'technical') {
    baseGates.API_Contract_Gate = {
      enabled: true,
      threshold: 'api_contract_compliance >= 100%',
      blockingFailures: ['contract_violations', 'breaking_changes'],
      windowHours: 12,
    };
  }

  return baseGates;
}

// CloudEvents 1.0契约定义生成
function generateContractDefinitions(chunkNumber, classification) {
  const baseContract = {
    types: [
      `src/shared/contracts/guild/chunk-${chunkNumber.toString().padStart(3, '0')}-types.ts`,
    ],
    events: {
      specversion: '1.0',
      type: `com.guildmanager.chunk${chunkNumber.toString().padStart(3, '0')}.event`,
      source: `/guild-manager/chunk-${chunkNumber.toString().padStart(3, '0')}`,
      subject: `guild-management-chunk-${chunkNumber}`,
      datacontenttype: 'application/json',
      dataschema: `src/shared/contracts/guild/chunk-${chunkNumber.toString().padStart(3, '0')}-events.ts`,
    },
  };

  // 技术接口型分片增强契约定义
  if (classification === 'technical') {
    baseContract.interfaces = [
      `src/shared/contracts/guild/chunk-${chunkNumber.toString().padStart(3, '0')}-interfaces.ts`,
    ];
    baseContract.validation_rules = [
      `src/shared/validation/chunk-${chunkNumber.toString().padStart(3, '0')}-validation.ts`,
    ];
  }

  return baseContract;
}

// 安全策略配置生成
function generateSecurityPolicies(classification) {
  const basePolicies = {
    permissions: {
      read: ['guild-member', 'guild-officer', 'guild-master'],
      write: ['guild-officer', 'guild-master'],
      admin: ['guild-master', 'system-admin'],
    },
    cspNotes: '默认CSP策略应用，无额外内联脚本需求',
  };

  // 概览型分片增强安全配置
  if (classification === 'overview') {
    basePolicies.audit_requirements = {
      log_all_admin_actions: true,
      retention_days: 365,
      compliance_standard: '企业级审计要求',
    };
  }

  return basePolicies;
}

// 可追踪性矩阵生成
function generateTraceabilityMatrix(classification) {
  const baseMatrix = {
    requirementTags: ['guild-management', 'user-experience', 'performance'],
    acceptance: {
      functional: '功能需求100%实现',
      performance: '性能指标达到SLO要求',
      security: '安全要求完全满足',
      usability: '用户体验达到设计标准',
    },
    evidence: {
      implementation: '源代码实现',
      testing: '自动化测试覆盖',
      documentation: '技术文档完备',
      validation: '用户验收确认',
    },
  };

  // 功能模块型分片增强业务验收
  if (classification === 'functional') {
    baseMatrix.businessAcceptance = {
      userStoryCompletion: '用户故事100%完成',
      businessRulesValidation: '业务规则验证通过',
      stakeholderApproval: '利益相关者确认',
    };
  }

  return baseMatrix;
}

// 获取分片分类
function getChunkClassification(chunkNumber) {
  const chunkId = `chunk_${chunkNumber.toString().padStart(3, '0')}`;

  if (PRD_CLASSIFICATION.overview.includes(chunkId)) return 'overview';
  if (PRD_CLASSIFICATION.technical.includes(chunkId)) return 'technical';
  if (PRD_CLASSIFICATION.functional.includes(chunkId)) return 'functional';

  return 'functional'; // 默认为功能型
}

// YAML序列化（简化版）
function toYAML(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let result = '';

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      result += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'string') {
          result += `${spaces}  - "${item}"\n`;
        } else {
          result += `${spaces}  - ${toYAML(item, indent + 1).trim()}\n`;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      result += `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
    } else if (typeof value === 'string') {
      result += `${spaces}${key}: "${value}"\n`;
    } else {
      result += `${spaces}${key}: ${value}\n`;
    }
  }

  return result;
}

// 更新单个PRD分片
function updatePRDChunk(filePath) {
  console.log(`正在处理: ${filePath}`);

  try {
    // 读取原文件
    const content = readFileUtf8(filePath);
    const fileSize = content.length;

    // 提取chunk编号
    const match = filePath.match(/chunk_(\d+)\.md$/);
    if (!match) {
      console.error(`无法从文件路径提取chunk编号: ${filePath}`);
      return false;
    }

    const chunkNumber = parseInt(match[1]);
    const classification = getChunkClassification(chunkNumber);

    console.log(
      `  - Chunk ${chunkNumber}, 分类: ${classification}, 大小: ${fileSize} chars`
    );

    // 生成新的front-matter
    const frontMatter = generateEnterpriseFrontMatter(
      chunkNumber,
      classification,
      fileSize
    );

    // 查找现有front-matter的结束位置
    const frontMatterEnd = content.indexOf('---', 4);
    if (frontMatterEnd === -1) {
      console.error(`无法找到front-matter结束标记: ${filePath}`);
      return false;
    }

    // 构建新内容
    const bodyContent = content.substring(frontMatterEnd + 3);
    const newFrontMatterYAML = toYAML(frontMatter);
    const newContent = `---\n${newFrontMatterYAML}---${bodyContent}`;

    // 写入新文件
    writeFileUtf8(filePath, newContent);
    console.log(`  ✅ 更新完成`);

    return true;
  } catch (error) {
    console.error(`处理文件时出错 ${filePath}:`, error.message);
    return false;
  }
}

// 主函数
function main() {
  console.log('🚀 开始批量更新PRD分片Front-Matter...\n');

  const prdChunksDir = 'C:\\buildgame\\vitegame\\docs\\prd_chunks';

  // 获取所有PRD chunk文件
  const files = fs
    .readdirSync(prdChunksDir)
    .filter(file => file.match(/PRD-Guild-Manager_chunk_\d+\.md$/))
    .map(file => path.join(prdChunksDir, file))
    .sort();

  console.log(`发现 ${files.length} 个PRD分片文件\n`);

  let successCount = 0;
  let failureCount = 0;

  // 逐个处理文件
  for (const filePath of files) {
    if (updatePRDChunk(filePath)) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  // 输出结果
  console.log(`\n📊 更新完成统计:`);
  console.log(`  ✅ 成功更新: ${successCount} 个文件`);
  console.log(`  ❌ 更新失败: ${failureCount} 个文件`);

  if (failureCount === 0) {
    console.log(`\n🎉 所有PRD分片的企业级Front-Matter更新成功！`);
  } else {
    console.log(`\n⚠️  部分文件更新失败，请检查错误信息`);
  }
}

// 执行主函数
main();
