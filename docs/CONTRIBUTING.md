# 贡献指南 (CONTRIBUTING.md)

本指南说明如何在本项目中进行开发、测试和贡献代码。

## 🚀 快速开始

### 环境要求
- **Node.js**: ≥18.0.0
- **npm**: ≥9.0.0
- **操作系统**: Windows (主要支持)

### 项目设置
```bash
# 1. 克隆项目
git clone <项目地址>
cd vitegame

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 启动Electron应用
npm run dev:electron
```

## 🛡️ 本地守门脚本使用

### 完整质量检查
```bash
# 运行所有质量门禁 (推荐在提交前运行)
npm run guard:ci
```

### 分项检查
```bash
# TypeScript类型检查
npm run typecheck

# ESLint代码规范检查
npm run lint

# 单元测试
npm run test:unit

# Electron安全检查
npm run guard:electron

# E2E测试
npm run test:e2e

# 质量门禁 (覆盖率 + Release Health)
npm run guard:quality

# Base文档清洁检查
npm run guard:base

# 版本同步检查
npm run guard:version
```

### 测试覆盖率
```bash
# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率报告 (Windows)
npm run test:coverage:open
```

## 📁 项目结构

```
├── src/                    # 主要源代码
│   ├── core/              # 核心业务逻辑
│   ├── domain/            # 领域模型和端口
│   ├── shared/            # 共享组件和合约
│   └── styles/            # Tailwind CSS样式
├── electron/              # Electron主进程和预加载脚本
├── tests/                 # 测试文件
│   ├── e2e/              # Playwright E2E测试
│   ├── core/             # 核心逻辑单元测试
│   └── domain/           # 领域契约测试
├── scripts/               # 质量门禁脚本
├── docs/                  # 项目文档
│   ├── architecture/      # 架构文档
│   │   ├── base/         # 跨切面基础文档
│   │   └── overlays/     # PRD特定文档
│   └── adr/              # 架构决策记录
```

## 📝 如何新增 Overlay (PRD-ID)

### 1. 创建 Overlay 目录结构
```bash
# 在overlays下创建新的PRD目录
mkdir -p docs/architecture/overlays/PRD-<YOUR-PRODUCT-ID>/08
```

### 2. 创建功能纵切文档
```bash
# 创建功能模块文档
touch docs/architecture/overlays/PRD-<YOUR-PRODUCT-ID>/08/08-功能纵切-<模块名>.md
```

### 3. 文档模板示例
```markdown
---
PRD-ID: PRD-<YOUR-PRODUCT-ID>
Arch-Refs: [01, 02, 03, 08]
ADRs: [ADR-0001, ADR-0002]
Test-Refs: [tests/slices/<模块名>-acceptance.spec.ts]
Monitors: [sentry.error.rate, performance.response_time]
SLO-Refs: [SLO-PERF-001, SLO-AVAIL-001]
---

# 08-功能纵切-<模块名>

## UI层
...

## 事件层
...

## 域模型
...

## 持久化
...

## 验收标准
...
```

### 4. 创建对应测试文件
```bash
# 单元测试
touch tests/slices/<模块名>-unit.test.ts

# E2E验收测试  
touch tests/slices/<模块名>-acceptance.spec.ts
```

### 5. 更新合约文件
```bash
# 在共享合约目录添加类型定义
touch src/shared/contracts/<模块名>-types.ts
touch src/shared/contracts/<模块名>-events.ts
```

## 🧪 如何运行测试

### 单元测试 (Vitest)
```bash
# 运行所有单元测试
npm run test:unit

# 监听模式运行
npm run test:unit:watch

# 带UI界面运行
npm run test:unit:ui

# 生成覆盖率报告
npm run test:coverage
```

### E2E测试 (Playwright)
```bash
# 运行所有E2E测试
npm run test:e2e

# 运行安全相关E2E测试
npm run test:e2e:security

# Debug模式运行E2E测试
npx playwright test --debug
```

### 测试文件规范
- 单元测试文件: `*.test.ts` 或 `*.spec.ts`
- E2E测试文件: `tests/e2e/*.spec.ts`
- 测试覆盖率要求: 行覆盖率≥90%, 分支覆盖率≥85%

## 🔒 Electron 安全规范

### 主窗口安全配置
```typescript
// electron/main.ts 必须包含安全配置
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // 必须false
    contextIsolation: true,        // 必须true
    sandbox: true,                 // 必须true
    preload: path.join(__dirname, 'preload.js')
  }
});
```

### 预加载脚本规范
```typescript
// electron/preload.ts 使用contextBridge
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 只暴露白名单API
  openPath: (path: string) => ipcRenderer.invoke('open-path', path)
});
```

### CSP安全策略
```html
<!-- index.html 必须包含CSP -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

## 📋 代码规范

### TypeScript 规范
- 严格类型检查: `"strict": true`
- 公共类型定义放在 `src/shared/contracts/**`
- 禁止使用 `any`, 如需使用需添加TODO注释和回迁计划

### 样式规范
- 使用 Tailwind CSS v4
- 自定义样式放在 `src/styles/globals.css`
- 遵循原子化CSS原则

### 代码提交规范
```bash
# 提交前运行质量检查
npm run guard:ci

# Git提交信息格式
git commit -m "feat: 添加用户认证功能

详细描述变更内容和原因

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 📝 变更记录维护

### CHANGELOG.md 更新流程

#### 自动化更新 (推荐)
```bash
# 使用自动化脚本更新 CHANGELOG
node scripts/update-changelog.mjs --add "新增用户认证功能" --ai 85 --adr "0006"
node scripts/update-changelog.mjs --fix "修复内存泄漏问题" --ai 70 --adr "0007"
```

#### 手动更新流程
1. **开发过程中**: 在 `[Unreleased]` 部分记录变更
2. **版本发布前**: 将 `[Unreleased]` 内容移动到新版本号下
3. **变更分类**: 使用标准分类 Added/Changed/Deprecated/Removed/Fixed/Security

#### AI 协作标记规范
每个变更条目必须包含协作比例标记：

- **AI 主导 (AI:80%+)**: AI 生成代码/文档，人类轻度审核
  ```markdown
  - **[AI:90%] [Human:10%] [ADR-0002]** Electron 安全基线配置
  ```

- **协作均衡 (AI:40-60%)**: AI 辅助实现，人类深度参与设计
  ```markdown
  - **[AI:60%] [Human:40%] [ADR-0004]** 事件总线与契约系统
  ```

- **人类主导 (Human:70%+)**: 人类设计实现，AI 提供辅助建议
  ```markdown
  - **[AI:20%] [Human:80%] [ADR-0001]** 技术栈架构决策
  ```

#### 质量标记规范
变更条目应包含以下质量指标：

```markdown
- **[AI:75%] [Human:25%] [ADR-0005] [Coverage:92%] [RH: Sessions 99.8%, Users 99.7%] [Guard:✅]** 质量门禁体系实现
```

标记说明：
- **[Coverage:xx%]**: 测试覆盖率
- **[RH: Sessions xx%, Users xx%]**: Release Health 指标  
- **[Guard:✅/❌]**: 质量门禁通过状态
- **[ADR-xxxx]**: 关联的架构决策记录

### RELEASE_NOTES.md 更新流程

#### 面向用户的发布说明
RELEASE_NOTES.md 专注于用户价值和体验改进：

```markdown
### ✨ 新增功能
#### 🎮 游戏核心功能
- **游戏引擎**: 集成 Phaser 3，支持 2D 游戏开发
- **场景管理**: 提供场景切换和状态管理

### 🎯 性能指标
| 指标类型 | 目标值 | 实际表现 |
|---------|--------|----------|
| 🚀 启动时间 | < 3秒 | 2.1秒 |
```

#### 更新时机
- 每次版本发布时必须更新
- 重点关注用户可感知的变化
- 包含系统要求、安装说明、已知问题

### 版本发布工作流

#### 完整发布流程
```bash
# 1. 运行质量门禁检查
npm run guard:ci

# 2. 更新 CHANGELOG (自动化)
node scripts/update-changelog.mjs --add "新功能描述" --fix "修复描述"

# 3. 更新版本号
npm version patch  # 或 minor/major

# 4. 更新 RELEASE_NOTES.md (手动)
# 编辑用户面向的发布说明

# 5. 提交版本变更
git add CHANGELOG.md RELEASE_NOTES.md package.json
git commit -m "chore: release v0.1.0

📝 变更记录:
- 新增用户认证功能 [AI:85%] [Human:15%]
- 修复内存泄漏问题 [AI:70%] [Human:30%]

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# 6. 创建版本标签
git tag -a v0.1.0 -m "Release v0.1.0"
```

#### 集成到开发流程
在每次功能开发完成后：

```bash
# 开发完成后自动更新 CHANGELOG
npm run guard:ci && \
node scripts/update-changelog.mjs --add "功能描述" --ai 80 --adr "0008" && \
git add CHANGELOG.md && \
git commit -m "docs: update changelog for new feature"
```

### 变更记录最佳实践

#### 变更描述规范
- **具体明确**: 描述实际变化，不是抽象概念
- **面向影响**: 说明对用户/开发者的影响
- **技术准确**: 引用正确的 ADR 和覆盖率数据

#### 示例对比
❌ **不好的描述**:
```markdown
- **[AI:90%]** 优化了系统
```

✅ **好的描述**:
```markdown
- **[AI:85%] [Human:15%] [ADR-0003] [Coverage:94%]** 可观测性基础设施：Sentry Release Health 集成，支持 Crash-Free Sessions 监控和智能采样策略
```

#### ADR 关联规则
- **新功能**: 必须关联至少 1 个相关 ADR
- **架构变更**: 必须新增或更新 ADR，并在变更记录中标注 `Supersedes: ADR-xxxx`
- **安全变更**: 必须关联 ADR-0002 (Electron 安全基线)

### 脚本工具使用

#### update-changelog.mjs 参数说明
```bash
# 基本用法
node scripts/update-changelog.mjs [options]

# 参数说明
--add "描述"      # 添加新功能
--change "描述"   # 修改现有功能  
--fix "描述"      # 修复问题
--remove "描述"   # 移除功能
--security "描述" # 安全相关变更
--deprecate "描述" # 废弃功能

# 质量标记参数
--ai 80           # AI 贡献百分比 (默认70)
--adr "0001,0002" # 关联 ADR 编号
--guard-passed    # 质量门禁通过 (默认true)
```

#### 示例使用场景
```bash
# 新增功能
node scripts/update-changelog.mjs \
  --add "用户认证系统：支持 JWT Token 和权限管理" \
  --ai 75 \
  --adr "0006,0007"

# 修复问题
node scripts/update-changelog.mjs \
  --fix "修复游戏场景切换时的内存泄漏问题" \
  --ai 85 \
  --adr "0008"

# 多个变更
node scripts/update-changelog.mjs \
  --add "公会管理界面" \
  --fix "渲染性能优化" \
  --ai 70
```

### 与 CI/CD 集成

#### 自动化检查
质量门禁脚本会验证：
- CHANGELOG.md 格式正确性
- 变更条目包含必需的标记
- ADR 引用有效性
- 覆盖率数据完整性

#### 失败处理
如果变更记录检查失败：
```bash
# 检查 CHANGELOG 格式
node scripts/verify_changelog_format.mjs

# 修复常见问题
node scripts/update-changelog.mjs --validate --fix
```

## 🚪 质量门禁

### 本地门禁 (提交前必须通过)
1. **TypeScript类型检查**: `npm run typecheck`
2. **ESLint规范检查**: `npm run lint`  
3. **单元测试**: `npm run test:unit`
4. **Electron安全检查**: `npm run guard:electron`
5. **E2E测试**: `npm run test:e2e`
6. **覆盖率检查**: `npm run guard:quality`
7. **文档清洁检查**: `npm run guard:base`
8. **版本同步检查**: `npm run guard:version`

### CI门禁规则
- 所有检查必须通过才能合并PR
- 覆盖率阈值: 行≥90%, 分支≥85%, 函数≥90%, 语句≥90%
- Release Health: Crash-Free Sessions≥99.5%, Users≥99.0%

## 🐛 故障排查

### 常见问题

#### 1. TypeScript编译错误
```bash
# 检查类型错误
npm run typecheck

# 常见解决方案
- 检查import路径是否正确
- 确认类型定义文件存在
- 更新@types/相关包版本
```

#### 2. 测试失败
```bash
# 单独运行失败的测试
npx vitest run <test-file-pattern>

# E2E测试失败
npx playwright test --debug <test-file>
```

#### 3. Electron安全检查失败
```bash
# 查看详细安全报告
npm run guard:electron
cat logs/security/electron-security-scan-*.json
```

#### 4. 覆盖率不足
```bash
# 查看覆盖率报告
npm run test:coverage:open

# 查找未覆盖的代码
- 检查coverage/lcov-report/index.html
- 重点关注红色标记的未覆盖代码
```

## 📚 相关文档

- [架构文档](./architecture/base/) - 系统架构设计
- [ADR记录](./adr/) - 架构决策记录  
- [CLAUDE.md](../CLAUDE.md) - 项目开发规范
- [测试指南](./tests/README.md) - 详细测试说明

## 🤝 贡献流程

1. **Fork项目** → 创建功能分支
2. **开发** → 遵循代码规范和测试要求
3. **本地验证** → 运行 `npm run guard:ci`
4. **提交PR** → 填写完整的PR模板
5. **代码审查** → 地址审查意见
6. **合并** → 通过所有检查后合并

---

💡 **提示**: 如有疑问，请查看具体的脚本文件 `scripts/` 目录或联系项目维护者。