#!/usr/bin/env node

/**
 * 渐进发布演示脚本
 *
 * 演示完整的渐进发布流程：
 * - 5% → 25% → 50% → 100% 的渐进发布
 * - 监控 Sentry Release Health 指标
 * - 健康指标下降时的自动回滚
 *
 * Usage:
 *   node scripts/release/demo-staged-rollout.mjs
 *   node scripts/release/demo-staged-rollout.mjs --simulate-failure
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const feedFile = 'dist/latest.yml';
const manifestFile = 'dist/manifest.json';

/**
 * 执行命令并返回 JSON 结果
 */
function executeCommand(command) {
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return JSON.parse(result);
  } catch (error) {
    console.error(`命令执行失败: ${command}`);
    console.error(error.message);
    throw error;
  }
}

/**
 * 模拟健康指标检查
 */
function simulateHealthCheck(stage, simulateFailure = false) {
  console.log(`🔍 模拟 Sentry Release Health 检查 (${stage}%)...`);

  if (simulateFailure && stage >= 25) {
    // 模拟在 25% 阶段出现健康问题
    console.log(`❌ 健康检查失败：Crash-Free Sessions: 87% (低于 90% 阈值)`);
    return {
      crashFreeSessions: 0.87,
      crashFreeUsers: 0.85,
      healthy: false,
      reason: 'Crash-Free Sessions below 90% threshold',
    };
  }

  // 正常的健康指标
  const metrics = {
    crashFreeSessions: Math.random() * 0.05 + 0.95, // 95-100%
    crashFreeUsers: Math.random() * 0.05 + 0.92, // 92-97%
    healthy: true,
  };

  console.log(
    `✅ 健康检查通过：Sessions: ${(metrics.crashFreeSessions * 100).toFixed(1)}%, Users: ${(metrics.crashFreeUsers * 100).toFixed(1)}%`
  );
  return metrics;
}

/**
 * 等待指定时间（演示用）
 */
function wait(seconds) {
  console.log(`⏳ 等待 ${seconds} 秒...`);
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * 主演示流程
 */
async function runDemo() {
  const args = process.argv.slice(2);
  const simulateFailure = args.includes('--simulate-failure');

  console.log('🚀 开始渐进发布演示');
  console.log(`📦 版本: 0.1.1`);
  console.log(`🎯 策略: 5% → 25% → 50% → 100%`);
  console.log(`🔔 模拟失败: ${simulateFailure ? '是' : '否'}`);
  console.log('=' * 50);

  const stages = [5, 25, 50, 100];

  for (const stage of stages) {
    try {
      console.log(`\n📊 阶段 ${stage}%:`);

      // 设置当前阶段的百分比
      const stageResult = executeCommand(
        `node scripts/release/patch-staging-percentage.mjs ${feedFile} ${stage}`
      );
      console.log(`✅ 设置发布比例为 ${stage}%`);

      // 等待一段时间（模拟实际监控周期）
      await wait(2);

      // 健康检查
      const healthCheck = simulateHealthCheck(stage, simulateFailure);

      if (!healthCheck.healthy) {
        console.log(`\n🚨 检测到健康问题，触发紧急回滚...`);

        // 执行紧急停止
        const rollbackResult = executeCommand(
          `node scripts/release/execute-rollback.mjs --feed=${feedFile} --reason="${healthCheck.reason}"`
        );

        console.log(`🛑 紧急停止完成，staging 比例已设为 0%`);
        console.log(
          `📝 回滚日志已记录到: logs/rollback/rollback-${new Date().toISOString().split('T')[0]}.json`
        );

        // 如果需要完整回滚（回退版本）
        console.log(`\n🔄 执行完整版本回滚...`);
        const fullRollbackResult = executeCommand(
          `node scripts/release/execute-rollback.mjs --feed=${feedFile} --previous-version=0.1.0 --manifest=${manifestFile} --reason="Complete rollback due to health issues"`
        );

        console.log(`✅ 完整回滚完成，已回退到版本 0.1.0`);
        console.log('❌ 渐进发布演示因健康问题而终止');
        return;
      }

      console.log(`✅ ${stage}% 阶段健康检查通过`);

      // 如果还不是最后阶段，稍作等待
      if (stage < 100) {
        await wait(1);
      }
    } catch (error) {
      console.error(`❌ 阶段 ${stage}% 失败:`, error.message);
      break;
    }
  }

  if (!simulateFailure) {
    console.log('\n🎉 渐进发布成功完成！');
    console.log('✅ 版本 0.1.1 已 100% 发布');
    console.log('📊 所有健康指标均正常');
  }

  console.log('\n📈 发布总结:');
  console.log('- 实现了渐进发布控制 (5% → 25% → 50% → 100%)');
  console.log('- 集成了健康监控检查');
  console.log('- 提供了紧急停止功能');
  console.log('- 支持完整版本回滚');
  console.log('- 所有操作均有详细日志记录');
}

// 运行演示
runDemo().catch(error => {
  console.error('演示失败:', error.message);
  process.exit(1);
});
