#!/usr/bin/env node
/**
 * 安全修复GitHub Actions工作流文件的BOM和CRLF编码问题
 *
 * 问题：5个工作流文件存在BOM，3个文件存在CRLF行尾
 * 目标：统一为UTF-8无BOM + LF行尾
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// 受影响的工作流文件
const affectedFiles = [
  'ci.yml',
  'build-and-test.yml',
  'pr-performance-check.yml',
  'security-unified.yml',
  'validate-workflows.yml',
];

/**
 * 检查文件是否有BOM
 */
function hasBOM(buffer) {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  );
}

/**
 * 移除BOM
 */
function removeBOM(buffer) {
  if (hasBOM(buffer)) {
    return buffer.slice(3);
  }
  return buffer;
}

/**
 * 转换CRLF为LF
 */
function convertCRLFtoLF(content) {
  return content.replace(/\r\n/g, '\n');
}

/**
 * 备份文件
 */
function backupFile(filePath) {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  console.log(
    `✅ 已备份: ${path.basename(filePath)} -> ${path.basename(backupPath)}`
  );
  return backupPath;
}

/**
 * 验证YAML语法
 */
async function validateYAML(filePath) {
  try {
    // 简单的YAML语法检查
    const content = fs.readFileSync(filePath, 'utf8');

    // 检查基本YAML结构
    const lines = content.split('\n');
    let hasValidStructure = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // 检查是否有键值对或数组结构
        if (trimmed.includes(':') || trimmed.startsWith('-')) {
          hasValidStructure = true;
          break;
        }
      }
    }

    if (!hasValidStructure) {
      throw new Error('文件不包含有效的YAML结构');
    }

    console.log(`✅ YAML语法验证通过: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(
      `❌ YAML语法验证失败: ${path.basename(filePath)} - ${error.message}`
    );
    return false;
  }
}

/**
 * 处理单个文件
 */
async function processFile(fileName) {
  const filePath = path.join(projectRoot, '.github', 'workflows', fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${fileName}`);
    return false;
  }

  console.log(`\n🔍 处理文件: ${fileName}`);

  // 读取原始文件
  const originalBuffer = fs.readFileSync(filePath);
  const originalContent = originalBuffer.toString('utf8');

  // 检查编码问题
  const bomDetected = hasBOM(originalBuffer);
  const crlfDetected = originalContent.includes('\r\n');

  console.log(`   BOM检测: ${bomDetected ? '❌ 存在' : '✅ 无'}`);
  console.log(`   CRLF检测: ${crlfDetected ? '❌ 存在' : '✅ 无'}`);

  if (!bomDetected && !crlfDetected) {
    console.log(`   ✅ 文件编码正确，跳过处理`);
    return true;
  }

  // 备份原文件
  const backupPath = backupFile(filePath);

  try {
    // 修复编码问题
    let cleanBuffer = removeBOM(originalBuffer);
    let cleanContent = cleanBuffer.toString('utf8');
    cleanContent = convertCRLFtoLF(cleanContent);

    // 写入修复后的文件
    fs.writeFileSync(filePath, cleanContent, 'utf8');

    // 验证修复结果
    const isValid = await validateYAML(filePath);
    if (!isValid) {
      // 回滚
      fs.copyFileSync(backupPath, filePath);
      console.log(`❌ 验证失败，已回滚: ${fileName}`);
      return false;
    }

    console.log(`✅ 修复成功: ${fileName}`);

    // 删除备份文件（成功后）
    fs.unlinkSync(backupPath);

    return true;
  } catch (error) {
    // 出错时回滚
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
    }
    console.error(`❌ 处理失败，已回滚: ${fileName} - ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始修复GitHub Actions工作流文件编码问题...\n');

  const results = [];

  for (const fileName of affectedFiles) {
    const success = await processFile(fileName);
    results.push({ fileName, success });
  }

  // 汇总结果
  console.log('\n📊 修复结果汇总:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  successful.forEach(r => console.log(`   ✅ ${r.fileName}`));
  failed.forEach(r => console.log(`   ❌ ${r.fileName}`));

  console.log(
    `\n🎯 修复完成: ${successful.length}/${results.length} 个文件成功`
  );

  if (failed.length > 0) {
    console.log('\n⚠️  部分文件修复失败，请手动检查：');
    failed.forEach(r => console.log(`   - ${r.fileName}`));
    process.exit(1);
  }

  console.log('\n✨ 所有文件修复成功！建议运行 npm run guard:ci 验证CI流程。');
}

// 执行修复
main().catch(error => {
  console.error('💥 修复过程发生错误:', error);
  process.exit(1);
});
