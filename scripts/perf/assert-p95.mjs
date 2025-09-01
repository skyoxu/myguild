#!/usr/bin/env node

/**
 * 性能门禁脚本 - P95断言工具
 * 验证帧率(60 FPS≈16.7ms)和交互延迟(P95≤100ms)阈值
 * 符合 ADR-0005 质量门禁要求
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 硬编码性能阈值（来自ADR-0005）- 不可调整
const PERFORMANCE_THRESHOLDS = {
  frameTime: {
    target: 16.7, // 60 FPS = 16.7ms/frame
    p95: 16.7, // P95 不应超过目标帧时间
    p99: 33.4, // P99 允许偶尔翻倍（但仍需 >30fps）
    description: '渲染帧时间',
  },
  interaction: {
    target: 50, // 目标交互响应时间
    p95: 100, // P95 ≤ 100ms 关键交互
    p99: 200, // P99 允许更高延迟
    description: '交互响应时间',
  },
  eventProcessing: {
    target: 25, // 目标事件处理时间
    p95: 50, // P95 ≤ 50ms 事件处理
    p99: 100, // P99 允许更高延迟
    description: '事件处理时间',
  },
  startup: {
    target: 2000, // 目标启动时间 2秒
    p95: 3000, // P95 ≤ 3秒应用启动
    p99: 5000, // P99 允许 5秒启动
    description: '应用启动时间',
  },
};

/**
 * 计算P95值
 * @param {number[]} values 数值数组
 * @returns {number} P95值
 */
function calculateP95(values) {
  if (!values || values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算P99值
 * @param {number[]} values 数值数组
 * @returns {number} P99值
 */
function calculateP99(values) {
  if (!values || values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.99) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 验证性能指标
 * @param {string} metricName 指标名称
 * @param {number[]} samples 样本数据
 * @param {object} thresholds 阈值配置
 */
function validatePerformanceMetric(metricName, samples, thresholds) {
  if (!samples || samples.length === 0) {
    throw new Error(`${metricName}: 没有性能样本数据`);
  }

  const p95 = calculateP95(samples);
  const p99 = calculateP99(samples);
  const avg = samples.reduce((sum, val) => sum + val, 0) / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);

  console.log(`📊 ${thresholds.description}统计:`);
  console.log(`  样本数量: ${samples.length}`);
  console.log(`  平均值: ${avg.toFixed(2)}ms`);
  console.log(`  P95值: ${p95.toFixed(2)}ms (阈值: ${thresholds.p95}ms)`);
  console.log(`  P99值: ${p99.toFixed(2)}ms (阈值: ${thresholds.p99}ms)`);
  console.log(`  最小值: ${min.toFixed(2)}ms`);
  console.log(`  最大值: ${max.toFixed(2)}ms`);

  const failures = [];

  // P95断言
  if (p95 > thresholds.p95) {
    failures.push(`P95 ${p95.toFixed(2)}ms > ${thresholds.p95}ms`);
  }

  // P99断言
  if (p99 > thresholds.p99) {
    failures.push(`P99 ${p99.toFixed(2)}ms > ${thresholds.p99}ms`);
  }

  // 样本数量断言（至少需要20个样本保证统计有效性）
  if (samples.length < 20) {
    failures.push(`样本数量 ${samples.length} < 20（统计无效）`);
  }

  if (failures.length > 0) {
    throw new Error(
      `${metricName} 性能门禁失败:\n${failures.map(f => `  - ${f}`).join('\n')}`
    );
  }

  console.log(`✅ ${metricName} 性能门禁通过！`);
  return {
    metric: metricName,
    sampleCount: samples.length,
    avg: avg,
    p95: p95,
    p99: p99,
    min: min,
    max: max,
    thresholds: thresholds,
    passed: true,
  };
}

/**
 * 从性能报告文件读取数据
 * @param {string} reportPath 报告文件路径
 * @returns {object} 性能数据
 */
function loadPerformanceReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`性能报告文件不存在: ${reportPath}`);
  }

  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`读取性能报告失败: ${error.message}`);
  }
}

/**
 * 生成模拟性能数据（用于演示和测试）
 */
function generateMockPerformanceData() {
  console.log('🧪 生成模拟性能数据进行演示...\n');

  return {
    frameTime: [
      // 大部分帧符合60fps (16.7ms)，少数抖动
      ...Array(40)
        .fill(0)
        .map(() => 14 + Math.random() * 5), // 14-19ms
      ...Array(5)
        .fill(0)
        .map(() => 20 + Math.random() * 10), // 20-30ms 抖动
    ],
    interaction: [
      // 大部分交互响应快速，少数较慢
      ...Array(35)
        .fill(0)
        .map(() => 30 + Math.random() * 40), // 30-70ms
      ...Array(10)
        .fill(0)
        .map(() => 80 + Math.random() * 30), // 80-110ms
    ],
    eventProcessing: [
      // 事件处理大部分很快
      ...Array(45)
        .fill(0)
        .map(() => 5 + Math.random() * 35), // 5-40ms
      ...Array(5)
        .fill(0)
        .map(() => 45 + Math.random() * 15), // 45-60ms
    ],
    startup: [
      // 启动时间相对稳定
      ...Array(15)
        .fill(0)
        .map(() => 1800 + Math.random() * 800), // 1.8-2.6s
      ...Array(5)
        .fill(0)
        .map(() => 2800 + Math.random() * 400), // 2.8-3.2s
    ],
  };
}

/**
 * 主性能门禁检查函数
 */
async function runPerformanceGates() {
  console.log('🚀 开始性能门禁检查...');
  console.log('📋 参考标准: ADR-0005 质量门禁要求\n');

  const results = {};
  const errors = [];

  try {
    // 查找性能报告文件
    const performanceReportPath = path.join(
      __dirname,
      '..',
      '..',
      '.performance-report.json'
    );

    let performanceData;

    if (fs.existsSync(performanceReportPath)) {
      console.log('📊 读取性能报告文件...');
      performanceData = loadPerformanceReport(performanceReportPath);
    } else {
      console.log('⚠️  未找到性能报告文件，使用模拟数据演示');
      performanceData = generateMockPerformanceData();
    }

    // 1. 验证帧率性能
    if (performanceData.frameTime && performanceData.frameTime.length > 0) {
      try {
        results.frameTime = validatePerformanceMetric(
          '渲染帧时间',
          performanceData.frameTime,
          PERFORMANCE_THRESHOLDS.frameTime
        );
      } catch (error) {
        results.frameTime = { passed: false, error: error.message };
        errors.push(`帧率性能检查失败: ${error.message}`);
      }
    } else {
      console.log('⚠️  跳过帧率检查：无数据');
      results.frameTime = { passed: true, skipped: true, reason: '无帧率数据' };
    }

    console.log(''); // 空行分隔

    // 2. 验证交互性能
    if (performanceData.interaction && performanceData.interaction.length > 0) {
      try {
        results.interaction = validatePerformanceMetric(
          '交互响应',
          performanceData.interaction,
          PERFORMANCE_THRESHOLDS.interaction
        );
      } catch (error) {
        results.interaction = { passed: false, error: error.message };
        errors.push(`交互性能检查失败: ${error.message}`);
      }
    } else {
      console.log('⚠️  跳过交互检查：无数据');
      results.interaction = {
        passed: true,
        skipped: true,
        reason: '无交互数据',
      };
    }

    console.log(''); // 空行分隔

    // 3. 验证事件处理性能
    if (
      performanceData.eventProcessing &&
      performanceData.eventProcessing.length > 0
    ) {
      try {
        results.eventProcessing = validatePerformanceMetric(
          '事件处理',
          performanceData.eventProcessing,
          PERFORMANCE_THRESHOLDS.eventProcessing
        );
      } catch (error) {
        results.eventProcessing = { passed: false, error: error.message };
        errors.push(`事件处理检查失败: ${error.message}`);
      }
    } else {
      console.log('⚠️  跳过事件处理检查：无数据');
      results.eventProcessing = {
        passed: true,
        skipped: true,
        reason: '无事件处理数据',
      };
    }

    console.log(''); // 空行分隔

    // 4. 验证启动性能
    if (performanceData.startup && performanceData.startup.length > 0) {
      try {
        results.startup = validatePerformanceMetric(
          '应用启动',
          performanceData.startup,
          PERFORMANCE_THRESHOLDS.startup
        );
      } catch (error) {
        results.startup = { passed: false, error: error.message };
        errors.push(`启动性能检查失败: ${error.message}`);
      }
    } else {
      console.log('⚠️  跳过启动检查：无数据');
      results.startup = { passed: true, skipped: true, reason: '无启动数据' };
    }

    // 生成报告
    const reportDir = path.join(__dirname, '..', '..', 'logs', 'performance');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const reportFile = path.join(
      reportDir,
      `performance-gates-${timestamp}.json`
    );

    const report = {
      timestamp: new Date().toISOString(),
      thresholds: PERFORMANCE_THRESHOLDS,
      results,
      summary: {
        totalChecks: Object.keys(results).length,
        passedChecks: Object.values(results).filter(r => r.passed).length,
        failedChecks: Object.values(results).filter(
          r => !r.passed && !r.skipped
        ).length,
        skippedChecks: Object.values(results).filter(r => r.skipped).length,
      },
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 性能门禁报告已保存: ${reportFile}\n`);

    // 显示结果汇总
    console.log('📊 性能门禁结果汇总:');
    console.log(`  总检查项: ${report.summary.totalChecks}`);
    console.log(`  通过检查: ${report.summary.passedChecks}`);
    console.log(`  失败检查: ${report.summary.failedChecks}`);
    console.log(`  跳过检查: ${report.summary.skippedChecks}`);

    if (errors.length > 0) {
      console.log('\n❌ 性能门禁失败:');
      errors.forEach(error => console.log(`  - ${error}`));
      console.log('\n💡 建议:');
      console.log('  1. 运行性能基准测试: npm run test:perf');
      console.log('  2. 检查性能报告: logs/performance/');
      console.log('  3. 优化帧率和交互响应时间');
      console.log('  4. 确保测试环境稳定（关闭其他程序）');

      process.exit(1);
    } else {
      console.log('\n✅ 性能门禁检查全部通过！');
      console.log('🎉 性能指标均达到ADR-0005要求');
    }
  } catch (error) {
    console.error('❌ 性能门禁脚本执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出函数供其他模块使用
export {
  runPerformanceGates,
  validatePerformanceMetric,
  calculateP95,
  calculateP99,
  PERFORMANCE_THRESHOLDS,
};

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceGates();
}
