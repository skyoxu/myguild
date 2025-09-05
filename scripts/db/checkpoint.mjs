#!/usr/bin/env node

/**
 * SQLite Checkpoint 管理脚本
 *
 * 基于 ADR-0006 数据存储策略实现
 *
 * 功能：
 * - WAL 模式下的 checkpoint 操作
 * - 支持 TRUNCATE 模式（冷备/轻写窗口优化）
 * - 集成质量门禁流程
 *
 * Usage:
 *   node scripts/db/checkpoint.mjs                    # 标准 checkpoint
 *   node scripts/db/checkpoint.mjs --truncate        # TRUNCATE 模式，适合 CI/nightly
 *   node scripts/db/checkpoint.mjs --database=path   # 指定数据库路径
 *
 * 相关文档：
 * - ADR-0006: 数据存储策略
 * - https://www.sqlite.org/pragma.html#pragma_wal_checkpoint
 * - TRUNCATE 模式：完全清空 WAL，适合"冷备/轻写"窗口
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

/**
 * 解析命令行参数
 * @returns {Object} 解析后的参数
 */
function parseArguments() {
  const args = {
    truncate: false,
    database: './data/game.db',
    help: false,
    verbose: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--truncate') {
      args.truncate = true;
    } else if (arg.startsWith('--database=')) {
      args.database = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    }
  }

  return args;
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
SQLite Checkpoint 管理脚本

用法:
  node scripts/db/checkpoint.mjs [选项]

选项:
  --truncate          使用 TRUNCATE 模式 checkpoint（适合 CI/nightly）
  --database=<path>   指定数据库文件路径 (默认: ./data/game.db)
  --verbose, -v       详细输出
  --help, -h          显示此帮助信息

示例:
  npm run db:checkpoint                    # 标准 checkpoint
  npm run db:checkpoint:truncate           # TRUNCATE 模式（CI 推荐）
  node scripts/db/checkpoint.mjs --database=./test.db --verbose

checkpoint 模式说明:
  - PASSIVE: 不阻塞写入，尽力而为
  - FULL: 等待所有读取完成，确保清空 WAL  
  - TRUNCATE: 完全清空并重置 WAL 文件（适合冷备/轻写窗口）

相关文档:
  - ADR-0006: 数据存储策略
  - SQLite WAL Mode: https://www.sqlite.org/wal.html
`);
}

/**
 * 执行 checkpoint 操作
 * @param {string} dbPath - 数据库文件路径
 * @param {boolean} truncate - 是否使用 TRUNCATE 模式
 * @param {boolean} verbose - 是否详细输出
 * @returns {Object} checkpoint 结果
 */
async function executeCheckpoint(dbPath, truncate = false, verbose = false) {
  // 动态导入 better-sqlite3（如果安装了的话）
  let Database;
  try {
    const sqlite3Module = await import('better-sqlite3');
    Database = sqlite3Module.default;
  } catch (error) {
    throw new Error(
      'better-sqlite3 not found. Please install: npm install better-sqlite3'
    );
  }

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  const startTime = Date.now();
  const mode = truncate ? 'TRUNCATE' : 'FULL';

  if (verbose) {
    console.error(`🔄 执行 WAL checkpoint (${mode} 模式)...`);
    console.error(`📁 数据库: ${dbPath}`);
  }

  let db;
  let result;

  try {
    db = new Database(dbPath);

    // 检查是否为 WAL 模式
    const journalMode = db.pragma('journal_mode', { simple: true });
    if (journalMode !== 'wal') {
      if (verbose) {
        console.error(`⚠️  数据库不在 WAL 模式 (当前: ${journalMode})`);
      }
      return {
        ok: true,
        skipped: true,
        reason: `Database not in WAL mode (current: ${journalMode})`,
        journalMode,
        timestamp: new Date().toISOString(),
      };
    }

    // 获取 checkpoint 前的 WAL 信息
    const preCheckpointInfo = db.pragma('wal_checkpoint', { simple: true });

    // 执行 checkpoint
    const checkpointCommand = `wal_checkpoint(${mode})`;
    const checkpointResult = db.pragma(checkpointCommand);

    // 获取 checkpoint 后的信息
    const postCheckpointInfo = db.pragma('wal_checkpoint', { simple: true });

    const duration = Date.now() - startTime;

    result = {
      ok: true,
      mode,
      duration: `${duration}ms`,
      preCheckpoint: preCheckpointInfo,
      postCheckpoint: postCheckpointInfo,
      checkpointResult,
      timestamp: new Date().toISOString(),
      database: dbPath,
    };

    if (verbose) {
      console.error(`✅ Checkpoint 完成 (${duration}ms)`);
      console.error(`📊 结果: ${JSON.stringify(checkpointResult)}`);
    }
  } finally {
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        if (verbose) {
          console.error(`⚠️  关闭数据库时出错: ${closeError.message}`);
        }
      }
    }
  }

  return result;
}

/**
 * 主函数
 */
export async function main() {
  const args = parseArguments();

  if (args.help) {
    showHelp();
    return;
  }

  try {
    const result = await executeCheckpoint(
      args.database,
      args.truncate,
      args.verbose
    );

    // 输出 JSON 结果供 CI 使用
    console.log(JSON.stringify(result, null, 2));

    if (result.skipped) {
      process.exit(0); // 跳过但不算失败
    }
  } catch (error) {
    const errorResult = {
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      database: args.database,
    };

    console.error(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

// 主程序入口
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}
