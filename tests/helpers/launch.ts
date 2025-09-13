// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Build application before launching to ensure latest code is used.
 */
function buildApp() {
  try {
    console.log('[launch] building application (npm run build)...');
    execSync('npm run build', { stdio: 'inherit' });
  } catch (e) {
    console.error('[launch] build failed before E2E launch');
    throw e;
  }
}

export async function launchApp(entry?: string): Promise<ElectronApplication> {
  buildApp();
  const main = entry ?? resolve(process.cwd(), 'dist-electron', 'main.js');
  return electron.launch({
    args: [main],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
    },
  });
}

export async function launchAppWithArgs(
  entryOrArgs?: string | string[],
  extraArgs?: string[]
): Promise<ElectronApplication> {
  buildApp();
  let args: string[];
  if (Array.isArray(entryOrArgs)) {
    const main = resolve(process.cwd(), 'dist-electron', 'main.js');
    args = [main, ...entryOrArgs];
  } else {
    const main =
      entryOrArgs ?? resolve(process.cwd(), 'dist-electron', 'main.js');
    args = extraArgs ? [main, ...extraArgs] : [main];
  }
  return electron.launch({
    args,
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
    },
  });
}

export async function launchAppWithPage(
  electronOverride?: any,
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  buildApp();
  const main = entry || resolve(process.cwd(), 'dist-electron', 'main.js');
  const app = await (electronOverride || electron).launch({
    args: [main],
    env: { CI: 'true', SECURITY_TEST_MODE: 'true', E2E_AUTO_START: '1' },
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
      join(process.cwd(), 'dist', 'index.html')
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

export async function prepareWindowForInteraction(page: Page): Promise<Page> {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
    await page.evaluate(() => {
      (window as any).electronAPI?.bringToFront?.();
    });
    await page.evaluate(
      () =>
        new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
    await page.waitForTimeout(150);
    console.log('[CI] window prepared for interaction');
  }
  return page;
}
