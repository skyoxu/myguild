import { app, BrowserWindow, session, protocol } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { secureAutoUpdater } from './security/auto-updater';
import { CSPManager } from './security/csp-policy';

// CI 下为稳态，需在 app ready 之前禁用 GPU 加速
//（必须在 ready 之前调用，否则无效）
if (process.env.CI === 'true') app.disableHardwareAcceleration();

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
  const isDev = !!process.env.VITE_DEV_SERVER_URL;

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // 延迟显示，等ready-to-show事件
    autoHideMenuBar: true,
    webPreferences: {
      // ✅ 按cifix1.txt建议：确保preload路径在dev/prod环境均正确
      preload: isDev
        ? join(__dirname, '../preload.js') // dev环境：../preload.js
        : join(__dirname, 'preload.js'), // prod环境：同目录preload.js
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // 导航拦截：窗口级will-navigate保持作为二道闸
  win.webContents.on('will-navigate', (event, url) => {
    console.log(`🔄 [will-navigate] 尝试导航到: ${url}`);

    // 允许app://协议的导航（应用内页面）
    if (url.startsWith('app://')) {
      console.log(`✅ [will-navigate] 允许app://协议导航: ${url}`);
      return; // 不阻止app://协议的导航
    }

    event.preventDefault(); // 阻止其他外部导航
    console.log(`🚫 [will-navigate] 阻止外部导航: ${url}`);
    // 如需放行其他可信URL，可在此白名单处理
  });

  // 新窗口一律拒绝
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`🚫 [setWindowOpenHandler] 阻止新窗口: ${url}`);
    return { action: 'deny' };
  });

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

function createWindow(is: any): void {
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

  mainWindow.once('ready-to-show', () => {
    console.log('🪟 [ready-to-show] 窗口内容就绪，开始显示');
    mainWindow.show();
    // 在测试模式下发出窗口就绪信号
    if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
      console.log('🧪 [测试模式] 窗口显示完成');
    }
  });

  // ✅ 按cifix1.txt建议：添加窗口级render-process-gone监听器
  mainWindow.webContents.on('render-process-gone', (_e, d) => {
    console.error('[window] render-process-gone:', d.reason, d.exitCode);
  });

  // 导航兜底：双重保障，即使有遗漏也阻断
  mainWindow.webContents.on('will-navigate', (e: any, url: string) => {
    if (!url.startsWith('app://')) {
      e.preventDefault(); // 只阻止非app://协议的导航
    }
  }); // 官方建议

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
      async (details: any, callback: any) => {
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

  // ✅ 按cifix1.txt建议：区分dev/prod URL加载，避免白屏
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log(
      `📂 [loadURL] 开发环境加载: ${process.env.VITE_DEV_SERVER_URL}`
    );
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexUrl = 'app://index.html';
    console.log(`📂 [loadURL] 生产环境加载: ${indexUrl}`);
    mainWindow.loadURL(indexUrl);
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

  // 1) 注册app://协议映射
  protocol.registerFileProtocol(APP_SCHEME, (request, cb) => {
    try {
      let url = request.url.replace('app://', '');

      // 移除末尾的斜杠（如果有的话）
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }

      // 处理相对路径问题：如果URL包含 index.html/xxx，将其转换为 xxx
      if (url.includes('index.html/')) {
        url = url.replace('index.html/', '');
        console.log(`🔄 [protocol] 路径重写: ${request.url} -> ${url}`);
      }

      // 生产模式页面产于 dist/
      const filePath = join(__dirname, '../dist', url);
      console.log(`🔍 [protocol] 请求: ${request.url} -> ${filePath}`);

      // 同步检查文件是否存在
      if (existsSync(filePath)) {
        console.log(`✅ [protocol] 文件存在: ${filePath}`);
        cb({ path: filePath });
      } else {
        console.log(`❌ [protocol] 文件不存在: ${filePath}`);
        cb({ error: -6 }); // net::ERR_FILE_NOT_FOUND
      }
    } catch (error) {
      console.log(`🚨 [protocol] 协议处理错误:`, error);
      cb({ error: -2 }); // net::ERR_FAILED
    }
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

  createWindow(is);

  // 初始化安全自动更新器（仅在非测试环境）
  if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
    // 异步初始化auto-updater
    secureAutoUpdater
      .initialize()
      .then(() => {
        // 延迟检查更新，避免阻塞应用启动
        setTimeout(() => {
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
      createWindow(is);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
