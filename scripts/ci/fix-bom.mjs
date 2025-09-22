#!/usr/bin/env node
/**
 * BOM 字符批量清理脚本
 * 自动移除项目中所有文件的 UTF-8 BOM 字符
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * 检查并移除文件的 BOM 字符
 * @param {string} filePath 文件路径
 * @returns {boolean} 是否移除了 BOM
 */
function removeBOM(filePath) {
  try {
    const buffer = readFileSync(filePath);

    // 检查是否有 UTF-8 BOM
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xef &&
      buffer[1] === 0xbb &&
      buffer[2] === 0xbf
    ) {
      // 移除前 3 个字节（BOM）
      const cleanBuffer = buffer.slice(3);
      writeFileSync(filePath, cleanBuffer);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`⚠️ 无法处理文件: ${filePath} - ${error.message}`);
    return false;
  }
}

/**
 * 递归扫描目录中的文件
 */
function scanDirectory(
  dir,
  extensions = ['.json', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs']
) {
  const files = [];
  const excludeDirs = [
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    '.vscode',
    '.idea',
  ];

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (
        stat.isDirectory() &&
        !excludeDirs.includes(item) &&
        !item.startsWith('.')
      ) {
        files.push(...scanDirectory(fullPath, extensions));
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`⚠️ 无法扫描目录: ${dir}`);
  }

  return files;
}

/**
 * 主清理函数
 */
function main() {
  console.log('🧹 开始批量清理 BOM 字符...');

  const startTime = Date.now();
  const filesToCheck = scanDirectory('.');
  let fixedCount = 0;

  console.log(`📊 扫描到 ${filesToCheck.length} 个文件`);

  for (const file of filesToCheck) {
    if (removeBOM(file)) {
      console.log(`✅ 已清理: ${file}`);
      fixedCount++;
    }
  }

  const duration = Date.now() - startTime;

  console.log(`\n🎉 清理完成！`);
  console.log(`📊 处理了 ${filesToCheck.length} 个文件`);
  console.log(`🔧 修复了 ${fixedCount} 个文件的 BOM 问题`);
  console.log(`⏱️ 耗时: ${duration}ms`);

  if (fixedCount > 0) {
    console.log('\n💡 建议接下来：');
    console.log('1. 运行 npm run check:bom 验证清理结果');
    console.log('2. 运行 npm run typecheck 确认编译正常');
    console.log('3. 提交更改到 Git');
    console.log('4. 设置 .editorconfig 防止问题再次出现');
  }
}

// 运行清理
main();
