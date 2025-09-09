// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve } from 'node:path';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function launchApp(
  electron?,
  entry?
): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const main = entry || resolve(process.cwd(), 'dist-electron', 'main.js'); // 构建后入口
  const app = await electron.launch({
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
