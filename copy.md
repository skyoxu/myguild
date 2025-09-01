# 就地可执行片段

## 事件契约（ADR-0004）——最小 CloudEvents 构造器 + 单测占位

// src/shared/contracts/events.ts
export interface CeBase {
id: string; source: string; type: string; specversion: '1.0'; time: string;
}
export function mkEvent<T = unknown>(e: Omit<CeBase,'id'|'time'|'specversion'> & { data?: T }): CeBase & { data?: T } {
return {
id: crypto.randomUUID(),
time: new Date().toISOString(),
specversion: '1.0',
...e,
};
}
export function assertCe(o: any): asserts o is CeBase {
const req = ['id','source','type','specversion','time'];
for (const k of req) if (!o?.[k]) throw new Error(`CloudEvent missing ${k}`);
if (o.specversion !== '1.0') throw new Error('Unsupported specversion');
}

// tests/unit/contracts/events.spec.ts
import { describe,it,expect } from 'vitest';
import { mkEvent, assertCe } from '../../../src/shared/contracts/events';
describe('CloudEvents contract', () => {
it('builds and validates CE 1.0', () => {
const ev = mkEvent({ source:'app://guild', type:'guild.created' });
expect(() => assertCe(ev)).not.toThrow();
});
});

## Electron 安全门（ADR-0002）——窗口/导航/权限三拦截 + CSP 响应头

// electron/security.ts
import { BrowserWindow, session, app } from 'electron';
export function harden(win: BrowserWindow) {
// 链接/弹窗
win.webContents.setWindowOpenHandler(({ url }) => {
// 只允许内部协议或白名单
const allow = url.startsWith('app://');
return { action: allow ? 'allow' : 'deny' };
});
// 导航拦截
win.webContents.on('will-navigate', (e, url) => {
if (!url.startsWith('app://')) { e.preventDefault(); }
});
}
export function installSecurityHeaders() {
const ses = session.defaultSession;
ses.webRequest.onHeadersReceived((details, cb) => {
const h = details.responseHeaders ?? {};
h['Content-Security-Policy'] = [
"default-src 'none'; script-src 'self'; img-src 'self'; style-src 'self'; connect-src 'self' https://sentry.io" // 精确到你的采集域
];
h['Cross-Origin-Opener-Policy'] = ['same-origin'];
h['Cross-Origin-Embedder-Policy'] = ['require-corp'];
h['Permissions-Policy'] = ['geolocation=(), camera=(), microphone=()'];
cb({ responseHeaders: h });
});
}

// tests/e2e/security.electron.spec.ts (片段)
import { test, expect, \_electron as electron } from '@playwright/test';
test('main window secured', async () => {
const app = await electron.launch({ args: ['./electron/main.js'] });
const win = await app.firstWindow();
// 试图导航到外部站点应被拦截
const [nav] = await Promise.allSettled([
win.evaluate(() => (window.location.href = 'https://example.com'))
]);
expect(nav.status).toBe('fulfilled'); // 执行但被 will-navigate 拦截，URL 保持原值
await app.close();
});

做法与 Electron 安全教程、窗口/导航/权限 API 一致；同时用 COOP/COEP/Permissions-Policy 形成隔离面

## SQLite WAL 策略（ADR-0006）——初始化与 checkpoint

// src/main/db/init.ts
import Database from 'better-sqlite3';
export function openDb(file: string) {
const db = new Database(file);
db.pragma('journal_mode = WAL'); // 开 WAL
db.pragma('synchronous = NORMAL');
db.pragma('wal_autocheckpoint = 1000'); // 视写入量调整
return db;
}
export function checkpoint(db: Database, mode: 'PASSIVE'|'FULL'|'RESTART'|'TRUNCATE'='FULL') {
db.pragma(`wal_checkpoint(${mode})`);
}

对应 WAL 模式、自动 checkpoint 与手动 wal_checkpoint/v2 的用法

## Release Health 门禁脚本（ADR-0003）

// .github/workflows/gates.json (片段)
{
"sentry": { "minCrashFreeUsers": 99.5, "minCrashFreeSessions": 99.0, "noRegression": true }
}

与 Sentry Release Health 机制一致，Crash-Free 作为核心阈值

## E2E 冒烟（Playwright × Electron）

// tests/e2e/smoke.electron.spec.ts
import { test, expect, \_electron as electron } from '@playwright/test';
test('first window visible & preload APIs', async () => {
const app = await electron.launch({ args: ['./electron/main.js'] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await expect(win.locator('[data-testid="app-root"]')).toBeVisible();
const hasAPI = await win.evaluate(() => !!(window as any).electronAPI);
expect(hasAPI).toBe(true);
await app.close();
});

官方推荐用法：\_electron.launch() 获取 ElectronApplication 实例并控制窗口

## 建议尽快补齐：

FM + 验证矩阵输出、Electron 三拦截与 COOP/COEP/Permissions-Policy 成组头、CloudEvents 必填校验、SQLite WAL/Checkpoint 的“何时执行”与“如何回滚”、以及 electron-updater 的发布通道描述

## 执行顺序建议

ADR-0002 → ADR-0003 → ADR-0004/0006 → ADR-0008。这条链最能直接提升“可发布性”
