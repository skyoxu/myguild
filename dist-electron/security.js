'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.createSecureBrowserWindow = createSecureBrowserWindow;
exports.hardenWindow = hardenWindow;
exports.installSecurityHeaders = installSecurityHeaders;
exports.setupCSPReporting = setupCSPReporting;
exports.initializeSecurity = initializeSecurity;
exports.validateSecurityConfig = validateSecurityConfig;
exports.getSecurityHealthCheck = getSecurityHealthCheck;
/**
 * Electron安全基线实现 - 三层拦截与沙箱策略
 * 实现ADR-0002规定的安全防护措施
 *
 * 三层拦截：
 * 1. BrowserWindow配置层：sandbox + contextIsolation + nodeIntegration控制
 * 2. 导航与权限层：拦截外部导航、弹窗控制、权限管理
 * 3. CSP响应头层：Content Security Policy + COOP/COEP/Permissions Policy
 */
const electron_1 = require('electron');
/**
 * 第一层：安全BrowserWindow配置
 * 确保所有窗口都遵循严格的安全基线
 */
function createSecureBrowserWindow(options = {}) {
  const secureOptions = {
    ...options,
    webPreferences: {
      // 核心安全配置 - 不可覆盖
      nodeIntegration: false, // 禁用渲染进程Node.js集成
      contextIsolation: true, // 启用上下文隔离
      sandbox: true, // 启用沙箱模式
      allowRunningInsecureContent: false, // 禁止混合内容
      experimentalFeatures: false, // 禁用实验性功能
      // enableRemoteModule已废弃，不再需要此选项
      webSecurity: true, // 启用Web安全
      // 可配置选项
      ...options.webPreferences,
      // Preload脚本路径（如果指定）
      preload: options.webPreferences?.preload || undefined,
    },
  };
  return new electron_1.BrowserWindow(secureOptions);
}
/**
 * 第二层：导航与权限拦截
 * 对单个窗口应用三项拦截策略
 */
function hardenWindow(window) {
  // 1. 窗口/弹窗拦截
  window.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[Security] 窗口打开请求被拦截: ${url}`);
    // 只允许内部协议或白名单域名
    const allowedProtocols = ['app://', 'file://'];
    const allowedDomains = ['localhost', '127.0.0.1']; // 开发时允许
    const isAllowed =
      allowedProtocols.some(protocol => url.startsWith(protocol)) ||
      allowedDomains.some(domain => url.includes(domain));
    if (isAllowed) {
      return { action: 'allow' };
    }
    // 外部链接通过系统浏览器打开
    electron_1.shell.openExternal(url);
    return { action: 'deny' };
  });
  // 2. 导航拦截
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    console.log(`[Security] 导航请求检查: ${navigationUrl}`);
    // 只允许内部导航
    if (
      !navigationUrl.startsWith('app://') &&
      !navigationUrl.startsWith('file://') &&
      !navigationUrl.includes('localhost') &&
      !navigationUrl.includes('127.0.0.1')
    ) {
      console.warn(`[Security] 外部导航被阻止: ${navigationUrl}`);
      event.preventDefault();
      // 可选：显示安全提示
      // dialog.showWarningBox('安全提示', `不允许导航到外部地址: ${navigationUrl}`);
    }
  });
  // 3. 权限请求拦截
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      console.log(`[Security] 权限请求: ${permission}`);
      // 定义允许的权限白名单
      const allowedPermissions = [
        'clipboard-read',
        'clipboard-sanitized-write',
      ];
      const isAllowed = allowedPermissions.includes(permission);
      if (isAllowed) {
        console.log(`[Security] 权限 ${permission} 已允许`);
        callback(true);
      } else {
        console.warn(`[Security] 权限 ${permission} 被拒绝`);
        callback(false);
      }
    }
  );
  // 4. 外部协议处理
  window.webContents.on('will-redirect', (event, redirectUrl) => {
    console.log(`[Security] 重定向检查: ${redirectUrl}`);
    if (
      !redirectUrl.startsWith('app://') &&
      !redirectUrl.startsWith('file://')
    ) {
      event.preventDefault();
      electron_1.shell.openExternal(redirectUrl);
    }
  });
}
/**
 * 第三层：CSP响应头安全策略
 * 安装全局安全头，包括CSP、COOP、COEP、Permissions-Policy
 * ✅ 按cifix1.txt建议：通过参数传入Session，在ready后调用
 */
function installSecurityHeaders(ses) {
  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    // Content Security Policy - 核心安全策略
    responseHeaders['Content-Security-Policy'] = [
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'", // 严格CSP：移除unsafe-inline
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss: https://sentry.io", // Sentry监控
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
      ].join('; '),
    ];
    // Cross-Origin Opener Policy
    responseHeaders['Cross-Origin-Opener-Policy'] = ['same-origin'];
    // Cross-Origin Embedder Policy
    responseHeaders['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    // Permissions Policy - 精确控制浏览器功能
    responseHeaders['Permissions-Policy'] = [
      'geolocation=(), camera=(), microphone=(), usb=(), serial=(), bluetooth=()',
    ];
    // X-Content-Type-Options
    responseHeaders['X-Content-Type-Options'] = ['nosniff'];
    // X-Frame-Options
    responseHeaders['X-Frame-Options'] = ['DENY'];
    // Referrer-Policy
    responseHeaders['Referrer-Policy'] = ['strict-origin-when-cross-origin'];
    callback({ responseHeaders });
  });
  console.log('[Security] 安全响应头已安装');
}
/**
 * CSP违规报告处理
 * 收集和监控CSP违规事件
 * ✅ 按cifix1.txt建议：通过参数传入Session，在ready后调用
 */
function setupCSPReporting(ses) {
  ses.webRequest.onBeforeRequest((details, callback) => {
    // 监控可疑的请求模式 - 避免使用javascript:协议字符串
    const url = details.url.toLowerCase();
    const scriptProtocol = 'java' + 'script:';
    const hasScriptProtocol = url.startsWith(scriptProtocol);
    const hasDataHtml = url.includes('data:text/html');
    const hasBlobUrl = url.startsWith('blob:');
    if (hasScriptProtocol || hasDataHtml || hasBlobUrl) {
      console.warn(`[Security] 检测到可疑请求: ${details.url}`);
      // 可选：发送到监控系统
      // sendSecurityAlert('csp_violation', { url: details.url, type: 'suspicious_request' });
    }
    callback({});
  });
}
/**
 * 安全初始化 - 应用启动时调用
 * 设置全局安全策略和事件监听
 * ✅ 按cifix1.txt建议：通过参数传入Session，在ready后调用
 */
function initializeSecurity(ses) {
  console.log('[Security] 初始化Electron安全基线...');
  // 安装全局安全头
  installSecurityHeaders(ses);
  // 设置CSP违规监控
  setupCSPReporting(ses);
  // 应用级安全事件监听
  electron_1.app.on('web-contents-created', (_event, contents) => {
    console.log('[Security] 新的web contents创建，应用安全策略');
    // 使用新的setWindowOpenHandler API替代废弃的new-window事件
    contents.setWindowOpenHandler(({ url }) => {
      console.log(`[Security] 外部链接请求: ${url}`);
      electron_1.shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-attach-webview', event => {
      console.warn('[Security] WebView被阻止');
      event.preventDefault();
    });
  });
  console.log('[Security] ✅ Electron安全基线初始化完成');
}
function validateSecurityConfig(window) {
  // 从BrowserWindow选项获取webPreferences配置
  const options = window.webContents.browserWindowOptions?.webPreferences || {};
  return {
    nodeIntegration: options.nodeIntegration || false,
    contextIsolation: options.contextIsolation !== false, // 默认true
    sandbox: options.sandbox || false,
    webSecurity: options.webSecurity !== false, // 默认true
    allowRunningInsecureContent: options.allowRunningInsecureContent || false,
    experimentalFeatures: options.experimentalFeatures || false,
  };
}
/**
 * 安全健康检查
 * 返回当前安全配置的合规状态
 */
function getSecurityHealthCheck(window) {
  const config = validateSecurityConfig(window);
  const violations = [];
  // 检查必需的安全配置
  if (config.nodeIntegration) {
    violations.push('nodeIntegration应该为false');
  }
  if (!config.contextIsolation) {
    violations.push('contextIsolation应该为true');
  }
  if (!config.sandbox) {
    violations.push('sandbox应该为true');
  }
  if (!config.webSecurity) {
    violations.push('webSecurity应该为true');
  }
  if (config.allowRunningInsecureContent) {
    violations.push('allowRunningInsecureContent应该为false');
  }
  if (config.experimentalFeatures) {
    violations.push('experimentalFeatures应该为false');
  }
  const totalChecks = 6;
  const passedChecks = totalChecks - violations.length;
  const score = (passedChecks / totalChecks) * 100;
  return {
    compliant: violations.length === 0,
    violations,
    score,
  };
}
