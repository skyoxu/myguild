#!/usr/bin/env node

/**
 * 版本同步检查脚本
 * 检查 ADR 文件与 package.json 之间的版本一致性
 * 确保技术栈声明与实际依赖版本保持同步
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 版本检查规则配置
const VERSION_RULES = {
  // 需要检查的依赖包和对应的 ADR 匹配模式
  dependencies: {
    react: {
      adrPatterns: [
        /React\s+(\d+(?:\.\d+)?)/gi,
        /React\s+v?(\d+(?:\.\d+)?)/gi,
        /React\s+(\d+)/gi,
      ],
      description: 'React 框架版本',
    },
    electron: {
      adrPatterns: [
        /Electron\s+(\d+(?:\.\d+)?)/gi,
        /Electron\s+v?(\d+(?:\.\d+)?)/gi,
      ],
      description: 'Electron 框架版本',
    },
    typescript: {
      adrPatterns: [
        /TypeScript\s+(\d+(?:\.\d+)?)/gi,
        /TypeScript\s+v?(\d+(?:\.\d+)?)/gi,
        /TS\s+(\d+(?:\.\d+)?)/gi,
      ],
      description: 'TypeScript 版本',
    },
    vite: {
      adrPatterns: [/Vite\s+(\d+(?:\.\d+)?)/gi, /Vite\s+v?(\d+(?:\.\d+)?)/gi],
      description: 'Vite 构建工具版本',
    },
    tailwindcss: {
      adrPatterns: [
        /Tailwind\s+CSS\s+v?(\d+(?:\.\d+)?)/gi,
        /Tailwind\s+v?(\d+(?:\.\d+)?)/gi,
        /TailwindCSS\s+v?(\d+(?:\.\d+)?)/gi,
      ],
      description: 'Tailwind CSS 版本',
    },
    phaser: {
      adrPatterns: [
        /Phaser\s+(\d+(?:\.\d+)?)/gi,
        /Phaser\s+v?(\d+(?:\.\d+)?)/gi,
      ],
      description: 'Phaser 游戏引擎版本',
    },
  },

  // 版本比较容差配置
  tolerance: {
    major: false, // 主版本号必须完全匹配
    minor: true, // 次版本号允许差异
    patch: true, // 修订版本号允许差异
  },
};

/**
 * 读取 package.json 文件
 */
function readPackageJson() {
  const packagePath = path.join(__dirname, '..', 'package.json');

  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json 文件不存在');
  }

  const packageContent = fs.readFileSync(packagePath, 'utf8');
  return JSON.parse(packageContent);
}

/**
 * 扫描 ADR 目录
 */
function scanADRDirectory() {
  const adrDir = path.join(__dirname, '..', 'docs', 'adr');

  if (!fs.existsSync(adrDir)) {
    console.log('⚠️  ADR 目录不存在，跳过 ADR 版本检查');
    return [];
  }

  const adrFiles = fs
    .readdirSync(adrDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(adrDir, file));

  return adrFiles;
}

/**
 * 从 ADR 文件中提取版本信息
 */
function extractVersionsFromADR(adrPath) {
  const content = fs.readFileSync(adrPath, 'utf8');
  const fileName = path.basename(adrPath);
  const versions = {};

  // 检查每个依赖的版本模式
  for (const [dependency, config] of Object.entries(
    VERSION_RULES.dependencies
  )) {
    const foundVersions = [];

    for (const pattern of config.adrPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        const version = match[1];
        if (version && !foundVersions.includes(version)) {
          foundVersions.push(version);
        }
      }
    }

    if (foundVersions.length > 0) {
      versions[dependency] = {
        versions: foundVersions,
        description: config.description,
      };
    }
  }

  return {
    file: fileName,
    path: adrPath,
    versions,
  };
}

/**
 * 解析版本号为可比较的对象
 */
function parseVersion(versionString) {
  // 移除前缀字符（^, ~, >=, 等）
  const cleanVersion = versionString.replace(/^[^\\d]*/, '');
  const parts = cleanVersion.split('.').map(num => parseInt(num) || 0);

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    original: versionString,
    clean: cleanVersion,
  };
}

/**
 * 比较两个版本是否兼容
 */
function areVersionsCompatible(adrVersion, packageVersion) {
  const adr = parseVersion(adrVersion);
  const pkg = parseVersion(packageVersion);

  // 主版本号必须匹配（除非配置允许）
  if (!VERSION_RULES.tolerance.major && adr.major !== pkg.major) {
    return {
      compatible: false,
      reason: `主版本不匹配：ADR ${adr.major} vs Package ${pkg.major}`,
    };
  }

  // 如果主版本匹配，检查次版本号
  if (adr.major === pkg.major) {
    if (!VERSION_RULES.tolerance.minor && adr.minor !== pkg.minor) {
      return {
        compatible: false,
        reason: `次版本不匹配：ADR ${adr.major}.${adr.minor} vs Package ${pkg.major}.${pkg.minor}`,
      };
    }

    // 如果主版本和次版本都匹配，检查修订版本号
    if (adr.minor === pkg.minor) {
      if (!VERSION_RULES.tolerance.patch && adr.patch !== pkg.patch) {
        return {
          compatible: false,
          reason: `修订版本不匹配：ADR ${adr.clean} vs Package ${pkg.clean}`,
        };
      }
    }
  }

  return { compatible: true };
}

/**
 * 检查版本一致性
 */
function checkVersionConsistency(adrData, packageJson) {
  console.log('🔍 检查版本一致性...');

  const issues = [];
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const adr of adrData) {
    console.log(`📄 检查 ${adr.file}...`);

    for (const [dependency, adrInfo] of Object.entries(adr.versions)) {
      const packageVersion = allDependencies[dependency];

      if (!packageVersion) {
        issues.push({
          type: 'missing_dependency',
          severity: 'high',
          adrFile: adr.file,
          dependency,
          adrVersions: adrInfo.versions,
          message: `ADR 中提到的依赖 ${dependency} 在 package.json 中不存在`,
          recommendation: `在 package.json 中添加 ${dependency} 依赖，或从 ADR 中移除版本声明`,
        });
        continue;
      }

      // 检查每个在 ADR 中发现的版本
      for (const adrVersion of adrInfo.versions) {
        const compatibility = areVersionsCompatible(adrVersion, packageVersion);

        if (!compatibility.compatible) {
          issues.push({
            type: 'version_mismatch',
            severity: 'medium',
            adrFile: adr.file,
            dependency,
            adrVersion,
            packageVersion,
            message: `${adrInfo.description}版本不一致：ADR 声明 ${adrVersion}，package.json 实际 ${packageVersion}`,
            reason: compatibility.reason,
            recommendation: `更新 ADR 中的版本声明为 ${packageVersion}，或升级/降级 package.json 中的依赖版本`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 检查缺失的版本声明
 */
function checkMissingVersionDeclarations(adrData, packageJson) {
  console.log('🔍 检查缺失的版本声明...');

  const issues = [];
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // 收集所有 ADR 中已声明的依赖
  const declaredDependencies = new Set();
  for (const adr of adrData) {
    for (const dependency of Object.keys(adr.versions)) {
      declaredDependencies.add(dependency);
    }
  }

  // 检查重要依赖是否在 ADR 中有版本声明
  const importantDependencies = Object.keys(VERSION_RULES.dependencies);

  for (const dependency of importantDependencies) {
    if (allDependencies[dependency] && !declaredDependencies.has(dependency)) {
      issues.push({
        type: 'missing_declaration',
        severity: 'low',
        dependency,
        packageVersion: allDependencies[dependency],
        message: `重要依赖 ${dependency} 在 package.json 中存在但 ADR 中缺少版本声明`,
        recommendation: `在相关 ADR 文件中添加 ${dependency} ${allDependencies[dependency]} 的版本声明`,
      });
    }
  }

  return issues;
}

/**
 * 生成修复建议
 */
function generateFixSuggestions(issues) {
  const suggestions = [];

  const versionMismatches = issues.filter(i => i.type === 'version_mismatch');
  if (versionMismatches.length > 0) {
    suggestions.push({
      category: '版本不一致修复',
      items: versionMismatches.map(issue => ({
        file: issue.adrFile,
        action: `更新 ${issue.dependency} 版本声明：${issue.adrVersion} → ${issue.packageVersion}`,
        priority: 'high',
      })),
    });
  }

  const missingDeps = issues.filter(i => i.type === 'missing_dependency');
  if (missingDeps.length > 0) {
    suggestions.push({
      category: '缺失依赖修复',
      items: missingDeps.map(issue => ({
        file: issue.adrFile,
        action: `添加 ${issue.dependency} 到 package.json 或从 ADR 中移除版本声明`,
        priority: 'high',
      })),
    });
  }

  const missingDeclarations = issues.filter(
    i => i.type === 'missing_declaration'
  );
  if (missingDeclarations.length > 0) {
    suggestions.push({
      category: '版本声明补充',
      items: missingDeclarations.map(issue => ({
        action: `在 ADR 中添加 ${issue.dependency} ${issue.packageVersion} 版本声明`,
        priority: 'medium',
      })),
    });
  }

  return suggestions;
}

/**
 * 生成版本同步报告
 */
function generateVersionSyncReport(adrData, packageJson, issues, suggestions) {
  console.log('📊 生成版本同步报告...');

  const reportDir = path.join(__dirname, '..', 'logs', 'version-sync');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(reportDir, `version-sync-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    rules: VERSION_RULES,
    summary: {
      adrFilesScanned: adrData.length,
      dependenciesInPackage: Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }).length,
      totalIssues: issues.length,
      versionMismatches: issues.filter(i => i.type === 'version_mismatch')
        .length,
      missingDependencies: issues.filter(i => i.type === 'missing_dependency')
        .length,
      missingDeclarations: issues.filter(i => i.type === 'missing_declaration')
        .length,
    },
    adrData,
    packageVersions: {
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
    },
    issues,
    suggestions,
    recommendations: generateVersionSyncRecommendations(issues),
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 版本同步报告已保存: ${reportFile}`);

  return report;
}

/**
 * 生成版本同步建议
 */
function generateVersionSyncRecommendations(issues) {
  const recommendations = [];

  if (issues.some(i => i.type === 'version_mismatch')) {
    recommendations.push(
      '定期检查并更新 ADR 文件中的版本声明，确保与 package.json 保持一致'
    );
  }

  if (issues.some(i => i.type === 'missing_dependency')) {
    recommendations.push(
      '审查 ADR 中提到的依赖，确保在 package.json 中正确安装'
    );
  }

  if (issues.some(i => i.type === 'missing_declaration')) {
    recommendations.push('在 ADR 文件中补充重要依赖的版本声明，便于版本管理');
  }

  recommendations.push('建议在 CI/CD 流程中集成版本同步检查，避免版本漂移');
  recommendations.push(
    '考虑使用自动化工具定期同步 ADR 和 package.json 中的版本信息'
  );

  return recommendations;
}

/**
 * 主版本同步检查函数
 */
function runVersionSyncCheck() {
  console.log('🔄 开始版本同步检查...');
  console.log('📋 检查 ADR 文件与 package.json 版本一致性\\n');

  try {
    // 1. 读取 package.json
    const packageJson = readPackageJson();
    console.log(
      `📦 读取 package.json: ${
        Object.keys({
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        }).length
      } 个依赖\\n`
    );

    // 2. 扫描 ADR 文件
    const adrFiles = scanADRDirectory();
    if (adrFiles.length === 0) {
      console.log('⚠️  未找到 ADR 文件，跳过版本同步检查');
      return;
    }

    console.log(`📋 扫描 ADR 文件: ${adrFiles.length} 个\\n`);

    // 3. 提取 ADR 中的版本信息
    const adrData = adrFiles
      .map(extractVersionsFromADR)
      .filter(data => Object.keys(data.versions).length > 0);

    console.log(`📄 发现版本声明: ${adrData.length} 个文件\\n`);

    // 4. 检查版本一致性
    const consistencyIssues = checkVersionConsistency(adrData, packageJson);

    // 5. 检查缺失的版本声明
    const missingIssues = checkMissingVersionDeclarations(adrData, packageJson);

    const allIssues = [...consistencyIssues, ...missingIssues];

    // 6. 生成修复建议
    const suggestions = generateFixSuggestions(allIssues);

    // 7. 生成报告
    const report = generateVersionSyncReport(
      adrData,
      packageJson,
      allIssues,
      suggestions
    );

    // 8. 显示结果
    console.log('\\n📊 版本同步检查结果:');
    console.log(`  扫描 ADR 文件: ${report.summary.adrFilesScanned}`);
    console.log(`  package.json 依赖: ${report.summary.dependenciesInPackage}`);
    console.log(`  总问题数: ${report.summary.totalIssues}`);
    console.log(`  版本不匹配: ${report.summary.versionMismatches}`);
    console.log(`  缺失依赖: ${report.summary.missingDependencies}`);
    console.log(`  缺失声明: ${report.summary.missingDeclarations}`);

    if (allIssues.length > 0) {
      console.log('\\n❌ 发现版本同步问题:');

      // 按类型分组显示问题
      const criticalIssues = allIssues.filter(i => i.severity === 'high');
      const mediumIssues = allIssues.filter(i => i.severity === 'medium');

      if (criticalIssues.length > 0) {
        console.log('\\n🚨 高优先级问题:');
        criticalIssues.forEach(issue => {
          console.log(`  - ${issue.message}`);
          if (issue.recommendation) {
            console.log(`    💡 建议: ${issue.recommendation}`);
          }
        });
      }

      if (mediumIssues.length > 0) {
        console.log('\\n⚠️  中等优先级问题:');
        mediumIssues.forEach(issue => {
          console.log(`  - ${issue.message}`);
          if (issue.recommendation) {
            console.log(`    💡 建议: ${issue.recommendation}`);
          }
        });
      }

      // 显示修复建议
      if (suggestions.length > 0) {
        console.log('\\n📋 修复建议:');
        suggestions.forEach(suggestion => {
          console.log(`\\n  ${suggestion.category}:`);
          suggestion.items.forEach(item => {
            console.log(`    - ${item.action}`);
            if (item.file) {
              console.log(`      文件: ${item.file}`);
            }
          });
        });
      }

      console.log('\\n📄 详细报告已保存到 logs/version-sync/ 目录');

      // 如果有高优先级问题，返回错误码
      if (criticalIssues.length > 0) {
        console.log('\\n❌ 版本同步检查失败：存在严重版本不一致问题');
        process.exit(1);
      }
    } else {
      console.log('\\n✅ 版本同步检查通过！');
      console.log('🎉 ADR 文件与 package.json 版本声明保持一致');
    }
  } catch (error) {
    console.error('❌ 版本同步检查执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  runVersionSyncCheck();
}

export {
  runVersionSyncCheck,
  extractVersionsFromADR,
  checkVersionConsistency,
  parseVersion,
  areVersionsCompatible,
  VERSION_RULES,
};
