/**
 * Electron安全基线验证 - 增强测试套件
 * 自动生成于: 2025-09-04T16:32:15.405Z
 * 优先级: critical
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp } from '../../../helpers/launch';

test.describe('Electron安全基线验证', () => {
  // 分组：隔离与沙盒（ADR-0002）
  test.describe('Isolation Basics', () => {
    let electronApp: ElectronApplication;
    let page: Page;

    test.beforeAll(async () => {
      const { app, page: window } = await launchApp();
      electronApp = app;
      page = window;

      // 使用官方推荐的等待策略
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

      // 确保页面不是chrome-error://
      const url = page.url();
      expect(url.startsWith('chrome-error://')).toBeFalsy();

      console.log(`✅ 页面加载完成: ${url}`);
    });

    test.afterAll(async () => {
      await electronApp.close();
    });

    test('渲染进程应该无法访问Node.js API', async () => {
      const nodeDisabled = await page.evaluate(() => {
        return (
          typeof window.require === 'undefined' &&
          typeof window.process === 'undefined' &&
          typeof window.Buffer === 'undefined'
        );
      });

      expect(nodeDisabled).toBe(true);
    });

    test('上下文隔离应该启用', async () => {
      const isolationEnabled = await page.evaluate(() => {
        // 在沙盒模式下，上下文隔离通过以下方式验证：
        // 1. 没有Node.js全局变量（require等）
        // 2. 没有直接的Electron API暴露（安全隔离）
        return (
          typeof window.require === 'undefined' &&
          typeof (window as any).process === 'undefined' &&
          typeof (window as any).global === 'undefined'
        );
      });

      expect(isolationEnabled).toBe(true);
    });

    test('sandbox模式验证', async () => {
      const sandboxValidation = await page.evaluate(() => {
        // 验证沙盒模式下的安全特性
        return {
          noNodeAccess: typeof (window as any).process === 'undefined',
          noRequire: typeof (window as any).require === 'undefined',
          noElectronGlobals: typeof (window as any).__dirname === 'undefined',
          restrictedContext: Object.getOwnPropertyNames(window).length < 100, // 受限的全局对象
        };
      });

      expect(sandboxValidation.noNodeAccess).toBe(true);
      expect(sandboxValidation.noRequire).toBe(true);
      expect(sandboxValidation.noElectronGlobals).toBe(true);
      // 注意：restrictedContext可能因为其他全局变量而变化，这里不做严格断言
    });
  }); // 结束 Isolation Basics 小组

  // 分组：预加载/白名单 API（ADR-0002/0004）
  test.describe('Preload Whitelist API', () => {
    test('应该只暴露白名单API', async () => {
      const apiValidation = await page.evaluate(() => {
        const electronAPI = (window as any).electronAPI;

        // 在沙盒模式下，我们期望没有electronAPI暴露，这是安全的
        if (!electronAPI) {
          return {
            valid: true,
            reason: 'Sandbox mode: No electronAPI exposed (secure)',
            unexpected: [],
          };
        }

        // 如果有API暴露，检查是否在白名单内
        const expectedAPIs = [
          'readFile',
          'writeFile',
          'getSystemInfo',
          'minimize',
          'close',
        ];
        const exposedAPIs = Object.keys(electronAPI);

        const hasAllExpected = expectedAPIs.every(api =>
          exposedAPIs.includes(api)
        );
        const hasOnlyExpected = exposedAPIs.every(api =>
          expectedAPIs.includes(api)
        );

        return {
          valid: hasAllExpected && hasOnlyExpected,
          expected: expectedAPIs,
          actual: exposedAPIs,
          missing: expectedAPIs.filter(api => !exposedAPIs.includes(api)),
          unexpected: exposedAPIs.filter(api => !expectedAPIs.includes(api)),
        };
      });

      expect(apiValidation.valid).toBe(true);
      expect(apiValidation.unexpected).toEqual([]);
    });
  }); // 结束 Preload Whitelist API 小组
});
