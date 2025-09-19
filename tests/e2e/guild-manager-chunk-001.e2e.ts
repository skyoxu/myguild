/**
 * 鍏細绠＄悊鍣≒RD鍒嗙墖1 - E2E娴嬭瘯
 * 鍩轰簬Playwright + Electron鐨勭鍒扮娴嬭瘯
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp } from '../helpers/launch';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Guild Manager Chunk 001 - E2E Tests', () => {
  test.beforeAll(async () => {
    // 鍚姩Electron搴旂敤
    electronApp = await launchApp();

    // 鑾峰彇涓荤獥鍙?    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 720 });

    // 绛夊緟搴旂敤鍚姩瀹屾垚
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test.describe('Application Launch', () => {
    test('should launch successfully and show guild manager interface', async () => {
      // 楠岃瘉搴旂敤鏍囬
      const title = await page.title();
      expect(title).toContain('Guild Manager');

      // 楠岃瘉涓昏UI鍏冪礌瀛樺湪
      await expect(page.locator('[data-testid="work-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="mailbox"]')).toBeVisible();
      await expect(page.locator('[data-testid="member-list"]')).toBeVisible();
    });

    test('should meet startup performance SLO', async () => {
      const startTime = Date.now();

      // 绛夊緟宸ヤ綔闈㈡澘瀹屽叏鍔犺浇
      await page.waitForSelector('[data-testid="work-panel-loaded"]', {
        timeout: 5000,
      });

      const loadTime = Date.now() - startTime;

      // 楠岃瘉鍚姩鏃堕棿绗﹀悎SLO (搴旇鍦?绉掑唴)
      expect(loadTime).toBeLessThan(3000);
      console.log(`App startup time: ${loadTime}ms`);
    });
  });

  test.describe('Work Panel Functionality', () => {
    test('should display guild information correctly', async () => {
      // 妫€鏌ュ叕浼氬熀鏈俊鎭?      await expect(page.locator('[data-testid="guild-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="guild-level"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="guild-reputation"]')
      ).toBeVisible();

      // 妫€鏌ヨ祫婧愭樉绀?      await expect(page.locator('[data-testid="resource-gold"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="resource-reputation"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="resource-influence"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="resource-materials"]')
      ).toBeVisible();
    });

    test('should refresh guild stats within SLO time', async () => {
      // 鐐瑰嚮鍒锋柊鎸夐挳
      const refreshButton = page.locator('[data-testid="refresh-stats-btn"]');
      await expect(refreshButton).toBeVisible();

      const startTime = Date.now();
      await refreshButton.click();

      // 绛夊緟鍒锋柊瀹屾垚
      await page.waitForSelector('[data-testid="stats-refreshed"]', {
        timeout: 3000,
      });

      const refreshTime = Date.now() - startTime;

      // 楠岃瘉鍒锋柊鏃堕棿绗﹀悎SLO (P95 鈮?100ms)
      expect(refreshTime).toBeLessThan(200); // 鍏佽涓€浜汦2E娴嬭瘯寮€閿€
      console.log(`Stats refresh time: ${refreshTime}ms`);
    });

    test('should show recent activity feed', async () => {
      const activityFeed = page.locator('[data-testid="activity-feed"]');
      await expect(activityFeed).toBeVisible();

      // 妫€鏌ユ椿鍔ㄩ」鐩?      const activityItems = page.locator('[data-testid^="activity-item-"]');
      const count = await activityItems.count();
      expect(count).toBeGreaterThan(0);

      // 楠岃瘉娲诲姩椤圭洰鍖呭惈蹇呰淇℃伅
      const firstItem = activityItems.first();
      await expect(
        firstItem.locator('[data-testid="activity-time"]')
      ).toBeVisible();
      await expect(
        firstItem.locator('[data-testid="activity-description"]')
      ).toBeVisible();
    });
  });
});
