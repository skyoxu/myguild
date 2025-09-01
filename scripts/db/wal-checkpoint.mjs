#!/usr/bin/env node

/**
 * WAL 检查点管理脚本 (ADR-0006 合规)
 *
 * 功能：
 * - 执行 WAL 检查点操作 (PASSIVE|FULL|RESTART|TRUNCATE)
 * - 监控 WAL 文件大小和状态
 * - 支持多种 SQLite 驱动 (better-sqlite3, sqlite3, node-sqlite3)
 * - 提供详细的检查点统计信息
 * - 集成错误处理和重试机制
 *
 * Usage:
 *   DB_PATH=./data/app.db CHECKPOINT_MODE=TRUNCATE node scripts/db/wal-checkpoint.mjs
 *   node scripts/db/wal-checkpoint.mjs ./data/app.db FULL
 *   node scripts/db/wal-checkpoint.mjs --help
 *
 * Environment Variables:
 *   DB_PATH         - 数据库文件路径 (默认: data/app.db)
 *   CHECKPOINT_MODE - 检查点模式 (默认: TRUNCATE)
 *   WAL_SIZE_WARN   - WAL 大小警告阈值，字节 (默认: 4MB)
 *   MAX_RETRIES     - 最大重试次数 (默认: 3)
 *   BUSY_TIMEOUT    - SQLite busy_timeout (默认: 5000ms)
 *   LOG_LEVEL       - 日志级别: error|warn|info|debug (默认: info)
 *
 * Exit Codes:
 *   0 - 成功
 *   1 - 检查点执行失败
 *   2 - 数据库文件不存在或无法访问
 *   3 - 依赖缺失或配置错误
 *   4 - 参数错误
 *
 * 基于 SQLite 官方文档:
 * - https://www.sqlite.org/pragma.html#pragma_wal_checkpoint
 * - https://www.sqlite.org/wal.html#checkpointing
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

// 配置常量
const CHECKPOINT_MODES = ['PASSIVE', 'FULL', 'RESTART', 'TRUNCATE'];
const DEFAULT_CONFIG = {
  dbPath: process.env.DB_PATH || 'data/app.db',
  mode: (process.env.CHECKPOINT_MODE || 'TRUNCATE').toUpperCase(),
  walSizeWarn: parseInt(process.env.WAL_SIZE_WARN) || 4 * 1024 * 1024, // 4MB
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  busyTimeout: parseInt(process.env.BUSY_TIMEOUT) || 5000,
  logLevel: process.env.LOG_LEVEL || 'info',
};

// 日志级别映射
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
    component: 'wal-checkpoint',
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
WAL 检查点管理脚本

用法:
  node scripts/db/wal-checkpoint.mjs [数据库路径] [模式]
  
参数:
  数据库路径  SQLite 数据库文件路径 (可选)
  模式        检查点模式: ${CHECKPOINT_MODES.join('|')} (可选)
  
环境变量:
  DB_PATH         数据库文件路径
  CHECKPOINT_MODE 检查点模式
  WAL_SIZE_WARN   WAL 大小警告阈值 (字节)
  MAX_RETRIES     最大重试次数
  BUSY_TIMEOUT    SQLite busy_timeout (毫秒)
  LOG_LEVEL       日志级别: error|warn|info|debug
  
检查点模式说明:
  PASSIVE   - 被动模式，不等待其他连接
  FULL      - 完整模式，等待所有读者完成
  RESTART   - 重启模式，强制新的 WAL 文件
  TRUNCATE  - 截断模式，尝试截断 WAL 文件到零长度 (推荐)
  
示例:
  node scripts/db/wal-checkpoint.mjs ./data/app.db TRUNCATE
  DB_PATH=/path/to/db.sqlite3 CHECKPOINT_MODE=FULL node scripts/db/wal-checkpoint.mjs
  LOG_LEVEL=debug node scripts/db/wal-checkpoint.mjs --help
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

  // 解析位置参数
  if (args.length >= 1 && !args[0].startsWith('--')) {
    config.dbPath = args[0];
  }
  if (args.length >= 2 && !args[1].startsWith('--')) {
    config.mode = args[1].toUpperCase();
  }

  // 验证检查点模式
  if (!CHECKPOINT_MODES.includes(config.mode)) {
    log('error', 'Invalid checkpoint mode', {
      provided: config.mode,
      valid: CHECKPOINT_MODES,
    });
    process.exit(4);
  }

  return config;
}

/**
 * 检测可用的 SQLite 驱动
 */
async function detectSQLiteDriver() {
  const drivers = [
    { name: 'better-sqlite3', module: 'better-sqlite3', sync: true },
    { name: 'sqlite3', module: 'sqlite3', sync: false },
    {
      name: 'node-sqlite3-wasm',
      module: '@sqlite.org/sqlite-wasm',
      sync: true,
    },
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
    'No SQLite driver available. Please install: better-sqlite3, sqlite3, or @sqlite.org/sqlite-wasm'
  );
}

/**
 * 获取文件统计信息
 */
function getFileStats(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, size: 0 };
    }
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      readable: fs.constants.R_OK,
      writable: fs.constants.W_OK,
    };
  } catch (error) {
    return { exists: false, size: 0, error: error.message };
  }
}

/**
 * 执行 WAL 检查点 (better-sqlite3)
 */
function executeBetterSqlite3Checkpoint(config) {
  const Database = require('better-sqlite3');

  const db = new Database(config.dbPath, { fileMustExist: true });

  try {
    // 设置 busy timeout
    db.pragma(`busy_timeout = ${config.busyTimeout}`);

    // 获取检查点前的状态
    const preStats = db.pragma('wal_checkpoint').shift();
    const walInfo = db.pragma('journal_mode, page_count, page_size');

    log('debug', 'Pre-checkpoint state', {
      walInfo,
      preStats,
      config: { mode: config.mode },
    });

    // 开始事务以减少并发冲突
    const transaction = db.transaction(() => {
      const startTime = performance.now();

      // 执行检查点
      const result = db.prepare(`PRAGMA wal_checkpoint(${config.mode})`).get();

      const duration = performance.now() - startTime;

      return { result, duration };
    });

    const { result, duration } = transaction();

    // 获取检查点后的状态
    const postStats = db.pragma('wal_checkpoint').shift();

    return {
      success: true,
      result,
      preStats,
      postStats,
      duration: Math.round(duration * 100) / 100, // 保留2位小数
      mode: config.mode,
    };
  } finally {
    db.close();
  }
}

/**
 * 执行 WAL 检查点 (sqlite3 - 异步)
 */
function executeSqlite3Checkpoint(config) {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(config.dbPath, sqlite3.OPEN_READWRITE);

    const cleanup = () => {
      db.close(err => {
        if (err) log('warn', 'Database close error', { error: err.message });
      });
    };

    db.configure('busyTimeout', config.busyTimeout);

    const startTime = performance.now();

    db.get(`PRAGMA wal_checkpoint(${config.mode})`, (err, result) => {
      const duration = performance.now() - startTime;

      if (err) {
        cleanup();
        reject(err);
        return;
      }

      cleanup();
      resolve({
        success: true,
        result,
        duration: Math.round(duration * 100) / 100,
        mode: config.mode,
      });
    });
  });
}

/**
 * 执行 WAL 检查点 - 主入口
 */
async function executeCheckpoint(config, driver, attempt = 1) {
  try {
    log('info', 'Starting WAL checkpoint', {
      dbPath: config.dbPath,
      mode: config.mode,
      driver: driver.name,
      attempt,
    });

    let result;

    if (driver.sync) {
      result = executeBetterSqlite3Checkpoint(config);
    } else {
      result = await executeSqlite3Checkpoint(config);
    }

    log('info', 'WAL checkpoint completed', result);
    return result;
  } catch (error) {
    log('warn', 'WAL checkpoint attempt failed', {
      attempt,
      error: error.message,
      code: error.code,
    });

    // 重试逻辑
    if (attempt < config.maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避，最大5秒
      log('info', 'Retrying checkpoint', { delay, nextAttempt: attempt + 1 });

      await new Promise(resolve => setTimeout(resolve, delay));
      return executeCheckpoint(config, driver, attempt + 1);
    }

    throw error;
  }
}

/**
 * 分析 WAL 文件状态
 */
function analyzeWALStatus(config) {
  const dbStats = getFileStats(config.dbPath);
  const walPath = `${config.dbPath}-wal`;
  const walStats = getFileStats(walPath);
  const shmPath = `${config.dbPath}-shm`;
  const shmStats = getFileStats(shmPath);

  const analysis = {
    database: dbStats,
    wal: walStats,
    shm: shmStats,
    warnings: [],
  };

  // 检查警告条件
  if (walStats.exists && walStats.size > config.walSizeWarn) {
    analysis.warnings.push({
      type: 'large_wal_file',
      severity: 'warn',
      message: `WAL file size (${Math.round((walStats.size / 1024 / 1024) * 100) / 100} MB) exceeds warning threshold`,
      threshold: config.walSizeWarn,
      actual: walStats.size,
    });
  }

  if (!dbStats.exists) {
    analysis.warnings.push({
      type: 'missing_database',
      severity: 'error',
      message: 'Database file does not exist',
      path: config.dbPath,
    });
  }

  if (shmStats.exists && !walStats.exists) {
    analysis.warnings.push({
      type: 'orphaned_shm',
      severity: 'warn',
      message: 'SHM file exists without WAL file',
      shmPath,
    });
  }

  return analysis;
}

/**
 * 生成检查点报告
 */
function generateReport(config, analysis, checkpointResult) {
  const report = {
    timestamp: new Date().toISOString(),
    operation: 'wal_checkpoint',
    config: {
      dbPath: config.dbPath,
      mode: config.mode,
      busyTimeout: config.busyTimeout,
    },
    preCheckpoint: {
      database: analysis.database,
      wal: analysis.wal,
      shm: analysis.shm,
      warnings: analysis.warnings,
    },
    checkpointResult,
    postCheckpoint: {
      // 重新获取检查点后的文件状态
      wal: getFileStats(`${config.dbPath}-wal`),
      shm: getFileStats(`${config.dbPath}-shm`),
    },
  };

  // 计算WAL大小变化
  if (analysis.wal.exists && report.postCheckpoint.wal.exists) {
    report.walSizeReduction =
      analysis.wal.size - report.postCheckpoint.wal.size;
    report.walSizeReductionPercent =
      Math.round((report.walSizeReduction / analysis.wal.size) * 10000) / 100;
  }

  return report;
}

/**
 * 主执行函数
 */
async function main() {
  try {
    const config = parseArguments();

    log('info', 'WAL checkpoint script started', { config });

    // 检测 SQLite 驱动
    const driver = await detectSQLiteDriver();
    log('info', 'Using SQLite driver', { driver: driver.name });

    // 分析 WAL 状态
    const analysis = analyzeWALStatus(config);

    // 检查严重错误
    const errors = analysis.warnings.filter(w => w.severity === 'error');
    if (errors.length > 0) {
      log('error', 'Pre-checkpoint validation failed', { errors });
      process.exit(2);
    }

    // 显示警告
    const warnings = analysis.warnings.filter(w => w.severity === 'warn');
    warnings.forEach(warning => {
      log('warn', warning.message, warning);
    });

    // 执行检查点
    const checkpointResult = await executeCheckpoint(config, driver);

    // 生成最终报告
    const report = generateReport(config, analysis, checkpointResult);

    // 输出成功结果
    log('info', 'WAL checkpoint operation completed successfully', {
      duration: checkpointResult.duration,
      mode: config.mode,
      walSizeReduction: report.walSizeReduction || 0,
      walSizeReductionPercent: report.walSizeReductionPercent || 0,
    });

    // 输出最终状态（用于脚本集成）
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...report,
          summary: {
            checkpointMode: config.mode,
            duration: checkpointResult.duration,
            walSizeReduction: report.walSizeReduction || 0,
            warningsCount: warnings.length,
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    log('error', 'WAL checkpoint operation failed', {
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

    // 根据错误类型设置退出码
    if (error.message.includes('No SQLite driver available')) {
      process.exit(3);
    } else if (error.message.includes('does not exist')) {
      process.exit(2);
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
  executeCheckpoint,
  analyzeWALStatus,
  detectSQLiteDriver,
  parseArguments,
  CHECKPOINT_MODES,
  DEFAULT_CONFIG,
};
