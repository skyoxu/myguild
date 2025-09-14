# E2E Performance Test Configuration Backup

> **日期**: 2025-09-14  
> **问题**: P95性能测试失败 - test-button元素缺失  
> **修复状态**: ✅ 已解决  
> **Git Commit**: [记录对应的Git提交哈希]

## 问题描述

P95性能测试在`tests/e2e/smoke/perf.spec.ts`中失败，错误信息显示`test-button`元素不可见，导致交互测试无法进行。

**根本原因**: `VITE_E2E_SMOKE`环境变量未正确传递给构建过程和Electron运行时环境，导致`PerfTestHarness`组件无法正确加载。

## 修复配置记录

### 1. 核心修复文件

**文件**: `tests/helpers/launch.ts`

#### 1.1 构建时环境变量注入

```typescript
// 第25-33行：buildApp()函数中的环境变量配置
try {
  console.log('[launch] building application (npm run build)...');
  execSync('npm run build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_E2E_SMOKE: 'true', // 确保构建时注入环境变量
    },
  });
```

#### 1.2 运行时环境变量配置

**launchApp函数 (第46-58行)**:

```typescript
return electron.launch({
  args: [main],
  env: {
    CI: 'true',
    ELECTRON_ENABLE_LOGGING: '1',
    SECURITY_TEST_MODE: 'true',
    E2E_AUTO_START: '1',
    VITE_E2E_SMOKE: 'true', // 运行时环境变量
  },
});
```

**launchAppWithArgs函数 (第71-84行)**:

```typescript
return electron.launch({
  args,
  env: {
    CI: 'true',
    ELECTRON_ENABLE_LOGGING: '1',
    SECURITY_TEST_MODE: 'true',
    E2E_AUTO_START: '1',
    VITE_E2E_SMOKE: 'true', // 运行时环境变量
  },
});
```

**launchAppWithPage函数 (第93-103行)**:

```typescript
const app = await (electronOverride || electron).launch({
  args: [main],
  env: {
    CI: 'true',
    SECURITY_TEST_MODE: 'true',
    E2E_AUTO_START: '1',
    VITE_E2E_SMOKE: 'true', // 运行时环境变量
  },
  cwd: process.cwd(),
  timeout: 45000,
});
```

### 2. 环境变量检查点

#### 2.1 前端代码检查点

**文件**: `src/app.tsx` (第30行)

```typescript
const isPerfSmoke = (() => {
  const byFlag = (import.meta as any)?.env?.VITE_E2E_SMOKE === 'true';
  // 此处应该在E2E测试环境中返回true
})();
```

**文件**: `src/components/PerfTestHarness.tsx` (第11行)

```typescript
const e2eSmoke = (import.meta as any)?.env?.VITE_E2E_SMOKE === 'true';
// 此处应该在E2E测试环境中返回true，确保120ms自动隐藏逻辑生效
```

#### 2.2 测试验证点

**文件**: `tests/e2e/smoke/perf.spec.ts` (第58-77行)

```typescript
// 应该能成功找到以下元素：
await page.waitForSelector('[data-testid="perf-harness"]', { timeout: 10000 });
await page.waitForSelector('[data-testid="test-button"]', { timeout: 5000 });
```

### 3. 技术细节说明

#### 3.1 Vite环境变量机制

- **前缀要求**: 必须使用`VITE_`前缀才能注入到客户端代码
- **构建时注入**: 通过`execSync`的`env`参数在构建时设置
- **访问方式**: 在前端代码中通过`import.meta.env.VITE_E2E_SMOKE`访问

#### 3.2 Electron环境变量传递

- **主进程**: 通过`electron.launch()`的`env`参数传递
- **渲染进程**: Vite构建时已经注入，无需额外传递
- **一致性**: 确保构建时和运行时都设置相同的环境变量

#### 3.3 双层注入机制

1. **构建层面**: `execSync('npm run build', { env: { VITE_E2E_SMOKE: 'true' } })`
2. **运行层面**: `electron.launch({ env: { VITE_E2E_SMOKE: 'true' } })`

## 测试验证结果

### P95性能测试结果

```
interaction_response P95采样统计:
  样本数量: 30
  P95值: 22.00ms
  平均值: 17.37ms
  最小值: 11.00ms
  最大值: 24.00ms
  阈值: 200ms
  状态: ✅ 通过
```

### E2E冒烟测试结果

- ✅ Electron应用启动测试通过
- ✅ P95性能测试通过
- ✅ 安全基线验证通过
- ✅ CSP策略验证通过

## 关键配置文件快照

### playwright.config.ts相关配置

```typescript
// electron-smoke-tests项目配置 (第67-89行)
{
  name: 'electron-smoke-tests',
  testMatch: ['**/smoke/**/*.spec.ts', '**/smoke.*.spec.ts'],
  timeout: 90000, // 增加冒烟测试超时到90秒
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: {
      executablePath: undefined,
      env: {
        NODE_ENV: 'test',
        CI: 'true',
        SECURITY_TEST_MODE: 'true',
      },
    },
  },
}
```

### vite.config.ts相关配置

```typescript
// 确保sourcemap配置正确，支持环境变量注入
build: {
  sourcemap: 'hidden',
  // 其他构建配置...
}
```

## 故障排除指南

### 如果P95测试再次失败，检查以下项目：

1. **环境变量检查**:

   ```bash
   # 在构建过程中应该看到PerfTestHarness组件被构建
   # 检查dist/assets/目录中是否存在PerfTestHarness-xxx.js文件
   ls dist/assets/PerfTestHarness-*.js
   ```

2. **运行时验证**:

   ```javascript
   // 在浏览器控制台中检查
   console.log('VITE_E2E_SMOKE:', import.meta.env.VITE_E2E_SMOKE);
   ```

3. **组件加载验证**:
   ```bash
   # 检查Electron日志中是否有PerfTestHarness相关的请求
   # 应该看到类似：PerfTestHarness-xxx.js -> C:\...\dist\assets\PerfTestHarness-xxx.js
   ```

### 常见问题与解决方案

#### 问题1: test-button元素仍然找不到

**解决方案**: 检查所有`electron.launch()`调用是否都包含`VITE_E2E_SMOKE: 'true'`

#### 问题2: PerfTestHarness组件未加载

**解决方案**: 确保构建时环境变量正确设置，重新运行构建

#### 问题3: 环境变量在运行时未生效

**解决方案**: 检查Vite配置，确保环境变量前缀正确

## 兼容性说明

- **Windows兼容**: 使用`set VITE_E2E_SMOKE=true`在Windows命令行中设置
- **跨平台**: 在Node.js中通过`process.env`统一处理
- **CI/CD**: 在CI环境中会自动使用构建缓存优化

## 回滚方案

如果修复导致其他问题，可以通过以下步骤回滚：

1. **移除环境变量注入**:
   - 从`buildApp()`函数的`env`配置中移除`VITE_E2E_SMOKE`
   - 从所有`electron.launch()`调用中移除`VITE_E2E_SMOKE`

2. **恢复原始配置**:

   ```typescript
   // buildApp()中恢复为：
   env: { ...process.env }

   // electron.launch()中恢复为：
   env: {
     CI: 'true',
     ELECTRON_ENABLE_LOGGING: '1',
     SECURITY_TEST_MODE: 'true',
     E2E_AUTO_START: '1',
   }
   ```

## 相关参考文档

- [citest/ciinfo.md](citest/ciinfo.md) - CI测试基本规则
- [docs/BUILD_AND_TEST_WORKFLOW_BACKUP_e0f67f3.md](docs/BUILD_AND_TEST_WORKFLOW_BACKUP_e0f67f3.md) - 构建和测试工作流配置
- [Vite环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- [Playwright Electron测试文档](https://playwright.dev/docs/api/class-electron)

---

**最后更新**: 2025-09-14  
**修复者**: Claude Code Assistant  
**验证状态**: ✅ 已通过完整E2E测试验证
