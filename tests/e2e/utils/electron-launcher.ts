import path from 'node:path';
import { launchApp } from '../../helpers/launch';

/**
 * 跨平台Electron应用启动器 - 官方API模式
 * 基于ADR-0002 Electron安全基线和ADR-0005质量门禁
 *
 * 功能特性：
 * - 使用官方_electron.launch() API
 * - Windows兼容性优化（沙箱配置）
 * - 统一的启动参数管理
 * - 可扩展的命令行参数注入
 */

/**
 * 启动打包后的Electron应用
 * @param extraArgs 额外的命令行参数，可从调用者注入
 * @returns ElectronApplication实例
 */
export async function launchApp(
  extraArgs: string[] = []
): Promise<ElectronApplication> {
  const appEntry = path.resolve(__dirname, '../../../dist-electron/main.js');

  return electron.launch({
    args: [appEntry, ...extraArgs],
    timeout: 30000, // 30秒启动超时

    // Windows兼容性配置
    env: {
      ...process.env,
      // Windows需要此配置避免Chrome沙箱问题
      ELECTRON_DISABLE_SANDBOX: 'true',
      // 测试模式标识
      NODE_ENV: 'test',
      // 禁用GPU加速（CI环境兼容）
      ELECTRON_DISABLE_GPU: 'true',
    },

    // 开发调试选项（仅非CI环境）
    ...(process.env.CI
      ? {}
      : {
          headless: false,
          devtools: true,
        }),
  });
}

/**
 * 启动应用并等待主窗口就绪
 * @param extraArgs 额外的命令行参数
 * @returns Promise<{ app: ElectronApplication, window: Page }>
 */
export async function launchAppWithWindow(extraArgs: string[] = []) {
  const app = await launchApp(extraArgs);
  const window = await app.firstWindow({
    timeout: 15000,
  });

  // 等待页面完全加载
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

/**
 * 测试环境专用启动器 - 安全优化
 * @param extraArgs 额外参数
 */
export async function launchAppForSecurity(
  extraArgs: string[] = []
): Promise<ElectronApplication> {
  return launchApp([
    '--test-mode',
    '--enable-features=ElectronSerialChooser',
    '--disable-features=VizDisplayCompositor',
    ...extraArgs,
  ]);
}

/**
 * 性能测试专用启动器
 * @param extraArgs 额外参数
 */
export async function launchAppForPerformance(
  extraArgs: string[] = []
): Promise<ElectronApplication> {
  return launchApp([
    '--disable-web-security', // 仅测试环境
    '--disable-extensions',
    '--disable-default-apps',
    '--test-mode',
    ...extraArgs,
  ]);
}
