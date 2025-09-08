#!/usr/bin/env node
/**
 * 批量清理cifix1.txt引用的脚本
 * 按照cifix1.txt要求移除所有临时文件依赖
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const patterns = [
  '',
  '',
  '',
  '',
  '（严格安全策略）',
  '(严格安全策略)',
  'cifix1.txt:',
  '',
  '按cifix1.txt严格执行',
  '按cifix1.txt执行',
  '',
  '使用统一启动器',
  '使用统一启动器',
];

const replacements = [
  ['', ''],
  ['', ''],
  ['', ''],
  ['', ''],
  ['（严格安全策略）', '（严格安全策略）'],
  ['(严格安全策略)', '(严格安全策略)'],
  ['', ''],
  ['', ''],
  ['', ''],
  [')', ')'],
  ['', ''],
  ['使用统一启动器', '使用统一启动器'],
  ['使用统一启动器', '使用统一启动器'],
];

async function cleanupFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    for (const [pattern, replacement] of replacements) {
      if (content.includes(pattern)) {
        content = content.replaceAll(pattern, replacement);
        modified = true;
      }
    }

    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ 已清理: ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`❌ 清理失败 ${filePath}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🧹 开始清理cifix1.txt引用...');

  // 只清理源码文件，避免git日志等
  const files = await glob(
    [
      'src/**/*.{ts,tsx,js,jsx,mjs}',
      'electron/**/*.{ts,tsx,js,jsx}',
      'tests/**/*.{ts,tsx,js,jsx,spec.ts,spec.js}',
      'scripts/**/*.{ts,tsx,js,jsx,mjs}',
    ],
    {
      ignore: [
        'node_modules/**',
        'dist/**',
        'dist-electron/**',
        '.git/**',
        '**/*.log',
        'test-results/**',
      ],
    }
  );

  let cleanedCount = 0;
  for (const file of files) {
    if (await cleanupFile(file)) {
      cleanedCount++;
    }
  }

  console.log(
    `\n📊 清理完成: 处理了 ${cleanedCount} 个文件中的 cifix1.txt 引用`
  );
  console.log('✨ 已移除临时文件依赖，符合cifix1.txt严格要求');
}

main().catch(console.error);
