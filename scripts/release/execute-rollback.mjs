#!/usr/bin/env node

/**
 * 回滚执行脚本 - 自动回滚到上一稳定版本
 *
 * 基于 ADR-0008 渐进发布策略实现
 *
 * 功能：
 * - 将分阶段发布百分比设置为 0% (停止新版本推送)
 * - 可选：回滚到上一个稳定版本
 * - 记录回滚操作日志
 * - 发送通知 (可选)
 *
 * Usage:
 *   node scripts/release/execute-rollback.mjs --feed=dist/latest.yml
 *   node scripts/release/execute-rollback.mjs --feed=dist/latest.yml --previous-version=1.1.0
 *   WEBHOOK_URL=xxx node scripts/release/execute-rollback.mjs --feed=dist/latest.yml --notify
 *
 * 参数：
 *   --feed               更新 feed 文件路径 (必需)
 *   --previous-version   回滚到的版本号 (可选，仅停止当前版本推送)
 *   --manifest           版本清单文件路径 (版本回退时需要)
 *   --notify            发送回滚通知 (需要 WEBHOOK_URL 环境变量)
 *   --reason            回滚原因说明 (默认: "Automated rollback due to health check failure")
 *
 * 环境变量：
 *   WEBHOOK_URL         通知 Webhook URL (可选)
 *   ROLLBACK_LOG_DIR    回滚日志目录 (默认: logs/rollback)
 *
 * 输出格式：
 *   {"success":true,"action":"rollback","feedFile":"dist/latest.yml","timestamp":"..."}
 *
 * 相关文档：
 * - ADR-0008: 渐进发布和自动回滚策略
 */

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchStagingPercentage } from './patch-staging-percentage.mjs';
import { rollbackFeed } from './rollback-feed.mjs';

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

const { WEBHOOK_URL, ROLLBACK_LOG_DIR = 'logs/rollback' } = process.env;

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const args = {
    feed: null,
    previousVersion: null,
    manifest: null,
    notify: false,
    reason: 'Automated rollback due to health check failure',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--feed=')) {
      args.feed = arg.split('=')[1];
    } else if (arg.startsWith('--previous-version=')) {
      args.previousVersion = arg.split('=')[1];
    } else if (arg.startsWith('--manifest=')) {
      args.manifest = arg.split('=')[1];
    } else if (arg.startsWith('--reason=')) {
      args.reason = arg.split('=')[1];
    } else if (arg === '--notify') {
      args.notify = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

/**
 * 记录回滚操作到日志文件
 * @param {Object} rollbackData - 回滚操作数据
 */
function logRollbackOperation(rollbackData) {
  try {
    // 确保日志目录存在
    if (!fs.existsSync(ROLLBACK_LOG_DIR)) {
      fs.mkdirSync(ROLLBACK_LOG_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const logFile = path.join(ROLLBACK_LOG_DIR, `rollback-${timestamp}.json`);

    // 读取现有日志或创建新的
    let logs = [];
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      logs = JSON.parse(content);
    }

    logs.push({
      ...rollbackData,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    console.error(`📝 Rollback operation logged to: ${logFile}`);
  } catch (error) {
    console.error(`⚠️  Failed to log rollback operation: ${error.message}`);
  }
}

/**
 * 发送回滚通知
 * @param {Object} rollbackData - 回滚操作数据
 */
async function sendNotification(rollbackData) {
  if (!WEBHOOK_URL) {
    console.error(`⚠️  No WEBHOOK_URL configured, skipping notification`);
    return;
  }

  try {
    const payload = {
      text: `🚨 Automated Rollback Executed`,
      attachments: [
        {
          color: 'warning',
          fields: [
            { title: 'Feed File', value: rollbackData.feedFile, short: true },
            { title: 'Action', value: rollbackData.action, short: true },
            {
              title: 'Previous Version',
              value: rollbackData.previousVersion || 'N/A',
              short: true,
            },
            { title: 'Reason', value: rollbackData.reason, short: false },
            { title: 'Timestamp', value: rollbackData.timestamp, short: true },
          ],
        },
      ],
    };

    // 简单的 webhook 通知实现
    const https = await import('node:https');
    const url = new URL(WEBHOOK_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        resolve({ status: res.statusCode });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  } catch (error) {
    console.error(`⚠️  Failed to send notification: ${error.message}`);
  }
}

/**
 * 执行回滚操作
 * @param {Object} options - 回滚选项
 * @returns {Promise<Object>} 回滚结果
 */
export async function executeRollback(options) {
  const { feedFile, previousVersion, manifestFile, reason, notify } = options;

  console.error(`🔄 Starting rollback process...`);
  console.error(`📄 Feed file: ${feedFile}`);
  console.error(
    `📦 Previous version: ${previousVersion || 'Not specified (emergency stop only)'}`
  );
  console.error(`💭 Reason: ${reason}`);

  const rollbackData = {
    action: 'rollback',
    feedFile,
    previousVersion,
    reason,
    success: false,
    steps: [],
  };

  try {
    // 第一步：将分阶段发布百分比设置为 0% (紧急停止)
    console.error(
      `🛑 Step 1: Setting staging percentage to 0% (emergency stop)...`
    );

    const stopResult = patchStagingPercentage(feedFile, 0);
    rollbackData.steps.push({
      step: 'emergency_stop',
      result: stopResult,
      success: true,
    });

    console.error(`✅ Emergency stop completed: ${JSON.stringify(stopResult)}`);

    // 第二步：如果指定了之前版本，则回滚到该版本
    if (previousVersion) {
      console.error(
        `⏮️  Step 2: Rolling back to previous version ${previousVersion}...`
      );

      if (!manifestFile) {
        // 没有提供清单文件，仅记录意图
        rollbackData.steps.push({
          step: 'version_rollback_intent',
          targetVersion: previousVersion,
          success: true,
          note: 'Version rollback intent recorded - manifest file required for actual rollback',
        });

        console.error(
          `⚠️  Version rollback intent recorded for ${previousVersion} (manifest file required for actual rollback)`
        );
      } else {
        // 执行实际的版本回滚
        try {
          const rollbackResult = rollbackFeed(
            feedFile,
            manifestFile,
            previousVersion
          );

          rollbackData.steps.push({
            step: 'version_rollback',
            targetVersion: previousVersion,
            result: rollbackResult,
            success: true,
          });

          console.error(`✅ Version rollback completed: ${previousVersion}`);
          console.error(`📋 Feed updated with version data from manifest`);
        } catch (rollbackError) {
          rollbackData.steps.push({
            step: 'version_rollback',
            targetVersion: previousVersion,
            success: false,
            error: rollbackError.message,
          });

          console.error(`❌ Version rollback failed: ${rollbackError.message}`);
        }
      }
    }

    rollbackData.success = true;
    rollbackData.timestamp = new Date().toISOString();

    // 记录回滚操作
    logRollbackOperation(rollbackData);

    // 发送通知
    if (notify) {
      console.error(`📢 Sending rollback notification...`);
      await sendNotification(rollbackData);
      console.error(`✅ Notification sent`);
    }

    console.error(`🎉 Rollback process completed successfully`);

    return rollbackData;
  } catch (error) {
    rollbackData.error = error.message;
    rollbackData.timestamp = new Date().toISOString();

    // 即使失败也要记录
    logRollbackOperation(rollbackData);

    throw new Error(`Rollback execution failed: ${error.message}`);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
回滚执行脚本 - 自动回滚到上一稳定版本

用法:
  node scripts/release/execute-rollback.mjs --feed=<feedFile> [options]

参数:
  --feed=PATH           更新 feed 文件路径 (必需)
  --previous-version=X  回滚到的版本号 (可选)
  --manifest=PATH       版本清单文件路径 (版本回退时需要)
  --reason="..."        回滚原因说明 (可选)
  --notify             发送回滚通知 (需要 WEBHOOK_URL)

环境变量:
  WEBHOOK_URL          通知 Webhook URL (可选)
  ROLLBACK_LOG_DIR     回滚日志目录 (默认: logs/rollback)

示例:
  # 紧急停止当前版本推送
  node scripts/release/execute-rollback.mjs --feed=dist/latest.yml
  
  # 回滚到指定版本
  node scripts/release/execute-rollback.mjs --feed=dist/latest.yml --previous-version=1.1.0
  
  # 带通知的回滚
  WEBHOOK_URL=https://hooks.slack.com/xxx node scripts/release/execute-rollback.mjs --feed=dist/latest.yml --notify
  
  # 自定义回滚原因
  node scripts/release/execute-rollback.mjs --feed=dist/latest.yml --reason="Critical security issue detected"
`);
}

// 主程序执行
if (isMainModule) {
  const args = parseArgs(process.argv);

  // 显示帮助
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // 验证必需参数
  if (!args.feed) {
    console.error('❌ Error: --feed parameter is required');
    showHelp();
    process.exit(2);
  }

  (async () => {
    try {
      const result = await executeRollback({
        feedFile: args.feed,
        previousVersion: args.previousVersion,
        manifestFile: args.manifest,
        reason: args.reason,
        notify: args.notify,
      });

      // 输出结构化结果
      console.log(JSON.stringify(result));
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);

      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(errorResult));
      process.exit(1);
    }
  })();
}
