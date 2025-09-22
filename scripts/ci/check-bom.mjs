#!/usr/bin/env node
/**
 * BOM 字符检测脚本
 * 扫描项目中的 JSON/JS/TS 文件，检测是否包含 UTF-8 BOM 字符
 * 用于 CI/CD 管道中防止 BOM 字符导致的构建失败
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * 检查文件是否包含 BOM 字符
 * @param {string} filePath 文件路径
 * @returns {boolean} 是否包含 BOM
 */
function checkBOM(filePath) {
  try {
    const buffer = readFileSync(filePath);
    // UTF-8 BOM: EF BB BF
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xef &&
      buffer[1] === 0xbb &&
      buffer[2] === 0xbf
    );
  } catch (error) {
    console.warn(`⚠️ 无法读取文件: ${filePath}`);
    return false;
  }
}

/**
 * 递归扫描目录中的文件
 * @param {string} dir 目录路径
 * @param {string[]} extensions 要检查的文件扩展名
 * @returns {string[]} 文件路径列表
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
 * 主检查函数
 */
function main() {
  console.log('🔍 开始检查 BOM 字符...');

  const startTime = Date.now();
  const filesToCheck = scanDirectory('.');
  const filesWithBOM = filesToCheck.filter(checkBOM);
  const duration = Date.now() - startTime;

  console.log(`📊 检查了 ${filesToCheck.length} 个文件 (${duration}ms)`);

  if (filesWithBOM.length > 0) {
    console.error('\n❌ 发现包含 BOM 字符的文件:');
    filesWithBOM.forEach(file => {
      console.error(`  - ${file}`);
    });

    console.error('\n🔧 修复建议:');
    console.error('  1. 使用 VS Code 打开文件');
    console.error('  2. 右下角点击 "UTF-8 with BOM"');
    console.error('  3. 选择 "Save with Encoding" → "UTF-8"');
    console.error("  4. 或使用命令: sed -i '1s/^\\xEF\\xBB\\xBF//' <filename>");

    process.exit(1);
  } else {
    console.log('✅ 未发现 BOM 字符，检查通过');
  }
}

// 运行检查
main();
