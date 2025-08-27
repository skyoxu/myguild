#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const BACKUP_DIR = './docs/prd_chunks_backup';
const TARGET_DIR = './docs/prd_chunks';

// 需要添加的ADR引用
const NEW_ADR_REFS = [
  '  - "ADR-0006-data-storage-architecture"  # 数据存储选型与架构',
  '  - "ADR-0007-ports-adapters-pattern"      # 端口-适配器模式与存储抽象层', 
  '  - "ADR-0008-deployment-release-strategy" # 部署与发布策略',
  '  - "ADR-0009-cross-platform-adaptation"  # 多平台适配策略',
  '  - "ADR-0010-internationalization-localization" # 国际化与本地化策略'
];

console.log('🚀 开始PRD文件恢复和更新...\n');

// 需要处理的文件列表（跳过chunk_001，它是正常的）
const FILES_TO_RESTORE = [];
for (let i = 2; i <= 24; i++) {
  FILES_TO_RESTORE.push(`PRD-Guild-Manager_chunk_${i.toString().padStart(3, '0')}.md`);
}

let successCount = 0;
let errorCount = 0;

for (const filename of FILES_TO_RESTORE) {
  try {
    const backupPath = path.join(BACKUP_DIR, filename);
    const targetPath = path.join(TARGET_DIR, filename);
    
    // 检查备份文件是否存在
    if (!fs.existsSync(backupPath)) {
      console.log(`❌ 备份文件不存在: ${filename}`);
      errorCount++;
      continue;
    }
    
    // 读取备份文件内容（明确使用UTF-8编码）
    const backupContent = fs.readFileSync(backupPath, { encoding: 'utf8' });
    
    // 验证备份文件内容是否正常（检查是否包含中文字符而非乱码）
    if (backupContent.includes('鎴樻湳') || backupContent.includes('鍏細')) {
      console.log(`❌ 备份文件也包含乱码: ${filename}`);
      errorCount++;
      continue;
    }
    
    // 查找ADR-0005引用行的位置
    const lines = backupContent.split('\n');
    let adr005LineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('ADR-0005') || lines[i].includes('observability')) {
        adr005LineIndex = i;
        break;
      }
    }
    
    // 如果找到了ADR-0005行，在其后插入新的ADR引用
    if (adr005LineIndex !== -1) {
      // 在ADR-0005后插入新的ADR引用
      lines.splice(adr005LineIndex + 1, 0, ...NEW_ADR_REFS);
      
      const updatedContent = lines.join('\n');
      
      // 写入目标文件（明确使用UTF-8编码）
      fs.writeFileSync(targetPath, updatedContent, { encoding: 'utf8' });
      
      console.log(`✅ 已恢复并更新: ${filename}`);
      successCount++;
    } else {
      // 如果没找到ADR-0005行，直接恢复原文件
      fs.writeFileSync(targetPath, backupContent, { encoding: 'utf8' });
      console.log(`✅ 已恢复(无ADR更新): ${filename}`);
      successCount++;
    }
    
  } catch (error) {
    console.log(`❌ 处理失败 ${filename}: ${error.message}`);
    errorCount++;
  }
}

// 同时处理chunk_001，添加缺失的ADR引用
try {
  const chunk001Path = path.join(TARGET_DIR, 'PRD-Guild-Manager_chunk_001.md');
  const chunk001Content = fs.readFileSync(chunk001Path, { encoding: 'utf8' });
  
  const lines = chunk001Content.split('\n');
  let adr005LineIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('ADR-0005') || lines[i].includes('observability')) {
      adr005LineIndex = i;
      break;
    }
  }
  
  if (adr005LineIndex !== -1) {
    lines.splice(adr005LineIndex + 1, 0, ...NEW_ADR_REFS);
    const updatedContent = lines.join('\n');
    fs.writeFileSync(chunk001Path, updatedContent, { encoding: 'utf8' });
    console.log(`✅ 已更新chunk_001的ADR引用`);
  }
  
} catch (error) {
  console.log(`❌ 更新chunk_001失败: ${error.message}`);
  errorCount++;
}

console.log(`\n📊 处理完成统计:`);
console.log(`✅ 成功: ${successCount} 个文件`);
console.log(`❌ 失败: ${errorCount} 个文件`);

if (errorCount === 0) {
  console.log(`\n🎉 所有PRD文件已完全恢复并添加了ADR-0006到ADR-0010的引用！`);
} else {
  console.log(`\n⚠️  部分文件处理失败，请检查错误信息`);
}