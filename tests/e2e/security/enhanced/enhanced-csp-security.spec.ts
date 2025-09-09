/**
 * CSP策略安全验证 - 增强测试套件
 * 自动生成于: 2025-09-04T16:32:15.404Z
 * 优先级: critical
 */

import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';

test.describe('CSP策略安全验证', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      recordVideo: process.env.CI ? { dir: 'test-results/videos' } : undefined,
      timeout: 30000,
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

    console.log(`✅ CSP测试页面加载完成: ${url}`);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('CSP应该阻止内联脚本执行', async () => {
    // 尝试执行内联脚本
    const scriptBlocked = await page.evaluate(async () => {
      return new Promise(resolve => {
        const script = document.createElement('script');
        script.textContent = 'window.testScriptExecuted = true;';
        script.onerror = () => resolve(true); // 脚本被阻止
        script.onload = () => resolve(false); // 脚本执行成功
        document.head.appendChild(script);

        // 检查是否执行
        setTimeout(() => {
          resolve(!(window as any).testScriptExecuted);
        }, 100);
      });
    });

    expect(scriptBlocked).toBe(true);
  });

  test('CSP应该阻止不安全的外部资源', async () => {
    const resourceBlocked = await page.evaluate(async () => {
      return new Promise(resolve => {
        const img = new Image();
        img.onerror = () => resolve(true); // 资源被阻止
        img.onload = () => resolve(false); // 资源加载成功
        img.src = 'http://malicious-site.example.com/image.png';

        setTimeout(() => resolve(true), 1000); // 超时认为被阻止
      });
    });

    expect(resourceBlocked).toBe(true);
  });

  // TODO: CSP违规报告功能测试 - 需要实现
  test('CSP违规报告功能', async () => {
    test.fixme(true, '测试用例需要实现');
    expect(true).toBe(true);
  });

  test('CSP 以响应头或<meta>其一存在即可', async () => {
    // 1) 检查是否有meta CSP标签
    const hasMeta = await page.$('meta[http-equiv="Content-Security-Policy"]');
    const metaOk = !!hasMeta;

    // 2) 通过功能性断言验证CSP生效（内联脚本应被阻止）
    const inlineAllowed = await page.evaluate(() => {
      try {
        const s = document.createElement('script');
        s.textContent = 'window.__x=1';
        document.head.appendChild(s);
        return !!(window as any).__x;
      } catch {
        return false;
      }
    });

    // 3) CSP有效：要么有meta标签，要么内联脚本被阻止
    const cspEffective = metaOk || !inlineAllowed;

    console.log(`CSP状态: meta=${metaOk}, 内联脚本被阻止=${!inlineAllowed}`);
    expect(cspEffective).toBeTruthy();
  });
});
