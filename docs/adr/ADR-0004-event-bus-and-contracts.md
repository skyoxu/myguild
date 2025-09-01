---
ADR-ID: ADR-0004
title: 事件总线与契约 - CloudEvents 1.0 + IPC通信
status: Accepted
decision-time: '2025-08-17'
deciders: [架构团队, 开发团队]
archRefs: [CH03, CH04, CH05, CH06]
verification:
  - path: src/shared/contracts/events/builder.ts
    assert: CloudEvent includes specversion, id, source, type, time
  - path: tests/unit/contracts/events.spec.ts
    assert: Reject events missing required CloudEvents attributes
  - path: tests/unit/contracts/naming.spec.ts
    assert: Event type naming follows project convention
impact-scope: [src/shared/contracts/events.ts, src/core/events/, electron/ipc/]
tech-tags: [cloudevents, ipc, eventbus, contracts, communication]
depends-on: [ADR-0002]
depended-by: [ADR-0005, ADR-0007]
test-coverage: tests/unit/contracts/events.spec.ts
monitoring-metrics: [event_throughput, ipc_latency, contract_violations]
executable-deliverables:
  - src/shared/contracts/events.ts
  - src/core/events/bus.ts
  - tests/unit/contracts/events.spec.ts
supersedes: []
---

# ADR-0004: 事件总线与契约（CloudEvents 1.0 + IPC）

## Context and Problem Statement

主进程/渲染进程/Worker进程/Phaser场景之间需要建立稳定、类型安全的事件通信契约。需要支持请求/响应、单播/发布订阅等多种通信模式，同时确保事件的可追踪性、版本兼容性和安全性。采用行业标准CloudEvents 1.0规范以提供统一的事件格式和互操作性。

## Decision Drivers

- 多进程架构需要可靠的事件通信机制
- 需要类型安全和编译时检查，避免运行时错误
- 需要支持事件版本化和向后兼容性
- 需要事件可追踪性和审计能力
- 需要符合行业标准（CloudEvents）以便集成和扩展
- 需要安全的IPC白名单机制，防止权限泄露

## Considered Options

- **CloudEvents 1.0 + TypeScript契约** (选择方案)
- **自定义事件格式 + JSON Schema**
- **Protobuf + gRPC (进程间通信成本高)**
- **EventEmitter原生方案 (类型安全不足)**
- **Redux/Zustand全局状态 (仅限渲染进程)**

## Decision Outcome

选择的方案：**CloudEvents 1.0 + TypeScript契约**

### CloudEvents 1.0核心字段规范

**必需字段（Required）**：

```typescript
interface CloudEvent {
  // 事件唯一标识符
  id: string; // 例: "order-123-created-20250817T10:30:00Z"

  // 事件源标识
  source: string; // 例: "game.player" | "game.inventory" | "system.auth"

  // 事件类型（遵循反向DNS）
  type: string; // 例: "com.buildgame.player.levelup"

  // CloudEvents规范版本
  specversion: '1.0';
}
```

**可选字段（Optional）**：

```typescript
interface CloudEventExtended extends CloudEvent {
  // 数据内容类型
  datacontenttype?: string; // 例: "application/json"

  // 数据架构URI
  dataschema?: string; // 例: "/schemas/player-levelup-v1.json"

  // 事件主题/分类
  subject?: string; // 例: "player/12345" | "inventory/slot/1"

  // 事件时间戳
  time?: string; // ISO 8601格式: "2025-08-17T10:30:00Z"

  // 事件数据载荷
  data?: any;

  // 扩展字段（以x-开头）
  'x-correlation-id'?: string; // 关联ID用于链路追踪
  'x-retry-count'?: number; // 重试次数
  'x-priority'?: 'low' | 'normal' | 'high' | 'critical';
}
```

### 事件命名规范与分类

**命名模式**: `<boundedContext>.<entity>.<action>`

**核心领域事件**：

```typescript
// 游戏核心事件
'game.player.created'; // 玩家创建
'game.player.levelup'; // 玩家升级
'game.inventory.item.added'; // 物品添加
'game.battle.started'; // 战斗开始
'game.scene.loaded'; // 场景加载完成

// 系统事件
'system.app.started'; // 应用启动
'system.window.minimized'; // 窗口最小化
'system.error.occurred'; // 错误发生
'system.auth.login.success'; // 登录成功

// IPC通信事件
'ipc.file.read.request'; // 文件读取请求
'ipc.file.read.response'; // 文件读取响应
'ipc.window.control.request'; // 窗口控制请求
```

### 类型安全契约管理

**事件DTO统一管理**：

```typescript
// src/shared/contracts/events/player-events.ts
export interface PlayerLevelUpEvent extends CloudEventExtended {
  type: 'com.buildgame.player.levelup';
  source: 'game.player';
  data: {
    playerId: string;
    previousLevel: number;
    newLevel: number;
    gainedExp: number;
    unlockedSkills: string[];
    timestamp: number;
  };
  subject: `player/${string}`;
}

// src/shared/contracts/events/ipc-events.ts
export interface FileReadRequestEvent extends CloudEventExtended {
  type: 'com.buildgame.ipc.file.read.request';
  source: 'renderer' | 'main';
  data: {
    filePath: string;
    encoding?: BufferEncoding;
    requestId: string;
  };
}

export interface FileReadResponseEvent extends CloudEventExtended {
  type: 'com.buildgame.ipc.file.read.response';
  source: 'main';
  data: {
    requestId: string;
    success: boolean;
    content?: string;
    error?: string;
  };
}
```

**事件总线实现**：

```typescript
// src/shared/eventbus/cloud-event-bus.ts
import { CloudEventExtended } from '../contracts/events/base';

export class CloudEventBus {
  private handlers = new Map<string, Function[]>();
  private middleware: Array<
    (event: CloudEventExtended) => Promise<CloudEventExtended>
  > = [];

  // 发布事件
  async publish(event: CloudEventExtended): Promise<void> {
    // 验证CloudEvents格式
    this.validateCloudEvent(event);

    // 应用中间件（日志、追踪等）
    const processedEvent = await this.applyMiddleware(event);

    // 分发到处理器
    const handlers = this.handlers.get(processedEvent.type) || [];
    await Promise.all(handlers.map(handler => handler(processedEvent)));
  }

  // 订阅事件
  subscribe<T extends CloudEventExtended>(
    eventType: T['type'],
    handler: (event: T) => Promise<void>
  ): () => void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);

    // 返回取消订阅函数
    return () => {
      const currentHandlers = this.handlers.get(eventType) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
      }
    };
  }

  private validateCloudEvent(event: CloudEventExtended): void {
    if (
      !event.id ||
      !event.source ||
      !event.type ||
      event.specversion !== '1.0'
    ) {
      throw new Error(`Invalid CloudEvent format: ${JSON.stringify(event)}`);
    }
  }
}
```

### IPC安全白名单机制

**主进程IPC处理器**：

```typescript
// electron/ipc/secure-ipc-handler.ts
import { ipcMain } from 'electron';
import { CloudEventExtended } from '../shared/contracts/events/base';

// IPC白名单定义
const IPC_WHITELIST = {
  'file:read': {
    maxPayloadSize: 1024 * 1024, // 1MB
    rateLimitPerMin: 60,
    requireAuth: false,
  },
  'file:write': {
    maxPayloadSize: 10 * 1024 * 1024, // 10MB
    rateLimitPerMin: 30,
    requireAuth: true,
  },
  'window:control': {
    maxPayloadSize: 1024,
    rateLimitPerMin: 100,
    requireAuth: false,
  },
} as const;

export class SecureIPCHandler {
  private rateLimitMap = new Map<string, number[]>();

  setupIPCHandlers(): void {
    // 安全的文件读取
    ipcMain.handle(
      'file:read',
      async (event, cloudEvent: CloudEventExtended) => {
        this.validateIPCCall('file:read', cloudEvent);

        const response: FileReadResponseEvent = {
          id: `file-read-response-${Date.now()}`,
          source: 'main',
          type: 'com.buildgame.ipc.file.read.response',
          specversion: '1.0',
          time: new Date().toISOString(),
          data: {
            requestId: cloudEvent.data.requestId,
            success: true,
            content: await this.secureFileRead(cloudEvent.data.filePath),
          },
        };

        return response;
      }
    );
  }

  private validateIPCCall(channel: string, event: CloudEventExtended): void {
    const config = IPC_WHITELIST[channel];
    if (!config) {
      throw new Error(`IPC channel '${channel}' not in whitelist`);
    }

    // 验证载荷大小
    const payloadSize = JSON.stringify(event).length;
    if (payloadSize > config.maxPayloadSize) {
      throw new Error(
        `Payload too large: ${payloadSize} > ${config.maxPayloadSize}`
      );
    }

    // 速率限制
    this.checkRateLimit(channel, config.rateLimitPerMin);

    // CloudEvents格式验证
    if (
      !event.id ||
      !event.source ||
      !event.type ||
      event.specversion !== '1.0'
    ) {
      throw new Error(`Invalid CloudEvent format for IPC channel '${channel}'`);
    }
  }

  private checkRateLimit(channel: string, limit: number): void {
    const now = Date.now();
    const windowStart = now - 60000; // 1分钟窗口

    const calls = this.rateLimitMap.get(channel) || [];
    const validCalls = calls.filter(time => time > windowStart);

    if (validCalls.length >= limit) {
      throw new Error(
        `Rate limit exceeded for channel '${channel}': ${validCalls.length}/${limit} per minute`
      );
    }

    validCalls.push(now);
    this.rateLimitMap.set(channel, validCalls);
  }
}
```

### 事件版本化策略

**版本兼容性处理**：

```typescript
// src/shared/contracts/events/versioning.ts
export interface EventMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (oldEvent: any) => CloudEventExtended;
}

export class EventMigrator {
  private migrations: EventMigration[] = [];

  registerMigration(migration: EventMigration): void {
    this.migrations.push(migration);
  }

  // 自动迁移旧版本事件
  migrate(event: any, targetVersion: string): CloudEventExtended {
    let currentEvent = event;
    let currentVersion = this.extractVersion(event);

    while (currentVersion !== targetVersion) {
      const migration = this.migrations.find(
        m =>
          m.fromVersion === currentVersion &&
          this.isVersionNewer(m.toVersion, currentVersion)
      );

      if (!migration) {
        throw new Error(
          `No migration path from ${currentVersion} to ${targetVersion}`
        );
      }

      currentEvent = migration.migrate(currentEvent);
      currentVersion = migration.toVersion;
    }

    return currentEvent;
  }

  private extractVersion(event: any): string {
    // 从事件类型中提取版本: "com.buildgame.player.levelup.v2"
    const match = event.type?.match(/\.v(\d+)$/);
    return match ? `v${match[1]}` : 'v1';
  }
}

// 版本迁移示例
const playerLevelUpV1ToV2: EventMigration = {
  fromVersion: 'v1',
  toVersion: 'v2',
  migrate: oldEvent => ({
    ...oldEvent,
    type: oldEvent.type.replace('.v1', '.v2'),
    data: {
      ...oldEvent.data,
      // v2新增字段
      achievementUnlocked: [],
      // v2字段重命名
      experienceGained: oldEvent.data.gainedExp,
    },
  }),
};
```

### Positive Consequences

- 统一的事件格式规范，符合CloudEvents行业标准
- 强类型安全，编译时检查事件契约
- 易于测试和审计，事件结构清晰可预测
- 支持事件版本化和向后兼容性
- IPC安全白名单机制，防止权限泄露
- 事件可追踪性，支持链路追踪和调试
- 良好的扩展性，便于集成外部系统

### Negative Consequences

- 初期事件契约定义成本较高
- CloudEvents规范学习曲线
- 事件版本迁移需要额外维护工作
- JSON序列化性能开销（相比二进制格式）
- 复杂的中间件和验证逻辑
- 需要严格的事件设计纪律

## Verification

- **测试验证**: tests/unit/events/cloudevents.spec.ts, tests/e2e/ipc-communication.spec.ts
- **门禁脚本**: scripts/validate_event_contracts.mjs, scripts/check_ipc_whitelist.mjs
- **监控指标**: events.published_count, events.failed_count, ipc.rate_limit_hits, events.migration_count
- **契约验证**: 所有事件DTO必须通过TypeScript编译和JSON Schema验证

### 事件契约验证清单

- [ ] CloudEvents 1.0必需字段验证 (id, source, type, specversion)
- [ ] 事件类型命名规范检查 (`<boundedContext>.<entity>.<action>`)
- [ ] 事件DTO类型导出到 `src/shared/contracts/events/**`
- [ ] IPC白名单机制启用和速率限制配置
- [ ] 事件版本化策略实施和迁移测试
- [ ] 事件序列化/反序列化性能测试
- [ ] 跨进程通信安全验证

## Operational Playbook

### 升级步骤

1. **CloudEvents规范**: 实施CloudEvents 1.0标准事件格式
2. **契约定义**: 在`src/shared/contracts/events/`定义所有事件DTO
3. **事件总线**: 部署支持CloudEvents的事件总线系统
4. **IPC安全**: 配置IPC白名单和安全验证机制
5. **版本迁移**: 建立事件版本化和迁移策略
6. **监控集成**: 集成事件监控和追踪系统

### 回滚步骤

1. **事件格式**: 如遇兼容性问题，可临时支持旧事件格式
2. **白名单放松**: 临时扩大IPC白名单范围解决阻塞问题
3. **版本回退**: 回滚到支持的稳定事件版本
4. **监控调整**: 调整事件监控阈值避免误报
5. **契约修复**: 修复有问题的事件契约定义

### 迁移指南

- **现有事件**: 逐步迁移现有事件到CloudEvents格式
- **IPC适配**: 现有IPC调用需要适配新的安全白名单机制
- **类型导入**: 所有模块统一从`src/shared/contracts/`导入事件类型
- **测试更新**: 更新所有事件相关的单元测试和集成测试
- **文档同步**: 更新事件驱动架构文档和API说明

## References

- **CH章节关联**: CH04, CH05
- **相关ADR**: ADR-0002-electron-security, ADR-0005-quality-gates
- **外部文档**:
  - [CloudEvents 1.0 Specification](https://cloudevents.io/spec/v1.0/)
  - [Electron IPC Security](https://www.electronjs.org/docs/tutorial/security#isolate-contexts)
  - [Event-Driven Architecture Patterns](https://microservices.io/patterns/data/event-driven-architecture.html)
- **标准规范**: CloudEvents 1.0, JSON Schema Draft 2020-12
- **相关PRD-ID**: 适用于所有需要事件通信的PRD模块
