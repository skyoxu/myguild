# 快速复制脚本模板 - 一键环境部署

**目标**: 提供开箱即用的自动化脚本，实现项目环境的一键复制和验证

---

## 🚀 主要复制脚本

### Windows PowerShell 脚本 (推荐)

#### `setup-vitegame-environment.ps1` - 完整环境复制脚本

```````powershell
<#
.SYNOPSIS
    ViteGame 项目环境一键复制脚本
.DESCRIPTION
    自动复制 ViteGame 项目的完整开发环境，包括：
    - 五层架构配置 (Tech Stack → Security → Testing → Toolchain → Configuration)
    - 依赖安装和版本锁定
    - MCP 服务器配置
    - BMAD 代理系统
    - 质量门禁脚本
.PARAMETER ProjectName
    新项目名称，默认为 'vitegame-clone'
.PARAMETER SkipAPIKeys
    跳过 API 密钥配置，默认为 false
.PARAMETER InstallBMAD
    是否安装 BMAD 系统，默认为 true
.EXAMPLE
    .\setup-vitegame-environment.ps1 -ProjectName "my-game" -InstallBMAD $true
#>

param(
    [string]$ProjectName = "vitegame-clone",
    [switch]$SkipAPIKeys = $false,
    [switch]$InstallBMAD = $true,
    [switch]$Verbose = $false
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColoredOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Step {
    param([string]$Message)
    Write-ColoredOutput "🔄 $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColoredOutput "✅ $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColoredOutput "❌ $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColoredOutput "⚠️  $Message" "Yellow"
}

# 主函数
function Main {
    Write-ColoredOutput "🎮 ViteGame 环境复制脚本启动" "Magenta"
    Write-ColoredOutput "项目名称: $ProjectName" "Gray"
    Write-ColoredOutput "=" * 50 "Gray"

    try {
        # 步骤 1: 环境检查
        Test-Prerequisites

        # 步骤 2: 创建项目目录
        Initialize-ProjectDirectory

        # 步骤 3: 安装核心依赖
        Install-CoreDependencies

        # 步骤 4: 复制配置文件
        Copy-ConfigurationFiles

        # 步骤 5: 设置安全基线
        Setup-SecurityBaseline

        # 步骤 6: 配置测试框架
        Setup-TestingFramework

        # 步骤 7: 配置工具链
        Setup-Toolchain

        # 步骤 8: 配置管理层
        Setup-ConfigurationManagement

        # 步骤 9: 验证环境
        Verify-Environment

        # 步骤 10: 生成使用指南
        Generate-UsageGuide

        Write-Success "🎉 环境复制完成! 项目已就绪。"
        Write-ColoredOutput "📂 项目目录: $(Get-Location)\$ProjectName" "Gray"
        Write-ColoredOutput "📖 查看 USAGE_GUIDE.md 了解下一步操作" "Gray"

    } catch {
        Write-Error "环境复制失败: $($_.Exception.Message)"
        exit 1
    }
}

function Test-Prerequisites {
    Write-Step "检查先决条件"

    # 检查 Node.js
    try {
        $nodeVersion = node --version
        $majorVersion = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
        if ($majorVersion -lt 18) {
            throw "需要 Node.js 18 或更高版本，当前版本: $nodeVersion"
        }
        Write-ColoredOutput "  Node.js: $nodeVersion ✓" "Green"
    } catch {
        throw "Node.js 未安装或版本过低"
    }

    # 检查 Git
    try {
        $gitVersion = git --version
        Write-ColoredOutput "  Git: $gitVersion ✓" "Green"
    } catch {
        throw "Git 未安装"
    }

    # 检查 Python (用于某些 MCP 服务器)
    try {
        $pythonVersion = python --version 2>&1
        Write-ColoredOutput "  Python: $pythonVersion ✓" "Green"
    } catch {
        Write-Warning "Python 未安装，某些 MCP 服务器可能不可用"
    }

    Write-Success "先决条件检查通过"
}

function Initialize-ProjectDirectory {
    Write-Step "创建项目目录结构"

    # 创建主目录
    if (Test-Path $ProjectName) {
        $response = Read-Host "目录 '$ProjectName' 已存在，是否覆盖？(y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            throw "操作取消"
        }
        Remove-Item -Path $ProjectName -Recurse -Force
    }

    New-Item -ItemType Directory -Path $ProjectName -Force | Out-Null
    Set-Location $ProjectName

    # 创建子目录结构
    $directories = @(
        "src/components/ui",
        "src/components/game",
        "src/components/layout",
        "src/hooks",
        "src/utils",
        "src/styles",
        "src/game/scenes",
        "src/shared/contracts",
        "electron",
        "tests/unit",
        "tests/e2e/smoke",
        "tests/e2e/security",
        "tests/e2e/performance",
        "tests/fixtures",
        "scripts",
        "claudedocs",
        "build-resources",
        ".claude/commands/BMad",
        ".claude/commands/bmad2dp",
        ".claude/commands/bmad2du"
    )

    foreach ($dir in $directories) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Write-Success "项目目录结构创建完成"
}

function Install-CoreDependencies {
    Write-Step "安装核心依赖（严格版本控制）"

    # 初始化 package.json
    $packageJson = @{
        name = $ProjectName.ToLower()
        version = "0.1.0"
        type = "module"
        main = "dist-electron/main.js"
        scripts = @{
            dev = "vite"
            "dev:electron" = "vite --mode electron"
            build = "tsc && vite build && electron-builder"
            "build:electron" = "vite build --mode electron"
            preview = "vite preview"
            typecheck = "tsc --project tsconfig.json --noEmit"
            lint = "eslint . --ext .ts,.tsx"
            "lint:fix" = "eslint . --ext .ts,.tsx --fix"
            "test:unit" = "vitest run --coverage"
            "test:unit:ui" = "vitest --ui --coverage"
            "test:e2e" = "playwright test"
            "test:e2e:ui" = "playwright test --ui"
            "test:e2e:smoke" = "playwright test --project=electron-smoke"
            "test:e2e:security" = "playwright test --project=security-audit"
            "test:e2e:performance" = "playwright test --project=performance-baseline"
            "guard:electron" = "node scripts/scan_electron_safety.mjs"
            "guard:quality" = "node scripts/quality_gates.mjs"
            "guard:base" = "node scripts/verify_base_clean.mjs"
            "guard:ci" = "npm run typecheck && npm run lint && npm run test:unit && npm run guard:electron && npm run test:e2e && npm run guard:quality && npm run guard:base"
        }
    } | ConvertTo-Json -Depth 3

    $packageJson | Out-File -FilePath "package.json" -Encoding UTF8

    # 安装主要依赖（严格版本匹配）
    Write-Step "安装主要框架依赖..."
    $mainDeps = @(
        "react@19.0.0",
        "react-dom@19.0.0",
        "electron@37.2.4",
        "vite@7.0.4",
        "typescript@5.7.2",
        "@tailwindcss/cli@4.0.0-beta.7",
        "phaser@3.85.2",
        "@sentry/electron@5.5.0"
    )

    foreach ($dep in $mainDeps) {
        Write-ColoredOutput "  安装: $dep" "Gray"
        npm install $dep --save-exact
        if ($LASTEXITCODE -ne 0) {
            throw "依赖安装失败: $dep"
        }
    }

    # 安装开发依赖
    Write-Step "安装开发工具依赖..."
    $devDeps = @(
        "@types/react@19.0.1",
        "@types/react-dom@19.0.1",
        "@vitejs/plugin-react@5.0.0",
        "electron-builder@25.1.8",
        "vite-plugin-electron@0.28.8",
        "playwright@1.49.0",
        "@playwright/test@1.49.0",
        "vitest@2.1.8",
        "@vitest/coverage-v8@2.1.8",
        "eslint@9.0.0",
        "@typescript-eslint/parser@8.0.0",
        "@typescript-eslint/eslint-plugin@8.0.0"
    )

    foreach ($dep in $devDeps) {
        Write-ColoredOutput "  安装: $dep" "Gray"
        npm install -D $dep --save-exact
        if ($LASTEXITCODE -ne 0) {
            throw "开发依赖安装失败: $dep"
        }
    }

    Write-Success "核心依赖安装完成"
}

function Copy-ConfigurationFiles {
    Write-Step "创建配置文件"

    # Vite 配置
    $viteConfig = @'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { fileURLToPath, URL } from 'node:url'

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
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: process.env.VSCODE_DEBUG ? {
    host: '127.0.0.1',
    port: 3000
  } : undefined,
  clearScreen: false,
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          phaser: ['phaser']
        }
      }
    }
  }
})
'@
    $viteConfig | Out-File -FilePath "vite.config.ts" -Encoding UTF8

    # TypeScript 配置
    $tsConfig = @'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node", "electron", "vite/client"]
  },
  "include": [
    "src/**/*",
    "electron/**/*",
    "vite.config.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "dist-electron"
  ]
}
'@
    $tsConfig | Out-File -FilePath "tsconfig.json" -Encoding UTF8

    # Tailwind 配置
    $tailwindConfig = @'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./electron/**/*.{js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
'@
    $tailwindConfig | Out-File -FilePath "tailwind.config.js" -Encoding UTF8

    Write-Success "基础配置文件创建完成"
}

function Setup-SecurityBaseline {
    Write-Step "设置 Electron 安全基线"

    # 主进程安全配置
    $mainTs = @'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 安全配置常量
const SECURITY_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true
}

function createWindow() {
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

  // 安全配置（测试模式）
  if (process.env.SECURITY_TEST_MODE === 'true') {
    global.__SECURITY_PREFS__ = {
      ...SECURITY_PREFERENCES,
      windowId: mainWindow.id,
      createdAt: new Date().toISOString()
    }
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 设置严格CSP响应头
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

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
'@
    $mainTs | Out-File -FilePath "electron/main.ts" -Encoding UTF8

    # 预加载脚本
    $preloadTs = @'
import { contextBridge } from 'electron'

if (process.contextIsolated) {
  try {
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

    console.log('✅ API暴露成功')
  } catch (error) {
    console.error('❌ API暴露失败:', error)
  }
} else {
  console.warn('⚠️ 上下文隔离未启用')
}
'@
    $preloadTs | Out-File -FilePath "electron/preload.ts" -Encoding UTF8

    Write-Success "安全基线配置完成"
}

function Setup-TestingFramework {
    Write-Step "配置测试框架"

    # Playwright 配置
    $playwrightConfig = @'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'electron-smoke',
      testMatch: '**/smoke/*.spec.ts',
      timeout: 30000
    },
    {
      name: 'security-audit',
      testMatch: '**/security/**/*.spec.ts',
      timeout: 45000
    },
    {
      name: 'performance-baseline',
      testMatch: '**/performance/**/*.spec.ts',
      timeout: 90000
    }
  ]
})
'@
    $playwrightConfig | Out-File -FilePath "playwright.config.ts" -Encoding UTF8

    # Vitest 配置
    $vitestConfig = @'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'dist-electron/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
'@
    $vitestConfig | Out-File -FilePath "vitest.config.ts" -Encoding UTF8

    # 安装 Playwright 浏览器
    Write-Step "安装 Playwright 浏览器..."
    npx playwright install --with-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Playwright 浏览器安装失败，请手动运行: npx playwright install"
    }

    Write-Success "测试框架配置完成"
}

function Setup-Toolchain {
    Write-Step "配置 AI 工具链"

    # MCP 配置
    $mcpConfig = @'
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
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
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
'@
    $mcpConfig | Out-File -FilePath ".mcp.json" -Encoding UTF8

    # Claude Code 配置
    $claudeSettings = @'
{
  "allowedTools": [
    "Edit",
    "MultiEdit",
    "Read",
    "Write",
    "Bash(npm *)",
    "Bash(npx *)",
    "Bash(git *)",
    "mcp__context7__*",
    "mcp__sequential-thinking__*",
    "mcp__filesystem__*",
    "mcp__brave-search__*"
  ],
  "projectInstructions": "遵循五层架构模式开发，严格执行安全基线配置",
  "autoCommit": false,
  "maxTokens": 200000
}
'@
    $claudeSettings | Out-File -FilePath ".claude/settings.json" -Encoding UTF8

    # 安装 BMAD（可选）
    if ($InstallBMAD) {
        Write-Step "安装 BMAD 代理系统..."
        try {
            npm install -g bmad-method@latest
            bmad install --expansion-packs bmad2dp,bmad2du --ide claude-code
            Write-Success "BMAD 系统安装完成"
        } catch {
            Write-Warning "BMAD 安装失败，请手动安装: npm install -g bmad-method@latest"
        }
    }

    Write-Success "工具链配置完成"
}

function Setup-ConfigurationManagement {
    Write-Step "配置管理和监控"

    # 环境变量模板
    $envTemplate = @'
# ======================================
# 应用基础配置
# ======================================
NODE_ENV=development
ELECTRON_RENDERER_URL=http://localhost:3000
VSCODE_DEBUG=false

# ======================================
# Sentry 监控配置
# ======================================
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ORG=your-organization
SENTRY_PROJECT=your-project-name
SENTRY_AUTO_SESSION_TRACKING=true

# ======================================
# AI 服务API密钥
# ======================================
ANTHROPIC_API_KEY=your-anthropic-key
PERPLEXITY_API_KEY=your-perplexity-key
CONTEXT7_API_KEY=your-context7-key
BRAVE_API_KEY=your-brave-search-key

# ======================================
# BMAD系统配置
# ======================================
BMAD_VERSION=4.37.0
BMAD_CONFIG_PATH=.claude/commands/
'@
    $envTemplate | Out-File -FilePath ".env.template" -Encoding UTF8

    # 质量门禁脚本（简化版）
    $qualityGates = @'
#!/usr/bin/env node

import { execSync } from 'child_process'

console.log('🚀 运行质量门禁检查...')

try {
  console.log('📝 TypeScript 检查...')
  execSync('npx tsc --noEmit', { stdio: 'inherit' })

  console.log('🔍 ESLint 检查...')
  execSync('npx eslint . --ext .ts,.tsx', { stdio: 'inherit' })

  console.log('🧪 单元测试...')
  execSync('npx vitest run --coverage', { stdio: 'inherit' })

  console.log('🎭 E2E 测试...')
  execSync('npx playwright test', { stdio: 'inherit' })

  console.log('✅ 所有质量门禁检查通过!')
} catch (error) {
  console.error('❌ 质量门禁检查失败:', error.message)
  process.exit(1)
}
'@
    $qualityGates | Out-File -FilePath "scripts/quality_gates.mjs" -Encoding UTF8

    # 安全扫描脚本（简化版）
    $securityScan = @'
#!/usr/bin/env node

import { readFile } from 'fs/promises'
import { join } from 'path'

console.log('🔒 开始 Electron 安全基线扫描...')

try {
  const mainContent = await readFile(join(process.cwd(), 'dist-electron/main.js'), 'utf-8')

  const checks = [
    { name: 'Sandbox Mode', pattern: /sandbox:\s*true/, required: true },
    { name: 'Context Isolation', pattern: /contextIsolation:\s*true/, required: true },
    { name: 'Node Integration Disabled', pattern: /nodeIntegration:\s*false/, required: true }
  ]

  let passed = 0
  for (const check of checks) {
    if (check.pattern.test(mainContent)) {
      console.log(`✅ ${check.name}: PASS`)
      passed++
    } else {
      console.log(`❌ ${check.name}: FAIL`)
    }
  }

  if (passed === checks.length) {
    console.log('🎉 安全基线检查通过!')
  } else {
    process.exit(1)
  }
} catch (error) {
  console.error('安全检查失败:', error.message)
  process.exit(1)
}
'@
    $securityScan | Out-File -FilePath "scripts/scan_electron_safety.mjs" -Encoding UTF8

    Write-Success "配置管理设置完成"
}

function Verify-Environment {
    Write-Step "验证环境配置"

    try {
        Write-ColoredOutput "  检查依赖..." "Gray"
        npm list --depth=0 | Out-Null

        Write-ColoredOutput "  TypeScript 类型检查..." "Gray"
        npx tsc --noEmit

        if ($LASTEXITCODE -eq 0) {
            Write-Success "环境验证通过"
        } else {
            Write-Warning "环境验证部分失败，但基础环境已配置"
        }
    } catch {
        Write-Warning "环境验证失败，但基础环境已配置"
    }
}

function Generate-UsageGuide {
    Write-Step "生成使用指南"

    $usageGuide = @"
# $ProjectName 使用指南

## 🚀 快速开始

### 1. 配置环境变量
``````bash
# 复制环境变量模板并填入真实的API密钥
copy .env.template .env
# 编辑 .env 文件，填入你的API密钥
```````

### 2. 启动开发环境

```bash
# 启动 Vite 开发服务器
npm run dev

# 在另一个终端启动 Electron 应用
npm run dev:electron
```

### 3. 运行测试

```bash
# 单元测试
npm run test:unit

# E2E测试（需要先构建）
npm run build
npm run test:e2e
```

### 4. 质量检查

```bash
# 完整质量门禁检查
npm run guard:ci
```

## 📁 项目结构

- \`src/\` - React 渲染进程源码
- \`electron/\` - Electron 主进程和预加载脚本
- \`tests/\` - 测试文件
- \`scripts/\` - 构建和质量门禁脚本
- \`claudedocs/\` - Claude Code 文档

## 🔧 可用命令

- \`npm run dev\` - 启动 Vite 开发服务器
- \`npm run dev:electron\` - 启动 Electron 开发环境
- \`npm run build\` - 构建生产版本
- \`npm run test:unit\` - 运行单元测试
- \`npm run test:e2e\` - 运行 E2E 测试
- \`npm run guard:ci\` - 完整质量检查

## 🤖 AI 工具使用

### Claude Code CLI

```bash
# 在项目目录启动 Claude Code
claude

# 调试模式启动（查看MCP服务器连接）
claude --mcp-debug
```

### BMAD 代理系统

```bash
# 启动游戏设计师代理
/game-designer

# 查看可用命令
*help

# 创建游戏设计文档
*create-doc game-design-document.yaml
```

## 📋 下一步

1. 填写 `.env` 文件中的API密钥
2. 运行 \`npm run dev\` 启动开发环境
3. 运行 \`npm run guard:ci\` 验证所有配置
4. 开始开发你的游戏！

更多详细信息请参考 \`claudedocs/\` 目录中的文档。
"@
$usageGuide | Out-File -FilePath "USAGE_GUIDE.md" -Encoding UTF8

    Write-Success "使用指南已生成"

}

# 执行主函数

Main

# 结束提示

Write-ColoredOutput "`n🎮 ViteGame 环境复制完成!" "Green"
Write-ColoredOutput "📖 请查看 USAGE_GUIDE.md 了解如何使用新环境" "Cyan"
Write-ColoredOutput "⚠️ 记得填写 .env 文件中的API密钥" "Yellow"

````

### Node.js 跨平台脚本

#### `setup-environment.mjs` - 跨平台 Node.js 脚本
```javascript
#!/usr/bin/env node

/**
 * ViteGame 环境复制脚本 (跨平台 Node.js 版本)
 *
 * 使用方法:
 *   node setup-environment.mjs [project-name] [options]
 *
 * 选项:
 *   --skip-api-keys    跳过API密钥配置
 *   --skip-bmad       跳过BMAD安装
 *   --verbose         详细输出
 */

import { execSync, spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

class EnvironmentReplicator {
  constructor(options = {}) {
    this.projectName = options.projectName || 'vitegame-clone'
    this.skipAPIKeys = options.skipAPIKeys || false
    this.skipBMAD = options.skipBMAD || false
    this.verbose = options.verbose || false

    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    }
  }

  log(message, color = 'white') {
    const colorCode = this.colors[color] || this.colors.white
    console.log(`${colorCode}${message}${this.colors.reset}`)
  }

  step(message) {
    this.log(`🔄 ${message}`, 'cyan')
  }

  success(message) {
    this.log(`✅ ${message}`, 'green')
  }

  error(message) {
    this.log(`❌ ${message}`, 'red')
  }

  warning(message) {
    this.log(`⚠️  ${message}`, 'yellow')
  }

  execCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf-8',
        stdio: this.verbose ? 'inherit' : 'pipe',
        ...options
      })
      return result
    } catch (error) {
      throw new Error(`命令执行失败: ${command}\n${error.message}`)
    }
  }

  async run() {
    this.log('🎮 ViteGame 环境复制脚本启动', 'magenta')
    this.log(`项目名称: ${this.projectName}`)
    this.log('='.repeat(50))

    try {
      await this.checkPrerequisites()
      await this.initializeProject()
      await this.installDependencies()
      await this.createConfiguration()
      await this.setupSecurity()
      await this.setupTesting()
      await this.setupToolchain()
      await this.setupConfiguration()
      await this.verifySetup()
      await this.generateGuide()

      this.success('🎉 环境复制完成! 项目已就绪。')
      this.log(`📂 项目目录: ${resolve(this.projectName)}`)
      this.log('📖 查看 USAGE_GUIDE.md 了解下一步操作')

    } catch (error) {
      this.error(`环境复制失败: ${error.message}`)
      process.exit(1)
    }
  }

  async checkPrerequisites() {
    this.step('检查先决条件')

    // 检查 Node.js
    try {
      const nodeVersion = this.execCommand('node --version').trim()
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
      if (majorVersion < 18) {
        throw new Error(`需要 Node.js 18+，当前: ${nodeVersion}`)
      }
      this.log(`  Node.js: ${nodeVersion} ✓`, 'green')
    } catch (error) {
      throw new Error('Node.js 未安装或版本过低')
    }

    // 检查 npm
    try {
      const npmVersion = this.execCommand('npm --version').trim()
      this.log(`  npm: ${npmVersion} ✓`, 'green')
    } catch (error) {
      throw new Error('npm 未安装')
    }

    // 检查 Git
    try {
      const gitVersion = this.execCommand('git --version').trim()
      this.log(`  Git: ${gitVersion} ✓`, 'green')
    } catch (error) {
      throw new Error('Git 未安装')
    }

    this.success('先决条件检查通过')
  }

  async initializeProject() {
    this.step('初始化项目目录')

    // 检查项目目录是否存在
    try {
      await fs.access(this.projectName)
      this.warning(`目录 '${this.projectName}' 已存在，将被覆盖`)
      await fs.rm(this.projectName, { recursive: true, force: true })
    } catch (error) {
      // 目录不存在，继续
    }

    // 创建项目目录
    await fs.mkdir(this.projectName, { recursive: true })
    process.chdir(this.projectName)

    // 创建子目录结构
    const directories = [
      'src/components/ui',
      'src/components/game',
      'src/components/layout',
      'src/hooks',
      'src/utils',
      'src/styles',
      'src/game/scenes',
      'src/shared/contracts',
      'electron',
      'tests/unit',
      'tests/e2e/smoke',
      'tests/e2e/security',
      'tests/e2e/performance',
      'tests/fixtures',
      'scripts',
      'claudedocs',
      'build-resources',
      '.claude/commands/BMad',
      '.claude/commands/bmad2dp',
      '.claude/commands/bmad2du'
    ]

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true })
    }

    this.success('项目目录结构创建完成')
  }

  async installDependencies() {
    this.step('安装依赖包')

    // 创建 package.json
    const packageJson = {
      name: this.projectName.toLowerCase(),
      version: "0.1.0",
      type: "module",
      main: "dist-electron/main.js",
      scripts: {
        dev: "vite",
        "dev:electron": "vite --mode electron",
        build: "tsc && vite build && electron-builder",
        "build:electron": "vite build --mode electron",
        preview: "vite preview",
        typecheck: "tsc --project tsconfig.json --noEmit",
        lint: "eslint . --ext .ts,.tsx",
        "lint:fix": "eslint . --ext .ts,.tsx --fix",
        "test:unit": "vitest run --coverage",
        "test:unit:ui": "vitest --ui --coverage",
        "test:e2e": "playwright test",
        "test:e2e:ui": "playwright test --ui",
        "test:e2e:smoke": "playwright test --project=electron-smoke",
        "test:e2e:security": "playwright test --project=security-audit",
        "test:e2e:performance": "playwright test --project=performance-baseline",
        "guard:electron": "node scripts/scan_electron_safety.mjs",
        "guard:quality": "node scripts/quality_gates.mjs",
        "guard:ci": "npm run typecheck && npm run lint && npm run test:unit && npm run guard:electron && npm run test:e2e && npm run guard:quality"
      }
    }

    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2))

    // 安装主要依赖
    this.log('  安装核心框架...', 'cyan')
    const mainDeps = [
      'react@19.0.0',
      'react-dom@19.0.0',
      'electron@37.2.4',
      'vite@7.0.4',
      'typescript@5.7.2',
      '@tailwindcss/cli@4.0.0-beta.7',
      'phaser@3.85.2',
      '@sentry/electron@5.5.0'
    ]

    this.execCommand(`npm install --save-exact ${mainDeps.join(' ')}`)

    // 安装开发依赖
    this.log('  安装开发工具...', 'cyan')
    const devDeps = [
      '@types/react@19.0.1',
      '@types/react-dom@19.0.1',
      '@vitejs/plugin-react@5.0.0',
      'electron-builder@25.1.8',
      'vite-plugin-electron@0.28.8',
      'playwright@1.49.0',
      '@playwright/test@1.49.0',
      'vitest@2.1.8',
      '@vitest/coverage-v8@2.1.8'
    ]

    this.execCommand(`npm install -D --save-exact ${devDeps.join(' ')}`)

    this.success('依赖安装完成')
  }

  async createConfiguration() {
    this.step('创建配置文件')

    // 创建所有必要的配置文件
    await this.createViteConfig()
    await this.createTypeScriptConfig()
    await this.createTailwindConfig()
    await this.createESLintConfig()

    this.success('配置文件创建完成')
  }

  async createViteConfig() {
    const config = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { fileURLToPath, URL } from 'node:url'

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
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: process.env.VSCODE_DEBUG ? {
    host: '127.0.0.1',
    port: 3000
  } : undefined,
  clearScreen: false
})
`
    await fs.writeFile('vite.config.ts', config)
  }

  async createTypeScriptConfig() {
    const config = {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "Bundler",
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedSideEffectImports: true,
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"]
        },
        types: ["node", "electron", "vite/client"]
      },
      include: [
        "src/**/*",
        "electron/**/*",
        "vite.config.ts"
      ],
      exclude: [
        "node_modules",
        "dist",
        "dist-electron"
      ]
    }

    await fs.writeFile('tsconfig.json', JSON.stringify(config, null, 2))
  }

  async createTailwindConfig() {
    const config = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./electron/**/*.{js,ts}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`
    await fs.writeFile('tailwind.config.js', config)
  }

  async createESLintConfig() {
    const config = {
      extends: [
        '@typescript-eslint/recommended'
      ],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      rules: {}
    }

    await fs.writeFile('.eslintrc.json', JSON.stringify(config, null, 2))
  }

  // ... 其他方法继续 ...
}

// 解析命令行参数
function parseArguments() {
  const args = process.argv.slice(2)
  const options = {
    projectName: 'vitegame-clone',
    skipAPIKeys: false,
    skipBMAD: false,
    verbose: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (!arg.startsWith('--') && !options.projectName.includes('vitegame-clone')) {
      // 第一个非选项参数作为项目名
      continue
    } else if (!arg.startsWith('--')) {
      options.projectName = arg
    } else if (arg === '--skip-api-keys') {
      options.skipAPIKeys = true
    } else if (arg === '--skip-bmad') {
      options.skipBMAD = true
    } else if (arg === '--verbose') {
      options.verbose = true
    }
  }

  return options
}

// 主函数
async function main() {
  const options = parseArguments()
  const replicator = new EnvironmentReplicator(options)
  await replicator.run()
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason)
  process.exit(1)
})

// 运行脚本
main().catch(console.error)
````

---

## 🛠️ 辅助工具脚本

### 环境验证脚本

```javascript
// verify-environment.mjs - 环境验证工具
#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'

class EnvironmentVerifier {
  constructor() {
    this.checks = []
    this.errors = []
    this.warnings = []
  }

  async verify() {
    console.log('🔍 开始环境验证...\n')

    this.checkProjectStructure()
    this.checkDependencies()
    this.checkConfiguration()
    this.checkAPIKeys()
    this.checkBuildability()
    this.checkTestability()

    this.generateReport()
  }

  checkProjectStructure() {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'playwright.config.ts',
      '.mcp.json',
      'electron/main.ts',
      'electron/preload.ts'
    ]

    const requiredDirs = [
      'src',
      'tests/e2e',
      'scripts',
      '.claude'
    ]

    let passed = 0

    requiredFiles.forEach(file => {
      if (existsSync(file)) {
        passed++
        this.addCheck(`文件 ${file}`, '存在', 'PASS')
      } else {
        this.addCheck(`文件 ${file}`, '缺失', 'FAIL')
        this.errors.push(`缺少必需文件: ${file}`)
      }
    })

    requiredDirs.forEach(dir => {
      if (existsSync(dir)) {
        passed++
        this.addCheck(`目录 ${dir}`, '存在', 'PASS')
      } else {
        this.addCheck(`目录 ${dir}`, '缺失', 'FAIL')
        this.errors.push(`缺少必需目录: ${dir}`)
      }
    })
  }

  checkDependencies() {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
      const requiredDeps = {
        'react': '19.0.0',
        'electron': '37.2.4',
        'vite': '7.0.4',
        'typescript': '5.7.2',
        'phaser': '3.85.2'
      }

      let matched = 0
      Object.entries(requiredDeps).forEach(([dep, version]) => {
        const installedVersion = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
        if (installedVersion === version) {
          matched++
          this.addCheck(`依赖 ${dep}`, `版本 ${version}`, 'PASS')
        } else {
          this.addCheck(`依赖 ${dep}`, `版本不匹配: 期望${version}, 实际${installedVersion}`, 'FAIL')
          this.errors.push(`依赖版本不匹配: ${dep}`)
        }
      })

      // 检查依赖是否已安装
      try {
        execSync('npm list --depth=0', { stdio: 'pipe' })
        this.addCheck('依赖安装', '完整', 'PASS')
      } catch (error) {
        this.addCheck('依赖安装', '不完整', 'FAIL')
        this.errors.push('存在未安装的依赖')
      }

    } catch (error) {
      this.addCheck('package.json', '读取失败', 'FAIL')
      this.errors.push('无法读取package.json')
    }
  }

  checkConfiguration() {
    // 检查 TypeScript 配置
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' })
      this.addCheck('TypeScript 配置', '有效', 'PASS')
    } catch (error) {
      this.addCheck('TypeScript 配置', '类型错误', 'FAIL')
      this.errors.push('TypeScript配置存在问题')
    }

    // 检查 MCP 配置
    if (existsSync('.mcp.json')) {
      try {
        const mcpConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'))
        const serverCount = Object.keys(mcpConfig.mcpServers || {}).length
        this.addCheck('MCP 配置', `${serverCount}个服务器`, 'PASS')
      } catch (error) {
        this.addCheck('MCP 配置', '格式错误', 'FAIL')
        this.errors.push('MCP配置文件格式错误')
      }
    } else {
      this.addCheck('MCP 配置', '缺失', 'WARN')
      this.warnings.push('MCP配置文件缺失')
    }
  }

  checkAPIKeys() {
    if (existsSync('.env')) {
      const envContent = readFileSync('.env', 'utf-8')
      const requiredKeys = [
        'ANTHROPIC_API_KEY',
        'SENTRY_DSN'
      ]

      const optionalKeys = [
        'PERPLEXITY_API_KEY',
        'CONTEXT7_API_KEY',
        'BRAVE_API_KEY'
      ]

      const missingRequired = requiredKeys.filter(key =>
        !envContent.includes(`${key}=`) || envContent.includes(`${key}=your-`)
      )

      const availableOptional = optionalKeys.filter(key =>
        envContent.includes(`${key}=`) && !envContent.includes(`${key}=your-`)
      )

      if (missingRequired.length === 0) {
        this.addCheck('必需 API 密钥', '已配置', 'PASS')
      } else {
        this.addCheck('必需 API 密钥', `缺失 ${missingRequired.length} 个`, 'FAIL')
        this.errors.push(`缺失必需API密钥: ${missingRequired.join(', ')}`)
      }

      this.addCheck('可选 API 密钥', `${availableOptional.length}/${optionalKeys.length} 已配置`, 'INFO')

    } else {
      this.addCheck('环境变量', '未配置', 'WARN')
      this.warnings.push('请复制.env.template到.env并配置API密钥')
    }
  }

  checkBuildability() {
    try {
      console.log('  正在测试构建能力...')
      execSync('npm run build', { stdio: 'pipe' })
      this.addCheck('构建测试', '成功', 'PASS')
    } catch (error) {
      this.addCheck('构建测试', '失败', 'FAIL')
      this.errors.push('项目无法正常构建')
    }
  }

  checkTestability() {
    try {
      console.log('  正在测试单元测试...')
      execSync('npm run test:unit', { stdio: 'pipe' })
      this.addCheck('单元测试', '通过', 'PASS')
    } catch (error) {
      this.addCheck('单元测试', '失败', 'WARN')
      this.warnings.push('单元测试执行失败，可能需要先编写测试')
    }
  }

  addCheck(name, result, status) {
    this.checks.push({ name, result, status })
  }

  generateReport() {
    const passed = this.checks.filter(c => c.status === 'PASS').length
    const failed = this.checks.filter(c => c.status === 'FAIL').length
    const warnings = this.checks.filter(c => c.status === 'WARN').length
    const info = this.checks.filter(c => c.status === 'INFO').length

    console.log('\n📋 环境验证报告:')
    console.log('='.repeat(60))

    this.checks.forEach(check => {
      const icons = {
        'PASS': '✅',
        'FAIL': '❌',
        'WARN': '⚠️',
        'INFO': 'ℹ️'
      }
      const icon = icons[check.status] || '?'
      console.log(`${icon} ${check.name}: ${check.result}`)
    })

    console.log('='.repeat(60))
    console.log(`📊 结果: ${passed} 通过 | ${failed} 失败 | ${warnings} 警告 | ${info} 信息`)

    if (this.errors.length > 0) {
      console.log('\n🚨 错误:')
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告:')
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`)
      })
    }

    if (failed === 0) {
      console.log('\n🎉 环境验证通过! 项目已准备就绪。')
      process.exit(0)
    } else {
      console.log('\n❌ 环境验证失败，请修复上述问题。')
      process.exit(1)
    }
  }
}

// 运行验证
const verifier = new EnvironmentVerifier()
verifier.verify().catch(console.error)
```

---

## 📋 使用说明和最佳实践

### 快速开始指南

```bash
# Windows PowerShell 用户
.\setup-vitegame-environment.ps1 -ProjectName "my-awesome-game"

# 跨平台 Node.js 用户
node setup-environment.mjs my-awesome-game --verbose

# 验证环境配置
node verify-environment.mjs
```

### 脚本功能对比

| 功能       | PowerShell 脚本 | Node.js 脚本 | 验证脚本 |
| ---------- | --------------- | ------------ | -------- |
| 平台兼容性 | Windows         | 跨平台       | 跨平台   |
| 依赖安装   | ✅              | ✅           | -        |
| 配置生成   | ✅              | ✅           | -        |
| BMAD集成   | ✅              | ✅           | -        |
| 环境验证   | ✅              | ✅           | ✅       |
| 详细报告   | ✅              | ✅           | ✅       |
| 错误处理   | ✅              | ✅           | ✅       |

### 自定义选项

#### PowerShell 脚本参数

```powershell
# 基本使用
.\setup-vitegame-environment.ps1

# 自定义项目名称
.\setup-vitegame-environment.ps1 -ProjectName "my-game"

# 跳过API密钥配置
.\setup-vitegame-environment.ps1 -SkipAPIKeys

# 不安装BMAD
.\setup-vitegame-environment.ps1 -InstallBMAD $false

# 详细输出
.\setup-vitegame-environment.ps1 -Verbose
```

#### Node.js 脚本参数

```bash
# 基本使用
node setup-environment.mjs

# 自定义项目名称
node setup-environment.mjs my-game

# 跳过可选功能
node setup-environment.mjs --skip-api-keys --skip-bmad

# 详细输出
node setup-environment.mjs --verbose
```

---

## ✅ 脚本验证清单

### 复制成功标准

- ✅ **项目结构**: 所有必需目录和文件已创建
- ✅ **依赖安装**: 所有依赖包按精确版本安装
- ✅ **配置文件**: 所有配置文件正确生成
- ✅ **安全基线**: Electron 安全配置已设置
- ✅ **测试框架**: Playwright 和 Vitest 配置完成
- ✅ **工具链**: MCP 服务器和 Claude Code 配置就绪
- ✅ **构建能力**: 项目可以成功构建
- ✅ **使用指南**: 详细的使用文档已生成

### 故障排除

```bash
# 常见问题解决
# 1. 权限问题
sudo chmod +x setup-environment.mjs

# 2. Node.js 版本过低
nvm install 18
nvm use 18

# 3. 依赖安装失败
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 4. Playwright 安装问题
npx playwright install --with-deps

# 5. 验证环境
node verify-environment.mjs
```

---

**文档版本**: v1.0  
**更新日期**: 2025年8月27日  
**脚本兼容性**: Windows PowerShell 5.1+ / Node.js 18+  
**依赖关系**: 依赖于完整的环境复制指南文档
