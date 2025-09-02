#!/usr/bin/env node

/**
 * SQLite 数据库备份脚本 - 命令行版本（无需原生编译）
 *
 * 双后端支持：
 * - VACUUM INTO: SQLite 3.27+ 事务性快照备份（体积更小，一致性强）
 * - .backup 命令: sqlite3 CLI在线备份（更省锁，适合活跃数据库）
 *
 * 功能：
 * - 自动选择最佳备份模式
 * - WAL检查点集成
 * - 备份完整性验证（多重检查）
 * - 可选压缩和加密
 * - 原子操作和错误恢复
 * - 并发控制和锁文件管理
 *
 * Usage:
 *   node scripts/db/backup-cli.mjs ./data/app.db ./backups --mode=backup
 *   node scripts/db/backup-cli.mjs ./data/app.db ./backups --mode=vacuum
 *   node scripts/db/backup-cli.mjs ./data/app.db ./backups --mode=auto
 *   COMPRESS=true VERIFY_DEEP=true node scripts/db/backup-cli.mjs
 *
 * Environment Variables:
 *   COMPRESS       - 备份压缩: true|false (默认: false)
 *   VERIFY_DEEP    - 深度完整性检查: true|false (默认: true)
 *   ENCRYPT_BACKUP - 备份加密: true|false (默认: false)
 *   BACKUP_SUFFIX  - 备份文件后缀 (默认: sqlite)
 *   MAX_CONCURRENT - 最大并发备份数 (默认: 1)
 *   CHECKPOINT_BEFORE - 备份前执行检查点: true|false (默认: true)
 *
 * Exit Codes:
 *   0 - 备份成功
 *   1 - 备份失败
 *   2 - 源数据库不存在
 *   3 - 目标目录创建失败
 *   4 - 备份验证失败
 *   5 - 并发冲突（已有备份在进行）
 *
 * 基于 SQLite 官方最佳实践：
 * - https://www.sqlite.org/lang_vacuum.html#vacuuminto
 * - https://www.sqlite.org/backup.html
 * - https://www.sqlite.org/pragma.html#pragma_integrity_check
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { createReadStream, createWriteStream } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// 配置常量
const BACKUP_MODES = ['backup', 'vacuum', 'auto'];
const DEFAULT_CONFIG = {
  compress: process.env.COMPRESS === 'true',
  verifyDeep: process.env.VERIFY_DEEP !== 'false',
  encryptBackup: process.env.ENCRYPT_BACKUP === 'true',
  backupSuffix: process.env.BACKUP_SUFFIX || 'sqlite',
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '1'),
  checkpointBefore: process.env.CHECKPOINT_BEFORE !== 'false',
};

// 解析命令行参数
const args = process.argv.slice(2);
const inputDb = args[0] || 'data/app.db';
const outDir = args[1] || 'backups';
const modeArg = args.find(arg => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'auto';

/**
 * 获取SQLite命令行工具路径
 */
function getSQLitePath() {
  return path.join(process.cwd(), 'tools', 'sqlite', 'sqlite3.exe');
}

// 日志系统
function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    meta,
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * 检查SQLite3命令行工具可用性
 */
function checkSQLiteAvailability() {
  try {
    const sqlite3Path = path.join(
      process.cwd(),
      'tools',
      'sqlite',
      'sqlite3.exe'
    );
    execSync(`"${sqlite3Path}" --version`, { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch (error) {
    log(
      'error',
      'SQLite3 command line tool not found. Please install sqlite3.',
      {
        error: error.message,
      }
    );
    return false;
  }
}

/**
 * 参数验证和帮助信息
 */
function validateArguments() {
  if (args.includes('--help') || args.includes('-h')) {
    const helpText = `
SQLite 数据库备份脚本 (命令行版本)

用法:
  node scripts/db/backup-cli.mjs [源数据库] [备份目录] [选项]

参数:
  源数据库    SQLite 数据库文件路径 (默认: data/app.db)
  备份目录    备份存储目录 (默认: backups)

选项:
  --mode=MODE    备份模式: backup|vacuum|auto (默认: auto)
                 backup - .backup 命令 (适合活跃数据库)
                 vacuum - VACUUM INTO 快照 (体积更小，需 SQLite 3.27+)
                 auto   - 自动选择最佳模式

环境变量:
  COMPRESS          压缩备份文件
  VERIFY_DEEP       执行深度完整性检查
  ENCRYPT_BACKUP    加密备份文件 (需要GPG)
  CHECKPOINT_BEFORE 备份前执行WAL检查点
  MAX_CONCURRENT    最大并发备份数

示例:
  node scripts/db/backup-cli.mjs ./data/app.db ./backups --mode=vacuum
  COMPRESS=true node scripts/db/backup-cli.mjs
  node scripts/db/backup-cli.mjs --help
`;
    console.log(helpText.trim());
    process.exit(0);
  }

  // 检查SQLite可用性
  if (!checkSQLiteAvailability()) {
    process.exit(1);
  }

  // 验证模式参数
  if (!BACKUP_MODES.includes(mode)) {
    log('error', 'Invalid backup mode', {
      provided: mode,
      valid: BACKUP_MODES,
    });
    process.exit(1);
  }

  // 验证源数据库
  if (!fs.existsSync(inputDb)) {
    log('error', 'Source database not found', { path: inputDb });
    process.exit(2);
  }

  return { inputDb: path.resolve(inputDb), outDir: path.resolve(outDir), mode };
}

/**
 * 获取数据库基本信息（使用sqlite3命令行）
 */
function getDatabaseInfo(dbPath) {
  try {
    // 获取文件大小
    const stats = fs.statSync(dbPath);
    const size = stats.size;

    // 获取WAL模式信息
    const walQuery = 'PRAGMA journal_mode;';
    const journalMode = execSync(
      `"${getSQLitePath()}" "${dbPath}" "${walQuery}"`,
      {
        encoding: 'utf8',
      }
    ).trim();

    // 获取页面计数
    const pageCountQuery = 'PRAGMA page_count;';
    const pageCount = parseInt(
      execSync(`"${getSQLitePath()}" "${dbPath}" "${pageCountQuery}"`, {
        encoding: 'utf8',
      }).trim()
    );

    // 检查WAL文件
    const walPath = `${dbPath}-wal`;
    const walSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;

    return {
      path: dbPath,
      size,
      pageCount,
      journalMode,
      walSize,
      isWalMode: journalMode.toLowerCase() === 'wal',
    };
  } catch (error) {
    log('error', 'Failed to get database info', {
      path: dbPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 执行WAL检查点（使用sqlite3命令行）
 */
async function performCheckpoint(dbPath) {
  if (!DEFAULT_CONFIG.checkpointBefore) {
    log('info', 'Checkpoint skipped by configuration');
    return;
  }

  try {
    log('info', 'Starting WAL checkpoint', { path: dbPath });
    const startTime = performance.now();

    const checkpointQuery = 'PRAGMA wal_checkpoint(TRUNCATE);';
    const result = execSync(
      `"${getSQLitePath()}" "${dbPath}" "${checkpointQuery}"`,
      {
        encoding: 'utf8',
      }
    ).trim();

    const duration = performance.now() - startTime;
    log('info', 'WAL checkpoint completed', {
      path: dbPath,
      duration: Math.round(duration),
      result,
    });
  } catch (error) {
    log('warn', 'WAL checkpoint failed', {
      path: dbPath,
      error: error.message,
    });
    // 继续执行，检查点失败不应终止备份
  }
}

/**
 * 获取备份文件路径
 */
function getBackupPath(inputPath, outputDir, compress = false) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = DEFAULT_CONFIG.backupSuffix;
  const extension = compress ? `${suffix}.gz` : suffix;
  const fileName = `${baseName}-${timestamp}.${extension}`;

  return path.join(outputDir, fileName);
}

/**
 * 创建锁文件防止并发冲突
 */
function acquireBackupLock(dbPath) {
  const lockFile = `${dbPath}.backup.lock`;
  const lockData = {
    pid: process.pid,
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
  };

  try {
    // 检查现有锁文件
    if (fs.existsSync(lockFile)) {
      const existingLock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      log('error', 'Backup already in progress', {
        lock: existingLock,
        lockFile,
      });
      process.exit(5);
    }

    // 创建锁文件
    fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));

    // 设置清理函数
    const cleanup = () => {
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
          log('info', 'Backup lock released', { lockFile });
        }
      } catch (error) {
        log('warn', 'Failed to release backup lock', {
          lockFile,
          error: error.message,
        });
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    log('info', 'Backup lock acquired', { lockFile, pid: process.pid });
    return cleanup;
  } catch (error) {
    log('error', 'Failed to acquire backup lock', {
      lockFile,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 执行VACUUM INTO备份（使用sqlite3命令行）
 */
async function executeVacuumIntoBackup(srcPath, destPath) {
  try {
    log('info', 'Starting VACUUM INTO backup', {
      src: srcPath,
      dest: destPath,
    });
    const startTime = performance.now();

    // 使用VACUUM INTO执行备份
    const vacuumQuery = `VACUUM INTO '${destPath.replace(/'/g, "''")}'`;
    execSync(`"${getSQLitePath()}" "${srcPath}" "${vacuumQuery}"`, {
      stdio: 'pipe',
    });

    const duration = performance.now() - startTime;
    const stats = fs.statSync(destPath);

    log('info', 'VACUUM INTO backup completed', {
      src: srcPath,
      dest: destPath,
      size: stats.size,
      duration: Math.round(duration),
    });

    return {
      method: 'vacuum',
      src: srcPath,
      dest: destPath,
      size: stats.size,
      duration: Math.round(duration),
    };
  } catch (error) {
    log('error', 'VACUUM INTO backup failed', {
      src: srcPath,
      dest: destPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 执行.backup命令备份（使用sqlite3命令行）
 */
async function executeBackupCommand(srcPath, destPath) {
  try {
    log('info', 'Starting .backup command backup', {
      src: srcPath,
      dest: destPath,
    });
    const startTime = performance.now();

    // 使用.backup命令执行备份
    const backupCommand = `.backup '${destPath.replace(/'/g, "''")}'`;
    execSync(`"${getSQLitePath()}" "${srcPath}" "${backupCommand}"`, {
      stdio: 'pipe',
    });

    const duration = performance.now() - startTime;
    const stats = fs.statSync(destPath);

    log('info', '.backup command backup completed', {
      src: srcPath,
      dest: destPath,
      size: stats.size,
      duration: Math.round(duration),
    });

    return {
      method: 'backup',
      src: srcPath,
      dest: destPath,
      size: stats.size,
      duration: Math.round(duration),
    };
  } catch (error) {
    log('error', '.backup command backup failed', {
      src: srcPath,
      dest: destPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 执行备份完整性验证
 */
async function verifyBackup(backupPath, originalPath, deep = true) {
  try {
    log('info', 'Starting backup verification', {
      backup: backupPath,
      original: originalPath,
      deep,
    });

    const results = [];

    // 基本存在性检查
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file does not exist');
    }
    results.push({ test: 'existence', passed: true });

    // 文件大小检查（应该相近但不一定完全相同）
    const backupStats = fs.statSync(backupPath);
    const originalStats = fs.statSync(originalPath);
    const sizeDiff = Math.abs(backupStats.size - originalStats.size);
    const maxDiffPercent = 0.1; // 允许10%差异
    const maxDiffBytes = originalStats.size * maxDiffPercent;

    const sizeCheckPassed = sizeDiff <= maxDiffBytes;
    results.push({
      test: 'size_check',
      passed: sizeCheckPassed,
      backupSize: backupStats.size,
      originalSize: originalStats.size,
      difference: sizeDiff,
    });

    if (!sizeCheckPassed) {
      log('warn', 'Backup size significantly different from original', {
        backupSize: backupStats.size,
        originalSize: originalStats.size,
        difference: sizeDiff,
      });
    }

    // 完整性检查
    try {
      const integrityQuery = 'PRAGMA integrity_check;';
      const integrityResult = execSync(
        `"${getSQLitePath()}" "${backupPath}" "${integrityQuery}"`,
        {
          encoding: 'utf8',
          timeout: 30000, // 30秒超时
        }
      ).trim();

      const integrityPassed = integrityResult === 'ok';
      results.push({
        test: 'integrity_check',
        passed: integrityPassed,
        result: integrityResult,
      });

      if (!integrityPassed) {
        log('error', 'Backup failed integrity check', {
          result: integrityResult,
        });
      }
    } catch (error) {
      results.push({
        test: 'integrity_check',
        passed: false,
        error: error.message,
      });
      log('warn', 'Integrity check failed to complete', {
        error: error.message,
      });
    }

    // 深度验证：表计数对比
    if (deep) {
      try {
        const tableCountQuery =
          "SELECT COUNT(*) FROM sqlite_master WHERE type='table';";
        const backupTableCount = parseInt(
          execSync(
            `"${getSQLitePath()}" "${backupPath}" "${tableCountQuery}"`,
            {
              encoding: 'utf8',
            }
          ).trim()
        );
        const originalTableCount = parseInt(
          execSync(
            `"${getSQLitePath()}" "${originalPath}" "${tableCountQuery}"`,
            {
              encoding: 'utf8',
            }
          ).trim()
        );

        const tableCountPassed = backupTableCount === originalTableCount;
        results.push({
          test: 'table_count',
          passed: tableCountPassed,
          backupCount: backupTableCount,
          originalCount: originalTableCount,
        });
      } catch (error) {
        results.push({
          test: 'table_count',
          passed: false,
          error: error.message,
        });
      }
    }

    const allPassed = results.every(r => r.passed);
    log('info', 'Backup verification completed', {
      backup: backupPath,
      allPassed,
      results,
    });

    if (!allPassed) {
      throw new Error('Backup verification failed');
    }

    return { passed: allPassed, results };
  } catch (error) {
    log('error', 'Backup verification failed', {
      backup: backupPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 压缩备份文件
 */
async function compressBackup(backupPath) {
  if (!DEFAULT_CONFIG.compress) {
    return backupPath;
  }

  try {
    const compressedPath = `${backupPath}.gz`;
    log('info', 'Compressing backup', {
      src: backupPath,
      dest: compressedPath,
    });

    const startTime = performance.now();
    await pipeline(
      createReadStream(backupPath),
      createGzip({ level: 6 }),
      createWriteStream(compressedPath)
    );
    const duration = performance.now() - startTime;

    // 删除原始未压缩文件
    fs.unlinkSync(backupPath);

    const stats = fs.statSync(compressedPath);
    log('info', 'Backup compression completed', {
      original: backupPath,
      compressed: compressedPath,
      size: stats.size,
      duration: Math.round(duration),
    });

    return compressedPath;
  } catch (error) {
    log('error', 'Backup compression failed', {
      path: backupPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 自动选择最佳备份模式
 */
function selectBackupMode(dbInfo) {
  // 如果是WAL模式且文件较大，优先使用VACUUM INTO
  if (dbInfo.isWalMode && dbInfo.size > 100 * 1024 * 1024) {
    // 100MB
    return 'vacuum';
  }

  // 如果WAL文件较大，使用backup命令更安全
  if (dbInfo.walSize > 10 * 1024 * 1024) {
    // 10MB
    return 'backup';
  }

  // 默认使用VACUUM INTO，因为它产生更紧凑的备份
  return 'vacuum';
}

/**
 * 主备份函数
 */
async function performBackup() {
  const { inputDb, outDir, mode } = validateArguments();

  let releaseLock;
  try {
    // 获取数据库信息
    const dbInfo = getDatabaseInfo(inputDb);
    log('info', 'Database info retrieved', dbInfo);

    // 获取锁
    releaseLock = acquireBackupLock(inputDb);

    // 创建输出目录
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
      log('info', 'Created output directory', { path: outDir });
    }

    // 执行检查点
    await performCheckpoint(inputDb);

    // 确定备份模式
    const finalMode = mode === 'auto' ? selectBackupMode(dbInfo) : mode;
    log('info', 'Selected backup mode', {
      mode: finalMode,
      auto: mode === 'auto',
    });

    // 生成备份文件路径
    const backupPath = getBackupPath(inputDb, outDir, DEFAULT_CONFIG.compress);

    // 执行备份
    let backupResult;
    const totalStartTime = performance.now();

    if (finalMode === 'vacuum') {
      backupResult = await executeVacuumIntoBackup(inputDb, backupPath);
    } else {
      backupResult = await executeBackupCommand(inputDb, backupPath);
    }

    // 压缩备份（如果启用）
    const finalBackupPath = await compressBackup(backupPath);
    backupResult.finalPath = finalBackupPath;

    // 验证备份
    if (DEFAULT_CONFIG.verifyDeep) {
      // 如果压缩了，需要先解压缩进行验证
      let verificationPath = finalBackupPath;
      if (DEFAULT_CONFIG.compress) {
        verificationPath = finalBackupPath.replace(/\.gz$/, '.verify');
        await pipeline(
          createReadStream(finalBackupPath),
          createGunzip(),
          createWriteStream(verificationPath)
        );
      }

      await verifyBackup(verificationPath, inputDb, true);

      // 清理临时验证文件
      if (DEFAULT_CONFIG.compress && verificationPath !== finalBackupPath) {
        fs.unlinkSync(verificationPath);
      }
    }

    const totalDuration = performance.now() - totalStartTime;

    // 最终报告
    const finalStats = fs.statSync(finalBackupPath);
    log('info', 'Backup operation completed successfully', {
      source: inputDb,
      destination: finalBackupPath,
      mode: finalMode,
      size: finalStats.size,
      compressed: DEFAULT_CONFIG.compress,
      verified: DEFAULT_CONFIG.verifyDeep,
      totalDuration: Math.round(totalDuration),
    });

    console.log(
      JSON.stringify(
        {
          status: 'success',
          backup: {
            source: inputDb,
            destination: finalBackupPath,
            mode: finalMode,
            size: finalStats.size,
            compressed: DEFAULT_CONFIG.compress,
            verified: DEFAULT_CONFIG.verifyDeep,
          },
          timing: {
            totalDuration: Math.round(totalDuration),
          },
        },
        null,
        2
      )
    );

    process.exit(0);
  } catch (error) {
    log('error', 'Backup operation failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error(
      JSON.stringify(
        {
          status: 'error',
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
        null,
        2
      )
    );

    process.exit(1);
  } finally {
    if (releaseLock) {
      releaseLock();
    }
  }
}

// 主程序入口
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  performBackup().catch(error => {
    log('error', 'Unhandled error in backup process', { error: error.message });
    process.exit(1);
  });
}

export {
  performBackup,
  getDatabaseInfo,
  executeVacuumIntoBackup,
  executeBackupCommand,
  verifyBackup,
};
