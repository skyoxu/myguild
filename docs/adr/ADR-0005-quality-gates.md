---
ADR-ID: ADR-0005
title: 质量门禁与测试策略 - 多层测试自动化
status: Accepted
decision-time: '2025-08-17'
deciders: [架构团队, QA团队, DevOps团队]
archRefs: [CH01, CH03, CH07, CH09]
verification:
  - path: tests/e2e/smoke.electron.spec.ts
    assert: Electron app launches via _electron.launch and preload API is available
  - path: scripts/quality/coverage-gate.mjs
    assert: Unit test coverage meets threshold
  - path: scripts/perf/assert-p95.mjs
    assert: Key interactions ≤ 100ms P95; event handling ≤ 50ms P95
  - path: scripts/release-health-gate.mjs
    assert: No regression and crash-free thresholds met
impact-scope:
  [tests/, scripts/quality_gates.mjs, playwright.config.ts, vitest.config.ts]
tech-tags: [playwright, vitest, testing, quality-gates, ci-cd, coverage]
depends-on: [ADR-0002, ADR-0003]
depended-by: [ADR-0008]
test-coverage: tests/meta/quality-gates.spec.ts
monitoring-metrics:
  [test_coverage, test_success_rate, build_time, gate_pass_rate]
executable-deliverables:
  - scripts/quality_gates.mjs
  - tests/e2e/smoke.electron.spec.ts
  - vitest.config.ts
  - playwright.config.ts
supersedes: []
---

# ADR-0005: 质量门禁与测试策略

## Context and Problem Statement

AI生成代码需要建立严格的"能跑→能用→不退化"的自动门禁护栏。需要确保代码质量、功能正确性和性能稳定性，同时防止技术债务积累。建立硬编码的质量阈值，确保质量标准不因项目压力而妥协。

## Decision Drivers

- 需要自动化质量门禁，减少人工审查成本
- 需要防止有问题的代码进入主分支
- 需要保证Electron应用的稳定性和性能
- 需要覆盖前端、后端、跨进程通信等全链路测试
- 需要建立不可妥协的质量标准
- 需要支持快速反馈和持续集成

## Considered Options

- **Playwright×Electron + Vitest + 硬编码门禁** (选择方案)
- **Cypress + Jest + 软性门禁**
- **Selenium + Mocha + 人工审查**
- **仅依赖单元测试 + Code Review**
- **E2E测试外包 + 轻量级门禁**

## Decision Outcome

选择的方案：**Playwright×Electron + Vitest + 硬编码门禁**

### 硬编码门禁阈值（不可调整）

**代码覆盖率门禁**：

```javascript
// scripts/quality_gates.mjs - 硬编码阈值，禁止修改
const HARD_CODED_THRESHOLDS = {
  // 代码覆盖率（不可低于此值）
  coverage: {
    lines: 90, // 行覆盖率 ≥90%
    branches: 85, // 分支覆盖率 ≥85%
    functions: 88, // 函数覆盖率 ≥88%
    statements: 90, // 语句覆盖率 ≥90%
  },

  // E2E测试要求
  e2e: {
    passRate: 95, // E2E通过率 ≥95%
    maxDuration: 300, // 最大执行时间 ≤5分钟
    criticalPath: 100, // 关键路径 100%通过
  },

  // 性能要求
  performance: {
    appStartTime: 3000, // 应用启动时间 ≤3秒
    memoryUsage: 512, // 内存使用 ≤512MB
    cpuUsage: 80, // CPU使用率 ≤80%
  },

  // Release Health（继承ADR-0003，与Sentry官方术语完全一致）
  releaseHealth: {
    crashFreeUsers: 99.5, // Crash-Free Users ≥99.5%（Sentry官方指标）
    crashFreeSessions: 99.8, // Crash-Free Sessions ≥99.8%（Sentry官方指标）
    minAdoption: 1000, // 最小采样数 ≥1000会话
  },
};

// 阈值检查函数（不允许绕过）
function validateQualityGates(metrics) {
  const failures = [];

  // 严格检查每个指标
  Object.entries(HARD_CODED_THRESHOLDS.coverage).forEach(([key, threshold]) => {
    if (metrics.coverage[key] < threshold) {
      failures.push(
        `Coverage ${key}: ${metrics.coverage[key]}% < ${threshold}%`
      );
    }
  });

  if (failures.length > 0) {
    throw new Error(`Quality Gate FAILED:\n${failures.join('\n')}`);
  }
}
```

### Playwright × Electron E2E测试配置

**测试配置**：

```javascript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  retries: 2, // 允许重试2次

  // 严格的报告要求
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    // 启用追踪用于调试
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'electron',
      testMatch: '**/*.electron.spec.ts',
      use: {
        // Electron应用专用配置
        launchOptions: {
          executablePath: require('electron'),
          args: ['--app=./electron/main.js', '--no-sandbox'],
        },
      },
    },
  ],
});
```

**关键路径E2E测试**：

```typescript
// tests/e2e/critical-path.electron.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Critical Path Tests', () => {
  let app: any;
  let window: any;

  test.beforeAll(async () => {
    // 启动Electron应用
    app = await electron.launch({
      args: ['./electron/main.js'],
      timeout: 10000,
    });

    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('应用启动和基础功能', async () => {
    // 验证应用标题
    const title = await window.title();
    expect(title).toContain('Build Game');

    // 验证关键UI元素
    await expect(window.locator('[data-testid="main-menu"]')).toBeVisible();
    await expect(window.locator('[data-testid="game-canvas"]')).toBeVisible();

    // 性能检查
    const startTime = Date.now();
    await window.locator('[data-testid="start-button"]').click();
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3秒启动要求
  });

  test('IPC通信测试', async () => {
    // 测试安全IPC调用
    const result = await window.evaluate(async () => {
      return await window.electronAPI.getSystemInfo();
    });

    expect(result).toHaveProperty('platform');
    expect(result).toHaveProperty('version');
  });

  test('游戏核心功能', async () => {
    // 测试游戏场景加载
    await window.locator('[data-testid="new-game"]').click();
    await expect(window.locator('[data-testid="game-scene"]')).toBeVisible({
      timeout: 5000,
    });

    // 测试基础交互
    await window.locator('[data-testid="player-character"]').click();
    await expect(
      window.locator('[data-testid="character-menu"]')
    ).toBeVisible();
  });
});
```

### Vitest单元测试配置

**测试配置**：

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // 严格的覆盖率要求
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 90, // 硬编码：行覆盖率90%
        branches: 85, // 硬编码：分支覆盖率85%
        functions: 88, // 硬编码：函数覆盖率88%
        statements: 90, // 硬编码：语句覆盖率90%
      },
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        'electron/**/*.spec.ts',
      ],
    },

    // 测试文件匹配模式
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'electron'],
  },
});
```

**契约测试示例**：

```typescript
// tests/unit/contracts/events.spec.ts
import { describe, it, expect } from 'vitest';
import { CloudEventBus } from '../../../src/shared/eventbus/cloud-event-bus';
import { PlayerLevelUpEvent } from '../../../src/shared/contracts/events/player-events';

describe('Event Contracts', () => {
  let eventBus: CloudEventBus;

  beforeEach(() => {
    eventBus = new CloudEventBus();
  });

  it('should validate CloudEvents format', async () => {
    const validEvent: PlayerLevelUpEvent = {
      id: 'test-123',
      source: 'game.player',
      type: 'com.buildgame.player.levelup',
      specversion: '1.0',
      data: {
        playerId: 'player-1',
        previousLevel: 1,
        newLevel: 2,
        gainedExp: 100,
        unlockedSkills: [],
        timestamp: Date.now(),
      },
    };

    await expect(eventBus.publish(validEvent)).resolves.not.toThrow();
  });

  it('should reject invalid CloudEvents', async () => {
    const invalidEvent = {
      // 缺少必需字段
      source: 'game.player',
      data: { test: true },
    };

    await expect(eventBus.publish(invalidEvent as any)).rejects.toThrow(
      'Invalid CloudEvent format'
    );
  });
});
```

### CI/CD集成配置

**GitHub Actions工作流**：

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  quality-gates:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript compilation
        run: npm run typecheck

      - name: ESLint check
        run: npm run lint

      - name: Unit tests with coverage
        run: npm run test:unit -- --coverage

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: E2E tests
        run: npm run test:e2e

      - name: Security scan
        run: npm run guard:electron

      - name: Quality gates validation
        run: npm run guard:quality

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

**Package.json脚本配置**：

```json
{
  "scripts": {
    "test:unit": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "guard:electron": "node scripts/scan_electron_safety.mjs",
    "guard:quality": "node scripts/quality_gates.mjs",
    "guard:performance": "node scripts/performance_check.mjs",
    "guard:ci": "npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e && npm run guard:electron && npm run guard:quality"
  }
}
```

### Positive Consequences

- 自动化质量门禁，确保代码质量不会因项目压力而妥协
- 硬编码阈值防止质量标准被绕过或降低
- 全面的测试覆盖（单元、集成、E2E、性能）
- 快速反馈机制，问题早期发现和修复
- 支持持续集成和持续部署
- 测试结果可视化和历史追踪
- Electron应用特有的测试覆盖

### Negative Consequences

- 初期测试编写成本较高，需要团队培训
- 严格的门禁可能降低开发速度
- 硬编码阈值缺乏灵活性，特殊情况处理复杂
- Playwright测试环境搭建和维护成本
- 测试基础设施需要额外资源投入
- 可能出现测试不稳定导致的假阳性失败

## Verification

- **测试验证**: tests/unit/quality-gates.spec.ts, tests/e2e/quality-validation.spec.ts
- **门禁脚本**: scripts/quality_gates.mjs, scripts/performance_check.mjs
- **监控指标**: tests.pass_rate, coverage.percentage, ci.build_success_rate, quality.gate_failures
- **CI/CD集成**: GitHub Actions工作流自动执行所有质量检查

### 质量门禁验证矩阵

| 检查类型     | 工具       | 阈值要求           | 失败后果   |
| ------------ | ---------- | ------------------ | ---------- |
| **代码编译** | TypeScript | 0 errors           | PR自动阻断 |
| **代码风格** | ESLint     | 0 warnings         | PR自动阻断 |
| **单元测试** | Vitest     | 90%覆盖率          | PR自动阻断 |
| **E2E测试**  | Playwright | 95%通过率          | PR自动阻断 |
| **安全扫描** | 自定义脚本 | 0 High/Critical    | PR自动阻断 |
| **性能测试** | 自定义脚本 | <3s启动,<512MB内存 | PR自动阻断 |

## Operational Playbook

### 升级步骤

1. **测试框架**: 安装和配置Playwright、Vitest测试框架
2. **门禁脚本**: 部署硬编码质量门禁检查脚本
3. **CI/CD集成**: 配置GitHub Actions自动化工作流
4. **覆盖率监控**: 建立代码覆盖率追踪和报告
5. **性能基准**: 建立性能基准测试和监控
6. **团队培训**: 团队测试编写和维护培训

### 回滚步骤

1. **紧急绕过**: 提供紧急情况下的质量门禁绕过机制（需要管理层审批）
2. **阈值临时调整**: 在严重阻塞时可临时降低非关键指标阈值
3. **测试修复**: 快速修复不稳定的测试用例
4. **环境恢复**: 恢复测试环境到稳定状态
5. **问题分析**: 分析门禁失败原因并制定改进计划

### 迁移指南

- **测试补充**: 为现有功能补充测试用例以达到覆盖率要求
- **CI适配**: 现有CI/CD流程需要集成新的质量门禁检查
- **开发流程**: 开发人员需要适应TDD（测试驱动开发）流程
- **工具培训**: 团队需要学习Playwright和Vitest工具使用
- **质量文化**: 建立重视测试和质量的团队文化

## References

- **CH章节关联**: CH07, CH05
- **相关ADR**: ADR-0002-electron-security, ADR-0003-observability-release-health, ADR-0004-event-bus-and-contracts
- **外部文档**:
  - [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
  - [Vitest Configuration](https://vitest.dev/config/)
  - [GitHub Actions CI/CD](https://docs.github.com/en/actions)
  - [Code Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)
- **测试标准**: IEEE 829 Test Documentation, ISO/IEC 29119 Software Testing
- **相关PRD-ID**: 适用于所有PRD的质量门禁基线
