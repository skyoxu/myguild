#!/usr/bin/env node
/**
 * 编码安全的文件操作工具库
 * 防止在Windows环境下出现中文字符编码问题
 *
 * @author Claude Code
 * @date 2025-08-22
 */

import fs from 'fs';
import path from 'path';

/**
 * 编码安全的文件读取
 * @param {string} filePath - 文件路径
 * @returns {string} 文件内容
 */
export function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, { encoding: 'utf8' });
  } catch (error) {
    console.error(`❌ 读取文件失败 ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * 编码安全的文件写入
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 */
export function safeWriteFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
  } catch (error) {
    console.error(`❌ 写入文件失败 ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * 批量更新PRD文件的编码安全版本
 * @param {Array<string>} fileList - 文件列表
 * @param {Array<string>} newContent - 要添加的内容行
 * @param {string} insertAfterPattern - 在此模式后插入
 */
export function safeBatchUpdatePRD(
  fileList,
  newContent,
  insertAfterPattern = 'ADR-0005'
) {
  let successCount = 0;
  let errorCount = 0;

  console.log('🔒 开始编码安全的批量更新...\n');

  for (const filename of fileList) {
    try {
      // 验证文件存在
      if (!fs.existsSync(filename)) {
        console.log(`❌ 文件不存在: ${filename}`);
        errorCount++;
        continue;
      }

      // 编码安全读取
      const content = safeReadFile(filename);

      // 验证内容不包含乱码
      if (content.includes('鎴樻湳') || content.includes('鍏細')) {
        console.log(`❌ 检测到乱码，跳过: ${filename}`);
        errorCount++;
        continue;
      }

      // 查找插入位置
      const lines = content.split('\n');
      let insertIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(insertAfterPattern)) {
          insertIndex = i;
          break;
        }
      }

      if (insertIndex !== -1) {
        // 插入新内容
        lines.splice(insertIndex + 1, 0, ...newContent);
        const updatedContent = lines.join('\n');

        // 编码安全写入
        safeWriteFile(filename, updatedContent);

        console.log(`✅ 已更新: ${path.basename(filename)}`);
        successCount++;
      } else {
        console.log(`⚠️  未找到插入点: ${path.basename(filename)}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`❌ 处理失败 ${filename}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 批量更新完成:`);
  console.log(`✅ 成功: ${successCount} 个文件`);
  console.log(`❌ 失败: ${errorCount} 个文件`);

  return { successCount, errorCount };
}

/**
 * 验证文件编码正确性
 * @param {string} filePath - 文件路径
 * @returns {boolean} 编码是否正确
 */
export function validateFileEncoding(filePath) {
  try {
    const content = safeReadFile(filePath);

    // 检查常见乱码模式
    const corruptPatterns = [
      '鎴樻湳', // "战术"的乱码
      '鍏細', // "公会"的乱码
      '绠＄悊', // "管理"的乱码
      '缁忛獙', // "经验"的乱码
    ];

    for (const pattern of corruptPatterns) {
      if (content.includes(pattern)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`验证编码失败 ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * 批量验证目录下所有文件的编码
 * @param {string} directoryPath - 目录路径
 * @param {string} pattern - 文件模式（如 *.md）
 */
export function validateDirectoryEncoding(directoryPath, pattern = '*.md') {
  console.log(`🔍 验证目录编码: ${directoryPath}`);

  const files = fs
    .readdirSync(directoryPath)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(directoryPath, f));

  let validCount = 0;
  let corruptCount = 0;

  for (const file of files) {
    if (validateFileEncoding(file)) {
      console.log(`✅ ${path.basename(file)} - 编码正常`);
      validCount++;
    } else {
      console.log(`❌ ${path.basename(file)} - 编码损坏`);
      corruptCount++;
    }
  }

  console.log(`\n📊 编码验证结果:`);
  console.log(`✅ 正常: ${validCount} 个文件`);
  console.log(`❌ 损坏: ${corruptCount} 个文件`);

  return { validCount, corruptCount };
}

// 如果直接运行脚本，执行编码验证
if (import.meta.url === `file://${process.argv[1]}`) {
  const targetDir = process.argv[2] || './docs/prd_chunks';
  validateDirectoryEncoding(targetDir);
}
