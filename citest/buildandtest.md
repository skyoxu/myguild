## 改动文件门禁解决方法

你这次 CI 是被 ESLint 的“0 容忍警告”门禁卡住了：ESLint found too many warnings (maximum: 0)。主要两类：

@typescript-eslint/no-explicit-any（测试里用了大量 any）
typescript-eslint.io

max-lines-per-function（单个大测试函数 300–589 行）
eslint.org

下面给一套“马上变绿 + 持续收敛”的做法，带可直接粘贴的片段。

A. 先把 CI 放行（不牺牲提醒）
方案 A1：分目录跑 ESLint（src 严格、tests 较宽）

在 CI 里把原本单次 eslint 拆成两段（src 仍然 0 容忍，tests 允许警告或单独阈值）：

# 严格检查业务代码

npx eslint "src/\*_/_.{ts,tsx}" --max-warnings 0

# 测试代码放宽（示例：允许 ≤50 条警告；完全放开用 -1）

npx eslint "tests/\*_/_.{ts,tsx,js,mjs}" --max-warnings 50

--max-warnings 为 ESLint 官方 CLI 选项，整数阈值，传 -1 则关闭该行为。
eslint.org
ESLint - Pluggable JavaScript linter

方案 A2：在 ESLint 配置里“按文件覆写规则”（tests 放宽）

（Flat config 示例 eslint.config.js）

import tseslint from 'typescript-eslint';

export default [
// 业务源码：严格
{
files: ['src/**/*.{ts,tsx}'],
plugins: { '@typescript-eslint': tseslint.plugin },
rules: {
'@typescript-eslint/no-explicit-any': 'error',
'max-lines-per-function': ['error', { max: 250 }],
},
},
// 测试：有控制地放宽
{
files: ['tests/**/*.{ts,tsx,js,mjs}'],
plugins: { '@typescript-eslint': tseslint.plugin },
rules: {
'@typescript-eslint/no-explicit-any': 'warn', // 或 'off'
'max-lines-per-function': ['warn', { max: 500, ignoreComments: true }],
},
},
];

ESLint 官方支持基于 glob 的配置分层与忽略/覆写。
eslint.org

若只想暂时放过个别超长用例，可在函数上一行加：
// eslint-disable-next-line max-lines-per-function；
关闭 no-explicit-any 的单文件写法：/_ eslint-disable @typescript-eslint/no-explicit-any _/。
Stack Overflow
+1

B. 持续收敛：把 any 改成具体类型/unknown，拆分超长测试
B1. any 的替代：优先具体类型；不确定时用 unknown

规则建议：any 是“逃生舱”，应尽量用具体类型或 unknown，后者更安全（使用前需收窄/断言）。
typescript-eslint.io
Dmitri Pavlutin Blog

在 Playwright 里落地的常用写法：

import { test, expect, Page, \_electron as electron, ElectronApplication } from '@playwright/test';

// 1) 给 evaluate 指明返回类型（避免默认 any）
const hasCsp = await page.evaluate<boolean>(() =>
!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
); // 官方支持给 evaluate 指定返回类型泛型。:contentReference[oaicite:6]{index=6}

// 2) 约束 JSON 结构（替代 any）
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const payload = await page.evaluate<Json>(() => (window as any).\_\_MY_APP_STATE); // 再在外层做类型收窄

// 3) Electron 类型
let app: ElectronApplication; // 避免 any

需要临时接住“未知值”时：unknown / Record<string, unknown> / unknown[] 通常优于 any。
DEV Community
Medium

IPC/事件载荷建议用你仓库的 src/shared/contracts/\*\* 里的类型来替代 any（这和你项目的 ADR-0004 “事件总线 & 命名”契合）。

B2. 拆分“巨型箭头函数”（max-lines-per-function）

把超长测试函数拆成可复用的步骤函数与多个 test(...) / test.step(...)，每段 50–120 行即可。

test.step 是官方提供的分步/可读性增强能力（报告里也分步展示）。
playwright.dev

示例：

import { test, expect, Page } from '@playwright/test';

async function assertCsp(page: Page) { /_ ... _/ }
async function assertNavigationGuards(page: Page) { /_ ... _/ }

test('安全红线：CSP', async ({ page }) => { await assertCsp(page); });
test('安全红线：外链/导航拦截', async ({ page }) => {
await test.step('拦截 will-navigate/onBeforeRequest', async () => {
await assertNavigationGuards(page);
});
});

规则目标是“函数不要过长以利维护”，这是 max-lines-per-function 的官方意图。
eslint.org

C. 把“测试里难消的 any”做成可控白名单

如果以上改动后仍有零星 any 难以消除（典型：page.evaluate 中转、动态 IPC 载荷）：

在 tests/\*_/_ 限定只对这些点放宽规则（见 A2 覆写）；

或者以行内禁用（最小面）：

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;

但建议把这类禁用数量纳入“自定义软门禁”，例如 ≤ 10 条，一旦超标就在 Summary 里预警。

D. 一键抹平这次 CI 的操作顺序

采用 A1 或 A2（二选一）放行本次 CI；

批量把常见 any 替换为上文的 generic 返回类型/Json/unknown；

按场景拆分 security-redlines.spec.ts 与 smoke.electron.spec.ts 的“巨型函数”，或在极少数处用 // eslint-disable-next-line max-lines-per-function；

后续把 阈值 再逐步收紧（把 tests 的 no-explicit-any 从 off/warn 收敛到 warn/error）。

参考

ESLint --max-warnings（阈值，-1 关闭）与规则配置/覆写。
eslint.org
+2
eslint.org
+2
ESLint - Pluggable JavaScript linter

@typescript-eslint/no-explicit-any：避免显式 any，优先具体类型/unknown。
typescript-eslint.io

max-lines-per-function 规则目的与做法。
eslint.org

Playwright page.evaluate 类型泛型、ElectronApplication 类型与分步（test.step）。
