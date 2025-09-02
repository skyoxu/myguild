#!/usr/bin/env node

/**
 * 帧率稳定性门禁脚本
 *
 * 实现专家建议的严格帧率稳定性检查：
 * - 55fps P95 阈值 (18.18ms frame time)
 * - 2% 掉帧率限制 (基于 30fps 阈值: 33.33ms)
 * - 统计显著性验证 (≥60 帧样本)
 *
 * 符合 ADR-0005 质量门禁要求，优先于E2E测试执行以节省CI时间
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 硬编码帧率稳定性阈值 - 专家建议的严格标准
const FRAMERATE_THRESHOLDS = {
  // 55fps P95 阈值 (比标准60fps更严格)
  p95FrameTimeMs: 18.18, // 1000/55 = 18.18ms

  // 2% 掉帧率限制 (基于30fps阈值)
  frameDropThresholdMs: 33.33, // 1000/30 = 33.33ms
  maxFrameDropPercent: 2.0, // 最多2%的帧可以低于30fps

  // 统计显著性要求
  minSampleSize: 60, // 至少60帧样本 (1秒@60fps)

  // 额外质量指标
  targetFrameTimeMs: 16.67, // 理想60fps: 16.67ms
  p99FrameTimeMs: 25.0, // P99不超过40fps (25ms)

  description: '帧率稳定性门禁',
};

/**
 * 计算百分位数值
 * @param {number[]} values 数值数组
 * @param {number} percentile 百分位 (0-100)
 * @returns {number} 百分位数值
 */
function calculatePercentile(values, percentile) {
  if (!values || values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算掉帧率
 * @param {number[]} frameTimesMs 帧时间数组(毫秒)
 * @param {number} dropThresholdMs 掉帧阈值(毫秒)
 * @returns {number} 掉帧率百分比
 */
function calculateFrameDropRate(frameTimesMs, dropThresholdMs) {
  if (!frameTimesMs || frameTimesMs.length === 0) return 0;

  const droppedFrames = frameTimesMs.filter(
    frameTime => frameTime > dropThresholdMs
  );
  return (droppedFrames.length / frameTimesMs.length) * 100;
}

/**
 * 验证帧率稳定性指标
 * @param {number[]} frameTimesMs 帧时间样本数据(毫秒)
 */
function validateFramerateStability(frameTimesMs) {
  if (!frameTimesMs || frameTimesMs.length === 0) {
    throw new Error('帧率稳定性检查: 没有帧时间样本数据');
  }

  const sampleSize = frameTimesMs.length;
  const p95 = calculatePercentile(frameTimesMs, 95);
  const p99 = calculatePercentile(frameTimesMs, 99);
  const avg =
    frameTimesMs.reduce((sum, val) => sum + val, 0) / frameTimesMs.length;
  const min = Math.min(...frameTimesMs);
  const max = Math.max(...frameTimesMs);

  // 计算掉帧率
  const frameDropRate = calculateFrameDropRate(
    frameTimesMs,
    FRAMERATE_THRESHOLDS.frameDropThresholdMs
  );

  // 计算等效FPS
  const avgFPS = 1000 / avg;
  const p95FPS = 1000 / p95;
  const p99FPS = 1000 / p99;

  console.log(`📊 ${FRAMERATE_THRESHOLDS.description}统计:`);
  console.log(`  样本数量: ${sampleSize} 帧`);
  console.log(`  平均帧时间: ${avg.toFixed(2)}ms (${avgFPS.toFixed(1)}fps)`);
  console.log(
    `  P95帧时间: ${p95.toFixed(2)}ms (${p95FPS.toFixed(1)}fps) [阈值: ${FRAMERATE_THRESHOLDS.p95FrameTimeMs}ms]`
  );
  console.log(
    `  P99帧时间: ${p99.toFixed(2)}ms (${p99FPS.toFixed(1)}fps) [阈值: ${FRAMERATE_THRESHOLDS.p99FrameTimeMs}ms]`
  );
  console.log(
    `  最小帧时间: ${min.toFixed(2)}ms (${(1000 / min).toFixed(1)}fps)`
  );
  console.log(
    `  最大帧时间: ${max.toFixed(2)}ms (${(1000 / max).toFixed(1)}fps)`
  );
  console.log(
    `  掉帧率: ${frameDropRate.toFixed(2)}% [阈值: ≤${FRAMERATE_THRESHOLDS.maxFrameDropPercent}%]`
  );

  const failures = [];

  // 1. 统计显著性检查
  if (sampleSize < FRAMERATE_THRESHOLDS.minSampleSize) {
    failures.push(
      `样本数量 ${sampleSize} < ${FRAMERATE_THRESHOLDS.minSampleSize} (统计无效)`
    );
  }

  // 2. P95帧时间检查 (55fps标准)
  if (p95 > FRAMERATE_THRESHOLDS.p95FrameTimeMs) {
    failures.push(
      `P95帧时间 ${p95.toFixed(2)}ms > ${FRAMERATE_THRESHOLDS.p95FrameTimeMs}ms (低于55fps)`
    );
  }

  // 3. P99帧时间检查 (40fps标准)
  if (p99 > FRAMERATE_THRESHOLDS.p99FrameTimeMs) {
    failures.push(
      `P99帧时间 ${p99.toFixed(2)}ms > ${FRAMERATE_THRESHOLDS.p99FrameTimeMs}ms (低于40fps)`
    );
  }

  // 4. 掉帧率检查 (2%标准)
  if (frameDropRate > FRAMERATE_THRESHOLDS.maxFrameDropPercent) {
    failures.push(
      `掉帧率 ${frameDropRate.toFixed(2)}% > ${FRAMERATE_THRESHOLDS.maxFrameDropPercent}% (超过30fps阈值)`
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `${FRAMERATE_THRESHOLDS.description}失败:\n${failures.map(f => `  - ${f}`).join('\n')}`
    );
  }

  console.log('✅ 帧率稳定性门禁通过！');
  return {
    sampleSize,
    avg: avg,
    p95: p95,
    p99: p99,
    min: min,
    max: max,
    frameDropRate: frameDropRate,
    avgFPS: avgFPS,
    p95FPS: p95FPS,
    p99FPS: p99FPS,
    thresholds: FRAMERATE_THRESHOLDS,
    passed: true,
  };
}

/**
 * 从性能报告文件读取帧率数据
 * @param {string} reportPath 报告文件路径
 * @returns {object} 帧率数据
 */
function loadFramerateReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`帧率报告文件不存在: ${reportPath}`);
  }

  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    const data = JSON.parse(content);

    // 支持多种数据格式
    if (data.frameTimes) {
      return data.frameTimes;
    } else if (data.frameTime) {
      return data.frameTime;
    } else if (data.performance && data.performance.frameTime) {
      return data.performance.frameTime;
    } else {
      throw new Error(
        '报告文件中未找到帧时间数据 (需要: frameTimes, frameTime, 或 performance.frameTime)'
      );
    }
  } catch (error) {
    throw new Error(`读取帧率报告失败: ${error.message}`);
  }
}

/**
 * 生成模拟帧率数据（用于演示和测试）
 * 模拟真实游戏场景的帧率分布
 */
function generateMockFramerateData() {
  console.log('🧪 生成模拟帧率数据进行演示...\n');

  const frameTimes = [];

  // 模拟真实游戏帧率分布:
  // - 85% 帧符合60fps标准 (14-18ms)
  // - 10% 帧轻微抖动 (18-25ms, 40-55fps)
  // - 4% 帧中度抖动 (25-33ms, 30-40fps)
  // - 1% 帧重度掉帧 (33-50ms, 20-30fps)

  // 优秀帧 (85%): 14-18ms (55-70fps)
  for (let i = 0; i < 85; i++) {
    frameTimes.push(14 + Math.random() * 4); // 14-18ms
  }

  // 轻微抖动 (10%): 18-25ms (40-55fps)
  for (let i = 0; i < 10; i++) {
    frameTimes.push(18 + Math.random() * 7); // 18-25ms
  }

  // 中度抖动 (4%): 25-33ms (30-40fps)
  for (let i = 0; i < 4; i++) {
    frameTimes.push(25 + Math.random() * 8); // 25-33ms
  }

  // 重度掉帧 (1%): 33-50ms (20-30fps) - 应该触发掉帧率警报
  for (let i = 0; i < 1; i++) {
    frameTimes.push(33 + Math.random() * 17); // 33-50ms
  }

  // 随机打乱顺序以模拟真实帧序列
  for (let i = frameTimes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frameTimes[i], frameTimes[j]] = [frameTimes[j], frameTimes[i]];
  }

  return frameTimes;
}

/**
 * 主帧率稳定性门禁检查函数
 */
async function runFramerateStabilityGate() {
  console.log('🎮 开始帧率稳定性门禁检查...');
  console.log('📋 参考标准: 专家建议的55fps P95 + 2%掉帧率门禁\n');

  try {
    // 查找帧率报告文件
    const framerateReportPaths = [
      path.join(__dirname, '..', '..', '.framerate-report.json'),
      path.join(__dirname, '..', '..', '.performance-report.json'),
      path.join(__dirname, '..', '..', 'logs', 'performance', 'framerate.json'),
    ];

    let frameTimesMs = null;

    // 尝试从多个位置读取帧率数据
    for (const reportPath of framerateReportPaths) {
      if (fs.existsSync(reportPath)) {
        console.log(`📊 读取帧率报告文件: ${reportPath}`);
        try {
          frameTimesMs = loadFramerateReport(reportPath);
          break;
        } catch (error) {
          console.warn(`⚠️  读取 ${reportPath} 失败: ${error.message}`);
        }
      }
    }

    // 如果没有找到真实数据，使用模拟数据
    if (!frameTimesMs) {
      console.log('⚠️  未找到帧率报告文件，使用模拟数据演示');
      frameTimesMs = generateMockFramerateData();
    }

    // 验证帧率稳定性
    const result = validateFramerateStability(frameTimesMs);

    // 生成详细报告
    const reportDir = path.join(__dirname, '..', '..', 'logs', 'performance');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const reportFile = path.join(
      reportDir,
      `framerate-stability-gate-${timestamp}.json`
    );

    const report = {
      timestamp: new Date().toISOString(),
      gateType: 'framerate-stability',
      version: '1.0.0',
      thresholds: FRAMERATE_THRESHOLDS,
      results: result,
      rawData: {
        sampleCount: frameTimesMs.length,
        firstNFrames: frameTimesMs.slice(0, 10), // 前10帧用于调试
        lastNFrames: frameTimesMs.slice(-10), // 后10帧用于调试
      },
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        ci: !!process.env.CI,
        github: {
          sha: process.env.GITHUB_SHA,
          ref: process.env.GITHUB_REF,
          workflow: process.env.GITHUB_WORKFLOW,
        },
      },
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 帧率稳定性门禁报告已保存: ${reportFile}`);

    console.log('\n✅ 帧率稳定性门禁检查通过！');
    console.log('🎉 帧率性能达到专家建议的严格标准');
    console.log(
      `   - P95帧时间: ${result.p95.toFixed(2)}ms (${result.p95FPS.toFixed(1)}fps) ✓`
    );
    console.log(`   - 掉帧率: ${result.frameDropRate.toFixed(2)}% ✓`);
  } catch (error) {
    console.error('\n❌ 帧率稳定性门禁失败:', error.message);
    console.log('\n💡 建议:');
    console.log('  1. 运行帧率基准测试: npm run test:e2e:framerate');
    console.log('  2. 检查性能报告: logs/performance/');
    console.log('  3. 优化渲染循环和帧时间控制');
    console.log('  4. 考虑启用性能降级机制');
    console.log('  5. 确保测试环境稳定（关闭其他程序、固定电源模式）');

    process.exit(1);
  }
}

// 导出函数供其他模块使用
export {
  runFramerateStabilityGate,
  validateFramerateStability,
  calculatePercentile,
  calculateFrameDropRate,
  FRAMERATE_THRESHOLDS,
};

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  runFramerateStabilityGate();
}
