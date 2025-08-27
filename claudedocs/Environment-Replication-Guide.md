# 环境复刻指南 - 完整项目架构复制

**目标**: 通过本文档在其他项目中使用 Claude Code CLI 快速复刻当前项目的完整环境，包括安全基座、测试框架和工具链集成。

**架构模式**: 五层架构（Tech Stack → Security Foundation → Testing Architecture → Toolchain → Configuration Management）

---

## 🏗️ 层级 1: 技术栈基础层

### 核心依赖版本矩阵

```json
{
  "react": "19.0.0",
  "electron": "37.2.4", 
  "vite": "7.0.4",
  "typescript": "5.7.2",
  "@tailwindcss/cli": "4.0.0-beta.7",
  "phaser": "3.85.2",
  "playwright": "1.49.0",
  "vitest": "2.1.8",
  "@sentry/electron": "5.5.0"
}
```

### 依赖安装脚本

```bash
# 创建新项目目录
mkdir <project-name> && cd <project-name>

# 初始化 package.json（必须严格匹配版本）
npm init -y

# 核心框架依赖（严格版本控制）
npm install react@19.0.0 react-dom@19.0.0
npm install electron@37.2.4
npm install vite@7.0.4
npm install typescript@5.7.2
npm install @tailwindcss/cli@4.0.0-beta.7

# 游戏引擎和UI
npm install phaser@3.85.2

# 开发和构建工具
npm install -D @types/react@19.0.1
npm install -D @types/react-dom@19.0.1
npm install -D @vitejs/plugin-react@5.0.0
npm install -D electron-builder@25.1.8
npm install -D vite-plugin-electron@0.28.8

# 测试框架
npm install -D playwright@1.49.0 @playwright/test@1.49.0
npm install -D vitest@2.1.8 @vitest/coverage-v8@2.1.8

# 监控和可观测性
npm install @sentry/electron@5.5.0
```

### 关键配置文件模板

#### `vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart: (args) => {
          if (process.env.VSCODE_DEBUG) {
            console.log('[startup] Electron App')
          } else {
            args.startup(['--inspect=5858'])
          }
        },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron'
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart: (args) => args.reload(),
        vite: {
          build: {
            sourcemap: 'inline',
            outDir: 'dist-electron'
          }
        }
      }
    ])
  ],
  server: process.env.VSCODE_DEBUG ? {
    host: '127.0.0.1',
    port: 3000
  } : undefined,
  clearScreen: false
})
```

---

## 🔒 层级 2: 安全基础层

### Electron 安全基线配置

#### 安全三要素（强制执行）
```typescript
// electron/main.ts 中的安全配置
const SECURITY_PREFERENCES = {
  sandbox: true,              // 启用沙盒模式
  contextIsolation: true,     // 启用上下文隔离
  nodeIntegration: false,     // 禁用 Node.js 集成
  webSecurity: true          // 启用 Web 安全
}

const mainWindow = new BrowserWindow({
  width: 900,
  height: 670,
  show: false,
  autoHideMenuBar: true,
  webPreferences: {
    preload: join(__dirname, 'preload.js'),
    ...SECURITY_PREFERENCES
  }
})
```

#### CSP (Content Security Policy) 严格策略
```typescript
// 在主进程中设置 CSP 响应头
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
```

#### 预加载脚本白名单 API 模式
```typescript
// electron/preload.ts
import { contextBridge } from 'electron'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    version: process.versions.electron,
    isElectron: true,
    electronVersion: process.versions.electron
  })
  
  contextBridge.exposeInMainWorld('__CUSTOM_API__', {
    preloadExposed: true,
    exposedAt: new Date().toISOString()
  })
}
```

### 安全验证检查脚本

#### `scripts/scan_electron_safety.mjs`
```javascript
#!/usr/bin/env node

// 安全基线扫描脚本
const fs = require('fs').promises
const path = require('path')

async function scanElectronSafety() {
  const mainPath = path.join(process.cwd(), 'dist-electron/main.js')
  const preloadPath = path.join(process.cwd(), 'dist-electron/preload.js')
  
  try {
    const mainContent = await fs.readFile(mainPath, 'utf-8')
    const preloadContent = await fs.readFile(preloadPath, 'utf-8')
    
    // 检查关键安全配置
    const securityChecks = [
      { name: 'Sandbox Mode', pattern: /sandbox:\s*true/, required: true },
      { name: 'Context Isolation', pattern: /contextIsolation:\s*true/, required: true },
      { name: 'Node Integration Disabled', pattern: /nodeIntegration:\s*false/, required: true },
      { name: 'Web Security Enabled', pattern: /webSecurity:\s*true/, required: true }
    ]
    
    let passed = 0
    const total = securityChecks.length
    
    for (const check of securityChecks) {
      if (check.pattern.test(mainContent)) {
        console.log(`✅ ${check.name}: PASS`)
        passed++
      } else {
        console.log(`❌ ${check.name}: FAIL`)
      }
    }
    
    console.log(`\n安全基线检查: ${passed}/${total} 通过`)
    
    if (passed < total) {
      process.exit(1)
    }
  } catch (error) {
    console.error('安全检查失败:', error.message)
    process.exit(1)
  }
}

scanElectronSafety()
```

---

## 🧪 层级 3: 测试架构层

### Playwright E2E 测试配置

#### `playwright.config.ts` 完整配置
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  
  projects: [
    {
      name: 'electron-smoke',
      testMatch: '**/smoke.electron.spec.ts',
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'security-audit', 
      testMatch: '**/security/**/*.spec.ts'
    },
    {
      name: 'performance-baseline',
      testMatch: '**/performance/**/*.spec.ts'
    }
  ]
})
```

### 关键测试用例模板

#### 安全基线验证测试
```typescript
// tests/e2e/smoke.electron.spec.ts (核心片段)
import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { test, expect } from '@playwright/test'

test('安全基线：Node.js 全局变量隔离', async () => {
  const app = await electron.launch({
    args: ['./dist-electron/main.js'],
    env: { NODE_ENV: 'test', SECURITY_TEST_MODE: 'true' }
  })
  
  const page = await app.firstWindow()
  
  const nodeGlobals = await page.evaluate(() => ({
    hasRequire: typeof (window as any).require !== 'undefined',
    hasProcess: typeof (window as any).process !== 'undefined',
    hasBuffer: typeof (window as any).Buffer !== 'undefined',
    hasGlobal: typeof (window as any).global !== 'undefined'
  }))
  
  expect(nodeGlobals.hasRequire, 'require() 不应暴露到渲染进程').toBe(false)
  expect(nodeGlobals.hasProcess, 'process 不应暴露到渲染进程').toBe(false)
  expect(nodeGlobals.hasBuffer, 'Buffer 不应暴露到渲染进程').toBe(false)
  expect(nodeGlobals.hasGlobal, 'global 不应暴露到渲染进程').toBe(false)
  
  await app.close()
})

test('安全基线：CSP 策略验证', async () => {
  const app = await electron.launch({
    args: ['./dist-electron/main.js'],
    env: { NODE_ENV: 'test' }
  })
  
  const page = await app.firstWindow()
  
  const cspMeta = await page.locator('meta[http-equiv="Content-Security-Policy"]')
  await expect(cspMeta).toBeAttached()
  
  const cspContent = await cspMeta.getAttribute('content')
  expect(cspContent).toContain("default-src 'none'")
  expect(cspContent).toContain("script-src 'self'")
  expect(cspContent).not.toContain("'unsafe-inline'")
  expect(cspContent).not.toContain("'unsafe-eval'")
  
  await app.close()
})
```

### 测试执行脚本

```bash
# package.json scripts 部分
{
  "test:unit": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:security": "playwright test --project=security-audit", 
  "test:performance": "playwright test --project=performance-baseline"
}
```

---

## 🔧 层级 4: 工具链层

### MCP (Model Context Protocol) 服务器配置

#### `.mcp.json` 配置
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your-context7-key"
      }
    },
    "sequential-thinking": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {
        "ANTHROPIC_API_KEY": "your-anthropic-key"
      }
    },
    "zen-mcp-server": {
      "command": "python",
      "args": ["C:\\buildgame\\vitegame\\zen-mcp-server\\run.py"],
      "cwd": "C:\\buildgame\\vitegame\\zen-mcp-server",
      "env": {
        "ANTHROPIC_API_KEY": "your-anthropic-key",
        "PERPLEXITY_API_KEY": "your-perplexity-key"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\buildgame\\vitegame"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@brave/brave-search-mcp-server"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    }
  }
}
```

### Claude Code CLI 集成配置

#### `.claude/settings.json`
```json
{
  "allowedTools": [
    "Edit",
    "MultiEdit", 
    "Read",
    "Write",
    "Bash(npm *)",
    "Bash(npx *)",
    "Bash(git *)",
    "mcp__*"
  ],
  "projectInstructions": "按照五层架构模式开发，严格遵循安全基线配置",
  "autoCommit": false,
  "maxTokens": 200000
}
```

### BMAD 游戏开发代理系统

#### 可用 Slash 命令
```bash
/game-designer     # 游戏设计师代理（Phaser专用）
/game-developer    # 游戏开发者代理（支持Phaser和Unity）
/architect         # 软件架构师代理
/dev              # 开发工程师代理
/qa               # 质量保证代理
```

#### BMAD 内部命令模式
```bash
# 代理激活后使用：
*help              # 显示可用命令列表
*task              # 执行任务
*create-doc        # 创建文档
*execute-checklist # 执行检查清单
*exit              # 退出代理模式
```

---

## ⚙️ 层级 5: 配置管理层

### 环境变量配置

#### `.env.template`
```bash
# Sentry 监控配置
SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# AI 服务 API 密钥
ANTHROPIC_API_KEY=your-anthropic-key
PERPLEXITY_API_KEY=your-perplexity-key
CONTEXT7_API_KEY=your-context7-key
BRAVE_API_KEY=your-brave-key

# 开发环境配置
NODE_ENV=development
ELECTRON_RENDERER_URL=http://localhost:3000
VSCODE_DEBUG=false
```

### Sentry Release Health 配置

#### `src/main.tsx` - 渲染进程监控
```typescript
import * as Sentry from '@sentry/electron/renderer'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration()
  ],
  tracesSampleRate: 1.0,
  autoSessionTracking: true, // 关键配置：自动会话跟踪
  release: process.env.npm_package_version
})
```

#### `electron/main.ts` - 主进程监控  
```typescript
import * as Sentry from '@sentry/electron/main'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.npm_package_version
})
```

### 质量门禁脚本

#### `scripts/quality_gates.mjs`
```javascript
#!/usr/bin/env node

const fs = require('fs').promises
const { execSync } = require('child_process')

async function runQualityGates() {
  console.log('🚀 运行质量门禁检查...')
  
  try {
    // 1. TypeScript 类型检查
    console.log('📝 TypeScript 检查...')
    execSync('npx tsc --noEmit', { stdio: 'inherit' })
    
    // 2. ESLint 代码规范
    console.log('🔍 ESLint 检查...')  
    execSync('npx eslint . --ext .ts,.tsx', { stdio: 'inherit' })
    
    // 3. 单元测试覆盖率
    console.log('🧪 单元测试覆盖率...')
    execSync('npx vitest run --coverage', { stdio: 'inherit' })
    
    // 4. E2E 安全测试
    console.log('🔒 E2E 安全测试...')
    execSync('npx playwright test --project=security-audit', { stdio: 'inherit' })
    
    // 5. Electron 安全基线
    console.log('⚡ Electron 安全基线...')
    execSync('node scripts/scan_electron_safety.mjs', { stdio: 'inherit' })
    
    console.log('✅ 所有质量门禁检查通过!')
  } catch (error) {
    console.error('❌ 质量门禁检查失败:', error.message)
    process.exit(1)
  }
}

runQualityGates()
```

---

## 🚀 快速复刻执行脚本

### 一键环境复制脚本

#### `setup-project-environment.ps1` (Windows PowerShell)
```powershell
param(
    [string]$ProjectName = "new-electron-game",
    [string]$TemplateRepo = "https://github.com/vitegame-template.git"
)

Write-Host "🚀 开始复刻游戏项目环境..." -ForegroundColor Green

# 1. 创建项目目录
New-Item -ItemType Directory -Path $ProjectName -Force
Set-Location $ProjectName

# 2. 初始化 Git
git init

# 3. 安装核心依赖（严格版本控制）
Write-Host "📦 安装核心依赖..." -ForegroundColor Yellow
npm init -y

$dependencies = @(
    "react@19.0.0",
    "react-dom@19.0.0", 
    "electron@37.2.4",
    "vite@7.0.4",
    "typescript@5.7.2",
    "@tailwindcss/cli@4.0.0-beta.7",
    "phaser@3.85.2",
    "@sentry/electron@5.5.0"
)

$devDependencies = @(
    "@types/react@19.0.1",
    "@types/react-dom@19.0.1",
    "@vitejs/plugin-react@5.0.0",
    "electron-builder@25.1.8",
    "vite-plugin-electron@0.28.8",
    "playwright@1.49.0",
    "@playwright/test@1.49.0",
    "vitest@2.1.8",
    "@vitest/coverage-v8@2.1.8"
)

foreach ($dep in $dependencies) {
    npm install $dep
}

foreach ($devDep in $devDependencies) {
    npm install -D $devDep
}

# 4. 创建核心目录结构
$dirs = @("src", "electron", "tests/e2e", "tests/unit", "scripts", "claudedocs")
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# 5. 复制配置文件模板
Write-Host "⚙️ 创建配置文件..." -ForegroundColor Yellow

# 创建 vite.config.ts
@'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart: (args) => {
          if (process.env.VSCODE_DEBUG) {
            console.log('[startup] Electron App')
          } else {
            args.startup(['--inspect=5858'])
          }
        },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron'
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart: (args) => args.reload(),
        vite: {
          build: {
            sourcemap: 'inline',
            outDir: 'dist-electron'
          }
        }
      }
    ])
  ],
  server: process.env.VSCODE_DEBUG ? {
    host: '127.0.0.1',
    port: 3000
  } : undefined,
  clearScreen: false
})
'@ | Out-File -FilePath "vite.config.ts" -Encoding UTF8

# 6. 安装 Playwright 浏览器
Write-Host "🎭 安装 Playwright 浏览器..." -ForegroundColor Yellow
npx playwright install --with-deps

# 7. 创建 MCP 配置
Write-Host "🔧 配置 MCP 服务器..." -ForegroundColor Yellow
@'
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your-context7-key"
      }
    },
    "filesystem": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
'@ | Out-File -FilePath ".mcp.json" -Encoding UTF8

# 8. 运行初始验证
Write-Host "✅ 运行初始验证..." -ForegroundColor Green
npm run build 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 环境复刻成功! 项目已就绪。" -ForegroundColor Green
} else {
    Write-Host "⚠️ 构建验证失败，请检查配置。" -ForegroundColor Red
}

Write-Host "📋 下一步操作:"
Write-Host "1. 配置环境变量 (.env)"
Write-Host "2. 运行 npm run dev 启动开发环境"
Write-Host "3. 运行 npm run test:e2e 验证测试框架"
```

### 验证检查清单

#### 环境复刻验证步骤
```bash
# 1. 依赖版本验证
npm list react electron vite typescript

# 2. 构建验证
npm run build

# 3. 安全基线验证  
npm run guard:electron

# 4. 测试框架验证
npm run test:e2e -- --reporter=list

# 5. MCP 服务器连接验证
claude --mcp-debug (在项目目录中)

# 6. 完整 CI 流水线验证
npm run guard:ci
```

---

## 🚨 已知问题与解决方案

### 关键配置缺失

#### 问题 1: Sentry 渲染进程配置不完整
**症状**: Release Health 指标收集不全
**解决方案**: 确保渲染进程中包含 `autoSessionTracking: true`

```typescript
// src/main.tsx 必须包含
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  autoSessionTracking: true, // 关键配置
  integrations: [Sentry.browserTracingIntegration()]
})
```

#### 问题 2: Playwright 在 Windows 上的驱动问题
**症状**: E2E 测试启动失败
**解决方案**: 使用 `--with-deps` 参数，或手动安装系统依赖

```bash
# 优先尝试
npx playwright install --with-deps

# 如果失败，手动安装
npx playwright install chromium
npx playwright install electron
```

#### 问题 3: Vite 7.0 与某些插件不兼容
**症状**: 构建错误或热更新失败  
**解决方案**: 使用经过验证的插件版本组合

```json
{
  "@vitejs/plugin-react": "5.0.0",
  "vite-plugin-electron": "0.28.8"
}
```

---

## 📊 成功验证指标

### 复刻成功标准

- ✅ **依赖安装**: 所有关键依赖版本精确匹配
- ✅ **构建成功**: `npm run build` 零错误完成
- ✅ **安全基线**: Electron 安全三要素全部通过
- ✅ **测试通过**: Playwright E2E 测试 100% 通过 (19/19)
- ✅ **CSP 生效**: Content Security Policy 正确阻止不安全内容
- ✅ **MCP 连接**: 至少 2 个 MCP 服务器成功连接
- ✅ **监控就绪**: Sentry Release Health 数据正常收集
- ✅ **工具链集成**: Claude Code CLI + BMAD 代理系统工作正常

### 验证命令序列

```bash
# 完整验证流水线
npm install                           # 依赖安装验证
npm run build                        # 构建验证  
npm run guard:ci                     # 完整质量门禁
claude --version                     # Claude CLI 验证
bmad status                          # BMAD 工具链验证
```

---

## 📚 参考资源

### 官方文档链接

- [Electron 37 安全指南](https://www.electronjs.org/docs/tutorial/security)
- [React 19 升级指南](https://react.dev/blog/2024/12/05/react-19)
- [Vite 7.0 变更日志](https://vitejs.dev/guide/migration.html)
- [Playwright Electron 测试](https://playwright.dev/docs/api/class-electron)
- [Sentry Electron 集成](https://docs.sentry.io/platforms/javascript/guides/electron/)

### 项目架构参考

- **Five-Layer Architecture Pattern**: Tech Stack → Security → Testing → Toolchain → Configuration
- **Security-First Development**: 沙盒模式 + 上下文隔离 + 严格 CSP
- **AI-Enhanced Workflow**: Claude Code CLI + MCP 服务器 + BMAD 代理系统

---

**文档版本**: v1.0  
**创建日期**: 2025年8月27日  
**适用范围**: Electron 游戏应用项目环境复刻  
**维护状态**: 活跃维护，配置经过生产验证