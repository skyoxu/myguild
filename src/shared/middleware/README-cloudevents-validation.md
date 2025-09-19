# CloudEvents实时验证中间件使用指南

这个中间件提供了CloudEvents的实时验证能力，确保所有事件都符合CloudEvents 1.0规范。

## 基本使用

### 1. 单例模式使用

```typescript
import {
  cloudEventsValidator,
  validateEvent,
} from './cloudevents-validation.js';

// 基本验证
const event = {
  /* 你的事件对象 */
};
if (validateEvent(event)) {
  console.log('事件格式正确');
} else {
  console.log('事件格式错误');
}

// 获取验证统计
const stats = cloudEventsValidator.getStats();
console.log(
  `验证总数: ${stats.totalValidated}, 错误率: ${stats.errorRate * 100}%`
);
```

### 2. 配置验证器

```typescript
import { cloudEventsValidator } from './cloudevents-validation.js';

cloudEventsValidator.configure({
  strictMode: true, // 严格模式：验证失败时抛出异常
  enableLogging: true, // 启用日志记录
  maxErrorHistory: 200, // 保留最多200个错误记录
  enableMetrics: true, // 启用指标收集
});
```

## 集成方式

### 1. 事件总线集成

```typescript
import EventEmitter from 'events';
import { createEventBusValidator } from './cloudevents-validation.js';

const eventBus = new EventEmitter();
const validatedEventBus = createEventBusValidator(eventBus);

// 现在所有通过validatedEventBus发送的CloudEvents都会被验证
validatedEventBus.emit('cloudevent:game.started', {
  id: 'game-123',
  source: 'app://vitegame/game-engine',
  type: 'game.scene.loaded',
  specversion: '1.0',
  time: new Date().toISOString(),
  data: { sceneId: 'main-menu' },
});
```

### 2. Electron IPC集成

```typescript
// 主进程 (main.ts)
import { ipcMain } from 'electron';
import { createIPCValidationMiddleware } from './cloudevents-validation.js';

const ipcValidator = createIPCValidationMiddleware();
ipcValidator.mainProcess(ipcMain);

// 现在所有包含'cloudevents'的IPC通道都会自动验证

// 渲染进程
import { ipcRenderer } from 'electron';
const ipcValidator = createIPCValidationMiddleware();
ipcValidator.rendererProcess(ipcRenderer);
```

### 3. Express.js API集成

```typescript
import express from 'express';
import { cloudEventsValidator } from './cloudevents-validation.js';

const app = express();

// 使用CloudEvents验证中间件
app.use(cloudEventsValidator.expressMiddleware());

app.post('/webhook', (req, res) => {
  // req.body已经通过CloudEvents验证
  res.json({ received: true });
});
```

### 4. React组件集成

```typescript
import React from 'react';
import { useCloudEventsValidation } from './cloudevents-validation.js';

function CloudEventsMonitor() {
  const { stats, errors, validate, clearErrors } = useCloudEventsValidation();

  return (
    <div>
      <h3>CloudEvents验证状态</h3>
      <p>总验证数: {stats.totalValidated}</p>
      <p>错误数: {stats.totalErrors}</p>
      <p>错误率: {(stats.errorRate * 100).toFixed(2)}%</p>

      {errors.length > 0 && (
        <div>
          <h4>最近错误:</h4>
          {errors.map((error, index) => (
            <div key={index} style={{ color: 'red' }}>
              {error.timestamp}: {error.error}
            </div>
          ))}
          <button onClick={clearErrors}>清除错误</button>
        </div>
      )}
    </div>
  );
}
```

## 装饰器模式

### 方法级别验证

```typescript
import { CloudEventsValidator } from './cloudevents-validation.js';

class GameEventHandler {
  @(CloudEventsValidator.getInstance().validateEvent('GameEventHandler'))
  handleGameEvent(event: CloudEvent) {
    // 这个方法只会在event是有效的CloudEvent时执行
    console.log('处理游戏事件:', event);
  }
}
```

## 监控和错误处理

### 1. 错误监听

```typescript
import { cloudEventsValidator } from './cloudevents-validation.js';

// 监听验证错误
const unsubscribe = cloudEventsValidator.onError(error => {
  console.error('CloudEvents验证错误:', error);

  // 发送到监控系统
  sendToMonitoring({
    type: 'cloudevents_validation_error',
    error: error.error,
    context: error.context,
    timestamp: error.timestamp,
  });
});

// 取消监听
unsubscribe();
```

### 2. 实时监控

```typescript
import { cloudEventsValidator } from './cloudevents-validation.js';

// 启动实时监控
const stopMonitoring = cloudEventsValidator.startMonitoring({
  intervalMs: 30000, // 30秒检查一次
  logStats: true, // 记录统计信息
  alertThreshold: 0.05, // 5%错误率阈值
});

// 停止监控
stopMonitoring();
```

### 3. 生成验证报告

```typescript
import { cloudEventsValidator } from './cloudevents-validation.js';

const report = cloudEventsValidator.generateReport();
console.log('验证报告:', {
  stats: report.stats,
  recentErrors: report.recentErrors,
  recommendations: report.recommendations,
});
```

## 批量验证

```typescript
import { validateEvents } from './cloudevents-validation.js';

const events = [
  {
    /* 事件1 */
  },
  {
    /* 事件2 */
  },
  {
    /* 事件3 */
  },
];

const { valid, invalid } = validateEvents(events, 'batch-process');

console.log(`有效事件: ${valid.length}, 无效事件: ${invalid.length}`);
invalid.forEach(item => {
  console.error(`事件 ${item.index} 验证失败: ${item.error}`);
});
```

## 性能考虑

1. **验证缓存**: 对于相同结构的事件，验证器会复用验证逻辑
2. **异步验证**: 可以使用Worker线程进行大批量验证
3. **错误采样**: 在高频场景下可以启用错误采样来减少日志量

```typescript
// 异步批量验证示例
async function validateLargeEventBatch(events: unknown[]) {
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    const result = await new Promise(resolve => {
      setTimeout(() => {
        resolve(validateEvents(chunk, `chunk-${i / chunkSize}`));
      }, 0);
    });
    results.push(result);
  }

  return results;
}
```

## 最佳实践

1. **配置建议**:
   - 开发环境使用`strictMode: false`以便调试
   - 生产环境使用`strictMode: true`确保数据质量
   - 启用`enableLogging`帮助排查问题

2. **集成时机**:
   - 在事件产生的源头集成验证
   - 在关键的事件处理点集成验证
   - 在跨进程通信边界集成验证

3. **错误处理**:
   - 及时清理错误历史避免内存泄漏
   - 建立错误报警机制
   - 定期分析错误模式优化事件格式

4. **性能优化**:
   - 合理设置`maxErrorHistory`大小
   - 在高频场景下考虑使用采样验证
   - 监控验证器本身的性能影响
