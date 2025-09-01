#!/usr/bin/env node

/**
 * 快速批量更新CSP策略到剩余PRD分片文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToFix = [
  'PRD-Guild-Manager_chunk_005.md',
  'PRD-Guild-Manager_chunk_006.md',
  'PRD-Guild-Manager_chunk_007.md',
  'PRD-Guild-Manager_chunk_008.md',
  'PRD-Guild-Manager_chunk_009.md',
  'PRD-Guild-Manager_chunk_010.md',
  'PRD-Guild-Manager_chunk_011.md',
  'PRD-Guild-Manager_chunk_012.md',
  'PRD-Guild-Manager_chunk_013.md',
  'PRD-Guild-Manager_chunk_014.md',
  'PRD-Guild-Manager_chunk_015.md',
  'PRD-Guild-Manager_chunk_016.md',
  'PRD-Guild-Manager_chunk_017.md',
  'PRD-Guild-Manager_chunk_018.md',
  'PRD-Guild-Manager_chunk_019.md',
  'PRD-Guild-Manager_chunk_020.md',
  'PRD-Guild-Manager_chunk_021.md',
  'PRD-Guild-Manager_chunk_022.md',
  'PRD-Guild-Manager_chunk_023.md',
  'PRD-Guild-Manager_chunk_024.md',
];

const prdChunksDir = path.join(__dirname, '..', 'docs', 'prd_chunks');

console.log('🔐 快速批量更新CSP策略到剩余PRD分片...\n');

let successCount = 0;
let errorCount = 0;

for (const filename of filesToFix) {
  const filePath = path.join(prdChunksDir, filename);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 更新CSP策略
    if (content.includes('默认CSP策略')) {
      const newContent = content.replace(
        /cspNotes:\s*"[^"]*默认CSP策略[^"]*"/g,
        "cspNotes: \"Electron CSP: script-src 'self'; object-src 'none'; base-uri 'self'\""
      );

      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✅ ${filename}: CSP策略已更新`);
        successCount++;
      } else {
        console.log(`⚪ ${filename}: CSP策略更新失败（未找到匹配模式）`);
      }
    } else {
      console.log(`⚪ ${filename}: CSP策略已是最新`);
    }
  } catch (error) {
    console.error(`❌ ${filename}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n📊 CSP更新完成:`);
console.log(`✅ 成功: ${successCount} 个文件`);
console.log(`❌ 失败: ${errorCount} 个文件`);
console.log(`🔐 CSP策略批量更新完成!`);
