/**
 * 性能测试工具类
 *
 * 实现P95采样方法论，解决单点性能测试抖动问题
 * 基于现有performance.e2e.spec.ts中验证的PerformanceCollector实现
 */

import { expect } from '@playwright/test';

/**
 * 性能指标收集器
 *
 * 支持多指标收集与P95统计分析
 */
export class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map();

  /**
   * 添加性能指标
   * @param name 指标名称
   * @param value 指标数值
   */
  addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * 获取P95值
   * @param name 指标名称
   * @returns P95数值
   */
  getP95(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  /**
   * 获取平均值
   * @param name 指标名称
   * @returns 平均数值
   */
  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 获取最大值
   * @param name 指标名称
   * @returns 最大数值
   */
  getMax(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    return Math.max(...values);
  }

  /**
   * 获取最小值
   * @param name 指标名称
   * @returns 最小数值
   */
  getMin(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    return Math.min(...values);
  }

  /**
   * 获取样本数量
   * @param name 指标名称
   * @returns 样本数量
   */
  getSampleCount(name: string): number {
    const values = this.metrics.get(name);
    return values ? values.length : 0;
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * 获取所有指标的统计摘要
   * @param name 指标名称
   * @returns 统计摘要对象
   */
  getStatistics(name: string): PerformanceStatistics {
    return {
      sampleCount: this.getSampleCount(name),
      average: this.getAverage(name),
      p95: this.getP95(name),
      min: this.getMin(name),
      max: this.getMax(name),
    };
  }
}

/**
 * 性能统计摘要接口
 */
export interface PerformanceStatistics {
  sampleCount: number;
  average: number;
  p95: number;
  min: number;
  max: number;
}

/**
 * P95采样配置选项
 */
export interface P95SamplingOptions {
  /** 采样次数，默认25次 */
  sampleCount?: number;
  /** 采样间隔，默认10ms */
  sampleInterval?: number;
  /** 是否并行执行采样，默认false */
  parallel?: boolean;
  /** 是否输出详细日志，默认true */
  verbose?: boolean;
}

/**
 * 性能测试工具类
 *
 * 提供统一的P95采样性能测试方法
 */
export class PerformanceTestUtils {
  /**
   * 执行P95采样性能测试
   * @param testName 测试名称
   * @param testFunction 测试函数
   * @param threshold P95阈值
   * @param options 采样配置
   */
  static async runP95Test(
    testName: string,
    testFunction: () => Promise<number>,
    threshold: number,
    options: P95SamplingOptions = {}
  ): Promise<PerformanceStatistics> {
    const {
      sampleCount = 25,
      sampleInterval = 10,
      parallel = false,
      verbose = true,
    } = options;

    const collector = new PerformanceCollector();

    if (parallel) {
      // 并行执行采样
      const promises = Array.from({ length: sampleCount }, async (_, i) => {
        if (sampleInterval > 0 && i > 0) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.random() * sampleInterval)
          );
        }
        return await testFunction();
      });

      const results = await Promise.all(promises);
      results.forEach(result => collector.addMetric(testName, result));
    } else {
      // 串行执行采样
      for (let i = 0; i < sampleCount; i++) {
        if (sampleInterval > 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, sampleInterval));
        }

        const result = await testFunction();
        collector.addMetric(testName, result);
      }
    }

    const stats = collector.getStatistics(testName);

    if (verbose) {
      console.log(`${testName} P95采样统计:`);
      console.log(`  样本数量: ${stats.sampleCount}`);
      console.log(`  P95值: ${stats.p95.toFixed(2)}ms`);
      console.log(`  平均值: ${stats.average.toFixed(2)}ms`);
      console.log(`  最小值: ${stats.min.toFixed(2)}ms`);
      console.log(`  最大值: ${stats.max.toFixed(2)}ms`);
      console.log(`  阈值: ${threshold}ms`);
    }

    // P95断言（支持软门禁：PR 场景仅记录不拉红）
    const gateMode = (process?.env?.PERF_GATE_MODE || '')
      .toString()
      .toLowerCase();
    if (gateMode === 'soft') {
      const ok = stats.p95 <= threshold;
      const msg = `[perf-soft-gate] ${testName} p95=${stats.p95.toFixed(2)}ms (threshold=${threshold}ms, samples=${stats.sampleCount}) -> ${ok ? 'OK' : 'EXCEEDS'}`;
      // 软门禁：打印结果供日志收集，不触发断言失败
      if (!ok) {
        // 使用 console.warn 便于在 CI Summary 中醒目
        // 同时保持测试通过，不影响 PR 体验
        console.warn(msg);
      } else {
        console.log(msg);
      }
    } else {
      expect(stats.p95).toBeLessThanOrEqual(threshold);
    }

    return stats;
  }

  /**
   * 执行冷启动P95采样测试
   * @param startupFunction 启动函数
   * @param threshold P95阈值
   * @param sampleCount 采样次数，默认15次（考虑冷启动耗时）
   */
  static async runColdStartupP95Test(
    startupFunction: () => Promise<number>,
    threshold: number,
    sampleCount: number = 15
  ): Promise<PerformanceStatistics> {
    return this.runP95Test('cold_startup', startupFunction, threshold, {
      sampleCount,
      sampleInterval: 100, // 冷启动间隔稍长
      parallel: false,
      verbose: true,
    });
  }

  /**
   * 执行交互响应P95采样测试
   * @param interactionFunction 交互函数
   * @param threshold P95阈值
   * @param sampleCount 采样次数，默认30次
   */
  static async runInteractionP95Test(
    interactionFunction: () => Promise<number>,
    threshold: number,
    sampleCount: number = 30
  ): Promise<PerformanceStatistics> {
    return this.runP95Test(
      'interaction_response',
      interactionFunction,
      threshold,
      {
        sampleCount,
        sampleInterval: 50,
        parallel: false,
        verbose: true,
      }
    );
  }

  /**
   * 执行并发操作P95采样测试
   * @param concurrentFunction 并发操作函数
   * @param threshold P95阈值
   * @param sampleCount 采样次数，默认20次
   */
  static async runConcurrentP95Test(
    concurrentFunction: () => Promise<number>,
    threshold: number,
    sampleCount: number = 20
  ): Promise<PerformanceStatistics> {
    return this.runP95Test(
      'concurrent_operations',
      concurrentFunction,
      threshold,
      {
        sampleCount,
        sampleInterval: 25,
        parallel: true, // 并发测试使用并行采样
        verbose: true,
      }
    );
  }
}

/**
 * 用户提供的P95计算函数（保持兼容性）
 * @param arr 数值数组
 * @returns P95值
 */
export function p95(arr: number[]): number {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.ceil(a.length * 0.95) - 1];
}

/**
 * 创建性能采样测试的示例函数
 *
 * 基于用户提供的测试模式
 */
export async function createP95SampleTest(
  page: any,
  selector: string,
  waitSelector: string,
  threshold: number,
  sampleCount: number = 30
): Promise<void> {
  const samples: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t0 = performance.now();

    await page.click(selector);
    await page.waitForSelector(waitSelector, { state: 'visible' });

    samples.push(performance.now() - t0);
  }

  const p95Value = p95(samples);
  console.log(
    `P95采样结果: ${p95Value.toFixed(2)}ms (阈值: ${threshold}ms, 样本数: ${sampleCount})`
  );

  expect(p95Value).toBeLessThan(threshold);
}
