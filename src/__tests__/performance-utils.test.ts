/**
 * 性能测试工具类单元测试
 * 验证 P95 采样方法论的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PerformanceCollector,
  PerformanceTestUtils,
  p95,
} from '../../tests/utils/PerformanceTestUtils';

describe('P95 性能测试工具', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  describe('PerformanceCollector', () => {
    it('应该正确计算 P95 值', () => {
      // 准备测试数据：[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      const testData = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      testData.forEach(value => {
        collector.addMetric('test', value);
      });

      const p95Value = collector.getP95('test');

      // P95 应该是第 95% 位的值
      // 对于 10 个数字，95% 位置是索引 9 (Math.ceil(10 * 0.95) - 1 = 9)
      expect(p95Value).toBe(100);
    });

    it('应该正确计算平均值', () => {
      const testData = [10, 20, 30, 40, 50];

      testData.forEach(value => {
        collector.addMetric('average_test', value);
      });

      const avgValue = collector.getAverage('average_test');
      expect(avgValue).toBe(30); // (10+20+30+40+50)/5 = 30
    });

    it('应该处理空数据集', () => {
      expect(collector.getP95('nonexistent')).toBe(0);
      expect(collector.getAverage('nonexistent')).toBe(0);
      expect(collector.getSampleCount('nonexistent')).toBe(0);
    });

    it('应该正确报告样本数量', () => {
      collector.addMetric('count_test', 1);
      collector.addMetric('count_test', 2);
      collector.addMetric('count_test', 3);

      expect(collector.getSampleCount('count_test')).toBe(3);
    });
  });

  describe('P95 计算函数', () => {
    it('应该正确计算各种数据集的 P95 值', () => {
      // 测试案例 1: 20 个数字 (1-20)
      const data1 = Array.from({ length: 20 }, (_, i) => i + 1);
      const p95_1 = p95(data1);
      expect(p95_1).toBe(19); // Math.ceil(20 * 0.95) - 1 = 18, data[18] = 19

      // 测试案例 2: 100 个数字 (1-100)
      const data2 = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95_2 = p95(data2);
      expect(p95_2).toBe(95); // Math.ceil(100 * 0.95) - 1 = 94, data[94] = 95

      // 测试案例 3: 乱序数据
      const data3 = [100, 50, 75, 25, 90, 10, 60, 80, 40, 30];
      const p95_3 = p95(data3);
      expect(p95_3).toBe(100); // 排序后第 95% 位
    });

    it('应该处理边界情况', () => {
      expect(p95([42])).toBe(42); // 单个值
      expect(p95([1, 2])).toBe(2); // 两个值，P95 应该取较大值
    });
  });

  describe('PerformanceTestUtils 工厂方法', () => {
    it('runP95Test 应该执行指定次数的采样', async () => {
      let callCount = 0;

      const testFunction = async () => {
        callCount++;
        return Math.random() * 100; // 模拟性能测试返回随机时间
      };

      const stats = await PerformanceTestUtils.runP95Test(
        'test_metric',
        testFunction,
        200, // 阈值
        { sampleCount: 10, verbose: false }
      );

      expect(callCount).toBe(10);
      expect(stats.sampleCount).toBe(10);
      expect(stats.p95).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(0);
    }, 10000); // 增加超时时间

    it('应该在 P95 超过阈值时抛出错误', async () => {
      const testFunction = async () => {
        return 150; // 固定返回超过阈值的值
      };

      await expect(
        PerformanceTestUtils.runP95Test(
          'failing_test',
          testFunction,
          100, // 阈值低于返回值
          { sampleCount: 5, verbose: false }
        )
      ).rejects.toThrow();
    });
  });
});
