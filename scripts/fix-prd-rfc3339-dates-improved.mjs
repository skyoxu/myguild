#!/usr/bin/env node

/**
 * PRD Front-Matter RFC3339日期格式修复脚本 (改进版)
 *
 * 改进内容：
 * - 使用更简单可靠的逐行匹配替换方法
 * - 分别处理Created和Updated字段
 * - 提供详细的修复前后对比
 * - 确保UTF-8编码安全
 */

import fs from 'fs';
import path from 'path';

/**
 * 将简单日期格式转换为RFC3339格式
 */
function convertToRFC3339(dateString) {
  // 匹配YYYY-MM-DD格式
  const dateMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return `${dateMatch[1]}T00:00:00Z`;
  }
  return dateString; // 如果已经是正确格式，保持不变
}

/**
 * 修复单个PRD文件的时间格式 (改进版)
 */
function fixPRDFileImproved(filePath) {
  const fileName = path.basename(filePath);

  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, { encoding: 'utf8' });
    let fixedContent = content;
    const changesMade = [];

    // 修复Created字段 - 更简单的正则表达式
    fixedContent = fixedContent.replace(
      /^(Created:\s*")([^"]+)(".*?)$/gm,
      (match, prefix, dateValue, suffix) => {
        const fixedDate = convertToRFC3339(dateValue);
        if (fixedDate !== dateValue) {
          changesMade.push({
            field: 'Created',
            before: dateValue,
            after: fixedDate,
          });
        }
        return `${prefix}${fixedDate}${suffix}`;
      }
    );

    // 修复Updated字段 - 更简单的正则表达式
    fixedContent = fixedContent.replace(
      /^(Updated:\s*")([^"]+)(".*?)$/gm,
      (match, prefix, dateValue, suffix) => {
        const fixedDate = convertToRFC3339(dateValue);
        if (fixedDate !== dateValue) {
          changesMade.push({
            field: 'Updated',
            before: dateValue,
            after: fixedDate,
          });
        }
        return `${prefix}${fixedDate}${suffix}`;
      }
    );

    // 只有内容发生变化时才写入文件
    if (fixedContent !== content) {
      fs.writeFileSync(filePath, fixedContent, { encoding: 'utf8' });
      console.log(`✅ 修复完成: ${fileName}`);

      // 显示具体修复内容
      changesMade.forEach(change => {
        console.log(
          `   📅 ${change.field}: "${change.before}" → "${change.after}"`
        );
      });

      return {
        fixed: true,
        changes: changesMade.length,
      };
    } else {
      console.log(`ℹ️  无需修复: ${fileName}`);
      return {
        fixed: false,
        changes: 0,
      };
    }
  } catch (error) {
    console.error(`❌ 修复失败: ${fileName} - ${error.message}`);
    return {
      fixed: false,
      changes: 0,
      error: error.message,
    };
  }
}

/**
 * 批量修复所有PRD分片文件 (改进版)
 */
function fixAllPRDFilesImproved() {
  const chunksDir = 'C:\\buildgame\\vitegame\\docs\\prd_chunks';

  console.log('🚀 开始PRD Front-Matter RFC3339时间格式修复 (改进版)');
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

    let fixedFiles = 0;
    let unchangedFiles = 0;
    let totalChanges = 0;
    const errors = [];

    // 逐个修复文件
    for (const file of files) {
      const filePath = path.join(chunksDir, file);
      const result = fixPRDFileImproved(filePath);

      if (result.error) {
        errors.push({ file, error: result.error });
      } else if (result.fixed) {
        fixedFiles++;
        totalChanges += result.changes;
      } else {
        unchangedFiles++;
      }
    }

    // 输出修复汇总
    console.log();
    console.log('📊 修复汇总:');
    console.log(`   ✅ 已修复: ${fixedFiles} 个文件`);
    console.log(`   ℹ️  无需修复: ${unchangedFiles} 个文件`);
    console.log(`   🔧 总修复次数: ${totalChanges} 处`);
    console.log(
      `   📈 修复率: ${((fixedFiles / files.length) * 100).toFixed(1)}%`
    );

    if (errors.length > 0) {
      console.log(`   ❌ 错误: ${errors.length} 个文件`);
      errors.forEach(error => {
        console.log(`     - ${error.file}: ${error.error}`);
      });
    }

    console.log();
    console.log('🎯 所有时间格式已标准化为RFC3339格式！');

    // 建议验证修复结果
    console.log();
    console.log('💡 建议后续步骤:');
    console.log(
      '   1. 运行验证脚本确认修复效果: node scripts/prd-frontmatter-validator.mjs'
    );
    console.log('   2. 检查文件内容确保没有意外修改');
    console.log('   3. 提交更改到版本控制');

    return {
      totalFiles: files.length,
      fixedFiles,
      unchangedFiles,
      totalChanges,
      errors: errors.length,
      successRate: (fixedFiles / files.length) * 100,
    };
  } catch (error) {
    console.error('❌ 修复过程出错:', error.message);
    return null;
  }
}

// 执行修复
console.log('🔄 使用改进版修复脚本...');
const results = fixAllPRDFilesImproved();

if (results) {
  console.log();
  console.log(
    `✨ 修复完成！共处理 ${results.totalFiles} 个文件，修复 ${results.fixedFiles} 个文件，共 ${results.totalChanges} 处修改`
  );

  if (results.errors > 0) {
    console.log(`⚠️  有 ${results.errors} 个文件修复时出现错误`);
    process.exit(1);
  }
} else {
  console.error('❌ 修复失败');
  process.exit(1);
}
