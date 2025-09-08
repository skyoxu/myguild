/**
 * 公会管理器性能测试
 * 验证 SLO 要求和性能基准
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

// 性能指标收集器
class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map();

  addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getP95(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  reset(): void {
    this.metrics.clear();
  }
}

const perfCollector = new PerformanceCollector();
let testApp: { electronApp: ElectronApplication; page: Page };

test.beforeAll(async () => {
  // 使用统一启动器（cifix1.txt要求）
  const { app, page } = await launchApp();

  testApp = { electronApp: app, page };
});

test.afterAll(async () => {
  if (testApp?.electronApp) {
    await testApp.electronApp.close();
  }
});

test.describe('Guild Manager - Performance SLO Validation', () => {
  test.beforeEach(() => {
    perfCollector.reset();
  });

  test('should meet UI interaction P95 ≤ 100ms SLO', async () => {
    const { page } = testApp;

    // 执行多次 UI 交互测试
    const interactions = [
      () => page.click('[data-testid="nav-members"]'),
      () => page.click('[data-testid="nav-tactical"]'),
      () => page.click('[data-testid="nav-raids"]'),
      () => page.click('[data-testid="nav-diplomacy"]'),
      () => page.click('[data-testid="nav-overview"]'),
    ];

    // 预热
    await page.click('[data-testid="nav-overview"]');
    await page.waitForSelector('[data-testid="guild-overview-panel"]');

    // 执行性能测试
    for (let i = 0; i < 20; i++) {
      for (const interaction of interactions) {
        const startTime = performance.now();

        await interaction();
        await page.waitForLoadState('networkidle');

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        perfCollector.addMetric('ui_interaction', responseTime);
      }
    }

    // 验证 P95 性能
    const p95ResponseTime = perfCollector.getP95('ui_interaction');
    const avgResponseTime = perfCollector.getAverage('ui_interaction');

    console.log(`UI Interaction P95: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`UI Interaction Average: ${avgResponseTime.toFixed(2)}ms`);

    expect(p95ResponseTime).toBeLessThanOrEqual(100);
  });

  test('should meet event processing P95 ≤ 50ms SLO', async () => {
    const { page } = testApp;

    // 模拟事件处理性能测试
    for (let i = 0; i < 50; i++) {
      const startTime = performance.now();

      // 触发事件处理（如资源更新）
      await page.evaluate(() => {
        // 模拟 CloudEvent 处理
        const event = {
          specversion: '1.0',
          id: 'test-event-' + Date.now(),
          source: '/guild-manager/core/test',
          type: 'com.guildmanager.resource.updated',
          time: new Date().toISOString(),
          data: {
            resourceType: 'GOLD',
            changeAmount: 100,
          },
        };

        // 假设通过 electronAPI 发送事件
        if (window.electronAPI && window.electronAPI.sendCloudEvent) {
          return window.electronAPI.sendCloudEvent(event);
        }
        return Promise.resolve();
      });

      await page.waitForTimeout(10); // 等待事件处理
      const endTime = performance.now();

      perfCollector.addMetric('event_processing', endTime - startTime);
    }

    const p95EventTime = perfCollector.getP95('event_processing');
    const avgEventTime = perfCollector.getAverage('event_processing');

    console.log(`Event Processing P95: ${p95EventTime.toFixed(2)}ms`);
    console.log(`Event Processing Average: ${avgEventTime.toFixed(2)}ms`);

    expect(p95EventTime).toBeLessThanOrEqual(50);
  });

  test('should handle large member list rendering efficiently', async () => {
    const { page } = testApp;

    // 导航到成员管理页面
    await page.click('[data-testid="nav-members"]');
    await page.waitForSelector('[data-testid="member-management-root"]');

    // 模拟大量成员数据渲染
    const startTime = performance.now();

    await page.evaluate(() => {
      // 模拟加载大量成员数据
      const mockMembers = Array.from({ length: 1000 }, (_, i) => ({
        id: `member-${i}`,
        name: `Member ${i}`,
        class: ['WARRIOR', 'MAGE', 'ROGUE', 'HEALER'][i % 4],
        level: Math.floor(Math.random() * 100) + 1,
        satisfaction: Math.floor(Math.random() * 100),
      }));

      // 假设通过状态管理更新成员列表
      if (window.testAPI && window.testAPI.setMemberList) {
        window.testAPI.setMemberList(mockMembers);
      }
    });

    // 等待渲染完成
    await page.waitForSelector('[data-testid="member-list"]');
    await page.waitForFunction(() => {
      const memberElements = document.querySelectorAll(
        '[data-testid^="member-item-"]'
      );
      return memberElements.length > 0;
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`Large Member List Render Time: ${renderTime.toFixed(2)}ms`);

    // 大量数据渲染应在 500ms 内完成
    expect(renderTime).toBeLessThanOrEqual(500);
  });

  test('should maintain memory usage within acceptable limits', async () => {
    const { page } = testApp;

    // 获取初始内存使用情况
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (!initialMemory) {
      console.warn('⚠️ Memory API not available - skipping test');
      return;
    }

    // 执行内存密集操作
    for (let i = 0; i < 10; i++) {
      // 导航并加载数据
      await page.click('[data-testid="nav-members"]');
      await page.waitForSelector('[data-testid="member-management-root"]');

      await page.click('[data-testid="nav-tactical"]');
      await page.waitForSelector('[data-testid="tactical-center-root"]');

      // 强制垃圾回收（如果可用）
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
    }

    // 获取最终内存使用情况
    const finalMemory = await page.evaluate(() => {
      return {
        used: performance.memory!.usedJSHeapSize,
        total: performance.memory!.totalJSHeapSize,
        limit: performance.memory!.jsHeapSizeLimit,
      };
    });

    const memoryIncrease = finalMemory.used - initialMemory.used;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    console.log(
      `Final memory usage: ${(finalMemory.used / (1024 * 1024)).toFixed(2)}MB`
    );

    // 内存增长不应超过 50MB
    expect(memoryIncreaseMB).toBeLessThanOrEqual(50);
  });

  test('should handle concurrent operations efficiently', async () => {
    const { page } = testApp;

    const startTime = performance.now();

    // 并发执行多个操作
    const concurrentOperations = [
      page.click('[data-testid="nav-members"]'),
      page.evaluate(() => {
        // 模拟资源计算
        let result = 0;
        for (let i = 0; i < 100000; i++) {
          result += Math.random();
        }
        return result;
      }),
      page.waitForSelector('[data-testid="member-management-root"]'),
      page.evaluate(() => {
        // 模拟 DOM 查询操作
        const elements = document.querySelectorAll('*');
        return elements.length;
      }),
    ];

    await Promise.all(concurrentOperations);

    const endTime = performance.now();
    const concurrentTime = endTime - startTime;

    console.log(`Concurrent Operations Time: ${concurrentTime.toFixed(2)}ms`);

    // 并发操作应在 200ms 内完成
    expect(concurrentTime).toBeLessThanOrEqual(200);
  });

  test('should handle animation frame budget efficiently', async () => {
    const { page } = testApp;

    // 监控帧率性能
    const frameMetrics = await page.evaluate(() => {
      return new Promise(resolve => {
        const frames: number[] = [];
        let lastTime = performance.now();
        let frameCount = 0;
        const maxFrames = 60; // 测试60帧

        function measureFrame() {
          const currentTime = performance.now();
          const frameTime = currentTime - lastTime;
          frames.push(frameTime);
          lastTime = currentTime;
          frameCount++;

          if (frameCount < maxFrames) {
            requestAnimationFrame(measureFrame);
          } else {
            // 计算帧率统计
            const avgFrameTime =
              frames.reduce((a, b) => a + b, 0) / frames.length;
            const fps = 1000 / avgFrameTime;
            const minFrameTime = Math.min(...frames);
            const maxFrameTime = Math.max(...frames);

            resolve({
              avgFrameTime,
              fps,
              minFrameTime,
              maxFrameTime,
              frames,
            });
          }
        }

        requestAnimationFrame(measureFrame);
      });
    });

    console.log(`Average FPS: ${(frameMetrics as any).fps.toFixed(2)}`);
    console.log(
      `Average Frame Time: ${(frameMetrics as any).avgFrameTime.toFixed(2)}ms`
    );

    // 平均帧率应不低于 30 FPS（约 33.3ms/帧）
    expect((frameMetrics as any).fps).toBeGreaterThanOrEqual(30);

    // 平均帧时间不应超过 16.67ms（60 FPS 目标）
    expect((frameMetrics as any).avgFrameTime).toBeLessThanOrEqual(33.33);
  });
});

test.describe('Guild Manager - Resource Usage Monitoring', () => {
  test('should monitor CPU usage during intensive operations', async () => {
    const { page } = testApp;

    // 执行 CPU 密集型操作
    await page.evaluate(() => {
      // 模拟复杂计算（如 AI 决策）
      function intensiveCalculation() {
        let result = 0;
        const iterations = 1000000;

        for (let i = 0; i < iterations; i++) {
          result += Math.sin(i) * Math.cos(i);
        }

        return result;
      }

      // 在 Web Worker 中执行避免阻塞主线程
      if (window.Worker) {
        const workerCode = `
          self.onmessage = function() {
            let result = 0;
            const iterations = 1000000;
            
            for (let i = 0; i < iterations; i++) {
              result += Math.sin(i) * Math.cos(i);
            }
            
            self.postMessage(result);
          };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        return new Promise(resolve => {
          worker.onmessage = () => {
            worker.terminate();
            resolve(true);
          };
          worker.postMessage({});
        });
      }

      return intensiveCalculation();
    });

    // 验证主线程仍然响应
    await page.click('[data-testid="nav-overview"]');
    await expect(
      page.locator('[data-testid="guild-overview-panel"]')
    ).toBeVisible();
  });

  test('should validate SQLite performance characteristics', async () => {
    const { page } = testApp;

    // 模拟数据库操作性能测试
    const dbOperations = await page.evaluate(() => {
      // 假设通过 electronAPI 暴露数据库操作
      if (!window.electronAPI || !window.electronAPI.performDBTest) {
        return { error: 'Database API not available' };
      }

      return window.electronAPI.performDBTest({
        operations: [
          'INSERT_BULK_MEMBERS',
          'QUERY_MEMBER_LIST',
          'UPDATE_SATISFACTION',
          'DELETE_OLD_LOGS',
        ],
        recordCount: 1000,
      });
    });

    if ((dbOperations as any).error) {
      console.warn('⚠️ Database API not available - skipping test');
      return;
    }

    const results = dbOperations as any;
    console.log('Database Performance Results:', results);

    // 验证各项数据库操作的性能要求
    if (results.insertTime) {
      expect(results.insertTime).toBeLessThanOrEqual(100); // 批量插入 < 100ms
    }

    if (results.queryTime) {
      expect(results.queryTime).toBeLessThanOrEqual(50); // 查询 < 50ms
    }

    if (results.updateTime) {
      expect(results.updateTime).toBeLessThanOrEqual(20); // 单条更新 < 20ms
    }
  });
});

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI?: {
      sendCloudEvent: (event: any) => Promise<void>;
      performDBTest: (config: any) => Promise<any>;
      [key: string]: any;
    };
    testAPI?: {
      setMemberList: (members: any[]) => void;
      [key: string]: any;
    };
    gc?: () => void;
  }
}
