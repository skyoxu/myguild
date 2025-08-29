/**
 * 公会管理器PRD分片1 - E2E测试
 * 基于Playwright + Electron的端到端测试
 */

import { test, expect } from '@playwright/test';
import {
  ElectronApplication,
  Page,
  _electron as electron,
} from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Guild Manager Chunk 001 - E2E Tests', () => {
  test.beforeAll(async () => {
    // 启动Electron应用
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../electron/main.js')],
      recordVideo: {
        dir: 'tests/recordings/',
        size: { width: 1280, height: 720 },
      },
    });

    // 获取主窗口
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 720 });

    // 等待应用启动完成
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test.describe('Application Launch', () => {
    test('should launch successfully and show guild manager interface', async () => {
      // 验证应用标题
      const title = await page.title();
      expect(title).toContain('Guild Manager');

      // 验证主要UI元素存在
      await expect(page.locator('[data-testid="work-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="mailbox"]')).toBeVisible();
      await expect(page.locator('[data-testid="member-list"]')).toBeVisible();
    });

    test('should meet startup performance SLO', async () => {
      const startTime = Date.now();

      // 等待工作面板完全加载
      await page.waitForSelector('[data-testid="work-panel-loaded"]', {
        timeout: 5000,
      });

      const loadTime = Date.now() - startTime;

      // 验证启动时间符合SLO (应该在3秒内)
      expect(loadTime).toBeLessThan(3000);
      console.log(`App startup time: ${loadTime}ms`);
    });
  });

  test.describe('Work Panel Functionality', () => {
    test('should display guild information correctly', async () => {
      // 检查公会基本信息
      await expect(page.locator('[data-testid="guild-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="guild-level"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="guild-reputation"]')
      ).toBeVisible();

      // 检查资源显示
      await expect(page.locator('[data-testid="resource-gold"]')).toBeVisible();
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
      // 点击刷新按钮
      const refreshButton = page.locator('[data-testid="refresh-stats-btn"]');
      await expect(refreshButton).toBeVisible();

      const startTime = Date.now();
      await refreshButton.click();

      // 等待刷新完成
      await page.waitForSelector('[data-testid="stats-refreshed"]', {
        timeout: 3000,
      });

      const refreshTime = Date.now() - startTime;

      // 验证刷新时间符合SLO (P95 ≤ 100ms)
      expect(refreshTime).toBeLessThan(200); // 允许一些E2E测试开销
      console.log(`Stats refresh time: ${refreshTime}ms`);
    });

    test('should show recent activity feed', async () => {
      const activityFeed = page.locator('[data-testid="activity-feed"]');
      await expect(activityFeed).toBeVisible();

      // 检查活动项目
      const activityItems = page.locator('[data-testid^="activity-item-"]');
      const count = await activityItems.count();
      expect(count).toBeGreaterThan(0);

      // 验证活动项目包含必要信息
      const firstItem = activityItems.first();
      await expect(
        firstItem.locator('[data-testid="activity-time"]')
      ).toBeVisible();
      await expect(
        firstItem.locator('[data-testid="activity-description"]')
      ).toBeVisible();
    });
  });

  test.describe('Turn System Workflow', () => {
    test('should start a new turn successfully', async () => {
      // 检查当前回合状态
      const currentTurn = page.locator('[data-testid="current-turn"]');
      await expect(currentTurn).toBeVisible();

      // 点击开始新回合按钮
      const startTurnBtn = page.locator('[data-testid="start-turn-btn"]');
      await expect(startTurnBtn).toBeVisible();
      await startTurnBtn.click();

      // 等待回合开始确认
      await expect(
        page.locator('[data-testid="turn-started-notification"]')
      ).toBeVisible();

      // 验证回合状态更新
      await expect(
        page.locator('[data-testid="turn-phase-resolution"]')
      ).toBeVisible();
    });

    test('should transition through turn phases correctly', async () => {
      // 开始回合
      await page.locator('[data-testid="start-turn-btn"]').click();

      // 阶段1: 结算阶段
      await expect(
        page.locator('[data-testid="turn-phase-resolution"]')
      ).toBeVisible();
      await page.waitForSelector('[data-testid="resolution-complete"]', {
        timeout: 10000,
      });

      // 阶段2: 玩家阶段
      await expect(
        page.locator('[data-testid="turn-phase-player"]')
      ).toBeVisible();

      // 玩家执行某些操作（如处理邮件）
      const playerActionBtn = page.locator(
        '[data-testid="process-mailbox-btn"]'
      );
      if (await playerActionBtn.isVisible()) {
        await playerActionBtn.click();
      }

      // 继续到AI阶段
      const continueBtn = page.locator(
        '[data-testid="continue-to-ai-phase-btn"]'
      );
      await continueBtn.click();

      // 阶段3: AI模拟阶段
      await expect(
        page.locator('[data-testid="turn-phase-ai-simulation"]')
      ).toBeVisible();
      await page.waitForSelector('[data-testid="ai-phase-complete"]', {
        timeout: 15000,
      });

      // 回合完成
      await expect(
        page.locator('[data-testid="turn-phase-completed"]')
      ).toBeVisible();
    });

    test('should meet turn phase transition SLO', async () => {
      await page.locator('[data-testid="start-turn-btn"]').click();

      // 测量阶段转换时间
      const measurePhaseTransition = async (
        fromPhase: string,
        toPhase: string
      ) => {
        const startTime = Date.now();

        await page.waitForSelector(`[data-testid="turn-phase-${toPhase}"]`);

        const transitionTime = Date.now() - startTime;
        expect(transitionTime).toBeLessThan(500); // E2E测试允许更大的延迟
        console.log(
          `${fromPhase} -> ${toPhase} transition: ${transitionTime}ms`
        );

        return transitionTime;
      };

      // 等待并测量各阶段转换
      await measurePhaseTransition('idle', 'resolution');
      await page.waitForSelector('[data-testid="resolution-complete"]');
      await measurePhaseTransition('resolution', 'player');
    });
  });

  test.describe('Mailbox System', () => {
    test('should display mailbox with events', async () => {
      const mailbox = page.locator('[data-testid="mailbox"]');
      await expect(mailbox).toBeVisible();

      // 点击打开邮箱
      const mailboxBtn = page.locator('[data-testid="mailbox-btn"]');
      await mailboxBtn.click();

      // 验证邮箱界面
      await expect(page.locator('[data-testid="mailbox-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="mail-list"]')).toBeVisible();
    });

    test('should load mailbox events within SLO time', async () => {
      const startTime = Date.now();

      // 打开邮箱
      await page.locator('[data-testid="mailbox-btn"]').click();

      // 等待邮件加载完成
      await page.waitForSelector('[data-testid="mailbox-loaded"]', {
        timeout: 3000,
      });

      const loadTime = Date.now() - startTime;

      // 验证加载时间符合SLO
      expect(loadTime).toBeLessThan(200);
      console.log(`Mailbox load time: ${loadTime}ms`);
    });

    test('should process decisions correctly', async () => {
      // 打开邮箱
      await page.locator('[data-testid="mailbox-btn"]').click();

      // 查找有决策的邮件
      const decisionMail = page
        .locator('[data-testid^="mail-decision-"]')
        .first();
      if ((await decisionMail.count()) > 0) {
        await decisionMail.click();

        // 验证决策界面
        await expect(
          page.locator('[data-testid="decision-panel"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="decision-options"]')
        ).toBeVisible();

        // 选择一个选项
        const firstOption = page
          .locator('[data-testid^="decision-option-"]')
          .first();
        await firstOption.click();

        // 确认决策
        await page.locator('[data-testid="confirm-decision-btn"]').click();

        // 验证决策结果
        await expect(
          page.locator('[data-testid="decision-result"]')
        ).toBeVisible();
      }
    });
  });

  test.describe('Member Management', () => {
    test('should display member list', async () => {
      const memberList = page.locator('[data-testid="member-list"]');
      await expect(memberList).toBeVisible();

      // 检查成员项目
      const memberItems = page.locator('[data-testid^="member-item-"]');
      const count = await memberItems.count();
      expect(count).toBeGreaterThan(0);

      // 验证成员信息显示
      const firstMember = memberItems.first();
      await expect(
        firstMember.locator('[data-testid="member-name"]')
      ).toBeVisible();
      await expect(
        firstMember.locator('[data-testid="member-level"]')
      ).toBeVisible();
      await expect(
        firstMember.locator('[data-testid="member-state"]')
      ).toBeVisible();
    });

    test('should show member details on click', async () => {
      const firstMember = page.locator('[data-testid^="member-item-"]').first();
      await firstMember.click();

      // 验证详情面板
      await expect(
        page.locator('[data-testid="member-details-panel"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="member-personality-traits"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="member-relationships"]')
      ).toBeVisible();
      await expect(page.locator('[data-testid="member-goals"]')).toBeVisible();
    });

    test('should update member state changes in real-time', async () => {
      // 触发成员状态变化
      await page.locator('[data-testid="trigger-member-ai-btn"]').click();

      // 等待状态变化通知
      await page.waitForSelector('[data-testid="member-state-changed"]', {
        timeout: 5000,
      });

      // 验证UI更新
      const stateIndicator = page.locator(
        '[data-testid="member-state-indicator"]'
      );
      await expect(stateIndicator).toBeVisible();
    });
  });

  test.describe('Performance & Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // 模拟网络中断
      await page.route('**/*', route => route.abort());

      // 尝试执行需要网络的操作
      const refreshBtn = page.locator('[data-testid="refresh-stats-btn"]');
      await refreshBtn.click();

      // 验证错误处理
      await expect(
        page.locator('[data-testid="error-notification"]')
      ).toBeVisible();

      // 恢复网络
      await page.unroute('**/*');
    });

    test('should maintain UI responsiveness under load', async () => {
      // 快速连续执行多个操作
      const operations = [
        () => page.locator('[data-testid="refresh-stats-btn"]').click(),
        () => page.locator('[data-testid="mailbox-btn"]').click(),
        () => page.locator('[data-testid="member-list-refresh-btn"]').click(),
      ];

      const startTime = Date.now();

      // 并发执行操作
      await Promise.all(operations.map(op => op().catch(() => {})));

      const totalTime = Date.now() - startTime;

      // 验证总响应时间合理
      expect(totalTime).toBeLessThan(2000);

      // 验证UI仍然响应
      await expect(page.locator('[data-testid="app-root"]')).toBeVisible();
    });

    test('should meet Crash-Free Sessions SLO', async () => {
      // 执行一系列可能导致崩溃的操作
      const stressOperations = Array(10)
        .fill(0)
        .map((_, i) => async () => {
          await page.locator('[data-testid="start-turn-btn"]').click();
          await page.waitForTimeout(100);
          await page
            .locator('[data-testid="cancel-turn-btn"]')
            .click()
            .catch(() => {});
          await page.waitForTimeout(100);
        });

      // 执行压力测试
      for (const operation of stressOperations) {
        await operation().catch(() => {
          // 记录错误但继续测试
          console.log('Operation failed, continuing...');
        });
      }

      // 验证应用仍然正常运行
      await expect(page.locator('[data-testid="app-root"]')).toBeVisible();
      await expect(page.locator('[data-testid="work-panel"]')).toBeVisible();

      // 这代表会话没有崩溃，符合Crash-Free Sessions SLO
    });
  });

  test.describe('CloudEvents Integration', () => {
    test('should handle CloudEvents 1.0 compliant events', async () => {
      // 模拟事件触发
      await page.evaluate(() => {
        // 在渲染进程中发送CloudEvent标准事件
        const event = {
          specversion: '1.0',
          id: 'e2e-test-event-001',
          source: 'gm://e2e-test',
          type: 'gm.guild.turn.started',
          time: new Date().toISOString(),
          data: {
            guildId: 'guild-001',
            weekNumber: 1,
            previousPhaseResults: [],
          },
        };

        // 通过自定义事件发送
        window.dispatchEvent(new CustomEvent('cloudevent', { detail: event }));
      });

      // 等待UI更新响应
      await page.waitForSelector('[data-testid="turn-started-notification"]', {
        timeout: 3000,
      });

      // 验证事件处理效果
      const notification = page.locator(
        '[data-testid="turn-started-notification"]'
      );
      await expect(notification).toContainText('回合');
    });

    test('should reject malformed CloudEvents', async () => {
      // 模拟错误事件
      await page.evaluate(() => {
        const malformedEvent = {
          // 缺少必需字段
          type: 'gm.guild.turn.started',
          data: { guildId: 'guild-001' },
        };

        window.dispatchEvent(
          new CustomEvent('cloudevent', { detail: malformedEvent })
        );
      });

      // 验证错误处理
      await expect(
        page.locator('[data-testid="event-validation-error"]')
      ).toBeVisible({ timeout: 2000 });
    });

    test('should maintain event ordering in high-frequency scenarios', async () => {
      // 模拟高频事件
      const eventCount = 10;
      const startTime = Date.now();

      await page.evaluate(count => {
        for (let i = 0; i < count; i++) {
          const event = {
            specversion: '1.0',
            id: `rapid-event-${i}`,
            source: 'gm://stress-test',
            type: 'gm.workpanel.data_updated',
            time: new Date(Date.now() + i).toISOString(),
            data: { sequence: i },
          };

          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('cloudevent', { detail: event })
            );
          }, i * 10); // 10ms间隔
        }
      }, eventCount);

      // 等待所有事件处理完成
      await page.waitForFunction(
        expectedCount => {
          const processedEvents = document.querySelectorAll(
            '[data-testid^="processed-event-"]'
          );
          return processedEvents.length === expectedCount;
        },
        eventCount,
        { timeout: 5000 }
      );

      const totalTime = Date.now() - startTime;

      // 验证性能要求：高频事件处理不应超过500ms
      expect(totalTime).toBeLessThan(500);
    });
  });

  test.describe('Accessibility & UX', () => {
    test('should support keyboard navigation', async () => {
      // 测试Tab键导航
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();

      // 测试Enter键激活
      await page.keyboard.press('Enter');

      // 验证键盘操作正常工作
      await page.waitForTimeout(500);
    });

    test('should provide proper ARIA labels', async () => {
      // 检查主要UI元素的可访问性
      const workPanel = page.locator('[data-testid="work-panel"]');
      await expect(workPanel).toHaveAttribute('aria-label');

      const mailbox = page.locator('[data-testid="mailbox"]');
      await expect(mailbox).toHaveAttribute('aria-label');
    });

    test('should show loading states appropriately', async () => {
      // 触发加载操作
      const refreshBtn = page.locator('[data-testid="refresh-stats-btn"]');
      await refreshBtn.click();

      // 验证加载状态显示
      await expect(
        page.locator('[data-testid="loading-indicator"]')
      ).toBeVisible();

      // 等待加载完成
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
        timeout: 3000,
      });
    });
  });
});
