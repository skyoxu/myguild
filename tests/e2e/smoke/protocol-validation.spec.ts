/**
 * Protocol Validation Test Suite - Acceptance Script
 *
 * Identifies "protocol/path correctness" and "no fallback to chrome-error://" at first opportunity
 * Can be run independently as an acceptance script if needed.
 */

import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test.describe('Protocol Validation Test Suite', () => {
  test('URL Protocol Self-Check Assertion - Acceptance Script', async () => {
    console.log('[INFO] Starting protocol validation test...');

    const { app: electronApp, page } = await launchApp();

    // Acceptance level: protocol/path self-check (avoid chrome-error:// issues)
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();

    console.log(`[INFO] Current URL: ${url}`);

    // Assertion 1: URL must be app:// protocol
    expect(url.startsWith('app://')).toBeTruthy();

    // Assertion 2: Must not be chrome-error://
    expect(url.startsWith('chrome-error://')).toBeFalsy();

    // Assertion 3: URL should contain expected file extension (tolerating trailing /)
    expect(url).toMatch(/(\.(html|js))(\/)?$/);

    console.log('[SUCCESS] All protocol validation assertions passed');
    console.log(`   - URL protocol correct: ${url.split('://')[0]}://`);
    console.log(`   - Not chrome-error: ${!url.startsWith('chrome-error://')}`);
    console.log(`   - Extension match: ${/(\.(html|js))(\/)?$/.test(url)}`);

    await electronApp.close();
  });

  test('Protocol Validation - Application Protocol Consistency', async () => {
    console.log('[INFO] Verifying application protocol consistency...');

    // First launch
    const { app: electronApp1, page: page1 } = await launchApp();
    await page1.waitForLoadState('domcontentloaded');
    const url1 = page1.url();
    await electronApp1.close();

    // Second launch
    const { app: electronApp2, page: page2 } = await launchApp();
    await page2.waitForLoadState('domcontentloaded');
    const url2 = page2.url();

    // Consistency: compare only protocol part
    expect(url1.split('://')[0]).toBe(url2.split('://')[0]);

    // Must not be chrome-error://
    expect(url1.startsWith('chrome-error://')).toBeFalsy();
    expect(url2.startsWith('chrome-error://')).toBeFalsy();

    console.log(`[SUCCESS] Protocol consistency validation passed:`);
    console.log(`   - First: ${url1}`);
    console.log(`   - Second: ${url2}`);

    await electronApp2.close();
  });
});
