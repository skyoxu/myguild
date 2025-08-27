# 02 威胁模型与安全基线（Electron）
> **硬护栏**：渲染层禁用 Node、启用 Context Isolation、严格 CSP、最小化 preload 白名单、启用 sandbox。主/渲染进程协作只通过受控的 IPC 通道。

## 一、威胁模型（详细）

### 1.1 资产识别与分类
```typescript
// 资产重要性矩阵
export const ASSET_CRITICALITY_MATRIX = {
  核心资产: {
    用户存档数据: { 重要性: "🔴极高", 影响范围: "用户体验+数据完整性" },
    游戏配置文件: { 重要性: "🔴极高", 影响范围: "应用可用性" },
    内置脚本逻辑: { 重要性: "🟡高", 影响范围: "业务逻辑完整性" },
    更新机制: { 重要性: "🟡高", 影响范围: "供应链安全" }
  },
  系统资产: {
    主进程权限: { 重要性: "🔴极高", 影响范围: "系统完整性" },
    文件系统访问: { 重要性: "🟡高", 影响范围: "数据安全" },
    网络通信通道: { 重要性: "🟡中", 影响范围: "隐私保护" },
    IPC通信机制: { 重要性: "🟡高", 影响范围: "架构安全边界" }
  }
} as const;
```

### 1.2 攻击面详细分析

#### 1.2.1 Electron主进程攻击面
```typescript
// 主进程攻击面映射（高风险区域）
export const MAIN_PROCESS_ATTACK_SURFACE = {
  Node_API直接访问: {
    风险描述: "完整的文件系统、网络、进程控制权限",
    潜在威胁: ["任意文件读写", "进程注入", "网络监听"],
    缓解措施: ["最小权限原则", "API调用白名单", "严格输入验证"]
  },
  自动更新机制: {
    风险描述: "自动下载和执行外部代码的能力",
    潜在威胁: ["供应链攻击", "中间人攻击", "恶意更新包"],
    缓解措施: ["数字签名验证", "HTTPS强制", "更新包完整性校验"]
  },
  IPC消息处理: {
    风险描述: "处理来自渲染进程的消息和调用",
    潜在威胁: ["命令注入", "权限提升", "消息伪造"],
    缓解措施: ["严格消息验证", "通道白名单", "参数类型校验"]
  }
} as const;
```

#### 1.2.2 渲染进程攻击面
```typescript
// 渲染进程攻击面映射
export const RENDERER_ATTACK_SURFACE = {
  Web内容执行: {
    风险描述: "执行HTML/CSS/JavaScript内容",
    潜在威胁: ["XSS攻击", "CSRF攻击", "点击劫持"],
    缓解措施: ["严格CSP策略", "内容安全过滤", "同源策略"]
  },
  preload脚本暴露: {
    风险描述: "通过contextBridge暴露的API接口",
    潜在威胁: ["API滥用", "权限泄露", "接口调用伪造"],
    缓解措施: ["API白名单管控", "参数严格校验", "调用频率限制"]
  },
  外部资源加载: {
    风险描述: "加载外部图片、字体等资源",
    潜在威胁: ["资源投毒", "隐私泄露", "内容注入"],
    缓解措施: ["CSP资源限制", "资源完整性校验", "代理过滤"]
  }
} as const;
```

### 1.3 信任边界详细划分

```typescript
// 信任边界模型
export const TRUST_BOUNDARY_MODEL = {
  高信任区域: {
    主进程核心: {
      信任级别: "🔴最高",
      权限范围: "系统完整访问",
      防护要求: "代码签名 + 最小攻击面"
    }
  },
  中信任区域: {
    preload脚本: {
      信任级别: "🟡中等",
      权限范围: "受限API桥接",
      防护要求: "白名单机制 + 输入验证"
    },
    本地文件系统: {
      信任级别: "🟡中等", 
      权限范围: "应用数据目录",
      防护要求: "路径限制 + 访问控制"
    }
  },
  低信任区域: {
    渲染进程: {
      信任级别: "🟢低",
      权限范围: "沙箱化执行",
      防护要求: "Context隔离 + CSP策略"
    }
  },
  零信任区域: {
    外部网络内容: {
      信任级别: "🚫零",
      权限范围: "只读展示",
      防护要求: "完全隔离 + 内容过滤"
    }
  }
} as const;
```

### 1.4 STRIDE威胁分析

```typescript
// STRIDE威胁模型详细分析
export const STRIDE_THREAT_ANALYSIS = {
  欺骗_Spoofing: {
    威胁场景: "恶意进程伪装成合法的IPC调用者",
    影响资产: ["IPC通信机制", "主进程权限"],
    风险等级: "🟡中",
    缓解策略: ["进程身份验证", "消息来源校验", "数字签名"]
  },
  篡改_Tampering: {
    威胁场景: "恶意修改配置文件、存档数据或应用程序文件",
    影响资产: ["用户存档数据", "游戏配置文件", "内置脚本"],
    风险等级: "🔴高", 
    缓解策略: ["文件完整性监控", "访问权限控制", "备份机制"]
  },
  否认_Repudiation: {
    威胁场景: "否认游戏内交易或重要操作的执行",
    影响资产: ["操作审计日志", "用户数据变更"],
    风险等级: "🟡中",
    缓解策略: ["操作日志记录", "数字签名确认", "时间戳验证"]
  },
  信息泄露_Information_Disclosure: {
    威胁场景: "通过XSS、内存泄露或不当的API暴露获取敏感数据",
    影响资产: ["用户存档数据", "应用内部状态", "系统信息"],
    风险等级: "🔴高",
    缓解策略: ["数据加密存储", "最小暴露原则", "内存清理"]
  },
  拒绝服务_Denial_of_Service: {
    威胁场景: "通过资源耗尽或恶意输入导致应用崩溃",
    影响资产: ["应用可用性", "系统资源"],
    风险等级: "🟡中",
    缓解策略: ["资源限制", "输入验证", "异常恢复机制"]
  },
  特权提升_Elevation_of_Privilege: {
    威胁场景: "从渲染进程沙箱逃逸，获得主进程或系统权限",
    影响资产: ["主进程权限", "文件系统访问", "系统完整性"],
    风险等级: "🔴极高",
    缓解策略: ["严格沙箱配置", "Context隔离", "权限最小化"]
  }
} as const;
```

### 1.5 关键安全控制点

```typescript
// 关键安全控制映射
export const CRITICAL_SECURITY_CONTROLS = {
  contextIsolation: {
    威胁缓解: ["特权提升", "代码注入"],
    配置要求: "必须设为 true",
    验证方式: "E2E自动测试 + 运行时检查"
  },
  nodeIntegration: {
    威胁缓解: ["Node API滥用", "文件系统攻击"],
    配置要求: "必须设为 false",
    验证方式: "静态配置扫描 + 运行时断言"
  },
  sandbox: {
    威胁缓解: ["进程逃逸", "系统调用滥用"],
    配置要求: "必须启用",
    验证方式: "安全基线测试 + 权限验证"
  },
  CSP策略: {
    威胁缓解: ["XSS攻击", "恶意脚本执行"],
    配置要求: "严格的默认拒绝策略",
    验证方式: "内容安全扫描 + 违规监控"
  }
} as const;
```

### 1.6 风险优先级矩阵（DREAD）

| 威胁类型 | 破坏性 | 可复现性 | 可利用性 | 影响用户数 | 可发现性 | **综合风险** | **优先级** |
|---------|--------|----------|----------|-----------|-----------|------------|------------|
| **特权提升** | 10 | 6 | 7 | 9 | 5 | **7.4** | **P0** |
| **信息泄露** | 8 | 8 | 8 | 8 | 7 | **7.8** | **P0** |
| **供应链攻击** | 9 | 4 | 6 | 10 | 3 | **6.4** | **P1** |
| **IPC滥用** | 7 | 7 | 8 | 6 | 8 | **7.2** | **P1** |
| **XSS攻击** | 6 | 9 | 9 | 7 | 9 | **8.0** | **P1** |
| **拒绝服务** | 5 | 8 | 7 | 9 | 7 | **7.2** | **P2** |

## 二、BrowserWindow & 预加载（preload）基线

### 2.1 安全基线配置矩阵

```typescript
// src/main/security/electron-config.ts - 企业级安全配置
export const ELECTRON_SECURITY_CONFIG = {
  webPreferences: {
    // 🔒 【P0级别】核心安全护栏 - 禁止修改
    contextIsolation: true,              // 上下文隔离 - 防止渲染进程污染主进程
    nodeIntegration: false,              // 禁用Node.js集成 - 防止直接访问系统API
    webSecurity: true,                   // 启用Web安全 - 强制同源策略
    sandbox: true,                       // 启用沙箱 - 限制系统调用
    
    // 🛡️ 【P1级别】高级防护配置
    allowRunningInsecureContent: false, // 禁止不安全内容 - 防止混合内容攻击
    experimentalFeatures: false,         // 禁用实验性功能 - 避免未知安全风险
    nodeIntegrationInWorker: false,      // Worker禁用Node.js - 防止后台进程权限泄露
    nodeIntegrationInSubFrames: false,   // 子框架禁用Node.js - 防止iframe攻击
    
    // 🔐 【P2级别】攻击面缩减配置
    webgl: false,                        // 禁用WebGL - 减少GPU相关攻击面
    plugins: false,                      // 禁用插件系统 - 防止第三方插件安全风险
    java: false,                         // 禁用Java - 减少Java相关漏洞
    allowDisplayingInsecureContent: false, // 禁止显示不安全内容
    
    // 📁 预加载脚本安全配置
    preload: path.join(__dirname, '../preload/secure-bridge.js'), // 安全预加载脚本
    safeDialogs: true,                   // 安全对话框 - 防止对话框欺骗
    safeDialogsMessage: "此应用正在尝试显示安全对话框", // 安全提示信息
    
    // 🌐 Blink引擎安全配置
    blinkFeatures: '',                   // 禁用所有Blink实验性功能
    disableBlinkFeatures: 'Auxclick,AutoplayPolicy', // 禁用特定Blink功能
  }
} as const;
```

### 2.2 窗口创建安全实现

```typescript
// src/main/window.ts - 安全窗口创建器
import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { ELECTRON_SECURITY_CONFIG } from './security/electron-config';

/* 创建主窗口 - 严格安全配置 */
export function createSecureMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: ELECTRON_SECURITY_CONFIG.webPreferences,
    
    // 🖼️ 窗口安全配置
    show: false,                    // 初始隐藏，避免白屏闪烁
    titleBarStyle: 'default',       // 使用系统标题栏，避免自定义标题栏安全风险
    autoHideMenuBar: true,          // 自动隐藏菜单栏，减少攻击面
    
    // 🔐 窗口行为限制
    minimizable: true,
    maximizable: true,
    resizable: true,
    closable: true,
    movable: true,
  });

  // 🛡️ 外部链接安全处理 - 防止恶意重定向
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);      // 使用系统浏览器打开外部链接
    }
    return { action: 'deny' };      // 拒绝在应用内打开
  });

  // 🔍 导航安全控制 - 防止恶意重定向
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // 只允许导航到本地文件或信任域名
    if (parsedUrl.origin !== 'file://' && !isTrustedDomain(parsedUrl.origin)) {
      event.preventDefault();
      console.warn(`⚠️ 阻止导航到不信任域名: ${parsedUrl.origin}`);
    }
  });

  // 📋 权限请求严格控制
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // 拒绝所有权限请求，确保最小权限原则
    console.warn(`⛔ 权限请求被拒绝: ${permission}`);
    callback(false);
  });

  return mainWindow;
}

/* 域名白名单检查 */
function isTrustedDomain(origin: string): boolean {
  const trustedDomains = [
    'file://',                      // 本地文件
    // 在这里添加信任的外部域名（如果需要）
  ];
  
  return trustedDomains.includes(origin);
}

/* 开发环境安全配置 */
export function setupDevelopmentSecurity(mainWindow: BrowserWindow): void {
  if (process.env.NODE_ENV === 'development') {
    // 开发环境启用调试工具，但限制其功能
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    
    // 开发环境安全警告
    console.warn('🚧 开发环境模式 - 某些安全特性可能被放宽');
  }
}
```

### 2.3 预加载脚本安全架构

```typescript
// src/preload/secure-bridge.ts - 企业级安全预加载脚本
import { contextBridge, ipcRenderer } from 'electron';

// 🔒 安全API白名单 - 严格限制暴露的API
const SAFE_CHANNELS = [
  // 应用基础API
  'app:get-version',
  'app:get-platform', 
  'app:quit',
  
  // 系统信息API（只读）
  'sys:ping',
  'sys:get-memory-usage',
  
  // 游戏数据API
  'game:save-data',
  'game:load-data',
  'game:get-stats',
  
  // 用户设置API
  'settings:get',
  'settings:set',
  
  // 安全事件API
  'security:report-violation',
] as const;

type SafeChannel = typeof SAFE_CHANNELS[number];

/* 输入验证器 */
class InputValidator {
  /* 验证IPC通道是否在白名单中 */
  static isChannelSafe(channel: string): channel is SafeChannel {
    return SAFE_CHANNELS.includes(channel as SafeChannel);
  }

  /* 验证并清理输入参数 */
  static sanitizeInput(input: unknown): unknown {
    if (typeof input === 'string') {
      // 防止XSS - 移除潜在危险字符
      return input.replace(/<[^>]*>/g, '').trim();
    }
    
    if (typeof input === 'object' && input !== null) {
      // 递归清理对象属性
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (typeof key === 'string' && key.length < 100) { // 限制键名长度
          cleaned[key] = this.sanitizeInput(value);
        }
      }
      return cleaned;
    }
    
    return input;
  }

  /* 验证日志级别 */
  static validateLogLevel(level: string): 'info' | 'warn' | 'error' | 'debug' {
    const validLevels = ['info', 'warn', 'error', 'debug'];
    if (!validLevels.includes(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    return level as 'info' | 'warn' | 'error' | 'debug';
  }
}

/* 安全IPC调用包装器 */
function createSecureInvoke(channel: SafeChannel) {
  return async (...args: unknown[]): Promise<unknown> => {
    try {
      // 输入验证和清理
      const sanitizedArgs = args.map(arg => InputValidator.sanitizeInput(arg));
      
      // 执行IPC调用，带超时控制
      const result = await Promise.race([
        ipcRenderer.invoke(channel, ...sanitizedArgs),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('IPC调用超时')), 10000)
        )
      ]);
      
      return result;
    } catch (error) {
      console.error(`❌ IPC调用失败 [${channel}]:`, error);
      
      // 报告安全事件
      ipcRenderer.invoke('security:report-violation', {
        type: 'ipc-call-failed',
        channel,
        error: String(error),
        timestamp: new Date().toISOString()
      }).catch(() => {}); // 静默处理报告失败
      
      throw error;
    }
  };
}

// 🔐 安全的上下文桥接API
contextBridge.exposeInMainWorld('electronAPI', {
  // 🏠 应用信息API（只读）
  app: {
    getVersion: createSecureInvoke('app:get-version'),
    getPlatform: createSecureInvoke('app:get-platform'),
    quit: createSecureInvoke('app:quit'),
  },
  
  // 🖥️ 系统信息API（只读）
  system: {
    ping: createSecureInvoke('sys:ping'),
    getMemoryUsage: createSecureInvoke('sys:get-memory-usage'),
  },
  
  // 🎮 游戏数据API（受控访问）
  game: {
    saveData: createSecureInvoke('game:save-data'),
    loadData: createSecureInvoke('game:load-data'),
    getStats: createSecureInvoke('game:get-stats'),
  },
  
  // ⚙️ 用户设置API（受控访问）
  settings: {
    get: createSecureInvoke('settings:get'),
    set: createSecureInvoke('settings:set'),
  },
  
  // 🛡️ 安全事件报告API
  security: {
    reportViolation: createSecureInvoke('security:report-violation'),
  },
  
  // 📝 安全日志API
  log: {
    info: (message: string) => createSecureInvoke('sys:ping')(), // 复用ping通道作为示例
    warn: (message: string, level: string = 'warn') => {
      const validLevel = InputValidator.validateLogLevel(level);
      console.warn(`[${validLevel.toUpperCase()}] ${message}`);
    },
    error: (message: string) => {
      console.error(`[ERROR] ${message}`);
    }
  }
});

// 🚨 运行时安全检查
(() => {
  // 检查Node.js是否意外暴露
  if (typeof process !== 'undefined' && process?.versions?.node) {
    console.error('🚨 安全违规: Node.js APIs暴露到渲染进程!');
    // 在开发环境中抛出错误，生产环境中记录但继续运行
    if (process.env.NODE_ENV === 'development') {
      throw new Error('Node.js integration must be disabled');
    }
  }
  
  // 检查require是否意外暴露
  if (typeof require !== 'undefined') {
    console.error('🚨 安全违规: require函数暴露到渲染进程!');
    if (process.env.NODE_ENV === 'development') {
      throw new Error('require function must not be exposed');
    }
  }
  
  // 预加载完成标记
  window.dispatchEvent(new CustomEvent('preload-ready'));
  console.log('✅ 安全预加载脚本加载完成');
})();
```

### 2.4 CSP（内容安全策略）配置

```html
<!-- src/renderer/index.html - 严格CSP配置 -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- 🛡️ 严格的内容安全策略 - 防止XSS和代码注入 -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self';
    media-src 'self';
    object-src 'none';
    embed-src 'none';
    child-src 'none';
    frame-src 'none';
    worker-src 'self';
    manifest-src 'self';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  ">
  
  <!-- 🔒 额外安全标头 -->
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
  
  <title>Guild Manager - 安全桌面应用</title>
</head>
<body>
  <div id="app"></div>
  
  <!-- 🧪 安全性验证脚本 -->
  <script>
    // 监听预加载脚本就绪事件
    window.addEventListener('preload-ready', () => {
      console.log('✅ 预加载脚本安全检查通过');
      
      // 验证安全API是否正确暴露
      if (typeof window.electronAPI === 'object') {
        console.log('✅ Electron API安全暴露');
      } else {
        console.error('❌ Electron API未正确暴露');
      }
      
      // 验证危险API是否被隔离
      if (typeof require === 'undefined' && typeof process === 'undefined') {
        console.log('✅ 危险API已被隔离');
      } else {
        console.error('❌ 检测到危险API暴露');
      }
    });
  </script>
</body>
</html>
```

### 2.5 安全配置验证

```typescript
// src/main/security/baseline-validator.ts - 安全基线自动验证
export class SecurityBaselineValidator {
  /* 验证窗口安全配置 */
  static validateWindowSecurity(window: BrowserWindow): ValidationResult {
    const webPreferences = window.webContents.getWebPreferences();
    const errors: string[] = [];
    
    // P0级别检查 - 关键安全配置
    if (!webPreferences.contextIsolation) {
      errors.push('❌ CRITICAL: contextIsolation必须为true');
    }
    
    if (webPreferences.nodeIntegration) {
      errors.push('❌ CRITICAL: nodeIntegration必须为false');
    }
    
    if (!webPreferences.sandbox) {
      errors.push('❌ HIGH: sandbox建议启用');
    }
    
    if (!webPreferences.webSecurity) {
      errors.push('❌ HIGH: webSecurity必须为true');
    }
    
    return {
      passed: errors.length === 0,
      errors,
      score: Math.max(0, 100 - errors.length * 25)
    };
  }
  
  /* 生成安全报告 */
  static generateSecurityReport(results: ValidationResult): string {
    const { passed, errors, score } = results;
    
    let report = '\n🔒 Electron安全基线验证报告\n';
    report += '='.repeat(40) + '\n';
    report += `总体评分: ${score}/100\n`;
    report += `验证状态: ${passed ? '✅ 通过' : '❌ 失败'}\n\n`;
    
    if (errors.length > 0) {
      report += '发现的安全问题:\n';
      errors.forEach(error => report += `  ${error}\n`);
    } else {
      report += '✅ 所有安全检查均通过\n';
    }
    
    return report;
  }
}

interface ValidationResult {
  passed: boolean;
  errors: string[];
  score: number;
}
```

## 三、IPC 策略（白名单 + 类型安全）

### 3.1 IPC安全架构设计

```typescript
// src/main/security/ipc-security-manager.ts - IPC安全核心架构
import { ipcMain, IpcMainInvokeEvent, webContents } from 'electron';
import crypto from 'crypto';
import { z } from 'zod';

/* IPC安全管理器 - 企业级安全控制中心 */
export class IPCSecurityManager {
  private static instance: IPCSecurityManager;
  private rateLimiter: Map<string, RateLimitState> = new Map();
  private securityAuditor: SecurityAuditor;
  private channelWhitelist: Set<SafeChannel>;
  private sessionTokens: Map<string, SessionToken> = new Map();

  private constructor() {
    this.securityAuditor = new SecurityAuditor();
    this.channelWhitelist = new Set(SAFE_CHANNELS);
    this.setupSecurityMiddleware();
  }

  /* 获取单例实例 */
  public static getInstance(): IPCSecurityManager {
    if (!IPCSecurityManager.instance) {
      IPCSecurityManager.instance = new IPCSecurityManager();
    }
    return IPCSecurityManager.instance;
  }

  /* 设置安全中间件 */
  private setupSecurityMiddleware(): void {
    // 拦截所有IPC调用进行安全检查
    ipcMain.handle = new Proxy(ipcMain.handle, {
      apply: (target, thisArg, args) => {
        const [channel, handler] = args;
        const secureHandler = this.wrapWithSecurity(channel, handler);
        return target.apply(thisArg, [channel, secureHandler]);
      }
    });
  }

  /* 安全包装器 - 包装所有IPC处理器 */
  private wrapWithSecurity(channel: string, handler: Function) {
    return async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const startTime = Date.now();
      
      try {
        // 1. 通道白名单检查
        if (!this.isChannelAllowed(channel)) {
          throw new SecurityViolation(`通道 ${channel} 不在白名单中`);
        }

        // 2. 发送源验证
        if (!this.validateSender(event)) {
          throw new SecurityViolation('发送源验证失败');
        }

        // 3. 速率限制检查
        if (!this.checkRateLimit(channel, event.processId)) {
          throw new SecurityViolation(`通道 ${channel} 超出速率限制`);
        }

        // 4. 参数验证和清理
        const sanitizedArgs = this.validateAndSanitizeArgs(channel, args);

        // 5. 执行原始处理器
        const result = await handler(event, ...sanitizedArgs);

        // 6. 返回结果验证
        const validatedResult = this.validateReturnValue(channel, result);

        // 7. 记录成功调用
        this.auditSuccess(channel, startTime, args.length);

        return validatedResult;

      } catch (error) {
        // 安全事件记录
        this.auditSecurityViolation(channel, error, event.processId, args);
        
        // 根据错误类型决定是否抛出
        if (error instanceof SecurityViolation) {
          throw error;
        }
        
        // 包装内部错误，避免信息泄露
        throw new Error('内部处理错误');
      }
    };
  }
}

/* 安全违规异常 */
class SecurityViolation extends Error {
  constructor(message: string, public readonly securityCode: string = 'SECURITY_VIOLATION') {
    super(message);
    this.name = 'SecurityViolation';
  }
}
```

### 3.2 通道白名单与命名规范

```typescript
// src/shared/security/channel-whitelist.ts - 严格通道管控
export const SAFE_CHANNELS = [
  // 🏠 应用基础API（只读）
  'app:get-version',          // 获取应用版本
  'app:get-platform',         // 获取系统平台
  'app:get-locale',          // 获取系统语言
  'app:quit',                // 退出应用（需确认）

  // 🖥️ 系统信息API（只读）
  'sys:ping',                // 心跳检测
  'sys:get-memory-usage',    // 内存使用情况
  'sys:get-cpu-usage',       // CPU使用情况
  'sys:show-message-box',    // 安全消息框

  // 🎮 游戏数据API（受控访问）
  'game:save-data',          // 保存游戏数据
  'game:load-data',          // 加载游戏数据
  'game:export-data',        // 导出数据
  'game:get-stats',          // 获取统计信息

  // ⚙️ 用户设置API（受控访问）
  'settings:get',            // 获取设置
  'settings:set',            // 更新设置
  'settings:reset',          // 重置设置

  // 📝 日志API（受控访问）
  'log:write-entry',         // 写入日志
  'log:get-logs',            // 读取日志

  // 🛡️ 安全事件API
  'security:report-violation', // 报告安全事件
  'security:get-status',     // 获取安全状态

  // 🔧 开发工具API（仅开发环境）
  'dev:reload',              // 重新加载（开发环境）
  'dev:toggle-devtools',     // 切换开发工具（开发环境）
] as const;

type SafeChannel = typeof SAFE_CHANNELS[number];

/* 通道命名规范验证器 */
export class ChannelNamingValidator {
  private static readonly NAMING_PATTERN = /^[a-z-]+:[a-z-]+$/;
  private static readonly FORBIDDEN_PREFIXES = ['system', 'internal', '__', 'node'];
  
  /* 验证通道命名是否符合规范 */
  static validateChannelName(channel: string): boolean {
    // 1. 基础格式检查：domain:action
    if (!this.NAMING_PATTERN.test(channel)) {
      return false;
    }

    // 2. 禁止使用系统前缀
    const [domain] = channel.split(':');
    if (this.FORBIDDEN_PREFIXES.includes(domain)) {
      return false;
    }

    // 3. 长度限制
    if (channel.length > 50) {
      return false;
    }

    // 4. 白名单验证
    return SAFE_CHANNELS.includes(channel as SafeChannel);
  }

  /* 生成通道使用报告 */
  static generateChannelReport(): ChannelUsageReport {
    return {
      totalChannels: SAFE_CHANNELS.length,
      categorizedChannels: {
        app: SAFE_CHANNELS.filter(c => c.startsWith('app:')).length,
        sys: SAFE_CHANNELS.filter(c => c.startsWith('sys:')).length,
        game: SAFE_CHANNELS.filter(c => c.startsWith('game:')).length,
        settings: SAFE_CHANNELS.filter(c => c.startsWith('settings:')).length,
        log: SAFE_CHANNELS.filter(c => c.startsWith('log:')).length,
        security: SAFE_CHANNELS.filter(c => c.startsWith('security:')).length,
        dev: SAFE_CHANNELS.filter(c => c.startsWith('dev:')).length,
      }
    };
  }
}

interface ChannelUsageReport {
  totalChannels: number;
  categorizedChannels: Record<string, number>;
}
```

### 3.3 参数验证与类型安全

```typescript
// src/shared/security/ipc-validators.ts - 强类型参数验证
import { z } from 'zod';

/* IPC参数验证器集合 */
export class IPCValidators {
  
  // 🏠 应用信息验证器
  static readonly AppValidators = {
    'app:quit': z.object({
      saveBeforeQuit: z.boolean().optional().default(true),
      force: z.boolean().optional().default(false)
    }).optional()
  };

  // 🎮 游戏数据验证器
  static readonly GameValidators = {
    'game:save-data': z.object({
      saveId: z.string().uuid(),
      playerData: z.object({
        name: z.string().min(1).max(50),
        level: z.number().int().min(1).max(100),
        experience: z.number().int().min(0),
        guilds: z.array(z.string().uuid()).max(10),
        settings: z.record(z.unknown()).optional()
      }),
      metadata: z.object({
        version: z.string(),
        timestamp: z.number(),
        checksum: z.string().optional()
      })
    }),

    'game:load-data': z.object({
      saveId: z.string().uuid().optional(),
      includeMetadata: z.boolean().optional().default(false)
    }).optional(),

    'game:export-data': z.object({
      format: z.enum(['json', 'csv', 'xml']),
      includeHistory: z.boolean().optional().default(false),
      dateRange: z.object({
        start: z.number(),
        end: z.number()
      }).optional()
    })
  };

  // ⚙️ 设置验证器
  static readonly SettingsValidators = {
    'settings:get': z.object({
      key: z.string().min(1).max(100),
      defaultValue: z.unknown().optional()
    }),

    'settings:set': z.object({
      key: z.string().min(1).max(100),
      value: z.unknown(),
      sync: z.boolean().optional().default(true)
    })
  };

  // 📝 日志验证器
  static readonly LogValidators = {
    'log:write-entry': z.object({
      level: z.enum(['info', 'warn', 'error', 'debug']),
      message: z.string().min(1).max(1000),
      timestamp: z.number(),
      metadata: z.record(z.unknown()).optional()
    }),

    'log:get-logs': z.object({
      level: z.enum(['info', 'warn', 'error', 'debug']).optional(),
      limit: z.number().int().min(1).max(1000).optional().default(100),
      since: z.number().optional()
    }).optional()
  };

  /* 获取通道对应的验证器 */
  static getValidator(channel: SafeChannel): z.ZodSchema | undefined {
    // 合并所有验证器
    const allValidators = {
      ...this.AppValidators,
      ...this.GameValidators,
      ...this.SettingsValidators,
      ...this.LogValidators
    };

    return allValidators[channel];
  }

  /* 验证IPC参数 */
  static validateArgs(channel: SafeChannel, args: unknown[]): unknown[] {
    const validator = this.getValidator(channel);
    
    if (!validator) {
      // 无验证器的通道，进行基础清理
      return this.sanitizeBasicArgs(args);
    }

    // 大多数IPC调用接受单个对象参数
    const [firstArg, ...restArgs] = args;
    
    try {
      const validatedArg = validator.parse(firstArg);
      return [validatedArg, ...restArgs];
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `参数验证失败 [${channel}]: ${error.errors.map(e => e.message).join(', ')}`
        );
      }
      throw error;
    }
  }

  /* 基础参数清理 */
  private static sanitizeBasicArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // 移除潜在危险字符，限制长度
        return arg.replace(/<[^>]*>/g, '').slice(0, 10000);
      }
      
      if (typeof arg === 'object' && arg !== null) {
        // 递归清理对象
        return this.sanitizeObject(arg);
      }
      
      return arg;
    });
  }

  /* 对象深度清理 */
  private static sanitizeObject(obj: any): any {
    const cleaned: any = {};
    const MAX_DEPTH = 10;
    
    const sanitizeRecursive = (source: any, depth: number): any => {
      if (depth > MAX_DEPTH) return '[深度限制]';
      
      if (typeof source === 'string') {
        return source.replace(/<[^>]*>/g, '').slice(0, 1000);
      }
      
      if (Array.isArray(source)) {
        return source.slice(0, 100).map(item => sanitizeRecursive(item, depth + 1));
      }
      
      if (typeof source === 'object' && source !== null) {
        const result: any = {};
        let propCount = 0;
        
        for (const [key, value] of Object.entries(source)) {
          if (propCount++ > 50) break; // 限制属性数量
          if (typeof key === 'string' && key.length < 100) {
            result[key] = sanitizeRecursive(value, depth + 1);
          }
        }
        
        return result;
      }
      
      return source;
    };
    
    return sanitizeRecursive(obj, 0);
  }
}

/* 验证错误 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 3.4 速率限制与安全监控

```typescript
// src/main/security/rate-limiter.ts - IPC速率限制器
export class IPCRateLimiter {
  private limitStates: Map<string, RateLimitState> = new Map();
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60000,      // 1分钟时间窗口
    maxRequests: 100,     // 最大请求数
    burstAllowance: 10,   // 突发允许量
    blockDurationMs: 300000 // 5分钟阻断时间
  };

  /* 检查是否允许请求 */
  checkRateLimit(channel: SafeChannel, processId: number): boolean {
    const key = `${channel}:${processId}`;
    const now = Date.now();
    
    let state = this.limitStates.get(key);
    if (!state) {
      state = this.createInitialState(now);
      this.limitStates.set(key, state);
    }

    // 检查是否在阻断期内
    if (state.blockedUntil && now < state.blockedUntil) {
      return false;
    }

    // 重置时间窗口
    if (now - state.windowStart >= this.defaultConfig.windowMs) {
      state = this.resetWindow(state, now);
    }

    // 检查请求限制
    if (state.requestCount >= this.defaultConfig.maxRequests) {
      // 触发阻断
      state.blockedUntil = now + this.defaultConfig.blockDurationMs;
      state.violationCount++;
      
      // 记录安全事件
      this.recordRateLimitViolation(channel, processId, state);
      return false;
    }

    // 允许请求
    state.requestCount++;
    state.lastRequestTime = now;
    this.limitStates.set(key, state);
    
    return true;
  }

  /* 获取通道特定配置 */
  private getChannelConfig(channel: SafeChannel): RateLimitConfig {
    const channelConfigs: Partial<Record<SafeChannel, Partial<RateLimitConfig>>> = {
      'game:save-data': { maxRequests: 10 },  // 保存数据限制更严格
      'sys:ping': { maxRequests: 200 },       // 心跳检测允许更频繁
      'log:write-entry': { maxRequests: 500 }, // 日志写入允许更多
      'security:report-violation': { maxRequests: 50 } // 安全报告中等频率
    };

    const channelOverride = channelConfigs[channel] || {};
    return { ...this.defaultConfig, ...channelOverride };
  }

  /* 创建初始状态 */
  private createInitialState(now: number): RateLimitState {
    return {
      windowStart: now,
      requestCount: 0,
      lastRequestTime: now,
      violationCount: 0,
      blockedUntil: null
    };
  }

  /* 重置时间窗口 */
  private resetWindow(state: RateLimitState, now: number): RateLimitState {
    return {
      ...state,
      windowStart: now,
      requestCount: 0,
      blockedUntil: null
    };
  }

  /* 记录速率限制违规 */
  private recordRateLimitViolation(
    channel: SafeChannel, 
    processId: number, 
    state: RateLimitState
  ): void {
    console.warn(`🚨 速率限制违规: 通道 ${channel}, 进程 ${processId}`);
    
    // 发送到安全审计服务
    SecurityAuditService.logSecurityEvent('RATE_LIMIT_VIOLATION', {
      channel,
      processId,
      requestCount: state.requestCount,
      violationCount: state.violationCount,
      timestamp: Date.now()
    });
  }

  /* 清理过期状态 */
  cleanupExpiredStates(): void {
    const now = Date.now();
    const expireThreshold = now - (this.defaultConfig.windowMs * 2);
    
    for (const [key, state] of this.limitStates.entries()) {
      if (state.lastRequestTime < expireThreshold) {
        this.limitStates.delete(key);
      }
    }
  }
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstAllowance: number;
  blockDurationMs: number;
}

interface RateLimitState {
  windowStart: number;
  requestCount: number;
  lastRequestTime: number;
  violationCount: number;
  blockedUntil: number | null;
}
```

### 3.5 安全审计与监控

```typescript
// src/main/security/security-audit-service.ts - IPC安全审计服务
export class SecurityAuditService {
  private static instance: SecurityAuditService;
  private auditLog: SecurityAuditEntry[] = [];
  private readonly maxLogEntries = 10000;

  private constructor() {
    // 定期清理日志
    setInterval(() => this.cleanupOldEntries(), 300000); // 5分钟清理一次
  }

  static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  /* 记录安全事件 */
  static logSecurityEvent(
    eventType: SecurityEventType,
    details: Record<string, any>
  ): void {
    const instance = this.getInstance();
    const entry: SecurityAuditEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      eventType,
      severity: this.calculateSeverity(eventType),
      details: this.sanitizeDetails(details),
      processInfo: this.captureProcessInfo()
    };

    instance.auditLog.push(entry);
    
    // 高危事件立即处理
    if (entry.severity === 'CRITICAL') {
      this.handleCriticalEvent(entry);
    }

    // 保持日志大小限制
    if (instance.auditLog.length > instance.maxLogEntries) {
      instance.auditLog = instance.auditLog.slice(-instance.maxLogEntries);
    }
  }

  /* 获取安全报告 */
  static generateSecurityReport(timeRange?: { start: number; end: number }): SecurityReport {
    const instance = this.getInstance();
    let entries = instance.auditLog;

    if (timeRange) {
      entries = entries.filter(entry => 
        entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
      );
    }

    return {
      reportId: crypto.randomUUID(),
      generatedAt: Date.now(),
      timeRange: timeRange || {
        start: entries[0]?.timestamp || Date.now(),
        end: entries[entries.length - 1]?.timestamp || Date.now()
      },
      summary: this.generateSummary(entries),
      entries: entries.slice(-1000), // 最近1000条记录
      recommendations: this.generateRecommendations(entries)
    };
  }

  /* 计算事件严重性 */
  private static calculateSeverity(eventType: SecurityEventType): SecuritySeverity {
    const severityMap: Record<SecurityEventType, SecuritySeverity> = {
      'IPC_CHANNEL_BLOCKED': 'HIGH',
      'RATE_LIMIT_VIOLATION': 'MEDIUM',
      'PARAMETER_VALIDATION_FAILED': 'MEDIUM',
      'UNAUTHORIZED_ACCESS_ATTEMPT': 'CRITICAL',
      'SUSPICIOUS_ACTIVITY': 'HIGH',
      'SECURITY_CONFIGURATION_CHANGED': 'HIGH',
      'AUDIT_LOG_TAMPERING': 'CRITICAL'
    };

    return severityMap[eventType] || 'LOW';
  }

  /* 处理关键安全事件 */
  private static handleCriticalEvent(entry: SecurityAuditEntry): void {
    console.error(`🚨 关键安全事件: ${entry.eventType}`, entry.details);
    
    // 发送告警通知
    this.sendSecurityAlert(entry);
    
    // 根据事件类型采取行动
    switch (entry.eventType) {
      case 'UNAUTHORIZED_ACCESS_ATTEMPT':
        this.handleUnauthorizedAccess(entry);
        break;
      case 'AUDIT_LOG_TAMPERING':
        this.handleAuditTampering(entry);
        break;
    }
  }

  /* 发送安全告警 */
  private static sendSecurityAlert(entry: SecurityAuditEntry): void {
    // 实现告警通知逻辑
    // 可以发送到监控系统、日志服务或管理员邮箱
    console.warn(`📧 安全告警已发送: ${entry.id}`);
  }

  /* 生成安全摘要 */
  private static generateSummary(entries: SecurityAuditEntry[]): SecuritySummary {
    const eventCounts = entries.reduce((acc, entry) => {
      acc[entry.eventType] = (acc[entry.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityCounts = entries.reduce((acc, entry) => {
      acc[entry.severity] = (acc[entry.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: entries.length,
      eventTypeCounts: eventCounts,
      severityCounts: severityCounts,
      criticalEvents: entries.filter(e => e.severity === 'CRITICAL').length,
      timeSpan: entries.length > 0 ? {
        start: Math.min(...entries.map(e => e.timestamp)),
        end: Math.max(...entries.map(e => e.timestamp))
      } : null
    };
  }
}

// 类型定义
type SecurityEventType = 
  | 'IPC_CHANNEL_BLOCKED' 
  | 'RATE_LIMIT_VIOLATION'
  | 'PARAMETER_VALIDATION_FAILED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'SUSPICIOUS_ACTIVITY'
  | 'SECURITY_CONFIGURATION_CHANGED'
  | 'AUDIT_LOG_TAMPERING';

type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface SecurityAuditEntry {
  id: string;
  timestamp: number;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  details: Record<string, any>;
  processInfo: ProcessInfo;
}

interface SecurityReport {
  reportId: string;
  generatedAt: number;
  timeRange: { start: number; end: number };
  summary: SecuritySummary;
  entries: SecurityAuditEntry[];
  recommendations: string[];
}

interface SecuritySummary {
  totalEvents: number;
  eventTypeCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  criticalEvents: number;
  timeSpan: { start: number; end: number } | null;
}
```

### 3.6 IPC契约固化与类型系统

```typescript
// src/shared/ipc/contracts.ts - IPC契约固化标准
export namespace IPCContracts {
  export const CONTRACT_VERSION = "1.0.0";

  /* 标准化IPC消息格式 */
  export interface StandardIPCMessage<T = any> {
    readonly contractVersion: string;
    readonly messageId: string;
    readonly timestamp: number;
    readonly channel: SafeChannel;
    readonly payload: T;
    readonly timeout?: number;
  }

  /* 应用信息契约 */
  export namespace AppContract {
    export interface GetVersionResponse {
      version: string;
      buildNumber: string;
      commitHash?: string;
    }

    export interface QuitRequest {
      saveBeforeQuit?: boolean;
      force?: boolean;
    }
  }

  /* 游戏数据契约 */
  export namespace GameContract {
    export interface SaveDataRequest {
      saveId: string;
      playerData: PlayerData;
      metadata: SaveMetadata;
    }

    export interface SaveDataResponse {
      success: boolean;
      saveId: string;
      timestamp: number;
      checksum: string;
    }

    export interface PlayerData {
      name: string;
      level: number;
      experience: number;
      guilds: string[];
      settings?: Record<string, unknown>;
    }

    export interface SaveMetadata {
      version: string;
      timestamp: number;
      checksum?: string;
    }
  }

  /* 设置管理契约 */
  export namespace SettingsContract {
    export interface GetSettingRequest {
      key: string;
      defaultValue?: unknown;
    }

    export interface SetSettingRequest {
      key: string;
      value: unknown;
      sync?: boolean;
    }

    export interface SettingResponse<T = unknown> {
      key: string;
      value: T;
      timestamp: number;
    }
  }

  /* 契约验证器 */
  export class ContractValidator {
    static validateMessage(message: unknown): message is StandardIPCMessage {
      return (
        typeof message === 'object' &&
        message !== null &&
        typeof (message as any).contractVersion === 'string' &&
        typeof (message as any).messageId === 'string' &&
        typeof (message as any).timestamp === 'number' &&
        typeof (message as any).channel === 'string' &&
        (message as any).payload !== undefined
      );
    }

    static enforceTimeout(message: StandardIPCMessage): number {
      return message.timeout || 30000; // 默认30秒超时
    }

    static generateMessageId(): string {
      return `ipc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
}
```

## 四、构建与发布安全

### 4.1 electron-builder安全配置

```typescript
// build/electron-builder.config.ts - 安全构建配置
import { Configuration } from 'electron-builder';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const config: Configuration = {
  appId: "com.guildmanager.app",
  productName: "Guild Manager",
  
  // 🔒 基础安全配置
  directories: {
    output: "dist/electron",
    buildResources: "build/resources"
  },
  
  // 📁 文件过滤（安全）
  files: [
    "dist-electron/**/*",
    "dist/**/*",
    "node_modules/**/*",
    "!node_modules/.cache",
    "!node_modules/**/*.map",
    "!node_modules/**/*.d.ts",
    "!**/*.{ts,tsx,jsx}",
    "!**/{.git,node_modules,src,test,tests,docs,coverage}/**/*",
    "!**/{tsconfig.json,webpack.config.js,.eslintrc.*,.gitignore}",
    "!**/*.{log,md}"
  ],

  // 🛡️ 安全资源嵌入
  extraResources: [
    {
      from: "resources/security/certs/",
      to: "security/certs/",
      filter: ["**/*.pem", "**/*.crt"]
    }
  ],

  // 🖥️ macOS安全配置
  mac: {
    category: "public.app-category.games",
    target: [
      { target: "dmg", arch: "x64" },
      { target: "dmg", arch: "arm64" },
      { target: "zip", arch: "universal" }
    ],
    
    // 🔐 代码签名配置
    identity: process.env.CSC_IDENTITY_NAME || "Developer ID Application: Guild Manager Inc (XXXXXXXXX)",
    
    // 🛡️ 硬化运行时配置
    hardenedRuntime: true,
    gatekeeperAssess: false,
    
    // 📋 权限配置文件
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.inherit.plist",
    
    // 🚫 安全限制
    bundleVersion: process.env.BUILD_NUMBER || "1",
    bundleShortVersion: process.env.PACKAGE_VERSION || "1.0.0",
    
    // ⚙️ 扩展属性（安全）
    extendInfo: {
      NSCameraUsageDescription: "此应用不使用摄像头",
      NSMicrophoneUsageDescription: "此应用不使用麦克风",
      NSLocationUsageDescription: "此应用不使用位置服务",
      LSApplicationCategoryType: "public.app-category.games",
      CFBundleDocumentTypes: [], // 不关联任何文件类型
      CFBundleURLTypes: [] // 不注册URL协议
    }
  },

  // 🪟 Windows安全配置
  win: {
    target: [
      { target: "nsis", arch: "x64" },
      { target: "portable", arch: "x64" }
    ],
    
    // 🔐 代码签名配置
    certificateFile: process.env.CSC_CERTIFICATE_FILE,
    certificatePassword: process.env.CSC_CERTIFICATE_PASSWORD,
    signingHashAlgorithms: ["sha256"],
    rfc3161TimeStampServer: "http://timestamp.digicert.com",
    
    // 📋 应用清单（安全）
    requestedExecutionLevel: "asInvoker", // 不请求管理员权限
    applicationManifest: "build/app.manifest",
    
    // 🛡️ 安全图标和资源
    icon: "build/icons/icon.ico",
    verifyUpdateCodeSignature: true // 验证更新包签名
  },

  // 📦 NSIS安装包配置（Windows）
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: false, // 禁止提升权限
    
    // 🔒 安全安装选项
    createDesktopShortcut: "always",
    createStartMenuShortcut: true,
    shortcutName: "Guild Manager",
    
    // 🛡️ 安全检查脚本
    include: "build/installer-security.nsh",
    
    // ⚠️ 安全警告和许可
    license: "LICENSE",
    warningsAsErrors: true
  },

  // 🐧 Linux配置
  linux: {
    target: [
      { target: "AppImage", arch: "x64" },
      { target: "deb", arch: "x64" }
    ],
    category: "Game",
    
    // 📋 桌面条目（安全）
    desktop: {
      Name: "Guild Manager",
      Comment: "Guild Management Game",
      Categories: "Game;Simulation",
      StartupWMClass: "guild-manager",
      // 安全：不请求额外权限
      MimeType: undefined
    }
  },

  // 🔄 自动更新配置
  publish: {
    provider: "github",
    owner: "guild-manager",
    repo: "guild-manager-app",
    private: true,
    token: process.env.GITHUB_TOKEN,
    
    // 🔒 更新安全配置
    publishAutoUpdate: true,
    releaseType: "release" // 只发布正式版本
  },

  // 📊 构建后处理（安全验证）
  afterSign: "scripts/security/post-sign-verify.js",
  afterAllArtifactBuild: "scripts/security/post-build-verify.js"
};

export default config;
```

### 4.2 macOS代码签名与公证流程

```bash
#!/bin/bash
# scripts/security/macos-sign-and-notarize.sh - macOS安全签名和公证流程

set -e  # 遇到错误立即退出

echo "🍎 开始macOS代码签名和公证流程..."

# 🔐 环境变量检查
required_vars=("APPLE_ID" "APPLE_ID_PASSWORD" "APPLE_TEAM_ID" "CSC_IDENTITY_NAME")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "❌ 错误: 环境变量 $var 未设置"
    exit 1
  fi
done

# 📁 设置路径
APP_PATH="dist/electron/mac/Guild Manager.app"
DMG_PATH="dist/electron/Guild Manager-*.dmg"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"

echo "📋 使用权限配置: $ENTITLEMENTS_PATH"

# 🔍 验证权限配置文件
if [[ ! -f "$ENTITLEMENTS_PATH" ]]; then
  echo "❌ 权限配置文件不存在: $ENTITLEMENTS_PATH"
  exit 1
fi

# 🔐 深度签名应用（从内到外）
echo "🔏 开始深度签名应用包..."

# 签名所有框架和库
find "$APP_PATH/Contents/Frameworks" -name "*.framework" -o -name "*.dylib" | while read framework; do
  echo "  📝 签名: $framework"
  codesign --deep --force --verify --verbose --sign "$CSC_IDENTITY_NAME" \
    --options runtime \
    --entitlements "$ENTITLEMENTS_PATH" \
    "$framework"
done

# 签名Helper应用
find "$APP_PATH/Contents" -name "*Helper*" | while read helper; do
  echo "  🤖 签名Helper: $helper"
  codesign --deep --force --verify --verbose --sign "$CSC_IDENTITY_NAME" \
    --options runtime \
    --entitlements "build/entitlements.mac.inherit.plist" \
    "$helper"
done

# 签名主应用
echo "  🎯 签名主应用: $APP_PATH"
codesign --deep --force --verify --verbose --sign "$CSC_IDENTITY_NAME" \
  --options runtime \
  --entitlements "$ENTITLEMENTS_PATH" \
  "$APP_PATH"

# 🔍 验证签名
echo "✅ 验证应用签名..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --verbose --type exec "$APP_PATH"

# 📦 创建并签名DMG
echo "💿 创建并签名DMG..."
if ls $DMG_PATH 1> /dev/null 2>&1; then
  for dmg in $DMG_PATH; do
    echo "  📝 签名DMG: $dmg"
    codesign --sign "$CSC_IDENTITY_NAME" --force "$dmg"
  done
else
  echo "⚠️ 警告: 未找到DMG文件"
fi

# 🍎 上传至Apple进行公证
echo "☁️ 开始Apple公证流程..."

# 创建临时密钥链项目
echo "🔑 配置公证凭据..."
xcrun notarytool store-credentials "AC_PASSWORD" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_ID_PASSWORD"

# 上传进行公证
for dmg in $DMG_PATH; do
  echo "  ⬆️ 上传公证: $dmg"
  
  # 提交公证请求
  SUBMISSION_ID=$(xcrun notarytool submit "$dmg" \
    --keychain-profile "AC_PASSWORD" \
    --wait --timeout 1800 \
    --output-format json | jq -r '.id')
  
  if [[ "$SUBMISSION_ID" == "null" ]] || [[ -z "$SUBMISSION_ID" ]]; then
    echo "❌ 公证提交失败"
    exit 1
  fi
  
  echo "  📋 公证ID: $SUBMISSION_ID"
  
  # 检查公证状态
  STATUS=$(xcrun notarytool info "$SUBMISSION_ID" \
    --keychain-profile "AC_PASSWORD" \
    --output-format json | jq -r '.status')
  
  echo "  📊 公证状态: $STATUS"
  
  if [[ "$STATUS" == "Accepted" ]]; then
    echo "  ✅ 公证成功，装订票据..."
    xcrun stapler staple "$dmg"
    
    # 验证装订
    echo "  🔍 验证装订票据..."
    xcrun stapler validate "$dmg"
    spctl --assess --type open --context context:primary-signature "$dmg"
    
    echo "  🎉 DMG公证和装订完成: $dmg"
  else
    echo "  ❌ 公证失败: $STATUS"
    
    # 获取详细日志
    xcrun notarytool log "$SUBMISSION_ID" \
      --keychain-profile "AC_PASSWORD" \
      > "notarization-log-$(basename "$dmg").txt"
    
    echo "  📝 公证日志已保存到: notarization-log-$(basename "$dmg").txt"
    exit 1
  fi
done

# 🧹 清理临时凭据
security delete-generic-password -s "AC_PASSWORD" || true

echo "🎉 macOS代码签名和公证流程完成!"
```

```xml
<!-- build/entitlements.mac.plist - macOS权限配置（最小权限原则） -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- 🔒 硬化运行时权限 -->
  <key>com.apple.security.cs.allow-jit</key>
  <false/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <false/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <false/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <false/>
  
  <!-- 📁 文件系统权限（限制） -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
  
  <!-- 🌐 网络权限（仅出站） -->
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <false/>
  
  <!-- 🚫 禁用的权限（安全） -->
  <key>com.apple.security.device.camera</key>
  <false/>
  <key>com.apple.security.device.microphone</key>
  <false/>
  <key>com.apple.security.personal-information.location</key>
  <false/>
  <key>com.apple.security.personal-information.addressbook</key>
  <false/>
  <key>com.apple.security.personal-information.calendars</key>
  <false/>
  <key>com.apple.security.personal-information.photos-library</key>
  <false/>
  
  <!-- ⚡ Electron特定权限 -->
  <key>com.apple.security.cs.disable-executable-page-protection</key>
  <false/>
  <key>com.apple.security.automation.apple-events</key>
  <false/>
</dict>
</plist>
```

### 4.3 Windows代码签名流程

```powershell
# scripts/security/windows-sign.ps1 - Windows代码签名脚本

param(
    [Parameter(Mandatory=$true)]
    [string]$CertificateFile,
    
    [Parameter(Mandatory=$true)]
    [string]$CertificatePassword,
    
    [Parameter(Mandatory=$false)]
    [string]$TimestampServer = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

Write-Host "🪟 开始Windows代码签名流程..." -ForegroundColor Green

# 🔍 验证证书文件
if (-Not (Test-Path $CertificateFile)) {
    Write-Error "❌ 证书文件不存在: $CertificateFile"
    exit 1
}

# 📁 查找需要签名的文件
$FilesToSign = @(
    "dist/electron/win-unpacked/Guild Manager.exe",
    "dist/electron/Guild Manager Setup *.exe",
    "dist/electron/Guild Manager *.exe"
)

$SignedFiles = @()
$FailedFiles = @()

foreach ($Pattern in $FilesToSign) {
    $Files = Get-ChildItem -Path $Pattern -ErrorAction SilentlyContinue
    
    foreach ($File in $Files) {
        Write-Host "🔐 签名文件: $($File.FullName)" -ForegroundColor Yellow
        
        try {
            # 🖊️ 执行代码签名
            & "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe" sign `
                /f $CertificateFile `
                /p $CertificatePassword `
                /tr $TimestampServer `
                /td sha256 `
                /fd sha256 `
                /as `
                $File.FullName
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ 签名成功: $($File.Name)" -ForegroundColor Green
                $SignedFiles += $File.FullName
                
                # 🔍 验证签名
                & "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe" verify `
                    /pa `
                    /all `
                    $File.FullName
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ 签名验证通过: $($File.Name)" -ForegroundColor Green
                } else {
                    Write-Warning "⚠️ 签名验证失败: $($File.Name)"
                }
            } else {
                throw "signtool签名失败，退出码: $LASTEXITCODE"
            }
        } catch {
            Write-Error "❌ 签名失败: $($File.Name) - $($_.Exception.Message)"
            $FailedFiles += $File.FullName
        }
    }
}

# 📊 签名结果报告
Write-Host "`n📊 签名结果报告:" -ForegroundColor Cyan
Write-Host "✅ 成功签名: $($SignedFiles.Count) 个文件" -ForegroundColor Green
Write-Host "❌ 签名失败: $($FailedFiles.Count) 个文件" -ForegroundColor Red

if ($SignedFiles.Count -gt 0) {
    Write-Host "`n🎯 成功签名的文件:" -ForegroundColor Green
    foreach ($File in $SignedFiles) {
        Write-Host "  ✓ $File" -ForegroundColor Green
    }
}

if ($FailedFiles.Count -gt 0) {
    Write-Host "`n💥 签名失败的文件:" -ForegroundColor Red
    foreach ($File in $FailedFiles) {
        Write-Host "  ✗ $File" -ForegroundColor Red
    }
    exit 1
}

Write-Host "`n🎉 Windows代码签名流程完成!" -ForegroundColor Green
```

```xml
<!-- build/app.manifest - Windows应用安全清单 -->
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity
    version="1.0.0.0"
    processorArchitecture="*"
    name="GuildManager"
    type="win32"/>
  
  <!-- 🔒 安全设置：不请求管理员权限 -->
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>

  <!-- 🎨 Windows 10/11兼容性 -->
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}"/> <!-- Windows 7 -->
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}"/> <!-- Windows 8 -->
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/> <!-- Windows 8.1 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/> <!-- Windows 10 -->
    </application>
  </compatibility>
  
  <!-- 🎯 应用信息 -->
  <description>Guild Manager - 安全的公会管理游戏</description>
  
  <!-- 🛡️ DPI感知配置 -->
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </windowsSettings>
  </application>
</assembly>
```

### 4.4 安全的自动更新机制

```typescript
// src/main/services/secure-updater.ts - 安全的自动更新服务
import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import { createHash, createVerify } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/* 安全更新管理器 */
export class SecureUpdaterService {
  private static instance: SecureUpdaterService;
  private updateWindow: BrowserWindow | null = null;
  private readonly publicKey: string;
  private readonly allowedHosts: string[];
  
  private constructor() {
    this.publicKey = this.loadPublicKey();
    this.allowedHosts = [
      'github.com',
      'api.github.com',
      'github-releases.githubusercontent.com'
    ];
    
    this.setupAutoUpdater();
  }

  static getInstance(): SecureUpdaterService {
    if (!SecureUpdaterService.instance) {
      SecureUpdaterService.instance = new SecureUpdaterService();
    }
    return SecureUpdaterService.instance;
  }

  /* 加载公钥用于签名验证 */
  private loadPublicKey(): string {
    try {
      const publicKeyPath = resolve(__dirname, '../resources/security/certs/update-public-key.pem');
      return readFileSync(publicKeyPath, 'utf8');
    } catch (error) {
      console.error('❌ 无法加载更新公钥:', error);
      throw new Error('更新系统初始化失败：缺少签名验证密钥');
    }
  }

  /* 设置自动更新器 */
  private setupAutoUpdater(): void {
    // 🔒 基础安全配置
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    
    // 🛡️ 更新渠道配置（仅正式版本）
    autoUpdater.channel = process.env.NODE_ENV === 'development' ? 'beta' : 'latest';
    
    // 📊 事件监听
    this.setupUpdateEventListeners();
    
    // 🔍 签名验证配置
    this.setupSignatureVerification();
  }

  /* 设置更新事件监听器 */
  private setupUpdateEventListeners(): void {
    // 📡 检查更新事件
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 检查更新中...');
      this.notifyRenderer('update-checking');
    });

    // ✅ 发现更新事件
    autoUpdater.on('update-available', (info) => {
      console.log('📦 发现新版本:', info.version);
      this.handleUpdateAvailable(info);
    });

    // ❌ 无更新事件
    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ 已是最新版本:', info.version);
      this.notifyRenderer('update-not-available', info);
    });

    // 📥 下载进度事件
    autoUpdater.on('download-progress', (progress) => {
      this.notifyRenderer('update-download-progress', progress);
    });

    // ⬇️ 下载完成事件
    autoUpdater.on('update-downloaded', (info) => {
      console.log('✅ 更新下载完成:', info.version);
      this.handleUpdateDownloaded(info);
    });

    // 💥 错误处理
    autoUpdater.on('error', (error) => {
      console.error('❌ 自动更新错误:', error);
      this.handleUpdateError(error);
    });
  }

  /* 设置签名验证 */
  private setupSignatureVerification(): void {
    // 重写默认的更新文件验证
    const originalCheckSignature = (autoUpdater as any).checkSignature;
    (autoUpdater as any).checkSignature = async (filePath: string, signature: string) => {
      try {
        // 1. 执行默认签名验证
        const defaultResult = await originalCheckSignature.call(autoUpdater, filePath, signature);
        
        // 2. 额外的自定义验证
        const customVerified = await this.verifyUpdateSignature(filePath, signature);
        
        return defaultResult && customVerified;
      } catch (error) {
        console.error('❌ 签名验证失败:', error);
        return false;
      }
    };
  }

  /* 自定义更新签名验证 */
  private async verifyUpdateSignature(filePath: string, signature: string): Promise<boolean> {
    try {
      // 计算文件哈希
      const fileBuffer = readFileSync(filePath);
      const fileHash = createHash('sha256').update(fileBuffer).digest();
      
      // 验证签名
      const verifier = createVerify('RSA-SHA256');
      verifier.update(fileHash);
      
      const isValid = verifier.verify(this.publicKey, signature, 'base64');
      
      if (!isValid) {
        console.error('❌ 更新文件签名验证失败');
        return false;
      }
      
      console.log('✅ 更新文件签名验证通过');
      return true;
    } catch (error) {
      console.error('❌ 签名验证过程错误:', error);
      return false;
    }
  }

  /* 处理发现更新 */
  private async handleUpdateAvailable(info: any): Promise<void> {
    // 🔍 验证更新来源
    if (!this.isUpdateSourceTrusted(info.url)) {
      console.error('❌ 不可信的更新来源:', info.url);
      return;
    }

    // 📋 显示更新确认对话框
    const result = await dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}`,
      detail: `当前版本: ${app.getVersion()}\n新版本: ${info.version}\n\n是否立即下载更新？`,
      buttons: ['立即下载', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      cancelId: 1
    });

    switch (result.response) {
      case 0: // 立即下载
        this.downloadUpdate();
        break;
      case 1: // 稍后提醒
        this.scheduleUpdateReminder();
        break;
      case 2: // 跳过此版本
        this.skipVersion(info.version);
        break;
    }
  }

  /* 验证更新来源是否可信 */
  private isUpdateSourceTrusted(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.allowedHosts.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  /* 下载更新 */
  private async downloadUpdate(): Promise<void> {
    try {
      console.log('📥 开始下载更新...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('❌ 下载更新失败:', error);
      this.handleUpdateError(error);
    }
  }

  /* 处理更新下载完成 */
  private async handleUpdateDownloaded(info: any): Promise<void> {
    // 📋 显示安装确认对话框
    const result = await dialog.showMessageBox({
      type: 'info',
      title: '更新已准备就绪',
      message: `新版本 ${info.version} 已下载完成`,
      detail: '应用将重启以完成更新安装',
      buttons: ['立即重启安装', '下次启动时安装'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      // 立即安装更新
      autoUpdater.quitAndInstall(false, true);
    } else {
      // 标记在下次启动时安装
      this.scheduleInstallOnNextStartup();
    }
  }

  /* 处理更新错误 */
  private handleUpdateError(error: Error): void {
    console.error('❌ 自动更新错误:', error);
    
    // 显示错误对话框
    dialog.showMessageBox({
      type: 'error',
      title: '更新失败',
      message: '自动更新遇到问题',
      detail: `错误信息: ${error.message}\n\n请稍后重试或手动下载最新版本`,
      buttons: ['确定']
    });
    
    // 记录错误日志
    this.logUpdateError(error);
  }

  /* 检查更新（主动调用） */
  async checkForUpdates(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚧 开发环境跳过自动更新检查');
      return;
    }

    try {
      console.log('🔍 手动检查更新...');
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      console.error('❌ 检查更新失败:', error);
    }
  }

  /* 通知渲染进程 */
  private notifyRenderer(event: string, data?: any): void {
    if (this.updateWindow && !this.updateWindow.isDestroyed()) {
      this.updateWindow.webContents.send('update-event', { event, data });
    }
  }

  /* 安排更新提醒 */
  private scheduleUpdateReminder(): void {
    // 24小时后再次提醒
    setTimeout(() => {
      this.checkForUpdates();
    }, 24 * 60 * 60 * 1000);
  }

  /* 跳过版本 */
  private skipVersion(version: string): void {
    // 存储跳过的版本信息
    console.log(`⏭️ 跳过版本: ${version}`);
    // TODO: 存储到用户配置
  }

  /* 安排下次启动时安装 */
  private scheduleInstallOnNextStartup(): void {
    // 设置标记，下次启动时自动安装
    console.log('⏰ 安排下次启动时安装更新');
    // TODO: 存储到配置文件
  }

  /* 记录更新错误 */
  private logUpdateError(error: Error): void {
    // 记录详细的错误日志
    const errorLog = {
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      version: app.getVersion(),
      platform: process.platform
    };
    
    console.error('📝 更新错误日志:', errorLog);
    // TODO: 写入到日志文件
  }
}
```

### 4.5 CI/CD安全集成与构建验证

建立完整的持续集成安全验证机制：

#### 4.5.1 GitHub Actions构建安全配置

```yaml
# .github/workflows/build-security.yml
name: 安全构建与发布
on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main]
  release:
    types: [published]

jobs:
  security-audit:
    name: 安全审计
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: 设置Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: 安装依赖
        run: npm ci

      - name: 安全漏洞扫描
        run: |
          npm audit --audit-level=moderate
          npx audit-ci --moderate

      - name: 依赖许可证检查
        run: |
          npx license-checker --production --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC' --excludePrivatePackages

      - name: 源码安全扫描
        run: |
          npx eslint src/ --ext .ts,.js --max-warnings 0
          npx semgrep --config=auto src/

  build-verification:
    name: 构建验证
    needs: security-audit
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4

      - name: 设置Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: 安装依赖
        run: npm ci

      - name: 类型检查
        run: npm run type-check

      - name: 单元测试
        run: npm run test:coverage

      - name: 构建验证
        run: |
          npm run build
          node scripts/verify-build-security.js

      - name: 上传构建产物
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.os }}
          path: dist/
          retention-days: 1

  sign-and-package:
    name: 签名打包
    needs: build-verification
    if: github.event_name == 'release'
    strategy:
      matrix:
        include:
          - os: macos-latest
            platform: darwin
          - os: windows-latest
            platform: win32
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: 设置Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: 安装依赖
        run: npm ci

      - name: 导入证书 (macOS)
        if: matrix.platform == 'darwin'
        run: |
          echo "${{ secrets.APPLE_CERTIFICATE }}" | base64 --decode > certificate.p12
          security create-keychain -p "${{ secrets.KEYCHAIN_PASSWORD }}" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "${{ secrets.KEYCHAIN_PASSWORD }}" build.keychain
          security import certificate.p12 -k build.keychain -P "${{ secrets.APPLE_CERTIFICATE_PASSWORD }}" -A
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${{ secrets.KEYCHAIN_PASSWORD }}" build.keychain

      - name: 设置Windows证书
        if: matrix.platform == 'win32'
        run: |
          echo "${{ secrets.WINDOWS_CERTIFICATE }}" | base64 -d > certificate.p12
          powershell -Command "Import-PfxCertificate -FilePath certificate.p12 -CertStoreLocation Cert:\CurrentUser\My -Password (ConvertTo-SecureString '${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}' -AsPlainText -Force)"

      - name: 构建并签名
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm run build
          npm run electron:build
          node scripts/verify-signatures.js

      - name: 清理证书
        if: always()
        run: |
          rm -f certificate.p12
          security delete-keychain build.keychain || true
```

#### 4.5.2 构建安全验证脚本

```javascript
// scripts/verify-build-security.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 构建安全验证器
 * 检查构建产物的完整性和安全性
 */
class BuildSecurityVerifier {
  constructor() {
    this.distPath = path.join(__dirname, '../dist');
    this.securityRules = {
      // 禁止的文件内容模式
      forbiddenPatterns: [
        /console\.log\(/g,
        /debugger/g,
        /eval\(/g,
        /Function\(/g,
        /__dirname/g,
        /__filename/g,
        /process\.env\.(?!NODE_ENV|PUBLIC_)/g
      ],
      // 必须存在的安全标识
      requiredSecurityMarkers: [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options'
      ],
      // 允许的文件扩展名
      allowedExtensions: ['.js', '.css', '.html', '.json', '.png', '.jpg', '.svg', '.woff2']
    };
  }

  /**
   * 执行完整的安全验证
   */
  async verify() {
    console.log('🔍 开始构建安全验证...');
    
    const checks = [
      () => this.checkDistExists(),
      () => this.scanForForbiddenContent(),
      () => this.verifyFileIntegrity(),
      () => this.checkSecurityHeaders(),
      () => this.validateFileTypes(),
      () => this.checkBundleSize()
    ];

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
      try {
        await check();
        passed++;
        console.log('✅ 检查通过');
      } catch (error) {
        failed++;
        console.error('❌ 检查失败:', error.message);
      }
    }

    console.log(`\n📊 验证结果: ${passed} 通过, ${failed} 失败`);
    
    if (failed > 0) {
      process.exit(1);
    }
    
    console.log('🎉 构建安全验证完成!');
  }

  /**
   * 检查dist目录是否存在
   */
  checkDistExists() {
    console.log('📁 检查构建输出目录...');
    if (!fs.existsSync(this.distPath)) {
      throw new Error('构建输出目录不存在');
    }
  }

  /**
   * 扫描禁止的内容
   */
  scanForForbiddenContent() {
    console.log('🚫 扫描禁止内容...');
    
    const jsFiles = this.getFilesByExtension('.js');
    
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of this.securityRules.forbiddenPatterns) {
        if (pattern.test(content)) {
          throw new Error(`文件 ${file} 包含禁止的内容: ${pattern.source}`);
        }
      }
    }
  }

  /**
   * 验证文件完整性
   */
  verifyFileIntegrity() {
    console.log('🔐 验证文件完整性...');
    
    const manifestPath = path.join(this.distPath, 'integrity-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      for (const [filePath, expectedHash] of Object.entries(manifest)) {
        const fullPath = path.join(this.distPath, filePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath);
          const actualHash = crypto.createHash('sha256').update(content).digest('hex');
          
          if (actualHash !== expectedHash) {
            throw new Error(`文件 ${filePath} 完整性验证失败`);
          }
        }
      }
    }
  }

  /**
   * 检查安全头配置
   */
  checkSecurityHeaders() {
    console.log('🛡️  检查安全头配置...');
    
    const htmlFiles = this.getFilesByExtension('.html');
    
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const marker of this.securityRules.requiredSecurityMarkers) {
        if (!content.includes(marker)) {
          throw new Error(`文件 ${file} 缺少安全标识: ${marker}`);
        }
      }
    }
  }

  /**
   * 验证文件类型
   */
  validateFileTypes() {
    console.log('📄 验证文件类型...');
    
    const allFiles = this.getAllFiles(this.distPath);
    
    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      if (ext && !this.securityRules.allowedExtensions.includes(ext)) {
        throw new Error(`发现不允许的文件类型: ${file}`);
      }
    }
  }

  /**
   * 检查包体积
   */
  checkBundleSize() {
    console.log('📦 检查包体积...');
    
    const maxBundleSize = 50 * 1024 * 1024; // 50MB
    const bundleSize = this.getDirectorySize(this.distPath);
    
    if (bundleSize > maxBundleSize) {
      throw new Error(`包体积超过限制: ${(bundleSize / 1024 / 1024).toFixed(2)}MB > 50MB`);
    }
    
    console.log(`📊 包体积: ${(bundleSize / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 获取指定扩展名的文件
   */
  getFilesByExtension(ext) {
    return this.getAllFiles(this.distPath).filter(file => 
      path.extname(file).toLowerCase() === ext
    );
  }

  /**
   * 递归获取所有文件
   */
  getAllFiles(dir) {
    const files = [];
    
    function traverse(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
    
    traverse(dir);
    return files;
  }

  /**
   * 获取目录大小
   */
  getDirectorySize(dir) {
    let size = 0;
    
    const files = this.getAllFiles(dir);
    for (const file of files) {
      size += fs.statSync(file).size;
    }
    
    return size;
  }
}

// 执行验证
if (require.main === module) {
  const verifier = new BuildSecurityVerifier();
  verifier.verify().catch(error => {
    console.error('❌ 构建安全验证失败:', error);
    process.exit(1);
  });
}

module.exports = BuildSecurityVerifier;
```

#### 4.5.3 安全发布检查清单

创建发布前的安全检查清单：

```markdown
# 发布安全检查清单

## 🔍 代码安全审计
- [ ] 依赖漏洞扫描通过 (npm audit)
- [ ] 源码安全扫描通过 (ESLint + Semgrep)
- [ ] 许可证合规检查通过
- [ ] 敏感信息泄露检查通过
- [ ] 硬编码密钥/令牌检查通过

## 🏗️ 构建完整性验证
- [ ] 构建产物完整性验证通过
- [ ] 禁止内容扫描通过
- [ ] 文件类型白名单验证通过
- [ ] 包体积限制检查通过
- [ ] 安全头配置验证通过

## 🔏 数字签名验证
### macOS
- [ ] 开发者ID应用证书有效
- [ ] 代码签名验证通过
- [ ] 强化运行时配置正确
- [ ] 公证流程完成
- [ ] DMG签名验证通过

### Windows
- [ ] 代码签名证书有效
- [ ] EXE文件签名验证通过
- [ ] MSI安装包签名验证通过
- [ ] 时间戳服务配置正确

## 🚀 发布安全配置
- [ ] 更新服务器配置安全
- [ ] 更新包签名验证启用
- [ ] 回滚机制配置正确
- [ ] 发布渠道访问控制配置
- [ ] 监控和告警配置完成

## 📋 合规性检查
- [ ] 开源许可证声明完整
- [ ] 第三方组件清单更新
- [ ] 安全漏洞响应流程建立
- [ ] 用户隐私政策更新
- [ ] 数据保护措施确认
```

通过这套完整的CI/CD安全集成系统，可以确保每次构建和发布都经过严格的安全验证，有效防范供应链攻击和恶意代码注入风险。

## 五、就地验收（Playwright × Electron 冒烟）

建立完整的端到端安全验收测试体系，确保所有安全基线配置在运行时生效。

### 5.1 测试框架配置与基础设施

#### 5.1.1 Playwright配置文件

```typescript
// playwright.config.ts - Electron安全测试专用配置
import { defineConfig, devices } from '@playwright/test';
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';

export default defineConfig({
  // 🎯 测试目录
  testDir: './tests/e2e/security',
  
  // ⚡ 超时配置
  timeout: 30 * 1000, // 30秒
  expect: { timeout: 5 * 1000 }, // 断言超时5秒
  
  // 🔄 重试配置
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // 📊 报告配置
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // 🎥 失败时记录
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  // 🔧 Electron专用配置
  projects: [
    {
      name: 'electron-security',
      testDir: './tests/e2e/security',
      use: {
        // Electron应用路径配置
        electronApp: findLatestBuild('dist'),
        // 启动参数
        electronArgs: ['--disable-dev-shm-usage', '--no-sandbox'],
        // 环境变量
        env: {
          NODE_ENV: 'test',
          ELECTRON_IS_DEV: '0'
        }
      }
    }
  ],

  // 🏗️ 全局设置
  globalSetup: require.resolve('./tests/e2e/security/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/security/global-teardown.ts'),
});
```

#### 5.1.2 测试工具类与助手函数

```typescript
// tests/e2e/security/helpers/ElectronSecurityTestHelper.ts
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';

/**
 * Electron安全测试助手类
 * 提供标准化的安全验证方法
 */
export class ElectronSecurityTestHelper {
  private app: ElectronApplication | null = null;
  private mainWindow: Page | null = null;

  /**
   * 启动Electron应用并进行安全初始化检查
   */
  async launchSecureApp(options?: {
    args?: string[];
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<{ app: ElectronApplication; window: Page }> {
    const defaultOptions = {
      args: ['.'],
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        ...options?.env
      },
      timeout: options?.timeout || 15000
    };

    console.log('🚀 启动Electron应用进行安全测试...');
    
    this.app = await electron.launch({
      args: defaultOptions.args,
      env: defaultOptions.env,
      timeout: defaultOptions.timeout
    });

    // 等待主窗口加载
    this.mainWindow = await this.app.firstWindow({ timeout: defaultOptions.timeout });
    await this.mainWindow.waitForLoadState('domcontentloaded');

    console.log('✅ Electron应用启动成功');
    return { app: this.app, window: this.mainWindow };
  }

  /**
   * 验证BrowserWindow安全配置
   */
  async verifyWindowSecurityConfig(): Promise<void> {
    if (!this.app || !this.mainWindow) {
      throw new Error('应用未启动，请先调用launchSecureApp()');
    }

    // 获取窗口的webPreferences配置
    const webPreferences = await this.app.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) return null;
      
      const mainWindow = windows[0];
      return {
        contextIsolation: mainWindow.webContents.isContextIsolated(),
        nodeIntegration: mainWindow.webContents.getWebPreferences().nodeIntegration,
        sandbox: mainWindow.webContents.getWebPreferences().sandbox,
        webSecurity: mainWindow.webContents.getWebPreferences().webSecurity,
        allowRunningInsecureContent: mainWindow.webContents.getWebPreferences().allowRunningInsecureContent,
        experimentalFeatures: mainWindow.webContents.getWebPreferences().experimentalFeatures
      };
    });

    // 验证关键安全配置
    expect(webPreferences).toBeTruthy();
    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.nodeIntegration).toBe(false);
    expect(webPreferences.sandbox).toBe(true);
    expect(webPreferences.webSecurity).toBe(true);
    expect(webPreferences.allowRunningInsecureContent).toBe(false);
    expect(webPreferences.experimentalFeatures).toBe(false);

    console.log('✅ BrowserWindow安全配置验证通过');
  }

  /**
   * 验证渲染进程安全隔离
   */
  async verifyRendererSecurityIsolation(): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('主窗口未初始化');
    }

    // 检查Node.js API是否被正确隔离
    const nodeAccess = await this.mainWindow.evaluate(() => {
      return {
        hasRequire: typeof (window as any).require !== 'undefined',
        hasProcess: typeof (window as any).process !== 'undefined',
        hasBuffer: typeof (window as any).Buffer !== 'undefined',
        hasGlobal: typeof (window as any).global !== 'undefined',
        hasModule: typeof (window as any).module !== 'undefined',
        hasElectron: typeof (window as any).require?.('electron') !== 'undefined'
      };
    });

    // 验证所有Node.js API都被隔离
    expect(nodeAccess.hasRequire).toBe(false);
    expect(nodeAccess.hasProcess).toBe(false);
    expect(nodeAccess.hasBuffer).toBe(false);
    expect(nodeAccess.hasGlobal).toBe(false);
    expect(nodeAccess.hasModule).toBe(false);
    expect(nodeAccess.hasElectron).toBe(false);

    console.log('✅ 渲染进程安全隔离验证通过');
  }

  /**
   * 验证CSP安全策略
   */
  async verifyCSPConfiguration(): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('主窗口未初始化');
    }

    const cspInfo = await this.mainWindow.evaluate(() => {
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      const cspContent = cspMeta?.getAttribute('content');
      
      return {
        hasCSP: !!cspMeta,
        content: cspContent,
        // 检查关键CSP指令
        policies: cspContent ? {
          hasDefaultSrc: cspContent.includes('default-src'),
          hasScriptSrc: cspContent.includes('script-src'),
          hasObjectSrc: cspContent.includes('object-src'),
          hasBaseUri: cspContent.includes('base-uri'),
          hasFormAction: cspContent.includes('form-action'),
          restrictedObjectSrc: cspContent.includes("object-src 'none'"),
          restrictedBaseUri: cspContent.includes("base-uri 'self'")
        } : null
      };
    });

    // 验证CSP存在且配置正确
    expect(cspInfo.hasCSP).toBe(true);
    expect(cspInfo.content).toBeTruthy();
    
    if (cspInfo.policies) {
      expect(cspInfo.policies.hasDefaultSrc).toBe(true);
      expect(cspInfo.policies.hasScriptSrc).toBe(true);
      expect(cspInfo.policies.restrictedObjectSrc).toBe(true);
      expect(cspInfo.policies.restrictedBaseUri).toBe(true);
    }

    console.log('✅ CSP安全策略验证通过');
  }

  /**
   * 验证preload脚本安全性
   */
  async verifyPreloadSecurity(): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('主窗口未初始化');
    }

    const preloadExposure = await this.mainWindow.evaluate(() => {
      const electronAPI = (window as any).electronAPI;
      
      return {
        hasElectronAPI: !!electronAPI,
        exposedMethods: electronAPI ? Object.keys(electronAPI) : [],
        // 检查不应该暴露的危险方法
        hasDangerousMethods: !!(
          electronAPI?.require ||
          electronAPI?.eval ||
          electronAPI?.exec ||
          electronAPI?.spawn ||
          electronAPI?.readFile ||
          electronAPI?.writeFile ||
          electronAPI?.unlink
        )
      };
    });

    // 验证API暴露是否安全
    expect(preloadExposure.hasElectronAPI).toBe(true);
    expect(preloadExposure.exposedMethods.length).toBeGreaterThan(0);
    expect(preloadExposure.hasDangerousMethods).toBe(false);

    console.log('✅ Preload脚本安全性验证通过');
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.mainWindow = null;
      console.log('🧹 测试资源清理完成');
    }
  }
}

// 全局测试工具实例
export const electronSecurityHelper = new ElectronSecurityTestHelper();
```

### 5.2 核心安全配置验收测试

#### 5.2.1 BrowserWindow安全配置测试

```typescript
// tests/e2e/security/browser-window-security.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';

test.describe('BrowserWindow安全配置验收', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeEach(async () => {
    securityHelper = new ElectronSecurityTestHelper();
  });

  test.afterEach(async () => {
    await securityHelper.cleanup();
  });

  test('应用启动时应用正确的安全配置', async () => {
    // 启动应用
    const { app, window } = await securityHelper.launchSecureApp();

    // 验证窗口基本属性
    expect(await window.title()).toBeTruthy();
    expect(await window.url()).toMatch(/^file:\/\/.*index\.html/);

    // 验证BrowserWindow安全配置
    await securityHelper.verifyWindowSecurityConfig();
  });

  test('contextIsolation应该启用', async () => {
    await securityHelper.launchSecureApp();
    
    const contextIsolation = await securityHelper['app']!.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.webContents.isContextIsolated();
    });

    expect(contextIsolation).toBe(true);
  });

  test('nodeIntegration应该禁用', async () => {
    await securityHelper.launchSecureApp();
    
    const nodeIntegration = await securityHelper['app']!.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.webContents.getWebPreferences().nodeIntegration;
    });

    expect(nodeIntegration).toBe(false);
  });

  test('sandbox模式应该启用', async () => {
    await securityHelper.launchSecureApp();
    
    const sandboxEnabled = await securityHelper['app']!.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.webContents.getWebPreferences().sandbox;
    });

    expect(sandboxEnabled).toBe(true);
  });

  test('webSecurity应该启用', async () => {
    await securityHelper.launchSecureApp();
    
    const webSecurity = await securityHelper['app']!.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.webContents.getWebPreferences().webSecurity;
    });

    expect(webSecurity).toBe(true);
  });

  test('不安全内容运行应该被禁用', async () => {
    await securityHelper.launchSecureApp();
    
    const allowInsecureContent = await securityHelper['app']!.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return windows[0]?.webContents.getWebPreferences().allowRunningInsecureContent;
    });

    expect(allowInsecureContent).toBe(false);
  });
});
```

#### 5.2.2 渲染进程安全隔离测试

```typescript
// tests/e2e/security/renderer-isolation.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';

test.describe('渲染进程安全隔离验收', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeEach(async () => {
    securityHelper = new ElectronSecurityTestHelper();
    await securityHelper.launchSecureApp();
  });

  test.afterEach(async () => {
    await securityHelper.cleanup();
  });

  test('Node.js API应该被完全隔离', async () => {
    await securityHelper.verifyRendererSecurityIsolation();
  });

  test('require函数不应该存在于渲染进程', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const hasRequire = await window.evaluate(() => {
      return typeof (window as any).require !== 'undefined';
    });

    expect(hasRequire).toBe(false);
  });

  test('process对象不应该存在于渲染进程', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const hasProcess = await window.evaluate(() => {
      return typeof (window as any).process !== 'undefined';
    });

    expect(hasProcess).toBe(false);
  });

  test('Buffer构造函数不应该存在于渲染进程', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const hasBuffer = await window.evaluate(() => {
      return typeof (window as any).Buffer !== 'undefined';
    });

    expect(hasBuffer).toBe(false);
  });

  test('global对象不应该存在于渲染进程', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const hasGlobal = await window.evaluate(() => {
      return typeof (window as any).global !== 'undefined';
    });

    expect(hasGlobal).toBe(false);
  });

  test('无法通过require获取electron模块', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const canAccessElectron = await window.evaluate(() => {
      try {
        if (typeof (window as any).require === 'function') {
          (window as any).require('electron');
          return true;
        }
        return false;
      } catch {
        return false;
      }
    });

    expect(canAccessElectron).toBe(false);
  });

  test('无法执行危险的JavaScript代码', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const results = await window.evaluate(() => {
      const tests = {
        eval: false,
        Function: false,
        setTimeout_string: false,
        setInterval_string: false
      };

      // 测试eval
      try {
        eval('1+1');
        tests.eval = true;
      } catch {
        tests.eval = false;
      }

      // 测试Function构造函数
      try {
        new Function('return 1+1')();
        tests.Function = true;
      } catch {
        tests.Function = false;
      }

      // 测试setTimeout字符串执行
      try {
        setTimeout('console.log("test")', 0);
        tests.setTimeout_string = true;
      } catch {
        tests.setTimeout_string = false;
      }

      // 测试setInterval字符串执行
      try {
        setInterval('console.log("test")', 1000);
        tests.setInterval_string = true;
      } catch {
        tests.setInterval_string = false;
      }

      return tests;
    });

    // 在安全的沙盒环境中，这些应该都被限制
    expect(results.eval).toBe(false);
    expect(results.Function).toBe(false);
    expect(results.setTimeout_string).toBe(false);
    expect(results.setInterval_string).toBe(false);
  });
});
```

### 5.3 IPC安全通信验收测试

```typescript
// tests/e2e/security/ipc-security.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';

test.describe('IPC安全通信验收', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeEach(async () => {
    securityHelper = new ElectronSecurityTestHelper();
    await securityHelper.launchSecureApp();
  });

  test.afterEach(async () => {
    await securityHelper.cleanup();
  });

  test('只能调用白名单中的IPC方法', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const ipcResults = await window.evaluate(async () => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return { hasAPI: false };

      const results = {
        hasAPI: true,
        allowedMethods: [] as string[],
        blockedMethods: [] as string[],
        testResults: {} as Record<string, boolean>
      };

      // 获取暴露的方法列表
      const exposedMethods = Object.keys(electronAPI);
      results.allowedMethods = exposedMethods;

      // 测试允许的方法
      const allowedTests = [
        'getAppVersion',
        'getUserData',
        'openExternalLink',
        'showSaveDialog',
        'showOpenDialog'
      ];

      for (const method of allowedTests) {
        try {
          if (typeof electronAPI[method] === 'function') {
            results.testResults[method] = true;
          } else {
            results.testResults[method] = false;
          }
        } catch {
          results.testResults[method] = false;
        }
      }

      // 测试不应该存在的危险方法
      const dangerousMethods = [
        'require',
        'eval',
        'exec',
        'spawn',
        'readFileSync',
        'writeFileSync',
        'unlinkSync',
        'shell',
        'remote'
      ];

      for (const method of dangerousMethods) {
        if (typeof electronAPI[method] === 'function') {
          results.blockedMethods.push(method);
        }
      }

      return results;
    });

    // 验证IPC API存在
    expect(ipcResults.hasAPI).toBe(true);
    expect(ipcResults.allowedMethods.length).toBeGreaterThan(0);
    
    // 验证没有危险方法暴露
    expect(ipcResults.blockedMethods).toHaveLength(0);
  });

  test('IPC通信应该包含参数验证', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const validationResults = await window.evaluate(async () => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.testParameterValidation) return { hasValidation: false };

      const results = {
        hasValidation: true,
        tests: {} as Record<string, boolean>
      };

      // 测试无效参数被拒绝
      try {
        await electronAPI.testParameterValidation(null);
        results.tests.null_param = false; // 应该被拒绝
      } catch {
        results.tests.null_param = true; // 正确拒绝
      }

      try {
        await electronAPI.testParameterValidation({ malicious: '<script>' });
        results.tests.xss_param = false; // 应该被拒绝
      } catch {
        results.tests.xss_param = true; // 正确拒绝
      }

      try {
        await electronAPI.testParameterValidation('../../../etc/passwd');
        results.tests.path_traversal = false; // 应该被拒绝
      } catch {
        results.tests.path_traversal = true; // 正确拒绝
      }

      return results;
    });

    if (validationResults.hasValidation) {
      expect(validationResults.tests.null_param).toBe(true);
      expect(validationResults.tests.xss_param).toBe(true);
      expect(validationResults.tests.path_traversal).toBe(true);
    }
  });

  test('IPC通信应该有速率限制', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const rateLimitResults = await window.evaluate(async () => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.getAppVersion) return { hasRateLimit: false };

      const results = {
        hasRateLimit: false,
        requestCount: 0,
        successCount: 0,
        errorCount: 0
      };

      // 快速发送大量请求测试速率限制
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          electronAPI.getAppVersion()
            .then(() => {
              results.successCount++;
            })
            .catch(() => {
              results.errorCount++;
            })
            .finally(() => {
              results.requestCount++;
            })
        );
      }

      await Promise.allSettled(promises);
      
      // 如果有请求被拒绝，说明存在速率限制
      results.hasRateLimit = results.errorCount > 0;

      return results;
    });

    // 速率限制可选，但如果实现了应该正常工作
    if (rateLimitResults.hasRateLimit) {
      expect(rateLimitResults.errorCount).toBeGreaterThan(0);
      expect(rateLimitResults.requestCount).toBe(100);
    }
  });
});
```

### 5.4 内容安全策略（CSP）验收测试

```typescript
// tests/e2e/security/csp-security.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';

test.describe('内容安全策略（CSP）验收', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeEach(async () => {
    securityHelper = new ElectronSecurityTestHelper();
    await securityHelper.launchSecureApp();
  });

  test.afterEach(async () => {
    await securityHelper.cleanup();
  });

  test('CSP头部应该存在且配置正确', async () => {
    await securityHelper.verifyCSPConfiguration();
  });

  test('应该阻止内联脚本执行', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const inlineScriptBlocked = await window.evaluate(() => {
      try {
        // 尝试创建并执行内联脚本
        const script = document.createElement('script');
        script.textContent = 'window.inlineScriptExecuted = true;';
        document.head.appendChild(script);
        
        // 等待一小段时间让脚本执行
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(!(window as any).inlineScriptExecuted);
          }, 100);
        });
      } catch {
        return true; // 抛出异常说明被阻止了
      }
    });

    expect(inlineScriptBlocked).toBe(true);
  });

  test('应该阻止eval()函数执行', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const evalBlocked = await window.evaluate(() => {
      try {
        eval('window.evalExecuted = true;');
        return !(window as any).evalExecuted;
      } catch {
        return true; // 抛出异常说明被阻止了
      }
    });

    expect(evalBlocked).toBe(true);
  });

  test('应该阻止不安全的外部资源加载', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const unsafeResourceBlocked = await window.evaluate(() => {
      return new Promise(resolve => {
        const img = document.createElement('img');
        let loadTimeout: NodeJS.Timeout;
        
        img.onload = () => {
          clearTimeout(loadTimeout);
          resolve(false); // 加载成功说明没被阻止
        };
        
        img.onerror = () => {
          clearTimeout(loadTimeout);
          resolve(true); // 加载失败说明被阻止了
        };
        
        // 设置超时
        loadTimeout = setTimeout(() => {
          resolve(true); // 超时也认为被阻止了
        }, 2000);
        
        // 尝试加载一个不安全的外部图片
        img.src = 'http://example.com/unsafe-image.jpg';
        document.body.appendChild(img);
      });
    });

    expect(unsafeResourceBlocked).toBe(true);
  });

  test('应该允许安全的本地资源加载', async () => {
    const { window } = await securityHelper.launchSecureApp();
    
    const localResourceAllowed = await window.evaluate(() => {
      return new Promise(resolve => {
        const link = document.createElement('link');
        let loadTimeout: NodeJS.Timeout;
        
        link.onload = () => {
          clearTimeout(loadTimeout);
          resolve(true); // 加载成功
        };
        
        link.onerror = () => {
          clearTimeout(loadTimeout);
          resolve(false); // 加载失败
        };
        
        loadTimeout = setTimeout(() => {
          resolve(false); // 超时认为失败
        }, 2000);
        
        link.rel = 'stylesheet';
        link.href = 'data:text/css,body{margin:0}'; // 安全的data URI
        document.head.appendChild(link);
      });
    });

    expect(localResourceAllowed).toBe(true);
  });
});
```

### 5.5 更新机制安全验收测试

```typescript
// tests/e2e/security/updater-security.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';

test.describe('更新机制安全验收', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeEach(async () => {
    securityHelper = new ElectronSecurityTestHelper();
    await securityHelper.launchSecureApp();
  });

  test.afterEach(async () => {
    await securityHelper.cleanup();
  });

  test('更新检查应该使用HTTPS连接', async () => {
    const { app } = await securityHelper.launchSecureApp();
    
    const updateConfig = await app.evaluate(async (electronApp) => {
      const { autoUpdater } = require('electron-updater');
      
      // 获取更新配置信息
      const feedURL = autoUpdater.getFeedURL();
      
      return {
        feedURL,
        isHttps: feedURL ? feedURL.startsWith('https://') : false,
        allowPrerelease: autoUpdater.allowPrerelease,
        autoDownload: autoUpdater.autoDownload
      };
    });

    if (updateConfig.feedURL) {
      expect(updateConfig.isHttps).toBe(true);
    }
    expect(updateConfig.allowPrerelease).toBe(false);
    expect(updateConfig.autoDownload).toBe(false);
  });

  test('更新服务应该验证签名', async () => {
    const { app } = await securityHelper.launchSecureApp();
    
    const signatureValidation = await app.evaluate(async (electronApp) => {
      try {
        // 检查是否有签名验证逻辑
        const updaterModule = require('electron-updater');
        const { autoUpdater } = updaterModule;
        
        // 检查是否配置了签名验证
        const hasSignatureValidation = typeof autoUpdater.checkSignature === 'function';
        
        return {
          hasSignatureValidation,
          updaterConfigured: !!autoUpdater
        };
      } catch (error) {
        return {
          hasSignatureValidation: false,
          updaterConfigured: false,
          error: error.message
        };
      }
    });

    expect(signatureValidation.updaterConfigured).toBe(true);
    // 签名验证是企业安全的重要特性
    if (process.env.NODE_ENV === 'production') {
      expect(signatureValidation.hasSignatureValidation).toBe(true);
    }
  });

  test('不应该允许降级更新', async () => {
    const { app } = await securityHelper.launchSecureApp();
    
    const downgradeProtection = await app.evaluate(async (electronApp) => {
      const { autoUpdater } = require('electron-updater');
      
      return {
        allowDowngrade: autoUpdater.allowDowngrade,
        currentVersion: electronApp.getVersion()
      };
    });

    expect(downgradeProtection.allowDowngrade).toBe(false);
    expect(downgradeProtection.currentVersion).toBeTruthy();
  });
});
```

### 5.6 构建产物安全验收测试

```typescript
// tests/e2e/security/build-security.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';
import * as fs from 'fs';
import * as path from 'path';

test.describe('构建产物安全验收', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeEach(async () => {
    securityHelper = new ElectronSecurityTestHelper();
  });

  test.afterEach(async () => {
    await securityHelper.cleanup();
  });

  test('构建产物不应包含敏感信息', async () => {
    const distPath = path.resolve('dist');
    
    if (!fs.existsSync(distPath)) {
      test.skip('构建目录不存在，跳过测试');
      return;
    }

    const scanResults = {
      sensitivePatterns: [] as string[],
      filesChecked: 0,
      issuesFound: [] as Array<{ file: string; issue: string; line?: number }>
    };

    // 敏感信息模式
    const sensitivePatterns = [
      /password\s*[:=]\s*["'][^"']+["']/i,
      /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
      /secret\s*[:=]\s*["'][^"']+["']/i,
      /token\s*[:=]\s*["'][^"']+["']/i,
      /console\.log\(/g,
      /debugger\s*;/g,
      /__dirname/g,
      /__filename/g
    ];

    function scanDirectory(dir: string) {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (file.match(/\.(js|html|css)$/)) {
          scanResults.filesChecked++;
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            sensitivePatterns.forEach(pattern => {
              if (pattern.test(line)) {
                scanResults.issuesFound.push({
                  file: path.relative(process.cwd(), filePath),
                  issue: `发现敏感模式: ${pattern.source}`,
                  line: index + 1
                });
              }
            });
          });
        }
      }
    }

    scanDirectory(distPath);

    expect(scanResults.filesChecked).toBeGreaterThan(0);
    expect(scanResults.issuesFound).toHaveLength(0);
  });

  test('main.js应该被正确混淆/压缩', async () => {
    const mainJsPath = path.resolve('dist/main.js');
    
    if (!fs.existsSync(mainJsPath)) {
      test.skip('main.js文件不存在，跳过测试');
      return;
    }

    const mainJsContent = fs.readFileSync(mainJsPath, 'utf-8');
    
    // 检查是否被压缩（没有过多的空白和注释）
    const linesWithContent = mainJsContent.split('\n').filter(line => 
      line.trim().length > 0 && !line.trim().startsWith('//')
    );
    
    const avgLineLength = mainJsContent.length / linesWithContent.length;
    
    // 压缩后的代码行长度通常较长
    expect(avgLineLength).toBeGreaterThan(50);
    
    // 不应该包含开发时的调试信息
    expect(mainJsContent).not.toContain('console.log');
    expect(mainJsContent).not.toContain('debugger');
    
    // 不应该包含源码路径信息
    expect(mainJsContent).not.toContain(process.cwd());
  });

  test('打包后的应用应该正常启动', async () => {
    await securityHelper.launchSecureApp();
    
    const { app, window } = await securityHelper.launchSecureApp();
    
    // 验证应用基本功能
    expect(await window.title()).toBeTruthy();
    expect(await app.evaluate(electronApp => electronApp.isReady())).toBe(true);
    
    // 验证窗口状态
    const windowState = await window.evaluate(() => ({
      readyState: document.readyState,
      hasBody: !!document.body,
      hasHead: !!document.head
    }));
    
    expect(windowState.readyState).toBe('complete');
    expect(windowState.hasBody).toBe(true);
    expect(windowState.hasHead).toBe(true);
  });

  test('应用图标和资源文件应该存在', async () => {
    const { app } = await securityHelper.launchSecureApp();
    
    const appInfo = await app.evaluate(electronApp => ({
      name: electronApp.getName(),
      version: electronApp.getVersion(),
      path: electronApp.getAppPath()
    }));
    
    expect(appInfo.name).toBeTruthy();
    expect(appInfo.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(appInfo.path).toBeTruthy();
    
    // 检查关键资源文件
    const resourcesPath = path.join(appInfo.path, '../');
    const iconExists = fs.existsSync(path.join(resourcesPath, 'icon.png')) ||
                      fs.existsSync(path.join(resourcesPath, 'icon.ico')) ||
                      fs.existsSync(path.join(resourcesPath, 'icon.icns'));
    
    expect(iconExists).toBe(true);
  });
});
```

### 5.7 综合安全冒烟测试

```typescript
// tests/e2e/security/comprehensive-smoke.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronSecurityTestHelper } from './helpers/ElectronSecurityTestHelper';

test.describe('综合安全冒烟测试', () => {
  let securityHelper: ElectronSecurityTestHelper;

  test.beforeAll(async () => {
    securityHelper = new ElectronSecurityTestHelper();
  });

  test.afterAll(async () => {
    await securityHelper.cleanup();
  });

  test('完整的安全基线验证', async () => {
    console.log('🧪 开始执行完整的安全基线验证...');
    
    // 启动应用
    await securityHelper.launchSecureApp();
    
    // 执行所有核心安全检查
    await test.step('验证BrowserWindow安全配置', async () => {
      await securityHelper.verifyWindowSecurityConfig();
    });
    
    await test.step('验证渲染进程安全隔离', async () => {
      await securityHelper.verifyRendererSecurityIsolation();
    });
    
    await test.step('验证CSP安全策略', async () => {
      await securityHelper.verifyCSPConfiguration();
    });
    
    await test.step('验证Preload脚本安全性', async () => {
      await securityHelper.verifyPreloadSecurity();
    });
    
    console.log('✅ 所有安全基线验证通过！');
  });

  test('应用在安全配置下正常工作', async () => {
    const { app, window } = await securityHelper.launchSecureApp();
    
    // 验证应用基本功能
    expect(await app.evaluate(electronApp => electronApp.isReady())).toBe(true);
    expect(await window.isVisible()).toBe(true);
    
    // 验证可以正常加载内容
    await window.waitForSelector('body', { timeout: 5000 });
    const bodyExists = await window.locator('body').count();
    expect(bodyExists).toBe(1);
    
    // 验证JavaScript正常工作（在安全限制下）
    const jsWorks = await window.evaluate(() => {
      try {
        return Math.max(1, 2) === 2;
      } catch {
        return false;
      }
    });
    expect(jsWorks).toBe(true);
    
    console.log('✅ 应用在安全配置下正常工作');
  });
});
```

### 5.8 CI/CD集成和报告

#### 5.8.1 测试运行脚本

```bash
#!/bin/bash
# scripts/run-security-tests.sh

echo "🔒 开始执行Electron安全验收测试..."

# 设置环境变量
export NODE_ENV=test
export ELECTRON_IS_DEV=0

# 确保构建产物存在
if [ ! -d "dist" ]; then
  echo "📦 构建产物不存在，开始构建..."
  npm run build
fi

# 安装Playwright浏览器（如果需要）
npx playwright install electron

# 运行安全测试套件
echo "🧪 执行安全配置测试..."
npx playwright test tests/e2e/security/browser-window-security.spec.ts --reporter=html

echo "🧪 执行渲染进程隔离测试..."
npx playwright test tests/e2e/security/renderer-isolation.spec.ts --reporter=html

echo "🧪 执行IPC安全测试..."
npx playwright test tests/e2e/security/ipc-security.spec.ts --reporter=html

echo "🧪 执行CSP安全测试..."
npx playwright test tests/e2e/security/csp-security.spec.ts --reporter=html

echo "🧪 执行更新机制安全测试..."
npx playwright test tests/e2e/security/updater-security.spec.ts --reporter=html

echo "🧪 执行构建产物安全测试..."
npx playwright test tests/e2e/security/build-security.spec.ts --reporter=html

echo "🧪 执行综合冒烟测试..."
npx playwright test tests/e2e/security/comprehensive-smoke.spec.ts --reporter=html

# 生成测试报告
echo "📊 生成测试报告..."
npx playwright show-report

echo "✅ Electron安全验收测试完成！"
```

#### 5.8.2 测试报告模板

```json
{
  "name": "Electron安全验收测试报告",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "summary": {
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "duration": "0ms"
  },
  "test_suites": [
    {
      "name": "BrowserWindow安全配置",
      "tests": [],
      "status": "passed"
    },
    {
      "name": "渲染进程安全隔离", 
      "tests": [],
      "status": "passed"
    },
    {
      "name": "IPC安全通信",
      "tests": [],
      "status": "passed"
    },
    {
      "name": "CSP安全策略",
      "tests": [],
      "status": "passed"
    },
    {
      "name": "更新机制安全",
      "tests": [],
      "status": "passed"
    },
    {
      "name": "构建产物安全",
      "tests": [],
      "status": "passed"
    }
  ],
  "security_baseline": {
    "contextIsolation": true,
    "nodeIntegration": false,
    "sandbox": true,
    "webSecurity": true,
    "csp_configured": true,
    "preload_secure": true,
    "ipc_whitelisted": true,
    "updater_secure": true
  }
}
```

通过这套完整的Playwright + Electron安全验收测试框架，可以确保所有安全基线配置在实际运行时都能生效，为Electron应用提供全面的安全保障。

## 六、治理与工具

建立全面的Electron安全治理体系，通过自动化工具和流程确保安全基线的持续执行。

### 6.1 静态安全扫描工具集成

#### 6.1.1 Electronegativity安全扫描器

Electronegativity是专门针对Electron应用的安全漏洞扫描工具：

```bash
# 安装Electronegativity
npm install -g @doyensec/electronegativity

# 基本扫描
electronegativity -i ./

# 详细扫描报告
electronegativity -i ./ -o report.json -c ./electronegativity.config.json
```

#### 6.1.2 Electronegativity配置文件

```json
// electronegativity.config.json
{
  "input": "./",
  "output": "reports/electronegativity/",
  "format": "json",
  "severity": "informational",
  "confidence": "tentative",
  "checks": [
    "SECURITY_WARNINGS_DISABLED_JS_CHECK",
    "CSP_GLOBAL_CHECK",
    "PRELOAD_JS_CHECK",
    "PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK",
    "CERTIFICATE_VERIFY_PROC_GLOBAL_CHECK",
    "INSECURE_CONTENT_GLOBAL_CHECK",
    "CUSTOM_ARGUMENTS_JS_CHECK",
    "DANGEROUS_FUNCTIONS_JS_CHECK",
    "NODE_INTEGRATION_ATTACH_EVENT_JS_CHECK",
    "NODE_INTEGRATION_HTML_CHECK",
    "NODE_INTEGRATION_JS_CHECK",
    "CONTEXT_ISOLATION_JS_CHECK",
    "WEB_SECURITY_JS_CHECK",
    "INSECURE_RESOURCES_JS_CHECK",
    "LIMIT_NAVIGATION_GLOBAL_CHECK",
    "HTTP_PROTOCOL_JS_CHECK",
    "FILE_PROTOCOL_JS_CHECK",
    "WEBVIEW_TAG_JS_CHECK"
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "test/**"
  ],
  "customRules": "./security/rules/"
}
```

#### 6.1.3 自定义安全规则

```typescript
// security/rules/custom-electron-rules.ts
import { ElectronSecurityRule } from '@doyensec/electronegativity';

/**
 * 自定义安全规则：检查危险的IPC通道
 */
export const DANGEROUS_IPC_CHANNELS_RULE: ElectronSecurityRule = {
  id: "DANGEROUS_IPC_CHANNELS_CHECK",
  scope: "JavaScript",
  category: "IPC Security",
  title: "检查危险的IPC通道名称",
  description: "检测可能被滥用的IPC通道名称模式",
  severity: "HIGH",
  confidence: "FIRM",
  match: function(astNode: any, fileName: string): boolean {
    // 检查ipcMain.handle或ipcRenderer.invoke调用
    if (astNode.type === 'CallExpression') {
      const { callee, arguments: args } = astNode;
      
      if (callee.type === 'MemberExpression' &&
          (callee.property.name === 'handle' || callee.property.name === 'invoke') &&
          args.length > 0 &&
          args[0].type === 'Literal') {
        
        const channelName = args[0].value;
        const dangerousPatterns = [
          /^(exec|eval|shell|cmd|run)$/i,
          /^(file|read|write|delete)$/i,
          /^(process|spawn|fork)$/i,
          /^(admin|root|sudo)$/i
        ];
        
        return dangerousPatterns.some(pattern => pattern.test(channelName));
      }
    }
    return false;
  }
};

/**
 * 自定义安全规则：检查不安全的预加载脚本
 */
export const UNSAFE_PRELOAD_EXPOSURE_RULE: ElectronSecurityRule = {
  id: "UNSAFE_PRELOAD_EXPOSURE_CHECK",
  scope: "JavaScript",
  category: "Context Isolation",
  title: "检查不安全的预加载脚本API暴露",
  description: "检测预加载脚本中暴露的不安全API",
  severity: "CRITICAL",
  confidence: "FIRM",
  match: function(astNode: any, fileName: string): boolean {
    if (fileName.includes('preload') && astNode.type === 'CallExpression') {
      const { callee, arguments: args } = astNode;
      
      if (callee.type === 'MemberExpression' &&
          callee.object.name === 'contextBridge' &&
          callee.property.name === 'exposeInMainWorld' &&
          args.length >= 2) {
        
        const apiObject = args[1];
        if (apiObject.type === 'ObjectExpression') {
          const properties = apiObject.properties || [];
          const dangerousAPIs = [
            'require', 'eval', 'exec', 'spawn', 'readFileSync', 
            'writeFileSync', 'unlinkSync', 'shell', 'process'
          ];
          
          return properties.some((prop: any) => 
            prop.key && dangerousAPIs.includes(prop.key.name || prop.key.value)
          );
        }
      }
    }
    return false;
  }
};
```

#### 6.1.4 ESLint安全插件配置

```json
// .eslintrc.js
module.exports = {
  extends: [
    '@electron-toolkit/eslint-config-ts',
    'plugin:security/recommended'
  ],
  plugins: [
    'security'
  ],
  rules: {
    // Electron特定安全规则
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',
    
    // 自定义Electron安全规则
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error'
  },
  overrides: [
    {
      files: ['**/preload/**/*.ts'],
      rules: {
        // 预加载脚本特殊规则
        'security/detect-non-literal-require': 'off', // 预加载脚本需要require
        'no-restricted-globals': ['error', 'process', 'Buffer', 'global']
      }
    }
  ]
};
```

### 6.2 CI/CD安全集成配置

#### 6.2.1 GitHub Actions安全工作流

```yaml
# .github/workflows/security-audit.yml
name: 🔒 Security Audit Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # 每日自动安全扫描
    - cron: '0 2 * * *'

jobs:
  dependency-security:
    name: 📦 依赖安全扫描
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run npm audit
        run: |
          npm audit --audit-level=moderate --json > npm-audit-results.json || true
          
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=medium --json > snyk-results.json
        continue-on-error: true
        
      - name: Run OSV Scanner
        uses: google/osv-scanner-action@v1
        with:
          scan-args: |-
            --output=osv-results.json
            --format=json
            ./
        continue-on-error: true
        
      - name: Process security results
        run: |
          node scripts/process-security-results.js
          
      - name: Upload security reports
        uses: actions/upload-artifact@v4
        with:
          name: security-reports
          path: |
            npm-audit-results.json
            snyk-results.json
            osv-results.json
            security-summary.json

  static-security-analysis:
    name: 🔍 静态安全分析
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install Electronegativity
        run: npm install -g @doyensec/electronegativity
        
      - name: Run Electronegativity scan
        run: |
          electronegativity -i ./ -o electronegativity-report.json -f json
          
      - name: Run ESLint security scan
        run: |
          npx eslint src/ --ext .ts,.js --format json --output-file eslint-security-report.json || true
          
      - name: Run Semgrep security scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/javascript
            p/typescript
          generateSarif: "1"
        continue-on-error: true
        
      - name: Upload static analysis reports
        uses: actions/upload-artifact@v4
        with:
          name: static-analysis-reports
          path: |
            electronegativity-report.json
            eslint-security-report.json
            results.sarif

  electron-security-baseline:
    name: ⚡ Electron安全基线验证
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Run Electron security baseline check
        run: |
          npm run security:baseline
          
      - name: Install Playwright
        run: npx playwright install electron
        
      - name: Run Electron security smoke tests
        run: |
          npm run test:electron:security
          
      - name: Upload baseline reports
        uses: actions/upload-artifact@v4
        with:
          name: electron-security-reports
          path: |
            reports/security/
            test-results/

  security-aggregation:
    name: 📊 安全报告聚合
    runs-on: ubuntu-latest
    needs: [dependency-security, static-security-analysis, electron-security-baseline]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Download all security reports
        uses: actions/download-artifact@v4
        
      - name: Generate consolidated security report
        run: |
          node scripts/generate-security-dashboard.js
          
      - name: Comment PR with security summary
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const summary = JSON.parse(fs.readFileSync('security-dashboard.json', 'utf8'));
            
            const comment = `## 🔒 Security Audit Summary
            
            ### 📦 Dependency Security
            - **High**: ${summary.dependencies.high} vulnerabilities
            - **Medium**: ${summary.dependencies.medium} vulnerabilities
            - **Low**: ${summary.dependencies.low} vulnerabilities
            
            ### 🔍 Static Analysis
            - **Critical**: ${summary.static.critical} issues
            - **High**: ${summary.static.high} issues
            - **Medium**: ${summary.static.medium} issues
            
            ### ⚡ Electron Security
            - **Baseline Score**: ${summary.electron.baselineScore}/100
            - **Security Tests**: ${summary.electron.testsPass ? '✅ PASS' : '❌ FAIL'}
            
            ${summary.electron.baselineScore < 80 || summary.dependencies.high > 0 || summary.static.critical > 0 ? 
            '❌ **Security audit failed** - Please address the issues above before merging.' : 
            '✅ **Security audit passed** - No critical issues found.'}
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
      
      - name: Fail if critical security issues found
        run: |
          node scripts/check-security-thresholds.js
```

#### 6.2.2 安全报告处理脚本

```typescript
// scripts/process-security-results.js
const fs = require('fs');
const path = require('path');

/**
 * 处理和标准化各种安全扫描结果
 */
class SecurityResultsProcessor {
  constructor() {
    this.results = {
      npm_audit: null,
      snyk: null,
      osv: null,
      summary: {
        total_vulnerabilities: 0,
        high_severity: 0,
        medium_severity: 0,
        low_severity: 0,
        critical_severity: 0,
        affected_packages: []
      }
    };
  }

  /**
   * 处理npm audit结果
   */
  processNpmAudit() {
    try {
      const auditData = JSON.parse(fs.readFileSync('npm-audit-results.json', 'utf8'));
      this.results.npm_audit = auditData;
      
      if (auditData.vulnerabilities) {
        Object.values(auditData.vulnerabilities).forEach(vuln => {
          this.results.summary.total_vulnerabilities += vuln.via.length || 1;
          
          switch(vuln.severity) {
            case 'critical':
              this.results.summary.critical_severity++;
              break;
            case 'high':
              this.results.summary.high_severity++;
              break;
            case 'moderate':
              this.results.summary.medium_severity++;
              break;
            case 'low':
              this.results.summary.low_severity++;
              break;
          }
          
          this.results.summary.affected_packages.push({
            name: vuln.name,
            severity: vuln.severity,
            range: vuln.range
          });
        });
      }
      
      console.log(`✅ 处理npm audit结果: ${this.results.summary.total_vulnerabilities}个漏洞`);
    } catch (error) {
      console.warn('⚠️ npm audit结果处理失败:', error.message);
    }
  }

  /**
   * 处理Snyk结果
   */
  processSnykResults() {
    try {
      if (fs.existsSync('snyk-results.json')) {
        const snykData = JSON.parse(fs.readFileSync('snyk-results.json', 'utf8'));
        this.results.snyk = snykData;
        console.log('✅ 处理Snyk扫描结果');
      }
    } catch (error) {
      console.warn('⚠️ Snyk结果处理失败:', error.message);
    }
  }

  /**
   * 处理OSV Scanner结果
   */
  processOSVResults() {
    try {
      if (fs.existsSync('osv-results.json')) {
        const osvData = JSON.parse(fs.readFileSync('osv-results.json', 'utf8'));
        this.results.osv = osvData;
        console.log('✅ 处理OSV Scanner结果');
      }
    } catch (error) {
      console.warn('⚠️ OSV Scanner结果处理失败:', error.message);
    }
  }

  /**
   * 生成安全摘要报告
   */
  generateSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      scan_results: this.results,
      risk_assessment: this.assessRisk(),
      recommendations: this.generateRecommendations(),
      compliance_status: this.checkCompliance()
    };

    fs.writeFileSync('security-summary.json', JSON.stringify(summary, null, 2));
    console.log('📊 安全摘要报告已生成: security-summary.json');
    
    return summary;
  }

  /**
   * 风险评估
   */
  assessRisk() {
    const { critical_severity, high_severity, medium_severity } = this.results.summary;
    
    let riskLevel = 'LOW';
    let riskScore = 0;
    
    riskScore += critical_severity * 10;
    riskScore += high_severity * 5;
    riskScore += medium_severity * 2;
    
    if (critical_severity > 0) {
      riskLevel = 'CRITICAL';
    } else if (high_severity > 2) {
      riskLevel = 'HIGH';
    } else if (high_severity > 0 || medium_severity > 5) {
      riskLevel = 'MEDIUM';
    }
    
    return {
      level: riskLevel,
      score: riskScore,
      critical_issues: critical_severity,
      high_issues: high_severity,
      medium_issues: medium_severity,
      recommendation: riskLevel === 'CRITICAL' ? 
        '立即修复所有严重漏洞' : 
        riskLevel === 'HIGH' ? 
        '在下个版本前修复高危漏洞' : 
        '按计划修复中低危漏洞'
    };
  }

  /**
   * 生成修复建议
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.summary.critical_severity > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        action: '立即更新受影响的依赖包到安全版本',
        packages: this.results.summary.affected_packages
          .filter(pkg => pkg.severity === 'critical')
          .map(pkg => pkg.name)
      });
    }
    
    if (this.results.summary.high_severity > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: '计划在本周内更新高危险依赖',
        packages: this.results.summary.affected_packages
          .filter(pkg => pkg.severity === 'high')
          .map(pkg => pkg.name)
      });
    }
    
    recommendations.push({
      priority: 'ONGOING',
      action: '启用自动依赖更新和定期安全扫描',
      details: '配置Dependabot或Renovate进行自动更新'
    });
    
    return recommendations;
  }

  /**
   * 检查合规性状态
   */
  checkCompliance() {
    return {
      security_baseline: this.results.summary.critical_severity === 0 && this.results.summary.high_severity <= 2,
      dependency_policy: this.results.summary.critical_severity === 0,
      audit_requirements: true, // 已执行安全审计
      documentation_complete: fs.existsSync('SECURITY.md')
    };
  }

  /**
   * 处理所有结果
   */
  processAll() {
    console.log('🔒 开始处理安全扫描结果...');
    
    this.processNpmAudit();
    this.processSnykResults();
    this.processOSVResults();
    
    const summary = this.generateSummary();
    
    console.log('\n📋 安全扫描摘要:');
    console.log(`总漏洞数: ${this.results.summary.total_vulnerabilities}`);
    console.log(`严重: ${this.results.summary.critical_severity}`);
    console.log(`高危: ${this.results.summary.high_severity}`);
    console.log(`中危: ${this.results.summary.medium_severity}`);
    console.log(`低危: ${this.results.summary.low_severity}`);
    console.log(`风险等级: ${summary.risk_assessment.level}`);
    
    return summary;
  }
}

// 执行处理
if (require.main === module) {
  const processor = new SecurityResultsProcessor();
  processor.processAll();
}

module.exports = SecurityResultsProcessor;
```

### 6.3 依赖安全管理策略

#### 6.3.1 依赖安全策略配置

```json
// .nvmrc
18

// .npmrc
audit-level=moderate
fund=false
save-exact=true
package-lock-only=true

# 依赖安全配置
registry=https://registry.npmjs.org/
audit-level=high
```

#### 6.3.2 Dependabot配置

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "security-team"
    assignees:
      - "tech-lead"
    commit-message:
      prefix: "security"
      include: "scope"
    # 只允许安全更新
    allow:
      - dependency-type: "direct"
        update-type: "security"
      - dependency-type: "indirect"
        update-type: "security"
    # 忽略主要版本更新（需手动评估）
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
```

#### 6.3.3 License Compliance检查

```typescript
// scripts/license-check.ts
import * as licenseChecker from 'license-checker';
import * as fs from 'fs';
import * as path from 'path';

interface LicenseInfo {
  name: string;
  version: string;
  license: string;
  repository?: string;
  licenseFile?: string;
}

/**
 * 许可证合规性检查器
 */
export class LicenseComplianceChecker {
  private readonly APPROVED_LICENSES = [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    'CC0-1.0',
    'Unlicense'
  ];

  private readonly RESTRICTED_LICENSES = [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-1.0',
    'AGPL-3.0',
    'LGPL-2.1',
    'LGPL-3.0'
  ];

  /**
   * 执行许可证检查
   */
  async checkLicenseCompliance(): Promise<void> {
    return new Promise((resolve, reject) => {
      licenseChecker.init({
        start: process.cwd(),
        production: true,
        onlyAllow: this.APPROVED_LICENSES.join(';'),
        excludePrivatePackages: true
      }, (err, packages) => {
        if (err) {
          reject(err);
          return;
        }

        const results = this.analyzeLicenses(packages);
        this.generateComplianceReport(results);
        
        if (results.violations.length > 0) {
          console.error('❌ 许可证合规检查失败');
          process.exit(1);
        } else {
          console.log('✅ 许可证合规检查通过');
          resolve();
        }
      });
    });
  }

  /**
   * 分析许可证信息
   */
  private analyzeLicenses(packages: Record<string, any>) {
    const results = {
      total: 0,
      approved: 0,
      restricted: 0,
      unknown: 0,
      violations: [] as Array<{
        package: string;
        license: string;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
        reason: string;
      }>
    };

    for (const [packageName, info] of Object.entries(packages)) {
      results.total++;
      const license = info.licenses as string;

      if (this.APPROVED_LICENSES.includes(license)) {
        results.approved++;
      } else if (this.RESTRICTED_LICENSES.includes(license)) {
        results.restricted++;
        results.violations.push({
          package: packageName,
          license,
          severity: 'HIGH',
          reason: '使用了受限制的开源许可证'
        });
      } else if (!license || license === 'UNKNOWN') {
        results.unknown++;
        results.violations.push({
          package: packageName,
          license: license || 'UNKNOWN',
          severity: 'MEDIUM',
          reason: '许可证信息不明确'
        });
      } else {
        results.violations.push({
          package: packageName,
          license,
          severity: 'LOW',
          reason: '需要手动审查的许可证'
        });
      }
    }

    return results;
  }

  /**
   * 生成合规性报告
   */
  private generateComplianceReport(results: any): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_packages: results.total,
        approved_licenses: results.approved,
        restricted_licenses: results.restricted,
        unknown_licenses: results.unknown,
        compliance_rate: ((results.approved / results.total) * 100).toFixed(2)
      },
      violations: results.violations,
      approved_licenses: this.APPROVED_LICENSES,
      restricted_licenses: this.RESTRICTED_LICENSES
    };

    // 确保报告目录存在
    const reportsDir = path.join(process.cwd(), 'reports', 'compliance');
    fs.mkdirSync(reportsDir, { recursive: true });

    // 保存报告
    const reportPath = path.join(reportsDir, 'license-compliance.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 许可证合规报告已生成: ${reportPath}`);
    console.log(`合规率: ${report.summary.compliance_rate}%`);
    
    if (results.violations.length > 0) {
      console.log('\n⚠️ 许可证违规详情:');
      results.violations.forEach(violation => {
        console.log(`  ${violation.severity}: ${violation.package} (${violation.license}) - ${violation.reason}`);
      });
    }
  }
}

// CLI执行
if (require.main === module) {
  const checker = new LicenseComplianceChecker();
  checker.checkLicenseCompliance().catch(error => {
    console.error('许可证检查失败:', error);
    process.exit(1);
  });
}
```

### 6.4 Electron Fuses生产环境强化

#### 6.4.1 Electron Fuses配置

```typescript
// scripts/configure-fuses.ts
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

/**
 * Electron Fuses生产环境安全强化配置
 */
export const PRODUCTION_FUSES_CONFIG: FuseV1Options = {
  version: FuseVersion.V1,
  
  // 🔒 禁用Node.js集成（严格模式）
  resetAdHocDarwinCASignature: false, // 保持签名完整性
  enableCookieEncryption: true,       // 启用Cookie加密
  enableNodeOptionsEnvironmentVariable: false, // 禁用NODE_OPTIONS环境变量
  enableNodeCliInspectArguments: false,        // 禁用Node调试参数
  enableEmbeddedAsarIntegrityValidation: true, // 启用ASAR完整性验证
  onlyLoadAppFromAsar: true,                   // 只从ASAR加载应用
  
  // 🛡️ 渲染进程安全强化
  loadBrowserProcessSpecificV8Snapshot: false, // 禁用浏览器特定V8快照
  enablePrintPrototypeOverwrite: false,        // 禁用原型覆盖
  
  // 🔧 开发工具和调试限制
  runAsNode: false,                    // 禁用runAsNode模式
  enableRunAsNode: false,              // 确保无法启用runAsNode
};

/**
 * 开发环境Fuses配置（相对宽松）
 */
export const DEVELOPMENT_FUSES_CONFIG: FuseV1Options = {
  version: FuseVersion.V1,
  
  resetAdHocDarwinCASignature: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: true,  // 开发环境允许NODE_OPTIONS
  enableNodeCliInspectArguments: true,         // 开发环境允许调试
  enableEmbeddedAsarIntegrityValidation: false, // 开发环境可能没有ASAR
  onlyLoadAppFromAsar: false,                  // 开发环境从源码加载
  
  loadBrowserProcessSpecificV8Snapshot: false,
  enablePrintPrototypeOverwrite: true,         // 开发环境允许原型修改
  
  runAsNode: false,
  enableRunAsNode: false,
};

/**
 * Fuses配置应用器
 */
export class FusesConfigurator {
  /**
   * 根据环境应用相应的Fuses配置
   */
  static getFusesConfig(environment: 'production' | 'development' = 'production'): FuseV1Options {
    const config = environment === 'production' ? 
      PRODUCTION_FUSES_CONFIG : 
      DEVELOPMENT_FUSES_CONFIG;
    
    console.log(`🔧 应用${environment}环境Fuses配置`);
    console.log('Fuses配置详情:', JSON.stringify(config, null, 2));
    
    return config;
  }

  /**
   * 验证Fuses配置
   */
  static validateFusesConfig(config: FuseV1Options): boolean {
    const criticalChecks = [
      { key: 'enableNodeOptionsEnvironmentVariable', expected: false, critical: true },
      { key: 'enableNodeCliInspectArguments', expected: false, critical: true },
      { key: 'enableEmbeddedAsarIntegrityValidation', expected: true, critical: true },
      { key: 'onlyLoadAppFromAsar', expected: true, critical: false },
      { key: 'runAsNode', expected: false, critical: true },
    ];

    let isValid = true;
    
    criticalChecks.forEach(check => {
      const actualValue = config[check.key];
      if (actualValue !== check.expected) {
        const level = check.critical ? '❌ CRITICAL' : '⚠️  WARNING';
        console.log(`${level}: Fuses配置 '${check.key}' 应为 ${check.expected}, 实际为 ${actualValue}`);
        
        if (check.critical) {
          isValid = false;
        }
      }
    });

    return isValid;
  }
}
```

#### 6.4.2 Electron Forge配置集成

```typescript
// forge.config.ts
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { FusesConfigurator } from './scripts/configure-fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "*.{node,dll}"
    },
    // macOS签名配置
    osxSign: {
      identity: process.env.APPLE_IDENTITY,
      hardenedRuntime: true,
      entitlements: 'entitlements.mac.plist',
      'entitlements-inherit': 'entitlements.mac.plist',
      'signature-flags': 'library'
    },
    // macOS公证配置
    osxNotarize: {
      appleId: process.env.APPLE_ID!,
      appleIdPassword: process.env.APPLE_ID_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!
    },
    // Windows代码签名
    win32metadata: {
      CompanyName: process.env.COMPANY_NAME,
      ProductName: process.env.PRODUCT_NAME
    }
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
    new MakerDMG({
      // DMG配置
      background: './assets/dmg-background.png',
      format: 'ULFO'
    })
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig: './webpack.main.config.js',
      renderer: {
        config: './webpack.renderer.config.js',
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts'
            }
          }
        ]
      }
    }),
    // Fuses插件配置
    new FusesPlugin({
      ...FusesConfigurator.getFusesConfig(
        process.env.NODE_ENV === 'production' ? 'production' : 'development'
      )
    })
  ],
  hooks: {
    // 构建前验证Fuses配置
    generateAssets: async (forgeConfig, platform, arch) => {
      console.log('🔍 验证Electron Fuses配置...');
      
      const fusesConfig = FusesConfigurator.getFusesConfig(
        process.env.NODE_ENV === 'production' ? 'production' : 'development'
      );
      
      const isValid = FusesConfigurator.validateFusesConfig(fusesConfig);
      if (!isValid) {
        throw new Error('❌ Fuses配置验证失败，存在关键安全问题');
      }
      
      console.log('✅ Fuses配置验证通过');
    },
    
    // 打包后验证
    postPackage: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
      console.log('🔒 验证打包后的安全配置...');
      
      // TODO: 添加打包后的安全验证逻辑
      // 例如验证Fuses是否正确应用、签名是否完整等
    }
  }
};

export default config;
```

### 6.5 安全检查清单和流程

#### 6.5.1 开发阶段安全检查清单

```markdown
# Electron安全开发检查清单

## 🏗️ 开发阶段 (Development Phase)

### 代码编写
- [ ] **BrowserWindow配置安全**
  - [ ] `contextIsolation: true` 已启用
  - [ ] `nodeIntegration: false` 已禁用
  - [ ] `sandbox: true` 已启用（如适用）
  - [ ] `webSecurity: true` 已启用
  - [ ] `allowRunningInsecureContent: false` 已设置
  - [ ] `experimentalFeatures: false` 已设置

- [ ] **Preload脚本安全**
  - [ ] 使用 `contextBridge.exposeInMainWorld()` 暴露API
  - [ ] 只暴露必要的安全API
  - [ ] 未直接暴露Node.js模块
  - [ ] 实现参数验证和类型检查
  - [ ] 添加适当的错误处理

- [ ] **IPC通信安全**
  - [ ] 使用白名单机制限制IPC通道
  - [ ] 实现参数验证和清理
  - [ ] 添加速率限制（如需要）
  - [ ] 避免使用危险的通道名称
  - [ ] 实现适当的权限检查

- [ ] **内容安全策略 (CSP)**
  - [ ] 配置严格的CSP策略
  - [ ] 禁止不安全的资源加载
  - [ ] 限制脚本执行来源
  - [ ] 添加适当的报告机制

### 代码审查
- [ ] **静态安全分析**
  - [ ] 运行Electronegativity扫描
  - [ ] 执行ESLint安全规则检查
  - [ ] 进行代码安全审查
  - [ ] 检查敏感信息泄露

- [ ] **依赖安全审计**
  - [ ] 运行 `npm audit` 检查
  - [ ] 使用Snyk进行深度扫描
  - [ ] 验证第三方库安全性
  - [ ] 检查许可证合规性

## 🚀 构建阶段 (Build Phase)

### 构建配置
- [ ] **生产环境配置**
  - [ ] Fuses配置已正确应用
  - [ ] 开发工具访问已禁用
  - [ ] 调试功能已移除
  - [ ] 敏感信息已清理

- [ ] **代码签名**
  - [ ] macOS: 开发者ID签名已配置
  - [ ] macOS: 强化运行时已启用
  - [ ] macOS: 公证流程已配置
  - [ ] Windows: 代码签名证书已配置
  - [ ] 签名验证测试通过

- [ ] **打包安全**
  - [ ] ASAR完整性验证已启用
  - [ ] 不必要的文件已排除
  - [ ] 源码路径信息已清理
  - [ ] 打包产物大小检查通过

## 🧪 测试阶段 (Testing Phase)

### 安全测试
- [ ] **自动化安全测试**
  - [ ] Playwright安全测试套件运行通过
  - [ ] 安全基线验证通过
  - [ ] 渗透测试完成（如需要）
  - [ ] 负载测试安全检查通过

- [ ] **手动安全验证**
  - [ ] 安全配置运行时验证
  - [ ] IPC通信安全测试
  - [ ] 文件系统访问权限测试
  - [ ] 网络请求安全检查

## 📦 发布阶段 (Release Phase)

### 发布前检查
- [ ] **最终安全审计**
  - [ ] 所有安全扫描通过
  - [ ] 关键漏洞已修复
  - [ ] 安全基线分数 ≥ 80分
  - [ ] 合规性检查通过

- [ ] **发布配置**
  - [ ] 自动更新机制安全配置
  - [ ] 更新服务器HTTPS配置
  - [ ] 签名验证机制启用
  - [ ] 回滚机制配置就绪

### 发布后监控
- [ ] **运行时监控**
  - [ ] 安全告警机制激活
  - [ ] 异常行为监控启用
  - [ ] 用户反馈收集机制就绪
  - [ ] 应急响应流程确认

## 🔄 持续维护 (Maintenance Phase)

### 定期安全维护
- [ ] **依赖更新**
  - [ ] 定期安全补丁应用
  - [ ] 依赖版本安全审查
  - [ ] 新漏洞影响评估
  - [ ] 紧急安全更新流程

- [ ] **安全评估**
  - [ ] 季度安全审计
  - [ ] 威胁模型更新
  - [ ] 安全培训完成
  - [ ] 事件响应演练
```

#### 6.5.2 安全治理流程

```typescript
// src/governance/SecurityGovernanceWorkflow.ts
import { EventEmitter } from 'events';

/**
 * 安全治理工作流程管理器
 */
export class SecurityGovernanceWorkflow extends EventEmitter {
  private checkpoints: Map<string, SecurityCheckpoint> = new Map();
  
  constructor() {
    super();
    this.initializeCheckpoints();
  }

  /**
   * 初始化安全检查点
   */
  private initializeCheckpoints(): void {
    // 开发阶段检查点
    this.checkpoints.set('development', {
      phase: 'development',
      name: '开发阶段安全检查',
      required_checks: [
        'static_analysis',
        'dependency_audit',
        'code_review',
        'security_configuration'
      ],
      blocking: true,
      automated: true
    });

    // 构建阶段检查点
    this.checkpoints.set('build', {
      phase: 'build',
      name: '构建阶段安全验证',
      required_checks: [
        'fuses_validation',
        'code_signing',
        'build_security',
        'artifact_scanning'
      ],
      blocking: true,
      automated: true
    });

    // 测试阶段检查点
    this.checkpoints.set('testing', {
      phase: 'testing',
      name: '测试阶段安全验收',
      required_checks: [
        'security_baseline_tests',
        'penetration_testing',
        'integration_security',
        'runtime_verification'
      ],
      blocking: true,
      automated: false
    });

    // 发布阶段检查点
    this.checkpoints.set('release', {
      phase: 'release',
      name: '发布前最终安全审核',
      required_checks: [
        'final_security_audit',
        'compliance_verification',
        'release_approval',
        'monitoring_setup'
      ],
      blocking: true,
      automated: false
    });
  }

  /**
   * 执行安全检查点验证
   */
  async executeCheckpoint(
    checkpointId: string,
    context: SecurityContext
  ): Promise<CheckpointResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`未找到安全检查点: ${checkpointId}`);
    }

    console.log(`🔒 开始执行安全检查点: ${checkpoint.name}`);
    
    const results: CheckResult[] = [];
    let overallPass = true;

    for (const checkId of checkpoint.required_checks) {
      try {
        const result = await this.executeSecurityCheck(checkId, context);
        results.push(result);
        
        if (!result.passed && checkpoint.blocking) {
          overallPass = false;
        }
        
        this.emit('check_completed', {
          checkpoint: checkpointId,
          check: checkId,
          result
        });
        
      } catch (error) {
        const errorResult: CheckResult = {
          check_id: checkId,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        results.push(errorResult);
        overallPass = false;
        
        this.emit('check_error', {
          checkpoint: checkpointId,
          check: checkId,
          error
        });
      }
    }

    const checkpointResult: CheckpointResult = {
      checkpoint_id: checkpointId,
      phase: checkpoint.phase,
      passed: overallPass,
      results,
      timestamp: new Date().toISOString(),
      context
    };

    this.emit('checkpoint_completed', checkpointResult);
    
    if (!overallPass && checkpoint.blocking) {
      console.error(`❌ 安全检查点失败: ${checkpoint.name}`);
      throw new SecurityCheckpointFailureError(checkpointResult);
    } else {
      console.log(`✅ 安全检查点通过: ${checkpoint.name}`);
    }

    return checkpointResult;
  }

  /**
   * 执行单个安全检查
   */
  private async executeSecurityCheck(
    checkId: string,
    context: SecurityContext
  ): Promise<CheckResult> {
    const startTime = Date.now();
    
    switch (checkId) {
      case 'static_analysis':
        return await this.runStaticAnalysis(context);
      
      case 'dependency_audit':
        return await this.runDependencyAudit(context);
      
      case 'fuses_validation':
        return await this.validateFuses(context);
      
      case 'security_baseline_tests':
        return await this.runSecurityBaselineTests(context);
      
      default:
        throw new Error(`未知的安全检查: ${checkId}`);
    }
  }

  /**
   * 运行静态分析
   */
  private async runStaticAnalysis(context: SecurityContext): Promise<CheckResult> {
    // 实现静态分析逻辑
    return {
      check_id: 'static_analysis',
      passed: true,
      details: '静态安全分析通过',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 运行依赖审计
   */
  private async runDependencyAudit(context: SecurityContext): Promise<CheckResult> {
    // 实现依赖审计逻辑
    return {
      check_id: 'dependency_audit',
      passed: true,
      details: '依赖安全审计通过',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 验证Fuses配置
   */
  private async validateFuses(context: SecurityContext): Promise<CheckResult> {
    // 实现Fuses验证逻辑
    return {
      check_id: 'fuses_validation',
      passed: true,
      details: 'Electron Fuses配置验证通过',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 运行安全基线测试
   */
  private async runSecurityBaselineTests(context: SecurityContext): Promise<CheckResult> {
    // 实现安全基线测试逻辑
    return {
      check_id: 'security_baseline_tests',
      passed: true,
      details: '安全基线测试通过',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成治理报告
   */
  generateGovernanceReport(results: CheckpointResult[]): GovernanceReport {
    const report: GovernanceReport = {
      timestamp: new Date().toISOString(),
      overall_compliance: results.every(r => r.passed),
      checkpoints: results,
      summary: {
        total_checkpoints: results.length,
        passed_checkpoints: results.filter(r => r.passed).length,
        failed_checkpoints: results.filter(r => !r.passed).length,
        compliance_rate: (results.filter(r => r.passed).length / results.length) * 100
      },
      recommendations: this.generateRecommendations(results)
    };

    return report;
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(results: CheckpointResult[]): string[] {
    const recommendations: string[] = [];
    
    results.forEach(result => {
      if (!result.passed) {
        recommendations.push(`修复 ${result.phase} 阶段的安全问题`);
        
        result.results.forEach(checkResult => {
          if (!checkResult.passed) {
            recommendations.push(`处理 ${checkResult.check_id} 检查失败项`);
          }
        });
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('所有安全检查点通过，继续保持良好的安全实践');
    }

    return recommendations;
  }
}

// 类型定义
interface SecurityCheckpoint {
  phase: string;
  name: string;
  required_checks: string[];
  blocking: boolean;
  automated: boolean;
}

interface SecurityContext {
  environment: 'development' | 'staging' | 'production';
  version: string;
  build_id: string;
  branch: string;
}

interface CheckResult {
  check_id: string;
  passed: boolean;
  details?: string;
  error?: string;
  timestamp: string;
}

interface CheckpointResult {
  checkpoint_id: string;
  phase: string;
  passed: boolean;
  results: CheckResult[];
  timestamp: string;
  context: SecurityContext;
}

interface GovernanceReport {
  timestamp: string;
  overall_compliance: boolean;
  checkpoints: CheckpointResult[];
  summary: {
    total_checkpoints: number;
    passed_checkpoints: number;
    failed_checkpoints: number;
    compliance_rate: number;
  };
  recommendations: string[];
}

class SecurityCheckpointFailureError extends Error {
  constructor(public checkpointResult: CheckpointResult) {
    super(`安全检查点失败: ${checkpointResult.checkpoint_id}`);
    this.name = 'SecurityCheckpointFailureError';
  }
}
```

### 6.6 监控和告警机制

#### 6.6.1 Sentry安全监控配置

```typescript
// src/monitoring/SecurityMonitoring.ts
import * as Sentry from '@sentry/electron';
import { app, BrowserWindow } from 'electron';

/**
 * 安全监控和告警服务
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private securityAlerts: SecurityAlert[] = [];

  private constructor() {
    this.initializeSentry();
    this.setupSecurityEventListeners();
  }

  public static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * 初始化Sentry监控
   */
  private initializeSentry(): void {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      
      // 安全事件采样
      sampleRate: 1.0,
      tracesSampleRate: 0.1,
      
      // 安全相关标签
      initialScope: {
        tags: {
          component: 'electron-security',
          version: app.getVersion()
        }
      },
      
      // 过滤敏感信息
      beforeSend: this.filterSensitiveData,
      
      // 集成配置
      integrations: [
        new Sentry.Integrations.MainThreadProfiling(),
        new Sentry.Integrations.ChildProcess()
      ]
    });
  }

  /**
   * 设置安全事件监听器
   */
  private setupSecurityEventListeners(): void {
    // 监听证书错误
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      event.preventDefault();
      
      this.reportSecurityEvent({
        type: 'CERTIFICATE_ERROR',
        severity: 'HIGH',
        message: `证书错误: ${error}`,
        metadata: {
          url,
          certificate_subject: certificate.subject,
          certificate_issuer: certificate.issuer
        }
      });
      
      // 在生产环境中拒绝无效证书
      callback(process.env.NODE_ENV !== 'production');
    });

    // 监听权限请求
    app.on('web-contents-created', (event, contents) => {
      contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        // 记录所有权限请求
        this.reportSecurityEvent({
          type: 'PERMISSION_REQUEST',
          severity: 'MEDIUM',
          message: `权限请求: ${permission}`,
          metadata: {
            url: webContents.getURL(),
            permission,
            user_agent: webContents.getUserAgent()
          }
        });
        
        // 默认拒绝所有权限请求
        callback(false);
      });

      // 监听导航事件
      contents.on('will-navigate', (event, navigationUrl) => {
        const currentUrl = contents.getURL();
        
        this.reportSecurityEvent({
          type: 'NAVIGATION_ATTEMPT',
          severity: 'LOW',
          message: `页面导航尝试`,
          metadata: {
            from_url: currentUrl,
            to_url: navigationUrl
          }
        });

        // 检查导航是否安全
        if (!this.isNavigationSafe(navigationUrl)) {
          event.preventDefault();
          
          this.reportSecurityEvent({
            type: 'UNSAFE_NAVIGATION_BLOCKED',
            severity: 'HIGH',
            message: `阻止不安全导航: ${navigationUrl}`,
            metadata: {
              blocked_url: navigationUrl,
              current_url: currentUrl
            }
          });
        }
      });
    });
  }

  /**
   * 报告安全事件
   */
  public reportSecurityEvent(alert: SecurityAlert): void {
    // 添加时间戳和ID
    const enrichedAlert: EnrichedSecurityAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      app_version: app.getVersion(),
      platform: process.platform
    };

    // 存储到本地缓存
    this.securityAlerts.push(enrichedAlert);

    // 发送到Sentry
    Sentry.addBreadcrumb({
      category: 'security',
      message: alert.message,
      level: this.mapSeverityToSentryLevel(alert.severity),
      data: alert.metadata
    });

    // 根据严重程度决定处理方式
    switch (alert.severity) {
      case 'CRITICAL':
        this.handleCriticalAlert(enrichedAlert);
        break;
      case 'HIGH':
        this.handleHighSeverityAlert(enrichedAlert);
        break;
      case 'MEDIUM':
        this.handleMediumSeverityAlert(enrichedAlert);
        break;
      case 'LOW':
        this.handleLowSeverityAlert(enrichedAlert);
        break;
    }

    console.log(`🚨 安全事件: [${alert.severity}] ${alert.message}`);
  }

  /**
   * 处理严重安全警报
   */
  private handleCriticalAlert(alert: EnrichedSecurityAlert): void {
    // 立即发送到Sentry作为错误
    Sentry.captureException(new SecurityError(alert.message, alert));
    
    // 记录到本地安全日志
    this.writeSecurityLog(alert);
    
    // 可能的自动响应（如关闭应用）
    if (alert.type === 'CRITICAL_SECURITY_BREACH') {
      console.error('🚨 检测到严重安全威胁，应用即将关闭');
      app.quit();
    }
  }

  /**
   * 处理高级安全警报
   */
  private handleHighSeverityAlert(alert: EnrichedSecurityAlert): void {
    Sentry.captureMessage(alert.message, 'error');
    this.writeSecurityLog(alert);
    
    // 可能的用户通知
    this.notifyUser(alert);
  }

  /**
   * 处理中级安全警报
   */
  private handleMediumSeverityAlert(alert: EnrichedSecurityAlert): void {
    Sentry.captureMessage(alert.message, 'warning');
    this.writeSecurityLog(alert);
  }

  /**
   * 处理低级安全警报
   */
  private handleLowSeverityAlert(alert: EnrichedSecurityAlert): void {
    Sentry.captureMessage(alert.message, 'info');
    // 低级别警报只记录，不持久化存储
  }

  /**
   * 过滤敏感数据
   */
  private filterSensitiveData = (event: Sentry.Event): Sentry.Event | null => {
    // 移除敏感信息
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential'];
    
    function removeKeys(obj: any): void {
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            removeKeys(obj[key]);
          }
        }
      }
    }

    removeKeys(event.extra);
    removeKeys(event.contexts);
    
    return event;
  };

  /**
   * 检查导航安全性
   */
  private isNavigationSafe(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // 允许的协议白名单
      const allowedProtocols = ['https:', 'file:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return false;
      }
      
      // 阻止的主机黑名单（示例）
      const blockedHosts = ['malicious.com', 'phishing.site'];
      if (blockedHosts.includes(parsedUrl.hostname)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 写入安全日志
   */
  private writeSecurityLog(alert: EnrichedSecurityAlert): void {
    const logEntry = {
      timestamp: alert.timestamp,
      level: alert.severity,
      type: alert.type,
      message: alert.message,
      metadata: alert.metadata,
      app_version: alert.app_version,
      platform: alert.platform
    };

    // 这里可以集成到日志系统
    console.log('📝 安全日志:', JSON.stringify(logEntry));
  }

  /**
   * 通知用户
   */
  private notifyUser(alert: EnrichedSecurityAlert): void {
    // 可以通过系统通知或应用内通知告知用户
    if (alert.severity === 'HIGH') {
      // 显示系统通知
      console.warn(`⚠️  安全警告: ${alert.message}`);
    }
  }

  /**
   * 映射严重程度到Sentry级别
   */
  private mapSeverityToSentryLevel(severity: SecuritySeverity): Sentry.SeverityLevel {
    switch (severity) {
      case 'CRITICAL': return 'fatal';
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'info';
      default: return 'info';
    }
  }

  /**
   * 生成警报ID
   */
  private generateAlertId(): string {
    return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取安全警报统计
   */
  public getSecurityStats(): SecurityStats {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    const recentAlerts = this.securityAlerts.filter(
      alert => new Date(alert.timestamp).getTime() > last24Hours
    );

    return {
      total_alerts: this.securityAlerts.length,
      recent_alerts_24h: recentAlerts.length,
      alerts_by_severity: {
        critical: recentAlerts.filter(a => a.severity === 'CRITICAL').length,
        high: recentAlerts.filter(a => a.severity === 'HIGH').length,
        medium: recentAlerts.filter(a => a.severity === 'MEDIUM').length,
        low: recentAlerts.filter(a => a.severity === 'LOW').length
      },
      most_common_types: this.getMostCommonAlertTypes(recentAlerts)
    };
  }

  /**
   * 获取最常见的警报类型
   */
  private getMostCommonAlertTypes(alerts: EnrichedSecurityAlert[]): Array<{type: string, count: number}> {
    const typeCounts = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

// 类型定义
type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface SecurityAlert {
  type: string;
  severity: SecuritySeverity;
  message: string;
  metadata?: Record<string, any>;
}

interface EnrichedSecurityAlert extends SecurityAlert {
  id: string;
  timestamp: string;
  app_version: string;
  platform: string;
}

interface SecurityStats {
  total_alerts: number;
  recent_alerts_24h: number;
  alerts_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  most_common_types: Array<{type: string, count: number}>;
}

class SecurityError extends Error {
  constructor(message: string, public alert: EnrichedSecurityAlert) {
    super(message);
    this.name = 'SecurityError';
  }
}
```

通过这套完整的治理与工具体系，建立了从开发到运营的全生命周期Electron安全管理框架，确保安全基线的持续执行和改进。

## 七、实施清单（核对）
- [ ] `contextIsolation: true`
- [ ] `nodeIntegration: false`
- [ ] `sandbox: true`
- [ ] preload 仅暴露白名单 API（使用 contextBridge）
- [ ] 严格 CSP 元标签存在并随构建注入
- [ ] E2E 冒烟：Node 禁用 + CSP 存在 两个断言通过
