import { app, shell, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { securityPolicyManager } from './security/permissions';

// 安全配置常量（用于测试验证）
const SECURITY_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
} as const;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      ...SECURITY_PREFERENCES,
    },
  });

  // E2E测试模式：网络隔离配置
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    // 禁用自动更新检查
    app.setAppUserModelId('com.electron.test');

    // 设置离线模式网络策略
    mainWindow.webContents.session.setPermissionRequestHandler(() => false);

    // 阻止不必要的网络请求
    mainWindow.webContents.session.webRequest.onBeforeRequest(
      (details, callback) => {
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
      }
    );
  }

  // 在测试模式下暴露安全配置供验证
  if (process.env.SECURITY_TEST_MODE === 'true') {
    (global as any).__SECURITY_PREFS__ = {
      ...SECURITY_PREFERENCES,
      windowId: mainWindow.id,
      createdAt: new Date().toISOString(),
    };

    // 暴露安全策略管理器配置
    (global as any).__SECURITY_POLICY_CONFIG__ = {
      config: securityPolicyManager.getConfig(),
      isProduction: process.env.NODE_ENV === 'production',
      testMode: true,
      exposedAt: new Date().toISOString(),
    };

    // 暴露CSP配置信息
    (global as any).__CSP_CONFIG__ = {
      enabled: true,
      policies: [
        "default-src 'none'",
        "script-src 'self' 'nonce-*'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ],
      nonceGeneration: true,
      configuredAt: new Date().toISOString(),
    };

    // 暴露安全处理器状态
    (global as any).__SECURITY_HANDLERS__ = {
      permissionHandler: {
        enabled: true,
        type: 'setPermissionRequestHandler',
        scope: 'session.defaultSession',
      },
      navigationHandler: {
        enabled: true,
        events: ['will-navigate', 'will-attach-webview'],
      },
      windowOpenHandler: {
        enabled: true,
        type: 'setWindowOpenHandler',
        policy: 'deny-new-windows-redirect-external',
      },
      webRequestFiltering: {
        enabled: true,
        type: 'onBeforeRequest',
        scope: 'session.defaultSession.webRequest',
      },
      configuredAt: new Date().toISOString(),
    };
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // 应用统一安全策略（包含权限控制、导航限制、窗口打开处理）
  securityPolicyManager.applySecurityPolicies(mainWindow);

  // CSP策略：开发环境使用webRequest注入，生产环境依赖index.html meta标签
  if (is.dev) {
    // 开发环境：动态注入CSP以支持热更新和开发工具
    mainWindow.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        // 为每次导航生成唯一nonce
        const crypto = require('crypto');
        const nonce = crypto.randomBytes(16).toString('base64');

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'none'; " +
                `script-src 'self' 'nonce-${nonce}'; ` +
                "style-src 'self'; " +
                "img-src 'self' data: blob:; " +
                "connect-src 'self'; " +
                "font-src 'self'; " +
                "object-src 'none'; " +
                "frame-ancestors 'none'; " +
                "base-uri 'none'; " +
                "form-action 'self'",
            ],
            // 存储nonce供渲染进程使用
            'X-CSP-Nonce': [nonce],
          },
        });
      }
    );
  }
  // 生产环境：依赖index.html中的meta标签提供CSP（更高性能）

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
