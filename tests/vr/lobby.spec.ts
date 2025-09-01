/**
 * 大厅/启动页视觉回归测试
 * 通过 Playwright Screenshot 对比检测 UI 视觉变化
 */

import { test, expect } from '@playwright/test';

test.describe('Lobby UI Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // 禁用动画和输入光标，确保截图稳定性
    await page.addInitScript(() => {
      // 禁用 CSS 动画和过渡
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    });

    // 设置固定窗口大小，确保截图一致性
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('lobby UI baseline screenshot', async ({ page }) => {
    // 导航到应用启动页
    await page.goto('app://-');

    // 等待关键元素加载完成
    await page.waitForSelector('[data-testid="lobby-root"]', {
      timeout: 10000,
    });

    // 等待游戏引擎初始化完成
    await page.waitForFunction(
      () => {
        return window.game && window.game.scene && window.game.scene.isActive();
      },
      { timeout: 15000 }
    );

    // 等待额外时间确保所有资源加载
    await page.waitForTimeout(2000);

    // 截图对比，禁用动画和光标
    await expect(page).toHaveScreenshot('lobby-baseline.png', {
      animations: 'disabled',
      caret: 'hide',
      // mask: [page.getByTestId('loading-spinner')] // 可能的动态区域
    });
  });

  test('main menu UI stability', async ({ page }) => {
    await page.goto('app://-');

    // 等待并点击进入主菜单
    await page.waitForSelector('[data-testid="lobby-root"]');
    await page.waitForTimeout(2000);

    // 点击进入主菜单（假设有这样的按钮）
    const startButton = page.getByTestId('start-game-button');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // 截图对比主菜单
    await expect(page).toHaveScreenshot('main-menu.png', {
      animations: 'disabled',
      caret: 'hide',
      mask: [
        page.getByTestId('time-ticker').catch(() => null), // 可能的时间显示
        page.getByTestId('player-stats').catch(() => null), // 可能的动态统计
      ].filter(Boolean),
    });
  });

  test('level selection screen visual consistency', async ({ page }) => {
    await page.goto('app://-');

    // 导航到关卡选择界面
    await page.waitForSelector('[data-testid="lobby-root"]');
    await page.waitForTimeout(2000);

    // 模拟导航到关卡选择（根据实际UI调整）
    const levelSelectButton = page.getByTestId('level-select-button');
    if (await levelSelectButton.isVisible()) {
      await levelSelectButton.click();
      await page.waitForTimeout(1500);

      // 等待关卡数据加载
      await page.waitForSelector('[data-testid="level-grid"]', {
        timeout: 8000,
      });

      // 截图对比关卡选择界面
      await expect(page).toHaveScreenshot('level-selection.png', {
        animations: 'disabled',
        caret: 'hide',
        mask: [
          page.getByTestId('progress-indicator').catch(() => null),
          page.getByTestId('score-display').catch(() => null),
        ].filter(Boolean),
      });
    }
  });

  test('game settings modal visual regression', async ({ page }) => {
    await page.goto('app://-');
    await page.waitForSelector('[data-testid="lobby-root"]');
    await page.waitForTimeout(2000);

    // 打开设置模态框（如果存在）
    const settingsButton = page.getByTestId('settings-button');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      // 等待设置模态框完全加载
      await page.waitForSelector('[data-testid="settings-modal"]', {
        timeout: 5000,
      });

      // 截图对比设置界面
      await expect(page).toHaveScreenshot('settings-modal.png', {
        animations: 'disabled',
        caret: 'hide',
      });

      // 关闭模态框，测试关闭后的状态
      await page.getByTestId('settings-close').click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('lobby-after-settings-close.png', {
        animations: 'disabled',
        caret: 'hide',
      });
    }
  });

  test('responsive layout visual consistency', async ({ page }) => {
    // 测试不同分辨率下的视觉一致性
    const viewports = [
      { width: 1920, height: 1080, name: '1080p' },
      { width: 1366, height: 768, name: '768p' },
      { width: 1024, height: 768, name: '1024x768' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('app://-');

      await page.waitForSelector('[data-testid="lobby-root"]');
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot(`lobby-${viewport.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: false, // 只截图视口区域
      });
    }
  });
});
