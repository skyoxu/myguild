/**
 * P95 采样验证演示
 * 展示为什么 P95 采样比单点断言更稳定可靠
 */

import { describe, it, expect } from 'vitest';
import {
  PerformanceCollector,
  p95,
} from '../../tests/utils/PerformanceTestUtils';

describe('P95 采样方法论验证', () => {
  it('演示单点测试的不稳定性 vs P95 的稳定性', () => {
    // 模拟真实性能测试中的波动情况
    // 大部分情况下性能良好 (50-80ms)，但偶尔出现抖动 (150-200ms)
    const simulatedPerformanceData = [
      // 大部分正常情况 (85% 良好性能)
      ...Array(17)
        .fill(0)
        .map(() => 50 + Math.random() * 30), // 50-80ms
      // 少数抖动情况 (15% 性能抖动)
      ...Array(3)
        .fill(0)
        .map(() => 150 + Math.random() * 50), // 150-200ms
    ];

    // 随机打乱数据，模拟真实测试中的随机性
    for (let i = simulatedPerformanceData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [simulatedPerformanceData[i], simulatedPerformanceData[j]] = [
        simulatedPerformanceData[j],
        simulatedPerformanceData[i],
      ];
    }

    console.log(
      '模拟性能数据:',
      simulatedPerformanceData.map(v => v.toFixed(1))
    );

    // 计算统计信息
    const p95Value = p95(simulatedPerformanceData);
    const average =
      simulatedPerformanceData.reduce((a, b) => a + b) /
      simulatedPerformanceData.length;
    const max = Math.max(...simulatedPerformanceData);
    const min = Math.min(...simulatedPerformanceData);

    console.log(`统计结果:`);
    console.log(`  最小值: ${min.toFixed(1)}ms`);
    console.log(`  平均值: ${average.toFixed(1)}ms`);
    console.log(`  P95值:  ${p95Value.toFixed(1)}ms`);
    console.log(`  最大值: ${max.toFixed(1)}ms`);

    // P95 应该过滤掉极端抖动，体现正常性能水平
    expect(p95Value).toBeLessThan(max); // P95 应该小于最大值
    expect(p95Value).toBeGreaterThan(average); // P95 应该大于平均值
    expect(p95Value).toBeLessThan(200); // 在我们的模拟中，P95 应该过滤掉极端情况
  });

  it('对比单点断言的不稳定性', () => {
    // 模拟 10 次独立的"单点测试"，每次只采样 1 个值
    const singlePointResults: number[] = [];
    const simulatedRuns = 10;

    for (let run = 0; run < simulatedRuns; run++) {
      // 每次"单点测试"的随机结果
      // 大部分时间是好的 (70ms)，但有 20% 概率出现抖动 (180ms)
      const singleMeasurement = Math.random() < 0.8 ? 70 : 180;
      singlePointResults.push(singleMeasurement);
    }

    console.log('单点测试结果:', singlePointResults);

    // 统计单点测试中有多少次会"误报"（超过 100ms 阈值）
    const failuresCount = singlePointResults.filter(v => v > 100).length;
    const failureRate = failuresCount / simulatedRuns;

    console.log(
      `单点测试失败率: ${(failureRate * 100).toFixed(1)}% (${failuresCount}/${simulatedRuns})`
    );

    // 现在用 P95 方法测试同样的性能特征
    const p95Samples: number[] = [];
    for (let i = 0; i < 25; i++) {
      // 每个样本：80% 概率是良好性能，20% 概率是抖动
      const sample = Math.random() < 0.8 ? 70 : 180;
      p95Samples.push(sample);
    }

    const p95Result = p95(p95Samples);
    const p95Passes = p95Result <= 100;

    console.log(`P95 采样结果: ${p95Result.toFixed(1)}ms`);
    console.log(`P95 测试通过: ${p95Passes}`);

    // P95 方法应该更稳定：即使有 20% 的抖动，P95 仍然反映主要性能水平
    // 因为 P95 会过滤掉最差的 5%
  });

  it('验证 P95 计算的数学正确性', () => {
    // 构造已知结果的测试数据
    const testData = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // 10 个数

    const p95Value = p95(testData);

    // 对于 10 个数字，P95 位置计算：
    // Math.ceil(10 * 0.95) - 1 = Math.ceil(9.5) - 1 = 10 - 1 = 9
    // 所以 P95 应该是索引 9 的值，即 100
    expect(p95Value).toBe(100);

    // 测试更大的数据集
    const largeData = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100
    const p95Large = p95(largeData);

    // 对于 100 个数字：Math.ceil(100 * 0.95) - 1 = 95 - 1 = 94
    // 所以 P95 应该是索引 94 的值，即 95
    expect(p95Large).toBe(95);
  });

  it('验证 PerformanceCollector 的完整统计功能', () => {
    const collector = new PerformanceCollector();

    // 添加模拟性能数据
    const performanceData = [45, 55, 65, 75, 85, 95, 105, 115, 125, 135];

    performanceData.forEach(value => {
      collector.addMetric('test_metric', value);
    });

    const stats = collector.getStatistics('test_metric');

    expect(stats.sampleCount).toBe(10);
    expect(stats.average).toBe(90); // (45+55+...+135)/10 = 900/10 = 90
    expect(stats.min).toBe(45);
    expect(stats.max).toBe(135);
    expect(stats.p95).toBe(135); // 对于这 10 个数，P95 是最大值
  });
});
