import type { Page } from '@playwright/test';

/** 触发可能导航/弹窗的动作，与导航事件做竞态，最终对"仍留在我方 URL"做断言。 */
export async function attemptAndAssertBlocked(
  page: Page,
  attempt: () => Promise<void> | void,
  navTimeout = 800
) {
  const navP = page
    .waitForEvent('framenavigated', { timeout: navTimeout })
    .then(() => 'navigated')
    .catch(() => 'no-nav');
  const actP = Promise.resolve()
    .then(() => attempt())
    .then(() => 'act-ok')
    .catch(() => 'act-err');
  await Promise.race([navP, actP]); // 避免 evaluate 在导航中被销毁
  const url = page.url();
  if (!(url.startsWith('file://') || url.startsWith('app://'))) {
    throw new Error(`navigation was not blocked, current url=${url}`);
  }
}
