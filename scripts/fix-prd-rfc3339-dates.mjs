#!/usr/bin/env node

/**
 * PRD Front-Matter RFC3339日期格式修复脚本
 *
 * 修复内容：
 * - 将Created/Updated字段从"2024-12-01"格式修复为"2024-12-01T00:00:00Z"
 * - 保持所有其他Front-Matter内容不变
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
 * 修复单个PRD文件的时间格式
 */
function fixPRDFile(filePath) {
  const fileName = path.basename(filePath);

  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, { encoding: 'utf8' });

    // 查找并替换Front-Matter中的时间字段
    const fixedContent = content.replace(
      /^(---\n[\s\S]*?)(Created|Updated):\s*"([^"]+)"([\s\S]*?---)/gm,
      (match, beforeField, fieldName, dateValue, afterField) => {
        const fixedDate = convertToRFC3339(dateValue);
        return `${beforeField}${fieldName}: "${fixedDate}"${afterField}`;
      }
    );

    // 只有内容发生变化时才写入文件
    if (fixedContent !== content) {
      fs.writeFileSync(filePath, fixedContent, { encoding: 'utf8' });
      console.log(`✅ 修复完成: ${fileName}`);

      // 显示修复的具体内容
      const createdMatch = content.match(/Created:\s*"([^"]+)"/);
      const updatedMatch = content.match(/Updated:\s*"([^"]+)"/);

      if (createdMatch) {
        const fixedCreated = convertToRFC3339(createdMatch[1]);
        if (fixedCreated !== createdMatch[1]) {
          console.log(
            `   📅 Created: "${createdMatch[1]}" → "${fixedCreated}"`
          );
        }
      }

      if (updatedMatch) {
        const fixedUpdated = convertToRFC3339(updatedMatch[1]);
        if (fixedUpdated !== updatedMatch[1]) {
          console.log(
            `   📅 Updated: "${updatedMatch[1]}" → "${fixedUpdated}"`
          );
        }
      }

      return true; // 文件已修复
    } else {
      console.log(`ℹ️  无需修复: ${fileName}`);
      return false; // 文件无需修复
    }
  } catch (error) {
    console.error(`❌ 修复失败: ${fileName} - ${error.message}`);
    return false;
  }
}

/**
 * 批量修复所有PRD分片文件
 */
function fixAllPRDFiles() {
  const chunksDir = 'C:\\buildgame\\vitegame\\docs\\prd_chunks';

  console.log('🚀 开始PRD Front-Matter RFC3339时间格式修复');
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

    // 逐个修复文件
    for (const file of files) {
      const filePath = path.join(chunksDir, file);
      const wasFixed = fixPRDFile(filePath);

      if (wasFixed) {
        fixedFiles++;
      } else {
        unchangedFiles++;
      }
    }

    // 输出修复汇总
    console.log();
    console.log('📊 修复汇总:');
    console.log(`   ✅ 已修复: ${fixedFiles} 个文件`);
    console.log(`   ℹ️  无需修复: ${unchangedFiles} 个文件`);
    console.log(
      `   📈 修复率: ${((fixedFiles / files.length) * 100).toFixed(1)}%`
    );

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
      successRate: (fixedFiles / files.length) * 100,
    };
  } catch (error) {
    console.error('❌ 修复过程出错:', error.message);
    return null;
  }
}

// 执行修复
const results = fixAllPRDFiles();

if (results) {
  console.log();
  console.log(
    `✨ 修复完成！共处理 ${results.totalFiles} 个文件，修复 ${results.fixedFiles} 个文件`
  );
} else {
  console.error('❌ 修复失败');
  process.exit(1);
}
