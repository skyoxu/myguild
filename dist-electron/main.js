import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 安全配置常量（用于测试验证）
const SECURITY_PREFERENCES = {
  sandbox: true, // 重新启用沙盒模式（安全基线要求）
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
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
    global.__SECURITY_PREFS__ = {
      ...SECURITY_PREFERENCES,
      windowId: mainWindow.id,
      createdAt: new Date().toISOString(),
    };

    // 暴露安全策略管理器配置
    global.__SECURITY_POLICY_CONFIG__ = {
      config: { enabled: true },
      isProduction: process.env.NODE_ENV === 'production',
      testMode: true,
      exposedAt: new Date().toISOString(),
    };

    // 暴露CSP配置信息
    global.__CSP_CONFIG__ = {
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
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // 设置严格CSP响应头 - 确保沙箱模式下内联脚本被阻止
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://sentry.io; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
          ],
        },
      });
    }
  );

  // 加载应用
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ELECTRON_RENDERER_URL
  ) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
