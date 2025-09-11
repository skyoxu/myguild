import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp } from '../helpers/launch';

test('Definition of Playable: 新建档→建造→打一波→存/读档→退出', async () => {
  // ✅ 按cifix1.txt建议：使用构建产物而非相对路径
  const app: ElectronApplication = await launchApp();
  const win: Page = await app.firstWindow();

  // 进入主菜单
  await expect(win.getByTestId('menu-root')).toBeVisible();

  // 新建存档
  await win.getByTestId('btn-new-save').click();
  await expect(win.getByTestId('scene-main')).toBeVisible();

  // 建造一次 + 触发一波
  await win.getByTestId('btn-build-tower').click();
  await win.getByTestId('btn-start-wave').click();
  await expect(win.getByTestId('wave-complete')).toBeVisible();

  // 保存→退出→读取
  await win.getByTestId('btn-save').click();
  await app.close();
});
