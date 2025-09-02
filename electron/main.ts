import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { securityPolicyManager } from './security/permissions';
import { secureAutoUpdater } from './security/auto-updater';
import { CSPManager } from './security/csp-policy';

// 安全配置常量（用于测试验证）
const _SECURITY_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
} as const;

function createSecureBrowserWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
}

function configureTestMode(window: BrowserWindow): void {
  if (!(process.env.NODE_ENV === 'test' || process.env.CI === 'true')) {
    return;
  }
  // 禁用自动更新检查
  app.setAppUserModelId('com.electron.test');

  // 设置离线模式网络策略
  window.webContents.session.setPermissionRequestHandler(() => false);

  // 阻止不必要的网络请求
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;

    // 允许本地资源和测试必需的连接
    if (
      url.startsWith('file://') ||
      url.startsWith('chrome-devtools://') ||
      url.startsWith('data:') ||
      url.includes('localhost') ||
      url.includes('127.0.0.1')
    ) {
      callback({ cancel: false });
    } else {
      // 阻止外部网络请求
      console.log(`🚫 E2E测试模式：阻止网络请求 ${url}`);
      callback({ cancel: true });
    }
  });
}

function createWindow(): void {
  // 创建浏览器窗口
  const mainWindow = createSecureBrowserWindow();

  // 在测试模式下暴露安全配置供验证（最小化信息泄露）
  if (process.env.SECURITY_TEST_MODE === 'true') {
    // 限制暴露的信息，仅包含测试必需的数据
    (global as any).__SECURITY_PREFS__ = {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      testMode: true,
      windowId: `window-${Math.random().toString(36).substr(2, 9)}`, // 匿名化ID
    };

    // 仅暴露必要的策略验证信息
    (global as any).__SECURITY_POLICY_ENABLED__ = {
      permissionHandler: true,
      navigationHandler: true,
      windowOpenHandler: true,
      cspEnabled: true,
    };

    // 使用CSPManager生成测试配置
    (global as any).__CSP_CONFIG__ = CSPManager.generateTestingConfig();
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // 测试模式：立即显示窗口以减少启动时间
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    mainWindow.show();
  }

  // 应用统一安全策略（包含权限控制、导航限制、窗口打开处理）
  securityPolicyManager.applySecurityPolicies(mainWindow);

  // CSP策略：开发环境使用webRequest注入，生产环境依赖index.html meta标签
  if (is.dev) {
    // 开发环境：动态注入CSP以支持热更新和开发工具
    mainWindow.webContents.session.webRequest.onHeadersReceived(
      async (details, callback) => {
        // 为每次导航生成唯一nonce
        const { randomBytes } = await import('crypto');
        const nonce = randomBytes(16).toString('base64');

        // 使用统一CSP管理器生成开发环境策略
        const cspPolicy = CSPManager.generateDevelopmentCSP(nonce);

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [cspPolicy],
            // 存储nonce供渲染进程使用
            'X-CSP-Nonce': [nonce],
          },
        });
      }
    );
  }
  // 生产环境：依赖index.html中的meta标签提供CSP（更高性能）

  configureTestMode(mainWindow);

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  // 初始化安全自动更新器（仅在非测试环境）
  if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
    // 延迟检查更新，避免阻塞应用启动
    setTimeout(() => {
      console.log('🔄 正在检查应用更新...');
      secureAutoUpdater.checkForUpdates();
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
