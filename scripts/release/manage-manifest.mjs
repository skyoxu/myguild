#!/usr/bin/env node

/**
 * 版本清单管理工具 - 管理 electron-updater 版本历史
 *
 * 基于 ADR-0008 渐进发布策略实现
 *
 * 功能：
 * - 添加新版本到清单文件
 * - 列出所有可用版本
 * - 验证清单文件格式
 * - 清理过期版本记录
 *
 * Usage:
 *   node scripts/release/manage-manifest.mjs add --version=1.2.3 --path=app-1.2.3.exe --sha512=... --manifest=artifacts/manifest.json
 *   node scripts/release/manage-manifest.mjs list --manifest=artifacts/manifest.json
 *   node scripts/release/manage-manifest.mjs validate --manifest=artifacts/manifest.json
 *   node scripts/release/manage-manifest.mjs cleanup --keep=5 --manifest=artifacts/manifest.json
 *
 * 相关文档：
 * - ADR-0008: 渐进发布和自动回滚策略
 * - rollback-feed.mjs: 使用清单进行版本回滚
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

/**
 * 计算文件的 SHA512 hash
 * @param {string} filePath - 文件路径
 * @returns {string} SHA512 hash (base64格式)
 */
function calculateSha512(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');
  return `sha512-${hash}`;
}

/**
 * 验证版本号格式
 * @param {string} version - 版本号
 * @returns {boolean} 是否有效
 */
function isValidVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
  return semverRegex.test(version);
}

/**
 * 解析版本号用于排序
 * @param {string} version - 版本号
 * @returns {Object} 解析后的版本对象
 */
function parseVersion(version) {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0]) || 0,
    minor: parseInt(parts[1]) || 0,
    patch: parseInt(parts[2]?.split('-')[0]) || 0,
    prerelease: version.includes('-')
      ? version.split('-').slice(1).join('-')
      : null,
  };
}

/**
 * 版本比较函数
 * @param {string} a - 版本A
 * @param {string} b - 版本B
 * @returns {number} 比较结果 (-1, 0, 1)
 */
function compareVersions(a, b) {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (versionA.major !== versionB.major) return versionA.major - versionB.major;
  if (versionA.minor !== versionB.minor) return versionA.minor - versionB.minor;
  if (versionA.patch !== versionB.patch) return versionA.patch - versionB.patch;

  // 处理预发布版本
  if (versionA.prerelease && !versionB.prerelease) return -1;
  if (!versionA.prerelease && versionB.prerelease) return 1;
  if (versionA.prerelease && versionB.prerelease) {
    return versionA.prerelease.localeCompare(versionB.prerelease);
  }

  return 0;
}

/**
 * 读取或创建清单文件
 * @param {string} manifestPath - 清单文件路径
 * @returns {Object} 清单数据
 */
function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    // 创建空清单
    const emptyManifest = {};
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(emptyManifest, null, 2),
      'utf8'
    );
    return emptyManifest;
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse manifest file: ${error.message}`);
  }
}

/**
 * 保存清单文件
 * @param {string} manifestPath - 清单文件路径
 * @param {Object} manifest - 清单数据
 */
function saveManifest(manifestPath, manifest) {
  try {
    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manifestPath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to save manifest file: ${error.message}`);
  }
}

/**
 * 添加版本到清单
 * @param {Object} options - 添加选项
 */
export function addVersion(options) {
  const { version, filePath, sha512, manifestPath, size, releaseDate } =
    options;

  if (!version || !filePath || !manifestPath) {
    throw new Error(
      'Missing required parameters: version, filePath, and manifestPath'
    );
  }

  if (!isValidVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const manifest = loadManifest(manifestPath);

  // 检查版本是否已存在
  if (manifest[version]) {
    throw new Error(`Version ${version} already exists in manifest`);
  }

  // 获取文件信息
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  const calculatedSha512 = sha512 || calculateSha512(filePath);
  const fileSize = size || stats.size;
  const releaseDateTime = releaseDate || new Date().toISOString();

  // 添加版本数据
  manifest[version] = {
    path: fileName,
    sha512: calculatedSha512,
    size: fileSize,
    releaseDate: releaseDateTime,
    files: [
      {
        url: fileName,
        sha512: calculatedSha512,
        size: fileSize,
      },
    ],
  };

  saveManifest(manifestPath, manifest);

  return {
    ok: true,
    version,
    added: true,
    manifestPath,
    versionCount: Object.keys(manifest).length,
  };
}

/**
 * 列出清单中的所有版本
 * @param {string} manifestPath - 清单文件路径
 * @returns {Object} 版本列表
 */
export function listVersions(manifestPath) {
  const manifest = loadManifest(manifestPath);
  const versions = Object.keys(manifest);

  // 按版本号排序
  versions.sort(compareVersions);

  const versionList = versions.map(version => {
    const versionData = manifest[version];
    return {
      version,
      path: versionData.path,
      size: versionData.size,
      releaseDate: versionData.releaseDate,
      sha512: versionData.sha512
        ? versionData.sha512.substring(0, 20) + '...'
        : 'N/A',
    };
  });

  return {
    ok: true,
    manifestPath,
    versionCount: versions.length,
    versions: versionList,
    latest: versions[versions.length - 1] || null,
  };
}

/**
 * 验证清单文件格式
 * @param {string} manifestPath - 清单文件路径
 * @returns {Object} 验证结果
 */
export function validateManifest(manifestPath) {
  const manifest = loadManifest(manifestPath);
  const errors = [];
  const warnings = [];

  for (const [version, versionData] of Object.entries(manifest)) {
    // 验证版本号格式
    if (!isValidVersion(version)) {
      errors.push(`Invalid version format: ${version}`);
    }

    // 验证必需字段
    const requiredFields = ['path', 'sha512'];
    for (const field of requiredFields) {
      if (!versionData[field]) {
        errors.push(`Version ${version} missing required field: ${field}`);
      }
    }

    // 验证 SHA512 格式
    if (versionData.sha512 && !versionData.sha512.startsWith('sha512-')) {
      errors.push(
        `Version ${version} has invalid SHA512 format (should start with 'sha512-')`
      );
    }

    // 验证文件数组
    if (versionData.files && !Array.isArray(versionData.files)) {
      errors.push(`Version ${version} files field must be an array`);
    }

    // 检查文件大小一致性
    if (versionData.size && versionData.files && versionData.files[0]?.size) {
      if (versionData.size !== versionData.files[0].size) {
        warnings.push(
          `Version ${version} size mismatch between main and files entry`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    manifestPath,
    versionCount: Object.keys(manifest).length,
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

/**
 * 清理过期版本
 * @param {string} manifestPath - 清单文件路径
 * @param {number} keepCount - 保留版本数量
 * @returns {Object} 清理结果
 */
export function cleanupVersions(manifestPath, keepCount = 5) {
  const manifest = loadManifest(manifestPath);
  const versions = Object.keys(manifest);

  if (versions.length <= keepCount) {
    return {
      ok: true,
      manifestPath,
      versionCount: versions.length,
      removed: [],
      kept: versions,
      message: `No cleanup needed - only ${versions.length} versions exist`,
    };
  }

  // 按版本号排序，保留最新的版本
  versions.sort(compareVersions);
  const toRemove = versions.slice(0, versions.length - keepCount);
  const toKeep = versions.slice(versions.length - keepCount);

  // 删除过期版本
  for (const version of toRemove) {
    delete manifest[version];
  }

  saveManifest(manifestPath, manifest);

  return {
    ok: true,
    manifestPath,
    versionCount: toKeep.length,
    removed: toRemove,
    kept: toKeep,
    message: `Removed ${toRemove.length} old versions, kept ${toKeep.length} latest versions`,
  };
}

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数
 * @returns {Object} 解析后的参数
 */
function parseArgs(argv) {
  const args = {
    command: argv[2],
    version: null,
    path: null,
    sha512: null,
    manifest: 'artifacts/manifest.json',
    size: null,
    releaseDate: null,
    keep: 5,
  };

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--version=')) {
      args.version = arg.split('=')[1];
    } else if (arg.startsWith('--path=')) {
      args.path = arg.split('=')[1];
    } else if (arg.startsWith('--sha512=')) {
      args.sha512 = arg.split('=')[1];
    } else if (arg.startsWith('--manifest=')) {
      args.manifest = arg.split('=')[1];
    } else if (arg.startsWith('--size=')) {
      args.size = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--release-date=')) {
      args.releaseDate = arg.split('=')[1];
    } else if (arg.startsWith('--keep=')) {
      args.keep = parseInt(arg.split('=')[1]);
    }
  }

  return args;
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
版本清单管理工具 - 管理 electron-updater 版本历史

用法:
  node scripts/release/manage-manifest.mjs <command> [options]

命令:
  add       添加新版本到清单
  list      列出所有版本
  validate  验证清单文件格式
  cleanup   清理过期版本

选项 (add):
  --version=X.Y.Z        版本号 (必需)
  --path=PATH           应用文件路径 (必需)
  --sha512=HASH         SHA512哈希 (可选，自动计算)
  --manifest=PATH       清单文件路径 (默认: artifacts/manifest.json)
  --size=BYTES          文件大小 (可选，自动获取)
  --release-date=ISO    发布日期 (可选，默认当前时间)

选项 (list/validate):
  --manifest=PATH       清单文件路径 (默认: artifacts/manifest.json)

选项 (cleanup):
  --manifest=PATH       清单文件路径 (默认: artifacts/manifest.json)
  --keep=N              保留最新版本数量 (默认: 5)

示例:
  # 添加新版本
  node scripts/release/manage-manifest.mjs add --version=1.2.3 --path=dist/app-1.2.3.exe
  
  # 列出所有版本
  node scripts/release/manage-manifest.mjs list
  
  # 验证清单格式
  node scripts/release/manage-manifest.mjs validate
  
  # 清理保留最新3个版本
  node scripts/release/manage-manifest.mjs cleanup --keep=3

清单文件格式:
  {
    "1.2.3": {
      "path": "app-1.2.3.exe",
      "sha512": "sha512-base64hash...",
      "size": 52428800,
      "releaseDate": "2025-08-29T10:00:00.000Z",
      "files": [...]
    }
  }
`);
}

// 主程序执行
if (isMainModule) {
  const args = parseArgs(process.argv);

  // 显示帮助
  if (!args.command || args.command === '--help' || args.command === '-h') {
    showHelp();
    process.exit(0);
  }

  try {
    let result;

    switch (args.command) {
      case 'add':
        if (!args.version || !args.path) {
          console.error(
            '❌ Error: --version and --path are required for add command'
          );
          process.exit(2);
        }

        result = addVersion({
          version: args.version,
          filePath: args.path,
          sha512: args.sha512,
          manifestPath: args.manifest,
          size: args.size,
          releaseDate: args.releaseDate,
        });

        console.error(`✅ Version ${result.version} added to manifest`);
        console.error(`📋 Total versions: ${result.versionCount}`);
        break;

      case 'list':
        result = listVersions(args.manifest);

        console.error(`📋 Found ${result.versionCount} versions in manifest:`);
        result.versions.forEach(v => {
          console.error(
            `  ${v.version}: ${v.path} (${(v.size / 1024 / 1024).toFixed(1)}MB, ${v.releaseDate})`
          );
        });

        if (result.latest) {
          console.error(`📦 Latest version: ${result.latest}`);
        }
        break;

      case 'validate':
        result = validateManifest(args.manifest);

        if (result.isValid) {
          console.error(
            `✅ Manifest is valid (${result.versionCount} versions)`
          );
        } else {
          console.error(`❌ Manifest validation failed:`);
          result.errors.forEach(error => console.error(`  Error: ${error}`));
        }

        if (result.warnings.length > 0) {
          console.error(`⚠️  Warnings:`);
          result.warnings.forEach(warning =>
            console.error(`  Warning: ${warning}`)
          );
        }
        break;

      case 'cleanup':
        result = cleanupVersions(args.manifest, args.keep);

        console.error(`🧹 ${result.message}`);
        if (result.removed.length > 0) {
          console.error(`Removed versions: ${result.removed.join(', ')}`);
          console.error(`Kept versions: ${result.kept.join(', ')}`);
        }
        break;

      default:
        console.error(`❌ Error: Unknown command '${args.command}'`);
        console.error('Run with --help for usage information');
        process.exit(2);
    }

    // 输出结构化结果
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);

    const errorResult = {
      ok: false,
      command: args.command,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(errorResult));
    process.exit(1);
  }
}
