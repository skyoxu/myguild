# 07章 E2E测试架构标准

## 前言
本文档定义了 Electron + React + Playwright 应用的 E2E 测试架构标准和最佳实践，用于防止架构反模式并确保测试的稳定性和可维护性。

## 核心原则

### 1. 导入一致性原则
**强制要求**：所有 E2E 测试文件必须使用 `@playwright/test` 进行导入，不得使用 `playwright`。

```typescript
// ✅ 正确的导入方式
import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';

// ❌ 错误的导入方式
import { test, expect } from 'playwright';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
```

**原因**：
- `@playwright/test` 提供了更完整的测试框架集成
- 确保测试断言、配置和钩子函数的一致性
- 避免版本冲突和类型定义不一致

### 2. Electron应用启动模式
**标准模式**：使用 `beforeAll` 钩子启动应用，避免在每个测试中重复导航。

```typescript
// ✅ 推荐的应用启动模式
let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['./dist/electron/main.js'],
    env: {
      NODE_ENV: 'test',
      CI: 'true',
    },
  });
  
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});
```

### 3. 导航反模式禁令
**严格禁止**：在 Electron E2E 测试中使用 `page.goto('app://...')` 导航模式。

```typescript
// ❌ 禁止的导航反模式
test('某个功能测试', async () => {
  await page.goto('app://./index.html');  // 导航反模式
  await page.goto('app://index.html');    // 导航反模式
  // ... 测试代码
});

// ✅ 正确的等待模式
test('某个功能测试', async () => {
  // 等待应用就绪，无需重新导航（应用已在beforeAll中启动）
  await page.waitForSelector('[data-testid="app-root"]');
  // ... 测试代码
});
```

**原因**：
- `app://` 协议绕过了 Electron 应用的正常启动流程
- 可能导致应用状态不一致或初始化不完整
- 影响性能测试的准确性（跳过了真实的启动时间）
- 违反了 Electron 最佳实践

### 4. 应用状态管理
**等待策略**：使用显式等待而不是重复导航来确保应用就绪。

```typescript
// ✅ 推荐的等待策略
test.beforeEach(async () => {
  // 确保每个测试开始时应用就绪（无需重新导航）
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 5000 });
});

// 针对特定场景的等待
test('交互测试', async () => {
  await page.waitForSelector('[data-testid="specific-component"]');
  // ... 交互测试代码
});
```

## 架构标准

### 测试文件结构
```
tests/
├── e2e/
│   ├── smoke.electron.spec.ts           # Electron 冒烟测试
│   ├── perf.smoke.spec.ts              # 性能冒烟测试
│   ├── security.smoke.spec.ts          # 安全基线测试
│   ├── security/
│   │   └── enhanced/
│   │       ├── enhanced-electron-security.spec.ts
│   │       └── enhanced-csp-security.spec.ts
│   ├── guild-manager/                  # 功能测试目录
│   │   └── *.e2e.ts
│   └── utils/                          # 测试工具
└── utils/
    └── PerformanceTestUtils.ts         # 性能测试工具
```

### 测试配置标准化
在每个测试文件中应包含标准化的配置：

```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['./dist/electron/main.js'],
    env: {
      NODE_ENV: 'test',
      CI: process.env.CI || 'false',
    },
    // 录制视频（仅在CI环境）
    recordVideo: process.env.CI ? { dir: 'test-results/videos' } : undefined,
  });
  
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});
```

### 选择器标准
**推荐使用**：data-testid 属性进行元素选择，确保测试的稳定性。

```typescript
// ✅ 推荐的选择器
await page.waitForSelector('[data-testid="app-root"]');
await page.locator('[data-testid="user-profile"]').click();

// ✅ 回退选择器（当data-testid不可用时）
await page.locator('button, [role="button"]').first();

// ❌ 避免的选择器（脆弱）
await page.locator('.btn-primary'); // CSS类名可能变化
await page.locator('div > span:nth-child(2)'); // DOM结构依赖
```

## 质量门禁

### ESLint 规则
项目已配置以下 ESLint 规则来强制执行架构标准：

```javascript
// eslint.config.js - E2E测试特定规则
{
  files: ['**/tests/e2e/**/*.{ts,tsx,js,jsx}', '**/e2e/**/*.{ts,tsx,js,jsx}'],
  rules: {
    // 禁止从 'playwright' 导入
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['playwright'],
            message: "使用 '@playwright/test' 而不是 'playwright' 来保证导入一致性和测试稳定性"
          }
        ]
      }
    ],
    // 禁止 app:// 导航反模式
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='goto'] > Literal[value=/^app:/]",
        message: "Electron E2E测试中禁止使用 page.goto('app://...') 导航反模式，应在beforeAll中启动应用并使用waitForSelector等待元素就绪"
      }
    ]
  }
}
```

### 自动化检查
在 CI/CD 流水线中应包含以下检查：

```bash
# package.json scripts
{
  "scripts": {
    "test:e2e:lint": "eslint tests/e2e/ --ext .ts,.tsx",
    "test:e2e:arch-check": "node scripts/e2e-architecture-check.js",
    "guard:e2e": "npm run test:e2e:lint && npm run test:e2e:arch-check"
  }
}
```

## 性能测试特殊要求

### P95 采样测试模式
对于性能测试，使用 P95 采样方法论替代单点断言：

```typescript
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';

test('应用冷启动性能验证 - P95采样', async () => {
  await PerformanceTestUtils.runColdStartupP95Test(
    async () => {
      // 测试逻辑
      const startTime = performance.now();
      electronApp = await electron.launch({
        args: ['./dist/main.js'],
      });
      page = await electronApp.firstWindow();
      await page.waitForSelector('[data-testid="app-root"]');
      return performance.now() - startTime;
    },
    DEFAULT_LATENCY_BUDGET.assetLoad.cold,
    15 // 采样次数
  );
});
```

### 性能预算约束
所有性能测试必须引用 `src/shared/contracts/perf.ts` 中定义的预算：

```typescript
import {
  DEFAULT_FRAME_BUDGET,
  DEFAULT_LATENCY_BUDGET,
} from '../../src/shared/contracts/perf';

// 使用预算进行断言
expect(performanceMetrics.domContentLoaded).toBeLessThan(
  DEFAULT_LATENCY_BUDGET.assetLoad.cold
);
```

## 安全测试要求

### 安全基线验证
每个安全测试必须验证以下基线：

1. **Node.js 全局变量隔离**
2. **CSP 策略完整性** 
3. **预加载脚本白名单 API**
4. **窗口安全配置验证**

```typescript
test('安全基线：Node.js 全局变量隔离', async () => {
  const nodeGlobals = await page.evaluate(() => {
    return {
      hasRequire: typeof (window as any).require !== 'undefined',
      hasProcess: typeof (window as any).process !== 'undefined',
      hasBuffer: typeof (window as any).Buffer !== 'undefined',
    };
  });

  expect(nodeGlobals.hasRequire, 'require() 不应暴露到渲染进程').toBe(false);
  expect(nodeGlobals.hasProcess, 'process 不应暴露到渲染进程').toBe(false);
  expect(nodeGlobals.hasBuffer, 'Buffer 不应暴露到渲染进程').toBe(false);
});
```

## 迁移指南

### 从导航反模式迁移
如果现有测试使用了 `page.goto('app://...')`，按以下步骤迁移：

1. **移除导航调用**
```typescript
// 移除这些行
await page.goto('app://./index.html');
await page.goto('app://index.html');
```

2. **添加等待逻辑**
```typescript
// 添加适当的等待逻辑
await page.waitForSelector('[data-testid="app-root"]');
await page.waitForLoadState('networkidle');
```

3. **验证测试仍然通过**
```bash
npm run test:e2e -- --grep "具体测试名称"
```

### 从错误导入迁移
```typescript
// 查找并替换
// 从: import { ... } from 'playwright';
// 到: import { ... } from '@playwright/test';
```

## 故障排除

### 常见问题
1. **应用启动失败**
   - 检查 `args` 路径是否正确
   - 验证构建产物是否存在
   - 确认环境变量配置

2. **等待超时**
   - 增加 timeout 配置
   - 使用更具体的选择器
   - 检查应用启动日志

3. **性能测试不稳定**
   - 使用 P95 采样而不是单次测试
   - 确保测试环境一致性
   - 排除并发测试干扰

## ADR 引用
- ADR-0002: Electron 安全基线
- ADR-0005: 质量门禁
- ADR-0003: 可观测性与 Release Health

---

**最后更新**: 2025-08-27
**维护者**: 架构团队
**版本**: 1.0.0