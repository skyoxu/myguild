# 配置管理层详细配置 - 环境设置与监控体系

**层级**: Layer 5 - Configuration Management  
**目标**: 建立完整的配置管理体系：环境变量管理 + 监控配置 + 部署配置 + 验证体系

---

## ⚙️ 配置管理架构概览

### 四层配置管理体系
```
🔺 生产部署配置      - 构建、分发、更新配置
🔺 监控和可观测性     - Sentry、日志、指标收集  
🔺 开发环境配置      - 本地开发、调试、测试配置
🔺 基础环境变量      - API密钥、路径、开关配置
```

### 配置优先级和继承
```
生产环境配置 > 测试环境配置 > 开发环境配置 > 默认配置
```

---

## 🌍 环境变量配置体系

### 基础环境变量模板
```bash
# .env.template - 基础配置模板
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
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# Sentry Release Health 配置
SENTRY_RELEASE_HEALTH_ENABLED=true
SENTRY_AUTO_SESSION_TRACKING=true
SENTRY_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1

# ======================================
# AI 服务API密钥（工具链层）
# ======================================
ANTHROPIC_API_KEY=your-anthropic-key
PERPLEXITY_API_KEY=your-perplexity-key
OPENAI_API_KEY=your-openai-key
GOOGLE_API_KEY=your-google-key

# 专用服务API密钥
CONTEXT7_API_KEY=your-context7-key
BRAVE_API_KEY=your-brave-search-key

# ======================================
# 开发工具配置
# ======================================
# BMAD系统配置
BMAD_VERSION=4.37.0
BMAD_CONFIG_PATH=.claude/commands/
BMAD_EXPANSION_PACKS=bmad2dp,bmad2du,infrastructure-devops

# MCP配置
MCP_DEBUG=false
MCP_LOG_LEVEL=info
MCP_TIMEOUT=30000

# ======================================
# 构建和部署配置
# ======================================
BUILD_TARGET=electron
BUILD_PLATFORM=win32
PACKAGE_VERSION=0.1.0

# 代码签名配置（生产环境）
CODE_SIGN_ENABLED=false
CODE_SIGN_IDENTITY=your-signing-identity
CODE_SIGN_CERTIFICATE=path/to/certificate.p12

# 自动更新配置
AUTO_UPDATE_ENABLED=false
UPDATE_SERVER_URL=https://your-update-server.com
```

### 环境特定配置文件

#### `.env.development` - 开发环境
```bash
NODE_ENV=development
ELECTRON_RENDERER_URL=http://localhost:3000
VSCODE_DEBUG=true

# 开发环境Sentry配置（较低采样率）
SENTRY_DSN=your-dev-sentry-dsn
SENTRY_SAMPLE_RATE=0.1
SENTRY_TRACES_SAMPLE_RATE=0.01
SENTRY_AUTO_SESSION_TRACKING=true

# 开发工具启用
MCP_DEBUG=true
MCP_LOG_LEVEL=debug

# 安全配置（开发时稍微宽松）
DEV_TOOLS_ENABLED=true
CSP_REPORT_ONLY=true

# 性能调试
PERFORMANCE_MONITORING=true
MEMORY_PROFILING=true
```

#### `.env.test` - 测试环境
```bash
NODE_ENV=test
CI=true
SECURITY_TEST_MODE=true

# 测试环境网络隔离
NETWORK_ISOLATION=true
EXTERNAL_REQUESTS_BLOCKED=true

# Sentry配置（测试专用项目）
SENTRY_DSN=your-test-sentry-dsn
SENTRY_SAMPLE_RATE=1.0
SENTRY_AUTO_SESSION_TRACKING=true
SENTRY_ENVIRONMENT=test

# 测试工具配置
PLAYWRIGHT_HEADLESS=true
VITEST_COVERAGE_ENABLED=true
TEST_TIMEOUT=30000

# AI服务配置（测试模式，限制调用）
AI_API_RATE_LIMIT=10
AI_API_TIMEOUT=10000
```

#### `.env.production` - 生产环境
```bash
NODE_ENV=production

# 生产Sentry配置（完整监控）
SENTRY_DSN=your-prod-sentry-dsn
SENTRY_SAMPLE_RATE=0.1
SENTRY_TRACES_SAMPLE_RATE=0.01
SENTRY_AUTO_SESSION_TRACKING=true
SENTRY_ENVIRONMENT=production

# 安全配置（最严格）
CSP_ENFORCE=true
DEV_TOOLS_ENABLED=false
SECURITY_HEADERS_ENABLED=true

# 性能配置
PERFORMANCE_OPTIMIZATION=true
BUNDLE_ANALYZER=false
SOURCE_MAPS_ENABLED=false

# 自动更新
AUTO_UPDATE_ENABLED=true
UPDATE_CHECK_INTERVAL=3600000  # 1小时

# 代码签名（生产必需）
CODE_SIGN_ENABLED=true
CODE_SIGN_IDENTITY=your-prod-signing-identity
```

---

## 📊 Sentry 监控和可观测性配置

### Sentry 主进程配置
```typescript
// electron/main.ts - Sentry 主进程集成
import * as Sentry from '@sentry/electron/main'

// 主进程Sentry初始化
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Release管理
  release: process.env.npm_package_version,
  environment: process.env.NODE_ENV,
  
  // 采样配置
  sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.01'),
  
  // 主进程特定配置
  integrations: [
    // 主进程集成
  ],
  
  // 标签和上下文
  initialScope: {
    tags: {
      component: 'main-process',
      platform: process.platform,
      arch: process.arch
    },
    user: {
      id: 'electron-user'
    }
  },
  
  // 错误过滤
  beforeSend(event) {
    // 过滤开发环境错误
    if (process.env.NODE_ENV === 'development') {
      return null
    }
    return event
  }
})
```

### Sentry 渲染进程配置
```typescript
// src/main.tsx - Sentry 渲染进程集成
import * as Sentry from '@sentry/electron/renderer'

// 渲染进程Sentry初始化
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Release管理
  release: process.env.npm_package_version,
  environment: process.env.NODE_ENV,
  
  // 采样配置
  sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.01'),
  
  // 渲染进程特定配置
  integrations: [
    Sentry.browserTracingIntegration({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      )
    })
  ],
  
  // 会话跟踪（Release Health关键配置）
  autoSessionTracking: process.env.SENTRY_AUTO_SESSION_TRACKING === 'true',
  
  // 用户反馈
  showReportDialog: false,
  
  // 标签和上下文
  initialScope: {
    tags: {
      component: 'renderer-process',
      electronAPI: typeof (window as any).electronAPI !== 'undefined'
    }
  },
  
  // 错误过滤和增强
  beforeSend(event, hint) {
    // 添加Electron特定上下文
    event.contexts = event.contexts || {}
    event.contexts.electron = {
      version: process.versions?.electron,
      chrome: process.versions?.chrome,
      node: process.versions?.node
    }
    
    return event
  }
})
```

### Release Health 配置
```json
// .release-health.json - Release Health配置
{
  "version": "1.0",
  "sentry": {
    "organization": "your-org",
    "project": "vitegame",
    "releases": {
      "auto_finalize": true,
      "auto_deploy": true,
      "health_threshold": {
        "crash_free_sessions": 0.98,  // 98%无崩溃会话
        "crash_free_users": 0.99,     // 99%无崩溃用户
        "session_duration_p50": 600,  // 中位数会话时长10分钟
        "session_duration_p95": 3600  // 95%会话时长1小时
      }
    }
  },
  
  "alerts": {
    "crash_rate_spike": {
      "enabled": true,
      "threshold": 0.05,  // 崩溃率超过5%时告警
      "window": "1h"
    },
    "performance_regression": {
      "enabled": true,
      "threshold": 1.5,   // 性能退化超过50%时告警
      "metric": "session_duration"
    }
  },
  
  "deployment_gates": {
    "pre_release": {
      "crash_free_sessions_min": 0.95,
      "performance_regression_max": 0.2
    },
    "production_release": {
      "crash_free_sessions_min": 0.98,
      "crash_free_users_min": 0.99,
      "performance_regression_max": 0.1
    }
  }
}
```

---

## 🏗️ 构建和部署配置

### Electron Builder 完整配置
```json
// electron-builder.json5
{
  "appId": "com.vitegame.app",
  "productName": "ViteGame",
  "copyright": "Copyright © 2025 ${author}",
  "directories": {
    "output": "release/${version}",
    "buildResources": "build-resources"
  },
  
  // 构建文件包含规则
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "node_modules/**/*",
    "package.json",
    "!node_modules/**/test/**/*",
    "!node_modules/**/*.map"
  ],
  
  // 代码签名配置
  "codeSign": {
    "enabled": "${env.CODE_SIGN_ENABLED}",
    "identity": "${env.CODE_SIGN_IDENTITY}",
    "certificateFile": "${env.CODE_SIGN_CERTIFICATE}"
  },
  
  // Windows配置
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64", "ia32"]
      },
      {
        "target": "portable",
        "arch": "x64"
      }
    ],
    "icon": "build-resources/icon.ico",
    "certificateFile": "${env.WIN_CERTIFICATE_FILE}",
    "certificatePassword": "${env.WIN_CERTIFICATE_PASSWORD}",
    "signingHashAlgorithms": ["sha256"],
    "rfc3161TimeStampServer": "http://timestamp.digicert.com"
  },
  
  // NSIS安装程序配置
  "nsis": {
    "oneClick": false,
    "perMachine": true,
    "allowElevation": true,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "build-resources/installer.ico",
    "uninstallerIcon": "build-resources/uninstaller.ico",
    "include": "build-resources/installer.nsh"
  },
  
  // macOS配置
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ],
    "icon": "build-resources/icon.icns",
    "category": "public.app-category.games",
    "hardenedRuntime": true,
    "entitlements": "build-resources/entitlements.mac.plist",
    "entitlementsInherit": "build-resources/entitlements.mac.plist",
    "notarize": {
      "teamId": "${env.APPLE_TEAM_ID}"
    }
  },
  
  // Linux配置
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": "x64"
      },
      {
        "target": "deb",
        "arch": "x64"
      }
    ],
    "icon": "build-resources/icon.png",
    "category": "Game"
  },
  
  // 自动更新配置
  "publish": {
    "provider": "github",
    "owner": "your-username",
    "repo": "vitegame"
  },
  
  // Sentry集成
  "afterSign": "scripts/notarize.js",
  "afterPack": "scripts/sentry-upload.js"
}
```

### 自动更新配置
```typescript
// electron/updater.ts - 自动更新管理
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// 配置日志
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

class UpdateManager {
  private updateCheckInterval: NodeJS.Timeout | null = null
  
  constructor() {
    this.setupAutoUpdater()
  }
  
  private setupAutoUpdater() {
    // 自动更新配置
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    
    // 检查间隔
    const checkInterval = parseInt(process.env.UPDATE_CHECK_INTERVAL || '3600000')
    
    // 事件处理
    autoUpdater.on('checking-for-update', () => {
      log.info('正在检查更新...')
    })
    
    autoUpdater.on('update-available', (info) => {
      log.info('发现新版本:', info.version)
      
      // 发送Sentry事件
      Sentry.addBreadcrumb({
        message: '发现应用更新',
        category: 'update',
        level: 'info',
        data: { version: info.version }
      })
    })
    
    autoUpdater.on('update-not-available', (info) => {
      log.info('当前版本是最新版本:', info.version)
    })
    
    autoUpdater.on('error', (err) => {
      log.error('自动更新错误:', err)
      
      // 发送错误到Sentry
      Sentry.captureException(err, {
        tags: { component: 'auto-updater' }
      })
    })
    
    autoUpdater.on('download-progress', (progressObj) => {
      let logMessage = `下载速度: ${progressObj.bytesPerSecond}`
      logMessage = `${logMessage} - 已下载 ${progressObj.percent}%`
      logMessage = `${logMessage} (${progressObj.transferred}/${progressObj.total})`
      log.info(logMessage)
    })
    
    autoUpdater.on('update-downloaded', (info) => {
      log.info('更新下载完成:', info.version)
      
      // 通知用户重启应用
      this.notifyUserToRestart()
    })
  }
  
  startPeriodicCheck() {
    if (process.env.AUTO_UPDATE_ENABLED === 'true') {
      this.checkForUpdates()
      
      const interval = parseInt(process.env.UPDATE_CHECK_INTERVAL || '3600000')
      this.updateCheckInterval = setInterval(() => {
        this.checkForUpdates()
      }, interval)
    }
  }
  
  stopPeriodicCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }
  
  async checkForUpdates() {
    try {
      await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      log.error('检查更新失败:', error)
    }
  }
  
  private notifyUserToRestart() {
    // 实现用户通知逻辑
    // 可以通过IPC发送消息到渲染进程显示通知
  }
}

export const updateManager = new UpdateManager()
```

---

## 📋 质量门禁和验证脚本

### 完整质量门禁脚本
```javascript
// scripts/quality_gates.mjs - 完整质量门禁检查
#!/usr/bin/env node

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

class QualityGates {
  constructor() {
    this.results = []
    this.config = this.loadConfig()
  }
  
  loadConfig() {
    const configPath = '.quality-gates.json'
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'))
    }
    
    // 默认配置
    return {
      coverage: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90
      },
      performance: {
        maxStartupTime: 10000,
        maxResponseTime: 200,
        maxMemoryUsage: 100 // MB
      },
      releaseHealth: {
        minCrashFreeSessions: 0.98,
        minCrashFreeUsers: 0.99
      }
    }
  }
  
  async runAll() {
    console.log('🚀 开始完整质量门禁检查...\n')
    
    try {
      await this.checkTypeScript()
      await this.checkLinting() 
      await this.checkUnitTests()
      await this.checkE2ETests()
      await this.checkSecurity()
      await this.checkPerformance()
      await this.checkReleaseHealth()
      
      this.generateReport()
      
    } catch (error) {
      console.error('💥 质量门禁检查失败:', error.message)
      process.exit(1)
    }
  }
  
  async checkTypeScript() {
    console.log('📝 TypeScript 类型检查...')
    try {
      execSync('npx tsc --noEmit', { stdio: 'inherit' })
      this.results.push({ check: 'TypeScript', status: 'PASS' })
    } catch (error) {
      this.results.push({ check: 'TypeScript', status: 'FAIL', error: error.message })
      throw error
    }
  }
  
  async checkLinting() {
    console.log('🔍 ESLint 代码规范检查...')
    try {
      execSync('npx eslint . --ext .ts,.tsx --max-warnings 0', { stdio: 'inherit' })
      this.results.push({ check: 'Linting', status: 'PASS' })
    } catch (error) {
      this.results.push({ check: 'Linting', status: 'FAIL', error: error.message })
      throw error
    }
  }
  
  async checkUnitTests() {
    console.log('🧪 单元测试和覆盖率检查...')
    try {
      const output = execSync('npx vitest run --coverage --reporter=json', { 
        encoding: 'utf-8' 
      })
      
      // 解析覆盖率报告
      const coverageReport = this.parseCoverageReport()
      const meetsThreshold = this.validateCoverage(coverageReport)
      
      if (meetsThreshold) {
        this.results.push({ check: 'Unit Tests', status: 'PASS', data: coverageReport })
      } else {
        throw new Error('覆盖率未达到要求阈值')
      }
    } catch (error) {
      this.results.push({ check: 'Unit Tests', status: 'FAIL', error: error.message })
      throw error
    }
  }
  
  async checkE2ETests() {
    console.log('🎭 E2E 测试检查...')
    try {
      execSync('npx playwright test --reporter=json', { stdio: 'inherit' })
      this.results.push({ check: 'E2E Tests', status: 'PASS' })
    } catch (error) {
      this.results.push({ check: 'E2E Tests', status: 'FAIL', error: error.message })
      throw error
    }
  }
  
  async checkSecurity() {
    console.log('🔒 安全基线检查...')
    try {
      execSync('node scripts/scan_electron_safety.mjs', { stdio: 'inherit' })
      this.results.push({ check: 'Security', status: 'PASS' })
    } catch (error) {
      this.results.push({ check: 'Security', status: 'FAIL', error: error.message })
      throw error
    }
  }
  
  async checkPerformance() {
    console.log('⚡ 性能基线检查...')
    try {
      // 运行性能测试
      execSync('npx playwright test --project=performance-baseline --reporter=json', { 
        stdio: 'pipe' 
      })
      this.results.push({ check: 'Performance', status: 'PASS' })
    } catch (error) {
      this.results.push({ check: 'Performance', status: 'FAIL', error: error.message })
      throw error
    }
  }
  
  async checkReleaseHealth() {
    console.log('💊 Release Health 检查...')
    try {
      const healthConfig = this.loadReleaseHealthConfig()
      if (healthConfig && this.validateReleaseHealth(healthConfig)) {
        this.results.push({ check: 'Release Health', status: 'PASS' })
      } else {
        throw new Error('Release Health 配置不满足要求')
      }
    } catch (error) {
      this.results.push({ check: 'Release Health', status: 'FAIL', error: error.message })
    }
  }
  
  parseCoverageReport() {
    const coveragePath = 'coverage/coverage-summary.json'
    if (existsSync(coveragePath)) {
      const coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'))
      return coverage.total
    }
    return null
  }
  
  validateCoverage(coverage) {
    if (!coverage) return false
    
    const checks = [
      coverage.lines.pct >= this.config.coverage.lines,
      coverage.branches.pct >= this.config.coverage.branches,
      coverage.functions.pct >= this.config.coverage.functions,
      coverage.statements.pct >= this.config.coverage.statements
    ]
    
    return checks.every(check => check)
  }
  
  loadReleaseHealthConfig() {
    const configPath = '.release-health.json'
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'))
    }
    return null
  }
  
  validateReleaseHealth(config) {
    // 验证Release Health配置是否符合要求
    const gates = config.deployment_gates?.production_release
    if (!gates) return false
    
    return (
      gates.crash_free_sessions_min >= this.config.releaseHealth.minCrashFreeSessions &&
      gates.crash_free_users_min >= this.config.releaseHealth.minCrashFreeUsers
    )
  }
  
  generateReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length
    const total = this.results.length
    
    console.log('\n📊 质量门禁检查报告:')
    console.log('═'.repeat(50))
    
    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌'
      console.log(`${icon} ${result.check}: ${result.status}`)
      if (result.error) {
        console.log(`   错误: ${result.error}`)
      }
    })
    
    console.log('═'.repeat(50))
    console.log(`总计: ${passed}/${total} 检查通过`)
    
    if (passed === total) {
      console.log('\n🎉 所有质量门禁检查都已通过！应用已准备好发布。')
    } else {
      console.log('\n❌ 存在质量问题，请修复后重试。')
      process.exit(1)
    }
  }
}

// 执行质量门禁检查
const qualityGates = new QualityGates()
qualityGates.runAll().catch(console.error)
```

---

## 🔧 开发环境配置验证

### 开发环境检查脚本
```javascript
// scripts/check_dev_environment.mjs
#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync } from 'fs'

class DevEnvironmentChecker {
  constructor() {
    this.checks = []
  }
  
  async runAllChecks() {
    console.log('🔍 开发环境检查开始...\n')
    
    this.checkNodeVersion()
    this.checkNpmVersion()
    this.checkGitConfig()
    this.checkRequiredFiles()
    this.checkEnvironmentVariables()
    this.checkDependencies()
    this.checkMCPServers()
    this.checkBMADSystem()
    
    this.generateReport()
  }
  
  checkNodeVersion() {
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim()
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
      
      if (majorVersion >= 18) {
        this.addCheck('Node.js Version', 'PASS', `${nodeVersion} (>=18 required)`)
      } else {
        this.addCheck('Node.js Version', 'FAIL', `${nodeVersion} (升级到18+)`)
      }
    } catch (error) {
      this.addCheck('Node.js Version', 'FAIL', 'Node.js 未安装')
    }
  }
  
  checkNpmVersion() {
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim()
      this.addCheck('npm Version', 'PASS', npmVersion)
    } catch (error) {
      this.addCheck('npm Version', 'FAIL', 'npm 未安装')
    }
  }
  
  checkGitConfig() {
    try {
      const userName = execSync('git config user.name', { encoding: 'utf-8' }).trim()
      const userEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim()
      
      if (userName && userEmail) {
        this.addCheck('Git Config', 'PASS', `${userName} <${userEmail}>`)
      } else {
        this.addCheck('Git Config', 'FAIL', '用户名或邮箱未配置')
      }
    } catch (error) {
      this.addCheck('Git Config', 'FAIL', 'Git 未配置')
    }
  }
  
  checkRequiredFiles() {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'playwright.config.ts',
      '.mcp.json',
      'CLAUDE.md'
    ]
    
    const missingFiles = requiredFiles.filter(file => !existsSync(file))
    
    if (missingFiles.length === 0) {
      this.addCheck('Required Files', 'PASS', '所有必需文件存在')
    } else {
      this.addCheck('Required Files', 'FAIL', `缺失文件: ${missingFiles.join(', ')}`)
    }
  }
  
  checkEnvironmentVariables() {
    const requiredVars = [
      'ANTHROPIC_API_KEY',
      'SENTRY_DSN'
    ]
    
    const optionalVars = [
      'PERPLEXITY_API_KEY',
      'CONTEXT7_API_KEY',
      'BRAVE_API_KEY'
    ]
    
    const missingRequired = requiredVars.filter(varName => !process.env[varName])
    const availableOptional = optionalVars.filter(varName => process.env[varName])
    
    if (missingRequired.length === 0) {
      this.addCheck('Environment Variables', 'PASS', 
        `必需变量已设置，可选变量: ${availableOptional.length}/${optionalVars.length}`)
    } else {
      this.addCheck('Environment Variables', 'FAIL', 
        `缺失必需变量: ${missingRequired.join(', ')}`)
    }
  }
  
  checkDependencies() {
    try {
      execSync('npm list --depth=0', { stdio: 'pipe' })
      this.addCheck('Dependencies', 'PASS', '所有依赖已安装')
    } catch (error) {
      this.addCheck('Dependencies', 'FAIL', '存在缺失或版本冲突的依赖')
    }
  }
  
  checkMCPServers() {
    try {
      const mcpConfig = require('../.mcp.json')
      const serverCount = Object.keys(mcpConfig.mcpServers || {}).length
      this.addCheck('MCP Servers', 'PASS', `${serverCount} 个服务器已配置`)
    } catch (error) {
      this.addCheck('MCP Servers', 'FAIL', 'MCP配置文件读取失败')
    }
  }
  
  checkBMADSystem() {
    try {
      const bmadVersion = execSync('bmad --version', { encoding: 'utf-8' }).trim()
      this.addCheck('BMAD System', 'PASS', `版本 ${bmadVersion}`)
    } catch (error) {
      this.addCheck('BMAD System', 'WARN', 'BMAD 未安装或未在PATH中')
    }
  }
  
  addCheck(name, status, detail) {
    this.checks.push({ name, status, detail })
  }
  
  generateReport() {
    const passed = this.checks.filter(c => c.status === 'PASS').length
    const warnings = this.checks.filter(c => c.status === 'WARN').length
    const failed = this.checks.filter(c => c.status === 'FAIL').length
    
    console.log('\n📋 开发环境检查报告:')
    console.log('═'.repeat(60))
    
    this.checks.forEach(check => {
      const icon = {
        'PASS': '✅',
        'WARN': '⚠️',
        'FAIL': '❌'
      }[check.status]
      
      console.log(`${icon} ${check.name}: ${check.detail}`)
    })
    
    console.log('═'.repeat(60))
    console.log(`通过: ${passed} | 警告: ${warnings} | 失败: ${failed}`)
    
    if (failed === 0) {
      console.log('\n🎉 开发环境检查通过！可以开始开发了。')
    } else {
      console.log('\n❌ 开发环境存在问题，请修复后重试。')
      process.exit(1)
    }
  }
}

const checker = new DevEnvironmentChecker()
checker.runAllChecks().catch(console.error)
```

---

## 📈 监控和度量配置

### 性能基线配置
```json
// .performance-baseline.json
{
  "version": "1.0",
  "baselines": {
    "startup": {
      "maxTime": 10000,        // 最大启动时间 10秒
      "warningTime": 5000,     // 警告阈值 5秒
      "measure": "time_to_first_window"
    },
    
    "response": {
      "maxTime": 200,          // 最大响应时间 200ms
      "warningTime": 100,      // 警告阈值 100ms
      "percentile": 95         // P95 响应时间
    },
    
    "memory": {
      "maxUsage": 100,         // 最大内存使用 100MB
      "warningUsage": 80,      // 警告阈值 80MB
      "measure": "js_heap_used"
    },
    
    "bundle": {
      "maxSize": 50,           // 最大包大小 50MB
      "warningSize": 40,       // 警告阈值 40MB
      "measure": "total_bundle_size"
    }
  },
  
  "monitoring": {
    "enabled": true,
    "interval": 60000,         // 监控间隔 1分钟
    "retention": 86400000,     // 数据保留 24小时
    "alerts": {
      "performance_regression": true,
      "memory_leak": true,
      "crash_spike": true
    }
  }
}
```

---

## ✅ 配置验证清单

### 环境配置验证
- ✅ **环境变量**: 所有必需的API密钥和配置变量已设置
- ✅ **Sentry配置**: 主进程和渲染进程监控正确配置
- ✅ **Release Health**: 会话跟踪和崩溃监控启用
- ✅ **构建配置**: Electron Builder 配置适合目标平台
- ✅ **自动更新**: 更新机制配置并测试正常
- ✅ **质量门禁**: 所有检查项目配置并能正常运行
- ✅ **开发环境**: 开发工具链配置完整且可用

### 验证命令汇总
```bash
# 环境检查
npm run check:environment       # 开发环境完整性检查
npm run check:mcp              # MCP服务器连接检查
npm run check:bmad             # BMAD系统状态检查

# 质量门禁
npm run guard:ci               # 完整CI检查流程
npm run guard:security         # 安全基线检查
npm run guard:performance      # 性能基线检查

# 构建验证
npm run build                  # 完整构建流程
npm run build:verify           # 构建产物验证
npm run package                # 打包应用

# 监控验证
npm run sentry:test            # Sentry集成测试
npm run health:check           # Release Health检查
```

---

**文档版本**: v1.0  
**更新日期**: 2025年8月27日  
**配置管理版本**: Production Ready  
**依赖关系**: 依赖于所有前四层配置完整性