#!/usr/bin/env node
/**
 * ADR配置联动机制
 *
 * 功能：
 * 1. 解析ADR间的依赖关系 (depends-on, depended-by)
 * 2. 验证配置一致性 (技术栈版本、安全策略等)
 * 3. 自动同步关联配置
 * 4. 生成依赖关系图和影响分析
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ADR_DIR = join(__dirname, '..', 'docs', 'adr');

/**
 * ADR元数据结构
 * @typedef {Object} ADRMetadata
 * @property {string} id - ADR标识符
 * @property {string} title - ADR标题
 * @property {'Proposed'|'Accepted'|'Deprecated'|'Superseded'} status - ADR状态
 * @property {string} decisionTime - 决策时间
 * @property {string[]} impactScope - 影响范围
 * @property {string[]} techTags - 技术标签
 * @property {string[]} dependsOn - 依赖的ADR
 * @property {string[]} dependedBy - 被依赖的ADR
 * @property {string} [testCoverage] - 测试覆盖率
 * @property {string[]} monitoringMetrics - 监控指标
 * @property {string[]} executableDeliverables - 可执行交付物
 * @property {string[]} [supersedes] - 被替代的ADR
 * @property {Object} [configs] - 配置项
 */

/**
 * 配置联动规则定义
 */
const CONFIG_LINKAGE_RULES = {
  // 技术栈版本联动
  'tech-versions': {
    source: 'ADR-0001',
    targets: ['ADR-0002', 'ADR-0003', 'ADR-0005', 'ADR-0007'],
    configs: [
      'react-version',
      'typescript-version',
      'electron-version',
      'tailwind-version',
    ],
    syncRule: 'exact-match',
  },

  // 安全策略联动
  'security-policies': {
    source: 'ADR-0002',
    targets: ['ADR-0005', 'ADR-0008'],
    configs: [
      'csp-policy',
      'node-integration',
      'context-isolation',
      'sandbox-mode',
    ],
    syncRule: 'inherit-strict',
  },

  // 质量门禁联动
  'quality-gates': {
    source: 'ADR-0005',
    targets: ['ADR-0003', 'ADR-0008'],
    configs: ['coverage-thresholds', 'test-timeouts', 'release-health-metrics'],
    syncRule: 'min-threshold',
  },

  // 数据存储联动
  'data-consistency': {
    source: 'ADR-0006',
    targets: ['ADR-0007', 'ADR-0008'],
    configs: ['backup-strategy', 'migration-policy', 'wal-mode'],
    syncRule: 'consistency-check',
  },
};

/**
 * 解析ADR文件的前置元数据
 */
async function parseADRMetadata(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // 查找YAML前置元数据
    let yamlStart = -1,
      yamlEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (yamlStart === -1) yamlStart = i + 1;
        else {
          yamlEnd = i;
          break;
        }
      }
    }

    if (yamlStart === -1 || yamlEnd === -1) {
      throw new Error('No YAML frontmatter found');
    }

    const yamlContent = lines.slice(yamlStart, yamlEnd).join('\n');
    const metadata = yaml.load(yamlContent);

    return {
      ...metadata,
      id: metadata['ADR-ID'] || extractIdFromFilename(filePath),
      title: metadata.title || '',
      status: metadata.status || 'Proposed',
      dependsOn: metadata['depends-on'] || [],
      dependedBy: metadata['depended-by'] || [],
      impactScope: metadata['impact-scope'] || [],
      techTags: metadata['tech-tags'] || [],
      monitoringMetrics: metadata['monitoring-metrics'] || [],
      executableDeliverables: metadata['executable-deliverables'] || [],
      filePath,
    };
  } catch (error) {
    console.warn(`警告: 解析ADR文件失败 ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * 从文件名提取ADR ID
 */
function extractIdFromFilename(filePath) {
  const filename = filePath.split(/[\\/]/).pop() || '';
  const match = filename.match(/^(ADR-\d+)/);
  return match ? match[1] : '';
}

/**
 * 构建ADR依赖关系图
 */
function buildDependencyGraph(adrList) {
  const graph = new Map();
  const reverseGraph = new Map();

  // 初始化节点
  adrList.forEach(adr => {
    graph.set(adr.id, new Set());
    reverseGraph.set(adr.id, new Set());
  });

  // 构建依赖边
  adrList.forEach(adr => {
    if (adr.dependsOn) {
      adr.dependsOn.forEach(depId => {
        if (graph.has(depId)) {
          graph.get(depId).add(adr.id);
          reverseGraph.get(adr.id).add(depId);
        }
      });
    }
  });

  return { graph, reverseGraph };
}

/**
 * 检测循环依赖
 */
function detectCycles(graph) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path = []) {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    neighbors.forEach(neighbor => dfs(neighbor, [...path]));

    recursionStack.delete(node);
  }

  graph.forEach((_, node) => {
    if (!visited.has(node)) {
      dfs(node);
    }
  });

  return cycles;
}

/**
 * 验证配置一致性
 */
async function validateConfigConsistency(adrList) {
  const issues = [];

  for (const ruleName of Object.keys(CONFIG_LINKAGE_RULES)) {
    const rule = CONFIG_LINKAGE_RULES[ruleName];
    const sourceAdr = adrList.find(adr => adr.id === rule.source);

    if (!sourceAdr) {
      issues.push({
        type: 'MISSING_SOURCE_ADR',
        rule: ruleName,
        missing: rule.source,
      });
      continue;
    }

    for (const targetId of rule.targets) {
      const targetAdr = adrList.find(adr => adr.id === targetId);

      if (!targetAdr) {
        issues.push({
          type: 'MISSING_TARGET_ADR',
          rule: ruleName,
          source: rule.source,
          missing: targetId,
        });
        continue;
      }

      // 验证配置同步
      const configIssues = await validateRuleCompliance(
        sourceAdr,
        targetAdr,
        rule
      );
      issues.push(...configIssues);
    }
  }

  return issues;
}

/**
 * 验证特定规则的合规性
 */
async function validateRuleCompliance(sourceAdr, targetAdr, rule) {
  const issues = [];

  try {
    // 读取源ADR和目标ADR的内容进行配置对比
    const sourceContent = await readFile(sourceAdr.filePath, 'utf-8');
    const targetContent = await readFile(targetAdr.filePath, 'utf-8');

    switch (rule.syncRule) {
      case 'exact-match':
        // 检查技术版本是否完全匹配
        for (const config of rule.configs) {
          const sourceVersion = extractConfigValue(sourceContent, config);
          const targetVersion = extractConfigValue(targetContent, config);

          if (
            sourceVersion &&
            targetVersion &&
            sourceVersion !== targetVersion
          ) {
            issues.push({
              type: 'VERSION_MISMATCH',
              source: sourceAdr.id,
              target: targetAdr.id,
              config: config,
              sourceValue: sourceVersion,
              targetValue: targetVersion,
              expected: 'exact-match',
            });
          }
        }
        break;

      case 'inherit-strict':
        // 检查安全策略是否严格继承
        for (const config of rule.configs) {
          const sourcePolicy = extractConfigValue(sourceContent, config);
          const targetPolicy = extractConfigValue(targetContent, config);

          if (
            sourcePolicy &&
            !isStrictInheritance(sourcePolicy, targetPolicy, config)
          ) {
            issues.push({
              type: 'POLICY_NOT_INHERITED',
              source: sourceAdr.id,
              target: targetAdr.id,
              config: config,
              sourceValue: sourcePolicy,
              targetValue: targetPolicy,
              expected: 'strict-inheritance',
            });
          }
        }
        break;

      case 'min-threshold':
        // 检查阈值是否满足最低要求
        for (const config of rule.configs) {
          const sourceThreshold = extractThresholdValue(sourceContent, config);
          const targetThreshold = extractThresholdValue(targetContent, config);

          if (
            sourceThreshold &&
            targetThreshold &&
            targetThreshold < sourceThreshold
          ) {
            issues.push({
              type: 'THRESHOLD_TOO_LOW',
              source: sourceAdr.id,
              target: targetAdr.id,
              config: config,
              sourceValue: sourceThreshold,
              targetValue: targetThreshold,
              expected: `>= ${sourceThreshold}`,
            });
          }
        }
        break;
    }
  } catch (error) {
    issues.push({
      type: 'VALIDATION_ERROR',
      source: sourceAdr.id,
      target: targetAdr.id,
      error: error.message,
    });
  }

  return issues;
}

/**
 * 从ADR内容中提取配置值
 */
function extractConfigValue(content, configName) {
  const patterns = {
    'react-version': /React\s+(\d+)/i,
    'typescript-version': /TypeScript.*?(\d+\.\d+)/i,
    'electron-version': /Electron.*?(\d+\.\d+)/i,
    'tailwind-version': /Tailwind.*?v(\d+)/i,
    'csp-policy': /Content-Security-Policy.*?"([^"]+)"/i,
    'node-integration': /nodeIntegration:\s*(false|true)/i,
    'context-isolation': /contextIsolation:\s*(true|false)/i,
    'sandbox-mode': /sandbox:\s*(true|false)/i,
  };

  const pattern = patterns[configName];
  if (!pattern) return null;

  const match = content.match(pattern);
  return match ? match[1] : null;
}

/**
 * 提取数值阈值
 */
function extractThresholdValue(content, configName) {
  const patterns = {
    'coverage-thresholds': /lines.*?(\d+)%/i,
    'test-timeouts': /timeout.*?(\d+)/i,
    'release-health-metrics': /crash.*?(\d+(?:\.\d+)?)/i,
  };

  const pattern = patterns[configName];
  if (!pattern) return null;

  const match = content.match(pattern);
  return match ? parseFloat(match[1]) : null;
}

/**
 * 检查是否为严格继承
 */
function isStrictInheritance(sourceValue, targetValue, configName) {
  if (!targetValue) return false;

  switch (configName) {
    case 'csp-policy':
      // CSP策略应该包含源策略的所有限制
      return (
        targetValue.includes("default-src 'self'") &&
        !targetValue.includes('unsafe-inline') &&
        !targetValue.includes('unsafe-eval')
      );

    case 'node-integration':
      return sourceValue === 'false' ? targetValue === 'false' : true;

    case 'context-isolation':
      return sourceValue === 'true' ? targetValue === 'true' : true;

    case 'sandbox-mode':
      return sourceValue === 'true' ? targetValue === 'true' : true;

    default:
      return sourceValue === targetValue;
  }
}

/**
 * 生成影响分析报告
 */
function generateImpactAnalysis(adr, graph) {
  const directDependents = Array.from(graph.get(adr.id) || []);
  const allAffected = new Set();

  // 递归查找所有受影响的ADR
  function findAllAffected(adrId, visited = new Set()) {
    if (visited.has(adrId)) return;
    visited.add(adrId);
    allAffected.add(adrId);

    const dependents = graph.get(adrId) || new Set();
    dependents.forEach(depId => findAllAffected(depId, visited));
  }

  directDependents.forEach(depId => findAllAffected(depId));
  allAffected.delete(adr.id); // 移除自己

  return {
    adr: adr.id,
    directDependents: directDependents,
    totalAffected: Array.from(allAffected),
    impactScope: adr.impactScope,
    riskLevel: calculateRiskLevel(
      directDependents.length,
      allAffected.size,
      adr.impactScope
    ),
  };
}

/**
 * 计算变更风险级别
 */
function calculateRiskLevel(directCount, totalCount, impactScope) {
  let score = 0;

  // 基于直接依赖数量
  score += directCount * 2;

  // 基于总影响数量
  score += totalCount;

  // 基于影响范围
  const criticalScopes = ['electron/', 'security/', 'tests/'];
  const hasCriticalScope = impactScope.some(scope =>
    criticalScopes.some(critical => scope.includes(critical))
  );

  if (hasCriticalScope) score += 5;

  // 风险分级
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

/**
 * 自动修复配置不一致
 */
async function autoFixConfigIssues(issues, adrList) {
  const fixes = [];

  for (const issue of issues) {
    if (issue.type === 'VERSION_MISMATCH' && issue.expected === 'exact-match') {
      const targetAdr = adrList.find(adr => adr.id === issue.target);
      if (targetAdr) {
        try {
          let content = await readFile(targetAdr.filePath, 'utf-8');
          const pattern = getConfigPattern(issue.config);

          if (pattern) {
            content = content.replace(pattern, match => {
              return match.replace(issue.targetValue, issue.sourceValue);
            });

            await writeFile(targetAdr.filePath, content, 'utf-8');

            fixes.push({
              type: 'VERSION_SYNC',
              file: targetAdr.filePath,
              config: issue.config,
              from: issue.targetValue,
              to: issue.sourceValue,
            });
          }
        } catch (error) {
          console.error(`修复失败 ${targetAdr.filePath}: ${error.message}`);
        }
      }
    }
  }

  return fixes;
}

/**
 * 获取配置项的正则模式
 */
function getConfigPattern(configName) {
  const patterns = {
    'react-version': /(React\s+)(\d+)/gi,
    'typescript-version': /(TypeScript.*?)(\d+\.\d+)/gi,
    'electron-version': /(Electron.*?)(\d+\.\d+)/gi,
    'tailwind-version': /(Tailwind.*?v)(\d+)/gi,
  };

  return patterns[configName];
}

/**
 * 生成依赖关系图的DOT格式
 */
function generateDependencyGraphDOT(adrList, graph) {
  let dot = 'digraph ADRDependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style=rounded];\n\n';

  // 添加节点
  adrList.forEach(adr => {
    const color =
      adr.status === 'Accepted'
        ? 'lightgreen'
        : adr.status === 'Deprecated'
          ? 'lightgray'
          : 'lightblue';
    dot += `  "${adr.id}" [label="${adr.id}\\n${adr.title.substring(0, 20)}..." fillcolor="${color}" style="filled,rounded"];\n`;
  });

  dot += '\n';

  // 添加依赖边
  graph.forEach((dependents, source) => {
    dependents.forEach(target => {
      dot += `  "${source}" -> "${target}";\n`;
    });
  });

  dot += '}\n';
  return dot;
}

/**
 * 主函数
 */
async function main() {
  console.log('🔗 开始ADR配置联动机制分析...\n');

  try {
    // 读取所有ADR文件
    const adrFiles = (await readdir(ADR_DIR))
      .filter(f => f.endsWith('.md') && f.startsWith('ADR-'))
      .map(f => join(ADR_DIR, f));

    console.log(`📁 发现 ${adrFiles.length} 个ADR文件\n`);

    // 解析ADR元数据
    const adrList = [];
    for (const file of adrFiles) {
      const metadata = await parseADRMetadata(file);
      if (metadata) adrList.push(metadata);
    }

    console.log(`✅ 成功解析 ${adrList.length} 个ADR文件\n`);

    // 构建依赖关系图
    const { graph } = buildDependencyGraph(adrList);

    // 检测循环依赖
    const cycles = detectCycles(graph);
    if (cycles.length > 0) {
      console.log('🔄 发现循环依赖:');
      cycles.forEach((cycle, index) => {
        console.log(`   ${index + 1}. ${cycle.join(' -> ')}`);
      });
      console.log();
    }

    // 验证配置一致性
    console.log('🔍 验证配置一致性...');
    const configIssues = await validateConfigConsistency(adrList);

    if (configIssues.length > 0) {
      console.log(`⚠️  发现 ${configIssues.length} 个配置问题:`);
      configIssues.forEach((issue, index) => {
        console.log(
          `   ${index + 1}. [${issue.type}] ${issue.source || 'N/A'} -> ${issue.target || issue.missing || 'N/A'}`
        );
        if (issue.config) {
          console.log(`      配置项: ${issue.config}`);
          if (issue.sourceValue && issue.targetValue) {
            console.log(
              `      源值: ${issue.sourceValue}, 目标值: ${issue.targetValue}`
            );
          }
        }
      });
      console.log();

      // 尝试自动修复
      console.log('🔧 尝试自动修复配置问题...');
      const fixes = await autoFixConfigIssues(configIssues, adrList);

      if (fixes.length > 0) {
        console.log(`✅ 成功修复 ${fixes.length} 个问题:`);
        fixes.forEach((fix, index) => {
          console.log(
            `   ${index + 1}. ${fix.type}: ${fix.config} (${fix.from} -> ${fix.to})`
          );
        });
      } else {
        console.log('ℹ️  没有可自动修复的问题');
      }
      console.log();
    } else {
      console.log('✅ 所有配置项均一致\n');
    }

    // 生成影响分析报告
    console.log('📊 生成影响分析报告...');
    const impactAnalysis = adrList.map(adr =>
      generateImpactAnalysis(adr, graph)
    );

    // 显示高风险ADR
    const highRiskADRs = impactAnalysis.filter(
      analysis => analysis.riskLevel === 'HIGH'
    );
    if (highRiskADRs.length > 0) {
      console.log(`🚨 高风险ADR (${highRiskADRs.length}个):`);
      highRiskADRs.forEach(analysis => {
        console.log(
          `   ${analysis.adr}: 直接影响${analysis.directDependents.length}个, 总影响${analysis.totalAffected.length}个ADR`
        );
      });
      console.log();
    }

    // 保存分析报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalADRs: adrList.length,
        acceptedADRs: adrList.filter(adr => adr.status === 'Accepted').length,
        cycles: cycles.length,
        configIssues: configIssues.length,
        highRiskADRs: highRiskADRs.length,
      },
      dependencyGraph: {
        nodes: adrList.map(adr => ({
          id: adr.id,
          title: adr.title,
          status: adr.status,
          impactScope: adr.impactScope,
        })),
        edges: Array.from(graph.entries()).flatMap(([source, targets]) =>
          Array.from(targets).map(target => ({ source, target }))
        ),
      },
      cycles: cycles,
      configIssues: configIssues,
      impactAnalysis: impactAnalysis,
      linkageRules: CONFIG_LINKAGE_RULES,
    };

    const reportPath = join(__dirname, '..', 'logs', 'adr-linkage-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📄 详细报告已保存: ${reportPath}`);

    // 生成DOT图
    const dotGraph = generateDependencyGraphDOT(adrList, graph);
    const dotPath = join(__dirname, '..', 'logs', 'adr-dependencies.dot');
    await writeFile(dotPath, dotGraph, 'utf-8');
    console.log(`🎨 依赖关系图已保存: ${dotPath}`);
    console.log(
      '   可使用 Graphviz 渲染: dot -Tpng adr-dependencies.dot -o dependencies.png\n'
    );

    console.log('✅ ADR配置联动机制分析完成!');
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 只有直接运行此脚本时才执行主函数
if (process.argv[1] && process.argv[1].endsWith('adr-config-linker.mjs')) {
  main().catch(console.error);
}

export {
  parseADRMetadata,
  buildDependencyGraph,
  validateConfigConsistency,
  generateImpactAnalysis,
};
