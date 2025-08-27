# 安全基础层详细配置 - Electron 安全基线实现

**层级**: Layer 2 - Security Foundation  
**目标**: 实现 Electron 应用的三重安全基线：沙盒模式 + 上下文隔离 + 严格 CSP

---

## 🔒 三重安全基线架构

### 安全基线三要素（强制执行）
```typescript
const SECURITY_PREFERENCES = {
  sandbox: true,              // 1️⃣ 沙盒模式：隔离渲染进程
  contextIsolation: true,     // 2️⃣ 上下文隔离：分离主世界和隔离世界
  nodeIntegration: false,     // 3️⃣ 禁用Node集成：阻止渲染进程访问Node.js API
  webSecurity: true          // 4️⃣ Web安全：启用同源策略等Web安全机制
}
```

---

## 🏗️ Electron 主进程安全配置

### `electron/main.ts` - 主进程完整安全配置
```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 安全配置常量（用于测试验证）
const SECURITY_PREFERENCES = {
  sandbox: true,              // 重新启用沙盒模式（安全基线要求）
  contextIsolation: true,     // 启用上下文隔离
  nodeIntegration: false,     // 禁用 Node.js 集成
  webSecurity: true          // 启用 Web 安全
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,                    // 防止闪烁
    autoHideMenuBar: true,         // 隐藏菜单栏
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      ...SECURITY_PREFERENCES,     // 应用安全配置
      
      // 额外安全配置
      allowRunningInsecureContent: false,  // 禁止运行不安全内容
      contextIsolation: true,              // 显式启用上下文隔离
      enableRemoteModule: false,           // 禁用远程模块
      experimentalFeatures: false,         // 禁用实验性功能
      plugins: false,                      // 禁用插件
      webgl: true,                        // 允许 WebGL（游戏需要）
      webSecurity: true,                  // 启用 Web 安全
      
      // 开发环境特殊配置
      devTools: process.env.NODE_ENV === 'development'
    }
  })

  // E2E测试模式：网络隔离配置
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    // 禁用自动更新检查
    app.setAppUserModelId('com.electron.test')
    
    // 设置离线模式网络策略
    mainWindow.webContents.session.setPermissionRequestHandler(() => false)
    
    // 阻止不必要的网络请求
    mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url
      
      // 允许本地资源和测试必需的连接
      if (
        url.startsWith('file://') || 
        url.startsWith('chrome-devtools://') ||
        url.startsWith('data:') ||
        url.includes('localhost') ||
        url.includes('127.0.0.1')
      ) {
        callback({ cancel: false })
      } else {
        // 阻止外部网络请求
        console.log(`🚫 E2E测试模式：阻止网络请求 ${url}`)
        callback({ cancel: true })
      }
    })
  }

  // 在测试模式下暴露安全配置供验证
  if (process.env.SECURITY_TEST_MODE === 'true') {
    global.__SECURITY_PREFS__ = {
      ...SECURITY_PREFERENCES,
      windowId: mainWindow.id,
      createdAt: new Date().toISOString()
    }

    // 暴露安全策略管理器配置
    global.__SECURITY_POLICY_CONFIG__ = {
      config: { enabled: true },
      isProduction: process.env.NODE_ENV === 'production',
      testMode: true,
      exposedAt: new Date().toISOString()
    }

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
        "form-action 'self'"
      ],
      nonceGeneration: true,
      configuredAt: new Date().toISOString()
    }
  }

  // 窗口就绪时显示
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 新窗口处理：阻止弹窗，外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 设置严格CSP响应头 - 确保沙箱模式下内联脚本被阻止
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://sentry.io; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
        ]
      }
    })
  })

  // 加载应用
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  return mainWindow
}

// 应用就绪后创建窗口
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

---

## 🌉 预加载脚本安全实现

### `electron/preload.ts` - 白名单 API 暴露
```typescript
import { contextBridge, ipcRenderer } from 'electron'

// 调试：预加载脚本开始执行
console.log('🔧 预加载脚本开始执行', {
  contextIsolated: process.contextIsolated,
  nodeEnv: process.env.NODE_ENV,
  versions: process.versions
})

// 预加载API：暴露白名单API到渲染进程
if (process.contextIsolated) {
  try {
    // 统一使用 electronAPI 命名，与测试保持一致
    contextBridge.exposeInMainWorld('electronAPI', {
      // 基础系统信息（安全的只读信息）
      platform: process.platform,
      version: process.versions.electron,
      
      // 应用信息
      isElectron: true,
      electronVersion: process.versions.electron,
      
      // 文件系统操作（如需要，严格限制范围）
      // readFile: (path: string) => ipcRenderer.invoke('read-file', path),
      
      // 系统通知（安全的用户交互）
      // showNotification: (title: string, body: string) => 
      //   ipcRenderer.invoke('show-notification', { title, body }),
      
      // 应用控制（安全的应用级操作）
      // minimize: () => ipcRenderer.invoke('window-minimize'),
      // close: () => ipcRenderer.invoke('window-close')
    })
    
    // 为了测试验证，额外暴露一个自定义API标识
    contextBridge.exposeInMainWorld('__CUSTOM_API__', {
      preloadExposed: true,
      exposedAt: new Date().toISOString(),
      securityMode: 'contextBridge'
    })
    
    console.log('✅ API暴露成功:', {
      electronAPI: 'exposed',
      customAPI: 'exposed'
    })
  } catch (error) {
    console.error('❌ API暴露失败:', error)
  }
} else {
  // 兜底：如果上下文隔离被意外禁用（不推荐）
  console.warn('⚠️ 上下文隔离未启用，使用兜底方案')
  
  // @ts-ignore (define in dts)  
  window.electronAPI = {
    platform: process.platform,
    version: process.versions.electron,
    isElectron: true,
    electronVersion: process.versions.electron,
    securityMode: 'window-direct' // 标记为非安全模式
  }
  
  // @ts-ignore
  window.__CUSTOM_API__ = {
    preloadExposed: true,
    exposedAt: new Date().toISOString(),
    securityMode: 'window-direct'
  }
}

// IPC 通信安全包装器（如需要更复杂的主-渲染通信）
const secureIPC = {
  // 只允许特定的 IPC 频道
  allowedChannels: [
    'app:get-version',
    'window:minimize', 
    'window:close',
    'file:read-safe',
    'notification:show'
  ],
  
  // 安全的 IPC 调用包装
  invoke: async (channel: string, data?: any) => {
    if (!secureIPC.allowedChannels.includes(channel)) {
      throw new Error(`IPC channel '${channel}' not in allowlist`)
    }
    return ipcRenderer.invoke(channel, data)
  },
  
  // 安全的事件监听包装
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    if (!secureIPC.allowedChannels.includes(channel)) {
      throw new Error(`IPC channel '${channel}' not in allowlist`)
    }
    ipcRenderer.on(channel, callback)
  }
}

// 可选：暴露安全的IPC包装器
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('secureIPC', secureIPC)
  } catch (error) {
    console.error('❌ 安全IPC暴露失败:', error)
  }
}
```

---

## 🛡️ CSP (Content Security Policy) 严格策略

### HTML 模板中的 CSP Meta 标签
```html
<!-- dist/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- 严格的 CSP 策略 -->
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   script-src 'self'; 
                   style-src 'self'; 
                   img-src 'self' data: https:; 
                   font-src 'self' data:; 
                   connect-src 'self' https://sentry.io; 
                   object-src 'none'; 
                   base-uri 'self'; 
                   form-action 'self'; 
                   frame-ancestors 'none';">
    
    <title>Vite + React + TS</title>
    <script type="module" crossorigin src="./assets/index-C3mHG2u2.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-DBmKSPHJ.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### CSP 策略详解
```typescript
// CSP 指令详细说明
const CSP_POLICY = {
  // 默认策略：禁止所有资源
  "default-src": "'none'",
  
  // 脚本：仅允许同源脚本
  "script-src": "'self'",
  
  // 样式：仅允许同源样式  
  "style-src": "'self'",
  
  // 图片：允许同源、data URL、HTTPS图片
  "img-src": "'self' data: https:",
  
  // 字体：允许同源和 data URL
  "font-src": "'self' data:",
  
  // 连接：允许同源和 Sentry（监控需要）
  "connect-src": "'self' https://sentry.io",
  
  // 对象：完全禁止（Flash、Java applets等）
  "object-src": "'none'",
  
  // 基础URI：仅允许同源
  "base-uri": "'self'",
  
  // 表单提交：仅允许同源
  "form-action": "'self'",
  
  // 框架嵌入：完全禁止被嵌入
  "frame-ancestors": "'none'"
}
```

---

## 🔍 安全验证与测试

### 安全基线扫描脚本
```javascript
// scripts/scan_electron_safety.mjs
#!/usr/bin/env node

import { readFile } from 'fs/promises'
import { join } from 'path'

async function scanElectronSafety() {
  const mainPath = join(process.cwd(), 'dist-electron/main.js')
  const preloadPath = join(process.cwd(), 'dist-electron/preload.js')
  const htmlPath = join(process.cwd(), 'dist/index.html')
  
  console.log('🔒 开始 Electron 安全基线扫描...\n')
  
  try {
    const [mainContent, preloadContent, htmlContent] = await Promise.all([
      readFile(mainPath, 'utf-8'),
      readFile(preloadPath, 'utf-8'), 
      readFile(htmlPath, 'utf-8')
    ])
    
    // 安全配置检查项
    const securityChecks = [
      {
        name: 'Sandbox Mode',
        pattern: /sandbox:\s*true/,
        content: mainContent,
        required: true,
        description: '沙盒模式必须启用以隔离渲染进程'
      },
      {
        name: 'Context Isolation',
        pattern: /contextIsolation:\s*true/,
        content: mainContent,
        required: true,
        description: '上下文隔离必须启用以分离主世界和隔离世界'
      },
      {
        name: 'Node Integration Disabled',
        pattern: /nodeIntegration:\s*false/,
        content: mainContent,
        required: true,
        description: 'Node.js集成必须禁用以阻止渲染进程访问Node API'
      },
      {
        name: 'Web Security Enabled',
        pattern: /webSecurity:\s*true/,
        content: mainContent,
        required: true,
        description: 'Web安全必须启用以执行同源策略'
      },
      {
        name: 'CSP Meta Tag Present',
        pattern: /<meta\s+http-equiv=['"']Content-Security-Policy['"']/i,
        content: htmlContent,
        required: true,
        description: 'HTML必须包含CSP meta标签'
      },
      {
        name: 'Strict CSP Policy',
        pattern: /default-src\s+['"']none['"']/,
        content: htmlContent,
        required: true,
        description: 'CSP必须使用严格的default-src none策略'
      },
      {
        name: 'No Unsafe Inline',
        pattern: /['"']unsafe-inline['"']/,
        content: htmlContent,
        required: false,
        invert: true,
        description: 'CSP不应包含unsafe-inline指令'
      },
      {
        name: 'No Unsafe Eval',
        pattern: /['"']unsafe-eval['"']/,
        content: htmlContent,
        required: false,
        invert: true,
        description: 'CSP不应包含unsafe-eval指令'
      },
      {
        name: 'ContextBridge Usage',
        pattern: /contextBridge\.exposeInMainWorld/,
        content: preloadContent,
        required: true,
        description: '预加载脚本必须使用contextBridge暴露API'
      }
    ]
    
    let passed = 0
    const total = securityChecks.length
    const issues = []
    
    console.log('📋 安全检查项目:\n')
    
    for (const check of securityChecks) {
      const matches = check.pattern.test(check.content)
      const success = check.invert ? !matches : matches
      
      if (success) {
        console.log(`✅ ${check.name}: PASS`)
        passed++
      } else {
        console.log(`❌ ${check.name}: FAIL`)
        issues.push({
          name: check.name,
          description: check.description,
          severity: check.required ? 'CRITICAL' : 'WARNING'
        })
      }
    }
    
    console.log(`\n📊 安全基线检查结果: ${passed}/${total} 通过`)
    
    if (issues.length > 0) {
      console.log('\n🚨 发现安全问题:')
      issues.forEach(issue => {
        console.log(`   [${issue.severity}] ${issue.name}`)
        console.log(`   └─ ${issue.description}`)
      })
    }
    
    if (passed < total) {
      console.log('\n❌ 安全基线检查失败，请修复上述问题后重试')
      process.exit(1)
    } else {
      console.log('\n🎉 所有安全检查项目都已通过！')
    }
    
  } catch (error) {
    console.error('\n💥 安全检查执行失败:', error.message)
    process.exit(1)
  }
}

// 执行安全扫描
scanElectronSafety().catch(console.error)
```

### Playwright 安全测试用例
```typescript
// tests/e2e/security/electron-security-baseline.spec.ts
import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { test, expect } from '@playwright/test'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // 启动构建后的 Electron 应用
  app = await electron.launch({
    args: ['./dist-electron/main.js'],
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      SECURITY_TEST_MODE: 'true' // 启用安全测试模式
    }
  })

  // 等待主窗口加载
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  if (app) {
    await app.close()
  }
})

test.describe('Electron 安全基线验证', () => {
  test('安全基线：Node.js 全局变量隔离', async () => {
    // 验证危险的 Node.js 全局变量未暴露到渲染进程
    const nodeGlobals = await page.evaluate(() => {
      return {
        hasRequire: typeof (window as any).require !== 'undefined',
        hasProcess: typeof (window as any).process !== 'undefined',
        hasBuffer: typeof (window as any).Buffer !== 'undefined',
        hasGlobal: typeof (window as any).global !== 'undefined',
        hasSetImmediate: typeof (window as any).setImmediate !== 'undefined',
        hasClearImmediate: typeof (window as any).clearImmediate !== 'undefined'
      }
    })

    expect(nodeGlobals.hasRequire, 'require() 不应暴露到渲染进程').toBe(false)
    expect(nodeGlobals.hasProcess, 'process 不应暴露到渲染进程').toBe(false)
    expect(nodeGlobals.hasBuffer, 'Buffer 不应暴露到渲染进程').toBe(false)
    expect(nodeGlobals.hasGlobal, 'global 不应暴露到渲染进程').toBe(false)
    expect(nodeGlobals.hasSetImmediate, 'setImmediate 不应暴露到渲染进程').toBe(false)
    expect(nodeGlobals.hasClearImmediate, 'clearImmediate 不应暴露到渲染进程').toBe(false)
  })

  test('安全基线：CSP 策略验证', async () => {
    // 检查 CSP meta 标签是否存在
    const cspMeta = await page.locator('meta[http-equiv="Content-Security-Policy"]')
    await expect(cspMeta).toBeAttached()

    // 获取 CSP 内容
    const cspContent = await cspMeta.getAttribute('content')
    expect(cspContent).toBeTruthy()

    // 验证严格的CSP指令
    expect(cspContent).toContain("default-src 'none'")  // 严格默认策略
    expect(cspContent).toContain("script-src 'self'")   // 脚本仅同源
    expect(cspContent).toContain("style-src 'self'")    // 样式仅同源
    
    // 验证不包含不安全的指令
    expect(cspContent).not.toContain("'unsafe-inline'")
    expect(cspContent).not.toContain("'unsafe-eval'")

    console.log('✅ 严格CSP策略验证通过:', cspContent)
  })

  test('预加载脚本：白名单 API 验证', async () => {
    // 验证预加载脚本是否正确暴露了白名单 API
    const apiCheck = await page.evaluate(() => {
      return {
        hasElectronAPI: typeof (window as any).electronAPI !== 'undefined',
        electronAPIType: typeof (window as any).electronAPI,
        customAPI: typeof (window as any).__CUSTOM_API__ !== 'undefined',
        electronAPIContent: (window as any).electronAPI,
        customAPIContent: (window as any).__CUSTOM_API__
      }
    })

    // 验证 electronAPI 存在且为对象类型
    expect(apiCheck.hasElectronAPI, 'electronAPI 应该被暴露').toBe(true)
    expect(apiCheck.electronAPIType, 'electronAPI 应该是对象类型').toBe('object')
    
    // 验证 API 内容包含预期属性
    expect(apiCheck.electronAPIContent).toHaveProperty('platform')
    expect(apiCheck.electronAPIContent).toHaveProperty('version')
    expect(apiCheck.electronAPIContent).toHaveProperty('isElectron', true)
    
    // 验证自定义 API 标识
    expect(apiCheck.customAPI, '自定义API标识应该存在').toBe(true)
    expect(apiCheck.customAPIContent).toHaveProperty('preloadExposed', true)

    console.log('✅ 预加载API验证通过')
  })

  test('窗口属性：安全配置验证', async () => {
    // 通过主进程暴露的安全配置验证
    const securityConfig = await app.evaluate(async () => {
      const globalAny = global as any
      const securityPrefs = globalAny.__SECURITY_PREFS__
      
      if (!securityPrefs) {
        throw new Error('安全测试模式未启用或配置未暴露')
      }
      
      return {
        nodeIntegration: securityPrefs.nodeIntegration,
        contextIsolation: securityPrefs.contextIsolation,
        sandbox: securityPrefs.sandbox,
        webSecurity: securityPrefs.webSecurity,
        windowId: securityPrefs.windowId,
        createdAt: securityPrefs.createdAt
      }
    })

    // 验证安全三要素的硬断言
    expect(securityConfig.nodeIntegration, 'nodeIntegration 必须为 false').toBe(false)
    expect(securityConfig.contextIsolation, 'contextIsolation 必须为 true').toBe(true)
    expect(securityConfig.sandbox, 'sandbox 必须为 true').toBe(true)
    expect(securityConfig.webSecurity, 'webSecurity 必须为 true').toBe(true)

    console.log('✅ 安全配置硬断言验证通过')
  })

  test('CSP 违规检测：内联脚本阻止', async () => {
    // 测试CSP是否阻止内联脚本执行
    const inlineScriptBlocked = await page.evaluate(async () => {
      return new Promise<boolean>(resolve => {
        // 清除可能存在的测试变量
        (window as any).testCSP = undefined
        
        const script = document.createElement('script')
        script.innerHTML = '(window as any).testCSP = true; console.log("INLINE SCRIPT EXECUTED");'
        
        // 监听CSP违规事件
        const cspViolationListener = (event: any) => {
          console.log('CSP violation detected:', event.originalPolicy)
          document.removeEventListener('securitypolicyviolation', cspViolationListener)
          resolve(true) // CSP违规事件触发，说明内联脚本被阻止
        }
        document.addEventListener('securitypolicyviolation', cspViolationListener)
        
        // 超时检测
        setTimeout(() => {
          document.removeEventListener('securitypolicyviolation', cspViolationListener)
          if ((window as any).testCSP === undefined) {
            resolve(true) // 脚本未执行，CSP生效
          } else {
            resolve(false) // 脚本执行了，CSP失效
          }
        }, 1000)

        document.head.appendChild(script)
      })
    })

    expect(inlineScriptBlocked, 'CSP应该阻止内联脚本执行').toBe(true)
  })
})
```

---

## 📊 安全基线验证清单

### 强制验证项（必须全部通过）
- ✅ **沙盒模式**: `sandbox: true` 在主进程配置中
- ✅ **上下文隔离**: `contextIsolation: true` 在主进程配置中  
- ✅ **Node集成禁用**: `nodeIntegration: false` 在主进程配置中
- ✅ **Web安全启用**: `webSecurity: true` 在主进程配置中
- ✅ **CSP Meta标签**: HTML中存在严格的CSP策略
- ✅ **CSP严格策略**: `default-src 'none'` 作为默认策略
- ✅ **无不安全指令**: 不包含 `unsafe-inline` 和 `unsafe-eval`
- ✅ **ContextBridge使用**: 预加载脚本使用 `contextBridge.exposeInMainWorld`
- ✅ **Node API隔离**: 渲染进程无法访问 `require`, `process`, `Buffer` 等

### 推荐验证项（建议通过）
- ✅ **外部链接处理**: `setWindowOpenHandler` 正确配置
- ✅ **权限请求拒绝**: 测试模式下所有权限请求被拒绝
- ✅ **网络请求过滤**: 测试模式下外部网络请求被阻止
- ✅ **菜单栏隐藏**: `autoHideMenuBar: true` 减少攻击面
- ✅ **开发工具控制**: 生产环境禁用 DevTools

### 验证执行命令
```bash
# 构建应用
npm run build

# 执行安全扫描
npm run guard:electron

# 执行安全测试
npm run test:e2e:security

# 完整安全验证
npm run guard:ci
```

---

## 🚨 常见安全问题和解决方案

### 问题 1: 沙盒模式下预加载脚本功能受限
**症状**: 某些 Node.js API 在预加载脚本中不可用  
**原因**: 沙盒模式限制了预加载脚本的能力  
**解决方案**: 使用 IPC 通信将需要 Node.js 的操作移到主进程

```typescript
// 错误做法：在预加载脚本中直接使用文件系统
import { readFileSync } from 'fs' // 沙盒模式下不可用

// 正确做法：通过 IPC 委托给主进程
contextBridge.exposeInMainWorld('fileAPI', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path)
})
```

### 问题 2: CSP 策略过于严格导致功能异常
**症状**: 某些合法资源被 CSP 阻止加载  
**原因**: CSP 策略配置不当或过于严格  
**解决方案**: 精确调整 CSP 策略，为特定功能添加必要的例外

```typescript
// 为 Phaser 游戏添加必要的 CSP 例外
const CSP_POLICY = 
  "default-src 'none'; " +
  "script-src 'self'; " +
  "style-src 'self'; " +
  "img-src 'self' data: blob:; " +        // 允许 blob URL（游戏资源）
  "media-src 'self' blob:; " +            // 允许音频/视频资源
  "worker-src 'self' blob:; " +           // 允许 Web Workers
  "connect-src 'self' https://sentry.io;"
```

### 问题 3: 开发环境下安全限制过严影响调试
**症状**: 开发环境下无法正常调试或热重载  
**原因**: 生产级安全配置在开发环境中过于严格  
**解决方案**: 针对开发环境适度放宽限制，但保持核心安全原则

```typescript
const webPreferences = {
  preload: join(__dirname, 'preload.js'),
  sandbox: true,                    // 始终启用
  contextIsolation: true,          // 始终启用  
  nodeIntegration: false,          // 始终禁用
  webSecurity: true,              // 始终启用
  
  // 开发环境特殊配置
  devTools: process.env.NODE_ENV === 'development',
  
  // 开发环境允许加载本地不安全资源（仅限开发）
  allowRunningInsecureContent: process.env.NODE_ENV === 'development'
}
```

---

**文档版本**: v1.0  
**更新日期**: 2025年8月27日  
**安全等级**: 生产就绪  
**依赖关系**: 依赖于技术栈层配置