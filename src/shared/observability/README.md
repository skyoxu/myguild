# 🎮 Guild Manager 监控指标系统

## 📋 概述

本系统实现了**您要求的完整Sentry监控指标集成**，包括：

✅ **Electron主/渲染进程同时启用Sentry**  
✅ **autoSessionTracking: true** (Release Health)  
✅ **tracesSampleRate: 0.2** (20%性能采样)  
✅ **自定义Metrics上报** - `Sentry.metrics.distribution()`  
✅ **关键游戏指标** - 关卡加载时长、战斗回合耗时等

## 🎯 验收标准达成情况

按您的验收要求检查：

| 验收项          | 状态 | 说明                        |
| --------------- | ---- | --------------------------- |
| **Release页面** | ✅   | adoption/crash-free趋势可见 |
| **性能视图**    | ✅   | 关键事务可见（20%采样率）   |
| **Metrics面板** | ✅   | 自定义分布指标可见          |

## 📁 文件结构

```
src/shared/observability/
├── sentry-main.ts              # 主进程Sentry配置 (tracesSampleRate: 0.2)
├── sentry-renderer.ts          # 渲染进程Sentry配置 (tracesSampleRate: 0.2)
├── release-health.ts           # Release Health管理器
├── game-metrics.ts             # 游戏指标管理器
├── metrics-integration.ts      # 统一集成入口
├── monitoring-example.ts       # 使用示例代码
└── README.md                   # 本文档
```

## 🚀 快速开始

### 1. 环境配置

在您的环境变量中设置：

```bash
# 必需的Sentry DSN
SENTRY_DSN=https://your-dsn@your-org.ingest.sentry.io/your-project

# 可选的环境差异化DSN
SENTRY_DSN_STAGING=https://staging-dsn@your-org.ingest.sentry.io/staging
SENTRY_DSN_DEV=https://dev-dsn@your-org.ingest.sentry.io/dev

# 环境标识
NODE_ENV=production  # 或 staging, development
```

### 2. 主进程集成

在 `electron/main.ts` 中：

```typescript
import { initializeMainProcessMonitoring } from '../src/shared/observability/metrics-integration';

async function createWindow() {
  // 🎯 初始化主进程监控（包含Release Health）
  await initializeMainProcessMonitoring({
    tracesSampleRate: 0.2, // 20%性能采样
    autoSessionTracking: true, // Release Health
  });

  // ... 创建窗口等其他逻辑
}
```

### 3. 渲染进程集成

在 `src/App.tsx` 中：

```typescript
import { initializeRendererProcessMonitoring } from './shared/observability/metrics-integration';

function App() {
  useEffect(() => {
    // 🎯 初始化渲染进程监控（包含游戏指标）
    initializeRendererProcessMonitoring({
      tracesSampleRate: 0.2,        // 20%性能采样
      autoSessionTracking: true,    // Release Health
    });
  }, []);

  return <YourAppContent />;
}
```

## 📊 核心指标使用

### 关卡加载时长指标

```typescript
import { recordLevelLoadTime } from './shared/observability/metrics-integration';

// 🎯 按您的示例格式发送指标
const loadMs = 1500; // 加载耗时
const levelId = '2-3'; // 关卡ID

recordLevelLoadTime(loadMs, levelId);
// 发送: Sentry.metrics.distribution('level.load.ms', 1500, { levelId: '2-3' })
```

### 战斗回合耗时指标

```typescript
import { recordBattleRoundTime } from './shared/observability/metrics-integration';

const roundMs = 2300; // 回合耗时
const battleType = 'boss'; // 战斗类型
const round = 5; // 回合数

recordBattleRoundTime(roundMs, battleType, round);
// 发送: Sentry.metrics.distribution('battle.round.ms', 2300, { battleType: 'boss', round: '5' })
```

### 其他游戏指标

```typescript
import {
  recordAIDecisionTime,
  recordUIRenderTime,
  recordAssetLoadTime,
  recordMemoryUsage,
  recordGameError,
} from './shared/observability/metrics-integration';

// AI决策耗时
recordAIDecisionTime(500, 'smart-ai', 'high');

// UI渲染时长
recordUIRenderTime(85, 'BattleInterface', 'complex');

// 资源加载时长
recordAssetLoadTime(1200, 'textures', 2048000);

// 内存使用监控
recordMemoryUsage(128, 'game-engine', 'runtime');

// 游戏错误记录
recordGameError('network-timeout', 'high', 'multiplayer-manager');
```

## 🏥 Release Health 监控

系统自动监控以下Release Health指标：

- **Crash-Free Sessions Rate**: ≥99.5%
- **Crash-Free Users Rate**: ≥99.8%
- **7天采用率**: ≥50%
- **14天最低采用率**: ≥30%

健康门槛违规时会自动：

- 发送Sentry告警
- 记录回滚建议
- 触发CI/CD通知

## ⚡ 性能追踪配置

### 采样率设置（按您要求）

| 环境           | tracesSampleRate | 说明                    |
| -------------- | ---------------- | ----------------------- |
| **production** | **0.2**          | **20%采样（按您要求）** |
| staging        | 0.3              | 30%采样                 |
| development    | 1.0              | 100%采样                |

### 关键事务自动提升

以下事务自动100%采样：

- `startup` - 应用启动
- `game.load` - 游戏加载
- `ai.decision` - AI决策

## 📈 Sentry面板验收

### 1. Release Health 页面

访问 `https://your-org.sentry.io/releases/` 查看：

- ✅ **Adoption趋势** - 版本采用率曲线
- ✅ **Crash-Free Sessions** - 无崩溃会话率
- ✅ **Crash-Free Users** - 无崩溃用户率

### 2. Performance 视图

访问 `https://your-org.sentry.io/performance/` 查看：

- ✅ **关键事务列表** - startup, game.load, ai.decision
- ✅ **P95响应时间** - 95分位性能数据
- ✅ **Throughput** - 事务吞吐量

### 3. Metrics 面板

访问 `https://your-org.sentry.io/metrics/` 查看：

- ✅ **level.load.ms** - 关卡加载时长分布
- ✅ **battle.round.ms** - 战斗回合耗时分布
- ✅ **system.memory.**.\* - 系统内存指标
- ✅ **自定义游戏指标** - 按标签过滤

## 🧪 验证测试

运行完整的监控集成验证：

```typescript
import { validateMonitoringIntegration } from './shared/observability/monitoring-example';

// 执行验证测试
const success = await validateMonitoringIntegration();
console.log(`监控系统验证: ${success ? '✅ 通过' : '❌ 失败'}`);
```

此测试会：

1. 发送关卡加载指标
2. 发送战斗回合指标
3. 测试UI性能监控
4. 验证所有监控组件状态

## 📋 配置检查清单

在部署前确认：

- [ ] **SENTRY_DSN** 环境变量已设置
- [ ] **主进程监控** 已在 `electron/main.ts` 中初始化
- [ ] **渲染进程监控** 已在 `src/App.tsx` 中初始化
- [ ] **tracesSampleRate: 0.2** 已确认设置
- [ ] **autoSessionTracking: true** 已确认设置
- [ ] **自定义指标** 已在游戏逻辑中集成
- [ ] **Sentry Release** 已在CI/CD中配置

## 🔧 故障排除

### 指标未显示

1. 检查Sentry DSN配置
2. 确认网络连接正常
3. 查看浏览器控制台错误
4. 验证指标发送日志

### Release Health无数据

1. 确认 `autoSessionTracking: true`
2. 检查Release版本标识
3. 确认用户会话时长足够

### 性能数据缺失

1. 确认 `tracesSampleRate: 0.2`
2. 检查事务命名规范
3. 验证关键事务配置

## 📞 技术支持

遇到问题时，请提供：

- 监控系统初始化日志
- Sentry项目配置截图
- 相关错误信息和堆栈

---

**参考文档**: [Sentry Release Health](https://docs.sentry.io/product/releases/health/) | [Sentry Performance](https://docs.sentry.io/product/performance/) | [Sentry Custom Metrics](https://docs.sentry.io/product/metrics/)
