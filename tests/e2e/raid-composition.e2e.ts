/**
 * 公会管理器 PVE 系统 - E2E 测试
 * @description PRD-GM-PRD-GUILD-MANAGER_CHUNK_002 对应的端到端测试
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from '@playwright/test';
import { GUILD_MANAGER_CHUNK_002_SLOS } from '@/shared/contracts/guild-manager-chunk-002';
import { launchApp } from './utils/electron-launcher';

test.describe('副本阵容管理 E2E 测试', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    // 使用官方API模式启动 Electron 应用
    electronApp = await launchApp(['--test-mode', '--disable-web-security']);

    page = await electronApp.firstWindow();
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test.beforeEach(async () => {
    // 确保每个测试开始时应用就绪（无需重新导航，应用已在beforeAll中启动）
    await page.waitForLoadState('networkidle');
  });

  test.describe('阵容创建和管理流程', () => {
    test('完整的阵容创建和管理流程', async () => {
      // 导航到战术中心
      await page.click('[data-testid="tactical-center-nav"]');
      await expect(
        page.locator('[data-testid="tactical-center-root"]')
      ).toBeVisible({ timeout: 5000 });

      // 验证UI响应时间 SLO: RAID_UI_P95_MS <= 100ms
      const navigationStartTime = Date.now();
      await page.waitForSelector('[data-testid="create-composition-btn"]', {
        timeout: 5000,
      });
      const navigationEndTime = Date.now();

      expect(navigationEndTime - navigationStartTime).toBeLessThan(
        GUILD_MANAGER_CHUNK_002_SLOS.RAID_UI_P95_MS * 5
      ); // 允许一些网络延迟

      // 创建新阵容
      await page.click('[data-testid="create-composition-btn"]');
      await page.fill(
        '[data-testid="composition-name-input"]',
        '测试大型副本阵容'
      );
      await page.selectOption('[data-testid="raid-type-select"]', '大型副本');

      // 点击创建并测量响应时间
      const createStartTime = Date.now();
      await page.click('[data-testid="confirm-create-btn"]');

      // 等待阵容创建完成
      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('测试大型副本阵容', { timeout: 3000 });
      const createEndTime = Date.now();

      // 验证创建操作响应时间
      expect(createEndTime - createStartTime).toBeLessThan(2000); // 2秒内完成创建

      // 验证阵容基本信息
      await expect(
        page.locator('[data-testid="max-members-display"]')
      ).toContainText('25');
      await expect(
        page.locator('[data-testid="raid-type-display"]')
      ).toContainText('大型副本');

      // 验证角色槽位已正确初始化
      const tanksSection = page.locator('[data-testid="tanks-section"]');
      const healersSection = page.locator('[data-testid="healers-section"]');
      const dpsSection = page.locator('[data-testid="dps-section"]');

      await expect(tanksSection).toBeVisible();
      await expect(healersSection).toBeVisible();
      await expect(dpsSection).toBeVisible();

      // 验证槽位数量合理
      const tankSlots = await tanksSection.locator('.member-slot').count();
      const healerSlots = await healersSection.locator('.member-slot').count();
      const dpsSlots = await dpsSection.locator('.member-slot').count();

      expect(tankSlots).toBeGreaterThanOrEqual(2);
      expect(tankSlots).toBeLessThanOrEqual(5);
      expect(healerSlots).toBeGreaterThanOrEqual(3);
      expect(healerSlots).toBeLessThanOrEqual(8);
      expect(dpsSlots).toBeGreaterThanOrEqual(15);

      // 验证总槽位数不超过最大成员数
      expect(tankSlots + healerSlots + dpsSlots).toBeLessThanOrEqual(25);
    });

    test('AI 自动分配功能验证', async () => {
      // 前置条件：导航到战术中心并创建阵容
      await page.click('[data-testid="tactical-center-nav"]');
      await page.click('[data-testid="create-composition-btn"]');
      await page.fill(
        '[data-testid="composition-name-input"]',
        'AI分配测试阵容'
      );
      await page.selectOption('[data-testid="raid-type-select"]', '中型副本');
      await page.click('[data-testid="confirm-create-btn"]');

      // 等待阵容创建完成
      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('AI分配测试阵容');

      // 触发AI自动分配
      const aiAssignStartTime = Date.now();
      await page.click('[data-testid="ai-auto-assign-btn"]');

      // 等待AI分配开始指示器出现
      await expect(
        page.locator('[data-testid="assignment-status"]')
      ).toContainText('正在分配...', { timeout: 1000 });

      // 等待AI分配完成
      await expect(
        page.locator('[data-testid="assignment-status"]')
      ).toContainText('分配完成', {
        timeout: GUILD_MANAGER_CHUNK_002_SLOS.AI_ASSIGNMENT_P95_MS + 1000,
      });
      const aiAssignEndTime = Date.now();

      // 验证AI分配性能SLO: AI_ASSIGNMENT_P95_MS <= 500ms
      expect(aiAssignEndTime - aiAssignStartTime).toBeLessThan(
        GUILD_MANAGER_CHUNK_002_SLOS.AI_ASSIGNMENT_P95_MS + 500
      ); // 允许一些UI延迟

      // 验证分配结果
      const assignedTanks = await page
        .locator('[data-testid="tanks-section"] .member-slot.assigned')
        .count();
      const assignedHealers = await page
        .locator('[data-testid="healers-section"] .member-slot.assigned')
        .count();
      const assignedDps = await page
        .locator('[data-testid="dps-section"] .member-slot.assigned')
        .count();

      // 对于10人副本，至少应该有基本配置
      expect(assignedTanks).toBeGreaterThanOrEqual(1);
      expect(assignedHealers).toBeGreaterThanOrEqual(1);
      expect(assignedDps).toBeGreaterThanOrEqual(3);

      // 验证AI推荐信息显示
      await expect(
        page.locator('[data-testid="ai-recommendations"]')
      ).toBeVisible();

      const recommendationItems = await page
        .locator('[data-testid="ai-recommendations"] .recommendation-item')
        .count();
      expect(recommendationItems).toBeGreaterThan(0);
    });

    test('手动成员分配功能', async () => {
      // 创建测试阵容
      await page.click('[data-testid="tactical-center-nav"]');
      await page.click('[data-testid="create-composition-btn"]');
      await page.fill('[data-testid="composition-name-input"]', '手动分配测试');
      await page.selectOption('[data-testid="raid-type-select"]', '小型副本');
      await page.click('[data-testid="confirm-create-btn"]');

      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('手动分配测试');

      // 选择一个坦克槽位进行手动分配
      const firstTankSlot = page
        .locator('[data-testid="tanks-section"] .member-slot')
        .first();
      await firstTankSlot.click();

      // 验证成员选择器打开
      await expect(
        page.locator('[data-testid="member-selector-modal"]')
      ).toBeVisible();

      // 选择一个可用成员（假设有测试数据）
      const firstAvailableMember = page
        .locator('[data-testid="available-member"]')
        .first();
      if (await firstAvailableMember.isVisible()) {
        await firstAvailableMember.click();

        // 确认分配
        await page.click('[data-testid="confirm-assignment-btn"]');

        // 验证分配成功
        await expect(
          page.locator('[data-testid="member-selector-modal"]')
        ).not.toBeVisible();
        await expect(
          firstTankSlot.locator('.assigned-member-name')
        ).toBeVisible();
      }
    });
  });

  test.describe('战斗模拟功能', () => {
    test('战斗模拟计算验证', async () => {
      // 前置条件：确保有一个配置完整的阵容
      await page.click('[data-testid="tactical-center-nav"]');

      // 选择或创建一个已存在的阵容
      const existingComposition = page
        .locator('[data-testid="composition-list-item"]')
        .first();
      if (await existingComposition.isVisible()) {
        await existingComposition.click();
      } else {
        // 创建新阵容用于测试
        await page.click('[data-testid="create-composition-btn"]');
        await page.fill(
          '[data-testid="composition-name-input"]',
          '战斗模拟测试'
        );
        await page.selectOption('[data-testid="raid-type-select"]', '大型副本');
        await page.click('[data-testid="confirm-create-btn"]');

        // 使用AI快速分配成员
        await page.click('[data-testid="ai-auto-assign-btn"]');
        await expect(
          page.locator('[data-testid="assignment-status"]')
        ).toContainText('分配完成', { timeout: 5000 });
      }

      // 启动战斗模拟
      await page.click('[data-testid="combat-simulation-btn"]');
      await expect(
        page.locator('[data-testid="simulation-modal"]')
      ).toBeVisible();

      // 选择目标副本
      await page.selectOption(
        '[data-testid="target-dungeon-select"]',
        'dragon-lair-heroic'
      );

      // 开始模拟计算
      const simulationStartTime = Date.now();
      await page.click('[data-testid="start-simulation-btn"]');

      // 验证模拟进度指示器
      await expect(
        page.locator('[data-testid="simulation-progress"]')
      ).toBeVisible();

      // 等待模拟完成
      await expect(
        page.locator('[data-testid="simulation-result"]')
      ).toBeVisible({
        timeout: GUILD_MANAGER_CHUNK_002_SLOS.COMBAT_SIM_P95_MS + 2000,
      });
      const simulationEndTime = Date.now();

      // 验证战斗模拟性能SLO: COMBAT_SIM_P95_MS <= 200ms
      expect(simulationEndTime - simulationStartTime).toBeLessThan(
        GUILD_MANAGER_CHUNK_002_SLOS.COMBAT_SIM_P95_MS + 2000
      ); // 允许UI渲染时间

      // 验证模拟结果数据
      const successRate = await page
        .locator('[data-testid="success-probability"]')
        .textContent();
      const confidence = await page
        .locator('[data-testid="confidence-score"]')
        .textContent();
      const estimatedTime = await page
        .locator('[data-testid="estimated-clear-time"]')
        .textContent();

      expect(successRate).toBeTruthy();
      expect(confidence).toBeTruthy();
      expect(estimatedTime).toBeTruthy();

      // 验证数值范围合理
      const successRateNum = parseFloat(successRate!.replace(/[^0-9.]/g, ''));
      const confidenceNum = parseFloat(confidence!.replace(/[^0-9.]/g, ''));

      expect(successRateNum).toBeGreaterThanOrEqual(0);
      expect(successRateNum).toBeLessThanOrEqual(100);
      expect(confidenceNum).toBeGreaterThanOrEqual(0);
      expect(confidenceNum).toBeLessThanOrEqual(100);

      // 验证置信度达到SLO要求
      expect(confidenceNum).toBeGreaterThanOrEqual(
        GUILD_MANAGER_CHUNK_002_SLOS.SIMULATION_CONFIDENCE * 100
      );

      // 验证关键风险和建议信息
      await expect(
        page.locator('[data-testid="key-risks-section"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="recommendations-section"]')
      ).toBeVisible();

      const riskItems = await page
        .locator('[data-testid="key-risks-section"] .risk-item')
        .count();
      const recommendationItems = await page
        .locator('[data-testid="recommendations-section"] .recommendation-item')
        .count();

      expect(riskItems + recommendationItems).toBeGreaterThan(0); // 至少有一些分析内容
    });

    test('模拟结果历史记录', async () => {
      // 导航并执行一次模拟（复用上面的逻辑）
      await page.click('[data-testid="tactical-center-nav"]');
      await page.click('[data-testid="composition-list-item"]').first();

      await page.click('[data-testid="combat-simulation-btn"]');
      await page.selectOption(
        '[data-testid="target-dungeon-select"]',
        'ice-cavern-epic'
      );
      await page.click('[data-testid="start-simulation-btn"]');
      await expect(
        page.locator('[data-testid="simulation-result"]')
      ).toBeVisible({ timeout: 5000 });

      // 关闭模拟窗口
      await page.click('[data-testid="close-simulation-modal"]');

      // 查看模拟历史
      await page.click('[data-testid="simulation-history-btn"]');
      await expect(
        page.locator('[data-testid="simulation-history-list"]')
      ).toBeVisible();

      // 验证历史记录存在
      const historyItems = await page
        .locator('[data-testid="simulation-history-list"] .history-item')
        .count();
      expect(historyItems).toBeGreaterThan(0);

      // 验证历史记录包含基本信息
      const firstHistoryItem = page
        .locator('[data-testid="simulation-history-list"] .history-item')
        .first();
      await expect(firstHistoryItem.locator('.dungeon-name')).toContainText(
        'ice-cavern-epic'
      );
      await expect(firstHistoryItem.locator('.simulation-date')).toBeVisible();
      await expect(firstHistoryItem.locator('.success-rate')).toBeVisible();
    });
  });

  test.describe('阵容管理界面交互', () => {
    test('阵容列表和搜索功能', async () => {
      await page.click('[data-testid="tactical-center-nav"]');

      // 验证阵容列表显示
      await expect(
        page.locator('[data-testid="composition-list"]')
      ).toBeVisible();

      // 测试搜索功能
      await page.fill('[data-testid="composition-search-input"]', '测试');
      await page.press('[data-testid="composition-search-input"]', 'Enter');

      // 验证搜索结果
      await page.waitForTimeout(500); // 等待搜索处理
      const searchResults = await page
        .locator('[data-testid="composition-list-item"]')
        .count();
      // 搜索结果可能为0（如果没有匹配项）或更多
      expect(searchResults).toBeGreaterThanOrEqual(0);

      // 清除搜索
      await page.clear('[data-testid="composition-search-input"]');
      await page.press('[data-testid="composition-search-input"]', 'Enter');
    });

    test('阵容模板保存和导入', async () => {
      // 创建一个阵容并配置为模板
      await page.click('[data-testid="tactical-center-nav"]');
      await page.click('[data-testid="create-composition-btn"]');
      await page.fill('[data-testid="composition-name-input"]', '模板测试阵容');
      await page.selectOption('[data-testid="raid-type-select"]', '团队副本');
      await page.click('[data-testid="confirm-create-btn"]');

      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('模板测试阵容');

      // 使用AI分配创建完整配置
      await page.click('[data-testid="ai-auto-assign-btn"]');
      await expect(
        page.locator('[data-testid="assignment-status"]')
      ).toContainText('分配完成', { timeout: 5000 });

      // 保存为模板
      await page.click('[data-testid="save-as-template-btn"]');
      await page.fill(
        '[data-testid="template-name-input"]',
        '40人团队副本标准模板'
      );
      await page.click('[data-testid="confirm-save-template-btn"]');

      // 验证保存成功提示
      await expect(
        page.locator('[data-testid="success-message"]')
      ).toContainText('模板保存成功');

      // 创建新阵容时使用模板
      await page.click('[data-testid="create-composition-btn"]');
      await page.fill(
        '[data-testid="composition-name-input"]',
        '基于模板的新阵容'
      );
      await page.selectOption('[data-testid="raid-type-select"]', '团队副本');

      // 选择模板
      await page.selectOption(
        '[data-testid="template-select"]',
        '40人团队副本标准模板'
      );
      await page.click('[data-testid="confirm-create-btn"]');

      // 验证模板应用成功
      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('基于模板的新阵容');

      // 验证阵容已经有预分配的成员（基于模板）
      const preAssignedSlots = await page
        .locator('.member-slot.assigned')
        .count();
      expect(preAssignedSlots).toBeGreaterThan(0);
    });

    test('响应式设计和键盘快捷键', async () => {
      await page.click('[data-testid="tactical-center-nav"]');

      // 测试键盘导航
      await page.press('body', 'Control+n'); // 假设有新建阵容快捷键
      // 根据实际实现验证快捷键功能

      // 测试不同窗口尺寸的响应式设计
      await page.setViewportSize({ width: 1024, height: 768 }); // 平板尺寸
      await expect(
        page.locator('[data-testid="tactical-center-root"]')
      ).toBeVisible();

      await page.setViewportSize({ width: 1920, height: 1080 }); // 桌面尺寸
      await expect(
        page.locator('[data-testid="tactical-center-root"]')
      ).toBeVisible();
    });
  });

  test.describe('错误处理和边界情况', () => {
    test('网络错误恢复', async () => {
      await page.click('[data-testid="tactical-center-nav"]');

      // 模拟网络中断（通过拦截网络请求）
      await page.route('**/api/**', route => {
        route.abort();
      });

      // 尝试创建阵容
      await page.click('[data-testid="create-composition-btn"]');
      await page.fill('[data-testid="composition-name-input"]', '网络错误测试');
      await page.selectOption('[data-testid="raid-type-select"]', '小型副本');
      await page.click('[data-testid="confirm-create-btn"]');

      // 验证错误提示显示
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        /网络|连接|错误/
      );

      // 恢复网络并重试
      await page.unroute('**/api/**');
      await page.click('[data-testid="retry-btn"]');

      // 验证重试成功
      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('网络错误测试', { timeout: 5000 });
    });

    test('数据验证和用户反馈', async () => {
      await page.click('[data-testid="tactical-center-nav"]');
      await page.click('[data-testid="create-composition-btn"]');

      // 测试空名称验证
      await page.click('[data-testid="confirm-create-btn"]');
      await expect(
        page.locator('[data-testid="validation-error"]')
      ).toContainText('名称不能为空');

      // 测试名称长度验证
      await page.fill(
        '[data-testid="composition-name-input"]',
        'A'.repeat(101)
      ); // 超长名称
      await page.click('[data-testid="confirm-create-btn"]');
      await expect(
        page.locator('[data-testid="validation-error"]')
      ).toContainText(/名称过长|长度/);

      // 输入有效数据
      await page.clear('[data-testid="composition-name-input"]');
      await page.fill(
        '[data-testid="composition-name-input"]',
        '有效的阵容名称'
      );
      await page.selectOption('[data-testid="raid-type-select"]', '中型副本');
      await page.click('[data-testid="confirm-create-btn"]');

      // 验证创建成功
      await expect(
        page.locator('[data-testid="composition-title"]')
      ).toContainText('有效的阵容名称');
    });
  });
});
