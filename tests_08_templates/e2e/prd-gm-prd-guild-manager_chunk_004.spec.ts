import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
} from '@playwright/test';
import { resolve } from 'node:path';

test('PRD-GM-PRD-GUILD-MANAGER_CHUNK_004 · 公会论坛模块 · 首屏可用性', async () => {
  const electronApp = await electron.launch({
    args: [resolve(process.cwd(), 'dist-electron', 'main.js')],
    env: {
      NODE_ENV: 'test',
    },
  });
  const window = await electronApp.firstWindow();
  const el = await window.waitForSelector('[data-testid="app-ready"]', {
    timeout: 2000,
  });
  await expect(await el.innerText()).not.toBeNull();
  await electronApp.close();
});
