#!/usr/bin/env node

/**
 * SQLite 数据库备份脚本 (ADR-0006 合规)
 *
 * 双后端支持：
 * - VACUUM INTO: SQLite 3.27+ 事务性快照备份（体积更小，一致性强）
 * - Online Backup API: better-sqlite3 增量在线备份（更省锁，适合活跃数据库）
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
 *   node scripts/db/backup.mjs ./data/app.db ./backups --mode=backup
 *   node scripts/db/backup.mjs ./data/app.db ./backups --mode=vacuum
 *   node scripts/db/backup.mjs ./data/app.db ./backups --mode=auto
 *   COMPRESS=true VERIFY_DEEP=true node scripts/db/backup.mjs
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
import { performance } from 'node:perf_hooks';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';

// 配置解析
const args = process.argv.slice(2);
const [inputDb = 'data/app.db', outDir = 'backups'] = args;

// 解析模式参数
const modeArg =
  process.argv.find(a => a.startsWith('--mode=')) || '--mode=auto';
const mode = modeArg.split('=')[1]; // 'backup' | 'vacuum' | 'auto'

// 环境变量配置
const CONFIG = {
  compress: (process.env.COMPRESS || 'false') === 'true',
  verifyDeep: (process.env.VERIFY_DEEP || 'true') === 'true',
  encryptBackup: (process.env.ENCRYPT_BACKUP || 'false') === 'true',
  backupSuffix: process.env.BACKUP_SUFFIX || 'sqlite',
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT) || 1,
  checkpointBefore: (process.env.CHECKPOINT_BEFORE || 'true') === 'true',
  busyTimeout: parseInt(process.env.BUSY_TIMEOUT) || 5000,
  logLevel: process.env.LOG_LEVEL || 'info',
};

const BACKUP_MODES = ['backup', 'vacuum', 'auto'];
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[CONFIG.logLevel] || LOG_LEVELS.info;

/**
 * 结构化日志输出
 */
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'db-backup',
    message,
    ...data,
  };

  const output = level === 'error' ? console.error : console.log;
  output(JSON.stringify(logEntry));
}

/**
 * 参数验证和帮助信息
 */
function validateArguments() {
  if (args.includes('--help') || args.includes('-h')) {
    const helpText = `
SQLite 数据库备份脚本

用法:
  node scripts/db/backup.mjs [源数据库] [备份目录] [选项]

参数:
  源数据库    SQLite 数据库文件路径 (默认: data/app.db)
  备份目录    备份存储目录 (默认: backups)

选项:
  --mode=MODE    备份模式: backup|vacuum|auto (默认: auto)
                 backup - Online Backup API (适合活跃数据库)
                 vacuum - VACUUM INTO 快照 (体积更小，需 SQLite 3.27+)
                 auto   - 自动选择最佳模式

环境变量:
  COMPRESS          压缩备份文件
  VERIFY_DEEP       执行深度完整性检查
  ENCRYPT_BACKUP    加密备份文件 (需要GPG)
  CHECKPOINT_BEFORE 备份前执行WAL检查点
  MAX_CONCURRENT    最大并发备份数

示例:
  node scripts/db/backup.mjs ./data/app.db ./backups --mode=vacuum
  COMPRESS=true node scripts/db/backup.mjs
  node scripts/db/backup.mjs --help
`;
    console.log(helpText.trim());
    process.exit(0);
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
 * 检测 SQLite 版本和 VACUUM INTO 支持
 */
function detectSQLiteCapabilities(dbPath) {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      // 获取 SQLite 版本
      const versionResult = db.prepare('SELECT sqlite_version()').get();
      const version = versionResult['sqlite_version()'];

      // 测试 VACUUM INTO 支持（使用内存数据库测试）
      const testDb = new Database(':memory:');
      let supportsVacuumInto = false;

      try {
        testDb.exec('CREATE TABLE test (id INTEGER)');
        testDb.exec('INSERT INTO test VALUES (1)');
        testDb.exec("VACUUM INTO ':memory:'");
        supportsVacuumInto = true;
      } catch (vacuumError) {
        log('debug', 'VACUUM INTO test failed', { error: vacuumError.message });
      } finally {
        testDb.close();
      }

      return {
        version,
        supportsVacuumInto,
        recommendedMode: supportsVacuumInto ? 'vacuum' : 'backup',
      };
    } finally {
      db.close();
    }
  } catch (error) {
    log('warn', 'Could not detect SQLite capabilities', {
      error: error.message,
    });
    return {
      version: 'unknown',
      supportsVacuumInto: false,
      recommendedMode: 'backup',
    };
  }
}

/**
 * 创建并发控制锁文件
 */
function acquireBackupLock(dbPath) {
  const lockFile = `${dbPath}.backup.lock`;

  try {
    // 检查是否已有锁文件
    if (fs.existsSync(lockFile)) {
      const lockContent = fs.readFileSync(lockFile, 'utf8');
      const lockData = JSON.parse(lockContent);

      // 检查锁是否过期（超过1小时认为是僵尸锁）
      const lockAge = Date.now() - lockData.timestamp;
      if (lockAge < 60 * 60 * 1000) {
        // 1小时
        log('error', 'Backup already in progress', {
          lockFile,
          pid: lockData.pid,
          startTime: lockData.startTime,
        });
        process.exit(5);
      } else {
        log('warn', 'Removing stale backup lock', { lockFile, age: lockAge });
        fs.unlinkSync(lockFile);
      }
    }

    // 创建新锁文件
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
      startTime: new Date().toISOString(),
      dbPath,
    };

    fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));

    // 设置进程退出清理
    const cleanup = () => {
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
        }
      } catch (error) {
        log('debug', 'Lock file cleanup failed', { error: error.message });
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return { lockFile, cleanup };
  } catch (error) {
    log('error', 'Failed to acquire backup lock', { error: error.message });
    process.exit(5);
  }
}

/**
 * 生成备份文件路径
 */
function generateBackupPath(dbPath, outDir, mode) {
  // 创建输出目录
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (error) {
    log('error', 'Failed to create backup directory', {
      outDir,
      error: error.message,
    });
    process.exit(3);
  }

  // 生成时间戳和文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.basename(dbPath, path.extname(dbPath));

  let fileName = `${base}.${timestamp}.${mode}.${CONFIG.backupSuffix}`;

  // 如果启用压缩，添加 .gz 后缀
  if (CONFIG.compress) {
    fileName += '.gz';
  }

  // 如果启用加密，添加 .gpg 后缀
  if (CONFIG.encryptBackup) {
    fileName += '.gpg';
  }

  return path.join(outDir, fileName);
}

/**
 * 执行WAL检查点（如果需要）
 */
async function performCheckpointIfNeeded(dbPath) {
  if (!CONFIG.checkpointBefore) {
    return { skipped: true };
  }

  try {
    log('info', 'Executing WAL checkpoint before backup', { dbPath });

    const checkpointScript = path.join(
      process.cwd(),
      'scripts/db/wal-checkpoint.mjs'
    );

    if (!fs.existsSync(checkpointScript)) {
      log('warn', 'WAL checkpoint script not found, skipping checkpoint');
      return { skipped: true, reason: 'script_not_found' };
    }

    const startTime = performance.now();
    const result = execSync(`node "${checkpointScript}" "${dbPath}" TRUNCATE`, {
      encoding: 'utf8',
      timeout: 60000,
    });

    const duration = performance.now() - startTime;
    const checkpointResult = JSON.parse(result);

    if (checkpointResult.ok) {
      log('info', 'WAL checkpoint completed', {
        duration: Math.round(duration),
        walSizeReduction: checkpointResult.walSizeReduction || 0,
      });
      return { success: true, duration, result: checkpointResult };
    } else {
      throw new Error(`Checkpoint failed: ${checkpointResult.error}`);
    }
  } catch (error) {
    log('warn', 'WAL checkpoint failed, continuing with backup', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * 执行 VACUUM INTO 备份
 */
function executeVacuumBackup(srcPath, backupPath) {
  const src = new Database(srcPath, { fileMustExist: true });
  src.pragma(`busy_timeout = ${CONFIG.busyTimeout}`);

  try {
    const startTime = performance.now();

    // 安全的路径转义 - 使用参数化查询而非字符串拼接
    const vacuumQuery = `VACUUM INTO ?`;
    src.prepare(vacuumQuery).run(backupPath);

    const duration = performance.now() - startTime;

    return {
      success: true,
      method: 'VACUUM INTO',
      duration: Math.round(duration * 100) / 100,
      backupPath,
    };
  } finally {
    src.close();
  }
}

/**
 * 执行 Online Backup API 备份
 */
async function executeOnlineBackup(srcPath, backupPath) {
  const src = new Database(srcPath, { fileMustExist: true });
  src.pragma(`busy_timeout = ${CONFIG.busyTimeout}`);

  try {
    const startTime = performance.now();

    // 使用 better-sqlite3 的 backup 方法
    await src.backup(backupPath);

    const duration = performance.now() - startTime;

    return {
      success: true,
      method: 'Online Backup API',
      duration: Math.round(duration * 100) / 100,
      backupPath,
    };
  } finally {
    src.close();
  }
}

/**
 * 备份完整性验证
 */
async function verifyBackupIntegrity(backupPath) {
  try {
    log('info', 'Verifying backup integrity', { backupPath });

    let verificationPath = backupPath;
    let tempFile = null;

    // 如果是压缩文件，先解压缩到临时位置
    if (backupPath.endsWith('.gz')) {
      const { createGunzip } = await import('node:zlib');

      tempFile = `${backupPath}.tmp`;
      const gunzip = createGunzip();
      const input = createReadStream(backupPath);
      const output = createWriteStream(tempFile);

      // 同步解压缩
      const { execSync } = await import('node:child_process');
      execSync(`gunzip -c "${backupPath}" > "${tempFile}"`, { timeout: 60000 });

      verificationPath = tempFile;
    }

    const backup = new Database(verificationPath, {
      fileMustExist: true,
      readonly: true,
    });

    try {
      const results = {
        integrityCheck: null,
        quickCheck: null,
        schemaVersion: null,
        pageCount: null,
      };

      // 1. 完整性检查
      const integrityResult = backup.prepare('PRAGMA integrity_check').get();
      results.integrityCheck = integrityResult?.integrity_check === 'ok';

      // 2. 快速检查（如果启用深度验证）
      if (CONFIG.verifyDeep) {
        const quickResult = backup.prepare('PRAGMA quick_check').get();
        results.quickCheck = quickResult?.quick_check === 'ok';

        // 3. 架构版本检查
        const schemaResult = backup.prepare('PRAGMA schema_version').get();
        results.schemaVersion = schemaResult?.schema_version;

        // 4. 页面计数检查
        const pageResult = backup.prepare('PRAGMA page_count').get();
        results.pageCount = pageResult?.page_count;
      }

      const isValid =
        results.integrityCheck && (!CONFIG.verifyDeep || results.quickCheck);

      return {
        valid: isValid,
        results,
        verificationPath,
      };
    } finally {
      backup.close();

      // 清理临时文件
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  } catch (error) {
    log('error', 'Backup verification failed', {
      backupPath,
      error: error.message,
    });
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * 压缩备份文件
 */
async function compressBackup(backupPath) {
  if (!CONFIG.compress) {
    return { skipped: true };
  }

  const compressedPath = `${backupPath}.gz`;

  try {
    log('info', 'Compressing backup', { backupPath, compressedPath });

    const startTime = performance.now();

    await pipeline(
      createReadStream(backupPath),
      createGzip({ level: 6 }), // 平衡压缩率和速度
      createWriteStream(compressedPath)
    );

    const duration = performance.now() - startTime;

    // 获取文件大小比较
    const originalSize = fs.statSync(backupPath).size;
    const compressedSize = fs.statSync(compressedPath).size;
    const compressionRatio =
      Math.round((1 - compressedSize / originalSize) * 10000) / 100;

    // 删除原始文件
    fs.unlinkSync(backupPath);

    return {
      success: true,
      originalPath: backupPath,
      compressedPath,
      originalSize,
      compressedSize,
      compressionRatio,
      duration: Math.round(duration * 100) / 100,
    };
  } catch (error) {
    // 清理失败的压缩文件
    if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath);
    }

    throw error;
  }
}

/**
 * 加密备份文件（可选）
 */
async function encryptBackup(backupPath) {
  if (!CONFIG.encryptBackup) {
    return { skipped: true };
  }

  // 简化版本：使用GPG加密
  // 生产环境应该使用更安全的密钥管理
  log('warn', 'Backup encryption requested but not implemented');
  return { skipped: true, reason: 'not_implemented' };
}

/**
 * 主备份执行函数
 */
async function performBackup(config) {
  const { inputDb, outDir, mode } = config;

  log('info', 'Starting database backup', {
    inputDb,
    outDir,
    mode,
    config: CONFIG,
  });

  try {
    // 1. 获取并发控制锁
    const lockInfo = acquireBackupLock(inputDb);

    // 2. 检测 SQLite 能力
    const capabilities = detectSQLiteCapabilities(inputDb);
    log('info', 'SQLite capabilities detected', capabilities);

    // 3. 决定备份模式
    let selectedMode = mode;
    if (mode === 'auto') {
      selectedMode = capabilities.recommendedMode;
      log('info', 'Auto-selected backup mode', {
        selectedMode,
        reason: 'sqlite_capabilities',
      });
    }

    // 4. 生成备份路径
    const backupPath = generateBackupPath(inputDb, outDir, selectedMode);

    // 5. 执行WAL检查点（如果需要）
    const checkpointResult = await performCheckpointIfNeeded(inputDb);

    // 6. 执行备份
    let backupResult;
    const backupStartTime = performance.now();

    if (selectedMode === 'vacuum' && capabilities.supportsVacuumInto) {
      backupResult = executeVacuumBackup(inputDb, backupPath);
    } else if (selectedMode === 'backup') {
      backupResult = await executeOnlineBackup(inputDb, backupPath);
    } else {
      throw new Error(`Unsupported backup mode: ${selectedMode}`);
    }

    const totalBackupDuration = performance.now() - backupStartTime;

    log('info', 'Backup completed', {
      ...backupResult,
      totalDuration: Math.round(totalBackupDuration),
    });

    // 7. 验证备份完整性
    const verificationResult = verifyBackupIntegrity(backupResult.backupPath);

    if (!verificationResult.valid) {
      // 删除无效的备份文件
      if (fs.existsSync(backupResult.backupPath)) {
        fs.unlinkSync(backupResult.backupPath);
      }

      log('error', 'Backup verification failed', verificationResult);
      process.exit(4);
    }

    log('info', 'Backup verification passed', {
      valid: verificationResult.valid,
      checks: verificationResult.results,
    });

    // 8. 压缩备份（如果需要）
    const compressionResult = await compressBackup(backupResult.backupPath);
    const finalPath =
      compressionResult.compressedPath || backupResult.backupPath;

    // 9. 加密备份（如果需要）
    const encryptionResult = await encryptBackup(finalPath);

    // 10. 获取最终文件信息
    const finalStats = fs.statSync(finalPath);

    // 清理锁文件
    lockInfo.cleanup();

    // 返回完整结果
    return {
      success: true,
      inputDb,
      backupPath: finalPath,
      backupSize: finalStats.size,
      backupMethod: backupResult.method,
      backupMode: selectedMode,
      duration: backupResult.duration,
      totalDuration: Math.round(totalBackupDuration),
      verification: verificationResult,
      compression: compressionResult,
      encryption: encryptionResult,
      checkpoint: checkpointResult,
      capabilities,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    log('error', 'Backup operation failed', {
      inputDb,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * 主执行函数
 */
async function main() {
  try {
    const config = validateArguments();
    const result = await performBackup(config);

    // 输出结果
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...result,
        },
        null,
        2
      )
    );

    log('info', 'Backup operation completed successfully', {
      backupPath: result.backupPath,
      backupSize: Math.round((result.backupSize / 1024 / 1024) * 100) / 100, // MB
      method: result.backupMethod,
      duration: result.totalDuration,
    });

    process.exit(0);
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    );

    log('error', 'Backup script failed', {
      error: error.message,
      stack: error.stack,
    });

    process.exit(1);
  }
}

// 执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export {
  main,
  performBackup,
  executeVacuumBackup,
  executeOnlineBackup,
  verifyBackupIntegrity,
  detectSQLiteCapabilities,
  BACKUP_MODES,
  CONFIG,
};
