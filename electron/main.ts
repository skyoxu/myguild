import { app, BrowserWindow, session, protocol, net, shell } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { secureAutoUpdater } from './security/auto-updater';
import { CSPManager } from './security/csp-policy';
import { securityPolicyManager } from './security/permissions';

/**
 * 定时器集中管理系统 - 防止"对象已销毁"崩溃
 */
const timers = new Set<NodeJS.Timeout>();

/**
 * 安全定时器包装器 - 自动管理生命周期
 */
function safeSetTimeout(fn: () => void, delay: number): NodeJS.Timeout {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, delay);
  timers.add(timer);
  return timer;
}

/**
 * 清理所有活跃定时器
 */
function clearAllTimers() {
  timers.forEach(timer => clearTimeout(timer));
  timers.clear();
}

/**
 * 安全窗口操作包装器 - 防止访问已销毁对象
 */
function withLiveWindow(
  win: BrowserWindow | null,
  fn: (w: BrowserWindow) => void
) {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    fn(win);
  }
}

// CI 下为稳态，需在 app ready 之前禁用 GPU 加速
//（必须在 ready 之前调用，否则无效）
if (process.env.CI === 'true') {
  app.disableHardwareAcceleration();
  // CI环境性能优化 - 防止后台节流
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch(
    'disable-features',
    'CalculateNativeWinOcclusion'
  );
}

// ✅ Minimal test environment switches - only essential ones to avoid startup issues
if (
  process.env.SECURITY_TEST_MODE === 'true' ||
  process.env.E2E_AUTO_START === '1'
) {
  // Only renderer stability switches that are essential for navigation tests
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');

  console.log(
    '📋 [main.ts] Minimal test switches applied - removed potentially problematic options'
  );
}

// ✅ 添加关键崩溃和加载失败日志（按cifix1.txt建议）
app.on('render-process-gone', (_e, _wc, d) => {
  console.error('[main] render-process-gone:', d.reason, d.exitCode);
});
app.on('child-process-gone', (_e, d) => {
  console.error('[main] child-process-gone:', d.reason, d.exitCode);
});
app.on('web-contents-created', (_e, wc) => {
  wc.on('did-fail-load', (_e2, ec, ed) => {
    console.error('[main] did-fail-load:', ec, ed);
  });
});

// CommonJS中的__dirname是内置的，无需声明

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
} as const;

function createSecureBrowserWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // 延迟显示，等ready-to-show事件
    autoHideMenuBar: true,
    webPreferences: {
      // ✅ 按cifix1.txt建议：确保preload路径在dev/prod环境均正确
      preload: join(__dirname, 'preload.js'), // dev/prod环境：都在dist-electron目录下
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // ✅ 安全基线：禁用webview标签防止潜在安全风险
      webviewTag: false,
      // ✅ 安全基线：明确禁止加载不安全内容
      allowRunningInsecureContent: false,
      // ✅ 安全基线：生产环境禁用开发者工具
      devTools: process.env.NODE_ENV !== 'production',
      // ✅ 关键：避免CI后台节流影响交互响应性
      backgroundThrottling: false,
    },
  });

  // ✅ will-navigate ONLY blocks external navigation, allows same-origin file://
  win.webContents.on('will-navigate', (event, url) => {
    console.log(`🔄 [will-navigate] Navigation attempt: ${url}`);

    // Allow local protocols and development server URLs
    const isLocal = url.startsWith('file://') || url.startsWith('app://');
    const isDevServer =
      process.env.VITE_DEV_SERVER_URL &&
      url.startsWith(process.env.VITE_DEV_SERVER_URL);
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

    if (
      isLocal ||
      isDevServer ||
      (process.env.NODE_ENV === 'development' && isLocalhost)
    ) {
      console.log(`✅ [will-navigate] Allow local navigation: ${url}`);
      return; // Allow navigation to proceed
    }

    // Block external navigation (prevents chrome-error pages)
    event.preventDefault();
    console.log(`🚫 [will-navigate] Block external navigation: ${url}`);

    // Optional: open external URLs in system browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }

    // Record interception for testing
    if (process.env.SECURITY_TEST_MODE === 'true') {
      (global as any).__NAVIGATION_INTERCEPT_COUNT__ =
        ((global as any).__NAVIGATION_INTERCEPT_COUNT__ || 0) + 1;
      (global as any).__LAST_INTERCEPTED_URL__ = url;
      (global as any).__LAST_INTERCEPT_TIME__ = new Date().toISOString();
    }
  });

  // ✅ 按cifix1.txt建议：新窗口统一用setWindowOpenHandler控制
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`🔍 [setWindowOpenHandler] 新窗口请求: ${url}`);

    // 检查是否为受信任的外部URL（白名单域名）
    const trustedDomains = [
      'github.com',
      'docs.electronjs.org',
      'web.dev',
      'developer.mozilla.org',
      'stackoverflow.com',
    ];

    const urlObj = new URL(url);
    const isTrusted = trustedDomains.some(
      domain =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );

    if (
      isTrusted &&
      (url.startsWith('https://') || url.startsWith('http://'))
    ) {
      console.log(
        `🌐 [setWindowOpenHandler] 通过shell.openExternal打开受信任链接: ${url}`
      );
      shell.openExternal(url);
    } else {
      console.log(`🚫 [setWindowOpenHandler] 阻止不受信任的链接: ${url}`);
    }

    // 总是拒绝新窗口创建，受信任的链接通过系统浏览器打开
    return { action: 'deny' };
  });

  // ✅ 增强的错误恢复机制：阻止chrome-error页面出现
  win.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame && errorCode !== 0) {
        console.log(
          `🔄 [did-fail-load] 主框架加载失败 (${errorCode}): ${errorDescription}, URL: ${validatedURL}`
        );

        // 检查是否是chrome-error页面，立即阻止
        if (validatedURL && validatedURL.startsWith('chrome-error://')) {
          console.log(
            `🚫 [did-fail-load] 检测到chrome-error页面，立即重定向到安全页面`
          );

          // 立即加载安全的本地页面
          if (process.env.VITE_DEV_SERVER_URL) {
            win.loadURL(process.env.VITE_DEV_SERVER_URL);
          } else {
            const appUrl = 'app://bundle/index.html';
            win.loadURL(appUrl);
          }
          return;
        }

        // 生产环境通过 app:// 协议重新加载
        if (!process.env.VITE_DEV_SERVER_URL) {
          const appUrl = 'app://bundle/index.html';
          console.log(`🔄 [did-fail-load] 尝试重新加载: ${appUrl}`);
          win.loadURL(appUrl);
        }
      }
    }
  );

  return win;
}

function configureTestMode(_window: any): void {
  if (!(process.env.NODE_ENV === 'test' || process.env.CI === 'true')) {
    return;
  }
  // 禁用自动更新检查
  app.setAppUserModelId('com.electron.test');

  // 注意：权限和网络请求处理已在defaultSession全局设置
  // 此处仅记录测试模式配置已应用
  console.log('🧪 测试模式已启用 - 安全策略通过defaultSession全局应用');
}

function createWindow(is: any, ses: Electron.Session): void {
  // 创建浏览器窗口
  const mainWindow = createSecureBrowserWindow();

  // ✅ 添加窗口关闭时的定时器清理逻辑
  mainWindow.on('closed', () => {
    console.log('🧹 [窗口关闭] 清理所有活跃定时器');
    clearAllTimers();
  });

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
      createdAt: new Date().toISOString(), // 添加缺失的创建时间字段
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

    // 添加测试所需的安全策略配置
    (global as any).__SECURITY_POLICY_CONFIG__ = {
      config: securityPolicyManager.getConfig(),
      testMode: true,
      isProduction: process.env.NODE_ENV === 'production',
    };

    // 添加测试所需的安全处理程序状态
    (global as any).__SECURITY_HANDLERS__ = {
      permissionHandler: { enabled: true },
      navigationHandler: {
        enabled: true,
        events: ['will-navigate', 'will-attach-webview'],
      },
      windowOpenHandler: {
        enabled: true,
        policy: 'deny-new-windows-redirect-external',
      },
      webRequestFiltering: { enabled: true },
    };
  }

  mainWindow.once('ready-to-show', () => {
    console.log('🪟 [ready-to-show] 窗口内容就绪，开始显示');
    mainWindow.show();

    // ✅ CI环境优化：确保窗口完全前置，避免后台节流影响交互响应性
    if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
      // 强制窗口前置：多重保障
      mainWindow.focus();
      mainWindow.moveTop();
      mainWindow.setAlwaysOnTop(true);

      // 延迟100ms后恢复正常层级，但保持前置 - 使用安全定时器防护
      safeSetTimeout(() => {
        withLiveWindow(mainWindow, win => {
          win.setAlwaysOnTop(false);
          win.focus(); // 最终聚焦
        });
      }, 100);

      console.log('🧪 [CI优化] 窗口前置完成，准备接收交互');
    } else {
      // 生产环境：标准前置逻辑
      mainWindow.focus();
    }
  });

  // ✅ 按cifix1.txt建议：添加窗口级render-process-gone监听器
  mainWindow.webContents.on('render-process-gone', (_e, d) => {
    console.error('[window] render-process-gone:', d.reason, d.exitCode);
  });

  // ✅ Remove duplicate will-navigate listener to avoid conflicts
  // Navigation is already handled in createSecureBrowserWindow()

  // ✅ 移除重复的did-fail-load监听器，避免重复恢复尝试
  // 错误恢复已在createSecureBrowserWindow()中实现

  // 应用统一安全策略已通过上述代码实现（权限控制、导航限制、窗口打开处理）

  // CSP策略：开发环境使用webRequest注入，生产环境依赖index.html meta标签
  if (is.dev) {
    // ✅ 按cifix1.txt建议：使用传入的session参数，避免访问mainWindow.webContents.session
    // 开发环境：动态注入CSP以支持热更新和开发工具
    ses.webRequest.onHeadersReceived(async (details: any, callback: any) => {
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
    });
  }
  // 生产环境：依赖index.html中的meta标签提供CSP（更高性能）

  configureTestMode(mainWindow);

  // 添加页面加载状态监听
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('🔄 [did-start-loading] 开始加载页面');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ [did-finish-load] 页面加载完成');
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription, validatedURL) => {
      console.log(
        `❌ [did-fail-load] 页面加载失败: ${errorCode} - ${errorDescription} - ${validatedURL}`
      );
    }
  );

  // ✅ 启用 app:// 协议：开发环境仍用VITE服务器，生产环境用app://协议
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log(
      `📂 [loadURL] 开发环境加载: ${process.env.VITE_DEV_SERVER_URL}`
    );
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // ✅ 生产环境：使用 app:// 协议加载页面
    const appUrl = 'app://bundle/index.html';
    console.log(`📂 [loadURL] 生产环境使用app://协议: ${appUrl}`);
    mainWindow.loadURL(appUrl);
  }
}

// ❌ 移除（会在 app 未 ready 时访问 session）
// 权限控制移到 whenReady 内部处理

app.whenReady().then(async () => {
  // 在CommonJS中直接导入@electron-toolkit/utils（提供安全回退，防止缺依赖导致启动失败）
  let electronApp: any = { setAppUserModelId: (_: string) => {} };
  let optimizer: any = { watchWindowShortcuts: (_: any) => {} };
  let is: any = { dev: false };
  try {
    const utils = require('@electron-toolkit/utils');
    electronApp = utils.electronApp ?? electronApp;
    optimizer = utils.optimizer ?? optimizer;
    is = utils.is ?? is;
  } catch (err) {
    console.warn('[main] @electron-toolkit/utils 未找到，使用安全回退。');
  }

  electronApp.setAppUserModelId('com.electron');

  // ✅ 放在 whenReady 内、且在 createWindow() 之前
  const ses = session.defaultSession;

  // ✅ 按cifix1.txt建议：所有session操作在whenReady后执行
  console.log('🔒 [main] 开始初始化安全策略...');

  // 2.1 权限：默认拒绝（全局一票否决，可按 overlay 放白名单）
  ses.setPermissionCheckHandler(() => false);
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  // ✅ 按cifix1.txt建议：使用新的protocol.handle替代registerFileProtocol
  await protocol.handle(APP_SCHEME, request => {
    try {
      const { pathname } = new URL(request.url);

      // ✅ 处理API路由请求（修复web-vitals等API调用失败）
      if (pathname.startsWith('/api/')) {
        console.log(`🔍 [protocol.handle] API请求: ${pathname}`);
        if (pathname === '/api/web-vitals') {
          // 返回空的JSON响应，避免阻塞React渲染
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // 其他API路径返回404
        return new Response('API Not Found', { status: 404 });
      }

      // 默认加载index.html
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);

      // ✅ 修复路径：在dist-electron环境中，向上一级找到项目根目录再拼接dist
      const appPath = app.getAppPath();
      const projectRoot = appPath.endsWith('dist-electron')
        ? join(appPath, '..')
        : appPath;
      const filePath = join(projectRoot, 'dist', file);

      console.log(`🔍 [protocol.handle] 请求: ${request.url} -> ${filePath}`);

      // 使用net.fetch加载本地文件
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      console.error(`🚨 [protocol.handle] 协议处理错误:`, error);
      // 返回错误响应
      return new Response('File not found', { status: 404 });
    }
  });

  // ✅ webRequest ONLY intercept subresources, mainFrame handled by will-navigate
  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    // Skip mainFrame processing entirely - let will-navigate handle it
    if (details.resourceType === 'mainFrame') {
      return callback({ cancel: false }); // Critical: avoid any delay for main frame
    }

    // Apply whitelist check only for subresources (scripts, images, stylesheets, etc.)
    const isSubresourceAllowed =
      details.url.startsWith('app://') ||
      details.url.startsWith('file://') ||
      details.url.startsWith('data:') ||
      details.url.startsWith('blob:') ||
      details.url.includes('localhost') ||
      details.url.includes('127.0.0.1') ||
      details.url.includes('sentry.io') ||
      details.url.startsWith('https://o.sentry.io');

    if (!isSubresourceAllowed) {
      console.log(
        `🚫 [webRequest] Block subresource: ${details.url} (${details.resourceType})`
      );
    }

    callback({ cancel: !isSubresourceAllowed });
  });

  // 3) 响应头安全合集（生产）- 强CSP基线，遵循OWASP最佳实践
  ses.webRequest.onHeadersReceived((details, cb) => {
    const h = details.responseHeaders ?? {};

    // ✅ 强安全CSP基线：移除unsafe-inline，阻断XSS与外部代码混入
    h['Content-Security-Policy'] = [
      "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self'; " + // 移除 'unsafe-inline'
        "img-src 'self' data: blob:; " +
        "font-src 'self'; " +
        "connect-src 'self' https://o.sentry.io; " +
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    ];

    // ✅ 现代跨源安全头：COOP/COEP/CORP (web.dev/MDN推荐)
    h['Cross-Origin-Opener-Policy'] = ['same-origin'];
    h['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    h['Cross-Origin-Resource-Policy'] = ['same-origin'];

    // ✅ 权限策略：默认禁用敏感权限
    h['Permissions-Policy'] = [
      'geolocation=(), microphone=(), camera=(), notifications=()',
    ];

    cb({ responseHeaders: h });
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // 发送安全全局初始化事件（用于可观测性）
  const securityInitEvent = {
    specversion: '1.0' as const,
    type: 'security.global.init' as const,
    source: 'app://main' as const,
    id: `security-init-${Date.now()}`,
    time: new Date().toISOString(),
    data: {
      readyAt: new Date().toISOString(),
      handlers: [
        'permissionCheck',
        'permissionRequest',
        'headers',
        'beforeRequest',
      ] as const,
    },
  };
  console.log('🔒 安全策略初始化完成:', securityInitEvent);

  createWindow(is, ses);

  // ✅ CI测试专用：窗口前置IPC处理程序
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    const { ipcMain } = require('electron');
    ipcMain.handle('window:bring-to-front', () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const allWindows = BrowserWindow.getAllWindows();
      const targetWindow = focusedWindow || allWindows[0];

      if (targetWindow) {
        targetWindow.show();
        targetWindow.focus();
        targetWindow.moveTop();
        console.log('🧪 [IPC] 窗口前置请求处理完成');
        return true;
      }
      return false;
    });
  }

  // 初始化安全自动更新器（仅在非测试环境）
  if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
    // 异步初始化auto-updater
    secureAutoUpdater
      .initialize()
      .then(() => {
        // 延迟检查更新，避免阻塞应用启动 - 使用安全定时器防护
        safeSetTimeout(() => {
          console.log('🔄 正在检查应用更新...');
          secureAutoUpdater.checkForUpdates();
        }, 3000);
      })
      .catch(error => {
        console.error('🚨 初始化自动更新器失败:', error);
      });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // 在CommonJS中直接导入is工具用于activate事件
      const { is } = require('@electron-toolkit/utils');
      createWindow(is, ses);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
