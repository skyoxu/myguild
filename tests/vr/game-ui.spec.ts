/**
 * 游戏内UI组件视觉回归测试
 * 测试游戏运行时的关键界面元素
 */

import { test, expect } from '@playwright/test';

test.describe('Game UI Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // 统一的截图前置设置
    await page.addInitScript(() => {
      // 禁用动画
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
        /* 隐藏可能的光标闪烁 */
        input, textarea { caret-color: transparent !important; }
      `;
      document.head.appendChild(style);
    });

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('game HUD overlay visual stability', async ({ page }) => {
    await page.goto('app://-');
    await page.waitForSelector('[data-testid="lobby-root"]');

    // 启动游戏会话（假设有快速开始按钮）
    const quickStartButton = page.getByTestId('quick-start-button');
    if (await quickStartButton.isVisible()) {
      await quickStartButton.click();

      // 等待游戏HUD加载
      await page.waitForSelector('[data-testid="game-hud"]', {
        timeout: 10000,
      });
      await page.waitForTimeout(2000);

      // 截图游戏HUD
      await expect(page).toHaveScreenshot('game-hud-overlay.png', {
        animations: 'disabled',
        caret: 'hide',
        mask: [
          page.getByTestId('game-timer').catch(() => null),
          page.getByTestId('fps-counter').catch(() => null),
          page.getByTestId('score-counter').catch(() => null),
        ].filter(Boolean),
      });
    }
  });

  test('pause menu visual consistency', async ({ page }) => {
    await page.goto('app://-');
    await page.waitForSelector('[data-testid="lobby-root"]');
    await page.waitForTimeout(2000);

    // 启动游戏然后暂停
    const quickStartButton = page.getByTestId('quick-start-button');
    if (await quickStartButton.isVisible()) {
      await quickStartButton.click();
      await page.waitForTimeout(3000);

      // 触发暂停（ESC键或点击暂停按钮）
      await page.keyboard.press('Escape');

      // 等待暂停菜单出现
      await page.waitForSelector('[data-testid="pause-menu"]', {
        timeout: 5000,
      });

      await expect(page).toHaveScreenshot('pause-menu.png', {
        animations: 'disabled',
        caret: 'hide',
      });
    }
  });

  test('inventory and toolbar visual regression', async ({ page }) => {
    await page.goto('app://-');
    await page.waitForSelector('[data-testid="lobby-root"]');
    await page.waitForTimeout(2000);

    const quickStartButton = page.getByTestId('quick-start-button');
    if (await quickStartButton.isVisible()) {
      await quickStartButton.click();
      await page.waitForTimeout(3000);

      // 打开背包/工具栏界面
      await page.keyboard.press('I'); // 假设I键打开背包

      await page.waitForSelector('[data-testid="inventory-panel"]', {
        timeout: 5000,
      });

      await expect(page).toHaveScreenshot('inventory-panel.png', {
        animations: 'disabled',
        caret: 'hide',
        mask: [
          page.getByTestId('item-tooltip').catch(() => null), // 动态提示
        ].filter(Boolean),
      });
    }
  });

  test('dialog and notification visual stability', async ({ page }) => {
    await page.goto('app://-');
    await page.waitForSelector('[data-testid="lobby-root"]');
    await page.waitForTimeout(2000);

    // 触发一个对话框（比如帮助或确认框）
    const helpButton = page.getByTestId('help-button');
    if (await helpButton.isVisible()) {
      await helpButton.click();

      await page.waitForSelector('[data-testid="help-dialog"]', {
        timeout: 5000,
      });

      await expect(page).toHaveScreenshot('help-dialog.png', {
        animations: 'disabled',
        caret: 'hide',
      });

      // 关闭对话框
      await page.getByTestId('dialog-close').click();
      await page.waitForTimeout(500);
    }

    // 测试通知栏（如果有）
    const notificationArea = page.getByTestId('notifications');
    if (await notificationArea.isVisible()) {
      await expect(page).toHaveScreenshot('notifications-area.png', {
        animations: 'disabled',
        caret: 'hide',
        clip: await notificationArea.boundingBox(), // 只截图通知区域
      });
    }
  });

  test('loading states visual consistency', async ({ page }) => {
    await page.goto('app://-');

    // 捕获加载状态（如果能稳定重现）
    const loadingIndicator = page.getByTestId('loading-indicator');
    if (await loadingIndicator.isVisible()) {
      await expect(page).toHaveScreenshot('loading-state.png', {
        animations: 'disabled',
        caret: 'hide',
        mask: [
          page.getByTestId('loading-spinner').catch(() => null), // 旋转动画
        ].filter(Boolean),
      });
    }
  });

  test('error states visual regression', async ({ page }) => {
    // 模拟错误状态（网络错误、加载失败等）
    await page.route('**/api/**', route => route.abort()); // 模拟API错误

    await page.goto('app://-');
    await page.waitForTimeout(3000);

    // 检查是否显示错误界面
    const errorMessage = page.getByTestId('error-message');
    if (await errorMessage.isVisible()) {
      await expect(page).toHaveScreenshot('error-state.png', {
        animations: 'disabled',
        caret: 'hide',
      });
    }
  });
});
