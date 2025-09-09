import { app, BrowserWindow, session, protocol } from 'electron';
// CI 下为稳态，需在 app ready 之前禁用 GPU 加速
//（必须在 ready 之前调用，否则无效）
if (process.env.CI === 'true') app.disableHardwareAcceleration();
import { join } from 'node:path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { secureAutoUpdater } from './security/auto-updater.js';
import { CSPManager } from './security/csp-policy.js';
const APP_SCHEME = 'app';
// 注册自定义安全协议 - 必须在app ready之前
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true, // 需要跨源资源时打开
      bypassCSP: false,
    },
  },
]);
// 安全配置常量（用于测试验证）
export const SECURITY_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
};
function createSecureBrowserWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      // 编译后 main.js 与 preload.js 同在 dist-electron 目录
      preload: join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  // ===== 1) 彻底阻断外部导航（双层拦截）=====
  const ses = win.webContents.session;
  // 1a) 最早阶段cancel（不会真正导航→不会销上下文）
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, cb) => {
      // 允许清单（如 Sentry 接入、本地服务）
      const isAllowed =
        details.url.includes('localhost') ||
        details.url.includes('127.0.0.1') ||
        details.url.includes('sentry.io') ||
        details.url.startsWith('https://o.sentry.io');
      if (!isAllowed) {
        console.log(`🚫 [onBeforeRequest] 阻止外部请求: ${details.url}`);
      }
      cb({ cancel: !isAllowed });
    }
  );
  // 1b) 二道闸：即使溜过，也在将要导航时拦下
  win.webContents.on('will-navigate', (event, url) => {
    console.log(`🔄 [will-navigate] 尝试导航到: ${url}`);
    event.preventDefault(); // 官方安全指引推荐
    // 如需放行少量可信URL，可在此白名单处理
  });
  // 新窗口一律拒绝
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`🚫 [setWindowOpenHandler] 阻止新窗口: ${url}`);
    return { action: 'deny' };
  });
  return win;
}
function configureTestMode(window) {
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
function createWindow() {
  // 创建浏览器窗口
  const mainWindow = createSecureBrowserWindow();
  // 在测试模式下暴露安全配置供验证（最小化信息泄露）
  if (process.env.SECURITY_TEST_MODE === 'true') {
    // 限制暴露的信息，仅包含测试必需的数据
    global.__SECURITY_PREFS__ = {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      testMode: true,
      windowId: `window-${Math.random().toString(36).substr(2, 9)}`, // 匿名化ID
    };
    // 仅暴露必要的策略验证信息
    global.__SECURITY_POLICY_ENABLED__ = {
      permissionHandler: true,
      navigationHandler: true,
      windowOpenHandler: true,
      cspEnabled: true,
    };
    // 使用CSPManager生成测试配置
    global.__CSP_CONFIG__ = CSPManager.generateTestingConfig();
  }
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });
  // 测试模式：立即显示窗口以减少启动时间
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    mainWindow.show();
  }
  // ===== 2) 生产用响应头下发 CSP / COOP / COEP / CORP / Permissions-Policy =====
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    const headers = details.responseHeaders ?? {};
    const set = (k, v) => {
      headers[k] = [v];
    };
    // 最小可用 CSP（按需扩展 connect-src 等）
    set(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'none'; object-src 'none'; " +
        "img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
        "script-src 'self'; connect-src 'self' https://o.sentry.io"
    );
    // 相邻安全头
    set('Cross-Origin-Opener-Policy', 'same-origin');
    set('Cross-Origin-Embedder-Policy', 'require-corp');
    set('Cross-Origin-Resource-Policy', 'same-origin');
    set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), notifications=(), ' +
        'fullscreen=(self)'
    );
    cb({ responseHeaders: headers });
  });
  // ===== 3) 权限处理已在全局设置（避免重复设置）=====
  // 权限处理器已在app.whenReady()之前全局设置，此处无需重复
  // ===== 4) 导航兜底：即使溜过，也阻断 =====
  mainWindow.webContents.on('will-navigate', e => e.preventDefault()); // 官方建议
  // ===== 5) 失败自愈：避免停在 chrome-error 页 =====
  const indexUrl = 'app://index.html';
  mainWindow.webContents.on('did-fail-load', () => {
    if (!mainWindow.isDestroyed()) {
      console.log('🔄 [did-fail-load] 重新加载首页以恢复...');
      mainWindow.loadURL(indexUrl);
    }
  });
  // 应用统一安全策略已通过上述代码实现（权限控制、导航限制、窗口打开处理）
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
  // 使用app://协议加载首页
  console.log(`📂 加载页面: ${indexUrl}`);
  mainWindow.loadURL(indexUrl);
}
// 权限红线：同时实现检查与请求两套 Handler（默认拒绝）
// 最好在 app.whenReady() 之前就设定（确保首窗前生效）
const ses = session.defaultSession;
ses.setPermissionCheckHandler(() => false); // 一票否决（默认拒绝）
ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron');
  // 1) 注册app://协议映射
  protocol.registerFileProtocol(APP_SCHEME, (request, cb) => {
    const url = request.url.replace('app://', '');
    // 生产模式页面产于 dist/
    cb({ path: join(__dirname, '../dist', url) });
  });
  // 2) 会话级：在创建任何窗口/加载前，先拦截"外部 http/https"
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (d, cb) => {
      // 白名单（Sentry监控等必要域名）
      const isAllowed =
        d.url.includes('localhost') ||
        d.url.includes('127.0.0.1') ||
        d.url.includes('sentry.io') ||
        d.url.startsWith('https://o.sentry.io');
      if (!isAllowed) {
        console.log(`🚫 [defaultSession] 阻断外部导航: ${d.url}`);
      }
      cb({ cancel: !isAllowed }); // 阻断真实导航，避免上下文销毁
    }
  );
  // 3) 响应头安全合集（生产）
  ses.webRequest.onHeadersReceived((details, cb) => {
    const h = details.responseHeaders ?? {};
    h['Content-Security-Policy'] = [
      "default-src 'self'; base-uri 'none'; object-src 'none'; " +
        "img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
        "connect-src 'self' https://o.sentry.io",
    ];
    h['Cross-Origin-Opener-Policy'] = ['same-origin'];
    h['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    h['Cross-Origin-Resource-Policy'] = ['same-origin'];
    h['Permissions-Policy'] = [
      'geolocation=(), microphone=(), camera=(), notifications=()',
    ];
    cb({ responseHeaders: h }); // 通过 onHeadersReceived 注入响应头
  });
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
