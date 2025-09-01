#!/usr/bin/env node

/**
 * PRD Front-Matter 质量验证脚本
 * 系统性检查所有PRD分片的Front-Matter质量和一致性
 *
 * 验证项目：
 * 1. YAML语法合法性
 * 2. 追踪五件套完整性 (PRD-ID/Arch-Refs/Test-Refs/Monitors/SLO-Refs/ADRs)
 * 3. RFC3339时间格式规范 (Created/Updated)
 * 4. SemVer版本格式规范 (Version)
 * 5. SLO包含Crash-Free与Release Health一致性
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// RFC3339时间格式正则表达式
const RFC3339_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)$/;

// SemVer版本格式正则表达式
const SEMVER_REGEX =
  /^v?\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

// 追踪五件套必需字段
const REQUIRED_TRACKING_FIELDS = [
  'PRD-ID',
  'Arch-Refs',
  'Test-Refs',
  'Monitors',
  'SLO-Refs',
  'ADRs',
];

// Crash-Free SLO检查模式
const CRASH_FREE_PATTERN = /CRASH[_-]?FREE/i;

/**
 * 验证单个PRD文件的Front-Matter
 */
function validatePRDFile(filePath) {
  const fileName = path.basename(filePath);
  const results = {
    fileName,
    filePath,
    isValid: true,
    errors: [],
    warnings: [],
    frontMatter: null,
    yamlValid: false,
  };

  try {
    const content = fs.readFileSync(filePath, { encoding: 'utf8' });

    // 提取Front-Matter内容
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      results.isValid = false;
      results.errors.push('未找到YAML Front-Matter (--- ... ---)');
      return results;
    }

    const frontMatterText = frontMatterMatch[1];

    // 验证YAML语法
    try {
      results.frontMatter = yaml.load(frontMatterText);
      results.yamlValid = true;
    } catch (yamlError) {
      results.isValid = false;
      results.yamlValid = false;
      results.errors.push(`YAML语法错误: ${yamlError.message}`);
      return results;
    }

    const fm = results.frontMatter;

    // 1. 验证追踪五件套完整性
    for (const field of REQUIRED_TRACKING_FIELDS) {
      if (!fm[field]) {
        results.isValid = false;
        results.errors.push(`缺失必需字段: ${field}`);
      } else if (Array.isArray(fm[field]) && fm[field].length === 0) {
        results.isValid = false;
        results.errors.push(`字段为空数组: ${field}`);
      }
    }

    // 2. 验证RFC3339时间格式
    if (fm.Created && !RFC3339_REGEX.test(fm.Created)) {
      results.isValid = false;
      results.errors.push(
        `Created时间格式不符合RFC3339标准: "${fm.Created}" 应为 "2024-12-01T00:00:00Z"`
      );
    }

    if (fm.Updated && !RFC3339_REGEX.test(fm.Updated)) {
      results.isValid = false;
      results.errors.push(
        `Updated时间格式不符合RFC3339标准: "${fm.Updated}" 应为 "2025-08-22T00:00:00Z"`
      );
    }

    // 3. 验证SemVer版本格式
    if (fm.Version && !SEMVER_REGEX.test(fm.Version)) {
      results.isValid = false;
      results.errors.push(
        `Version不符合SemVer格式: "${fm.Version}" 应类似 "v1.2.0"`
      );
    }

    // 4. 验证SLO包含Crash-Free指标
    if (fm['SLO-Refs'] && Array.isArray(fm['SLO-Refs'])) {
      const hasCrashFree = fm['SLO-Refs'].some(slo =>
        CRASH_FREE_PATTERN.test(slo)
      );
      if (!hasCrashFree) {
        results.isValid = false;
        results.errors.push(
          'SLO-Refs中缺少Crash-Free相关指标 (如 CRASH_FREE_99.5)'
        );
      }
    }

    // 5. 验证PRD-ID格式一致性
    if (fm['PRD-ID']) {
      const expectedPattern = /^PRD-GM-PRD-GUILD-MANAGER_CHUNK_\d{3}$/;
      if (!expectedPattern.test(fm['PRD-ID'])) {
        results.warnings.push(
          `PRD-ID格式可能不一致: "${fm['PRD-ID']}" (建议格式: PRD-GM-PRD-GUILD-MANAGER_CHUNK_XXX)`
        );
      }
    }

    // 6. 验证Test-Refs路径格式
    if (fm['Test-Refs'] && Array.isArray(fm['Test-Refs'])) {
      fm['Test-Refs'].forEach(testRef => {
        if (!testRef.includes('.spec.ts')) {
          results.warnings.push(
            `Test-Refs路径可能不正确: "${testRef}" (建议以.spec.ts结尾)`
          );
        }
      });
    }

    // 7. 验证Monitors格式
    if (fm.Monitors && Array.isArray(fm.Monitors)) {
      fm.Monitors.forEach(monitor => {
        if (!monitor.includes('txn.prd-guild-manager_chunk_')) {
          results.warnings.push(`Monitor命名可能不规范: "${monitor}"`);
        }
      });
    }

    return results;
  } catch (error) {
    results.isValid = false;
    results.errors.push(`文件读取错误: ${error.message}`);
    return results;
  }
}

/**
 * 验证所有PRD分片文件
 */
function validateAllPRDFiles() {
  const chunksDir = 'C:\\buildgame\\vitegame\\docs\\prd_chunks';

  console.log('🚀 开始PRD Front-Matter质量验证');
  console.log('📁 目录:', chunksDir);
  console.log();

  try {
    const files = fs
      .readdirSync(chunksDir)
      .filter(
        file =>
          file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
      );

    console.log(`📄 发现 ${files.length} 个PRD分片文件`);
    console.log();

    const allResults = [];
    let validFiles = 0;
    let invalidFiles = 0;

    // 验证每个文件
    for (const file of files) {
      const filePath = path.join(chunksDir, file);
      const result = validatePRDFile(filePath);
      allResults.push(result);

      if (result.isValid) {
        validFiles++;
        console.log(`✅ ${result.fileName}`);
      } else {
        invalidFiles++;
        console.log(`❌ ${result.fileName}`);
        result.errors.forEach(error => {
          console.log(`   🔥 错误: ${error}`);
        });
        result.warnings.forEach(warning => {
          console.log(`   ⚠️  警告: ${warning}`);
        });
      }
    }

    // 输出验证汇总
    console.log();
    console.log('📊 验证汇总:');
    console.log(`   ✅ 通过: ${validFiles} 个文件`);
    console.log(`   ❌ 失败: ${invalidFiles} 个文件`);
    console.log(
      `   📈 成功率: ${((validFiles / files.length) * 100).toFixed(1)}%`
    );

    // 生成问题统计
    const allErrors = allResults.flatMap(r => r.errors);
    const allWarnings = allResults.flatMap(r => r.warnings);

    if (allErrors.length > 0) {
      console.log();
      console.log('🔥 主要问题类型统计:');
      const errorCounts = {};
      allErrors.forEach(error => {
        const errorType = error.split(':')[0];
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
      });

      Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([errorType, count]) => {
          console.log(`   ${errorType}: ${count} 次`);
        });
    }

    if (allWarnings.length > 0) {
      console.log();
      console.log('⚠️  警告类型统计:');
      const warningCounts = {};
      allWarnings.forEach(warning => {
        const warningType = warning.split(':')[0];
        warningCounts[warningType] = (warningCounts[warningType] || 0) + 1;
      });

      Object.entries(warningCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([warningType, count]) => {
          console.log(`   ${warningType}: ${count} 次`);
        });
    }

    // 生成修复建议
    console.log();
    console.log('💡 修复建议:');

    if (allErrors.some(e => e.includes('RFC3339'))) {
      console.log(
        '   🕒 时间格式修复: 将 "2024-12-01" 改为 "2024-12-01T00:00:00Z"'
      );
      console.log(
        '   🕒 时间格式修复: 将 "2025-08-22" 改为 "2025-08-22T00:00:00Z"'
      );
    }

    if (allErrors.some(e => e.includes('缺失必需字段'))) {
      console.log('   📝 补充缺失的追踪五件套字段');
    }

    if (allErrors.some(e => e.includes('Crash-Free'))) {
      console.log('   💊 在SLO-Refs中添加CRASH_FREE相关指标');
    }

    console.log();
    console.log('🎯 验证完成！');

    return {
      totalFiles: files.length,
      validFiles,
      invalidFiles,
      successRate: (validFiles / files.length) * 100,
      allResults,
    };
  } catch (error) {
    console.error('❌ 验证过程出错:', error.message);
    return null;
  }
}

// 执行验证
const results = validateAllPRDFiles();

if (results && results.invalidFiles > 0) {
  process.exit(1); // 如果有验证失败，退出码为1
}
