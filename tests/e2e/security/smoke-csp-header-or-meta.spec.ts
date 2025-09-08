// tests/e2e/security/smoke-csp-header-or-meta.spec.ts
import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test('CSP 以响应头或<meta>其一存在即可', async () => {
  // 使用统一启动器（cifix1.txt要求）
  const { app, page } = await launchApp();

  // 1) readyState 守护 + 非 chrome-error
  await page.waitForFunction(
    () => ['interactive', 'complete'].includes(document.readyState),
    { timeout: 15000 }
  );
  expect(page.url().startsWith('chrome-error://')).toBeFalsy();

  // 2) dev/test: 允许 <meta> 作为满足条件之一
  const hasMeta = await page.$("meta[http-equiv='Content-Security-Policy']");
  const metaOk = !!hasMeta;

  // 3) 生产: 通过功能性断言验证 CSP 生效（内联脚本应被阻止）
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

  expect(metaOk || !inlineAllowed).toBeTruthy();

  await app.close();
});
