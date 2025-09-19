import { test, expect } from '@playwright/test';
import { launchAppWithPage } from '../helpers/launch';

test('Definition of Playable: 新建档→建造→打一波→存/读档→退出', async () => {
  const { app, page: win } = await launchAppWithPage();

  await expect(win.getByTestId('menu-root')).toBeVisible();

  await win.getByTestId('btn-new-save').click();
  await expect(win.getByTestId('scene-main')).toBeVisible();

  await win.getByTestId('btn-build-tower').click();
  await win.getByTestId('btn-start-wave').click();
  await expect(win.getByTestId('wave-complete')).toBeVisible();

  await win.getByTestId('btn-save').click();
  await app.close();
});
