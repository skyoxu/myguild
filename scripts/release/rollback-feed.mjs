#!/usr/bin/env node

/**
 * Feed 版本回滚脚本 - 将更新 feed 回滚到指定稳定版本
 *
 * 基于 ADR-0008 渐进发布策略实现
 *
 * 功能：
 * - 从版本清单读取指定版本的文件信息
 * - 更新 electron-updater feed 文件指向上一稳定版本
 * - 设置 stagingPercentage=0 立即停止当前版本分发
 * - 输出结构化结果用于自动化流程
 *
 * Usage:
 *   node scripts/release/rollback-feed.mjs dist/latest.yml artifacts/manifest.json 1.1.0
 *   node scripts/release/rollback-feed.mjs dist/latest-mac.yml artifacts/manifest.json 1.1.0
 *
 * 参数：
 *   feedFile      - electron-updater feed 文件路径 (必需)
 *   manifestFile  - 版本清单文件路径 (必需)
 *   prevVersion   - 要回滚到的版本号 (必需)
 *
 * 版本清单格式 (manifest.json):
 *   {
 *     "1.2.2": {
 *       "path": "app-1.2.2.exe",
 *       "sha512": "abc123...",
 *       "size": 52428800,
 *       "releaseDate": "2025-08-15T10:00:00.000Z",
 *       "files": [...]
 *     },
 *     "1.2.3": { ... }
 *   }
 *
 * 输出格式：
 *   {"ok":true,"rolledBackTo":"1.1.0","feedFile":"dist/latest.yml","timestamp":"..."}
 *
 * 相关文档：
 * - ADR-0008: 渐进发布和自动回滚策略
 * - electron-updater Feed Format
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

/**
 * 验证 electron-updater feed 文件名
 * @param {string} feedFile - feed 文件路径
 * @returns {boolean} 是否为有效的 feed 文件名
 */
function isValidFeedFile(feedFile) {
  const validNames = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'];
  const baseName = path.basename(feedFile);
  return validNames.includes(baseName);
}

/**
 * 验证版本号格式 (语义化版本)
 * @param {string} version - 版本号
 * @returns {boolean} 是否为有效版本号
 */
function isValidVersion(version) {
  // 简单的语义化版本验证
  const semverRegex = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
  return semverRegex.test(version);
}

/**
 * 回滚 feed 文件到指定版本
 * @param {string} feedFile - feed 文件路径
 * @param {string} manifestFile - 版本清单文件路径
 * @param {string} prevVersion - 目标版本号
 * @returns {Object} 回滚结果
 */
export function rollbackFeed(feedFile, manifestFile, prevVersion) {
  // 参数验证
  if (!feedFile || !manifestFile || !prevVersion) {
    throw new Error(
      'Missing required parameters: feedFile, manifestFile, and prevVersion are required'
    );
  }

  if (!isValidVersion(prevVersion)) {
    throw new Error(
      `Invalid version format: ${prevVersion}. Expected semantic version (e.g., 1.2.3)`
    );
  }

  if (!isValidFeedFile(feedFile)) {
    throw new Error(
      `Invalid feed file: ${feedFile}. Expected latest.yml, latest-mac.yml, or latest-linux.yml`
    );
  }

  // 检查文件存在性
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Version manifest file not found: ${manifestFile}`);
  }

  let feed = {};
  let manifest = {};

  try {
    // 读取现有 feed 文件（如果存在）
    if (fs.existsSync(feedFile)) {
      const feedContent = fs.readFileSync(feedFile, 'utf8');
      feed = yaml.load(feedContent) || {};
    }

    // 读取版本清单
    const manifestContent = fs.readFileSync(manifestFile, 'utf8');
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    throw new Error(`Failed to read files: ${error.message}`);
  }

  // 验证目标版本在清单中存在
  const prevVersionData = manifest[prevVersion];
  if (!prevVersionData) {
    const availableVersions = Object.keys(manifest).join(', ');
    throw new Error(
      `Version ${prevVersion} not found in manifest. Available versions: ${availableVersions}`
    );
  }

  // 验证版本数据完整性
  const requiredFields = ['path', 'sha512'];
  const missingFields = requiredFields.filter(field => !prevVersionData[field]);
  if (missingFields.length > 0) {
    throw new Error(
      `Version ${prevVersion} missing required fields: ${missingFields.join(', ')}`
    );
  }

  // 记录当前版本（用于日志）
  const currentVersion = feed.version || 'unknown';

  try {
    // 更新 feed 文件内容
    feed.version = prevVersion;
    feed.path = prevVersionData.path;
    feed.sha512 = prevVersionData.sha512;
    feed.stagingPercentage = 0; // 立即停止新版本分发

    // 可选字段更新
    if (prevVersionData.size) {
      feed.size = prevVersionData.size;
    }

    if (prevVersionData.releaseDate) {
      feed.releaseDate = prevVersionData.releaseDate;
    }

    if (prevVersionData.files && Array.isArray(prevVersionData.files)) {
      feed.files = prevVersionData.files;
    }

    // 确保父目录存在
    const feedDir = path.dirname(feedFile);
    if (!fs.existsSync(feedDir)) {
      fs.mkdirSync(feedDir, { recursive: true });
    }

    // 写入更新后的 feed 文件
    const yamlContent = yaml.dump(feed, {
      indent: 2,
      lineWidth: -1, // 不限制行宽
      noRefs: true, // 避免引用
    });

    fs.writeFileSync(feedFile, yamlContent, 'utf8');

    return {
      ok: true,
      rolledBackTo: prevVersion,
      previousVersion: currentVersion,
      feedFile,
      manifestFile,
      timestamp: new Date().toISOString(),
      versionData: {
        version: prevVersion,
        path: prevVersionData.path,
        sha512: prevVersionData.sha512.substring(0, 16) + '...', // 截断显示
        stagingPercentage: 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to update feed file: ${error.message}`);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
Feed 版本回滚脚本 - 将更新 feed 回滚到指定稳定版本

用法:
  node scripts/release/rollback-feed.mjs <feedFile> <manifestFile> <prevVersion>

参数:
  feedFile      electron-updater feed 文件路径 (必需)
                支持: latest.yml, latest-mac.yml, latest-linux.yml
  manifestFile  版本清单 JSON 文件路径 (必需)
  prevVersion   要回滚到的版本号 (必需，语义化版本)

版本清单格式 (manifest.json):
  {
    "1.2.2": {
      "path": "app-1.2.2.exe",
      "sha512": "sha512-base64-hash...",
      "size": 52428800,
      "releaseDate": "2025-08-15T10:00:00.000Z",
      "files": [...]
    }
  }

示例:
  # 回滚 Windows 版本到 1.1.0
  node scripts/release/rollback-feed.mjs dist/latest.yml artifacts/manifest.json 1.1.0
  
  # 回滚 macOS 版本到 1.1.0
  node scripts/release/rollback-feed.mjs dist/latest-mac.yml artifacts/manifest.json 1.1.0
  
  # 回滚 Linux 版本到 1.1.0
  node scripts/release/rollback-feed.mjs dist/latest-linux.yml artifacts/manifest.json 1.1.0

输出格式:
  成功时输出 JSON 格式结果到 stdout
  错误信息输出到 stderr

相关脚本:
  - patch-staging-percentage.mjs  修改分阶段发布百分比
  - execute-rollback.mjs         完整回滚流程（含版本回退）
  - auto-rollback.mjs           基于健康度的自动回滚决策
`);
}

// 主程序执行
if (isMainModule) {
  const [, , feedFile, manifestFile, prevVersion] = process.argv;

  // 显示帮助
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // 验证参数
  if (!feedFile || !manifestFile || !prevVersion) {
    console.error('❌ Error: Missing required parameters');
    console.error(
      'Usage: node scripts/release/rollback-feed.mjs <feedFile> <manifestFile> <prevVersion>'
    );
    console.error('Run with --help for detailed usage information');
    process.exit(2);
  }

  try {
    const result = rollbackFeed(feedFile, manifestFile, prevVersion);

    // 输出成功信息到 stderr（用户可见）
    console.error(`✅ Feed rollback completed successfully`);
    console.error(
      `📦 Rolled back from ${result.previousVersion} to ${result.rolledBackTo}`
    );
    console.error(`📄 Updated feed file: ${result.feedFile}`);
    console.error(`🛑 Staging percentage set to: 0% (immediate stop)`);

    // 输出结构化结果到 stdout（供脚本使用）
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);

    const errorResult = {
      ok: false,
      error: error.message,
      feedFile: feedFile || 'unknown',
      manifestFile: manifestFile || 'unknown',
      targetVersion: prevVersion || 'unknown',
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(errorResult));
    process.exit(1);
  }
}
