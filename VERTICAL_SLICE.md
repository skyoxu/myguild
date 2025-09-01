# 🚀 游戏竖切测试 (Vertical Slice)

## 概述

竖切测试是一个端到端验证系统，用于测试从 React UI 到 Phaser 游戏引擎、事件系统、数据持久化、可观测性上报的完整技术栈集成。

## 🎯 测试范围

### 技术栈验证

- ✅ **React 19** + **TypeScript** 用户界面
- ✅ **Phaser 3** WebGL 游戏引擎和 TestScene
- ✅ **CloudEvents** 契约和事件驱动架构
- ✅ **SQLite WAL** 数据持久化与备份系统
- ✅ **Sentry** 可观测性和错误追踪
- ✅ **Web Vitals** 性能监控
- ✅ **Playwright** E2E 测试准备

### 验证流程

```
用户交互 → React UI → Phaser TestScene →
精灵移动 → 触发完成事件 → CloudEvents发布 →
LevelResultService持久化 → SQLite存储 →
自动备份 → Sentry上报 → Web Vitals记录
```

## 🚦 快速开始

### 方式1: npm 脚本 (推荐)

```bash
# 开发模式 - 自动启动竖切测试
npm run vertical-slice

# Electron 环境测试 (完整功能)
npm run vertical-slice:electron

# 生产预览模式
npm run vertical-slice:preview

# 构建并测试
npm run vertical-slice:build
```

### 方式2: 手动导航

```bash
npm run dev
# 浏览器访问: http://localhost:5173
# 点击 "🚀 竖切测试" 按钮
```

### 方式3: URL 参数

```
http://localhost:5173?vertical-slice=auto
```

## 🎮 测试操作

### 游戏操作

1. **启动**: 点击 "开始测试" 按钮
2. **移动精灵**: 使用 `WASD` 或方向键移动蓝色圆形精灵
3. **目标**: 将精灵移动到右上角的绿色区域
4. **完成**: 自动触发关卡完成事件和数据保存
5. **查看结果**: 显示分数、移动次数、用时等统计

### 替代触发方式

- **鼠标点击**: 点击任意位置移动精灵
- **快捷键**: 按 `空格` 或 `回车` 手动触发完成
- **ESC退出**: 完成后按 `ESC` 立即返回

## 📊 数据验证

### 持久化验证

测试完成后检查以下数据：

1. **浏览器存储**:

```javascript
// 打开浏览器开发者工具 -> Application -> Local Storage
localStorage.getItem('level_results'); // 关卡结果历史
localStorage.getItem('lastVerticalSliceTest'); // 最新测试结果
```

2. **SQLite数据库** (Electron环境):

```bash
# 检查数据库文件 (如果有SQLite适配器)
# 位置通常在: app-data/databases/
```

3. **备份文件验证**:

```bash
# 检查备份是否创建
node scripts/db/backup.mjs --verify
```

### 可观测性验证

1. **Sentry上报**: 检查 Sentry 控制台是否收到事件
2. **Web Vitals**: 浏览器控制台显示性能指标
3. **事件日志**: 开发者控制台显示完整事件流

## 🏗️ 架构组件

### 核心文件

```
src/
├── components/GameVerticalSlice.tsx    # React集成组件
├── game/scenes/TestScene.ts           # Phaser测试场景
├── services/LevelResultService.ts     # 数据持久化服务
├── shared/contracts/events/GameEvents.ts # CloudEvents契约
└── App.tsx                           # 路由和导航

scripts/
├── run-vertical-slice.mjs            # 快速启动脚本
└── db/backup.mjs                     # SQLite备份系统
```

### 关键事件流

```typescript
// 1. 场景创建
{ type: 'game.scene.created', data: { sceneKey: 'TestScene' } }

// 2. 玩家移动
{ type: 'game.player.moved', data: { position: {x, y} } }

// 3. 关卡完成 (关键事件)
{ type: 'game.level.completed', data: { result: {...} } }

// 4. 数据持久化
{ type: 'data.persistence.completed', data: { testId: '...' } }
```

## 🧪 开发和调试

### 调试模式

开发环境下会显示调试面板，包含：

- 事件历史记录 (最近10个事件)
- 实时状态监控
- 错误信息追踪

### E2E 测试自动化

```bash
# 运行竖切 E2E 测试
npm run test:e2e:vertical-slice

# 调试模式运行
npm run test:e2e:vertical-slice:debug

# UI 模式运行
npm run test:e2e:vertical-slice:ui

# 构建后测试
npm run test:e2e:vertical-slice:build

# 查看测试报告
npm run test:e2e:report
```

### 自定义配置

```typescript
// 修改 GameVerticalSlice 组件 props
<GameVerticalSlice
  autoStart={true}           // 自动开始测试
  onComplete={handleResult}  // 完成回调
  onError={handleError}     // 错误处理
/>
```

### 服务配置

```typescript
// LevelResultService 配置
const levelService = new LevelResultService({
  enableBackup: true, // 启用自动备份
  backupInterval: 30000, // 备份间隔(毫秒)
  maxStoredResults: 1000, // 最大存储结果数
  enableCompression: true, // 启用数据压缩
});
```

## 📋 故障排除

### 常见问题

1. **游戏引擎初始化失败**

   ```
   错误: GameEngineAdapter initialization failed
   解决: 检查 Phaser 依赖和 WebGL 支持
   ```

2. **数据持久化失败**

   ```
   错误: Data persistence failed
   解决: 检查 localStorage 权限和存储空间
   ```

3. **事件未触发**

   ```
   错误: Level completion event not fired
   解决: 确认精灵到达目标区域或使用手动触发
   ```

4. **E2E 测试失败**

   ```
   错误: Playwright test timeout
   解决: 检查 Electron 构建是否完成 (npm run build)
   ```

5. **测试环境问题**
   ```
   错误: Application launch failed
   解决: 确保 dist-electron/main.js 存在
   ```

### 日志调试

```bash
# 启用详细日志
VITE_DEBUG_VERTICAL_SLICE=true npm run vertical-slice
```

### 重置测试数据

```javascript
// 浏览器控制台执行
localStorage.clear(); // 清除所有测试数据
location.reload(); // 重新加载应用
```

## 🚀 部署和CI

### CI集成

```bash
# 添加到 GitHub Actions
npm run vertical-slice:build  # 构建并验证
npm run test:e2e              # E2E测试 (包含竖切)
```

### 生产部署验证

```bash
# 预览生产版本
npm run build
npm run vertical-slice:preview
```

### Docker支持

```dockerfile
# 在容器中运行竖切测试
RUN npm run vertical-slice:build
RUN npm run test:e2e:vertical-slice
```

## 📈 性能基准

### 预期指标

- **初始化时间**: < 2秒
- **事件响应**: < 100ms
- **数据保存**: < 500ms
- **内存使用**: < 50MB
- **首次绘制**: < 1秒

### 监控集成

- Sentry 性能追踪
- Web Vitals 指标收集
- 自定义性能标记

## 🎯 分阶段发布演示

竖切测试包含完整的分阶段发布演示系统，展示从 5% → 25% → 50% → 100% 的渐进发布流程。

### 正常发布演示

```bash
# 演示完整的分阶段发布流程
npm run release:demo

# 手动控制发布阶段
npm run release:stage:5      # 设置为 5%
npm run release:stage:25     # 设置为 25%
npm run release:stage:50     # 设置为 50%
npm run release:stage:100    # 设置为 100%
```

### 失败回滚演示

```bash
# 演示健康监控失败时的自动回滚
npm run release:demo:failure
```

### 演示特性

- **渐进发布控制**: 自动从 5% 逐步提升到 100%
- **健康监控**: 模拟 Sentry Release Health 指标检查
- **自动回滚**: 健康指标低于阈值时触发紧急停止
- **完整回滚**: 支持版本回退和完整恢复
- **日志记录**: 所有操作记录到 `logs/rollback/` 目录

### 监控阈值

- **Crash-Free Sessions**: ≥ 90%
- **Crash-Free Users**: ≥ 92%
- **检查间隔**: 每阶段 2 秒监控周期

### 生成的文件

- `dist/latest.yml`: electron-updater 发布配置文件
- `dist/manifest.json`: 版本历史和回滚清单
- `logs/rollback/rollback-YYYY-MM-DD.json`: 详细回滚日志

## 🔄 未来扩展

### 计划功能

- [ ] 完整 SQLite 适配器集成
- [ ] 多场景测试支持
- [ ] 自动化性能回归测试
- [ ] 云端数据同步验证
- [ ] 错误恢复场景测试

### 扩展点

- 自定义测试场景
- 更多数据持久化策略
- 高级可观测性集成
- 性能压力测试

---

**📞 技术支持**: 检查控制台日志和错误信息  
**📖 更多文档**: 参考 `CLAUDE.md` 和 `docs/architecture/`
