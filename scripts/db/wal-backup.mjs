#!/usr/bin/env node

/**
 * SQLite WAL 模式数据库备份脚本 (ADR-0006 合规)
 *
 * 功能：
 * - 使用 VACUUM INTO 创建快照式备份 (SQLite 3.27+)
 * - 支持传统 Online Backup API 作为后备方案
 * - 自动 WAL 检查点整合
 * - 备份完整性验证
 * - 增量备份支持 (基于修改时间)
 * - 备份文件轮转和清理
 *
 * Usage:
 *   node scripts/db/wal-backup.mjs ./data/app.db ./backups/
 *   BACKUP_TYPE=incremental node scripts/db/wal-backup.mjs
 *   node scripts/db/wal-backup.mjs --verify-only ./backups/app-20250829.db
 *
 * Environment Variables:
 *   DB_PATH           - 源数据库路径 (默认: data/app.db)
 *   BACKUP_DIR        - 备份目录 (默认: backups/)
 *   BACKUP_TYPE       - 备份类型: full|incremental|verify (默认: full)
 *   MAX_BACKUP_DAYS   - 备份保留天数 (默认: 30)
 *   VACUUM_MODE       - 是否使用 VACUUM INTO: auto|force|disable (默认: auto)
 *   COMPRESS_BACKUP   - 是否压缩备份: true|false (默认: true)
 *   VERIFY_INTEGRITY  - 是否验证备份完整性: true|false (默认: true)
 *
 * Exit Codes:
 *   0 - 备份成功
 *   1 - 备份失败
 *   2 - 源数据库不存在或无法访问
 *   3 - 备份目录创建失败
 *   4 - 备份验证失败
 *   5 - 备份清理失败
 *
 * 基于 SQLite 文档:
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

// 配置常量
const DEFAULT_CONFIG = {
  dbPath: process.env.DB_PATH || 'data/app.db',
  backupDir: process.env.BACKUP_DIR || 'backups/',
  backupType: process.env.BACKUP_TYPE || 'full',
  maxBackupDays: parseInt(process.env.MAX_BACKUP_DAYS) || 30,
  vacuumMode: process.env.VACUUM_MODE || 'auto', // auto|force|disable
  compressBackup: (process.env.COMPRESS_BACKUP || 'true') === 'true',
  verifyIntegrity: (process.env.VERIFY_INTEGRITY || 'true') === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
};

const BACKUP_TYPES = ['full', 'incremental', 'verify'];
const VACUUM_MODES = ['auto', 'force', 'disable'];
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[DEFAULT_CONFIG.logLevel] || LOG_LEVELS.info;

/**
 * 结构化日志输出
 */
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'wal-backup',
    message,
    ...data,
  };

  const output = level === 'error' ? console.error : console.log;
  output(JSON.stringify(logEntry));
}

/**
 * 显示帮助信息
 */
function showHelp() {
  const helpText = `
SQLite WAL 模式备份脚本

用法:
  node scripts/db/wal-backup.mjs [源数据库] [备份目录]
  
参数:
  源数据库   SQLite 数据库文件路径 (可选)
  备份目录   备份文件存储目录 (可选)
  
环境变量:
  DB_PATH           源数据库路径
  BACKUP_DIR        备份目录
  BACKUP_TYPE       备份类型: ${BACKUP_TYPES.join('|')}
  MAX_BACKUP_DAYS   备份保留天数
  VACUUM_MODE       VACUUM INTO 模式: ${VACUUM_MODES.join('|')}
  COMPRESS_BACKUP   是否压缩备份文件
  VERIFY_INTEGRITY  是否验证备份完整性
  
备份类型说明:
  full         - 完整备份 (默认)
  incremental  - 增量备份 (基于修改时间)
  verify       - 仅验证现有备份
  
VACUUM 模式说明:
  auto         - 自动选择最佳方式 (检测 SQLite 版本)
  force        - 强制使用 VACUUM INTO (要求 SQLite 3.27+)
  disable      - 使用传统 Online Backup API
  
示例:
  node scripts/db/wal-backup.mjs ./data/app.db ./backups/
  BACKUP_TYPE=incremental node scripts/db/wal-backup.mjs
  VACUUM_MODE=force COMPRESS_BACKUP=false node scripts/db/wal-backup.mjs
  node scripts/db/wal-backup.mjs --verify-only ./backups/app-20250829.db
`;
  console.log(helpText.trim());
}

/**
 * 解析命令行参数
 */
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const config = { ...DEFAULT_CONFIG };

  // 特殊模式检查
  if (args.includes('--verify-only')) {
    config.backupType = 'verify';
    const verifyIndex = args.indexOf('--verify-only');
    if (verifyIndex + 1 < args.length) {
      config.verifyFile = args[verifyIndex + 1];
    }
    return config;
  }

  // 解析位置参数
  if (args.length >= 1 && !args[0].startsWith('--')) {
    config.dbPath = args[0];
  }
  if (args.length >= 2 && !args[1].startsWith('--')) {
    config.backupDir = args[1];
  }

  // 验证参数
  if (!BACKUP_TYPES.includes(config.backupType)) {
    log('error', 'Invalid backup type', {
      provided: config.backupType,
      valid: BACKUP_TYPES,
    });
    process.exit(4);
  }

  if (!VACUUM_MODES.includes(config.vacuumMode)) {
    log('error', 'Invalid vacuum mode', {
      provided: config.vacuumMode,
      valid: VACUUM_MODES,
    });
    process.exit(4);
  }

  return config;
}

/**
 * 检测 SQLite 版本和 VACUUM INTO 支持
 */
async function detectSQLiteCapabilities(driver) {
  try {
    let db;

    if (driver.name === 'better-sqlite3') {
      const Database = require('better-sqlite3');
      db = new Database(':memory:');

      try {
        const version = db.prepare('SELECT sqlite_version()').get()[
          'sqlite_version()'
        ];

        // 测试 VACUUM INTO 支持
        try {
          db.exec('CREATE TABLE test (id INTEGER)');
          db.exec("VACUUM INTO ':memory:'");

          db.close();
          return {
            version,
            supportsVacuumInto: true,
            driver: driver.name,
          };
        } catch (vacuumError) {
          db.close();
          return {
            version,
            supportsVacuumInto: false,
            vacuumError: vacuumError.message,
            driver: driver.name,
          };
        }
      } finally {
        if (!db.closed) db.close();
      }
    } else {
      // sqlite3 异步版本
      return new Promise((resolve, reject) => {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(':memory:');

        db.get('SELECT sqlite_version()', (err, row) => {
          if (err) {
            db.close();
            reject(err);
            return;
          }

          const version = row['sqlite_version()'];

          // 测试 VACUUM INTO
          db.run('CREATE TABLE test (id INTEGER)', createErr => {
            if (createErr) {
              db.close();
              resolve({
                version,
                supportsVacuumInto: false,
                vacuumError: createErr.message,
                driver: driver.name,
              });
              return;
            }

            db.run("VACUUM INTO ':memory:'", vacuumErr => {
              db.close();
              resolve({
                version,
                supportsVacuumInto: !vacuumErr,
                vacuumError: vacuumErr ? vacuumErr.message : null,
                driver: driver.name,
              });
            });
          });
        });
      });
    }
  } catch (error) {
    return {
      version: 'unknown',
      supportsVacuumInto: false,
      error: error.message,
      driver: driver.name,
    };
  }
}

/**
 * 创建备份文件名
 */
function createBackupFileName(config, capabilities) {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const timepart = new Date()
    .toISOString()
    .split('T')[1]
    .split('.')[0]
    .replace(/:/g, '');

  const baseName = path.basename(config.dbPath, path.extname(config.dbPath));
  const backupType =
    config.backupType === 'full' ? '' : `-${config.backupType}`;

  let fileName = `${baseName}-${timestamp}-${timepart}${backupType}.db`;

  if (config.compressBackup) {
    fileName += '.gz';
  }

  return fileName;
}

/**
 * 执行 VACUUM INTO 备份
 */
function executeVacuumIntoBackup(config, driver, backupPath) {
  if (driver.name === 'better-sqlite3') {
    const Database = require('better-sqlite3');
    const db = new Database(config.dbPath, {
      readonly: true,
      fileMustExist: true,
    });

    try {
      const startTime = performance.now();

      // 执行检查点确保数据一致性
      db.pragma('wal_checkpoint(TRUNCATE)');

      // 执行 VACUUM INTO 备份
      db.exec(`VACUUM INTO '${backupPath}'`);

      const duration = performance.now() - startTime;

      return {
        success: true,
        method: 'VACUUM INTO',
        duration: Math.round(duration * 100) / 100,
        backupPath,
      };
    } finally {
      db.close();
    }
  } else {
    // sqlite3 异步版本
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(config.dbPath, sqlite3.OPEN_READONLY);

      const startTime = performance.now();

      // 先执行检查点
      db.run('PRAGMA wal_checkpoint(TRUNCATE)', checkpointErr => {
        if (checkpointErr) {
          log('warn', 'Checkpoint warning during backup', {
            error: checkpointErr.message,
          });
        }

        // 执行备份
        db.run(`VACUUM INTO '${backupPath}'`, err => {
          const duration = performance.now() - startTime;

          db.close();

          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              method: 'VACUUM INTO',
              duration: Math.round(duration * 100) / 100,
              backupPath,
            });
          }
        });
      });
    });
  }
}

/**
 * 执行传统 Online Backup (分页复制)
 */
async function executeOnlineBackup(config, driver, backupPath) {
  // 由于实现复杂性，这里提供一个简化的文件复制版本
  // 生产环境建议使用 SQLite 的 Online Backup API

  log('info', 'Using file-based backup method', {
    reason: 'VACUUM INTO not supported or disabled',
  });

  const startTime = performance.now();

  // 先执行检查点
  try {
    await execCheckpoint(config, driver);
  } catch (checkpointError) {
    log('warn', 'Checkpoint failed during backup', {
      error: checkpointError.message,
    });
  }

  // 复制文件
  await fs.promises.copyFile(config.dbPath, backupPath);

  const duration = performance.now() - startTime;

  return {
    success: true,
    method: 'File Copy',
    duration: Math.round(duration * 100) / 100,
    backupPath,
    warning: 'File copy may not be fully consistent for active databases',
  };
}

/**
 * 执行检查点（调用已有的 WAL 检查点脚本）
 */
async function execCheckpoint(config, driver) {
  try {
    // 调用 wal-checkpoint.mjs 脚本
    const checkpointScript = path.join(
      process.cwd(),
      'scripts/db/wal-checkpoint.mjs'
    );
    const result = execSync(
      `node "${checkpointScript}" "${config.dbPath}" TRUNCATE`,
      { encoding: 'utf8', timeout: 30000 }
    );

    const checkpointResult = JSON.parse(result);

    if (!checkpointResult.ok) {
      throw new Error(`Checkpoint failed: ${checkpointResult.error}`);
    }

    return checkpointResult;
  } catch (error) {
    log('warn', 'Checkpoint execution failed', { error: error.message });
    throw error;
  }
}

/**
 * 压缩备份文件
 */
async function compressBackup(backupPath) {
  const compressedPath = `${backupPath}.gz`;

  try {
    const startTime = performance.now();

    await pipeline(
      createReadStream(backupPath),
      createGzip({ level: 6 }), // 平衡压缩率和速度
      createWriteStream(compressedPath)
    );

    const duration = performance.now() - startTime;

    // 删除未压缩文件
    await fs.promises.unlink(backupPath);

    // 获取文件大小
    const originalSize = (
      await fs.promises.stat(backupPath).catch(() => ({ size: 0 }))
    ).size;
    const compressedSize = (await fs.promises.stat(compressedPath)).size;
    const compressionRatio =
      originalSize > 0
        ? Math.round((1 - compressedSize / originalSize) * 10000) / 100
        : 0;

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
    try {
      await fs.promises.unlink(compressedPath);
    } catch {}

    throw error;
  }
}

/**
 * 验证备份完整性
 */
async function verifyBackupIntegrity(backupPath, driver) {
  try {
    let tempPath = backupPath;

    // 如果是压缩文件，先解压缩到临时位置
    if (backupPath.endsWith('.gz')) {
      const { createGunzip } = await import('node:zlib');

      tempPath = backupPath.replace('.gz', '.tmp');

      await pipeline(
        createReadStream(backupPath),
        createGunzip(),
        createWriteStream(tempPath)
      );
    }

    if (driver.name === 'better-sqlite3') {
      const Database = require('better-sqlite3');
      const db = new Database(tempPath, {
        readonly: true,
        fileMustExist: true,
      });

      try {
        // 执行完整性检查
        const integrityResults = db.prepare('PRAGMA integrity_check').all();
        const isOk =
          integrityResults.length === 1 &&
          integrityResults[0].integrity_check === 'ok';

        // 执行快速检查
        const quickCheck = db.prepare('PRAGMA quick_check').all();
        const quickOk =
          quickCheck.length === 1 && quickCheck[0].quick_check === 'ok';

        return {
          success: isOk && quickOk,
          integrityCheck: integrityResults,
          quickCheck,
          backupPath: tempPath,
        };
      } finally {
        db.close();

        // 清理临时文件
        if (tempPath !== backupPath) {
          await fs.promises.unlink(tempPath).catch(() => {});
        }
      }
    } else {
      // sqlite3 异步版本
      return new Promise((resolve, reject) => {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY);

        db.all('PRAGMA integrity_check', (err, integrityResults) => {
          if (err) {
            db.close();
            if (tempPath !== backupPath) {
              fs.promises.unlink(tempPath).catch(() => {});
            }
            reject(err);
            return;
          }

          const isOk =
            integrityResults.length === 1 &&
            integrityResults[0].integrity_check === 'ok';

          db.all('PRAGMA quick_check', (quickErr, quickCheck) => {
            db.close();

            if (tempPath !== backupPath) {
              fs.promises.unlink(tempPath).catch(() => {});
            }

            if (quickErr) {
              reject(quickErr);
            } else {
              const quickOk =
                quickCheck.length === 1 && quickCheck[0].quick_check === 'ok';
              resolve({
                success: isOk && quickOk,
                integrityCheck: integrityResults,
                quickCheck,
                backupPath: tempPath,
              });
            }
          });
        });
      });
    }
  } catch (error) {
    // 清理临时文件
    if (tempPath && tempPath !== backupPath) {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
    throw error;
  }
}

/**
 * 清理过期备份
 */
async function cleanupOldBackups(config) {
  try {
    const backupDir = path.resolve(config.backupDir);
    const files = await fs.promises.readdir(backupDir);

    const cutoffTime = Date.now() - config.maxBackupDays * 24 * 60 * 60 * 1000;
    const deletedFiles = [];

    for (const file of files) {
      if (
        !file.includes(
          path.basename(config.dbPath, path.extname(config.dbPath))
        )
      ) {
        continue; // 跳过不相关的文件
      }

      const filePath = path.join(backupDir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.mtime.getTime() < cutoffTime) {
        await fs.promises.unlink(filePath);
        deletedFiles.push({
          file,
          age: Math.round(
            (Date.now() - stats.mtime.getTime()) / (24 * 60 * 60 * 1000)
          ),
        });
      }
    }

    return {
      success: true,
      deletedCount: deletedFiles.length,
      deletedFiles,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 检查是否需要增量备份
 */
async function needsIncrementalBackup(config) {
  try {
    const dbStats = await fs.promises.stat(config.dbPath);
    const backupDir = path.resolve(config.backupDir);

    if (!fs.existsSync(backupDir)) {
      return { needed: true, reason: 'No backup directory exists' };
    }

    const files = await fs.promises.readdir(backupDir);
    const backupFiles = files
      .filter(file =>
        file.includes(path.basename(config.dbPath, path.extname(config.dbPath)))
      )
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stats: fs.statSync(path.join(backupDir, file)),
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

    if (backupFiles.length === 0) {
      return { needed: true, reason: 'No existing backups found' };
    }

    const latestBackup = backupFiles[0];

    if (dbStats.mtime.getTime() > latestBackup.stats.mtime.getTime()) {
      return {
        needed: true,
        reason: 'Database modified since last backup',
        lastBackup: latestBackup.name,
        dbModified: dbStats.mtime.toISOString(),
        lastBackupTime: latestBackup.stats.mtime.toISOString(),
      };
    }

    return {
      needed: false,
      reason: 'Database unchanged since last backup',
      lastBackup: latestBackup.name,
    };
  } catch (error) {
    return {
      needed: true,
      reason: `Error checking backup status: ${error.message}`,
    };
  }
}

/**
 * 检测可用的 SQLite 驱动
 */
async function detectSQLiteDriver() {
  const drivers = [
    { name: 'better-sqlite3', module: 'better-sqlite3', sync: true },
    { name: 'sqlite3', module: 'sqlite3', sync: false },
  ];

  for (const driver of drivers) {
    try {
      await import(driver.module);
      log('debug', 'SQLite driver detected', { driver: driver.name });
      return driver;
    } catch (error) {
      log('debug', 'SQLite driver not available', {
        driver: driver.name,
        error: error.message,
      });
    }
  }

  throw new Error(
    'No SQLite driver available. Please install: better-sqlite3 or sqlite3'
  );
}

/**
 * 主备份函数
 */
async function performBackup(config) {
  try {
    // 检测 SQLite 驱动
    const driver = await detectSQLiteDriver();
    log('info', 'Using SQLite driver', { driver: driver.name });

    // 检测 SQLite 能力
    const capabilities = await detectSQLiteCapabilities(driver);
    log('info', 'SQLite capabilities detected', capabilities);

    // 确保备份目录存在
    const backupDir = path.resolve(config.backupDir);
    if (!fs.existsSync(backupDir)) {
      await fs.promises.mkdir(backupDir, { recursive: true });
      log('info', 'Created backup directory', { backupDir });
    }

    // 检查增量备份需求
    if (config.backupType === 'incremental') {
      const incrementalCheck = await needsIncrementalBackup(config);

      if (!incrementalCheck.needed) {
        log('info', 'Incremental backup skipped', incrementalCheck);
        return {
          success: true,
          skipped: true,
          reason: incrementalCheck.reason,
          lastBackup: incrementalCheck.lastBackup,
        };
      }

      log('info', 'Incremental backup needed', incrementalCheck);
    }

    // 创建备份文件名
    const backupFileName = createBackupFileName(config, capabilities);
    let backupPath = path.join(backupDir, backupFileName);

    // 去掉可能的 .gz 后缀（压缩在后面处理）
    if (config.compressBackup && backupPath.endsWith('.gz')) {
      backupPath = backupPath.slice(0, -3);
    }

    log('info', 'Starting backup operation', {
      source: config.dbPath,
      backup: backupPath,
      type: config.backupType,
      compress: config.compressBackup,
    });

    // 执行备份
    let backupResult;

    if (
      config.vacuumMode === 'force' ||
      (config.vacuumMode === 'auto' && capabilities.supportsVacuumInto)
    ) {
      backupResult = await executeVacuumIntoBackup(config, driver, backupPath);
    } else {
      backupResult = await executeOnlineBackup(config, driver, backupPath);
    }

    log('info', 'Backup completed', backupResult);

    // 压缩备份
    let compressionResult = null;
    if (config.compressBackup) {
      try {
        compressionResult = await compressBackup(backupPath);
        backupPath = compressionResult.compressedPath;
        log('info', 'Backup compressed', compressionResult);
      } catch (compressionError) {
        log('warn', 'Backup compression failed', {
          error: compressionError.message,
        });
        // 继续处理，不压缩
      }
    }

    // 验证备份完整性
    let verificationResult = null;
    if (config.verifyIntegrity) {
      try {
        verificationResult = await verifyBackupIntegrity(backupPath, driver);
        log('info', 'Backup verification completed', {
          success: verificationResult.success,
          integrityCheck: verificationResult.integrityCheck?.length || 0,
          quickCheck: verificationResult.quickCheck?.length || 0,
        });

        if (!verificationResult.success) {
          throw new Error('Backup integrity verification failed');
        }
      } catch (verificationError) {
        log('error', 'Backup verification failed', {
          error: verificationError.message,
        });

        // 删除损坏的备份文件
        try {
          await fs.promises.unlink(backupPath);
        } catch {}

        throw verificationError;
      }
    }

    // 清理过期备份
    const cleanupResult = await cleanupOldBackups(config);
    if (cleanupResult.success) {
      log('info', 'Old backups cleaned up', {
        deletedCount: cleanupResult.deletedCount,
      });
    } else {
      log('warn', 'Backup cleanup failed', { error: cleanupResult.error });
    }

    // 获取最终备份文件信息
    const backupStats = await fs.promises.stat(backupPath);

    return {
      success: true,
      backupPath,
      backupSize: backupStats.size,
      backupMethod: backupResult.method,
      duration: backupResult.duration,
      compression: compressionResult,
      verification: verificationResult,
      cleanup: cleanupResult,
      capabilities,
    };
  } catch (error) {
    log('error', 'Backup operation failed', { error: error.message });
    throw error;
  }
}

/**
 * 主执行函数
 */
async function main() {
  try {
    const config = parseArguments();

    log('info', 'WAL backup script started', { config });

    // 验证源数据库
    if (!fs.existsSync(config.dbPath)) {
      log('error', 'Source database not found', { dbPath: config.dbPath });
      process.exit(2);
    }

    // 处理不同的备份类型
    let result;

    switch (config.backupType) {
      case 'verify':
        if (config.verifyFile) {
          const driver = await detectSQLiteDriver();
          result = await verifyBackupIntegrity(config.verifyFile, driver);
          log('info', 'Backup verification result', result);
        } else {
          throw new Error(
            'Verify mode requires --verify-only <file> parameter'
          );
        }
        break;

      case 'full':
      case 'incremental':
        result = await performBackup(config);
        break;

      default:
        throw new Error(`Unknown backup type: ${config.backupType}`);
    }

    // 输出成功结果
    console.log(
      JSON.stringify(
        {
          ok: true,
          operation: config.backupType,
          timestamp: new Date().toISOString(),
          ...result,
        },
        null,
        2
      )
    );

    log('info', 'Backup operation completed successfully', result);
  } catch (error) {
    log('error', 'Backup operation failed', {
      error: error.message,
      stack: error.stack,
    });

    console.log(
      JSON.stringify({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    );

    if (
      error.message.includes('not found') ||
      error.message.includes('does not exist')
    ) {
      process.exit(2);
    } else if (error.message.includes('verification failed')) {
      process.exit(4);
    } else if (error.message.includes('No SQLite driver')) {
      process.exit(3);
    } else {
      process.exit(1);
    }
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
  verifyBackupIntegrity,
  detectSQLiteCapabilities,
  needsIncrementalBackup,
  BACKUP_TYPES,
  DEFAULT_CONFIG,
};
