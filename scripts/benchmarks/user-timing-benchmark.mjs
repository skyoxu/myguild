#!/usr/bin/env node
/**
 * User Timing 性能基准测试脚本
 * 运行关键交互测点并验证P95阈值
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// 模拟关键交互的性能测试
const PERFORMANCE_TESTS = {
  'app.startup': {
    name: 'App Startup',
    p95Threshold: 3000,
    p99Threshold: 5000,
    test: () => simulateStartup(),
  },
  'game.scene.load': {
    name: 'Game Scene Load',
    p95Threshold: 1500,
    p99Threshold: 2500,
    test: () => simulateSceneLoad(),
  },
  'ui.modal.open': {
    name: 'UI Modal Open',
    p95Threshold: 200,
    p99Threshold: 400,
    test: () => simulateModalOpen(),
  },
  'game.turn.process': {
    name: 'Game Turn Process',
    p95Threshold: 500,
    p99Threshold: 800,
    test: () => simulateTurnProcess(),
  },
  'data.save': {
    name: 'Data Save',
    p95Threshold: 800,
    p99Threshold: 1200,
    test: () => simulateDataSave(),
  },
};

// 模拟函数
async function simulateStartup() {
  // 模拟应用启动时间 (1-4秒)
  const delay = 1000 + Math.random() * 3000;
  await sleep(delay);
  return delay;
}

async function simulateSceneLoad() {
  // 模拟场景加载时间 (500-2000ms)
  const delay = 500 + Math.random() * 1500;
  await sleep(delay);
  return delay;
}

async function simulateModalOpen() {
  // 模拟模态框打开时间 (50-300ms)
  const delay = 50 + Math.random() * 250;
  await sleep(delay);
  return delay;
}

async function simulateTurnProcess() {
  // 模拟回合处理时间 (200-1000ms)
  const delay = 200 + Math.random() * 800;
  await sleep(delay);
  return delay;
}

async function simulateDataSave() {
  // 模拟数据保存时间 (300-1500ms)
  const delay = 300 + Math.random() * 1200;
  await sleep(delay);
  return delay;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 性能测量工具类
class PerformanceBenchmark {
  constructor() {
    this.measurements = new Map();
  }

  async measureFunction(name, fn, iterations = 10) {
    const results = [];
    const warmupRounds = 3; // 预热轮数

    console.log(
      `📊 运行性能测试: ${name} (${iterations}次，前${warmupRounds}次预热)`
    );

    for (let i = 0; i < iterations; i++) {
      const startMark = `${name}.${i}.start`;
      const endMark = `${name}.${i}.end`;

      performance.mark(startMark);

      try {
        await fn();
        performance.mark(endMark);

        const measurement = performance.measure(
          `${name}.${i}`,
          startMark,
          endMark
        );

        // 跳过预热轮次的数据
        if (i >= warmupRounds) {
          results.push(measurement.duration);
        } else {
          console.log(
            `   预热轮次 ${i + 1}/${warmupRounds}: ${measurement.duration.toFixed(2)}ms (跳过)`
          );
        }

        // 显示进度
        if ((i + 1) % Math.max(1, Math.floor(iterations / 10)) === 0) {
          console.log(`   Progress: ${i + 1}/${iterations}`);
        }
      } catch (error) {
        console.error(`   测试失败 ${i + 1}:`, error.message);
        performance.mark(endMark);
      }
    }

    this.measurements.set(name, results);
    return results;
  }

  calculateStatistics(name) {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    const avg = measurements.reduce((a, b) => a + b, 0) / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p25 = sorted[Math.floor(count * 0.25)];
    const p50 = sorted[Math.floor(count * 0.5)];
    const p75 = sorted[Math.floor(count * 0.75)];
    const p95 = sorted[Math.ceil(count * 0.95) - 1];
    const p99 = sorted[Math.ceil(count * 0.99) - 1];

    // 计算四分位数间距（IQR）
    const iqr = p75 - p25;

    return {
      count,
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      p25: parseFloat(p25.toFixed(2)),
      p50: parseFloat(p50.toFixed(2)),
      p75: parseFloat(p75.toFixed(2)),
      p95: parseFloat(p95.toFixed(2)),
      p99: parseFloat(p99.toFixed(2)),
      iqr: parseFloat(iqr.toFixed(2)),
      rawSamples: measurements, // 保留原始样本用于分析
    };
  }

  checkThresholds(name, p95Threshold, p99Threshold) {
    const stats = this.calculateStatistics(name);
    if (!stats) return { passed: false, reason: 'No measurements' };

    const violations = [];

    if (stats.p95 > p95Threshold) {
      violations.push(`P95 ${stats.p95}ms > ${p95Threshold}ms`);
    }

    if (stats.p99 > p99Threshold) {
      violations.push(`P99 ${stats.p99}ms > ${p99Threshold}ms`);
    }

    return {
      passed: violations.length === 0,
      violations,
      stats,
    };
  }
}

// 主要测试函数
async function runBenchmarks() {
  console.log('🚀 开始User Timing性能基准测试...\n');

  const benchmark = new PerformanceBenchmark();
  const results = {};
  const violations = [];

  // 运行所有性能测试
  for (const [testKey, testConfig] of Object.entries(PERFORMANCE_TESTS)) {
    console.log(`\n=== ${testConfig.name} ===`);

    try {
      // 运行测试 (30次采样，前3次预热)
      await benchmark.measureFunction(testKey, testConfig.test, 30);

      // 计算统计数据
      const stats = benchmark.calculateStatistics(testKey);

      // 检查阈值
      const thresholdCheck = benchmark.checkThresholds(
        testKey,
        testConfig.p95Threshold,
        testConfig.p99Threshold
      );

      results[testKey] = {
        name: testConfig.name,
        stats,
        thresholds: {
          p95: testConfig.p95Threshold,
          p99: testConfig.p99Threshold,
        },
        passed: thresholdCheck.passed,
        violations: thresholdCheck.violations,
      };

      // 打印结果
      console.log(`📈 统计结果 (${stats.count}个有效样本):`);
      console.log(`   平均值: ${stats.avg}ms`);
      console.log(`   中位数(P50): ${stats.p50}ms`);
      console.log(`   四分位数: P25=${stats.p25}ms, P75=${stats.p75}ms`);
      console.log(`   IQR (稳定性指标): ${stats.iqr}ms`);
      console.log(
        `   P95: ${stats.p95}ms (阈值: ${testConfig.p95Threshold}ms)`
      );
      console.log(
        `   P99: ${stats.p99}ms (阈值: ${testConfig.p99Threshold}ms)`
      );
      console.log(`   范围: ${stats.min}ms - ${stats.max}ms`);

      if (thresholdCheck.passed) {
        console.log('✅ 性能测试通过');
      } else {
        console.log('❌ 性能测试失败:');
        thresholdCheck.violations.forEach(v => console.log(`   - ${v}`));
        violations.push(
          `${testConfig.name}: ${thresholdCheck.violations.join(', ')}`
        );
      }
    } catch (error) {
      console.error(`❌ 测试执行失败:`, error.message);
      results[testKey] = {
        name: testConfig.name,
        error: error.message,
        passed: false,
      };
      violations.push(`${testConfig.name}: 测试执行失败`);
    }
  }

  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    nodeVersion: process.version,
    results,
    summary: {
      totalTests: Object.keys(PERFORMANCE_TESTS).length,
      passed: Object.values(results).filter(r => r.passed).length,
      failed: violations.length,
      violations,
    },
  };

  // 保存报告
  const reportsDir = 'logs/performance';
  try {
    await fs.mkdir(reportsDir, { recursive: true });
    const reportPath = path.join(
      reportsDir,
      `user-timing-benchmark-${Date.now()}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告已保存: ${reportPath}`);
  } catch (error) {
    console.error('保存报告失败:', error.message);
  }

  // 打印总结
  console.log('\n=== 性能测试总结 ===');
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`通过: ${report.summary.passed}`);
  console.log(`失败: ${report.summary.failed}`);

  if (violations.length > 0) {
    console.log('\n❌ 性能阈值违规:');
    violations.forEach(v => console.log(`   - ${v}`));
    process.exit(1);
  } else {
    console.log('\n✅ 所有性能测试通过！');
    process.exit(0);
  }
}

// 运行基准测试
runBenchmarks().catch(error => {
  console.error('基准测试失败:', error);
  process.exit(1);
});
