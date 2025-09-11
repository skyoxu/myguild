/**
 * 性能冒烟测试 - Playwright × Electron
 *
 * 验证关键性能指标是否在预算范围内，确保性能回归及时发现
 * 基于Base-Clean架构的Electron应用性能验证
 * 使用P95采样方法论替代单点断言，解决性能测试抖动问题
 */

import { test, expect } from '@playwright/test';
import { launchApp } from '../helpers/launch';
import { ElectronApplication, Page } from '@playwright/test';
import {
  DEFAULT_FRAME_BUDGET,
  DEFAULT_LATENCY_BUDGET,
} from '../../src/shared/contracts/perf';
import {
  PerformanceTestUtils,
  PerformanceCollector,
} from '../utils/PerformanceTestUtils';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // 启动Electron应用
  electronApp = await launchApp();
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('性能冒烟测试套件', () => {
  test('应用冷启动性能验证 - P95采样', async () => {
    // 使用P95采样方法验证冷启动性能
    await PerformanceTestUtils.runColdStartupP95Test(
      async () => {
        // 确保应用完全关闭
        if (electronApp) {
          await electronApp.close();
        }

        const startTime = performance.now();
        electronApp = await launchApp();
        page = await electronApp.firstWindow();

        // 等待应用完全加载
        await page.waitForSelector('[data-testid="app-root"]', {
          timeout: DEFAULT_LATENCY_BUDGET.assetLoad.cold,
        });

        return performance.now() - startTime;
      },
      DEFAULT_LATENCY_BUDGET.assetLoad.cold,
      15 // 冷启动采样15次（考虑耗时）
    );
  });

  test('页面加载性能验证', async () => {
    // 启动性能监控
    await page.coverage.startJSCoverage();

    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 5000 });

    // 测量关键性能指标
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        load: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint:
          paint.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint:
          paint.find(entry => entry.name === 'first-contentful-paint')
            ?.startTime || 0,
        renderStart: navigation.domContentLoadedEventStart,
        renderComplete: navigation.loadEventEnd,
      };
    });

    // 验证DOM加载性能
    expect(performanceMetrics.domContentLoaded).toBeLessThan(1000);
    console.log(
      `DOM加载时间: ${performanceMetrics.domContentLoaded.toFixed(2)}ms`
    );

    // 验证完整加载性能
    expect(performanceMetrics.load).toBeLessThan(
      DEFAULT_LATENCY_BUDGET.assetLoad.cold
    );
    console.log(`完整加载时间: ${performanceMetrics.load.toFixed(2)}ms`);

    // 验证首次绘制性能
    if (performanceMetrics.firstPaint > 0) {
      expect(performanceMetrics.firstPaint).toBeLessThan(1000);
      console.log(
        `首次绘制时间: ${performanceMetrics.firstPaint.toFixed(2)}ms`
      );
    }

    await page.coverage.stopJSCoverage();
  });

  test('交互响应性能验证 - P95采样', async () => {
    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // ✅ 交互测试前置：确保窗口前台且稳定帧后再开始计时
    await page.bringToFront();
    // 用双 rAF 进入稳定帧后再开始计时
    await page.evaluate(
      () =>
        new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );

    // 测试按钮点击响应时间
    const testButton = page.locator('[data-testid="test-button"]').first();

    if ((await testButton.count()) > 0) {
      // 使用P95采样方法验证交互响应性能
      await PerformanceTestUtils.runInteractionP95Test(
        async () => {
          const startTime = Date.now();

          await testButton.click();

          // 等待响应完成（可根据实际应用调整选择器）
          await page.waitForSelector('[data-testid="response-indicator"]', {
            timeout: DEFAULT_LATENCY_BUDGET.interaction.p95,
          });

          return Date.now() - startTime;
        },
        DEFAULT_LATENCY_BUDGET.interaction.p95,
        30 // 交互响应采样30次
      );
    } else {
      console.log('未找到测试按钮，跳过交互响应测试');
    }
  });

  test('帧率性能验证', async () => {
    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // 监控帧率性能
    const frameData = await page.evaluate(async () => {
      return new Promise<{ averageFrameTime: number; frameCount: number }>(
        resolve => {
          const frames: number[] = [];
          let lastFrameTime = performance.now();
          let frameCount = 0;
          const maxFrames = 60; // 监控1秒钟（假设60FPS）

          function measureFrame() {
            const currentTime = performance.now();
            const frameTime = currentTime - lastFrameTime;
            frames.push(frameTime);
            lastFrameTime = currentTime;
            frameCount++;

            if (frameCount < maxFrames) {
              requestAnimationFrame(measureFrame);
            } else {
              const averageFrameTime =
                frames.reduce((sum, frame) => sum + frame, 0) / frames.length;
              resolve({ averageFrameTime, frameCount });
            }
          }

          requestAnimationFrame(measureFrame);
        }
      );
    });

    // 验证平均帧时间在预算内
    expect(frameData.averageFrameTime).toBeLessThan(
      DEFAULT_FRAME_BUDGET.budgetMs
    );

    const actualFPS = 1000 / frameData.averageFrameTime;
    expect(actualFPS).toBeGreaterThan(DEFAULT_FRAME_BUDGET.target * 0.9); // 允许10%的容忍度

    console.log(`平均帧时间: ${frameData.averageFrameTime.toFixed(2)}ms`);
    console.log(
      `实际FPS: ${actualFPS.toFixed(1)} (目标: ${DEFAULT_FRAME_BUDGET.target})`
    );
  });

  test('内存使用性能验证', async () => {
    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // 获取内存使用情况
    const memoryInfo = await page.evaluate(() => {
      if ('memory' in performance) {
        const mem = (performance as any).memory;
        return {
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (memoryInfo) {
      // 验证JS堆内存使用率不超过80%
      const heapUsageRatio =
        memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
      expect(heapUsageRatio).toBeLessThan(0.8);

      console.log(
        `JS堆内存使用: ${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `JS堆内存总量: ${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`内存使用率: ${(heapUsageRatio * 100).toFixed(1)}%`);
    }

    // 获取进程内存信息（如果可用）
    const processMemory = await electronApp.evaluate(async ({ app }) => {
      return app.getAppMetrics();
    });

    if (processMemory && processMemory.length > 0) {
      const totalMemory = processMemory.reduce(
        (sum, process) => sum + process.memory.workingSetSize,
        0
      );
      const totalMemoryMB = totalMemory / 1024; // 转换为MB

      // 验证总进程内存使用在合理范围内（根据实际应用调整）
      expect(totalMemoryMB).toBeLessThan(2048); // 2GB上限

      console.log(`总进程内存使用: ${totalMemoryMB.toFixed(2)}MB`);
    }
  });

  test('场景切换性能验证', async () => {
    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // 查找场景切换控件（根据实际应用调整）
    const sceneButton = page
      .locator('[data-testid="scene-switch-button"]')
      .first();

    if ((await sceneButton.count()) > 0) {
      const startTime = performance.now();

      await sceneButton.click();

      // 等待场景切换完成
      await page.waitForSelector('[data-testid="new-scene-loaded"]', {
        timeout: DEFAULT_LATENCY_BUDGET.sceneSwitch.p95,
      });

      const switchTime = performance.now() - startTime;

      // 验证场景切换时间在预算内
      expect(switchTime).toBeLessThan(DEFAULT_LATENCY_BUDGET.sceneSwitch.p95);
      console.log(
        `场景切换时间: ${switchTime.toFixed(2)}ms (预算P95: ${DEFAULT_LATENCY_BUDGET.sceneSwitch.p95}ms)`
      );
    } else {
      console.log('未找到场景切换控件，跳过场景切换测试');
    }
  });

  test('资源加载性能验证', async () => {
    // 测试热缓存性能 - 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // 重新加载测试热缓存
    const reloadStart = performance.now();
    await page.reload();
    await page.waitForSelector('[data-testid="app-root"]');
    const hotReloadTime = performance.now() - reloadStart;

    // 验证热缓存加载性能
    expect(hotReloadTime).toBeLessThan(DEFAULT_LATENCY_BUDGET.assetLoad.warm);
    console.log(
      `热缓存加载时间: ${hotReloadTime.toFixed(2)}ms (预算: ${DEFAULT_LATENCY_BUDGET.assetLoad.warm}ms)`
    );
  });

  test('并发操作性能验证 - P95采样', async () => {
    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // 使用P95采样方法验证并发操作性能
    await PerformanceTestUtils.runConcurrentP95Test(
      async () => {
        // 模拟并发操作
        const concurrentOperations = [];
        const operationCount = 10;

        for (let i = 0; i < operationCount; i++) {
          const operation = page.evaluate(index => {
            // 模拟轻量级操作
            const start = performance.now();
            // 执行一些计算或DOM操作
            for (let j = 0; j < 1000; j++) {
              const div = document.createElement('div');
              div.textContent = `Operation ${index}-${j}`;
              document.body.appendChild(div);
              document.body.removeChild(div);
            }
            return performance.now() - start;
          }, i);

          concurrentOperations.push(operation);
        }

        const results = await Promise.all(concurrentOperations);
        const maxOperationTime = Math.max(...results);

        return maxOperationTime; // 返回最大操作时间作为并发性能指标
      },
      100, // P95阈值：100ms
      20 // 并发操作采样20次
    );
  });
});

test.describe('性能回归检测', () => {
  test('基线性能快照对比', async () => {
    // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
    await page.waitForSelector('[data-testid="app-root"]');

    // 收集关键性能指标
    const performanceSnapshot = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      return {
        timestamp: Date.now(),
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        load: navigation.loadEventEnd - navigation.loadEventStart,
        memoryUsage: (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0,
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });

    // TODO: 与基线快照比较，实现回归检测逻辑
    // 这里可以读取之前保存的基线数据进行对比
    console.log('性能快照:', JSON.stringify(performanceSnapshot, null, 2));

    // 基本合理性检查
    expect(performanceSnapshot.domContentLoaded).toBeGreaterThan(0);
    expect(performanceSnapshot.load).toBeGreaterThan(
      performanceSnapshot.domContentLoaded
    );
  });
});
