# 技术栈层详细配置 - 完整复刻指南

**层级**: Layer 1 - Technology Stack Foundation  
**目标**: 精确复制项目的核心技术栈和依赖配置

---

## 📋 核心依赖版本矩阵（严格匹配）

### 主要框架依赖

```json
{
  "react": "19.0.0",
  "react-dom": "19.0.0",
  "electron": "37.2.4",
  "vite": "7.0.4",
  "typescript": "5.7.2",
  "@tailwindcss/cli": "4.0.0-beta.7",
  "phaser": "3.85.2"
}
```

### 开发工具依赖

```json
{
  "@types/react": "19.0.1",
  "@types/react-dom": "19.0.1",
  "@vitejs/plugin-react": "5.0.0",
  "electron-builder": "25.1.8",
  "vite-plugin-electron": "0.28.8"
}
```

### 测试框架依赖

```json
{
  "playwright": "1.49.0",
  "@playwright/test": "1.49.0",
  "vitest": "2.1.8",
  "@vitest/coverage-v8": "2.1.8"
}
```

### 监控和可观测性

```json
{
  "@sentry/electron": "5.5.0"
}
```

---

## 🔧 核心配置文件完整模板

### `package.json` 脚本配置

```json
{
  "name": "vitegame",
  "version": "0.1.0",
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "dev:electron": "vite --mode electron",
    "build": "tsc && vite build && electron-builder",
    "build:electron": "vite build --mode electron",
    "preview": "vite preview",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
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
    "guard:base": "node scripts/verify_base_clean.mjs",
    "guard:ci": "pnpm typecheck && pnpm lint && pnpm test:unit && pnpm guard:electron && pnpm test:e2e && pnpm guard:quality && pnpm guard:base"
  }
}
```

### `vite.config.ts` - 完整 Vite 7 配置

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // 主进程入口
        entry: 'electron/main.ts',
        onstart: args => {
          if (process.env.VSCODE_DEBUG) {
            console.log('[startup] Electron App');
          } else {
            args.startup(['--inspect=5858']);
          }
        },
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron',
          },
        },
      },
      {
        // 预加载脚本入口
        entry: 'electron/preload.ts',
        onstart: args => args.reload(),
        vite: {
          build: {
            sourcemap: 'inline',
            outDir: 'dist-electron',
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: process.env.VSCODE_DEBUG
    ? {
        host: '127.0.0.1',
        port: 3000,
      }
    : undefined,
  clearScreen: false,
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          phaser: ['phaser'],
        },
      },
    },
  },
});
```

### `tsconfig.json` - TypeScript 5.7 配置

```json
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
  "include": ["src/**/*", "electron/**/*", "vite.config.ts"],
  "exclude": ["node_modules", "dist", "dist-electron"]
}
```

### `tailwind.config.js` - Tailwind CSS v4 配置

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './electron/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

---

## 📁 目录结构模板

### 标准项目目录结构

```
project-root/
├── src/                          # React 渲染进程源码
│   ├── components/              # React 组件
│   │   ├── ui/                 # 基础 UI 组件
│   │   ├── game/               # 游戏相关组件
│   │   └── layout/             # 布局组件
│   ├── hooks/                  # React Hooks
│   ├── utils/                  # 工具函数
│   ├── styles/                 # 样式文件
│   ├── game/                   # Phaser 游戏逻辑
│   ├── shared/                 # 共享类型和契约
│   │   └── contracts/          # TypeScript 接口定义
│   ├── main.tsx               # React 应用入口
│   └── app.tsx                # 根组件
├── electron/                   # Electron 主进程
│   ├── main.ts               # 主进程入口
│   └── preload.ts            # 预加载脚本
├── tests/                      # 测试文件
│   ├── unit/                 # 单元测试 (Vitest)
│   ├── e2e/                  # E2E 测试 (Playwright)
│   │   ├── smoke/           # 冒烟测试
│   │   ├── security/        # 安全测试
│   │   └── performance/     # 性能测试
│   └── fixtures/            # 测试固件
├── scripts/                    # 构建和质量门禁脚本
│   ├── scan_electron_safety.mjs
│   ├── quality_gates.mjs
│   └── verify_base_clean.mjs
├── claudedocs/                 # Claude Code 文档
├── dist/                       # 渲染进程构建产物
├── dist-electron/              # 主进程构建产物
├── .claude/                    # Claude Code 配置
├── .mcp.json                   # MCP 服务器配置
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── playwright.config.ts
└── package.json
```

---

## 🎯 React 19 特性配置

### React 19 新特性启用

```tsx
// src/main.tsx - React 19 渲染配置
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.tsx';
import './index.css';

// React 19 支持的新 createRoot API
const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### React 19 Hooks 使用模式

```tsx
// src/hooks/useElectronAPI.ts - Electron API 集成
import { useEffect, useState, use } from 'react';

interface ElectronAPI {
  platform: string;
  version: string;
  isElectron: boolean;
}

export function useElectronAPI() {
  const [electronAPI, setElectronAPI] = useState<ElectronAPI | null>(null);

  useEffect(() => {
    // 检查预加载脚本暴露的 API
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setElectronAPI((window as any).electronAPI);
    }
  }, []);

  return electronAPI;
}
```

---

## 🎮 Phaser 3 游戏引擎集成

### Phaser 场景配置

```typescript
// src/game/scenes/GameScene.ts
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // 资源加载逻辑
    this.load.image('player', '/assets/player.png');
  }

  create() {
    // 场景创建逻辑
    const player = this.add.sprite(400, 300, 'player');

    // Electron 环境特定配置
    if ((window as any).electronAPI) {
      console.log('在 Electron 环境中运行 Phaser');
    }
  }

  update() {
    // 游戏循环更新逻辑
  }
}
```

### Phaser + React 通信桥接

```tsx
// src/components/game/GameContainer.tsx
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from '@/game/scenes/GameScene';

interface GameContainerProps {
  width?: number;
  height?: number;
}

export function GameContainer({
  width = 800,
  height = 600,
}: GameContainerProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: containerRef.current,
      scene: [GameScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 300 },
          debug: process.env.NODE_ENV === 'development',
        },
      },
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [width, height]);

  return <div ref={containerRef} className="game-container" />;
}
```

---

## 🔨 构建和开发脚本

### 开发环境启动脚本

```json
// package.json scripts 部分的详细说明
{
  "dev": "vite", // 纯 Web 开发模式
  "dev:electron": "vite --mode electron", // Electron 开发模式
  "build": "tsc && vite build && electron-builder", // 完整构建
  "build:electron": "vite build --mode electron" // 仅 Electron 构建
}
```

### Electron Builder 配置

```json
// electron-builder 配置 (package.json)
{
  "build": {
    "appId": "com.vitegame.app",
    "productName": "ViteGame",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

---

## ⚡ 性能优化配置

### Vite 构建优化

```typescript
// vite.config.ts 中的性能优化配置
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          phaser: ['phaser'],
          utils: ['lodash', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

### TypeScript 编译优化

```json
// tsconfig.json 性能配置
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "ts-node": {
    "esm": true,
    "transpileOnly": true
  }
}
```

---

## 🚨 已知问题和解决方案

### 版本兼容性问题

#### Vite 7.0 + Electron 插件兼容性

**问题**: `vite-plugin-electron@0.28.8` 可能与 Vite 7.0 不完全兼容  
**解决方案**: 使用固定版本组合，避免自动更新

```bash
npm install vite@7.0.4 vite-plugin-electron@0.28.8 --save-exact
```

#### React 19 第三方库兼容性

**问题**: 部分第三方库可能不支持 React 19  
**解决方案**: 检查兼容性列表，必要时使用 `--legacy-peer-deps`

```bash
npm install --legacy-peer-deps
```

### 开发环境问题

#### Tailwind v4 Beta 稳定性

**问题**: Beta 版本可能存在不稳定性  
**解决方案**: 锁定具体 beta 版本，监控官方发布

```json
{
  "@tailwindcss/cli": "4.0.0-beta.7"
}
```

---

## 📊 成功验证指标

### 技术栈层验证清单

- ✅ React 19.0.0 正确安装并可使用新特性
- ✅ Electron 37.2.4 成功启动桌面应用
- ✅ Vite 7.0.4 开发服务器正常运行
- ✅ TypeScript 5.7.2 类型检查无错误
- ✅ Tailwind v4 样式系统正常工作
- ✅ Phaser 3.85.2 游戏场景正确渲染
- ✅ 热重载 (HMR) 在开发模式下正常工作
- ✅ 构建产物能够正常打包和分发

### 验证命令

```bash
# 版本检查
npm list react electron vite typescript

# 开发环境验证
npm run dev          # Web 开发服务器
npm run dev:electron # Electron 开发环境

# 构建验证
npm run build        # 完整构建流程
npm run typecheck    # TypeScript 类型检查
npm run lint         # 代码规范检查
```

---

**文档版本**: v1.0  
**更新日期**: 2025年8月27日  
**适用版本**: 当前项目技术栈配置  
**依赖关系**: 依赖于环境复刻主指南
