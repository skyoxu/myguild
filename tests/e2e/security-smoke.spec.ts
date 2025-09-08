import { test, expect } from '@playwright/test';
import { launchApp } from '../helpers/launch';

test('安全护栏生效（CSP & 禁用 Node）', async () => {
  // 使用统一启动器
  const { app, page: win } = await launchApp();

  // 渲染层不应暴露 Node 能力
  const hasRequire = await win.evaluate(
    () => typeof (window as any).require !== 'undefined'
  );
  expect(hasRequire).toBe(false);

  // 存在 CSP 元标签
  const csp = await win.evaluate(() =>
    document
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute('content')
  );
  expect(csp).toBeTruthy();

  await app.close();
});
