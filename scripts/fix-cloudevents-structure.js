#!/usr/bin/env node

/**
 * CloudEvents结构精确修复脚本
 * 修复精确结构修复脚本中的解析问题，确保CloudEvents字段正确定位
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, '..');

// PRD分片目录
const chunksDir = path.join(baseDir, 'docs', 'prd_chunks');

// 日志目录
const logsDir = path.join(baseDir, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(
  logsDir,
  `cloudevents-fix-${new Date().toISOString().slice(0, 10)}.log`
);

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);
  fs.appendFileSync(logFile, logEntry + '\n');
}

/**
 * 修复CloudEvents结构解析问题
 */
function fixCloudEventsStructure(content, chunkNum) {
  log(
    `正在修复chunk_${String(chunkNum).padStart(3, '0')}的CloudEvents结构解析问题...`
  );

  // 生成动态CloudEvents字段
  const eventId = `guild-manager-chunk-${String(chunkNum).padStart(3, '0')}-${Math.random().toString(36).substr(2, 8)}`;
  const currentTime = new Date().toISOString();

  // 查找Contract_Definitions部分
  const contractDefMatch = content.match(
    /(\t\t)Contract_Definitions:\s*\n([\s\S]*?)(?=\n\t\tSecurity_Policies:)/
  );

  if (!contractDefMatch) {
    log(
      `⚠️ 未找到Contract_Definitions部分 - chunk_${String(chunkNum).padStart(3, '0')}`
    );
    return content;
  }

  const fullMatch = contractDefMatch[0];
  const indent = contractDefMatch[1];

  // 检查是否有解析问题（events与types合并）
  if (fullMatch.includes('types.ts"    events:')) {
    log(
      `🔧 检测到CloudEvents解析问题，开始修复 - chunk_${String(chunkNum).padStart(3, '0')}`
    );

    // 重建正确的Contract_Definitions结构
    const fixedContractDef = `${indent}Contract_Definitions:
${indent}  types:
${indent}    - "src/shared/contracts/guild/chunk-${String(chunkNum).padStart(3, '0')}-types.ts"
${indent}  events:
${indent}    specversion: "1.0"
${indent}    id: "${eventId}"
${indent}    time: "${currentTime}"
${indent}    type: "com.guildmanager.chunk${String(chunkNum).padStart(3, '0')}.event"
${indent}    source: "/guild-manager/chunk-${String(chunkNum).padStart(3, '0')}"
${indent}    subject: "guild-management-chunk-${chunkNum}"
${indent}    datacontenttype: "application/json"
${indent}    dataschema: "src/shared/contracts/guild/chunk-${String(chunkNum).padStart(3, '0')}-events.ts"
${indent}  interfaces:
${indent}    - "src/shared/contracts/guild/chunk-${String(chunkNum).padStart(3, '0')}-interfaces.ts"
${indent}  validation_rules:
${indent}    - "src/shared/validation/chunk-${String(chunkNum).padStart(3, '0')}-validation.ts"`;

    // 替换Contract_Definitions部分
    content = content.replace(
      /(\t\t)Contract_Definitions:\s*\n([\s\S]*?)(?=\n\t\tSecurity_Policies:)/,
      fixedContractDef + '\n'
    );

    log(
      `✅ CloudEvents结构解析问题已修复 - chunk_${String(chunkNum).padStart(3, '0')}`
    );
  } else if (fullMatch.includes('events:')) {
    // 检查events部分是否存在但格式需要修正
    const eventsMatch = fullMatch.match(
      /(\s+)events:([\s\S]*?)(?=\n\s+interfaces:|\n\s+validation_rules:|$)/
    );

    if (eventsMatch) {
      const eventsContent = eventsMatch[0];

      // 检查是否缺少必需字段或格式不正确
      if (
        !eventsContent.includes('specversion:') ||
        !eventsContent.includes('id:') ||
        !eventsContent.includes('time:') ||
        !eventsContent.includes('source:')
      ) {
        log(
          `🔧 更新不完整的CloudEvents字段 - chunk_${String(chunkNum).padStart(3, '0')}`
        );

        // 替换events部分
        const newEventsSection = `${indent}  events:
${indent}    specversion: "1.0"
${indent}    id: "${eventId}"
${indent}    time: "${currentTime}"
${indent}    type: "com.guildmanager.chunk${String(chunkNum).padStart(3, '0')}.event"
${indent}    source: "/guild-manager/chunk-${String(chunkNum).padStart(3, '0')}"
${indent}    subject: "guild-management-chunk-${chunkNum}"
${indent}    datacontenttype: "application/json"
${indent}    dataschema: "src/shared/contracts/guild/chunk-${String(chunkNum).padStart(3, '0')}-events.ts"`;

        content = content.replace(
          /(\s+)events:([\s\S]*?)(?=\n\s+interfaces:)/,
          newEventsSection + '\n'
        );

        log(
          `✅ CloudEvents字段已完善 - chunk_${String(chunkNum).padStart(3, '0')}`
        );
      } else {
        log(
          `ℹ️ CloudEvents结构正常，无需修复 - chunk_${String(chunkNum).padStart(3, '0')}`
        );
      }
    }
  } else {
    log(
      `ℹ️ 未找到events部分，可能此chunk无需CloudEvents - chunk_${String(chunkNum).padStart(3, '0')}`
    );
  }

  return content;
}

/**
 * 处理单个PRD分片文件
 */
function processChunkFile(filePath) {
  try {
    // 提取chunk编号
    const filename = path.basename(filePath);
    const chunkMatch = filename.match(/chunk_(\d{3})/);
    if (!chunkMatch) {
      log(`⚠️ 无法解析chunk编号: ${filename}`);
      return false;
    }

    const chunkNum = parseInt(chunkMatch[1]);

    log(`\n📋 开始处理: ${filename}`);

    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // 执行CloudEvents结构修复
    content = fixCloudEventsStructure(content, chunkNum);

    // 检查是否有变更
    if (content !== originalContent) {
      // 创建备份
      const backupPath = `${filePath}.backup-cloudevents-${Date.now()}`;
      fs.writeFileSync(backupPath, originalContent);

      // 写入修复后的内容
      fs.writeFileSync(filePath, content);

      log(`✅ ${filename} CloudEvents修复完成，备份已保存`);
      return true;
    } else {
      log(`ℹ️ ${filename} CloudEvents无需修复`);
      return true;
    }
  } catch (error) {
    log(`❌ 处理失败 ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

/**
 * 主执行函数
 */
async function main() {
  log('🚀 开始CloudEvents结构精确修复');
  log(`工作目录: ${chunksDir}`);
  log(`日志文件: ${logFile}`);

  if (!fs.existsSync(chunksDir)) {
    log(`❌ PRD分片目录不存在: ${chunksDir}`);
    process.exit(1);
  }

  // 获取所有PRD chunk文件
  const files = fs
    .readdirSync(chunksDir)
    .filter(file => file.match(/PRD-Guild-Manager_chunk_\d{3}\.md$/))
    .map(file => path.join(chunksDir, file))
    .sort();

  log(`📁 发现 ${files.length} 个PRD分片文件`);

  // 统计结果
  const results = {
    total: files.length,
    success: 0,
    failed: 0,
    processed: [],
  };

  // 处理每个文件
  for (const filePath of files) {
    const success = processChunkFile(filePath);

    if (success) {
      results.success++;
    } else {
      results.failed++;
    }

    results.processed.push({
      file: path.basename(filePath),
      success: success,
    });
  }

  // 输出总结
  log('\n📊 CloudEvents修复总结:');
  log(`✅ 成功处理: ${results.success}/${results.total} 个文件`);
  log(`❌ 失败处理: ${results.failed}/${results.total} 个文件`);

  if (results.failed > 0) {
    log('\n❌ 失败文件清单:');
    results.processed
      .filter(r => !r.success)
      .forEach(r => log(`  - ${r.file}`));
  }

  log(`\n📋 详细日志已保存: ${logFile}`);
  log('🎯 CloudEvents结构精确修复完成');
}

// 执行主函数
main().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
