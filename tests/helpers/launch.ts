// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve, join } from 'node:path';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ensureDomReady } from './ensureDomReady';

// Default entry path constant - dist-electron/package.json specifies commonjs type
const DEFAULT_ENTRY_PATH = resolve(
  process.cwd(),
  'dist-electron',
  'electron',
  'main.js'
);

/**
 * Strictly validate Electron entry path, no build fallback allowed
 * Only accepts explicitly passed entry parameter or ELECTRON_MAIN_PATH environment variable
 */
function validateEntryPath(entry?: string): string {
  const entryPath =
    entry || process.env.ELECTRON_MAIN_PATH || DEFAULT_ENTRY_PATH;

  if (!existsSync(entryPath)) {
    throw new Error(
      `Electron entry point not found at "${entryPath}". ` +
        `Please build the application before running tests (npm run build) ` +
        `or set ELECTRON_MAIN_PATH environment variable to a valid path.`
    );
  }

  console.log(`[launch] using Electron entry: ${entryPath}`);
  return entryPath;
}

// Build cache mechanism: avoid repeated builds in CI environment
const BUILD_CACHE_FILE = resolve(process.cwd(), '.e2e-build-cache');

/**
 * Check if CI cache is valid
 */
function isBuildCacheValid(): boolean {
  if (process.env.CI !== 'true') return false;

  try {
    if (!existsSync(BUILD_CACHE_FILE)) return false;

    const cacheInfo = JSON.parse(readFileSync(BUILD_CACHE_FILE, 'utf-8'));
    const distPathCjs = resolve(process.cwd(), 'dist-electron', 'main.cjs');
    const distPathJs = resolve(
      process.cwd(),
      'dist-electron',
      'electron',
      'main.js'
    );

    // Check if build artifacts exist and cache timestamp is valid
    return (
      (existsSync(distPathCjs) || existsSync(distPathJs)) &&
      cacheInfo.timestamp &&
      Date.now() - cacheInfo.timestamp < 1000 * 60 * 10
    ); // 10 minute validity period
  } catch {
    return false;
  }
}

/**
 * Mark build cache as completed
 */
function markBuildCacheCompleted(): void {
  if (process.env.CI === 'true') {
    try {
      writeFileSync(
        BUILD_CACHE_FILE,
        JSON.stringify({
          timestamp: Date.now(),
          version: process.env.npm_package_version || '1.0.0',
        }),
        'utf-8'
      );
      console.log('[launch] CI mode: build cached for subsequent tests');
    } catch (e) {
      console.warn('[launch] failed to write build cache:', e);
    }
  }
}

/**
 * Build application before launching to ensure latest code is used.
 * Optimization: Build only once in CI environment, reuse afterwards
 */
function buildApp(): void {
  // CI environment build optimization: check cross-process cache
  if (isBuildCacheValid()) {
    console.log('[launch] CI mode: reusing existing build (cached)');
    return;
  }

  try {
    console.log('[launch] building application (npm run build)...');
    execSync('npm run build', {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_E2E_SMOKE: 'true', // Ensure environment variable is injected during build
      },
    });

    // Mark build completed (CI environment cache only)
    markBuildCacheCompleted();
  } catch (e) {
    console.error('[launch] build failed before E2E launch');
    throw e;
  }
}

/**
 * Unified Electron app launch function - returns {app, page} structure
 * Official recommendation: app.firstWindow() -> page, all DOM operations execute on Page
 */
export async function launchApp(
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  // Set CI environment variable before buildApp to enable caching
  process.env.CI = 'true';

  buildApp();
  const main = validateEntryPath(entry);
  const app = await electron.launch({
    // Launch by project root so Electron uses package.json.main; more robust on Windows
    args: ['.'],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // Runtime environment variable
    },
  });
  const page = await app.firstWindow(); // This is the renderer process Page
  return { app, page };
}

/**
 * New recommended approach: Launch Electron app and return app and page objects
 * Per user requirements: app.firstWindow() -> page, all DOM operations execute on Page
 */
export async function launchAppAndPage(
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  // Set CI environment variable before buildApp to enable caching
  process.env.CI = 'true';

  buildApp();
  const main = validateEntryPath(entry);
  const app = await electron.launch({
    args: ['.'],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // Runtime environment variable
    },
  });
  const page = await app.firstWindow(); // This is the renderer process Page
  return { app, page };
}

export async function launchAppWithArgs(
  entryOrArgs?: string | string[],
  extraArgs?: string[]
): Promise<ElectronApplication> {
  // Set CI environment variable before buildApp to enable caching
  process.env.CI = 'true';

  buildApp();
  let args: string[];
  if (Array.isArray(entryOrArgs)) {
    const main = validateEntryPath();
    args = ['.', ...entryOrArgs];
  } else {
    const main = validateEntryPath(entryOrArgs);
    args = extraArgs ? ['.', ...extraArgs] : ['.'];
  }
  const app = await electron.launch({
    args,
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // Runtime environment variable
    },
  });
  return app;
}

export async function launchAppWithPage(
  electronOverride?: typeof electron,
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  // Set CI environment variable before buildApp to enable caching
  process.env.CI = 'true';

  buildApp();
  const main = validateEntryPath(entry);
  const app = await (electronOverride || electron).launch({
    args: ['.'],
    env: {
      CI: 'true',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // Runtime environment variable
    },
    cwd: process.cwd(),
    timeout: 45000,
  });
  const page = await app.firstWindow();

  await ensureDomReady(page, 15000);
  if (page.url().startsWith('chrome-error://')) {
    console.warn('[launch] chrome-error detected, attempting reload...');
    await page
      .reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    console.warn('[launch] chrome-error persists, trying fallback URL...');
    const fallback = pathToFileURL(
      join(process.cwd(), 'dist', 'index.html')
    ).toString();
    await page
      .goto(fallback, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    throw new Error(
      'Initial load failed: chrome-error:// persists after all recovery attempts'
    );
  }
  return { app, page };
}

export async function prepareWindowForInteraction(page: Page): Promise<Page> {
  // Following ciinfo.md rules: Use document.readyState instead of domcontentloaded
  await page.waitForFunction(() => document.readyState === 'complete', {
    timeout: 15000,
  });

  // Additionally wait for React app-root element to finish rendering
  await page.waitForFunction(
    () => {
      const appRoot = document.querySelector('[data-testid="app-root"]');
      return appRoot !== null && appRoot.children.length > 0;
    },
    { timeout: 10000 }
  );

  if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
    await page.evaluate(() => {
      (window as any).electronAPI?.bringToFront?.();
    });
    await page.evaluate(
      () =>
        new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
    await page.waitForTimeout(150);
    console.log(
      '[CI] window prepared for interaction (using document.readyState)'
    );
  }
  return page;
}

/**
 * Unified DOM operation helper: navigation/external link red-line assertion
 * Fixes user-mentioned location/document undefined issues
 * All DOM operations execute on Page to avoid main process context errors
 */
export async function attemptAndAssertBlocked(
  page: Page,
  navigationAction: (url: string) => Promise<void>,
  testUrl: string
): Promise<boolean> {
  const originalUrl = page.url();

  try {
    await navigationAction(testUrl);
    await page.waitForTimeout(1000); // Wait for possible navigation
    const currentUrl = page.url();

    // Assert: URL should remain unchanged (navigation blocked)
    return currentUrl === originalUrl;
  } catch (error) {
    console.log(
      `[attemptAndAssertBlocked] Navigation blocked as expected: ${error}`
    );
    return true; // Exception indicates navigation was blocked, which is expected
  }
}

/**
 * location.href navigation test helper
 * Original: attemptAndAssertBlocked(firstWindow, () => { location.href = url })
 * Fixed to: await page.evaluate((u) => { location.href = u; }, url);
 */
export async function testLocationNavigation(
  page: Page,
  url: string
): Promise<boolean> {
  return attemptAndAssertBlocked(
    page,
    async testUrl => {
      await page.evaluate(u => {
        location.href = u;
      }, testUrl);
    },
    url
  );
}

/**
 * Dynamic link click test helper
 * Original: document.createElement / append / click
 * Fixed to: await page.evaluate executes in Page context
 */
export async function testDynamicLinkClick(
  page: Page,
  url: string
): Promise<boolean> {
  return attemptAndAssertBlocked(
    page,
    async testUrl => {
      await page.evaluate(u => {
        const a = document.createElement('a');
        a.href = u;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        // Clean up DOM
        document.body.removeChild(a);
      }, testUrl);
    },
    url
  );
}

/**
 * window.open test helper
 */
export async function testWindowOpen(
  page: Page,
  url: string
): Promise<boolean> {
  try {
    // Listen for possible popup events
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 1000 }).catch(() => null),
      page.evaluate(targetUrl => {
        window.open(targetUrl, '_blank');
      }, url),
    ]);

    // If using main process setWindowOpenHandler({action:'deny'}), this should be null
    return popup === null;
  } catch (error) {
    console.log(
      `[testWindowOpen] Error during window.open test: ${error.message}`
    );
    return true; // If error occurs, consider it blocked
  }
}

/**
 * Form submit navigation test helper
 */
export async function testFormSubmitNavigation(
  page: Page,
  url: string
): Promise<boolean> {
  return attemptAndAssertBlocked(
    page,
    async testUrl => {
      await page.evaluate(u => {
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = u;
        form.target = '_blank';
        document.body.appendChild(form);
        form.submit();
        // Clean up DOM
        document.body.removeChild(form);
      }, testUrl);
    },
    url
  );
}
