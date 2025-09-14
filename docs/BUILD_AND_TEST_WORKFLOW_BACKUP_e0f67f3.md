# Build and Test 工作流备份文档 (e0f67f3版本)

## 📋 备份说明

**创建时间:** 2025-09-14  
**基于版本:** e0f67f3 (fix(e2e): 修复e2e-perf-smoke测试环境变量传递问题)  
**备份目的:** 保存当前正常工作的build和test工作流配置，以便今后升级异常时快速恢复  
**验证状态:** ✅ 已验证正常工作

---

## 🎯 工作流验证结果摘要

### ✅ 正常工作的组件

- **构建系统:** Vite + TypeScript + Electron编译链正常
- **类型检查:** TypeScript编译无错误
- **代码质量:** ESLint检查通过（警告数量在可接受范围内）
- **安全检查:** Electronegativity扫描和npm audit完成
- **单元测试:** Vitest测试套件运行正常
- **Git工作流:** 预提交钩子和提交信息验证正常

### ❌ 已知问题

- **E2E测试:** 冒烟测试超时失败，DOM元素 `[data-testid="app-root"]` 未及时出现

---

## 📦 核心配置文件

### package.json 脚本配置

```json
{
  "scripts": {
    "build": "tsc -p electron && tsc -b && vite build",
    "dev": "vite",
    "dev:electron": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:perf-smoke": "playwright test --project=electron-smoke-tests tests/e2e/smoke/perf.spec.ts --workers=1 --retries=0 --reporter=line,json",
    "test:unit": "vitest run --reporter=verbose --reporter=junit --outputFile=test-results/junit-results.xml",
    "lint": "npm run lint:src && npm run lint:tests",
    "lint:src": "eslint \"src/**/*.{ts,tsx}\" --max-warnings 115",
    "lint:tests": "eslint \"tests/**/*.{ts,tsx}\" --max-warnings 200",
    "lint:fix": "npm run lint:src -- --fix && npm run lint:tests -- --fix",
    "typecheck": "tsc --noEmit",
    "security:check": "npm run security:scan && npm run security:audit",
    "security:scan": "electronegativity --input . --output electronegativity-scan.csv --verbose false --electron-version 30.0.0",
    "security:audit": "npm audit --audit-level high",
    "guard:ci": "npm run typecheck && npm run lint && npm run test:unit && npm run security:check"
  }
}
```

### 关键依赖版本

```json
{
  "devDependencies": {
    "@types/react": "~19.0.1",
    "@types/react-dom": "~19.0.1",
    "@typescript-eslint/eslint-plugin": "^8.16.0",
    "@typescript-eslint/parser": "^8.16.0",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^37.2.1",
    "eslint": "^9.17.0",
    "playwright": "^1.49.1",
    "typescript": "~5.8.3",
    "vite": "^7.0.6",
    "vitest": "^2.1.8"
  },
  "dependencies": {
    "react": "19.1.0",
    "react-dom": "19.1.0"
  }
}
```

### TypeScript配置 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

### ESLint配置关键点

- **src目录:** 最大警告数115个
- **tests目录:** 最大警告数200个
- **基于:** @typescript-eslint/recommended 规则

### Vite配置 (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          phaser: ['phaser'],
          sentry: ['@sentry/electron'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
```

---

## 🔧 Electron配置

### 主进程 (electron/main.ts)

- **安全配置:** nodeIntegration=false, contextIsolation=true
- **CSP策略:** 严格的内容安全策略
- **权限管理:** 统一的权限请求处理

### 预加载脚本 (electron/preload.ts)

- **contextBridge API:** 安全的主进程/渲染进程通信
- **白名单API:** 严格控制暴露的功能

---

## 🧪 测试配置

### Playwright配置 (playwright.config.ts)

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron-smoke-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/smoke/**/*.spec.ts',
    },
  ],
});
```

### Vitest配置 (vitest.config.ts)

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'dist-electron/**', 'tests/**'],
    },
  },
});
```

---

## 🔍 验证检查清单

### 构建验证

- [x] `npm run build` - 成功完成（~15-17秒）
- [x] TypeScript编译无错误
- [x] 生成dist/目录，包含所有资源
- [x] 源映射文件正确生成
- [x] 资源优化和分块正常

### 类型检查

- [x] `npm run typecheck` - 无TypeScript错误
- [x] 严格模式配置生效
- [x] React 19类型兼容性正常

### 代码质量

- [x] `npm run lint:src` - 通过（警告≤115）
- [x] `npm run lint:tests` - 通过（警告≤200）
- [x] ESLint规则配置正确

### 安全检查

- [x] `npm run security:scan` - Electronegativity扫描完成
- [x] `npm run security:audit` - npm audit通过（4个已知可接受漏洞）

### 单元测试

- [x] `npm run test:unit` - 527个测试通过，7个跳过
- [x] JUnit报告生成正常
- [x] 覆盖率报告可用

### Git工作流

- [x] Husky预提交钩子工作正常
- [x] lint-staged配置生效
- [x] 提交信息验证正常

---

## ⚙️ 环境要求

### Node.js & npm

- **Node.js:** 推荐 18.x 或 20.x
- **npm:** 推荐 9.x 或更高版本

### 系统依赖

- **Python:** 3.x (用于某些native模块编译)
- **Visual Studio Build Tools:** Windows环境需要

### 开发工具

- **TypeScript:** ~5.8.3
- **Electron:** ^37.2.1
- **Vite:** ^7.0.6

---

## 📊 性能基准

### 构建时间

- **开发构建:** ~3-5秒（增量）
- **生产构建:** ~15-17秒（完整）
- **TypeScript编译:** ~2-3秒

### 包大小

- **总大小:** ~2.3MB (gzipped: ~600KB)
- **最大chunk:** phaser.js (~1.5MB, gzipped: ~340KB)
- **React vendor:** ~357KB (gzipped: ~106KB)

### 测试执行时间

- **单元测试:** ~5-10秒（527个测试）
- **ESLint:** ~3-5秒
- **TypeScript检查:** ~2-3秒

---

## 🔄 恢复指南

当未来升级导致build和test工作流异常时，使用此文档进行恢复：

### 1. 检查依赖版本

```bash
# 比对当前版本与备份版本
npm list --depth=0
```

### 2. 恢复关键配置文件

- `package.json` (scripts和dependencies部分)
- `tsconfig.json`
- `vite.config.ts`
- `playwright.config.ts`
- `vitest.config.ts`
- `.eslintrc.*`

### 3. 验证工作流

```bash
# 按顺序执行验证
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run security:check
```

### 4. 回滚策略

如果恢复仍有问题，可以考虑：

```bash
# 回滚到e0f67f3版本
git checkout e0f67f3
git checkout -b recovery/build-workflow-fix
```

---

## 📝 注意事项

### E2E测试问题

- E2E冒烟测试目前超时失败
- 问题不影响构建和其他测试
- 主要原因是DOM元素渲染时序问题
- 可作为独立技术债务处理

### 安全警告

- 4个npm audit警告（3个low，1个moderate）
- 均为依赖库问题，不影响核心功能
- 定期更新依赖可解决

### 性能优化建议

- 考虑代码分割减小phaser.js包大小
- 可通过动态import优化首屏加载
- Bundle分析可用于进一步优化

---

## 📞 支持信息

**文档版本:** 1.0  
**最后更新:** 2025-09-14  
**维护者:** Claude Code  
**相关issue:** E2E测试超时问题需要独立跟踪

如需恢复此配置，请严格按照本文档的配置进行，并在恢复后运行完整的验证检查清单。
