import { test, expect, _electron as electron } from '@playwright/test';

test('安全护栏生效（CSP & 禁用 Node）', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();

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
