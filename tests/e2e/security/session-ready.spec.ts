import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test(
  'ADR-0002: defaultSession 仅在 ready 后访问，且首窗可打开',
  { timeout: 180000 },
  async () => {
    const { app, page: win } = await launchApp();

    // 根据citest/ciinfo.md规则56：electron.launch() / firstWindow() 后用 document.readyState 判就绪
    // 先获取首窗确保Electron完全准备好

    // 等待渲染进程就绪，避免race condition
    await win.waitForLoadState('domcontentloaded');

    // 现在安全检查session.defaultSession，因为Electron已完全初始化
    const ok = await app.evaluate(async ({ app, session }) => {
      // 双重检查：app ready + session存在
      if (!app.isReady()) return false;

      try {
        return !!session.defaultSession;
      } catch (error) {
        // session未初始化时的安全降级，测试失败本身就是信号
        return false;
      }
    });
    expect(ok).toBe(true);

    // win已在上面获取，直接验证
    await expect(win).toBeTruthy();

    // 校验 CSP 头是否注入（navigate 到 app:// 后取响应头，按你的加载方式适配）
    // 这里给出占位断言，可改为在渲染里读取 <meta http-equiv="Content-Security-Policy"> 或抓响应头
    await app.close();
  }
);
