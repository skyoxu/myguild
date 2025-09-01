# 07 开发环境与构建（Vite/Electron、CI 质量门禁与测试金字塔）

> 统一开发体验与质量门槛：**lint/typecheck/unit/integration/e2e** 全链路，门禁阈值来自 01 章。

## 7.1 开发环境

### 7.1.1 Node.js 版本策略与 LTS 时间表

#### Node.js Active LTS 支持策略

> **核心原则**: 基于 Node.js LTS 发布周期，确保长期稳定性与 Electron 兼容性

| 版本系列         | LTS 开始时间 | Active LTS 结束 | Maintenance 结束 | 项目建议          |
| ---------------- | ------------ | --------------- | ---------------- | ----------------- |
| **Node.js 20.x** | 2023-10-24   | 2025-10-30      | 2026-04-30       | ✅ **当前主版本** |
| Node.js 22.x     | 2024-10-29   | 2026-10-30      | 2027-04-30       | 🔄 迁移准备中     |
| Node.js 18.x     | 2022-10-25   | 2024-10-29      | 2025-04-30       | ⚠️ 即将退役       |

**版本约束配置:**

```json
// package.json - Node.js 版本强制约束
{
  "engines": {
    "node": ">=20.9.0 <21.0.0",
    "npm": ">=10.1.0"
  },
  "volta": {
    "node": "20.11.1",
    "npm": "10.2.4"
  }
}
```

**开发环境检查脚本:**

```bash
#!/bin/bash
# scripts/check-node-version.sh - Node.js 版本验证
set -e

REQUIRED_NODE_MAJOR=20
CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_MAJOR" ]; then
  echo "❌ Node.js 版本不匹配: 需要 v$REQUIRED_NODE_MAJOR.x，当前 v$(node -v)"
  echo "📋 LTS 推荐: Node.js 20.11.1 (Active LTS 直到 2025-10-30)"
  exit 1
fi

echo "✅ Node.js 版本检查通过: $(node -v)"
```

### 7.1.2 Electron 发布时间线与版本兼容性矩阵

#### Electron 版本选择策略

> **金字塔原则**: 稳定性 > 新特性 > 性能优化

| Electron 版本     | 发布时间 | Chromium | Node.js | 生命周期状态 | 项目决策        |
| ----------------- | -------- | -------- | ------- | ------------ | --------------- |
| **Electron 28.x** | 2024-01  | 120      | 18.18.2 | Stable       | ✅ **生产环境** |
| Electron 29.x     | 2024-03  | 122      | 20.9.0  | Stable       | 🔄 迁移目标     |
| Electron 30.x     | 2024-06  | 124      | 20.14.0 | Latest       | 🚧 评估中       |

#### Node.js ↔ Chromium 兼容性矩阵

```typescript
// configs/compatibility-matrix.ts - 兼容性约束检查
export const CompatibilityMatrix = {
  electron: {
    '28.x': {
      chromium: '120.0.6099.216',
      nodejs: '18.18.2',
      v8: '12.0.267.17',
      status: 'stable',
      security: 'supported',
    },
    '29.x': {
      chromium: '122.0.6261.39',
      nodejs: '20.9.0',
      v8: '12.2.281.27',
      status: 'stable',
      security: 'supported',
    },
  },
  constraints: {
    minElectronVersion: '28.0.0',
    maxElectronVersion: '30.0.0',
    preferredNodeRange: '>=20.9.0 <21.0.0',
  },
} as const;

/* 版本兼容性检查器 */
export function validateEnvironmentCompatibility(): void {
  const electronVersion = process.versions.electron;
  const nodeVersion = process.versions.node;

  if (!electronVersion || !nodeVersion) {
    throw new Error('❌ 无法检测 Electron/Node.js 版本');
  }

  console.log(
    `📋 环境检查: Electron ${electronVersion}, Node.js ${nodeVersion}`
  );

  // 添加具体的兼容性验证逻辑
  const majorElectron = parseInt(electronVersion.split('.')[0]);
  const majorNode = parseInt(nodeVersion.split('.')[0]);

  if (majorElectron < 28 || majorNode < 20) {
    throw new Error('❌ 版本过低，请升级到支持的版本');
  }

  console.log('✅ 环境兼容性检查通过');
}
```

### 7.1.3 TypeScript 严格配置标准

#### tsconfig.json 严格模式配置

> **零容忍策略**: 类型安全 > 开发便利性，确保 AI 代码生成的类型正确性

```json
// tsconfig.json - 最严格的 TypeScript 配置
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    // 🔒 严格类型检查 (Zero-tolerance)
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,

    // 🔍 额外检查 (AI-friendly)
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitThis": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,

    // 📁 路径映射
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/types/*": ["src/types/*"],
      "@/components/*": ["src/components/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "exclude": ["node_modules", "dist", "**/*.js"]
}
```

#### Electron 分离式 TypeScript 配置

```json
// tsconfig.main.json - Electron 主进程配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "noEmit": false,
    "outDir": "./dist/main",
    "types": ["electron", "node"]
  },
  "include": ["src/main/**/*.ts", "electron/**/*.ts"]
}
```

```json
// tsconfig.renderer.json - Electron 渲染进程配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "types": ["vite/client", "@types/react", "@types/react-dom"]
  },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx"]
}
```

### 7.1.4 VS Code 工作区推荐配置

#### workspace 设置 (.vscode/settings.json)

```json
{
  // 🎯 TypeScript 编辑器集成
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.inlayHints.parameterNames.enabled": "all",
  "typescript.inlayHints.parameterTypes.enabled": true,
  "typescript.inlayHints.variableTypes.enabled": true,
  "typescript.inlayHints.functionLikeReturnTypes.enabled": true,

  // 🔧 代码格式化
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },

  // 🎨 Tailwind CSS 智能提示
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"],
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],

  // 📁 文件关联
  "files.associations": {
    "*.css": "tailwindcss"
  },

  // 🚫 排除文件
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/logs": true
  },

  // 🔍 搜索配置
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/logs": true,
    "**/*.log": true
  },

  // 🎮 Electron 调试配置
  "electron.electronPath": "./node_modules/.bin/electron"
}
```

#### 推荐扩展 (.vscode/extensions.json)

```json
{
  "recommendations": [
    // 🔧 核心开发工具
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",

    // 🎨 前端开发
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "ms-vscode.vscode-json",

    // ⚡ 构建工具集成
    "antfu.vite",
    "ms-vscode.vscode-typescript-next",

    // 🎮 Electron 开发
    "kodetech.electron-debug",

    // 🧪 测试工具
    "ms-playwright.playwright",
    "orta.vscode-jest",

    // 📋 文档和协作
    "yzhang.markdown-all-in-one",
    "shd101wyy.markdown-preview-enhanced"
  ]
}
```

#### 调试配置 (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "🎮 Electron Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": [".", "--enable-logging"],
      "outputCapture": "std",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "🌐 Electron Renderer (Chrome)",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src/renderer",
      "timeout": 30000
    },
    {
      "name": "🧪 Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ],
  "compounds": [
    {
      "name": "🚀 Electron Full Stack",
      "configurations": ["🎮 Electron Main", "🌐 Electron Renderer (Chrome)"]
    }
  ]
}
```

### 7.1.5 包管理器约束与依赖策略

#### npm/pnpm 版本锁定

```json
// .npmrc - npm 配置约束
save-exact=true
engine-strict=true
fund=false
audit-level=moderate
```

```yaml
# .github/workflows/node-version-matrix.yml - CI 环境矩阵
name: Node.js Version Matrix Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['20.9.0', '20.11.1', '20.14.0']
        electron-version: ['28.3.3', '29.4.0']
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:compatibility
```

#### 环境一致性检查脚本

```bash
#!/bin/bash
# scripts/env-check.sh - 开发环境一致性验证

echo "🔍 开发环境一致性检查..."

# Node.js 版本
NODE_VERSION=$(node -v)
echo "📦 Node.js: $NODE_VERSION"

# npm 版本
NPM_VERSION=$(npm -v)
echo "📦 npm: $NPM_VERSION"

# Electron 版本
ELECTRON_VERSION=$(npx electron -v 2>/dev/null || echo "未安装")
echo "⚡ Electron: $ELECTRON_VERSION"

# TypeScript 版本
TS_VERSION=$(npx tsc -v)
echo "📘 TypeScript: $TS_VERSION"

# 依赖安全检查
echo "🔒 运行依赖安全审计..."
npm audit --audit-level moderate

echo "✅ 环境检查完成"
```

---

> **📋 检查清单**: 开发环境就绪验证
>
> - [ ] Node.js 20.x LTS 已安装并通过版本检查
> - [ ] Electron 兼容性矩阵验证通过
> - [ ] TypeScript 严格模式配置无错误编译
> - [ ] VS Code 工作区配置和扩展已安装
> - [ ] 包管理器约束配置生效
> - [ ] 环境一致性检查脚本通过

## 7.2 构建

### 7.2.1 Vite 构建配置体系

#### 核心配置策略 (vite.config.ts)

> **设计原则**: 分环境配置 + TypeScript严格模式 + Electron多进程适配

```typescript
// vite.config.ts - 主配置文件
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { ConfigEnv, UserConfig } from 'vite';

export default defineConfig(({ command, mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';

  return {
    // 🎯 插件配置
    plugins: [
      react({
        // React 19 优化配置
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
        },
      }),
    ],

    // 📁 路径解析
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@/components': resolve(__dirname, './src/components'),
        '@/utils': resolve(__dirname, './src/utils'),
        '@/types': resolve(__dirname, './src/types'),
        '@/assets': resolve(__dirname, './src/assets'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },

    // 🔧 开发服务器配置
    server: {
      port: 5173,
      host: true,
      open: !process.env.CI, // CI环境不自动打开浏览器
      cors: true,
      hmr: {
        overlay: isDevelopment, // 开发环境显示错误覆盖层
      },
    },

    // 🏗️ 构建配置
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isProduction ? 'hidden' : true, // 生产环境隐藏sourcemap
      minify: isProduction ? 'terser' : false,

      // 🎯 目标和兼容性
      target: ['chrome120', 'node20'], // 对齐Electron版本

      // 📦 代码分割策略
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          // 分包策略
          manualChunks: id => {
            // React相关库打包到一起
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Phaser游戏引擎单独打包
            if (id.includes('phaser')) {
              return 'phaser';
            }
            // Antd UI库单独打包
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd';
            }
            // 其他node_modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          chunkFileNames: isProduction
            ? 'assets/[name]-[hash:8].js'
            : 'assets/[name].js',
          assetFileNames: isProduction
            ? 'assets/[name]-[hash:8].[ext]'
            : 'assets/[name].[ext]',
        },
        external: [
          // Electron内置模块不打包
          'electron',
          'fs',
          'path',
          'crypto',
        ],
      },

      // 🔍 Terser 压缩配置（生产环境）
      terserOptions: isProduction
        ? {
            compress: {
              drop_console: true, // 移除console.log
              drop_debugger: true, // 移除debugger
              pure_funcs: ['console.log', 'console.info'], // 移除指定函数调用
            },
            mangle: {
              safari10: true, // Safari 10兼容性
            },
          }
        : undefined,

      // 📊 构建报告
      reportCompressedSize: isProduction,
      chunkSizeWarningLimit: 1000, // 1MB 警告阈值
    },

    // 🎨 CSS 配置
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
        generateScopedName: isProduction
          ? '[hash:base64:8]'
          : '[name]__[local]___[hash:base64:5]',
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
    },

    // 🌍 环境变量
    define: {
      __DEV__: JSON.stringify(isDevelopment),
      __PROD__: JSON.stringify(isProduction),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    // ⚡ 性能优化
    optimizeDeps: {
      include: ['react', 'react-dom', 'antd', 'phaser'],
      exclude: [
        'electron', // Electron模块不预构建
      ],
    },

    // 🐛 错误处理
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      drop: isProduction ? ['console', 'debugger'] : [],
    },
  };
});
```

#### 环境特定配置

```typescript
// vite.config.dev.ts - 开发环境专用配置
import { defineConfig } from 'vite';
import baseConfig from './vite.config';
import { mergeConfig } from 'vite';

export default defineConfig(
  mergeConfig(baseConfig, {
    mode: 'development',
    server: {
      // 🔄 热重载优化
      hmr: {
        port: 24678, // 避免端口冲突
      },
      // 🔐 HTTPS 开发模式（可选）
      https: false,
    },
    build: {
      // 开发构建优化
      minify: false,
      sourcemap: true,
      watch: {
        include: 'src/**',
        exclude: 'node_modules/**',
      },
    },
    // 🐛 开发工具
    define: {
      __ENABLE_DEVTOOLS__: true,
    },
  })
);
```

### 7.2.2 Electron 三进程构建策略

#### 主进程 (Main Process) 构建配置

```typescript
// configs/vite.main.config.ts - Electron主进程配置
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  mode: process.env.NODE_ENV || 'development',

  // 📁 入口配置
  build: {
    lib: {
      entry: resolve(__dirname, '../electron/main.ts'),
      name: 'main',
      fileName: () => 'main.js',
      formats: ['cjs'], // CommonJS格式
    },
    outDir: 'dist-electron',
    emptyOutDir: false, // 不清空，保留preload文件

    // 🎯 Node.js目标环境
    target: 'node20',

    rollupOptions: {
      external: [
        'electron',
        'fs',
        'path',
        'crypto',
        '@electron-toolkit/utils',
        '@electron-toolkit/preload',
      ],
      output: {
        format: 'cjs',
        entryFileNames: 'main.js',
      },
    },

    // 🔍 构建配置
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development',
  },

  // 📦 依赖优化（主进程不需要）
  optimizeDeps: {
    disabled: true,
  },
});
```

#### 渲染进程 (Renderer Process) 构建配置

```typescript
// configs/vite.renderer.config.ts - Electron渲染进程配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // 🎯 渲染进程专用配置
  base: './', // 相对路径，适配Electron

  plugins: [react()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // 🔐 安全配置 - 禁用Node.js集成
    target: ['chrome120'], // 匹配Electron Chromium版本

    rollupOptions: {
      external: [
        // 渲染进程不应直接访问Node.js模块
        'fs',
        'path',
        'crypto',
        'electron',
      ],
    },
  },

  // 🔌 插件配置
  define: {
    // 环境标识
    __ELECTRON_RENDERER__: true,
    __NODE_INTEGRATION__: false, // 确保禁用Node.js集成
  },
});
```

#### Preload脚本构建配置

```typescript
// configs/vite.preload.config.ts - Preload脚本配置
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  mode: process.env.NODE_ENV || 'development',

  build: {
    lib: {
      entry: resolve(__dirname, '../electron/preload.ts'),
      name: 'preload',
      fileName: () => 'preload.js',
      formats: ['cjs'],
    },
    outDir: 'dist-electron',
    emptyOutDir: false,

    // 🎯 上下文桥接环境
    target: 'node20',

    rollupOptions: {
      external: [
        'electron', // Electron API外部依赖
      ],
      output: {
        format: 'cjs',
        entryFileNames: 'preload.js',
      },
    },

    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development',
  },

  optimizeDeps: {
    disabled: true,
  },
});
```

### 7.2.3 contextIsolation 安全构建集成

#### 安全配置验证构建步骤

```typescript
// scripts/build/security-validation.ts - 构建时安全验证
import type { BrowserWindow } from 'electron';

export interface SecurityBuildConfig {
  contextIsolation: boolean;
  nodeIntegration: boolean;
  sandbox: boolean;
  webSecurity: boolean;
}

/* 构建时安全配置检查器 */
export function validateSecurityConfig(config: SecurityBuildConfig): void {
  const violations: string[] = [];

  // 🔒 必须启用contextIsolation
  if (!config.contextIsolation) {
    violations.push('❌ contextIsolation必须为true - 防止渲染进程污染');
  }

  // 🚫 必须禁用nodeIntegration
  if (config.nodeIntegration) {
    violations.push('❌ nodeIntegration必须为false - 防止Node.js API暴露');
  }

  // 🏖️ 推荐启用sandbox
  if (!config.sandbox) {
    violations.push('⚠️  推荐启用sandbox - 增强安全隔离');
  }

  // 🌐 必须启用webSecurity
  if (!config.webSecurity) {
    violations.push('❌ webSecurity必须为true - 防止跨域攻击');
  }

  if (violations.length > 0) {
    throw new Error(`🚨 Electron安全配置违规:\n${violations.join('\n')}`);
  }

  console.log('✅ Electron安全配置验证通过');
}

/* BrowserWindow安全配置工厂 */
export function createSecureBrowserWindow(): Electron.BrowserWindowConstructorOptions {
  const secureConfig: Electron.BrowserWindowConstructorOptions = {
    webPreferences: {
      // 🔒 核心安全配置
      contextIsolation: true, // 上下文隔离
      nodeIntegration: false, // 禁用Node.js集成
      sandbox: true, // 沙箱模式
      webSecurity: true, // Web安全

      // 🔧 额外安全措施
      allowRunningInsecureContent: false, // 禁止混合内容
      experimentalFeatures: false, // 禁用实验性功能
      enableWebSQL: false, // 禁用WebSQL
      v8CacheOptions: 'none', // 禁用V8缓存

      // 📍 Preload脚本路径
      preload: require('path').join(__dirname, '../dist-electron/preload.js'),
    },
  };

  // 构建时验证安全配置
  validateSecurityConfig(secureConfig.webPreferences as SecurityBuildConfig);

  return secureConfig;
}
```

#### contextIsolation API桥接构建

```typescript
// electron/preload.ts - 安全的API桥接
import { contextBridge, ipcRenderer } from 'electron';

/* 类型安全的API接口定义 */
interface ElectronAPI {
  // 🔐 安全的IPC通信
  invoke: (channel: string, ...args: any[]) => Promise<any>;

  // 📨 事件监听（只读）
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;

  // 📋 系统信息（安全访问）
  getVersion: () => string;
  getPlatform: () => string;
}

/* 白名单IPC通道 */
const ALLOWED_CHANNELS = {
  invoke: [
    'app:getVersion',
    'app:getPlatform',
    'game:saveData',
    'game:loadData',
  ],
  on: ['game:dataUpdated', 'app:menuAction'],
} as const;

/* 安全的API实现 */
const electronAPI: ElectronAPI = {
  invoke: (channel: string, ...args: any[]) => {
    if (!ALLOWED_CHANNELS.invoke.includes(channel as any)) {
      throw new Error(`🚨 未授权的IPC调用: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    if (!ALLOWED_CHANNELS.on.includes(channel as any)) {
      throw new Error(`🚨 未授权的IPC监听: ${channel}`);
    }
    ipcRenderer.on(channel, callback);
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  getVersion: () => process.env.npm_package_version || '0.0.0',
  getPlatform: () => process.platform,
};

/* 上下文隔离API暴露 */
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
    console.log('✅ Electron API已安全暴露到渲染进程');
  } catch (error) {
    console.error('❌ contextBridge暴露失败:', error);
  }
} else {
  // 不应该执行到这里（contextIsolation应该始终为true）
  throw new Error('🚨 contextIsolation未启用，存在安全风险');
}

/* 类型声明扩展 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 7.2.4 构建脚本与自动化流程

#### package.json 构建脚本配置

```json
{
  "scripts": {
    // 🔧 基础构建命令
    "build": "npm run build:renderer && npm run build:main && npm run build:preload",
    "build:renderer": "vite build --config configs/vite.renderer.config.ts",
    "build:main": "vite build --config configs/vite.main.config.ts",
    "build:preload": "vite build --config configs/vite.preload.config.ts",

    // 🏗️ Electron完整构建
    "build:electron": "npm run build && electron-builder",
    "build:electron:dev": "npm run build && electron-builder --config.compression=store --config.nsis.oneClick=false",

    // 🔍 构建验证
    "build:validate": "npm run build && node scripts/build/validate-build.js",
    "build:security": "npm run build && node scripts/build/security-validation.js",

    // 🚀 平台特定构建
    "build:win": "npm run build && electron-builder --win",
    "build:mac": "npm run build && electron-builder --mac",
    "build:linux": "npm run build && electron-builder --linux",

    // 📦 分发构建
    "dist": "npm run build:validate && npm run build:electron",
    "dist:all": "npm run dist -- --win --mac --linux",

    // 🧹 清理构建产物
    "clean": "rimraf dist dist-electron release",
    "clean:build": "npm run clean && npm run build"
  }
}
```

#### electron-builder 配置优化

```json5
// electron-builder.json5 - 完整构建配置
{
  $schema: 'https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json',

  // 📋 应用基本信息
  appId: 'com.guild.manager',
  productName: '公会经理',
  copyright: 'Copyright © 2024',
  asar: true, // 启用ASAR打包

  // 📁 目录配置
  directories: {
    output: 'release/${version}',
    buildResources: 'build',
  },

  // 📦 打包文件
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'node_modules/**/*',
    'package.json',
  ],

  // 🚫 排除文件
  extraFiles: [
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],

  // 🪟 Windows配置
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'build/icon.ico',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    requestedExecutionLevel: 'asInvoker',
  },

  // 🔧 NSIS安装器配置
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    installerIcon: 'build/installer.ico',
    uninstallerIcon: 'build/uninstaller.ico',
    installerHeaderIcon: 'build/header.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: '公会经理',
  },

  // 🍎 macOS配置
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'build/icon.icns',
    category: 'public.app-category.games',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: false,
  },

  // 🐧 Linux配置
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      {
        target: 'deb',
        arch: ['x64'],
      },
    ],
    icon: 'build/icon.png',
    category: 'Game',
    synopsis: '现代化公会管理系统',
    description: '基于Electron和React的现代化公会管理工具',
  },

  // 🔄 自动更新配置
  publish: {
    provider: 'github',
    owner: 'your-org',
    repo: 'guild-manager',
  },

  // 🔐 代码签名（生产环境）
  forceCodeSigning: false,

  // ⚡ 构建优化
  compression: 'maximum',
  removePackageScripts: true,
  nodeGypRebuild: false,

  // 🐛 调试选项
  buildDependenciesFromSource: false,
  npmRebuild: false,
}
```

### 7.2.5 构建验证与质量检查

#### 构建完整性验证脚本

```javascript
// scripts/build/validate-build.js - 构建验证
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/* 构建产物检查清单 */
const BUILD_CHECKLIST = {
  renderer: {
    required: ['dist/index.html', 'dist/assets'],
    optional: ['dist/assets/index-*.js', 'dist/assets/index-*.css'],
  },
  main: {
    required: ['dist-electron/main.js'],
    optional: ['dist-electron/main.js.map'],
  },
  preload: {
    required: ['dist-electron/preload.js'],
    optional: ['dist-electron/preload.js.map'],
  },
};

/* 验证文件存在性 */
function validateFiles(category, files) {
  console.log(`\n🔍 验证 ${category} 构建产物...`);

  files.required.forEach(file => {
    if (!fs.existsSync(file)) {
      throw new Error(`❌ 必需文件缺失: ${file}`);
    }
    console.log(`✅ ${file}`);
  });

  files.optional.forEach(file => {
    if (file.includes('*')) {
      // 通配符检查
      const dir = path.dirname(file);
      const pattern = path.basename(file).replace('*', '');

      if (fs.existsSync(dir)) {
        const matches = fs.readdirSync(dir).filter(f => f.includes(pattern));
        if (matches.length > 0) {
          console.log(`✅ ${file} (匹配: ${matches.join(', ')})`);
        } else {
          console.log(`⚠️  ${file} (未找到匹配文件)`);
        }
      }
    } else if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`⚠️  ${file} (可选文件未找到)`);
    }
  });
}

/* 验证构建质量 */
function validateBuildQuality() {
  console.log('\n📊 构建质量检查...');

  // 检查bundle大小
  const indexHtml = path.join('dist', 'index.html');
  if (fs.existsSync(indexHtml)) {
    const htmlContent = fs.readFileSync(indexHtml, 'utf8');
    const jsFiles = htmlContent.match(/assets\/index-\w+\.js/g) || [];

    jsFiles.forEach(jsFile => {
      const fullPath = path.join('dist', jsFile);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        if (stats.size > 2 * 1024 * 1024) {
          // 2MB
          console.log(`⚠️  ${jsFile}: ${sizeMB}MB (偏大)`);
        } else {
          console.log(`✅ ${jsFile}: ${sizeMB}MB`);
        }
      }
    });
  }

  // 检查TypeScript编译
  try {
    execSync('npx tsc --noEmit --project tsconfig.json', { stdio: 'pipe' });
    console.log('✅ TypeScript类型检查通过');
  } catch (error) {
    console.error('❌ TypeScript类型检查失败');
    throw error;
  }

  // 检查Electron安全配置
  const mainJs = path.join('dist-electron', 'main.js');
  if (fs.existsSync(mainJs)) {
    const mainContent = fs.readFileSync(mainJs, 'utf8');

    if (
      mainContent.includes('contextIsolation:true') ||
      mainContent.includes('contextIsolation: true')
    ) {
      console.log('✅ contextIsolation已启用');
    } else {
      throw new Error('❌ contextIsolation配置缺失');
    }

    if (
      mainContent.includes('nodeIntegration:false') ||
      mainContent.includes('nodeIntegration: false')
    ) {
      console.log('✅ nodeIntegration已禁用');
    } else {
      throw new Error('❌ nodeIntegration应该禁用');
    }
  }
}

/* 执行验证 */
function runValidation() {
  console.log('🚀 开始构建验证...');

  try {
    // 验证所有构建产物
    Object.entries(BUILD_CHECKLIST).forEach(([category, files]) => {
      validateFiles(category, files);
    });

    // 验证构建质量
    validateBuildQuality();

    console.log('\n🎉 构建验证通过！');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 构建验证失败:', error.message);
    process.exit(1);
  }
}

// 执行验证
runValidation();
```

---

> **📋 构建检查清单**: Vite+Electron构建就绪验证
>
> - [ ] 渲染进程构建产物完整（dist/index.html + assets）
> - [ ] 主进程构建成功（dist-electron/main.js）
> - [ ] Preload脚本构建完成（dist-electron/preload.js）
> - [ ] contextIsolation安全配置启用
> - [ ] TypeScript类型检查无错误
> - [ ] 构建产物大小在合理范围内
> - [ ] electron-builder配置验证通过

## 7.3 CI 质量门禁

### 7.3.1 Vitest 测试框架配置

#### 核心测试配置 (vitest.config.ts)

> **测试原则**: 快速执行 + 全面覆盖 + CI集成优化

```typescript
// vitest.config.ts - Vitest测试配置
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],

  // 🎯 测试环境配置
  test: {
    // 🌍 环境设置
    environment: 'jsdom', // React组件测试环境
    setupFiles: ['./src/test/setup.ts'], // 测试预设文件

    // 🔧 全局配置
    globals: true, // 支持全局测试API
    clearMocks: true, // 自动清理mock
    restoreMocks: true, // 自动恢复原始实现

    // 📁 文件匹配
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // E2E测试单独处理
    ],

    // ⏱️ 性能配置
    testTimeout: 10000, // 10秒超时
    hookTimeout: 10000, // Hook超时
    teardownTimeout: 5000, // 清理超时

    // 🔍 覆盖率配置
    coverage: {
      enabled: true,
      provider: 'v8', // 使用V8覆盖率引擎

      // 📊 覆盖率阈值（质量门禁）
      thresholds: {
        lines: 80, // 行覆盖率 >= 80%
        functions: 75, // 函数覆盖率 >= 75%
        branches: 70, // 分支覆盖率 >= 70%
        statements: 80, // 语句覆盖率 >= 80%
      },

      // 📈 报告器配置
      reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
      reportsDirectory: './coverage',

      // 📁 覆盖范围
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.{js,ts}',
        'src/**/*.test.{js,ts,jsx,tsx}',
        'src/**/*.spec.{js,ts,jsx,tsx}',
        'src/test/**',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
      ],

      // 🔄 CI集成
      watermarks: {
        statements: [50, 80],
        functions: [50, 75],
        branches: [50, 70],
        lines: [50, 80],
      },
    },

    // 🔬 Reporters配置
    reporters: process.env.CI
      ? ['verbose', 'json', 'junit'] // CI环境：详细输出+机器可读格式
      : ['verbose', 'html'], // 本地环境：详细输出+HTML报告

    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml',
      html: './test-results/index.html',
    },

    // 🎭 Mock配置
    mockReset: true,
    unstubGlobals: true,
    unstubEnvs: true,

    // 🔧 监听模式
    watch: !process.env.CI, // 非CI环境启用watch模式

    // 🧪 并发控制
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: process.env.CI ? 2 : undefined, // CI环境限制并发
        minThreads: 1,
      },
    },
  },

  // 📁 路径解析（与主配置保持一致）
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/test': resolve(__dirname, './src/test'),
    },
  },

  // 🔌 插件配置
  define: {
    __TEST__: true, // 测试环境标识
  },
});
```

#### 测试环境预设配置

```typescript
// src/test/setup.ts - 测试环境预设
import '@testing-library/jest-dom';
import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// 🧹 自动清理
afterEach(() => {
  cleanup(); // 清理DOM
  vi.clearAllMocks(); // 清理mock
});

// 🌍 全局设置
beforeAll(() => {
  // Mock Electron API（如果需要）
  if (typeof window !== 'undefined') {
    window.electronAPI = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      getVersion: vi.fn(() => '1.0.0'),
      getPlatform: vi.fn(() => 'win32'),
    };
  }

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// 🚫 Console警告过滤
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is deprecated')
  ) {
    return; // 忽略已知的React警告
  }
  originalConsoleError(...args);
};
```

### 7.3.2 GitHub Actions CI/CD 工作流

#### 核心CI工作流配置

```yaml
# .github/workflows/ci.yml - 主要CI工作流
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

  # 🔄 允许手动触发
  workflow_dispatch:

# 🌍 环境变量
env:
  NODE_VERSION: '20'
  ELECTRON_CACHE: ${{ github.workspace }}/.cache/electron
  ELECTRON_BUILDER_CACHE: ${{ github.workspace }}/.cache/electron-builder

jobs:
  # 📊 质量检查作业
  quality-gate:
    name: 质量门禁检查
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: ['20.11.1', '20.14.0'] # 测试多个Node.js版本

    steps:
      - name: 📥 检出代码
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # 获取完整历史，用于覆盖率对比

      - name: 🔧 设置Node.js环境
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: |
            package-lock.json
            electron/package-lock.json

      - name: 📦 安装依赖
        run: |
          npm ci --prefer-offline --no-audit
          # 缓存Electron二进制文件
          npm run postinstall || true

      - name: 🔍 代码质量检查
        run: |
          npm run lint
          npm run typecheck || npx tsc --noEmit

      - name: 🧪 运行单元测试
        run: |
          npm run test:unit -- --coverage --run
        env:
          CI: true

      - name: 📊 上传覆盖率报告
        uses: codecov/codecov-action@v4
        if: matrix.node-version == '20.11.1' # 只在主版本上传
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-${{ matrix.node-version }}

      - name: 🔒 安全扫描
        run: |
          npm run security:audit
          npm run security:scan || true # 允许失败但记录结果

      - name: 💾 缓存构建产物
        uses: actions/cache@v4
        with:
          path: |
            dist
            dist-electron
            coverage
          key: build-${{ runner.os }}-${{ matrix.node-version }}-${{ github.sha }}
          restore-keys: |
            build-${{ runner.os }}-${{ matrix.node-version }}-

  # 🏗️ 构建验证作业
  build-verification:
    name: 构建验证
    runs-on: ${{ matrix.os }}
    needs: quality-gate

    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: ['20.11.1']

    steps:
      - name: 📥 检出代码
        uses: actions/checkout@v4

      - name: 🔧 设置Node.js环境
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: 📦 安装依赖
        run: npm ci --prefer-offline --no-audit

      - name: 🏗️ 构建项目
        run: |
          npm run build
          npm run build:electron

      - name: ✅ 验证构建产物
        run: |
          npm run build:validate
          npm run build:security

      - name: 📦 上传构建产物
        uses: actions/upload-artifact@v4
        if: matrix.os == 'ubuntu-latest'
        with:
          name: build-artifacts-${{ github.sha }}
          path: |
            dist/
            dist-electron/
          retention-days: 7

  # 🧪 E2E测试作业
  e2e-tests:
    name: E2E测试
    runs-on: ubuntu-latest
    needs: build-verification

    steps:
      - name: 📥 检出代码
        uses: actions/checkout@v4

      - name: 🔧 设置Node.js环境
        uses: actions/setup-node@v4
        with:
          node-version: '20.11.1'
          cache: 'npm'

      - name: 📦 安装依赖
        run: npm ci --prefer-offline --no-audit

      - name: 🎭 安装Playwright
        run: npx playwright install --with-deps

      - name: 📥 下载构建产物
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts-${{ github.sha }}

      - name: 🧪 运行E2E测试
        run: npm run test:e2e
        env:
          CI: true

      - name: 📊 上传E2E测试报告
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-report-${{ github.sha }}
          path: test-results/
          retention-days: 7
```

#### 覆盖率质量门禁脚本优化

```bash
#!/usr/bin/env bash
# scripts/ci/check-coverage.sh - 增强版覆盖率检查

set -euo pipefail

# 📊 配置参数
MIN_COVERAGE_LINES=${1:-80}
MIN_COVERAGE_FUNCTIONS=${2:-75}
MIN_COVERAGE_BRANCHES=${3:-70}
MIN_COVERAGE_STATEMENTS=${4:-80}

echo "🔍 开始覆盖率质量门禁检查..."
echo "📋 阈值配置:"
echo "  - 行覆盖率: >=${MIN_COVERAGE_LINES}%"
echo "  - 函数覆盖率: >=${MIN_COVERAGE_FUNCTIONS}%"
echo "  - 分支覆盖率: >=${MIN_COVERAGE_BRANCHES}%"
echo "  - 语句覆盖率: >=${MIN_COVERAGE_STATEMENTS}%"

# 🧪 运行测试并生成覆盖率报告
echo "🧪 运行测试套件..."
npx vitest run --coverage \
  --coverage.thresholds.lines=${MIN_COVERAGE_LINES} \
  --coverage.thresholds.functions=${MIN_COVERAGE_FUNCTIONS} \
  --coverage.thresholds.branches=${MIN_COVERAGE_BRANCHES} \
  --coverage.thresholds.statements=${MIN_COVERAGE_STATEMENTS} \
  --reporter=verbose \
  --reporter=json \
  --outputFile.json=./test-results/coverage-results.json

# 📊 解析覆盖率结果
if [ -f "./coverage/coverage-summary.json" ]; then
  echo "📊 覆盖率报告摘要:"

  # 使用jq解析JSON（如果可用）
  if command -v jq &> /dev/null; then
    LINES_PCT=$(jq -r '.total.lines.pct' ./coverage/coverage-summary.json)
    FUNCTIONS_PCT=$(jq -r '.total.functions.pct' ./coverage/coverage-summary.json)
    BRANCHES_PCT=$(jq -r '.total.branches.pct' ./coverage/coverage-summary.json)
    STATEMENTS_PCT=$(jq -r '.total.statements.pct' ./coverage/coverage-summary.json)

    echo "  ✅ 行覆盖率: ${LINES_PCT}%"
    echo "  ✅ 函数覆盖率: ${FUNCTIONS_PCT}%"
    echo "  ✅ 分支覆盖率: ${BRANCHES_PCT}%"
    echo "  ✅ 语句覆盖率: ${STATEMENTS_PCT}%"
  fi
fi

# 🎯 检查是否生成了必要的报告文件
REQUIRED_FILES=(
  "./coverage/lcov.info"
  "./coverage/coverage-summary.json"
  "./test-results/coverage-results.json"
)

echo "🔍 验证报告文件..."
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (缺失)"
    exit 1
  fi
done

echo "🎉 覆盖率质量门禁检查通过！"
```

### 7.3.3 Sentry集成与发布管理

#### Sentry CLI配置与自动化

```yaml
# .github/workflows/release.yml - 发布工作流
name: Release & Deploy

on:
  push:
    tags: ['v*']
  release:
    types: [published]

env:
  SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
  SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}

jobs:
  release:
    name: 创建发布版本
    runs-on: ubuntu-latest

    steps:
      - name: 📥 检出代码
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: 🔧 设置Node.js环境
        uses: actions/setup-node@v4
        with:
          node-version: '20.11.1'
          cache: 'npm'

      - name: 📦 安装依赖
        run: npm ci --prefer-offline --no-audit

      - name: 🏗️ 构建生产版本
        run: |
          npm run build
          npm run build:electron
        env:
          NODE_ENV: production

      - name: 📊 安装Sentry CLI
        run: |
          curl -sL https://sentry.io/get-cli/ | bash

      - name: 🎯 创建Sentry Release
        run: |
          # 获取版本号
          VERSION=$(node -p "require('./package.json').version")
          COMMIT_SHA=${GITHUB_SHA::7}
          RELEASE_NAME="${VERSION}-${COMMIT_SHA}"

          echo "📋 创建Release: ${RELEASE_NAME}"

          # 创建新的release
          sentry-cli releases new ${RELEASE_NAME}

          # 关联提交信息
          sentry-cli releases set-commits ${RELEASE_NAME} --auto

          # 上传Source Maps
          echo "📤 上传Source Maps..."
          sentry-cli releases files ${RELEASE_NAME} upload-sourcemaps \
            --url-prefix "~/assets" \
            --validate \
            --strip-common-prefix \
            ./dist/assets/
            
          # 上传Electron主进程Source Maps
          if [ -f "./dist-electron/main.js.map" ]; then
            sentry-cli releases files ${RELEASE_NAME} upload-sourcemaps \
              --url-prefix "~/electron" \
              --validate \
              ./dist-electron/
          fi

          # 完成release
          sentry-cli releases finalize ${RELEASE_NAME}

          # 标记部署
          sentry-cli releases deploys ${RELEASE_NAME} new -e production

        env:
          SENTRY_LOG_LEVEL: debug

      - name: 🔍 验证Source Maps上传
        run: |
          VERSION=$(node -p "require('./package.json').version")
          COMMIT_SHA=${GITHUB_SHA::7}
          RELEASE_NAME="${VERSION}-${COMMIT_SHA}"

          echo "🔍 验证Release信息..."
          sentry-cli releases info ${RELEASE_NAME}

          echo "📂 验证上传的文件..."
          sentry-cli releases files ${RELEASE_NAME} list
```

#### package.json Sentry集成脚本

```json
{
  "scripts": {
    // 🎯 Sentry相关命令
    "sentry:login": "sentry-cli login",
    "sentry:info": "sentry-cli info",

    // 📊 创建Release
    "sentry:release:create": "node scripts/sentry/create-release.js",
    "sentry:release:finalize": "node scripts/sentry/finalize-release.js",

    // 📤 Source Maps管理
    "sentry:sourcemaps:upload": "node scripts/sentry/upload-sourcemaps.js",
    "sentry:sourcemaps:validate": "sentry-cli releases files $SENTRY_RELEASE list",

    // 🏗️ 构建+Sentry集成
    "build:prod": "npm run build && npm run sentry:sourcemaps:upload",
    "release:prod": "npm run build:prod && npm run sentry:release:create && npm run sentry:release:finalize"
  }
}
```

#### Sentry发布管理脚本

```javascript
// scripts/sentry/create-release.js - Sentry Release创建
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/* 📋 获取项目信息 */
function getProjectInfo() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const gitCommit = execSync('git rev-parse --short HEAD', {
    encoding: 'utf8',
  }).trim();
  const version = packageJson.version;
  const releaseName = `${version}-${gitCommit}`;

  return { version, gitCommit, releaseName };
}

/* 🎯 创建Sentry Release */
function createSentryRelease() {
  console.log('🚀 开始创建Sentry Release...');

  const { releaseName } = getProjectInfo();

  try {
    // 验证环境变量
    const requiredEnvs = ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'];
    for (const env of requiredEnvs) {
      if (!process.env[env]) {
        throw new Error(`❌ 缺少环境变量: ${env}`);
      }
    }

    console.log(`📋 Release名称: ${releaseName}`);

    // 创建Release
    execSync(`sentry-cli releases new ${releaseName}`, { stdio: 'inherit' });
    console.log('✅ Release创建成功');

    // 关联Git提交
    execSync(`sentry-cli releases set-commits ${releaseName} --auto`, {
      stdio: 'inherit',
    });
    console.log('✅ Git提交关联成功');

    // 设置环境变量供后续使用
    console.log(`SENTRY_RELEASE=${releaseName}`);
  } catch (error) {
    console.error('❌ Sentry Release创建失败:', error.message);
    process.exit(1);
  }
}

/* 📤 上传Source Maps */
function uploadSourceMaps() {
  console.log('📤 开始上传Source Maps...');

  const { releaseName } = getProjectInfo();

  try {
    // 上传渲染进程Source Maps
    if (fs.existsSync('./dist/assets')) {
      console.log('📦 上传渲染进程Source Maps...');
      execSync(
        `sentry-cli releases files ${releaseName} upload-sourcemaps ` +
          `--url-prefix "~/assets" ` +
          `--validate ` +
          `--strip-common-prefix ` +
          `./dist/assets/`,
        { stdio: 'inherit' }
      );
    }

    // 上传主进程Source Maps
    if (
      fs.existsSync('./dist-electron') &&
      fs.existsSync('./dist-electron/main.js.map')
    ) {
      console.log('⚡ 上传主进程Source Maps...');
      execSync(
        `sentry-cli releases files ${releaseName} upload-sourcemaps ` +
          `--url-prefix "~/electron" ` +
          `--validate ` +
          `./dist-electron/`,
        { stdio: 'inherit' }
      );
    }

    console.log('✅ Source Maps上传完成');
  } catch (error) {
    console.error('❌ Source Maps上传失败:', error.message);
    process.exit(1);
  }
}

/* 🎯 主函数 */
function main() {
  const command = process.argv[2] || 'create';

  switch (command) {
    case 'create':
      createSentryRelease();
      break;
    case 'upload':
      uploadSourceMaps();
      break;
    case 'all':
      createSentryRelease();
      uploadSourceMaps();
      break;
    default:
      console.log('用法: node create-release.js [create|upload|all]');
      process.exit(1);
  }
}

// 执行脚本
if (require.main === module) {
  main();
}

module.exports = { createSentryRelease, uploadSourceMaps, getProjectInfo };
```

### 7.3.4 质量门禁阈值与基准脚本

#### 质量指标配置文件

```json5
// configs/quality-gates.json5 - 质量门禁配置
{
  // 📊 覆盖率阈值
  coverage: {
    lines: 80,
    functions: 75,
    branches: 70,
    statements: 80,

    // 🎯 关键模块要求更高阈值
    critical: {
      paths: ['src/security/**', 'src/main/**', 'src/shared/observability/**'],
      lines: 90,
      functions: 85,
      branches: 80,
      statements: 90,
    },
  },

  // 🔍 代码质量
  lint: {
    maxWarnings: 0, // 零警告策略
    maxErrors: 0, // 零错误策略
  },

  // 📦 构建产物大小限制
  bundleSize: {
    maxSize: '2MB', // 主bundle最大2MB
    maxChunkSize: '500KB', // 单个chunk最大500KB
    maxAssetSize: '1MB', // 静态资源最大1MB
  },

  // ⚡ 性能指标
  performance: {
    buildTime: '180s', // 构建时间不超过3分钟
    testTime: '60s', // 测试时间不超过1分钟
    lintTime: '30s', // 代码检查不超过30秒
  },

  // 🔒 安全扫描
  security: {
    maxHighVulnerabilities: 0, // 高危漏洞零容忍
    maxMediumVulnerabilities: 2, // 中危漏洞最多2个
    allowedLicenses: [
      // 允许的开源协议
      'MIT',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'Apache-2.0',
      'ISC',
    ],
  },
}
```

#### 综合质量检查脚本

```bash
#!/usr/bin/env bash
# scripts/ci/quality-gate-check.sh - 综合质量门禁检查

set -euo pipefail

# 📁 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 📊 加载配置
QUALITY_CONFIG="${PROJECT_ROOT}/configs/quality-gates.json5"

echo "🚀 开始质量门禁检查..."
echo "📋 配置文件: ${QUALITY_CONFIG}"

# 📏 性能计时函数
time_start() {
  date +%s
}

time_end() {
  local start_time=$1
  local end_time=$(date +%s)
  echo $((end_time - start_time))
}

# 🔍 1. 代码检查 (Lint)
echo "🔍 [1/6] 代码质量检查..."
lint_start=$(time_start)

if ! npm run lint; then
  echo "❌ 代码检查失败"
  exit 1
fi

lint_duration=$(time_end $lint_start)
echo "✅ 代码检查通过 (${lint_duration}s)"

# 📝 2. TypeScript类型检查
echo "📝 [2/6] TypeScript类型检查..."
typecheck_start=$(time_start)

if ! npx tsc --noEmit; then
  echo "❌ TypeScript类型检查失败"
  exit 1
fi

typecheck_duration=$(time_end $typecheck_start)
echo "✅ TypeScript类型检查通过 (${typecheck_duration}s)"

# 🧪 3. 单元测试+覆盖率
echo "🧪 [3/6] 单元测试与覆盖率检查..."
test_start=$(time_start)

if ! bash "${SCRIPT_DIR}/check-coverage.sh" 80 75 70 80; then
  echo "❌ 测试或覆盖率检查失败"
  exit 1
fi

test_duration=$(time_end $test_start)
echo "✅ 单元测试与覆盖率检查通过 (${test_duration}s)"

# 🏗️ 4. 构建验证
echo "🏗️ [4/6] 构建验证..."
build_start=$(time_start)

if ! npm run build; then
  echo "❌ 构建失败"
  exit 1
fi

if ! npm run build:validate; then
  echo "❌ 构建验证失败"
  exit 1
fi

build_duration=$(time_end $build_start)
echo "✅ 构建验证通过 (${build_duration}s)"

# 🔒 5. 安全扫描
echo "🔒 [5/6] 安全扫描..."
security_start=$(time_start)

if ! npm run security:check; then
  echo "❌ 安全扫描失败"
  exit 1
fi

security_duration=$(time_end $security_start)
echo "✅ 安全扫描通过 (${security_duration}s)"

# 📦 6. Bundle大小检查
echo "📦 [6/6] Bundle大小检查..."
bundle_start=$(time_start)

if ! node "${SCRIPT_DIR}/check-bundle-size.js"; then
  echo "❌ Bundle大小检查失败"
  exit 1
fi

bundle_duration=$(time_end $bundle_start)
echo "✅ Bundle大小检查通过 (${bundle_duration}s)"

# 📊 总结报告
total_duration=$((lint_duration + typecheck_duration + test_duration + build_duration + security_duration + bundle_duration))

echo ""
echo "🎉 质量门禁检查全部通过！"
echo "📊 执行时间统计:"
echo "  - 代码检查: ${lint_duration}s"
echo "  - 类型检查: ${typecheck_duration}s"
echo "  - 测试覆盖率: ${test_duration}s"
echo "  - 构建验证: ${build_duration}s"
echo "  - 安全扫描: ${security_duration}s"
echo "  - Bundle检查: ${bundle_duration}s"
echo "  - 总耗时: ${total_duration}s"

# 🎯 检查是否超出性能阈值（如果配置了的话）
if [ ${total_duration} -gt 300 ]; then # 5分钟阈值
  echo "⚠️  警告: 质量门禁总耗时超过5分钟，建议优化"
fi

echo "✅ 所有质量门禁检查通过，代码可以合并！"
```

---

> **📋 CI质量门禁检查清单**:
>
> - [ ] Vitest测试框架配置完成并通过
> - [ ] 覆盖率阈值达标（行80%、函数75%、分支70%、语句80%）
> - [ ] GitHub Actions工作流配置完成
> - [ ] Node.js环境缓存优化生效
> - [ ] 构建矩阵测试通过（多版本、多平台）
> - [ ] Sentry CLI集成与Source Maps上传成功
> - [ ] 安全扫描通过（零高危漏洞）
> - [ ] Bundle大小控制在合理范围
> - [ ] 所有质量门禁脚本正常执行

## 7.4 测试金字塔

- 单元 → 组件/集成 → E2E（Playwright Electron）。

## 7.5 验收

- `scripts/ci/check-coverage.sh`：最小覆盖率门禁；
- CI 示例 YAML（按你的平台接入）。
