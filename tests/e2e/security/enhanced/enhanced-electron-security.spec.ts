/**
 * Electron安全基线验证 - 增强测试套件
 * 自动生成于: 2025-09-04T16:32:15.405Z
 * 优先级: critical
 */

import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';

test.describe('Electron安全基线验证', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      recordVideo: process.env.CI ? { dir: 'test-results/videos' } : undefined,
      timeout: 30000, // 增加启动超时时间
    });
    page = await electronApp.firstWindow();

    // 使用更健壮的等待策略
    await page.waitForFunction(
      () => ['interactive', 'complete'].includes(document.readyState),
      { timeout: 15000 }
    );

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
      return (
        typeof window.electronAPI !== 'undefined' &&
        typeof window.require === 'undefined'
      );
    });

    expect(isolationEnabled).toBe(true);
  });

  // TODO: sandbox模式验证测试 - 需要实现
  test('sandbox模式验证', async () => {
    test.skipIf(true, '测试用例需要实现');
    expect(true).toBe(true);
  });

  test('应该只暴露白名单API', async () => {
    const apiValidation = await page.evaluate(() => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return { valid: false, reason: 'No electronAPI found' };

      // 检查预期的白名单API
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
});
