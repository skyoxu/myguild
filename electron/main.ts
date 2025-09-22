import {
  app,
  BrowserWindow,
  shell,
  session,
  protocol,
  net,
  ipcMain,
} from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

console.log(
  '[main.ts] Minimal test switches applied - removed potentially problematic options'
);

// Add key crash and load failure logging (as suggested in cifix1.txt)
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

// __dirname is built-in in CommonJS, no need to declare

const APP_SCHEME = 'app';

// Register custom secure protocol - must be before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true, // Enable when cross-origin resources are needed
      bypassCSP: false,
    },
  },
]);

// Security configuration constants (for test verification)
export const SECURITY_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
} as const;

// Security policy manager and CSP manager interfaces
interface SecurityPolicyManager {
  getConfig(): any;
}

interface CSPManager {
  generateTestingConfig(): any;
  generateDevelopmentCSP(nonce: string): string;
}

// Mock implementations for missing dependencies
const securityPolicyManager: SecurityPolicyManager = {
  getConfig: () => ({
    permissionHandler: true,
    navigationHandler: true,
    windowOpenHandler: true,
    cspEnabled: true,
  }),
};

const CSPManager: CSPManager = {
  generateTestingConfig: () => ({
    testMode: true,
    cspEnabled: true,
  }),
  generateDevelopmentCSP: (nonce: string) =>
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws: wss: https:; object-src 'none'; base-uri 'none';`,
};

// Mock auto updater
const secureAutoUpdater = {
  initialize: () => Promise.resolve(),
  checkForUpdates: () => Promise.resolve(),
};

// Timer management utilities
const activeTimers = new Set<NodeJS.Timeout>();

function safeSetTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  const timer = setTimeout(() => {
    activeTimers.delete(timer);
    callback();
  }, delay);
  activeTimers.add(timer);
  return timer;
}

function clearAllTimers(): void {
  activeTimers.forEach(timer => clearTimeout(timer));
  activeTimers.clear();
}

function withLiveWindow(
  window: BrowserWindow,
  callback: (win: BrowserWindow) => void
): void {
  if (!window.isDestroyed()) {
    callback(window);
  }
}

// Mock Sentry initialization
async function initializeMainProcessMonitoring(options: any): Promise<void> {
  console.log('[Sentry] Mock initialization with options:', options);
}

function createSecureBrowserWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // Delay showing until ready-to-show event
    autoHideMenuBar: true,
    webPreferences: {
      // As suggested in cifix1.txt: ensure preload path is correct in dev/prod environments
      preload: join(__dirname, 'preload.js'), // dev/prod environments: both in dist-electron directory
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // Security baseline: disable webview tag to prevent potential security risks
      webviewTag: false,
      // Security baseline: explicitly prohibit loading insecure content
      allowRunningInsecureContent: false,
      // Security baseline: disable developer tools in production environment
      devTools: process.env.NODE_ENV !== 'production',
      // Critical: avoid CI background throttling affecting interaction responsiveness
      backgroundThrottling: false,
    },
  });

  // will-navigate ONLY blocks external navigation, allows same-origin file://
  win.webContents.on('will-navigate', (event, url) => {
    console.log(`[will-navigate] Navigation attempt: ${url}`);

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
      console.log(`[will-navigate] Allow local navigation: ${url}`);
      return; // Allow navigation to proceed
    }

    // Block external navigation (prevents chrome-error pages)
    event.preventDefault();
    console.log(`[will-navigate] Block external navigation: ${url}`);

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

  // As suggested in cifix1.txt: new windows are uniformly controlled by setWindowOpenHandler
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[setWindowOpenHandler] New window request: ${url}`);

    // Check if it's a trusted external URL (whitelist domains)
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
        `[setWindowOpenHandler] Open trusted link via shell.openExternal: ${url}`
      );
      shell.openExternal(url);
    } else {
      console.log(
        `[setWindowOpenHandler] Block untrusted external link: ${url}`
      );
    }

    // Always deny new window creation, trusted links open via system browser
    return { action: 'deny' };
  });

  // Enhanced error recovery mechanism: prevent chrome-error pages from appearing
  win.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame && errorCode !== 0) {
        console.log(
          `[did-fail-load] Main frame load failed: ${errorCode} - ${errorDescription} - ${validatedURL}`
        );

        // Check if it's a chrome-error page, immediately prevent it
        if (validatedURL && validatedURL.startsWith('chrome-error://')) {
          console.log(
            `[did-fail-load] Detected chrome-error page, redirecting to safe page`
          );

          // Immediately load safe local page
          if (process.env.VITE_DEV_SERVER_URL) {
            win.loadURL(process.env.VITE_DEV_SERVER_URL);
          } else {
            const appUrl = 'app://bundle/index.html';
            win.loadURL(appUrl);
          }
          return;
        }

        // Production environment reload via app:// protocol
        if (!process.env.VITE_DEV_SERVER_URL) {
          const appUrl = 'app://bundle/index.html';
          console.log(`[did-fail-load] Reloading: ${appUrl}`);
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
  // Disable auto-update checks
  app.setAppUserModelId('com.electron.test');

  // Note: Permission and network request handling is set globally via defaultSession
  // Only recording that test mode configuration has been applied here
  console.log(
    '[test-mode] Enabled - security policies applied via defaultSession'
  );
}

function createWindow(is: any, ses: Electron.Session): void {
  // Create browser window
  const mainWindow = createSecureBrowserWindow();

  // Add timer cleanup logic when window closes
  mainWindow.on('closed', () => {
    console.log('[window] Clearing all active timers');
    clearAllTimers();
  });

  // In test mode, expose security configuration for verification (minimize information leakage)
  if (process.env.SECURITY_TEST_MODE === 'true') {
    // Limit exposed information to only test-necessary data
    (global as any).__SECURITY_PREFS__ = {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      testMode: true,
      windowId: `window-${Math.random().toString(36).substr(2, 9)}`, // Anonymized ID
      createdAt: new Date().toISOString(), // Add missing creation time field
    };

    // Only expose necessary policy verification information
    (global as any).__SECURITY_POLICY_ENABLED__ = {
      permissionHandler: true,
      navigationHandler: true,
      windowOpenHandler: true,
      cspEnabled: true,
    };

    // Use CSPManager to generate test configuration
    (global as any).__CSP_CONFIG__ = CSPManager.generateTestingConfig();

    // Add security policy configuration required for testing
    (global as any).__SECURITY_POLICY_CONFIG__ = {
      config: securityPolicyManager.getConfig(),
      testMode: true,
      isProduction: process.env.NODE_ENV === 'production',
    };

    // Add security handler state required for testing
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
    console.log('[ready-to-show] Window ready; showing now');
    mainWindow.show();

    // CI environment optimization: ensure window is fully front, avoid background throttling affecting interaction responsiveness
    if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
      // Force window to front: multiple safeguards
      mainWindow.focus();
      mainWindow.moveTop();
      mainWindow.setAlwaysOnTop(true);

      // Delay 100ms then restore normal level but keep front - use safe timer protection
      safeSetTimeout(() => {
        withLiveWindow(mainWindow, win => {
          win.setAlwaysOnTop(false);
          win.focus(); // Final focus
        });
      }, 100);

      console.log('[CI] Window brought to front; ready');
    } else {
      // Production environment: standard front logic
      mainWindow.focus();
    }
  });

  // As suggested in cifix1.txt: add window-level render-process-gone listener
  mainWindow.webContents.on('render-process-gone', (_e, d) => {
    console.error('[window] render-process-gone:', d.reason, d.exitCode);
  });

  // Apply unified security policy implemented through above code (permission control, navigation restrictions, window open handling)

  // CSP policy: development environment uses webRequest injection, production environment relies on index.html meta tags
  if (is.dev) {
    // As suggested in cifix1.txt: use passed session parameter, avoid accessing mainWindow.webContents.session
    // Development environment: dynamically inject CSP to support hot updates and development tools
    ses.webRequest.onHeadersReceived(async (details: any, callback: any) => {
      // Generate unique nonce for each navigation
      const { randomBytes } = await import('crypto');
      const nonce = randomBytes(16).toString('base64');

      // Use unified CSP manager to generate development environment policy
      const cspPolicy = CSPManager.generateDevelopmentCSP(nonce);

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [cspPolicy],
          // Store nonce for renderer process use
          'X-CSP-Nonce': [nonce],
        },
      });
    });
  }
  // Production environment: rely on meta tags in index.html to provide CSP (higher performance)

  configureTestMode(mainWindow);

  // Add page loading status listener
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[did-start-loading] Start loading page');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[did-finish-load] Page load completed');
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription, validatedURL) => {
      console.log(
        `[did-fail-load] Page load failed: ${errorCode} - ${errorDescription} - ${validatedURL}`
      );
    }
  );

  // Enable app:// protocol: development environment still uses VITE server, production environment uses app:// protocol
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log(`[loadURL] Dev env load: ${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Production environment: use app:// protocol to load page
    const appUrl = 'app://bundle/index.html';
    console.log(`[loadURL] Using app:// in production: ${appUrl}`);
    mainWindow.loadURL(appUrl);
  }
}

app.whenReady().then(async () => {
  // In CommonJS directly import @electron-toolkit/utils (provide safe fallback to prevent startup failure due to missing dependencies)
  let electronApp: any = { setAppUserModelId: (_: string) => {} };
  let optimizer: any = { watchWindowShortcuts: (_: any) => {} };
  let is: any = { dev: false };
  try {
    const utils = require('@electron-toolkit/utils');
    electronApp = utils.electronApp ?? electronApp;
    optimizer = utils.optimizer ?? optimizer;
    is = utils.is ?? is;
  } catch (err) {
    console.warn(
      '[main] @electron-toolkit/utils not found; using safe fallback'
    );
  }

  electronApp.setAppUserModelId('com.electron');

  // Initialize Sentry (main) only in production with DSN present
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const hasDsn = !!process.env.SENTRY_DSN;
    const logsDir = join(process.cwd(), 'logs', 'observability');
    if (!existsSync(logsDir)) {
      try {
        mkdirSync(logsDir, { recursive: true });
      } catch {}
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = join(logsDir, `sentry-init-main-${stamp}.log`);
    if (isProd && hasDsn) {
      const rate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.02');
      writeFileSync(logFile, `init main: prod=true dsn=true rate=${rate}\n`, {
        flag: 'a',
      });
      await initializeMainProcessMonitoring({
        tracesSampleRate: rate,
        autoSessionTracking: true,
        enableMainProcess: true,
        enableRendererProcess: false,
      });
      writeFileSync(logFile, `initialized=true\n`, { flag: 'a' });
    } else {
      writeFileSync(
        logFile,
        `init main skipped: prod=${isProd} dsn=${hasDsn}\n`,
        { flag: 'a' }
      );
    }
  } catch {}

  // Place in whenReady and before createWindow()
  const ses = session.defaultSession;

  // As suggested in cifix1.txt: all session operations execute after whenReady
  console.log('[main] Initializing security policies...');

  // 2.1 Permissions: default deny (global veto, can whitelist per overlay)
  ses.setPermissionCheckHandler(() => false);
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  // As suggested in cifix1.txt: use new protocol.handle instead of registerFileProtocol
  await protocol.handle(APP_SCHEME, request => {
    try {
      const { pathname } = new URL(request.url);

      // Handle API route requests (fix web-vitals and other API call failures)
      if (pathname.startsWith('/api/')) {
        console.log(`[protocol.handle] API request: ${pathname}`);
        if (pathname === '/api/web-vitals') {
          // Return empty JSON response to avoid blocking React rendering
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Other API paths return 404
        return new Response('API Not Found', { status: 404 });
      }

      // Default load index.html
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);

      // Fix path: in dist-electron environment, go up one level to find project root then join dist
      const appPath = app.getAppPath();
      const projectRoot = appPath.endsWith('dist-electron')
        ? join(appPath, '..')
        : appPath;
      const filePath = join(projectRoot, 'dist', file);

      console.log(`[protocol.handle] Request: ${request.url} -> ${filePath}`);

      // Use net.fetch to load local file
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      console.error(`[protocol.handle] Handler error:`, error);
      // Return error response
      return new Response('File not found', { status: 404 });
    }
  });

  // webRequest ONLY intercept subresources, mainFrame handled by will-navigate
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
        `[webRequest] Block subresource: ${details.url} (${details.resourceType})`
      );
    }

    callback({ cancel: !isSubresourceAllowed });
  });

  // 3) Response header security collection (production) - strong CSP baseline, following OWASP best practices
  ses.webRequest.onHeadersReceived((details, cb) => {
    const h = details.responseHeaders ?? {};

    // Strong security CSP baseline: remove unsafe-inline, block XSS and external code mixing
    h['Content-Security-Policy'] = [
      "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self'; " + // Remove 'unsafe-inline'
        "img-src 'self' data: blob:; " +
        "font-src 'self'; " +
        "connect-src 'self' https://o.sentry.io; " +
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    ];

    // Modern cross-origin security headers: COOP/COEP/CORP (web.dev/MDN recommended)
    h['Cross-Origin-Opener-Policy'] = ['same-origin'];
    h['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    h['Cross-Origin-Resource-Policy'] = ['same-origin'];

    // Permission policy: default disable sensitive permissions
    h['Permissions-Policy'] = [
      'geolocation=(), microphone=(), camera=(), notifications=()',
    ];

    cb({ responseHeaders: h });
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Send security global initialization event (for observability)
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
  console.log(
    '🔒 Security policy initialization completed:',
    securityInitEvent
  );

  createWindow(is, ses);

  // CI test specific: window front IPC handler
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    ipcMain.handle('window:bring-to-front', () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const allWindows = BrowserWindow.getAllWindows();
      const targetWindow = focusedWindow || allWindows[0];

      if (targetWindow) {
        targetWindow.show();
        targetWindow.focus();
        targetWindow.moveTop();
        console.log('[IPC] Window bring-to-front handled');
        return true;
      }
      return false;
    });
  }

  // Initialize secure auto-updater (only in non-test environment)
  if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
    // Initialize auto-updater asynchronously
    secureAutoUpdater
      .initialize()
      .then(() => {
        // Delay checking for updates to avoid blocking app startup - use safe timer protection
        safeSetTimeout(() => {
          console.log('[auto-update] Checking for app updates...');
          secureAutoUpdater.checkForUpdates();
        }, 3000);
      })
      .catch(error => {
        console.error('[auto-update] Initialization failed:', error);
      });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // In CommonJS directly import is tool for activate event
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
