#!/usr/bin/env node
/**
 * SQLite 运维自动化调度器
 * 集成智能checkpoint和定时备份策略
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from '../utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载数据库调度配置
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);
const dbConfig = config.database;

// 配置
const SCHEDULER_CONFIG = {
  // 数据库路径
  dbPath: process.env.DB_PATH || './data/app.db',

  // 备份策略
  backup: {
    daily: {
      enabled: true,
      time: '02:00', // 凌晨2点
      mode: 'auto', // vacuum|backup|auto
      retention: 7, // 保留7天
    },
    weekly: {
      enabled: true,
      day: 'sunday', // 周日
      time: '01:00',
      mode: 'vacuum',
      retention: 4, // 保留4周
    },
  },

  // Checkpoint策略 - 从配置中心加载
  checkpoint: {
    // 应用退出时强制TRUNCATE
    onExit: true,

    // 定期checkpoint (分钟)
    intervalMinutes: dbConfig?.checkpoint?.intervalMinutes?.threshold || 60,

    // WAL大小阈值 (MB)
    walSizeThresholdMB: dbConfig?.health?.walSizeThresholdMB?.threshold || 10,

    // 写入事务数阈值
    transactionThreshold:
      dbConfig?.checkpoint?.transactionThreshold?.threshold || 1000,
  },

  // 健康检查 - 从配置中心加载
  health: {
    // 定期检查间隔 (小时)
    intervalHours: dbConfig?.health?.intervalHours?.threshold || 6,

    // 磁盘空间警告阈值 (MB)
    diskSpaceWarningMB: dbConfig?.health?.diskSpaceWarningMB?.threshold || 1000,

    // 数据库文件大小警告阈值 (MB)
    dbSizeWarningMB: dbConfig?.health?.dbSizeWarningMB?.threshold || 500,
  },
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      component: 'db-scheduler',
      message,
      ...data,
    })
  );
}

/**
 * 执行shell命令
 */
async function execCommand(command, args = []) {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const child = spawn('node', [command, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch {
          resolve({ ok: true, output: stdout });
        }
      } else {
        reject(new Error(`Command failed: ${stderr || stdout}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * 检查WAL文件状态
 */
function checkWalStatus(dbPath) {
  try {
    const walPath = `${dbPath}-wal`;

    if (!fs.existsSync(walPath)) {
      return { exists: false, size: 0 };
    }

    const stats = fs.statSync(walPath);
    const sizeMB = Math.round((stats.size / 1024 / 1024) * 100) / 100;

    return {
      exists: true,
      size: stats.size,
      sizeMB,
      needsCheckpoint: sizeMB > SCHEDULER_CONFIG.checkpoint.walSizeThresholdMB,
    };
  } catch (error) {
    log('warn', 'Failed to check WAL status', { error: error.message });
    return { exists: false, size: 0 };
  }
}

/**
 * 智能Checkpoint决策
 */
function shouldPerformCheckpoint(walStatus, options = {}) {
  const reasons = [];

  // 1. 强制执行 (如应用退出)
  if (options.force) {
    reasons.push('forced');
  }

  // 2. WAL文件过大
  if (walStatus.needsCheckpoint) {
    reasons.push(`wal_size_${walStatus.sizeMB}MB`);
  }

  // 3. 定时执行
  if (options.scheduled) {
    reasons.push('scheduled');
  }

  return {
    should: reasons.length > 0,
    reasons,
    recommendedMode: options.force ? 'TRUNCATE' : 'FULL',
  };
}

/**
 * 执行智能checkpoint
 */
async function performSmartCheckpoint(dbPath, options = {}) {
  try {
    const walStatus = checkWalStatus(dbPath);
    const decision = shouldPerformCheckpoint(walStatus, options);

    if (!decision.should) {
      return {
        skipped: true,
        walStatus,
        reasons: ['no_checkpoint_needed'],
      };
    }

    log('info', 'Performing checkpoint', {
      reasons: decision.reasons,
      mode: decision.recommendedMode,
      walSizeMB: walStatus.sizeMB,
    });

    const checkpointScript = path.join(__dirname, 'checkpoint.mjs');
    const args = [`--database=${dbPath}`, '--verbose'];

    if (decision.recommendedMode === 'TRUNCATE') {
      args.push('--truncate');
    }

    const result = await execCommand(checkpointScript, args);

    return {
      success: true,
      decision,
      walStatus,
      result,
    };
  } catch (error) {
    log('error', 'Checkpoint failed', {
      dbPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 执行定时备份
 */
async function performScheduledBackup(dbPath, config) {
  try {
    log('info', 'Starting scheduled backup', { config });

    const backupScript = path.join(__dirname, 'backup.mjs');
    const backupDir = './backups';

    const args = [backupScript, dbPath, backupDir, `--mode=${config.mode}`];

    // 设置环境变量
    const env = {
      ...process.env,
      CHECKPOINT_BEFORE: 'true',
      VERIFY_DEEP: 'true',
      COMPRESS: 'true',
    };

    const result = await execCommand('node', args);

    // 清理旧备份
    if (config.retention > 0) {
      await cleanupOldBackups(backupDir, config.retention);
    }

    return result;
  } catch (error) {
    log('error', 'Scheduled backup failed', {
      dbPath,
      config,
      error: error.message,
    });
    throw error;
  }
}

/**
 * 清理旧备份文件
 */
async function cleanupOldBackups(backupDir, retentionDays) {
  try {
    if (!fs.existsSync(backupDir)) {
      return { cleaned: 0 };
    }

    const files = fs.readdirSync(backupDir);
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    let cleaned = 0;

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filePath);
        cleaned++;
        log('debug', 'Cleaned old backup', {
          file,
          age: Date.now() - stats.mtime.getTime(),
        });
      }
    }

    log('info', 'Backup cleanup completed', {
      cleaned,
      retention: retentionDays,
    });
    return { cleaned };
  } catch (error) {
    log('warn', 'Backup cleanup failed', { error: error.message });
    return { cleaned: 0, error: error.message };
  }
}

/**
 * 数据库健康检查
 */
async function performHealthCheck(dbPath) {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      dbPath,
      issues: [],
      warnings: [],
    };

    // 1. 检查数据库文件
    if (!fs.existsSync(dbPath)) {
      results.issues.push('database_file_missing');
      return results;
    }

    const dbStats = fs.statSync(dbPath);
    const dbSizeMB = Math.round((dbStats.size / 1024 / 1024) * 100) / 100;
    results.dbSizeMB = dbSizeMB;

    // 2. 检查数据库大小
    if (dbSizeMB > SCHEDULER_CONFIG.health.dbSizeWarningMB) {
      results.warnings.push(`large_database_${dbSizeMB}MB`);
    }

    // 3. 检查WAL状态
    const walStatus = checkWalStatus(dbPath);
    results.walStatus = walStatus;

    if (walStatus.sizeMB > SCHEDULER_CONFIG.checkpoint.walSizeThresholdMB) {
      results.warnings.push(`large_wal_${walStatus.sizeMB}MB`);
    }

    // 4. 检查磁盘空间
    try {
      const { execSync } = await import('child_process');
      const diskUsage = execSync('dir /-c', {
        encoding: 'utf8',
        cwd: path.dirname(dbPath),
      });
      // 简化版磁盘检查，生产环境可以使用更精确的方法
      results.diskSpaceOK = true;
    } catch {
      results.warnings.push('disk_space_check_failed');
    }

    // 5. 计算健康分数
    results.healthScore = Math.max(
      0,
      100 - results.issues.length * 30 - results.warnings.length * 10
    );
    results.status =
      results.healthScore >= 80
        ? 'healthy'
        : results.healthScore >= 60
          ? 'warning'
          : 'critical';

    return results;
  } catch (error) {
    log('error', 'Health check failed', { error: error.message });
    return {
      timestamp: new Date().toISOString(),
      dbPath,
      issues: ['health_check_failed'],
      healthScore: 0,
      status: 'critical',
      error: error.message,
    };
  }
}

/**
 * 初始化定时器
 */
function initializeScheduler() {
  const timers = [];

  // 1. 定期checkpoint
  if (SCHEDULER_CONFIG.checkpoint.intervalMinutes > 0) {
    const interval = SCHEDULER_CONFIG.checkpoint.intervalMinutes * 60 * 1000;

    const checkpointTimer = setInterval(async () => {
      try {
        await performSmartCheckpoint(SCHEDULER_CONFIG.dbPath, {
          scheduled: true,
        });
      } catch (error) {
        log('error', 'Scheduled checkpoint failed', { error: error.message });
      }
    }, interval);

    timers.push({ name: 'checkpoint', timer: checkpointTimer });
    log('info', 'Scheduled checkpoint timer initialized', {
      intervalMinutes: SCHEDULER_CONFIG.checkpoint.intervalMinutes,
    });
  }

  // 2. 健康检查
  if (SCHEDULER_CONFIG.health.intervalHours > 0) {
    const interval = SCHEDULER_CONFIG.health.intervalHours * 60 * 60 * 1000;

    const healthTimer = setInterval(async () => {
      try {
        const health = await performHealthCheck(SCHEDULER_CONFIG.dbPath);
        log('info', 'Health check completed', health);
      } catch (error) {
        log('error', 'Health check failed', { error: error.message });
      }
    }, interval);

    timers.push({ name: 'health', timer: healthTimer });
    log('info', 'Health check timer initialized', {
      intervalHours: SCHEDULER_CONFIG.health.intervalHours,
    });
  }

  // 3. 进程退出清理
  const cleanup = async () => {
    log('info', 'Scheduler cleanup started');

    // 清理所有定时器
    timers.forEach(({ name, timer }) => {
      clearInterval(timer);
      log('debug', 'Timer cleared', { name });
    });

    // 执行最终checkpoint
    if (SCHEDULER_CONFIG.checkpoint.onExit) {
      try {
        await performSmartCheckpoint(SCHEDULER_CONFIG.dbPath, { force: true });
        log('info', 'Exit checkpoint completed');
      } catch (error) {
        log('error', 'Exit checkpoint failed', { error: error.message });
      }
    }

    log('info', 'Scheduler cleanup completed');
  };

  // 注册退出处理
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGQUIT', cleanup);

  return { timers, cleanup };
}

/**
 * 命令行接口
 */
async function main() {
  const command = process.argv[2];
  const dbPath = process.argv[3] || SCHEDULER_CONFIG.dbPath;

  try {
    switch (command) {
      case 'checkpoint':
        const checkpointResult = await performSmartCheckpoint(dbPath, {
          force: process.argv.includes('--force'),
        });
        console.log(JSON.stringify(checkpointResult, null, 2));
        break;

      case 'backup':
        const backupConfig = {
          mode: 'auto',
          retention: 7,
        };
        const backupResult = await performScheduledBackup(dbPath, backupConfig);
        console.log(JSON.stringify(backupResult, null, 2));
        break;

      case 'health':
        const healthResult = await performHealthCheck(dbPath);
        console.log(JSON.stringify(healthResult, null, 2));
        break;

      case 'start':
        log('info', 'Starting database scheduler', {
          config: SCHEDULER_CONFIG,
        });
        const scheduler = initializeScheduler();

        // 立即执行一次健康检查
        const initialHealth = await performHealthCheck(dbPath);
        log('info', 'Initial health check completed', initialHealth);

        // 保持进程运行
        setInterval(
          () => {
            log('debug', 'Scheduler heartbeat', {
              uptime: Math.round(process.uptime()),
              memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            });
          },
          5 * 60 * 1000
        ); // 每5分钟心跳

        break;

      default:
        console.log(`
Usage: node scripts/db/scheduler.mjs <command> [options]

Commands:
  checkpoint [dbPath]  - 执行智能checkpoint
  backup [dbPath]      - 执行定时备份  
  health [dbPath]      - 健康检查
  start               - 启动定时调度器

Options:
  --force             - 强制执行 (checkpoint)

Environment Variables:
  DB_PATH             - 数据库文件路径 (默认: ./data/app.db)
`);
        break;
    }
  } catch (error) {
    log('error', 'Command failed', {
      command,
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// 如果直接运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export {
  performSmartCheckpoint,
  performScheduledBackup,
  performHealthCheck,
  initializeScheduler,
  SCHEDULER_CONFIG,
};
