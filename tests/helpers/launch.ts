// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve } from 'node:path';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * 启动Electron应用程序 - 统一化测试启动函数
 * 符合cifix1.txt要求，使用构建产物而非源文件
 */
export async function launchApp(): Promise<ElectronApplication> {
  const main = resolve(process.cwd(), 'dist-electron', 'main.js'); // 确保先构建
  return electron.launch({
    args: [main],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
    },
  });
}

export async function launchAppWithPage(
  electronOverride?,
  entry?
): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const main = entry || resolve(process.cwd(), 'dist-electron', 'main.js'); // 构建后入口
  const app = await (electronOverride || electron).launch({
    args: [main],
    env: { CI: 'true', SECURITY_TEST_MODE: 'true' },
    cwd: process.cwd(),
    timeout: 45000,
  });
  const page = await app.firstWindow();

  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  if (page.url().startsWith('chrome-error://')) {
    await page
      .reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    const fallback = pathToFileURL(
      path.join(process.cwd(), 'dist', 'index.html')
    ).toString();
    await page
      .goto(fallback, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    throw new Error('Initial load failed (chrome-error://)');
  }
  return { app, page };
}
