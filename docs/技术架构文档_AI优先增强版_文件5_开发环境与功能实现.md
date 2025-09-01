# 技术架构文档*AI优先增强版*文件5\_开发环境与功能实现

## 第7章：开发环境与构建（融合维护策略+部署运维）

> **核心理念**: 构建高效的开发环境和自动化运维体系，确保从开发到生产的完整工程化流程，支持AI代码生成的最佳实践

### 7.1 开发环境配置

#### 7.1.1 核心开发工具链

```json5
// package.json - 完整的依赖管理
{
  name: 'guild-manager',
  version: '1.0.0',
  description: '《公会经理》- AI驱动的公会管理游戏',
  type: 'module',
  main: 'dist/main.js',
  scripts: {
    // 开发环境
    dev: 'concurrently "npm run dev:vite" "npm run dev:electron"',
    'dev:vite': 'vite --host 0.0.0.0 --port 3000',
    'dev:electron': 'wait-on http://localhost:3000 && cross-env NODE_ENV=development electron .',

    // 构建脚本
    build: 'npm run build:renderer && npm run build:main',
    'build:renderer': 'vite build',
    'build:main': 'tsc -p tsconfig.main.json && copyfiles -u 1 "src/main/**/*.!(ts)" dist/',
    'build:prod': 'npm run clean && npm run build && electron-builder',

    // 测试脚本
    test: 'vitest',
    'test:ui': 'vitest --ui',
    'test:coverage': 'vitest --coverage',
    'test:e2e': 'playwright test',
    'test:e2e:ui': 'playwright test --ui',

    // 质量检查
    lint: 'eslint src --ext .ts,.tsx --fix',
    'type-check': 'tsc --noEmit',
    format: 'prettier --write "src/**/*.{ts,tsx,json,md}"',

    // 数据库管理
    'db:migrate': 'node scripts/migrate.js',
    'db:seed': 'node scripts/seed.js',
    'db:backup': 'node scripts/backup.js',

    // 部署脚本
    'deploy:staging': 'npm run build:prod && node scripts/deploy-staging.js',
    'deploy:production': 'npm run build:prod && node scripts/deploy-production.js',

    // 维护脚本
    clean: 'rimraf dist build coverage',
    postinstall: 'electron-builder install-app-deps',
    'audit:security': 'npm audit --audit-level moderate',
    'update:deps': 'npm-check-updates -u',
  },

  // 生产依赖
  dependencies: {
    electron: '^32.0.0',
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    phaser: '^3.80.0',
    'better-sqlite3': '^11.0.0',
    i18next: '^23.15.0',
    'react-i18next': '^15.0.0',
    zustand: '^5.0.0',
    '@tanstack/react-query': '^5.59.0',
    tailwindcss: '^4.0.0',
    'framer-motion': '^11.11.0',
  },

  // 开发依赖
  devDependencies: {
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
    '@types/better-sqlite3': '^7.6.11',
    vite: '^6.0.0',
    '@vitejs/plugin-react': '^4.3.0',
    'electron-builder': '^25.0.0',
    typescript: '^5.6.0',
    vitest: '^2.1.0',
    '@vitest/ui': '^2.1.0',
    '@vitest/coverage-v8': '^2.1.0',
    playwright: '^1.48.0',
    eslint: '^9.12.0',
    '@typescript-eslint/eslint-plugin': '^8.8.0',
    prettier: '^3.3.0',
    concurrently: '^9.0.0',
    'wait-on': '^8.0.0',
    'cross-env': '^7.0.3',
    copyfiles: '^2.4.1',
    rimraf: '^6.0.0',
  },

  // Electron Builder配置
  build: {
    appId: 'com.guildmanager.app',
    productName: 'Guild Manager',
    directories: {
      output: 'release',
    },
    files: ['dist/**/*', 'node_modules/**/*', 'package.json'],
    mac: {
      category: 'public.app-category.games',
    },
    win: {
      target: 'nsis',
    },
    linux: {
      target: 'AppImage',
    },
  },
}
```

#### 7.1.2 TypeScript配置完整方案

```json5
// tsconfig.json - 主配置
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // 严格检查选项
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,

    // 路径别名
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/core/*": ["src/core/*"],
      "@/modules/*": ["src/modules/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/assets/*": ["src/assets/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "release"
  ]
}

// tsconfig.main.json - Electron主进程配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": [
    "src/main/**/*.ts"
  ]
}

// tsconfig.renderer.json - 渲染进程配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx"
  },
  "include": [
    "src/renderer/**/*.ts",
    "src/renderer/**/*.tsx"
  ]
}
```

#### 7.1.3 Vite构建配置

```typescript
// vite.config.ts - 完整构建配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // React 19 支持
      jsxImportSource: undefined,
      jsxRuntime: 'automatic',
    }),
  ],

  // 路径解析
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/modules': path.resolve(__dirname, './src/modules'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },

  // 开发服务器配置
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: true,
    cors: true,
  },

  // 构建配置
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    target: 'es2022',

    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库分块
          'vendor-react': ['react', 'react-dom'],
          'vendor-phaser': ['phaser'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-ui': ['framer-motion', '@tanstack/react-query'],

          // 业务模块分块
          'core-systems': [
            './src/core/events',
            './src/core/state',
            './src/core/ai',
          ],
          'game-modules': [
            './src/modules/guild',
            './src/modules/combat',
            './src/modules/economy',
          ],
        },
      },
    },

    // 性能优化
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
  },

  // 环境变量
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },

  // CSS预处理
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // 优化配置
  optimizeDeps: {
    include: ['react', 'react-dom', 'phaser', 'i18next', 'react-i18next'],
  },
});
```

### 7.2 自动化构建与CI/CD

#### 7.2.1 GitHub Actions工作流

```yaml
# .github/workflows/ci.yml - 持续集成
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  ELECTRON_CACHE: ${{ github.workspace }}/.cache/electron
  ELECTRON_BUILDER_CACHE: ${{ github.workspace }}/.cache/electron-builder

jobs:
  # 代码质量检查
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type checking
        run: npm run type-check

      - name: Linting
        run: npm run lint

      - name: Security audit
        run: npm run audit:security

  # 单元测试
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info

  # E2E测试
  e2e-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.os }}
          path: playwright-report/

  # 构建与发布
  build-and-release:
    needs: [quality-check, unit-tests, e2e-tests]
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build:prod
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLEID: ${{ secrets.APPLEID }}
          APPLEIDPASS: ${{ secrets.APPLEIDPASS }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: release/

  # 部署到预发布环境
  deploy-staging:
    needs: build-and-release
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # 部署逻辑

  # 部署到生产环境
  deploy-production:
    needs: build-and-release
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # 部署逻辑
```

#### 7.2.2 构建脚本自动化

```typescript
// scripts/build-automation.ts - 构建自动化脚本
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { build } from 'electron-builder';

interface BuildOptions {
  platform: 'win' | 'mac' | 'linux' | 'all';
  env: 'development' | 'staging' | 'production';
  skipTests?: boolean;
  publish?: boolean;
}

class BuildAutomation {
  private readonly rootDir: string;
  private readonly distDir: string;
  private readonly releaseDir: string;

  constructor() {
    this.rootDir = process.cwd();
    this.distDir = path.join(this.rootDir, 'dist');
    this.releaseDir = path.join(this.rootDir, 'release');
  }

  // 完整构建流程
  async performBuild(options: BuildOptions): Promise<void> {
    console.log('🚀 Starting build automation...');

    try {
      // 1. 清理环境
      await this.cleanEnvironment();

      // 2. 环境检查
      await this.checkEnvironment();

      // 3. 依赖安装
      await this.installDependencies();

      // 4. 代码质量检查
      if (!options.skipTests) {
        await this.runQualityChecks();
      }

      // 5. 构建应用
      await this.buildApplication(options);

      // 6. 运行测试
      if (!options.skipTests) {
        await this.runTests();
      }

      // 7. 打包应用
      await this.packageApplication(options);

      // 8. 发布应用
      if (options.publish) {
        await this.publishApplication(options);
      }

      console.log('✅ Build automation completed successfully!');
    } catch (error) {
      console.error('❌ Build automation failed:', error);
      process.exit(1);
    }
  }

  // 清理构建环境
  private async cleanEnvironment(): Promise<void> {
    console.log('🧹 Cleaning build environment...');

    const dirsToClean = [
      this.distDir,
      this.releaseDir,
      path.join(this.rootDir, 'coverage'),
      path.join(this.rootDir, 'playwright-report'),
    ];

    for (const dir of dirsToClean) {
      if (await fs.pathExists(dir)) {
        await fs.remove(dir);
      }
    }
  }

  // 环境检查
  private async checkEnvironment(): Promise<void> {
    console.log('🔍 Checking build environment...');

    // 检查Node.js版本
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v20')) {
      throw new Error(`Node.js 20.x required, got ${nodeVersion}`);
    }

    // 检查必要文件
    const requiredFiles = ['package.json', 'tsconfig.json', 'vite.config.ts'];

    for (const file of requiredFiles) {
      if (!(await fs.pathExists(path.join(this.rootDir, file)))) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
  }

  // 安装依赖
  private async installDependencies(): Promise<void> {
    console.log('📦 Installing dependencies...');

    this.execCommand('npm ci');
    this.execCommand('npm run postinstall');
  }

  // 代码质量检查
  private async runQualityChecks(): Promise<void> {
    console.log('🔎 Running quality checks...');

    // TypeScript类型检查
    this.execCommand('npm run type-check');

    // ESLint检查
    this.execCommand('npm run lint');

    // 安全审计
    this.execCommand('npm run audit:security');
  }

  // 构建应用
  private async buildApplication(options: BuildOptions): Promise<void> {
    console.log('🏗️ Building application...');

    // 设置环境变量
    process.env.NODE_ENV = options.env;
    process.env.BUILD_ENV = options.env;

    // 构建渲染进程
    this.execCommand('npm run build:renderer');

    // 构建主进程
    this.execCommand('npm run build:main');

    // 数据库迁移
    if (options.env !== 'development') {
      this.execCommand('npm run db:migrate');
    }
  }

  // 运行测试
  private async runTests(): Promise<void> {
    console.log('🧪 Running tests...');

    // 单元测试
    this.execCommand('npm run test:coverage');

    // E2E测试
    this.execCommand('npm run test:e2e');
  }

  // 打包应用
  private async packageApplication(options: BuildOptions): Promise<void> {
    console.log('📦 Packaging application...');

    const targets = this.getElectronTargets(options.platform);

    await build({
      targets,
      config: {
        directories: {
          output: this.releaseDir,
        },
        publish: options.publish ? 'always' : 'never',
      },
    });
  }

  // 获取Electron构建目标
  private getElectronTargets(platform: BuildOptions['platform']) {
    const { Platform } = require('electron-builder');

    switch (platform) {
      case 'win':
        return Platform.WINDOWS.createTarget();
      case 'mac':
        return Platform.MAC.createTarget();
      case 'linux':
        return Platform.LINUX.createTarget();
      case 'all':
        return Platform.current().createTarget();
      default:
        return Platform.current().createTarget();
    }
  }

  // 发布应用
  private async publishApplication(options: BuildOptions): Promise<void> {
    console.log('🚀 Publishing application...');

    if (options.env === 'production') {
      // 发布到生产环境
      await this.publishToProduction();
    } else if (options.env === 'staging') {
      // 发布到预发布环境
      await this.publishToStaging();
    }
  }

  // 执行命令
  private execCommand(command: string): void {
    console.log(`▶️ Executing: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: this.rootDir });
  }

  // 发布到生产环境
  private async publishToProduction(): Promise<void> {
    console.log('🌐 Publishing to production...');
    // 实现生产环境发布逻辑
  }

  // 发布到预发布环境
  private async publishToStaging(): Promise<void> {
    console.log('🧪 Publishing to staging...');
    // 实现预发布环境发布逻辑
  }
}

// CLI接口
if (require.main === module) {
  const buildAutomation = new BuildAutomation();

  const options: BuildOptions = {
    platform: (process.argv[2] as BuildOptions['platform']) || 'current',
    env: (process.argv[3] as BuildOptions['env']) || 'development',
    skipTests: process.argv.includes('--skip-tests'),
    publish: process.argv.includes('--publish'),
  };

  buildAutomation.performBuild(options);
}
```

### 7.3 维护策略与监控

#### 7.3.1 系统健康监控

```typescript
// src/core/monitoring/HealthMonitor.ts
class SystemHealthMonitor {
  private healthChecks: Map<string, HealthCheck>;
  private monitoringInterval: NodeJS.Timer;
  private alertThresholds: AlertThresholds;
  private metricsCollector: MetricsCollector;

  constructor(config: HealthMonitorConfig) {
    this.healthChecks = new Map();
    this.alertThresholds = config.alertThresholds;
    this.metricsCollector = new MetricsCollector();

    this.initializeHealthChecks();
  }

  // 初始化健康检查项
  private initializeHealthChecks(): void {
    // 数据库连接检查
    this.addHealthCheck('database', new DatabaseHealthCheck());

    // 内存使用检查
    this.addHealthCheck('memory', new MemoryHealthCheck());

    // CPU使用检查
    this.addHealthCheck('cpu', new CPUHealthCheck());

    // 磁盘空间检查
    this.addHealthCheck('disk', new DiskHealthCheck());

    // AI引擎健康检查
    this.addHealthCheck('ai-engine', new AIEngineHealthCheck());

    // 事件系统健康检查
    this.addHealthCheck('event-system', new EventSystemHealthCheck());
  }

  // 开始监控
  startMonitoring(): void {
    console.log('🏥 Starting system health monitoring...');

    // 每30秒执行一次健康检查
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    // 立即执行一次检查
    this.performHealthChecks();
  }

  // 执行健康检查
  private async performHealthChecks(): Promise<void> {
    const results: HealthCheckResult[] = [];

    // 并行执行所有健康检查
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, check]) => {
        try {
          const result = await check.execute();
          results.push({ name, ...result });
        } catch (error) {
          results.push({
            name,
            status: 'critical',
            message: `Health check failed: ${error.message}`,
            timestamp: Date.now(),
          });
        }
      }
    );

    await Promise.all(checkPromises);

    // 处理检查结果
    await this.processHealthResults(results);
  }

  // 处理健康检查结果
  private async processHealthResults(
    results: HealthCheckResult[]
  ): Promise<void> {
    const systemHealth: SystemHealthStatus = {
      overall: 'healthy',
      checks: results,
      timestamp: Date.now(),
    };

    // 确定整体健康状态
    const criticalIssues = results.filter(r => r.status === 'critical');
    const warningIssues = results.filter(r => r.status === 'warning');

    if (criticalIssues.length > 0) {
      systemHealth.overall = 'critical';
    } else if (warningIssues.length > 0) {
      systemHealth.overall = 'warning';
    }

    // 收集指标
    this.metricsCollector.recordHealthMetrics(systemHealth);

    // 发送告警
    if (systemHealth.overall !== 'healthy') {
      await this.sendHealthAlert(systemHealth);
    }

    // 记录健康日志
    this.logHealthStatus(systemHealth);
  }

  // 发送健康告警
  private async sendHealthAlert(health: SystemHealthStatus): Promise<void> {
    const alert: HealthAlert = {
      severity: health.overall,
      message: this.generateAlertMessage(health),
      timestamp: Date.now(),
      checks: health.checks.filter(c => c.status !== 'healthy'),
    };

    // 发送到日志系统
    console.warn('⚠️ System Health Alert:', alert);

    // 发送到监控系统
    await this.metricsCollector.sendAlert(alert);
  }

  // 生成告警消息
  private generateAlertMessage(health: SystemHealthStatus): string {
    const issues = health.checks.filter(c => c.status !== 'healthy');
    const critical = issues.filter(c => c.status === 'critical');
    const warnings = issues.filter(c => c.status === 'warning');

    let message = `System health: ${health.overall}. `;

    if (critical.length > 0) {
      message += `Critical issues: ${critical.map(c => c.name).join(', ')}. `;
    }

    if (warnings.length > 0) {
      message += `Warnings: ${warnings.map(c => c.name).join(', ')}.`;
    }

    return message;
  }
}

// 数据库健康检查
class DatabaseHealthCheck implements HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    try {
      // 检查数据库连接
      const db = await this.getDatabaseConnection();

      // 执行简单查询
      const result = db.prepare('SELECT 1 as test').get();

      if (!result || result.test !== 1) {
        return {
          status: 'critical',
          message: 'Database query failed',
          timestamp: Date.now(),
        };
      }

      // 检查数据库大小
      const dbSize = await this.getDatabaseSize();
      if (dbSize > 1024 * 1024 * 1024) {
        // 1GB
        return {
          status: 'warning',
          message: `Database size is large: ${(dbSize / 1024 / 1024).toFixed(2)}MB`,
          timestamp: Date.now(),
        };
      }

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Database connection failed: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }
}

// AI引擎健康检查
class AIEngineHealthCheck implements HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    try {
      // 检查Worker池状态
      const workerPool = this.getAIWorkerPool();
      const activeWorkers = workerPool.getActiveWorkerCount();
      const totalWorkers = workerPool.getTotalWorkerCount();

      if (activeWorkers === 0) {
        return {
          status: 'critical',
          message: 'No active AI workers',
          timestamp: Date.now(),
        };
      }

      // 检查平均响应时间
      const avgResponseTime = workerPool.getAverageResponseTime();
      if (avgResponseTime > 5000) {
        // 5秒
        return {
          status: 'warning',
          message: `AI response time is slow: ${avgResponseTime}ms`,
          timestamp: Date.now(),
        };
      }

      // 检查决策缓存命中率
      const cacheHitRate = workerPool.getCacheHitRate();
      if (cacheHitRate < 0.7) {
        // 70%
        return {
          status: 'warning',
          message: `Low AI cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
          timestamp: Date.now(),
        };
      }

      return {
        status: 'healthy',
        message: `AI engine healthy: ${activeWorkers}/${totalWorkers} workers active`,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `AI engine check failed: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }
}
```

### 7.4 团队协作与知识管理 (Team Collaboration & Knowledge Management)

#### 7.4.1 新人入职指南 (Onboarding Guide)

**完整入职流程**

```typescript
// src/docs/onboarding/OnboardingWorkflow.ts
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  estimatedTime: number; // 分钟
  prerequisites: string[];
  deliverables: string[];
  resources: Resource[];
  mentor?: string;
}

export interface Resource {
  type: 'documentation' | 'video' | 'code' | 'tool' | 'meeting';
  title: string;
  url: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

// 新人入职工作流定义
export const ONBOARDING_WORKFLOW: OnboardingStep[] = [
  {
    id: 'environment-setup',
    title: '开发环境搭建',
    description: '安装和配置完整的开发环境，包括必要的工具和依赖',
    estimatedTime: 120, // 2小时
    prerequisites: [],
    deliverables: [
      '能够成功启动开发服务器',
      '能够运行完整的测试套件',
      '能够构建生产版本',
      '开发工具配置完成（IDE、Git、Node.js等）'
    ],
    resources: [
      {
        type: 'documentation',
        title: '环境搭建指南',
        url: '/docs/setup/environment-setup.md',
        description: '详细的开发环境配置步骤',
        priority: 'high'
      },
      {
        type: 'video',
        title: '环境搭建演示视频',
        url: '/docs/videos/environment-setup-demo.mp4',
        description: '15分钟的环境搭建演示',
        priority: 'medium'
      },
      {
        type: 'tool',
        title: '环境检查脚本',
        url: '/scripts/check-environment.js',
        description: '自动检查环境配置是否正确',
        priority: 'high'
      }
    ]
  },
  {
    id: 'codebase-overview',
    title: '代码库架构概览',
    description: '理解项目的整体架构、目录结构和核心概念',
    estimatedTime: 180, // 3小时
    prerequisites: ['environment-setup'],
    deliverables: [
      '完成架构理解测试（80%以上正确率）',
      '能够解释主要模块的职责',
      '理解数据流和事件流',
      '完成代码导读练习'
    ],
    resources: [
      {
        type: 'documentation',
        title: '技术架构文档',
        url: '/docs/architecture/',
        description: 'AI优先增强版技术架构文档',
        priority: 'high'
      },
      {
        type: 'documentation',
        title: '代码导读指南',
        url: '/docs/onboarding/code-walkthrough.md',
        description: '关键代码文件和模块的导读',
        priority: 'high'
      },
      {
        type: 'meeting',
        title: '架构讲解会议',
        url: 'calendar-invite',
        description: '与架构师进行1对1架构讲解（1小时）',
        priority: 'high'
      }
    ],
    mentor: '技术架构师'
  },
  {
    id: 'development-workflow',
    title: '开发流程与规范',
    description: '学习项目的开发流程、代码规范和最佳实践',
    estimatedTime: 90, // 1.5小时
    prerequisites: ['codebase-overview'],
    deliverables: [
      '完成第一个PR并通过代码审查',
      '理解Git工作流程',
      '掌握代码规范和质量标准',
      '配置开发工具（ESLint、Prettier等）'
    ],
    resources: [
      {
        type: 'documentation',
        title: '开发流程指南',
        url: '/docs/development/workflow.md',
        description: 'Git流程、分支策略、PR规范等',
        priority: 'high'
      },
      {
        type: 'documentation',
        title: '代码规范文档',
        url: '/docs/development/coding-standards.md',
        description: 'TypeScript、React、测试等代码规范',
        priority: 'high'
      },
      {
        type: 'code',
        title: '示例PR模板',
        url: '/docs/examples/pr-template.md',
        description: '标准PR描述模板和检查清单',
        priority: 'medium'
      }
    ],
    mentor: '团队Lead'
  },
  {
    id: 'testing-strategy',
    title: '测试策略与实践',
    description: '掌握项目的测试金字塔、测试工具和测试编写规范',
    estimatedTime: 150, // 2.5小时
    prerequisites: ['development-workflow'],
    deliverables: [
      '为现有功能编写单元测试',
      '编写一个集成测试',
      '运行并理解E2E测试',
      '达到90%以上的测试覆盖率'
    ],
    resources: [
      {
        type: 'documentation',
        title: '测试策略文档',
        url: '/docs/testing/strategy.md',
        description: '测试金字塔、工具选择、覆盖率要求',
        priority: 'high'
      },
      {
        type: 'code',
        title: '测试示例代码',
        url: '/src/tests/examples/',
        description: '各类测试的最佳实践示例',
        priority: 'high'
      },
      {
        type: 'video',
        title: 'TDD实践演示',
        url: '/docs/videos/tdd-demo.mp4',
        description: '30分钟TDD开发实践演示',
        priority: 'medium'
      }
    ],
    mentor: '测试工程师'
  },
  {
    id: 'domain-knowledge',
    title: '业务领域知识',
    description: '理解公会管理游戏的业务逻辑、用户需求和产品目标',
    estimatedTime: 120, // 2小时
    prerequisites: ['testing-strategy'],
    deliverables: [
      '完成业务知识测试（85%以上正确率）',
      '理解核心业务流程',
      '熟悉用户角色和使用场景',
      '掌握游戏系统的核心概念'
    ],
    resources: [
      {
        type: 'documentation',
        title: '产品需求文档',
        url: '/docs/product/PRD.md',
        description: '完整的产品需求和功能规格',
        priority: 'high'
      },
      {
        type: 'documentation',
        title: '用户故事集合',
        url: '/docs/product/user-stories.md',
        description: '详细的用户故事和验收标准',
        priority: 'high'
      },
      {
        type: 'meeting',
        title: '产品讲解会议',
        url: 'calendar-invite',
        description: '与产品经理进行业务讲解（1.5小时）',
        priority: 'high'
      }
    ],
    mentor: '产品经理'
  },
  {
    id: 'first-feature',
    title: '第一个功能开发',
    description: '独立完成一个小功能的完整开发，从需求到上线',
    estimatedTime: 480, // 8小时（跨多天）
    prerequisites: ['domain-knowledge'],
    deliverables: [
      '完成功能设计文档',
      '实现功能代码（包含测试）',
      '通过代码审查',
      '功能成功部署到预发布环境',
      '完成功能验收测试'
    ],
    resources: [
      {
        type: 'documentation',
        title: '功能开发流程',
        url: '/docs/development/feature-development.md',
        description: '从需求分析到上线的完整流程',
        priority: 'high'
      },
      {
        type: 'code',
        title: '功能开发模板',
        url: '/templates/feature-template/',
        description: '标准功能开发的代码结构模板',
        priority: 'medium'
      },
      {
        type: 'meeting',
        title: '功能评审会议',
        url: 'calendar-invite',
        description: '功能设计和实现的评审会议',
        priority: 'high'
      }
    ],
    mentor: '资深开发工程师'
  },
  {
    id: 'team-integration',
    title: '团队融入与持续学习',
    description: '融入团队文化，建立持续学习和改进的习惯',
    estimatedTime: 60, // 1小时
    prerequisites: ['first-feature'],
    deliverables: [
      '参加团队会议和技术分享',
      '建立个人学习计划',
      '完成入职反馈和改进建议',
      '成为团队正式成员'
    ],
    resources: [
      {
        type: 'documentation',
        title: '团队文化手册',
        url: '/docs/team/culture.md',
        description: '团队价值观、工作方式和协作规范',
        priority: 'high'
      },
      {
        type: 'meeting',
        title: '入职总结会议',
        url: 'calendar-invite',
        description: '与经理进行入职总结和职业规划讨论',
        priority: 'high'
      }
    ],
    mentor: '团队经理'
  }
];

// 入职进度跟踪
export class OnboardingTracker {
  private progress: Map<string, OnboardingProgress> = new Map();

  interface OnboardingProgress {
    stepId: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    startTime?: number;
    completionTime?: number;
    notes: string[];
    mentorFeedback?: string;
    blockers: string[];
  }

  // 开始入职流程
  startOnboarding(employeeId: string): void {
    ONBOARDING_WORKFLOW.forEach(step => {
      this.progress.set(`${employeeId}-${step.id}`, {
        stepId: step.id,
        status: step.prerequisites.length === 0 ? 'not_started' : 'blocked',
        notes: [],
        blockers: step.prerequisites.filter(prereq =>
          !this.isStepCompleted(employeeId, prereq)
        )
      });
    });
  }

  // 更新步骤状态
  updateStepStatus(
    employeeId: string,
    stepId: string,
    status: OnboardingProgress['status'],
    notes?: string
  ): void {
    const progressId = `${employeeId}-${stepId}`;
    const progress = this.progress.get(progressId);

    if (progress) {
      progress.status = status;

      if (status === 'in_progress' && !progress.startTime) {
        progress.startTime = Date.now();
      }

      if (status === 'completed') {
        progress.completionTime = Date.now();

        // 解锁依赖此步骤的其他步骤
        this.unlockDependentSteps(employeeId, stepId);
      }

      if (notes) {
        progress.notes.push(notes);
      }

      this.progress.set(progressId, progress);
    }
  }

  // 生成入职报告
  generateOnboardingReport(employeeId: string): OnboardingReport {
    const allProgress = Array.from(this.progress.entries())
      .filter(([key]) => key.startsWith(employeeId))
      .map(([, progress]) => progress);

    const completed = allProgress.filter(p => p.status === 'completed').length;
    const inProgress = allProgress.filter(p => p.status === 'in_progress').length;
    const blocked = allProgress.filter(p => p.status === 'blocked').length;
    const notStarted = allProgress.filter(p => p.status === 'not_started').length;

    const totalTime = allProgress
      .filter(p => p.startTime && p.completionTime)
      .reduce((total, p) => total + (p.completionTime! - p.startTime!), 0);

    return {
      employeeId,
      totalSteps: ONBOARDING_WORKFLOW.length,
      completedSteps: completed,
      inProgressSteps: inProgress,
      blockedSteps: blocked,
      notStartedSteps: notStarted,
      completionPercentage: (completed / ONBOARDING_WORKFLOW.length) * 100,
      totalTimeSpent: totalTime,
      estimatedCompletion: this.calculateEstimatedCompletion(employeeId),
      currentBlockers: this.getCurrentBlockers(employeeId)
    };
  }
}
```

**环境搭建自动化**

```bash
#!/bin/bash
# scripts/setup-dev-environment.sh - 开发环境自动化搭建脚本

set -e

echo "🚀 开始搭建《公会经理》开发环境..."

# 检查系统要求
check_system_requirements() {
  echo "📋 检查系统要求..."

  # 检查Node.js版本
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请安装 Node.js 20.x"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 版本过低，需要 20.x，当前版本：$(node -v)"
    exit 1
  fi

  # 检查Git
  if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装，请安装 Git"
    exit 1
  fi

  # 检查系统架构
  ARCH=$(uname -m)
  OS=$(uname -s)
  echo "✅ 系统环境：$OS $ARCH, Node.js $(node -v), Git $(git --version | cut -d' ' -f3)"
}

# 安装项目依赖
install_dependencies() {
  echo "📦 安装项目依赖..."

  # 清理旧的node_modules
  if [ -d "node_modules" ]; then
    echo "🧹 清理旧的依赖..."
    rm -rf node_modules package-lock.json
  fi

  # 安装依赖
  npm ci

  # 安装Playwright浏览器
  npx playwright install

  echo "✅ 依赖安装完成"
}

# 配置开发工具
setup_dev_tools() {
  echo "🔧 配置开发工具..."

  # 配置Git hooks
  if [ -d ".git" ]; then
    echo "⚙️ 配置Git hooks..."
    npx husky install
  fi

  # 配置VSCode设置（如果存在）
  if command -v code &> /dev/null; then
    echo "📝 配置VSCode设置..."
    mkdir -p .vscode

    # 推荐的扩展列表
    cat > .vscode/extensions.json << EOF
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-playwright.playwright",
    "ms-vscode.test-adapter-converter",
    "gruntfuggly.todo-tree"
  ]
}
EOF

    # 工作区设置
    cat > .vscode/settings.json << EOF
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": [
    "javascript",
    "typescript",
    "typescriptreact"
  ],
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|\\`)([^']*)(?:'|\"|\\`)"]
  ]
}
EOF

    echo "✅ VSCode配置完成"
  fi
}

# 初始化数据库
setup_database() {
  echo "🗄️ 初始化数据库..."

  # 创建数据库目录
  mkdir -p data/database

  # 运行数据库迁移
  npm run db:migrate

  # 插入种子数据
  if [ "$1" = "--with-seed-data" ]; then
    echo "🌱 插入种子数据..."
    npm run db:seed
  fi

  echo "✅ 数据库初始化完成"
}

# 运行测试验证
run_verification_tests() {
  echo "🧪 运行验证测试..."

  # 类型检查
  echo "🔍 TypeScript类型检查..."
  npm run type-check

  # 代码规范检查
  echo "📏 代码规范检查..."
  npm run lint

  # 单元测试
  echo "🎯 运行单元测试..."
  npm run test -- --run

  # 构建测试
  echo "🏗️ 构建测试..."
  npm run build

  echo "✅ 所有验证测试通过"
}

# 创建开发用户配置
create_dev_config() {
  echo "⚙️ 创建开发配置..."

  # 创建环境变量文件
  if [ ! -f ".env.local" ]; then
    cat > .env.local << EOF
# 开发环境配置
NODE_ENV=development
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_DEBUG=true
VITE_LOG_LEVEL=debug

# 数据库配置
DB_PATH=./data/database/guild-manager-dev.db

# 开发工具
VITE_DEVTOOLS=true
VITE_REACT_STRICT_MODE=true
EOF
    echo "📝 创建了 .env.local 配置文件"
  fi
}

# 主函数
main() {
  echo "《公会经理》开发环境自动化搭建脚本 v1.0"
  echo "=================================================="

  check_system_requirements
  install_dependencies
  setup_dev_tools
  create_dev_config
  setup_database $1
  run_verification_tests

  echo ""
  echo "🎉 开发环境搭建完成！"
  echo ""
  echo "💡 接下来你可以："
  echo "   npm run dev          # 启动开发服务器"
  echo "   npm run test         # 运行测试"
  echo "   npm run build        # 构建生产版本"
  echo ""
  echo "📚 更多信息请查看："
  echo "   README.md           # 项目说明"
  echo "   docs/               # 技术文档"
  echo "   docs/onboarding/    # 入职指南"
  echo ""
  echo "🆘 如果遇到问题，请联系团队成员或查看故障排除文档"
}

# 运行主函数
main $1
```

#### 7.4.2 知识传递机制 (Knowledge Transfer)

**知识库管理系统**

```typescript
// src/core/knowledge/KnowledgeManager.ts
export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type:
    | 'document'
    | 'video'
    | 'code-example'
    | 'best-practice'
    | 'troubleshooting';
  category: string[];
  tags: string[];
  author: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime: number; // 分钟
  relatedItems: string[]; // 相关知识项ID
  feedback: KnowledgeFeedback[];
}

export interface KnowledgeFeedback {
  id: string;
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  helpful: boolean;
  timestamp: number;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  parent?: string;
  children: string[];
  itemCount: number;
}

// 知识管理系统
export class KnowledgeManager {
  private knowledgeBase: Map<string, KnowledgeItem> = new Map();
  private categories: Map<string, KnowledgeCategory> = new Map();
  private searchIndex: Map<string, string[]> = new Map(); // 关键词 -> 知识项ID列表

  constructor() {
    this.initializeCategories();
    this.initializeKnowledgeBase();
  }

  // 初始化知识分类
  private initializeCategories(): void {
    const categories: KnowledgeCategory[] = [
      {
        id: 'architecture',
        name: '技术架构',
        description: '系统架构设计、模式和最佳实践',
        icon: '🏗️',
        children: ['system-design', 'data-flow', 'security'],
        itemCount: 0,
      },
      {
        id: 'development',
        name: '开发实践',
        description: '编码规范、开发流程和工具使用',
        icon: '💻',
        children: ['coding-standards', 'testing', 'debugging'],
        itemCount: 0,
      },
      {
        id: 'deployment',
        name: '部署运维',
        description: '构建、部署、监控和运维相关知识',
        icon: '🚀',
        children: ['build-process', 'monitoring', 'troubleshooting'],
        itemCount: 0,
      },
      {
        id: 'business',
        name: '业务知识',
        description: '产品需求、用户故事和业务逻辑',
        icon: '📊',
        children: ['product-features', 'user-scenarios', 'business-rules'],
        itemCount: 0,
      },
      {
        id: 'team-process',
        name: '团队流程',
        description: '协作流程、会议制度和沟通规范',
        icon: '👥',
        children: ['collaboration', 'meetings', 'communication'],
        itemCount: 0,
      },
    ];

    categories.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  // 初始化知识库
  private initializeKnowledgeBase(): void {
    const knowledgeItems: KnowledgeItem[] = [
      {
        id: 'electron-security-guide',
        title: 'Electron安全配置完全指南',
        content: this.loadKnowledgeContent('electron-security-guide'),
        type: 'document',
        category: ['architecture', 'security'],
        tags: ['electron', 'security', 'configuration', 'best-practices'],
        author: '安全架构师',
        createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7天前
        updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1天前
        version: '1.2.0',
        status: 'published',
        difficulty: 'intermediate',
        estimatedReadTime: 15,
        relatedItems: ['security-checklist', 'electron-best-practices'],
        feedback: [],
      },
      {
        id: 'react-19-migration',
        title: 'React 19升级迁移指南',
        content: this.loadKnowledgeContent('react-19-migration'),
        type: 'document',
        category: ['development', 'frontend'],
        tags: ['react', 'migration', 'upgrade', 'breaking-changes'],
        author: '前端架构师',
        createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14天前
        updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2天前
        version: '2.1.0',
        status: 'published',
        difficulty: 'advanced',
        estimatedReadTime: 25,
        relatedItems: ['react-hooks-guide', 'frontend-testing'],
        feedback: [
          {
            id: 'feedback-1',
            userId: 'developer-1',
            rating: 5,
            comment: '非常详细的迁移指南，帮助很大！',
            helpful: true,
            timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
          },
        ],
      },
      {
        id: 'ai-debugging-techniques',
        title: 'AI引擎调试技巧和工具',
        content: this.loadKnowledgeContent('ai-debugging-techniques'),
        type: 'troubleshooting',
        category: ['development', 'ai'],
        tags: ['ai', 'debugging', 'web-worker', 'performance'],
        author: 'AI工程师',
        createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5天前
        updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        version: '1.0.0',
        status: 'published',
        difficulty: 'intermediate',
        estimatedReadTime: 12,
        relatedItems: ['performance-profiling', 'worker-communication'],
        feedback: [],
      },
      {
        id: 'code-review-checklist',
        title: '代码审查检查清单',
        content: this.loadKnowledgeContent('code-review-checklist'),
        type: 'best-practice',
        category: ['development', 'quality'],
        tags: ['code-review', 'quality', 'checklist', 'best-practices'],
        author: '技术主管',
        createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000, // 21天前
        updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3天前
        version: '1.3.0',
        status: 'published',
        difficulty: 'beginner',
        estimatedReadTime: 8,
        relatedItems: ['coding-standards', 'testing-guidelines'],
        feedback: [],
      },
    ];

    knowledgeItems.forEach(item => {
      this.knowledgeBase.set(item.id, item);
      this.updateSearchIndex(item);
    });
  }

  // 搜索知识项
  searchKnowledge(
    query: string,
    options?: {
      category?: string;
      type?: KnowledgeItem['type'];
      difficulty?: KnowledgeItem['difficulty'];
      tags?: string[];
    }
  ): KnowledgeItem[] {
    const searchTerms = query.toLowerCase().split(' ');
    const matchingIds = new Set<string>();

    // 基于关键词搜索
    searchTerms.forEach(term => {
      const ids = this.searchIndex.get(term) || [];
      ids.forEach(id => matchingIds.add(id));
    });

    let results = Array.from(matchingIds)
      .map(id => this.knowledgeBase.get(id)!)
      .filter(item => item.status === 'published');

    // 应用过滤条件
    if (options?.category) {
      results = results.filter(item =>
        item.category.includes(options.category!)
      );
    }

    if (options?.type) {
      results = results.filter(item => item.type === options.type);
    }

    if (options?.difficulty) {
      results = results.filter(item => item.difficulty === options.difficulty);
    }

    if (options?.tags && options.tags.length > 0) {
      results = results.filter(item =>
        options.tags!.some(tag => item.tags.includes(tag))
      );
    }

    // 按相关性和更新时间排序
    return results.sort((a, b) => {
      // 计算相关性得分
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // 相关性相同时，按更新时间排序
      return b.updatedAt - a.updatedAt;
    });
  }

  // 获取推荐知识项
  getRecommendations(userId: string, currentItemId?: string): KnowledgeItem[] {
    // 基于用户行为和当前浏览内容推荐
    const userHistory = this.getUserReadingHistory(userId);
    const currentItem = currentItemId
      ? this.knowledgeBase.get(currentItemId)
      : null;

    let candidates = Array.from(this.knowledgeBase.values()).filter(
      item => item.status === 'published'
    );

    // 如果有当前项，优先推荐相关项
    if (currentItem) {
      const relatedItems = currentItem.relatedItems
        .map(id => this.knowledgeBase.get(id))
        .filter(Boolean) as KnowledgeItem[];

      const similarCategoryItems = candidates.filter(
        item =>
          item.id !== currentItem.id &&
          item.category.some(cat => currentItem.category.includes(cat))
      );

      const similarTagItems = candidates.filter(
        item =>
          item.id !== currentItem.id &&
          item.tags.some(tag => currentItem.tags.includes(tag))
      );

      candidates = [
        ...relatedItems,
        ...similarCategoryItems.slice(0, 3),
        ...similarTagItems.slice(0, 2),
      ];
    }

    // 基于用户历史推荐
    const userInterests = this.analyzeUserInterests(userHistory);
    candidates = candidates.concat(
      this.getItemsByInterests(userInterests).slice(0, 3)
    );

    // 去重并排序
    const uniqueItems = Array.from(
      new Map(candidates.map(item => [item.id, item])).values()
    );

    return uniqueItems
      .sort(
        (a, b) =>
          this.calculateRecommendationScore(b, userId) -
          this.calculateRecommendationScore(a, userId)
      )
      .slice(0, 5);
  }

  // 添加知识项
  addKnowledgeItem(
    item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>
  ): string {
    const id = `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const knowledgeItem: KnowledgeItem = {
      ...item,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      feedback: [],
    };

    this.knowledgeBase.set(id, knowledgeItem);
    this.updateSearchIndex(knowledgeItem);
    this.updateCategoryItemCount(item.category);

    return id;
  }

  // 更新知识项
  updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): boolean {
    const item = this.knowledgeBase.get(id);
    if (!item) return false;

    const updatedItem = { ...item, ...updates, updatedAt: Date.now() };
    this.knowledgeBase.set(id, updatedItem);
    this.updateSearchIndex(updatedItem);

    return true;
  }

  // 添加反馈
  addFeedback(
    itemId: string,
    feedback: Omit<KnowledgeFeedback, 'id' | 'timestamp'>
  ): boolean {
    const item = this.knowledgeBase.get(itemId);
    if (!item) return false;

    const feedbackItem: KnowledgeFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    item.feedback.push(feedbackItem);
    item.updatedAt = Date.now();

    return true;
  }

  // 生成知识库报告
  generateKnowledgeReport(): KnowledgeReport {
    const items = Array.from(this.knowledgeBase.values());
    const categories = Array.from(this.categories.values());

    return {
      totalItems: items.length,
      publishedItems: items.filter(i => i.status === 'published').length,
      draftItems: items.filter(i => i.status === 'draft').length,
      categories: categories.length,
      averageRating: this.calculateAverageRating(items),
      mostPopularCategories: this.getMostPopularCategories(),
      recentlyUpdated: items
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          title: item.title,
          updatedAt: item.updatedAt,
        })),
      topRatedItems: items
        .filter(item => item.feedback.length > 0)
        .sort((a, b) => this.getAverageRating(b) - this.getAverageRating(a))
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          title: item.title,
          rating: this.getAverageRating(item),
          feedbackCount: item.feedback.length,
        })),
    };
  }

  // 私有辅助方法
  private updateSearchIndex(item: KnowledgeItem): void {
    const searchableText = [
      item.title,
      item.content,
      ...item.tags,
      ...item.category,
      item.author,
    ]
      .join(' ')
      .toLowerCase();

    const words = searchableText.split(/\s+/).filter(word => word.length > 2);

    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, []);
      }
      const itemIds = this.searchIndex.get(word)!;
      if (!itemIds.includes(item.id)) {
        itemIds.push(item.id);
      }
    });
  }

  private calculateRelevanceScore(item: KnowledgeItem, query: string): number {
    const queryTerms = query.toLowerCase().split(' ');
    let score = 0;

    queryTerms.forEach(term => {
      if (item.title.toLowerCase().includes(term)) score += 3;
      if (item.tags.some(tag => tag.toLowerCase().includes(term))) score += 2;
      if (item.category.some(cat => cat.toLowerCase().includes(term)))
        score += 2;
      if (item.content.toLowerCase().includes(term)) score += 1;
    });

    return score;
  }

  private getAverageRating(item: KnowledgeItem): number {
    if (item.feedback.length === 0) return 0;
    const totalRating = item.feedback.reduce(
      (sum, feedback) => sum + feedback.rating,
      0
    );
    return totalRating / item.feedback.length;
  }
}
```

#### 7.4.3 技术分享制度 (Technical Sharing)

**技术分享管理系统**

```typescript
// src/core/sharing/TechSharingManager.ts
export interface TechSharingSession {
  id: string;
  title: string;
  description: string;
  presenter: string;
  presenterId: string;
  type: 'lightning-talk' | 'deep-dive' | 'demo' | 'workshop' | 'retrospective';
  category: string[];
  scheduledDate: number;
  duration: number; // 分钟
  location: 'online' | 'office' | 'hybrid';
  meetingLink?: string;
  materials: SharingMaterial[];
  attendees: string[];
  maxAttendees?: number;
  status: 'draft' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  feedback: SessionFeedback[];
  recording?: {
    url: string;
    duration: number;
    transcription?: string;
  };
  followUpTasks: string[];
}

export interface SharingMaterial {
  type: 'slides' | 'code' | 'document' | 'video' | 'demo-link';
  title: string;
  url: string;
  description?: string;
}

export interface SessionFeedback {
  id: string;
  attendeeId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  content?: string;
  usefulness: 1 | 2 | 3 | 4 | 5;
  clarity: 1 | 2 | 3 | 4 | 5;
  pacing: 1 | 2 | 3 | 4 | 5;
  suggestions?: string;
  timestamp: number;
}

export interface SharingTopic {
  id: string;
  title: string;
  description: string;
  suggestedBy: string;
  category: string[];
  priority: 'low' | 'medium' | 'high';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  prerequisites?: string[];
  learningObjectives: string[];
  votes: number;
  voterIds: string[];
  assignedTo?: string;
  status: 'suggested' | 'planned' | 'in-preparation' | 'completed';
  createdAt: number;
}

// 技术分享管理器
export class TechSharingManager {
  private sessions: Map<string, TechSharingSession> = new Map();
  private topics: Map<string, SharingTopic> = new Map();
  private schedule: Map<string, string[]> = new Map(); // 日期 -> session IDs

  // 分享会话模板
  private readonly SESSION_TEMPLATES = {
    'lightning-talk': {
      duration: 15,
      description: '快速分享一个技术点、工具或经验',
      format: '5分钟演示 + 10分钟讨论',
    },
    'deep-dive': {
      duration: 45,
      description: '深入探讨某个技术主题的设计和实现',
      format: '30分钟演示 + 15分钟讨论',
    },
    demo: {
      duration: 30,
      description: '演示新功能、工具或技术的实际使用',
      format: '20分钟演示 + 10分钟讨论',
    },
    workshop: {
      duration: 90,
      description: '动手实践工作坊，边学边做',
      format: '15分钟介绍 + 60分钟实践 + 15分钟总结',
    },
    retrospective: {
      duration: 60,
      description: '项目或技术实施的回顾和经验总结',
      format: '20分钟回顾 + 30分钟讨论 + 10分钟行动计划',
    },
  };

  // 创建分享会话
  createSharingSession(sessionData: {
    title: string;
    description: string;
    presenterId: string;
    type: TechSharingSession['type'];
    category: string[];
    scheduledDate: number;
    location: TechSharingSession['location'];
    maxAttendees?: number;
  }): string {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const template = this.SESSION_TEMPLATES[sessionData.type];

    const session: TechSharingSession = {
      id,
      ...sessionData,
      presenter: this.getUserName(sessionData.presenterId),
      duration: template.duration,
      materials: [],
      attendees: [sessionData.presenterId], // 演讲者自动参加
      status: 'draft',
      feedback: [],
      followUpTasks: [],
    };

    this.sessions.set(id, session);
    this.addToSchedule(sessionData.scheduledDate, id);

    // 发送创建通知
    this.notifySessionCreated(session);

    return id;
  }

  // 建议分享主题
  suggestTopic(topicData: {
    title: string;
    description: string;
    suggestedBy: string;
    category: string[];
    priority?: SharingTopic['priority'];
    complexity?: SharingTopic['complexity'];
    estimatedDuration?: number;
    prerequisites?: string[];
    learningObjectives: string[];
  }): string {
    const id = `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const topic: SharingTopic = {
      id,
      priority: 'medium',
      complexity: 'intermediate',
      estimatedDuration: 30,
      ...topicData,
      votes: 1, // 建议者自动投票
      voterIds: [topicData.suggestedBy],
      status: 'suggested',
      createdAt: Date.now(),
    };

    this.topics.set(id, topic);

    // 发送建议通知
    this.notifyTopicSuggested(topic);

    return id;
  }

  // 为主题投票
  voteForTopic(topicId: string, voterId: string): boolean {
    const topic = this.topics.get(topicId);
    if (!topic || topic.voterIds.includes(voterId)) {
      return false;
    }

    topic.votes += 1;
    topic.voterIds.push(voterId);

    this.topics.set(topicId, topic);
    return true;
  }

  // 认领主题进行准备
  claimTopic(topicId: string, presenterId: string): boolean {
    const topic = this.topics.get(topicId);
    if (!topic || topic.status !== 'suggested') {
      return false;
    }

    topic.assignedTo = presenterId;
    topic.status = 'in-preparation';

    this.topics.set(topicId, topic);

    // 发送认领通知
    this.notifyTopicClaimed(topic, presenterId);

    return true;
  }

  // 参加分享会话
  joinSession(sessionId: string, attendeeId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.status === 'cancelled' ||
      session.status === 'completed'
    ) {
      return false;
    }

    if (session.attendees.includes(attendeeId)) {
      return true; // 已经参加了
    }

    if (
      session.maxAttendees &&
      session.attendees.length >= session.maxAttendees
    ) {
      return false; // 人数已满
    }

    session.attendees.push(attendeeId);
    this.sessions.set(sessionId, session);

    // 发送参加确认
    this.notifyAttendeeJoined(session, attendeeId);

    return true;
  }

  // 添加分享材料
  addSessionMaterial(sessionId: string, material: SharingMaterial): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.materials.push(material);
    this.sessions.set(sessionId, session);

    // 通知参与者材料已添加
    this.notifyMaterialAdded(session, material);

    return true;
  }

  // 开始分享会话
  startSession(sessionId: string, startedBy: string): boolean {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.presenterId !== startedBy ||
      session.status !== 'scheduled'
    ) {
      return false;
    }

    session.status = 'in-progress';
    this.sessions.set(sessionId, session);

    // 发送开始通知
    this.notifySessionStarted(session);

    return true;
  }

  // 完成分享会话
  completeSession(
    sessionId: string,
    completedBy: string,
    recording?: TechSharingSession['recording']
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.presenterId !== completedBy ||
      session.status !== 'in-progress'
    ) {
      return false;
    }

    session.status = 'completed';
    if (recording) {
      session.recording = recording;
    }

    this.sessions.set(sessionId, session);

    // 发送完成通知和反馈邀请
    this.notifySessionCompleted(session);
    this.requestFeedback(session);

    return true;
  }

  // 添加会话反馈
  addSessionFeedback(
    sessionId: string,
    feedback: Omit<SessionFeedback, 'id' | 'timestamp'>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.attendees.includes(feedback.attendeeId)) {
      return false;
    }

    const feedbackItem: SessionFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    session.feedback.push(feedbackItem);
    this.sessions.set(sessionId, session);

    return true;
  }

  // 获取会话日程安排
  getSchedule(startDate: number, endDate: number): ScheduleItem[] {
    const schedule: ScheduleItem[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      const sessionIds = this.schedule.get(dateKey) || [];

      sessionIds.forEach(sessionId => {
        const session = this.sessions.get(sessionId);
        if (session && session.status !== 'cancelled') {
          schedule.push({
            date: dateKey,
            session: {
              id: session.id,
              title: session.title,
              presenter: session.presenter,
              type: session.type,
              duration: session.duration,
              attendeeCount: session.attendees.length,
              maxAttendees: session.maxAttendees,
            },
          });
        }
      });
    }

    return schedule.sort((a, b) => a.date.localeCompare(b.date));
  }

  // 获取热门主题
  getPopularTopics(limit: number = 10): SharingTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.status === 'suggested')
      .sort((a, b) => {
        // 先按票数排序
        if (a.votes !== b.votes) {
          return b.votes - a.votes;
        }
        // 票数相同按优先级排序
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, limit);
  }

  // 生成分享报告
  generateSharingReport(period: { start: number; end: number }): SharingReport {
    const sessions = Array.from(this.sessions.values()).filter(
      session =>
        session.scheduledDate >= period.start &&
        session.scheduledDate <= period.end
    );

    const completedSessions = sessions.filter(s => s.status === 'completed');
    const totalAttendees = sessions.reduce(
      (total, session) => total + session.attendees.length,
      0
    );
    const totalFeedback = completedSessions.reduce(
      (total, session) => total + session.feedback.length,
      0
    );
    const averageRating =
      completedSessions.reduce((sum, session) => {
        const sessionAvg =
          session.feedback.length > 0
            ? session.feedback.reduce((s, f) => s + f.rating, 0) /
              session.feedback.length
            : 0;
        return sum + sessionAvg;
      }, 0) / (completedSessions.length || 1);

    return {
      period,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      cancelledSessions: sessions.filter(s => s.status === 'cancelled').length,
      totalAttendees,
      averageAttendeesPerSession: totalAttendees / (sessions.length || 1),
      totalFeedback,
      averageRating,
      topPresenters: this.getTopPresenters(completedSessions),
      popularCategories: this.getPopularCategories(sessions),
      sessionTypes: this.getSessionTypeDistribution(sessions),
      upcomingSessions: this.getUpcomingSessions(),
      suggestedTopics: Array.from(this.topics.values()).filter(
        t => t.status === 'suggested'
      ).length,
    };
  }

  // 私有辅助方法
  private addToSchedule(date: number, sessionId: string): void {
    const dateKey = new Date(date).toISOString().split('T')[0];
    if (!this.schedule.has(dateKey)) {
      this.schedule.set(dateKey, []);
    }
    this.schedule.get(dateKey)!.push(sessionId);
  }

  private notifySessionCreated(session: TechSharingSession): void {
    // 实现会话创建通知逻辑
    console.log(`📅 新分享会话创建: ${session.title} by ${session.presenter}`);
  }

  private notifyTopicSuggested(topic: SharingTopic): void {
    // 实现主题建议通知逻辑
    console.log(`💡 新主题建议: ${topic.title}`);
  }

  private requestFeedback(session: TechSharingSession): void {
    // 向参与者发送反馈请求
    session.attendees.forEach(attendeeId => {
      console.log(`📝 请为会话 "${session.title}" 提供反馈`);
    });
  }
}

// 分享会话工厂类
export class SharingSessionFactory {
  static createLightningTalk(data: {
    title: string;
    presenterId: string;
    techStack: string[];
    keyTakeaway: string;
  }): Partial<TechSharingSession> {
    return {
      title: data.title,
      description: `⚡ 快速分享: ${data.keyTakeaway}`,
      type: 'lightning-talk',
      category: data.techStack,
      duration: 15,
    };
  }

  static createTechDeepDive(data: {
    title: string;
    presenterId: string;
    technology: string;
    architecture: string[];
    problems: string[];
    solutions: string[];
  }): Partial<TechSharingSession> {
    return {
      title: data.title,
      description:
        `🔍 深入探讨 ${data.technology} 的设计和实现\n\n` +
        `解决的问题:\n${data.problems.map(p => `• ${p}`).join('\n')}\n\n` +
        `技术方案:\n${data.solutions.map(s => `• ${s}`).join('\n')}`,
      type: 'deep-dive',
      category: [data.technology, ...data.architecture],
      duration: 45,
    };
  }

  static createHandsOnWorkshop(data: {
    title: string;
    presenterId: string;
    skills: string[];
    tools: string[];
    prerequisites: string[];
    outcomes: string[];
  }): Partial<TechSharingSession> {
    return {
      title: data.title,
      description:
        `🛠️ 动手工作坊\n\n` +
        `学习目标:\n${data.outcomes.map(o => `• ${o}`).join('\n')}\n\n` +
        `使用工具:\n${data.tools.map(t => `• ${t}`).join('\n')}\n\n` +
        `前置要求:\n${data.prerequisites.map(p => `• ${p}`).join('\n')}`,
      type: 'workshop',
      category: data.skills,
      duration: 90,
    };
  }
}
```

## 第8章：功能纵切（融合国际化支持+前端架构设计）

> **设计原则**: 实现完整的功能纵切，从前端UI到后端数据，确保国际化支持和响应式设计，为AI代码生成提供清晰的功能边界

### 8.1 国际化支持架构

#### 8.1.1 i18next完整配置

```typescript
// src/core/i18n/i18nConfig.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-fs-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = {
  'zh-CN': {
    name: '简体中文',
    flag: '🇨🇳',
    direction: 'ltr',
  },
  'zh-TW': {
    name: '繁體中文',
    flag: '🇹🇼',
    direction: 'ltr',
  },
  en: {
    name: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
  },
  ja: {
    name: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
  },
  ko: {
    name: '한국어',
    flag: '🇰🇷',
    direction: 'ltr',
  },
  es: {
    name: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
  },
  fr: {
    name: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
  },
  de: {
    name: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
  },
  ru: {
    name: 'Русский',
    flag: '🇷🇺',
    direction: 'ltr',
  },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// i18n配置
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // 默认语言
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',

    // 调试模式
    debug: process.env.NODE_ENV === 'development',

    // 命名空间
    defaultNS: 'common',
    ns: [
      'common', // 通用翻译
      'ui', // UI界面
      'game', // 游戏内容
      'guild', // 公会系统
      'combat', // 战斗系统
      'economy', // 经济系统
      'social', // 社交系统
      'settings', // 设置界面
      'errors', // 错误信息
      'validation', // 表单验证
    ],

    // 语言检测配置
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    // 后端配置（文件系统）
    backend: {
      loadPath: './src/assets/locales/{{lng}}/{{ns}}.json',
    },

    // 插值配置
    interpolation: {
      escapeValue: false, // React已经转义
      format: (value, format, lng) => {
        if (format === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        if (format === 'currency') {
          return new Intl.NumberFormat(lng, {
            style: 'currency',
            currency: 'CNY', // 默认货币
          }).format(value);
        }
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng).format(new Date(value));
        }
        if (format === 'time') {
          return new Intl.DateTimeFormat(lng, {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(value));
        }
        return value;
      },
    },

    // React配置
    react: {
      useSuspense: true,
      bindI18n: 'languageChanged',
      bindI18nStore: 'added removed',
    },
  });

export default i18n;
```

#### 8.1.2 语言资源文件结构

```json
// src/assets/locales/zh-CN/common.json
{
  "app": {
    "name": "公会经理",
    "version": "版本 {{version}}",
    "loading": "加载中...",
    "error": "发生错误",
    "success": "操作成功",
    "confirm": "确认",
    "cancel": "取消",
    "save": "保存",
    "delete": "删除",
    "edit": "编辑",
    "create": "创建",
    "search": "搜索",
    "filter": "筛选",
    "sort": "排序",
    "refresh": "刷新"
  },
  "navigation": {
    "dashboard": "仪表板",
    "guild": "公会管理",
    "combat": "战斗中心",
    "economy": "经济系统",
    "social": "社交互动",
    "settings": "系统设置"
  },
  "time": {
    "now": "刚刚",
    "minutesAgo": "{{count}}分钟前",
    "hoursAgo": "{{count}}小时前",
    "daysAgo": "{{count}}天前",
    "weeksAgo": "{{count}}周前",
    "monthsAgo": "{{count}}个月前"
  },
  "units": {
    "gold": "金币",
    "experience": "经验值",
    "level": "等级",
    "member": "成员",
    "member_other": "成员"
  }
}

// src/assets/locales/zh-CN/guild.json
{
  "guild": {
    "name": "公会名称",
    "description": "公会描述",
    "level": "公会等级",
    "experience": "公会经验",
    "memberCount": "成员数量",
    "memberLimit": "成员上限",
    "treasury": "公会金库",
    "created": "创建时间"
  },
  "actions": {
    "createGuild": "创建公会",
    "joinGuild": "加入公会",
    "leaveGuild": "退出公会",
    "disbandGuild": "解散公会",
    "inviteMember": "邀请成员",
    "kickMember": "踢出成员",
    "promoteMember": "提升成员",
    "demoteMember": "降级成员"
  },
  "roles": {
    "leader": "会长",
    "viceLeader": "副会长",
    "officer": "干事",
    "elite": "精英成员",
    "member": "普通成员"
  },
  "messages": {
    "guildCreated": "公会《{{name}}》创建成功！",
    "memberJoined": "{{name}} 加入了公会",
    "memberLeft": "{{name}} 离开了公会",
    "memberPromoted": "{{name}} 被提升为 {{role}}",
    "insufficientPermissions": "权限不足",
    "guildFull": "公会已满员",
    "alreadyInGuild": "您已经在公会中"
  }
}

// src/assets/locales/en/common.json
{
  "app": {
    "name": "Guild Manager",
    "version": "Version {{version}}",
    "loading": "Loading...",
    "error": "An error occurred",
    "success": "Operation successful",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "sort": "Sort",
    "refresh": "Refresh"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "guild": "Guild Management",
    "combat": "Combat Center",
    "economy": "Economic System",
    "social": "Social Interaction",
    "settings": "Settings"
  }
}
```

#### 8.1.3 多语言Hook与组件

```typescript
// src/hooks/useTranslation.ts - 增强的翻译Hook
import { useTranslation as useI18nTranslation, UseTranslationOptions } from 'react-i18next';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '@/core/i18n/i18nConfig';
import { useMemo } from 'react';

export interface ExtendedTranslationOptions extends UseTranslationOptions {
  // 启用格式化功能
  enableFormatting?: boolean;
  // 默认插值参数
  defaultInterpolation?: Record<string, any>;
}

export function useTranslation(
  ns?: string | string[],
  options?: ExtendedTranslationOptions
) {
  const { t, i18n, ready } = useI18nTranslation(ns, options);

  // 增强的翻译函数
  const translate = useMemo(() => {
    return (key: string, params?: any) => {
      const defaultParams = options?.defaultInterpolation || {};
      const mergedParams = { ...defaultParams, ...params };

      // 如果启用格式化，自动添加语言环境
      if (options?.enableFormatting) {
        mergedParams.lng = i18n.language;
      }

      return t(key, mergedParams);
    };
  }, [t, i18n.language, options?.defaultInterpolation, options?.enableFormatting]);

  // 语言切换函数
  const changeLanguage = async (lng: SupportedLanguage) => {
    await i18n.changeLanguage(lng);

    // 保存到本地存储
    localStorage.setItem('i18nextLng', lng);

    // 更新文档语言
    document.documentElement.lang = lng;

    // 更新文档方向（RTL支持）
    document.documentElement.dir = SUPPORTED_LANGUAGES[lng].direction;
  };

  // 获取当前语言信息
  const currentLanguage = useMemo(() => {
    const lng = i18n.language as SupportedLanguage;
    return SUPPORTED_LANGUAGES[lng] || SUPPORTED_LANGUAGES['zh-CN'];
  }, [i18n.language]);

  // 格式化数字
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(i18n.language, options).format(value);
  };

  // 格式化货币
  const formatCurrency = (value: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency
    }).format(value);
  };

  // 格式化日期
  const formatDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(i18n.language, options).format(new Date(date));
  };

  // 格式化相对时间
  const formatRelativeTime = (date: Date | string | number) => {
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    const now = Date.now();
    const target = new Date(date).getTime();
    const diffInSeconds = (target - now) / 1000;

    const intervals = [
      { unit: 'year', seconds: 31536000 },
      { unit: 'month', seconds: 2592000 },
      { unit: 'week', seconds: 604800 },
      { unit: 'day', seconds: 86400 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'minute', seconds: 60 }
    ] as const;

    for (const { unit, seconds } of intervals) {
      const diff = Math.round(diffInSeconds / seconds);
      if (Math.abs(diff) >= 1) {
        return rtf.format(diff, unit);
      }
    }

    return rtf.format(0, 'second');
  };

  return {
    t: translate,
    i18n,
    ready,
    changeLanguage,
    currentLanguage,
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime
  };
}

// 多语言文本组件
export interface TranslationProps {
  i18nKey: string;
  values?: Record<string, any>;
  components?: Record<string, React.ReactElement>;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function Translation({
  i18nKey,
  values,
  components,
  className,
  as: Component = 'span'
}: TranslationProps) {
  const { t } = useTranslation();

  return (
    <Component className={className}>
      {t(i18nKey, { ...values, components })}
    </Component>
  );
}

// 语言切换器组件
export function LanguageSwitcher() {
  const { i18n, changeLanguage, currentLanguage } = useTranslation();

  return (
    <div className="language-switcher">
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value as SupportedLanguage)}
        className="language-select"
      >
        {Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => (
          <option key={code} value={code}>
            {info.flag} {info.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// 多语言数字显示组件
export interface LocalizedNumberProps {
  value: number;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  className?: string;
}

export function LocalizedNumber({
  value,
  style = 'decimal',
  currency = 'CNY',
  minimumFractionDigits,
  maximumFractionDigits,
  className
}: LocalizedNumberProps) {
  const { formatNumber, formatCurrency } = useTranslation();

  const formattedValue = useMemo(() => {
    if (style === 'currency') {
      return formatCurrency(value, currency);
    } else if (style === 'percent') {
      return formatNumber(value, {
        style: 'percent',
        minimumFractionDigits,
        maximumFractionDigits
      });
    } else {
      return formatNumber(value, {
        minimumFractionDigits,
        maximumFractionDigits
      });
    }
  }, [value, style, currency, minimumFractionDigits, maximumFractionDigits, formatNumber, formatCurrency]);

  return <span className={className}>{formattedValue}</span>;
}

// 多语言日期显示组件
export interface LocalizedDateProps {
  date: Date | string | number;
  format?: 'full' | 'long' | 'medium' | 'short' | 'relative';
  className?: string;
}

export function LocalizedDate({ date, format = 'medium', className }: LocalizedDateProps) {
  const { formatDate, formatRelativeTime } = useTranslation();

  const formattedDate = useMemo(() => {
    if (format === 'relative') {
      return formatRelativeTime(date);
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      full: { dateStyle: 'full', timeStyle: 'short' },
      long: { dateStyle: 'long', timeStyle: 'short' },
      medium: { dateStyle: 'medium', timeStyle: 'short' },
      short: { dateStyle: 'short', timeStyle: 'short' }
    }[format] || { dateStyle: 'medium' };

    return formatDate(date, formatOptions);
  }, [date, format, formatDate, formatRelativeTime]);

  return <time className={className}>{formattedDate}</time>;
}
```

### 8.2 React 19前端架构

#### 8.2.1 状态管理架构

```typescript
// src/stores/useGameStore.ts - Zustand状态管理
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 游戏状态接口
interface GameState {
  // 用户信息
  user: {
    id: string;
    username: string;
    level: number;
    experience: number;
    coins: number;
  } | null;

  // 公会信息
  guild: {
    id: string;
    name: string;
    level: number;
    memberCount: number;
    memberLimit: number;
    resources: Record<string, number>;
  } | null;

  // UI状态
  ui: {
    activeTab: string;
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark' | 'system';
    notifications: Notification[];
    modals: Modal[];
  };

  // 游戏设置
  settings: {
    language: string;
    soundEnabled: boolean;
    musicVolume: number;
    effectVolume: number;
    autoSave: boolean;
    notifications: {
      desktop: boolean;
      sound: boolean;
    };
  };

  // 缓存数据
  cache: {
    guilds: Guild[];
    members: GuildMember[];
    battles: Battle[];
    lastUpdated: Record<string, number>;
  };
}

// 状态操作接口
interface GameActions {
  // 用户操作
  setUser: (user: GameState['user']) => void;
  updateUserCoins: (amount: number) => void;
  updateUserExperience: (amount: number) => void;

  // 公会操作
  setGuild: (guild: GameState['guild']) => void;
  updateGuildResources: (resources: Record<string, number>) => void;

  // UI操作
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  setTheme: (theme: GameState['ui']['theme']) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  openModal: (modal: Modal) => void;
  closeModal: (id: string) => void;

  // 设置操作
  updateSettings: (settings: Partial<GameState['settings']>) => void;

  // 缓存操作
  updateCache: <T extends keyof GameState['cache']>(
    key: T,
    data: GameState['cache'][T]
  ) => void;
  invalidateCache: (key?: keyof GameState['cache']) => void;

  // 重置操作
  resetGame: () => void;
}

type GameStore = GameState & GameActions;

// 初始状态
const initialState: GameState = {
  user: null,
  guild: null,
  ui: {
    activeTab: 'dashboard',
    sidebarCollapsed: false,
    theme: 'system',
    notifications: [],
    modals: [],
  },
  settings: {
    language: 'zh-CN',
    soundEnabled: true,
    musicVolume: 0.7,
    effectVolume: 0.8,
    autoSave: true,
    notifications: {
      desktop: true,
      sound: true,
    },
  },
  cache: {
    guilds: [],
    members: [],
    battles: [],
    lastUpdated: {},
  },
};

// 创建store
export const useGameStore = create<GameStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // 用户操作实现
        setUser: user =>
          set(state => {
            state.user = user;
          }),

        updateUserCoins: amount =>
          set(state => {
            if (state.user) {
              state.user.coins = Math.max(0, state.user.coins + amount);
            }
          }),

        updateUserExperience: amount =>
          set(state => {
            if (state.user) {
              state.user.experience += amount;

              // 自动升级逻辑
              const newLevel = Math.floor(state.user.experience / 1000) + 1;
              if (newLevel > state.user.level) {
                state.user.level = newLevel;

                // 发送升级通知
                state.ui.notifications.push({
                  id: `level-up-${Date.now()}`,
                  type: 'success',
                  title: '等级提升',
                  message: `恭喜！您的等级提升到了 ${newLevel}`,
                  timestamp: Date.now(),
                });
              }
            }
          }),

        // 公会操作实现
        setGuild: guild =>
          set(state => {
            state.guild = guild;
          }),

        updateGuildResources: resources =>
          set(state => {
            if (state.guild) {
              Object.assign(state.guild.resources, resources);
            }
          }),

        // UI操作实现
        setActiveTab: tab =>
          set(state => {
            state.ui.activeTab = tab;
          }),

        toggleSidebar: () =>
          set(state => {
            state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
          }),

        setTheme: theme =>
          set(state => {
            state.ui.theme = theme;

            // 应用主题到文档
            const root = document.documentElement;
            if (theme === 'dark') {
              root.classList.add('dark');
            } else if (theme === 'light') {
              root.classList.remove('dark');
            } else {
              // 系统主题
              const isDark = window.matchMedia(
                '(prefers-color-scheme: dark)'
              ).matches;
              root.classList.toggle('dark', isDark);
            }
          }),

        addNotification: notification =>
          set(state => {
            state.ui.notifications.push({
              ...notification,
              id: notification.id || `notification-${Date.now()}`,
              timestamp: notification.timestamp || Date.now(),
            });

            // 限制通知数量
            if (state.ui.notifications.length > 10) {
              state.ui.notifications = state.ui.notifications.slice(-10);
            }
          }),

        removeNotification: id =>
          set(state => {
            const index = state.ui.notifications.findIndex(n => n.id === id);
            if (index !== -1) {
              state.ui.notifications.splice(index, 1);
            }
          }),

        openModal: modal =>
          set(state => {
            state.ui.modals.push({
              ...modal,
              id: modal.id || `modal-${Date.now()}`,
            });
          }),

        closeModal: id =>
          set(state => {
            const index = state.ui.modals.findIndex(m => m.id === id);
            if (index !== -1) {
              state.ui.modals.splice(index, 1);
            }
          }),

        // 设置操作实现
        updateSettings: newSettings =>
          set(state => {
            Object.assign(state.settings, newSettings);
          }),

        // 缓存操作实现
        updateCache: (key, data) =>
          set(state => {
            state.cache[key] = data;
            state.cache.lastUpdated[key] = Date.now();
          }),

        invalidateCache: key =>
          set(state => {
            if (key) {
              delete state.cache.lastUpdated[key];
            } else {
              state.cache.lastUpdated = {};
            }
          }),

        // 重置操作
        resetGame: () =>
          set(() => ({
            ...initialState,
            settings: get().settings, // 保留设置
          })),
      })),
      {
        name: 'game-store',
        partialize: state => ({
          user: state.user,
          guild: state.guild,
          settings: state.settings,
        }),
      }
    ),
    {
      name: 'game-store',
    }
  )
);

// 选择器Hook
export const useUser = () => useGameStore(state => state.user);
export const useGuild = () => useGameStore(state => state.guild);
export const useUI = () => useGameStore(state => state.ui);
export const useSettings = () => useGameStore(state => state.settings);
```

#### 8.2.2 React Query数据获取

```typescript
// src/hooks/useQueries.ts - React Query数据获取
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/useGameStore';
import * as api from '@/api';

// 查询键工厂
export const queryKeys = {
  all: ['game'] as const,
  guilds: () => [...queryKeys.all, 'guilds'] as const,
  guild: (id: string) => [...queryKeys.guilds(), id] as const,
  guildMembers: (guildId: string) =>
    [...queryKeys.guild(guildId), 'members'] as const,
  battles: () => [...queryKeys.all, 'battles'] as const,
  battle: (id: string) => [...queryKeys.battles(), id] as const,
  economy: () => [...queryKeys.all, 'economy'] as const,
  auctions: () => [...queryKeys.economy(), 'auctions'] as const,
  user: () => [...queryKeys.all, 'user'] as const,
  userStats: () => [...queryKeys.user(), 'stats'] as const,
};

// 公会相关查询
export function useGuilds() {
  return useQuery({
    queryKey: queryKeys.guilds(),
    queryFn: api.getGuilds,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

export function useGuild(guildId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guild(guildId!),
    queryFn: () => api.getGuild(guildId!),
    enabled: !!guildId,
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

export function useGuildMembers(guildId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guildMembers(guildId!),
    queryFn: () => api.getGuildMembers(guildId!),
    enabled: !!guildId,
    staleTime: 1 * 60 * 1000, // 1分钟
  });
}

// 公会变更操作
export function useCreateGuild() {
  const queryClient = useQueryClient();
  const { setGuild } = useGameStore();

  return useMutation({
    mutationFn: api.createGuild,
    onSuccess: newGuild => {
      // 更新本地状态
      setGuild(newGuild);

      // 使缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.guilds() });

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '公会创建成功',
        message: `公会《${newGuild.name}》创建成功！`,
      });
    },
    onError: error => {
      useGameStore.getState().addNotification({
        type: 'error',
        title: '公会创建失败',
        message: error.message,
      });
    },
  });
}

export function useJoinGuild() {
  const queryClient = useQueryClient();
  const { setGuild } = useGameStore();

  return useMutation({
    mutationFn: ({ guildId, userId }: { guildId: string; userId: string }) =>
      api.joinGuild(guildId, userId),
    onSuccess: (guild, { guildId }) => {
      // 更新本地状态
      setGuild(guild);

      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: queryKeys.guild(guildId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.guildMembers(guildId),
      });

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '加入公会成功',
        message: `成功加入公会《${guild.name}》`,
      });
    },
    onError: error => {
      useGameStore.getState().addNotification({
        type: 'error',
        title: '加入公会失败',
        message: error.message,
      });
    },
  });
}

// 战斗相关查询
export function useBattles() {
  return useQuery({
    queryKey: queryKeys.battles(),
    queryFn: api.getBattles,
    staleTime: 30 * 1000, // 30秒
    refetchInterval: 60 * 1000, // 1分钟自动刷新
  });
}

export function useBattle(battleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.battle(battleId!),
    queryFn: () => api.getBattle(battleId!),
    enabled: !!battleId,
    staleTime: 10 * 1000, // 10秒
    refetchInterval: data => {
      // 如果战斗还在进行中，每5秒刷新
      return data?.status === 'active' ? 5 * 1000 : false;
    },
  });
}

// 战斗操作
export function useInitiateBattle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.initiateBattle,
    onSuccess: battle => {
      // 使战斗列表缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.battles() });

      // 添加新战斗到缓存
      queryClient.setQueryData(queryKeys.battle(battle.id), battle);

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '战斗开始',
        message: '战斗已成功发起！',
      });
    },
    onError: error => {
      useGameStore.getState().addNotification({
        type: 'error',
        title: '发起战斗失败',
        message: error.message,
      });
    },
  });
}

// 经济系统查询
export function useAuctions() {
  return useQuery({
    queryKey: queryKeys.auctions(),
    queryFn: api.getAuctions,
    staleTime: 30 * 1000, // 30秒
    refetchInterval: 60 * 1000, // 1分钟自动刷新
  });
}

export function usePlaceBid() {
  const queryClient = useQueryClient();
  const { updateUserCoins } = useGameStore();

  return useMutation({
    mutationFn: ({
      auctionId,
      bidAmount,
    }: {
      auctionId: string;
      bidAmount: number;
    }) => api.placeBid(auctionId, bidAmount),
    onSuccess: (result, { bidAmount }) => {
      // 更新用户金币（乐观更新）
      updateUserCoins(-bidAmount);

      // 使拍卖缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.auctions() });

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '竞价成功',
        message: `成功出价 ${bidAmount} 金币`,
      });
    },
    onError: (error, { bidAmount }) => {
      // 回滚乐观更新
      updateUserCoins(bidAmount);

      useGameStore.getState().addNotification({
        type: 'error',
        title: '竞价失败',
        message: error.message,
      });
    },
  });
}

// 用户统计查询
export function useUserStats() {
  const user = useUser();

  return useQuery({
    queryKey: queryKeys.userStats(),
    queryFn: () => api.getUserStats(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

// 预加载Hook
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchGuild = (guildId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.guild(guildId),
      queryFn: () => api.getGuild(guildId),
      staleTime: 2 * 60 * 1000,
    });
  };

  const prefetchBattle = (battleId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.battle(battleId),
      queryFn: () => api.getBattle(battleId),
      staleTime: 10 * 1000,
    });
  };

  return {
    prefetchGuild,
    prefetchBattle,
  };
}
```

这个文件5完成了开发环境与功能实现的详细内容，包含了完整的开发工具链配置、国际化支持架构、React 19状态管理等核心内容。现在让我创建最后一个文件6。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "\u521b\u5efa\u589e\u5f3a\u7248AI\u4f18\u5148\u67b6\u6784\u6587\u6863\uff0c\u6574\u5408\u539f\u724819\u7ae0\u6240\u6709\u5185\u5bb9", "status": "in_progress", "id": "create_enhanced_ai_first_doc"}, {"content": "\u6587\u4ef61\uff1a\u57fa\u7840\u7ea6\u675f\u4e0e\u5b89\u5168\u9632\u62a4\uff08\u7b2c1-2\u7ae0\uff09", "status": "completed", "id": "create_file1_constraints_security"}, {"content": "\u7ea6\u675f\u4e0e\u76ee\u6807\uff08\u878d\u5408\u98ce\u9669\u8bc4\u4f30+\u5f00\u53d1\u89c4\u8303\uff09", "status": "completed", "id": "enhance_chapter1_constraints"}, {"content": "\u5a01\u80c1\u6a21\u578b\u4e0e\u5b89\u5168\u57fa\u7ebf\uff08\u878d\u5408\u5b89\u5168\u8bbe\u8ba1+Electron\u62a4\u680f\uff09", "status": "completed", "id": "enhance_chapter2_security"}, {"content": "\u6587\u4ef62\uff1a\u8d28\u91cf\u6cd5\u89c4\u4e0e\u6d4b\u8bd5\u7b56\u7565\uff08\u7b2c3\u7ae0\uff09", "status": "completed", "id": "create_file2_testing"}, {"content": "\u6d4b\u8bd5\u7b56\u7565\u4e0e\u8d28\u91cf\u95e8\u7981\uff08\u76f4\u63a5\u91c7\u7528\u6df7\u5408\u4f18\u5316\u7248\u6cd5\u89c4\u4e2d\u5fc3\uff09", "status": "completed", "id": "insert_chapter3_testing"}, {"content": "\u6587\u4ef63\uff1a\u7cfb\u7edf\u67b6\u6784\u4e0e\u6570\u636e\u8bbe\u8ba1\uff08\u7b2c4-5\u7ae0\uff09", "status": "completed", "id": "create_file3_system_data"}, {"content": "\u7cfb\u7edf\u4e0a\u4e0b\u6587\u4e0eC4+\u4e8b\u4ef6\u6d41\uff08\u878d\u5408API\u67b6\u6784\u7cfb\u5217\uff09", "status": "completed", "id": "enhance_chapter4_context"}, {"content": "\u6570\u636e\u6a21\u578b\u4e0e\u5b58\u50a8\u7aef\u53e3\uff08\u878d\u5408\u6570\u636e\u5e93\u8bbe\u8ba1+\u4e1a\u52a1\u903b\u8f91\uff09", "status": "completed", "id": "enhance_chapter5_data"}, {"content": "\u6587\u4ef64\uff1a\u6838\u5fc3\u5b9e\u73b0\u4e0eAI\u5f15\u64ce\uff08\u7b2c6\u7ae0\uff09", "status": "completed", "id": "create_file4_runtime_ai"}, {"content": "\u8fd0\u884c\u65f6\u89c6\u56fe\uff08\u878d\u5408\u6e38\u620f\u6838\u5fc3\u7cfb\u7edf+AI\u5f15\u64ce\u8be6\u7ec6\u67b6\u6784\uff09", "status": "completed", "id": "enhance_chapter6_runtime"}, {"content": "\u6587\u4ef65\uff1a\u5f00\u53d1\u73af\u5883\u4e0e\u529f\u80fd\u5b9e\u73b0\uff08\u7b2c7-8\u7ae0\uff09", "status": "completed", "id": "create_file5_dev_features"}, {"content": "\u5f00\u53d1\u73af\u5883\u4e0e\u6784\u5efa\uff08\u878d\u5408\u7ef4\u62a4\u7b56\u7565+\u90e8\u7f72\u8fd0\u7ef4\uff09", "status": "completed", "id": "enhance_chapter7_devenv"}, {"content": "\u529f\u80fd\u7eb5\u5207\uff08\u878d\u5408\u56fd\u9645\u5316\u652f\u6301+\u524d\u7aef\u67b6\u6784\u8bbe\u8ba1\uff09", "status": "completed", "id": "enhance_chapter8_vertical"}, {"content": "\u6587\u4ef66\uff1a\u6027\u80fd\u89c4\u5212\u4e0e\u8fd0\u7ef4\u4fdd\u969c\uff08\u7b2c9\u7ae0\uff09", "status": "in_progress", "id": "create_file6_performance"}, {"content": "\u6027\u80fd\u4e0e\u5bb9\u91cf\u89c4\u5212\uff08\u878d\u5408\u6027\u80fd\u4f18\u5316\u65b9\u6848+\u98ce\u9669\u8bc4\u4f30\u5e94\u5bf9\uff09", "status": "pending", "id": "enhance_chapter9_performance"}]
