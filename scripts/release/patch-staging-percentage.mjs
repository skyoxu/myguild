#!/usr/bin/env node

/**
 * 渐进发布：更新 feed 文件的分阶段发布百分比
 * 
 * 基于 ADR-0008 渐进发布策略实现
 * 
 * 功能：
 * - 修改 electron-updater feed 文件(latest.yml/latest-mac.yml)中的 stagingPercentage
 * - 支持 0-100% 范围的分阶段发布控制
 * - 输出 JSON 格式结果用于 CI/CD 管道集成
 * 
 * Usage:
 *   node scripts/release/patch-staging-percentage.mjs dist/latest.yml 10
 *   node scripts/release/patch-staging-percentage.mjs dist/latest-mac.yml 25
 *   node scripts/release/patch-staging-percentage.mjs dist/latest.yml 100  # 全量发布
 * 
 * 参数：
 *   feedFile     - electron-updater feed 文件路径 (latest.yml/latest-mac.yml)
 *   percentage   - 分阶段发布百分比 (0-100)
 * 
 * 输出格式：
 *   { "ok": true, "feedFile": "dist/latest.yml", "stagingPercentage": 10 }
 * 
 * Exit Codes:
 *   0 - 成功
 *   1 - 文件操作失败
 *   2 - 参数错误
 * 
 * 相关资料：
 * - electron-updater stagingPercentage: https://www.electron.build/auto-update#staged-rollouts
 * - Sentry Release Health 集成: ADR-0003
 */

import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

/**
 * 验证并规范化百分比参数
 * @param {string|number} percentArg - 百分比参数
 * @returns {number} 规范化的百分比 (0-100)
 */
function validatePercentage(percentArg) {
  const pct = Number(percentArg);
  if (isNaN(pct)) {
    throw new Error(`Invalid percentage: ${percentArg}. Must be a number.`);
  }
  return Math.max(0, Math.min(100, pct));
}

/**
 * 检查文件是否为有效的 electron-updater feed 文件
 * @param {string} feedFile - feed 文件路径
 * @returns {boolean} 是否为有效的 feed 文件
 */
function isValidFeedFile(feedFile) {
  return feedFile.endsWith('.yml') && (
    feedFile.includes('latest.yml') || 
    feedFile.includes('latest-mac.yml') || 
    feedFile.includes('latest-linux.yml')
  );
}

/**
 * 修补分阶段发布百分比
 * @param {string} feedFile - feed 文件路径
 * @param {number|string} percentArg - 百分比参数
 * @returns {Object} 操作结果
 */
export function patchStagingPercentage(feedFile, percentArg) {
  try {
    // 验证参数
    if (!feedFile) {
      throw new Error('Feed file path is required');
    }
    
    if (percentArg === undefined || percentArg === null) {
      throw new Error('Percentage argument is required');
    }

    // 验证文件类型
    if (!isValidFeedFile(feedFile)) {
      console.warn(`⚠️  File ${feedFile} may not be a valid electron-updater feed file`);
    }

    // 规范化百分比
    const pct = validatePercentage(percentArg);
    
    // 读取现有文件或创建空对象
    let doc = {};
    if (fs.existsSync(feedFile)) {
      const content = fs.readFileSync(feedFile, 'utf8');
      doc = yaml.load(content) || {};
    } else {
      console.warn(`⚠️  File ${feedFile} does not exist, creating new feed file`);
    }
    
    // 设置分阶段发布百分比
    doc.stagingPercentage = pct;
    
    // 确保目录存在
    const dir = feedFile.substring(0, feedFile.lastIndexOf('/'));
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 写入文件
    fs.writeFileSync(feedFile, yaml.dump(doc), 'utf8');
    
    const result = { 
      ok: true, 
      feedFile, 
      stagingPercentage: pct,
      timestamp: new Date().toISOString()
    };
    
    return result;
    
  } catch (error) {
    throw new Error(`Failed to patch staging percentage: ${error.message}`);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
渐进发布：更新 feed 文件的分阶段发布百分比

用法:
  node scripts/release/patch-staging-percentage.mjs <feedFile> <percentage>

参数:
  feedFile      electron-updater feed 文件路径 (例: dist/latest.yml)
  percentage    分阶段发布百分比 (0-100)

示例:
  node scripts/release/patch-staging-percentage.mjs dist/latest.yml 10
  node scripts/release/patch-staging-percentage.mjs dist/latest-mac.yml 25
  node scripts/release/patch-staging-percentage.mjs dist/latest.yml 100

输出:
  JSON 格式结果用于 CI/CD 集成
  {"ok":true,"feedFile":"dist/latest.yml","stagingPercentage":10}
`);
}

// 主程序执行
if (isMainModule) {
  const [,, feedFile, percentArg] = process.argv;
  
  // 显示帮助
  if (!feedFile || feedFile === '--help' || feedFile === '-h') {
    showHelp();
    process.exit(feedFile ? 0 : 2);
  }
  
  if (!percentArg) {
    console.error('❌ Error: Percentage argument is required');
    console.error('Usage: node scripts/release/patch-staging-percentage.mjs <feedFile> <percentage>');
    process.exit(2);
  }
  
  try {
    const result = patchStagingPercentage(feedFile, percentArg);
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}