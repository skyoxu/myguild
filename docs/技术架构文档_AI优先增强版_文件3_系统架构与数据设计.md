# 技术架构文档*AI优先增强版*文件3\_系统架构与数据设计

## 第4章：系统上下文与C4+事件流（融合API架构系列）

> **核心理念**: 严格遵循C4模型Context→Container→Component标准序列，基于事件驱动架构构建松耦合、高内聚的系统边界，固化IPC/事件总线契约，为后续垂直切片实现提供稳固基础

> **ChatGPT5优化**: 标准化C4架构图设计顺序，固化跨容器通信契约，确保AI代码生成的架构一致性

### 4.1 系统上下文图（C4模型Level 1）

#### 4.1.1 核心系统边界

```typescript
// 系统上下文定义
interface SystemContext {
  name: 'GuildManager';
  boundary: {
    internal: {
      gameCore: 'Phaser3游戏引擎';
      uiLayer: 'React19界面层';
      dataLayer: 'SQLite存储层';
      aiEngine: 'WebWorker AI计算';
    };
    external: {
      electronRuntime: 'Electron桌面容器';
      operatingSystem: 'Windows/macOS/Linux';
      networkServices: '可选网络服务';
    };
    communication: {
      inbound: ['用户交互', '系统事件', '定时任务'];
      outbound: ['界面更新', '数据持久化', '系统通知'];
    };
  };
}
```

#### 4.1.2 利益相关者映射

```typescript
// 利益相关者系统
interface StakeholderMap {
  primaryUsers: {
    guildManager: '公会管理员';
    guildMember: '普通成员';
    npcCharacter: 'AI控制的NPC';
  };
  externalSystems: {
    electronMain: '主进程（文件系统、窗口管理）';
    operatingSystem: '操作系统服务';
    hardwareLayer: '硬件抽象层';
  };
  supportingSystems: {
    loggingService: '日志收集服务';
    configService: '配置管理服务';
    securityService: '安全基线服务';
  };
}
```

### 4.2 容器图（C4模型Level 2）

#### 4.2.1 应用容器架构

```typescript
// 应用容器定义
interface ApplicationContainers {
  // 主渲染进程容器
  mainRenderer: {
    technology: 'Electron Renderer + React 19';
    responsibilities: ['用户界面渲染', '用户交互处理', '状态管理', '事件协调'];
    communicationPorts: {
      uiEvents: 'DOM事件 → React组件';
      gameEvents: 'Phaser场景 → React状态';
      dataEvents: 'SQLite查询 → React组件';
    };
  };

  // 游戏引擎容器
  gameEngine: {
    technology: 'Phaser 3 + Canvas API';
    responsibilities: [
      '游戏场景渲染',
      '动画与特效',
      '用户输入响应',
      '游戏循环管理',
    ];
    communicationPorts: {
      renderLoop: 'requestAnimationFrame';
      inputHandler: 'Keyboard/Mouse事件';
      gameState: '与React状态同步';
    };
  };

  // AI计算容器
  aiWorker: {
    technology: 'Web Worker + TypeScript';
    responsibilities: ['NPC决策计算', '战术分析', '市场预测', '行为模式学习'];
    communicationPorts: {
      workerMessages: 'postMessage/onMessage';
      computeRequests: '主线程 → Worker';
      resultCallbacks: 'Worker → 主线程';
    };
  };

  // 数据存储容器
  dataStore: {
    technology: 'SQLite + 文件系统';
    responsibilities: [
      '游戏数据持久化',
      '配置文件管理',
      '日志文件存储',
      '缓存数据管理',
    ];
    communicationPorts: {
      sqlInterface: 'SQL查询接口';
      fileSystem: 'Node.js fs API';
      cacheLayer: '内存缓存层';
    };
  };
}
```

#### 4.2.2 容器间通信协议（固化IPC契约）

> **契约固化目标**: 为垂直切片实现提供标准化的跨容器通信契约，确保所有AI生成代码遵循统一的IPC接口规范

```typescript
// 容器通信协议 - 固化版本 v1.0
interface ContainerCommunicationProtocol {
  // React ↔ Phaser通信协议
  reactPhaserBridge: {
    gameToUI: {
      events: ['game:state:update', 'game:scene:change', 'game:error'];
      dataFormat: '{ type: string, payload: any, timestamp: number }';
      transport: 'CustomEvent + EventTarget';
    };
    uiToGame: {
      events: ['ui:action:guild', 'ui:action:combat', 'ui:config:update'];
      dataFormat: '{ action: string, params: any, requestId: string }';
      transport: '直接方法调用 + Promise';
    };
  };

  // 主线程 ↔ Worker通信协议
  mainWorkerBridge: {
    computeRequests: {
      aiDecision: "{ type: 'AI_DECISION', npcId: string, context: GameContext }";
      strategyAnalysis: "{ type: 'STRATEGY_ANALYSIS', battleData: BattleData }";
      marketPrediction: "{ type: 'MARKET_PREDICTION', economyState: EconomyState }";
    };
    responses: {
      format: '{ requestId: string, result: any, error?: Error }';
      timeout: '30秒超时机制';
      fallback: '超时返回默认值';
    };
  };

  // 应用 ↔ 数据存储通信协议
  dataAccessProtocol: {
    queryInterface: {
      sync: 'SQLite同步查询（启动时）';
      async: 'SQLite异步查询（运行时）';
      batch: '批量操作接口';
      transaction: '事务保证机制';
    };
    cachingStrategy: {
      l1Cache: '组件级内存缓存';
      l2Cache: '应用级Redux状态';
      l3Cache: 'SQLite内存模式';
      invalidation: '基于事件的缓存失效';
    };
  };
}
```

#### 4.2.3 IPC契约固化规范（垂直切片基础）

> **固化原则**: 建立不可变的跨容器通信契约，任何AI代码生成都必须严格遵循以下IPC接口标准

```typescript
// IPC契约固化规范 - 版本化管理
namespace IPCContractStandards {
  // 契约版本控制
  export const CONTRACT_VERSION = '1.0.0';
  export const COMPATIBILITY_MATRIX = {
    '1.0.x': ['MainRenderer', 'GameEngine', 'AIWorker', 'DataStore'],
    breaking_changes: '主版本号变更时需要全容器升级',
  };

  // 标准化消息格式
  export interface StandardIPCMessage<T = any> {
    readonly contractVersion: string; // 契约版本
    readonly messageId: string; // 消息唯一ID
    readonly timestamp: number; // 时间戳
    readonly source: ContainerType; // 源容器
    readonly target: ContainerType; // 目标容器
    readonly type: string; // 消息类型
    readonly payload: T; // 消息载荷
    readonly timeout?: number; // 超时设置（可选）
    readonly requiresAck?: boolean; // 是否需要确认（可选）
  }

  // 容器类型枚举（固化）
  export enum ContainerType {
    MAIN_RENDERER = 'main-renderer',
    GAME_ENGINE = 'game-engine',
    AI_WORKER = 'ai-worker',
    DATA_STORE = 'data-store',
  }

  // React ↔ Phaser IPC契约（固化）
  export namespace ReactPhaserContract {
    export const BRIDGE_NAME = 'react-phaser-bridge';

    // 游戏状态事件（固化）
    export interface GameStateUpdateMessage extends StandardIPCMessage {
      type: 'GAME_STATE_UPDATE';
      payload: {
        sceneId: string;
        gameState: GameState;
        deltaTime: number;
        fps: number;
      };
    }

    // UI命令事件（固化）
    export interface UICommandMessage extends StandardIPCMessage {
      type: 'UI_COMMAND';
      payload: {
        command: 'GUILD_ACTION' | 'COMBAT_ACTION' | 'CONFIG_UPDATE';
        params: Record<string, any>;
        requestId: string;
      };
    }

    // 错误处理契约（固化）
    export interface ErrorMessage extends StandardIPCMessage {
      type: 'GAME_ERROR';
      payload: {
        errorCode: string;
        errorMessage: string;
        stack?: string;
        context: Record<string, any>;
      };
    }
  }

  // 主线程 ↔ Worker IPC契约（固化）
  export namespace MainWorkerContract {
    export const BRIDGE_NAME = 'main-worker-bridge';

    // AI计算请求（固化）
    export interface AIComputeRequest extends StandardIPCMessage {
      type: 'AI_COMPUTE_REQUEST';
      payload: {
        computeType: 'DECISION' | 'STRATEGY' | 'PREDICTION';
        npcId?: string;
        context: AIContext;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
      };
    }

    // AI计算响应（固化）
    export interface AIComputeResponse extends StandardIPCMessage {
      type: 'AI_COMPUTE_RESPONSE';
      payload: {
        requestId: string;
        result: AIResult;
        computeTime: number;
        confidence: number;
        error?: string;
      };
    }
  }

  // 数据访问IPC契约（固化）
  export namespace DataAccessContract {
    export const BRIDGE_NAME = 'data-access-bridge';

    // 数据查询请求（固化）
    export interface DataQueryRequest extends StandardIPCMessage {
      type: 'DATA_QUERY';
      payload: {
        queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
        table: string;
        conditions?: Record<string, any>;
        data?: Record<string, any>;
        transaction?: boolean;
      };
    }

    // 数据响应（固化）
    export interface DataQueryResponse extends StandardIPCMessage {
      type: 'DATA_RESPONSE';
      payload: {
        requestId: string;
        data?: any[];
        rowsAffected?: number;
        error?: string;
        executionTime: number;
      };
    }
  }

  // 契约验证器（固化）
  export class IPCContractValidator {
    static validateMessage(message: any): message is StandardIPCMessage {
      return (
        typeof message === 'object' &&
        typeof message.contractVersion === 'string' &&
        typeof message.messageId === 'string' &&
        typeof message.timestamp === 'number' &&
        Object.values(ContainerType).includes(message.source) &&
        Object.values(ContainerType).includes(message.target) &&
        typeof message.type === 'string' &&
        message.payload !== undefined
      );
    }

    static enforceTimeout(message: StandardIPCMessage): number {
      return message.timeout || 30000; // 默认30秒超时
    }
  }
}
```

### 4.3 组件图（C4模型Level 3）

#### 4.3.1 事件系统组件设计（事件总线契约固化）

> **事件总线契约固化**: 建立标准化的事件总线契约，确保所有组件遵循统一的事件发布/订阅模式

```typescript
// 事件总线契约固化规范 v1.0
namespace EventBusContractStandards {
  // 事件契约版本
  export const EVENT_CONTRACT_VERSION = '1.0.0';

  // 标准事件格式（固化）
  export interface StandardGameEvent<T = any> {
    readonly contractVersion: string; // 事件契约版本
    readonly eventId: string; // 事件唯一ID
    readonly type: string; // 事件类型
    readonly source: string; // 事件源
    readonly timestamp: number; // 时间戳
    readonly payload: T; // 事件载荷
    readonly priority: EventPriority; // 事件优先级
    readonly ttl?: number; // 生存时间（可选）
  }

  // 事件优先级（固化）
  export enum EventPriority {
    CRITICAL = 0, // 关键事件（立即处理）
    HIGH = 1, // 高优先级（下一帧处理）
    MEDIUM = 2, // 中优先级（批量处理）
    LOW = 3, // 低优先级（空闲时处理）
  }

  // 事件类型命名空间（固化）
  export namespace EventTypes {
    export const GUILD = {
      CREATED: 'guild.created',
      MEMBER_JOINED: 'guild.member.joined',
      MEMBER_LEFT: 'guild.member.left',
      DISBANDED: 'guild.disbanded',
    } as const;

    export const COMBAT = {
      BATTLE_STARTED: 'combat.battle.started',
      BATTLE_ENDED: 'combat.battle.ended',
      FORMATION_CHANGED: 'combat.formation.changed',
      STRATEGY_UPDATED: 'combat.strategy.updated',
    } as const;

    export const ECONOMY = {
      BID_PLACED: 'auction.bid.placed',
      ITEM_SOLD: 'auction.item.sold',
      TRADE_COMPLETED: 'trade.completed',
      INFLATION_ALERT: 'economy.inflation.alert',
    } as const;

    export const SOCIAL = {
      MAIL_RECEIVED: 'mail.received',
      POST_CREATED: 'forum.post.created',
      CHAT_MESSAGE: 'chat.message.sent',
    } as const;
  }

  // 事件处理器契约（固化）
  export interface StandardEventHandler<T = any> {
    readonly handlerId: string;
    readonly eventType: string;
    readonly priority: EventPriority;
    handle(event: StandardGameEvent<T>): Promise<void> | void;
    canHandle(event: StandardGameEvent): boolean;
    onError?(error: Error, event: StandardGameEvent<T>): void;
  }

  // 事件总线接口（固化）
  export interface IStandardEventBus {
    // 核心方法
    publish<T>(event: StandardGameEvent<T>): Promise<void>;
    subscribe<T>(eventType: string, handler: StandardEventHandler<T>): string;
    unsubscribe(handlerId: string): void;

    // 批量操作
    publishBatch(events: StandardGameEvent[]): Promise<void>;

    // 事件查询
    getEventHistory(eventType: string, limit?: number): StandardGameEvent[];

    // 性能监控
    getMetrics(): EventBusMetrics;
  }

  // 事件总线性能指标（固化）
  export interface EventBusMetrics {
    eventsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    queueDepth: number;
    activeHandlers: number;
  }
}

// 事件系统核心组件
interface EventSystemComponents {
  // 事件池核心引擎
  eventPoolCore: {
    file: 'src/core/events/EventPoolCore.ts';
    responsibilities: [
      '事件注册与注销',
      '事件优先级排序',
      '批量事件分发',
      '性能监控',
    ];
    interfaces: {
      IEventEmitter: '事件发射器接口';
      IEventListener: '事件监听器接口';
      IEventPriority: '事件优先级接口';
      IEventFilter: '事件过滤器接口';
    };
    keyMethods: [
      'emit(event: GameEvent): Promise<void>',
      'on(type: string, listener: EventListener): void',
      'off(type: string, listener: EventListener): void',
      'batch(events: GameEvent[]): Promise<void>',
    ];
  };

  // 游戏事件类型定义
  gameEventTypes: {
    file: 'src/core/events/GameEvents.ts';
    eventCategories: {
      guild: {
        'guild.created': 'GuildCreatedEvent';
        'guild.member.joined': 'MemberJoinedEvent';
        'guild.member.left': 'MemberLeftEvent';
        'guild.disbanded': 'GuildDisbandedEvent';
      };
      combat: {
        'combat.battle.started': 'BattleStartedEvent';
        'combat.battle.ended': 'BattleEndedEvent';
        'combat.formation.changed': 'FormationChangedEvent';
        'combat.strategy.updated': 'StrategyUpdatedEvent';
      };
      economy: {
        'auction.bid.placed': 'BidPlacedEvent';
        'auction.item.sold': 'ItemSoldEvent';
        'trade.completed': 'TradeCompletedEvent';
        'economy.inflation.alert': 'InflationAlertEvent';
      };
      social: {
        'mail.received': 'MailReceivedEvent';
        'forum.post.created': 'PostCreatedEvent';
        'chat.message.sent': 'ChatMessageEvent';
      };
    };
  };

  // 事件分发器组件
  eventDispatcher: {
    file: 'src/core/events/EventDispatcher.ts';
    features: {
      nonBlocking: '非阻塞分发机制';
      errorHandling: '异常隔离与恢复';
      performanceOptimization: '60FPS性能保证';
      debugMode: '开发时事件追踪';
    };
    configuration: {
      batchSize: 100;
      tickInterval: '16ms (60FPS)';
      maxRetries: 3;
      timeoutMs: 1000;
    };
  };
}
```

#### 4.3.2 API架构系列组件

```typescript
// API架构核心组件设计
interface APIArchitectureComponents {
  // 公会管理API层
  guildAPI: {
    path: 'src/api/guild/';
    components: {
      'GuildService.ts': {
        methods: [
          'createGuild(config: GuildConfig): Promise<Guild>',
          'getGuildById(id: string): Promise<Guild | null>',
          'updateGuild(id: string, updates: Partial<Guild>): Promise<Guild>',
          'disbandGuild(id: string, reason: string): Promise<void>',
        ];
        events: ['guild.*'];
        dependencies: ['EventPool', 'DataIntegrity', 'Storage'];
      };
      'MembershipService.ts': {
        methods: [
          'addMember(guildId: string, memberId: string): Promise<void>',
          'removeMember(guildId: string, memberId: string): Promise<void>',
          'promoteMember(guildId: string, memberId: string, role: string): Promise<void>',
          'getMembersByGuild(guildId: string): Promise<GuildMember[]>',
        ];
        events: ['guild.member.*'];
        businessRules: ['最大成员数限制', '角色权限验证', '活跃度要求'];
      };
    };
  };

  // 战斗系统API层
  combatAPI: {
    path: 'src/api/combat/';
    components: {
      'CombatService.ts': {
        methods: [
          'initiateBattle(battleConfig: BattleConfig): Promise<Battle>',
          'submitFormation(battleId: string, formation: Formation): Promise<void>',
          'executeStrategy(battleId: string, strategy: Strategy): Promise<BattleResult>',
          'getBattleHistory(guildId: string): Promise<Battle[]>',
        ];
        events: ['combat.*'];
        aiIntegration: '与AI Worker通信进行战术分析';
      };
      'FormationService.ts': {
        methods: [
          'validateFormation(formation: Formation): ValidationResult',
          'optimizeFormation(members: Member[], objective: string): Formation',
          'getRecommendedFormations(enemy: EnemyInfo): Formation[]',
        ];
        algorithms: ['阵容有效性算法', 'AI推荐算法', '克制关系计算'];
      };
    };
  };

  // 经济系统API层
  economyAPI: {
    path: 'src/api/economy/';
    components: {
      'AuctionService.ts': {
        methods: [
          'listItem(item: Item, startingBid: number, duration: number): Promise<Auction>',
          'placeBid(auctionId: string, bidAmount: number, bidderId: string): Promise<void>',
          'closeAuction(auctionId: string): Promise<AuctionResult>',
          'getActiveAuctions(): Promise<Auction[]>',
        ];
        events: ['auction.*'];
        businessRules: ['最低竞价增幅', '拍卖时间限制', '反作弊机制'];
      };
      'TradeService.ts': {
        methods: [
          'createTradeOffer(offer: TradeOffer): Promise<Trade>',
          'acceptTrade(tradeId: string, accepterId: string): Promise<TradeResult>',
          'cancelTrade(tradeId: string, reason: string): Promise<void>',
        ];
        events: ['trade.*'];
        safetyMechanisms: ['交易锁定', '价值评估', '欺诈检测'];
      };
    };
  };

  // 社交系统API层
  socialAPI: {
    path: 'src/api/social/';
    components: {
      'MailService.ts': {
        methods: [
          'sendMail(mail: Mail): Promise<void>',
          'getMail(recipientId: string): Promise<Mail[]>',
          'markAsRead(mailId: string): Promise<void>',
          'deleteMail(mailId: string): Promise<void>',
        ];
        events: ['mail.*'];
        features: ['智能分类', '垃圾邮件过滤', '快捷回复'];
      };
      'ForumService.ts': {
        methods: [
          'createPost(post: ForumPost): Promise<void>',
          'replyToPost(postId: string, reply: Reply): Promise<void>',
          'moderateContent(contentId: string, action: ModerationAction): Promise<void>',
        ];
        events: ['forum.*'];
        aiFeatures: ['内容审核', '情感分析', '热度预测'];
      };
    };
  };
}
```

### 4.4 事件流设计

#### 4.4.1 核心事件流图

```typescript
// 核心业务事件流
interface CoreEventFlows {
  // 公会创建事件流
  guildCreationFlow: {
    trigger: '用户点击创建公会';
    steps: [
      {
        step: 1;
        component: 'UI组件';
        action: '触发 guild.create.requested 事件';
        event: 'GuildCreateRequestedEvent';
      },
      {
        step: 2;
        component: 'GuildService';
        action: '验证创建条件';
        validation: ['名称唯一性', '用户资格', '资源充足'];
      },
      {
        step: 3;
        component: 'DataIntegrityEngine';
        action: '勾稽关系检查';
        checks: ['用户公会数限制', '名称冲突检测'];
      },
      {
        step: 4;
        component: 'DatabaseManager';
        action: '创建公会记录';
        transaction: '原子性事务保证';
      },
      {
        step: 5;
        component: 'EventPool';
        action: '发布 guild.created 事件';
        notify: ['UI更新', '统计记录', '成就检查'];
      },
    ];
  };

  // 战斗执行事件流
  battleExecutionFlow: {
    trigger: '战斗开始指令';
    steps: [
      {
        step: 1;
        component: 'CombatService';
        action: '初始化战斗环境';
        setup: ['阵容验证', '规则加载', '随机种子'];
      },
      {
        step: 2;
        component: 'AI Worker';
        action: '计算AI决策';
        async: true;
        timeout: '5秒超时保护';
      },
      {
        step: 3;
        component: 'CombatEngine';
        action: '执行战斗回合';
        loop: '直到分出胜负';
      },
      {
        step: 4;
        component: 'Phaser场景';
        action: '动画播放';
        rendering: '60FPS流畅动画';
      },
      {
        step: 5;
        component: 'StatisticsService';
        action: '记录战斗数据';
        analytics: ['胜率统计', '策略效果', '平衡性数据'];
      },
    ];
  };

  // 经济交易事件流
  economicTransactionFlow: {
    trigger: '拍卖竞价/交易提交';
    steps: [
      {
        step: 1;
        component: 'EconomyService';
        action: '交易验证';
        checks: ['资金充足', '物品存在', '权限验证'];
      },
      {
        step: 2;
        component: 'AntiCheatEngine';
        action: '反作弊检测';
        algorithms: ['价格异常检测', '频率限制', '关联账户分析'];
      },
      {
        step: 3;
        component: 'TransactionProcessor';
        action: '执行交易';
        atomicity: 'ACID事务保证';
      },
      {
        step: 4;
        component: 'EconomyAnalyzer';
        action: '市场影响分析';
        metrics: ['价格波动', '流动性影响', '通胀指标'];
      },
      {
        step: 5;
        component: 'NotificationService';
        action: '交易通知';
        channels: ['界面提示', '邮件通知', '成就解锁'];
      },
    ];
  };
}
```

#### 4.4.2 事件优先级与性能优化

```typescript
// 事件优先级配置
interface EventPriorityConfiguration {
  // 关键业务事件（最高优先级）
  critical: {
    priority: 100;
    events: [
      'combat.battle.ended', // 战斗结束必须立即处理
      'economy.transaction.completed', // 交易完成必须确保
      'security.violation.detected', // 安全违规立即响应
      'system.error.critical', // 系统严重错误
    ];
    guarantees: ['立即执行', '不可延迟', '重试保证'];
  };

  // 高优先级事件
  high: {
    priority: 80;
    events: [
      'guild.member.joined', // 成员加入需要快速响应
      'auction.bid.placed', // 竞价需要及时处理
      'mail.received', // 邮件接收用户关注
      'achievement.unlocked', // 成就解锁用户期待
    ];
    guarantees: ['1秒内处理', '允许批量', '失败重试'];
  };

  // 普通优先级事件
  normal: {
    priority: 50;
    events: [
      'ui.state.updated', // UI状态更新
      'analytics.data.recorded', // 分析数据记录
      'cache.invalidated', // 缓存失效通知
      'config.changed', // 配置变更通知
    ];
    guarantees: ['5秒内处理', '批量优化', '丢失可接受'];
  };

  // 低优先级事件
  low: {
    priority: 20;
    events: [
      'debug.log.generated', // 调试日志生成
      'performance.metric.collected', // 性能指标收集
      'statistics.aggregated', // 统计数据聚合
      'cleanup.scheduled', // 清理任务调度
    ];
    guarantees: ['30秒内处理', '可延迟执行', '失败忽略'];
  };
}
```

## 第5章：数据模型与存储端口（融合数据库设计+业务逻辑）

> **设计原则**: 基于领域驱动设计（DDD）和六边形架构，实现数据与业务逻辑的清晰分离，确保AI代码生成时具备明确的数据边界认知

### 5.1 领域模型设计

#### 5.1.1 公会管理领域模型

```typescript
// 公会聚合根（Aggregate Root）
interface GuildAggregate {
  // 聚合标识
  id: GuildId; // UUID v4

  // 基本属性
  name: GuildName; // 公会名称（唯一）
  description: string; // 公会描述
  level: GuildLevel; // 公会等级 (1-50)
  experience: number; // 公会经验值

  // 成员管理
  members: GuildMember[]; // 成员列表
  memberLimit: number; // 成员上限
  leadership: GuildLeadership; // 领导层结构

  // 资源管理
  treasury: GuildTreasury; // 公会金库
  resources: ResourceCollection; // 资源集合
  facilities: GuildFacility[]; // 公会设施

  // 活动数据
  activities: GuildActivity[]; // 公会活动记录
  statistics: GuildStatistics; // 统计信息

  // 元数据
  createdAt: DateTime; // 创建时间
  updatedAt: DateTime; // 更新时间
  version: number; // 乐观锁版本号

  // 聚合业务方法
  addMember(member: GuildMember): DomainResult<void>;
  removeMember(memberId: MemberId): DomainResult<void>;
  promoteMember(memberId: MemberId, newRole: GuildRole): DomainResult<void>;
  allocateResource(resource: ResourceType, amount: number): DomainResult<void>;
  upgradeLevel(): DomainResult<void>;

  // 领域事件产生
  collectDomainEvents(): DomainEvent[];
  clearDomainEvents(): void;
}

// 公会成员值对象
interface GuildMember {
  id: MemberId; // 成员ID
  userId: UserId; // 关联用户ID
  role: GuildRole; // 成员角色
  joinedAt: DateTime; // 加入时间
  contributions: ContributionRecord[]; // 贡献记录
  permissions: Permission[]; // 权限列表
  activityScore: number; // 活跃度评分

  // 值对象验证
  isValid(): boolean;
  canPerform(action: GuildAction): boolean;
}

// 公会角色枚举
enum GuildRole {
  LEADER = 'leader', // 会长
  VICE_LEADER = 'vice_leader', // 副会长
  OFFICER = 'officer', // 干事
  ELITE = 'elite', // 精英
  MEMBER = 'member', // 普通成员
}
```

#### 5.1.2 战斗系统领域模型

```typescript
// 战斗聚合根
interface BattleAggregate {
  // 战斗标识
  id: BattleId; // 战斗唯一标识

  // 基本信息
  type: BattleType; // 战斗类型 (PVP/PVE/WorldBoss)
  status: BattleStatus; // 战斗状态
  configuration: BattleConfig; // 战斗配置

  // 参战方
  attackingParty: CombatParty; // 攻击方
  defendingParty: CombatParty; // 防守方

  // 战斗过程
  rounds: BattleRound[]; // 战斗回合
  currentRound: number; // 当前回合

  // 战斗结果
  result?: BattleResult; // 战斗结果
  rewards: BattleReward[]; // 战斗奖励

  // 时间信息
  startedAt: DateTime; // 开始时间
  endedAt?: DateTime; // 结束时间
  duration?: Duration; // 战斗时长

  // 聚合业务方法
  initializeBattle(): DomainResult<void>;
  executeRound(): DomainResult<BattleRound>;
  applyStrategy(party: PartyType, strategy: BattleStrategy): DomainResult<void>;
  concludeBattle(): DomainResult<BattleResult>;

  // 领域事件
  collectDomainEvents(): DomainEvent[];
  clearDomainEvents(): void;
}

// 战斗队伍值对象
interface CombatParty {
  id: PartyId; // 队伍标识
  guildId: GuildId; // 所属公会
  formation: Formation; // 阵容配置
  strategy: BattleStrategy; // 战斗策略
  members: CombatMember[]; // 参战成员

  // 队伍状态
  totalPower: number; // 总战力
  morale: number; // 士气值
  buffs: Buff[]; // 增益效果
  debuffs: Debuff[]; // 减益效果

  // 值对象方法
  calculateTotalPower(): number;
  applyFormationBonus(): void;
  canExecuteStrategy(strategy: BattleStrategy): boolean;
}

// 战斗成员值对象
interface CombatMember {
  id: MemberId; // 成员ID
  position: BattlePosition; // 战斗位置
  stats: CombatStats; // 战斗属性
  equipment: Equipment[]; // 装备列表
  skills: Skill[]; // 技能列表

  // 战斗状态
  currentHP: number; // 当前血量
  currentMP: number; // 当前魔法值
  statusEffects: StatusEffect[]; // 状态效果
  actionQueue: Action[]; // 行动队列

  // 成员行为
  canAct(): boolean;
  selectAction(context: BattleContext): Action;
  executeAction(action: Action): ActionResult;
}
```

#### 5.1.3 经济系统领域模型

```typescript
// 拍卖聚合根
interface AuctionAggregate {
  // 拍卖标识
  id: AuctionId; // 拍卖ID

  // 拍卖物品
  item: AuctionItem; // 拍卖物品
  quantity: number; // 数量

  // 拍卖配置
  startingBid: Money; // 起拍价
  currentBid: Money; // 当前最高价
  bidIncrement: Money; // 最小加价幅度

  // 参与方
  seller: SellerId; // 卖方
  bidders: Bidder[]; // 竞价者列表
  currentWinner?: BidderId; // 当前最高价者

  // 时间控制
  duration: Duration; // 拍卖时长
  startTime: DateTime; // 开始时间
  endTime: DateTime; // 结束时间

  // 状态管理
  status: AuctionStatus; // 拍卖状态

  // 聚合业务方法
  placeBid(bidder: BidderId, amount: Money): DomainResult<void>;
  extendDuration(extension: Duration): DomainResult<void>;
  closeAuction(): DomainResult<AuctionResult>;
  cancelAuction(reason: string): DomainResult<void>;

  // 业务规则验证
  isValidBid(amount: Money): boolean;
  isActive(): boolean;
  canBid(bidder: BidderId): boolean;

  // 领域事件
  collectDomainEvents(): DomainEvent[];
  clearDomainEvents(): void;
}

// 交易聚合根
interface TradeAggregate {
  // 交易标识
  id: TradeId; // 交易ID

  // 交易双方
  initiator: TraderId; // 发起方
  recipient: TraderId; // 接受方

  // 交易内容
  initiatorOffer: TradeOffer; // 发起方报价
  recipientOffer: TradeOffer; // 接受方报价

  // 交易状态
  status: TradeStatus; // 交易状态
  negotiations: TradeNegotiation[]; // 谈判记录

  // 安全机制
  securityDeposit: Money; // 保证金
  escrowService?: EscrowId; // 第三方托管
  verificationRequired: boolean; // 是否需要验证

  // 时间信息
  createdAt: DateTime; // 创建时间
  expiresAt: DateTime; // 过期时间
  completedAt?: DateTime; // 完成时间

  // 聚合业务方法
  negotiate(trader: TraderId, newOffer: TradeOffer): DomainResult<void>;
  accept(trader: TraderId): DomainResult<void>;
  reject(trader: TraderId, reason: string): DomainResult<void>;
  execute(): DomainResult<TradeResult>;
  cancel(reason: string): DomainResult<void>;

  // 安全验证
  verifyTradeItems(): boolean;
  detectFraud(): FraudRisk;
  calculateTradeTax(): Money;
}
```

### 5.2 数据存储端口设计

#### 5.2.1 仓储模式接口（Repository Pattern）

```typescript
// 通用仓储基接口
interface IRepository<TAggregate, TId> {
  // 基本CRUD操作
  findById(id: TId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  delete(id: TId): Promise<void>;

  // 批量操作
  saveMany(aggregates: TAggregate[]): Promise<void>;
  deleteMany(ids: TId[]): Promise<void>;

  // 查询支持
  findBy(criteria: QueryCriteria): Promise<TAggregate[]>;
  count(criteria: QueryCriteria): Promise<number>;
  exists(id: TId): Promise<boolean>;

  // 事务支持
  saveInTransaction(
    aggregate: TAggregate,
    transaction: Transaction
  ): Promise<void>;

  // 领域事件支持
  saveWithEvents(aggregate: TAggregate): Promise<void>;
}

// 公会仓储接口
interface IGuildRepository extends IRepository<GuildAggregate, GuildId> {
  // 公会特定查询
  findByName(name: string): Promise<GuildAggregate | null>;
  findByLeader(leaderId: UserId): Promise<GuildAggregate[]>;
  findByLevel(level: GuildLevel): Promise<GuildAggregate[]>;
  findTopByExperience(limit: number): Promise<GuildAggregate[]>;

  // 成员相关查询
  findByMember(memberId: UserId): Promise<GuildAggregate | null>;
  findMembersCount(guildId: GuildId): Promise<number>;

  // 统计查询
  getStatistics(): Promise<GuildStatistics>;
  getActiveGuilds(since: DateTime): Promise<GuildAggregate[]>;

  // 复杂查询
  searchGuilds(criteria: GuildSearchCriteria): Promise<GuildSearchResult>;
}

// 战斗仓储接口
interface IBattleRepository extends IRepository<BattleAggregate, BattleId> {
  // 战斗历史查询
  findByGuild(guildId: GuildId, limit?: number): Promise<BattleAggregate[]>;
  findByParticipant(
    participantId: UserId,
    limit?: number
  ): Promise<BattleAggregate[]>;
  findByDateRange(start: DateTime, end: DateTime): Promise<BattleAggregate[]>;

  // 战斗统计
  getWinRate(guildId: GuildId): Promise<number>;
  getBattleStats(guildId: GuildId): Promise<BattleStatistics>;

  // 活跃战斗
  findActiveBattles(): Promise<BattleAggregate[]>;
  findPendingBattles(guildId: GuildId): Promise<BattleAggregate[]>;
}

// 拍卖仓储接口
interface IAuctionRepository extends IRepository<AuctionAggregate, AuctionId> {
  // 活跃拍卖查询
  findActiveAuctions(): Promise<AuctionAggregate[]>;
  findEndingSoon(within: Duration): Promise<AuctionAggregate[]>;

  // 物品查询
  findByItem(itemType: ItemType): Promise<AuctionAggregate[]>;
  findByPriceRange(min: Money, max: Money): Promise<AuctionAggregate[]>;

  // 用户相关查询
  findBySeller(sellerId: SellerId): Promise<AuctionAggregate[]>;
  findByBidder(bidderId: BidderId): Promise<AuctionAggregate[]>;

  // 市场分析
  getPriceHistory(itemType: ItemType, period: Period): Promise<PriceHistory[]>;
  getMarketTrends(): Promise<MarketTrend[]>;
}
```

#### 5.2.2 数据访问适配器实现

```typescript
// SQLite数据访问适配器基类
abstract class SQLiteRepositoryBase<TAggregate, TId>
  implements IRepository<TAggregate, TId>
{
  protected db: Database;
  protected tableName: string;
  protected eventDispatcher: IEventDispatcher;

  constructor(
    db: Database,
    tableName: string,
    eventDispatcher: IEventDispatcher
  ) {
    this.db = db;
    this.tableName = tableName;
    this.eventDispatcher = eventDispatcher;
  }

  // 通用查询方法
  async findById(id: TId): Promise<TAggregate | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const row = this.db.prepare(sql).get(id);
    return row ? this.mapRowToAggregate(row) : null;
  }

  // 通用保存方法
  async save(aggregate: TAggregate): Promise<void> {
    const transaction = this.db.transaction(() => {
      // 保存聚合根数据
      this.insertOrUpdateAggregate(aggregate);

      // 保存关联数据
      this.saveAssociatedEntities(aggregate);

      // 发布领域事件
      this.publishDomainEvents(aggregate);
    });

    transaction();
  }

  // 事务内保存
  async saveInTransaction(
    aggregate: TAggregate,
    transaction: Transaction
  ): Promise<void> {
    // 在提供的事务内执行保存操作
    transaction.exec(() => {
      this.insertOrUpdateAggregate(aggregate);
      this.saveAssociatedEntities(aggregate);
    });
  }

  // 抽象方法，由具体实现类定义
  protected abstract mapRowToAggregate(row: any): TAggregate;
  protected abstract insertOrUpdateAggregate(aggregate: TAggregate): void;
  protected abstract saveAssociatedEntities(aggregate: TAggregate): void;

  // 领域事件处理
  protected async publishDomainEvents(aggregate: TAggregate): Promise<void> {
    if ('collectDomainEvents' in aggregate) {
      const events = (aggregate as any).collectDomainEvents();
      for (const event of events) {
        await this.eventDispatcher.dispatch(event);
      }
      (aggregate as any).clearDomainEvents();
    }
  }
}

// 公会仓储SQLite实现
class SQLiteGuildRepository
  extends SQLiteRepositoryBase<GuildAggregate, GuildId>
  implements IGuildRepository
{
  constructor(db: Database, eventDispatcher: IEventDispatcher) {
    super(db, 'guilds', eventDispatcher);
  }

  // 公会特定查询实现
  async findByName(name: string): Promise<GuildAggregate | null> {
    const sql = `SELECT * FROM guilds WHERE name = ?`;
    const row = this.db.prepare(sql).get(name);
    return row ? this.mapRowToAggregate(row) : null;
  }

  async findByLeader(leaderId: UserId): Promise<GuildAggregate[]> {
    const sql = `
      SELECT g.* FROM guilds g
      INNER JOIN guild_members gm ON g.id = gm.guild_id
      WHERE gm.user_id = ? AND gm.role = 'leader'
    `;
    const rows = this.db.prepare(sql).all(leaderId);
    return rows.map(row => this.mapRowToAggregate(row));
  }

  async findTopByExperience(limit: number): Promise<GuildAggregate[]> {
    const sql = `
      SELECT * FROM guilds 
      ORDER BY experience DESC 
      LIMIT ?
    `;
    const rows = this.db.prepare(sql).all(limit);
    return rows.map(row => this.mapRowToAggregate(row));
  }

  // 复杂查询实现
  async searchGuilds(
    criteria: GuildSearchCriteria
  ): Promise<GuildSearchResult> {
    let sql = `SELECT * FROM guilds WHERE 1=1`;
    const params: any[] = [];

    if (criteria.name) {
      sql += ` AND name LIKE ?`;
      params.push(`%${criteria.name}%`);
    }

    if (criteria.minLevel) {
      sql += ` AND level >= ?`;
      params.push(criteria.minLevel);
    }

    if (criteria.maxLevel) {
      sql += ` AND level <= ?`;
      params.push(criteria.maxLevel);
    }

    if (criteria.hasOpenSlots) {
      sql += ` AND (SELECT COUNT(*) FROM guild_members WHERE guild_id = guilds.id) < member_limit`;
    }

    // 分页支持
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const total = this.db.prepare(countSql).get(params).total;

    sql += ` ORDER BY ${criteria.sortBy || 'experience'} ${criteria.sortOrder || 'DESC'}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(
      criteria.pageSize || 20,
      (criteria.page || 0) * (criteria.pageSize || 20)
    );

    const rows = this.db.prepare(sql).all(params);
    const guilds = rows.map(row => this.mapRowToAggregate(row));

    return {
      guilds,
      total,
      page: criteria.page || 0,
      pageSize: criteria.pageSize || 20,
    };
  }

  // 数据映射实现
  protected mapRowToAggregate(row: any): GuildAggregate {
    // 从数据库行数据重建公会聚合根
    const guild = new GuildAggregate(
      new GuildId(row.id),
      new GuildName(row.name),
      row.description,
      new GuildLevel(row.level),
      row.experience
    );

    // 加载成员数据
    const membersSql = `SELECT * FROM guild_members WHERE guild_id = ?`;
    const memberRows = this.db.prepare(membersSql).all(row.id);
    guild.members = memberRows.map(memberRow => this.mapMemberRow(memberRow));

    // 加载其他关联数据...

    return guild;
  }

  protected insertOrUpdateAggregate(aggregate: GuildAggregate): void {
    const sql = `
      INSERT OR REPLACE INTO guilds 
      (id, name, description, level, experience, member_limit, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db
      .prepare(sql)
      .run(
        aggregate.id.value,
        aggregate.name.value,
        aggregate.description,
        aggregate.level.value,
        aggregate.experience,
        aggregate.memberLimit,
        aggregate.createdAt.toISOString(),
        new Date().toISOString(),
        aggregate.version + 1
      );
  }

  protected saveAssociatedEntities(aggregate: GuildAggregate): void {
    // 保存公会成员
    this.saveMemberships(aggregate.id, aggregate.members);

    // 保存公会设施
    this.saveFacilities(aggregate.id, aggregate.facilities);

    // 保存资源数据
    this.saveResources(aggregate.id, aggregate.resources);
  }

  private saveMemberships(guildId: GuildId, members: GuildMember[]): void {
    // 先删除现有成员关系
    this.db
      .prepare(`DELETE FROM guild_members WHERE guild_id = ?`)
      .run(guildId.value);

    // 插入新的成员关系
    const insertSql = `
      INSERT INTO guild_members 
      (guild_id, user_id, role, joined_at, activity_score)
      VALUES (?, ?, ?, ?, ?)
    `;

    const stmt = this.db.prepare(insertSql);
    for (const member of members) {
      stmt.run(
        guildId.value,
        member.userId.value,
        member.role,
        member.joinedAt.toISOString(),
        member.activityScore
      );
    }
  }
}
```

### 5.3 业务逻辑层设计

> **设计原则**: 基于领域驱动设计的业务逻辑分层，通过规则引擎、状态机和事件驱动架构实现复杂业务规则的清晰表达和高效执行

#### 5.3.1 业务规则引擎

```typescript
// 业务规则定义接口
interface BusinessRule<TContext = any> {
  id: string;
  name: string;
  description: string;
  priority: number; // 规则优先级 (1-100)
  condition: (context: TContext) => boolean;
  action: (context: TContext) => Promise<TContext>;
  tags: string[]; // 规则分类标签
  enabled: boolean; // 规则启用状态
  version: string; // 规则版本
}

// 业务规则上下文
interface BusinessContext {
  // 核心实体
  guild: GuildAggregate;
  member: MemberAggregate;
  action: ActionType;

  // 上下文数据
  timestamp: number;
  userId: string;
  sessionId: string;

  // 事务状态
  transactionId: string;
  rollbackActions: (() => Promise<void>)[];
}

// 业务规则执行引擎
export class BusinessRulesEngine {
  private rules: Map<string, BusinessRule[]> = new Map();
  private ruleCache: LRUCache<string, BusinessRule[]>;
  private eventDispatcher: IEventDispatcher;
  private logger: ILogger;

  constructor(
    eventDispatcher: IEventDispatcher,
    logger: ILogger,
    cacheConfig: CacheConfig = { maxSize: 1000, ttl: 300000 }
  ) {
    this.eventDispatcher = eventDispatcher;
    this.logger = logger;
    this.ruleCache = new LRUCache(cacheConfig);
  }

  // 注册业务规则
  registerRule(category: string, rule: BusinessRule): void {
    if (!this.rules.has(category)) {
      this.rules.set(category, []);
    }

    const categoryRules = this.rules.get(category)!;
    const existingIndex = categoryRules.findIndex(r => r.id === rule.id);

    if (existingIndex >= 0) {
      categoryRules[existingIndex] = rule;
      this.logger.info(`Business rule updated: ${rule.id}`);
    } else {
      categoryRules.push(rule);
      this.logger.info(`Business rule registered: ${rule.id}`);
    }

    // 按优先级排序
    categoryRules.sort((a, b) => b.priority - a.priority);

    // 清空缓存
    this.ruleCache.clear();

    // 发布规则变更事件
    this.eventDispatcher.dispatch(
      new BusinessRuleChangedEvent({
        category,
        ruleId: rule.id,
        changeType: existingIndex >= 0 ? 'updated' : 'added',
      })
    );
  }

  // 执行业务规则
  async executeRules(
    category: string,
    context: BusinessContext
  ): Promise<BusinessContext> {
    const cacheKey = `${category}:${context.action}:${context.guild.id}`;
    let applicableRules = this.ruleCache.get(cacheKey);

    if (!applicableRules) {
      const categoryRules = this.rules.get(category) || [];
      applicableRules = categoryRules.filter(rule => rule.enabled);
      this.ruleCache.set(cacheKey, applicableRules);
    }

    let updatedContext = { ...context };
    const executedRules: string[] = [];

    try {
      for (const rule of applicableRules) {
        if (await this.evaluateCondition(rule, updatedContext)) {
          this.logger.debug(`Executing business rule: ${rule.id}`, {
            ruleId: rule.id,
            context: updatedContext.transactionId,
          });

          const startTime = Date.now();
          updatedContext = await rule.action(updatedContext);
          const duration = Date.now() - startTime;

          executedRules.push(rule.id);

          // 性能监控
          if (duration > 100) {
            this.logger.warn(`Slow business rule execution: ${rule.id}`, {
              duration,
              ruleId: rule.id,
            });
          }

          // 发布规则执行事件
          this.eventDispatcher.dispatch(
            new BusinessRuleExecutedEvent({
              ruleId: rule.id,
              duration,
              context: updatedContext.transactionId,
            })
          );
        }
      }

      // 记录执行结果
      this.logger.info(`Business rules execution completed`, {
        category,
        executedRules,
        transactionId: updatedContext.transactionId,
      });

      return updatedContext;
    } catch (error) {
      this.logger.error(`Business rules execution failed`, {
        category,
        executedRules,
        error: error.message,
        transactionId: updatedContext.transactionId,
      });

      // 执行回滚操作
      await this.rollback(updatedContext);
      throw new BusinessRuleExecutionError(
        `Rules execution failed: ${error.message}`,
        {
          category,
          failedRules: executedRules,
          originalError: error,
        }
      );
    }
  }

  // 条件评估
  private async evaluateCondition(
    rule: BusinessRule,
    context: BusinessContext
  ): Promise<boolean> {
    try {
      return rule.condition(context);
    } catch (error) {
      this.logger.warn(
        `Business rule condition evaluation failed: ${rule.id}`,
        {
          error: error.message,
          ruleId: rule.id,
        }
      );
      return false;
    }
  }

  // 回滚操作
  private async rollback(context: BusinessContext): Promise<void> {
    for (const rollbackAction of context.rollbackActions.reverse()) {
      try {
        await rollbackAction();
      } catch (rollbackError) {
        this.logger.error(`Rollback action failed`, {
          error: rollbackError.message,
          transactionId: context.transactionId,
        });
      }
    }
  }

  // 获取规则统计信息
  getRulesStatistics(): RulesStatistics {
    const stats: RulesStatistics = {
      totalRules: 0,
      enabledRules: 0,
      categories: new Map(),
      cacheHitRate: this.ruleCache.getHitRate(),
    };

    for (const [category, rules] of this.rules) {
      const categoryStats = {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        avgPriority:
          rules.reduce((sum, r) => sum + r.priority, 0) / rules.length,
      };

      stats.categories.set(category, categoryStats);
      stats.totalRules += categoryStats.total;
      stats.enabledRules += categoryStats.enabled;
    }

    return stats;
  }
}

// 具体业务规则示例
export const GuildBusinessRules = {
  // 公会创建规则
  GUILD_CREATION: {
    id: 'guild-creation-validation',
    name: '公会创建验证',
    description: '验证公会创建的前置条件',
    priority: 90,
    condition: (context: BusinessContext) => {
      return (
        context.action === 'CREATE_GUILD' &&
        context.member.level >= 10 &&
        context.member.gold >= 1000
      );
    },
    action: async (context: BusinessContext) => {
      // 扣除创建费用
      context.member.gold -= 1000;

      // 添加回滚操作
      context.rollbackActions.push(async () => {
        context.member.gold += 1000;
      });

      return context;
    },
    tags: ['guild', 'creation', 'validation'],
    enabled: true,
    version: '1.0.0',
  } as BusinessRule<BusinessContext>,

  // 成员招募规则
  MEMBER_RECRUITMENT: {
    id: 'member-recruitment-limit',
    name: '成员招募限制',
    description: '检查公会成员招募限制',
    priority: 80,
    condition: (context: BusinessContext) => {
      return (
        context.action === 'RECRUIT_MEMBER' &&
        context.guild.members.length < context.guild.maxMembers
      );
    },
    action: async (context: BusinessContext) => {
      // 业务逻辑：检查成员等级要求
      if (context.member.level < context.guild.requirements.minLevel) {
        throw new BusinessRuleViolationError('Member level too low');
      }

      return context;
    },
    tags: ['guild', 'recruitment', 'limit'],
    enabled: true,
    version: '1.0.0',
  } as BusinessRule<BusinessContext>,
};
```

#### 5.3.2 事件驱动架构详细实现

```typescript
// 领域事件基接口
interface DomainEvent {
  eventId: string; // 事件唯一标识
  eventType: string; // 事件类型
  aggregateId: string; // 聚合根ID
  aggregateType: string; // 聚合根类型
  eventData: any; // 事件数据
  occurredAt: number; // 发生时间戳
  version: number; // 事件版本
  correlationId?: string; // 关联ID
  causationId?: string; // 因果ID
}

// 事件存储接口
interface IEventStore {
  append(
    streamId: string,
    expectedVersion: number,
    events: DomainEvent[]
  ): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomEvent[]>;
  getAllEvents(fromPosition?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string): Promise<DomainEvent[]>;
}

// 事件发布器
interface IEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
  publishSingle(event: DomainEvent): Promise<void>;
}

// 事件处理器接口
interface IEventHandler<TEvent extends DomainEvent = DomainEvent> {
  eventType: string;
  handle(event: TEvent): Promise<void>;
}

// 事件总线实现
export class EventBus implements IEventPublisher {
  private handlers: Map<string, IEventHandler[]> = new Map();
  private eventStore: IEventStore;
  private logger: ILogger;
  private retryConfig: RetryConfig;

  constructor(
    eventStore: IEventStore,
    logger: ILogger,
    retryConfig: RetryConfig = { maxRetries: 3, backoffMs: 1000 }
  ) {
    this.eventStore = eventStore;
    this.logger = logger;
    this.retryConfig = retryConfig;
  }

  // 注册事件处理器
  registerHandler<TEvent extends DomainEvent>(
    handler: IEventHandler<TEvent>
  ): void {
    if (!this.handlers.has(handler.eventType)) {
      this.handlers.set(handler.eventType, []);
    }

    this.handlers.get(handler.eventType)!.push(handler);
    this.logger.info(`Event handler registered: ${handler.eventType}`);
  }

  // 发布事件
  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishSingle(event);
    }
  }

  async publishSingle(event: DomainEvent): Promise<void> {
    this.logger.debug(`Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
    });

    const handlers = this.handlers.get(event.eventType) || [];
    const handlerPromises = handlers.map(handler =>
      this.executeHandler(handler, event)
    );

    try {
      await Promise.allSettled(handlerPromises);
      this.logger.info(`Event published successfully: ${event.eventType}`, {
        eventId: event.eventId,
        handlerCount: handlers.length,
      });
    } catch (error) {
      this.logger.error(`Event publication failed: ${event.eventType}`, {
        eventId: event.eventId,
        error: error.message,
      });
      throw error;
    }
  }

  // 执行事件处理器（带重试机制）
  private async executeHandler(
    handler: IEventHandler,
    event: DomainEvent
  ): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= this.retryConfig.maxRetries) {
      try {
        await handler.handle(event);
        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts <= this.retryConfig.maxRetries) {
          const backoffTime =
            this.retryConfig.backoffMs * Math.pow(2, attempts - 1);
          this.logger.warn(
            `Event handler retry ${attempts}/${this.retryConfig.maxRetries}`,
            {
              handlerType: handler.eventType,
              eventId: event.eventId,
              backoffTime,
            }
          );
          await this.delay(backoffTime);
        }
      }
    }

    this.logger.error(
      `Event handler failed after ${this.retryConfig.maxRetries} retries`,
      {
        handlerType: handler.eventType,
        eventId: event.eventId,
        error: lastError?.message,
      }
    );

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 聚合根基类（支持事件发布）
export abstract class EventSourcedAggregate {
  protected events: DomainEvent[] = [];
  protected version: number = 0;

  // 获取未提交的事件
  getUncommittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  // 标记事件为已提交
  markEventsAsCommitted(): void {
    this.events = [];
  }

  // 应用事件到聚合
  protected applyEvent(event: DomainEvent): void {
    this.events.push(event);
    this.version++;

    // 调用相应的apply方法
    const applyMethodName = `apply${event.eventType}`;
    const applyMethod = (this as any)[applyMethodName];

    if (typeof applyMethod === 'function') {
      applyMethod.call(this, event.eventData);
    }
  }

  // 从历史事件重建聚合
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      const applyMethodName = `apply${event.eventType}`;
      const applyMethod = (this as any)[applyMethodName];

      if (typeof applyMethod === 'function') {
        applyMethod.call(this, event.eventData);
        this.version = event.version;
      }
    }
  }
}
```

#### 5.3.3 状态机设计

```typescript
// 状态机状态定义
interface State<TData = any> {
  name: string;
  onEnter?: (data: TData) => Promise<void>;
  onExit?: (data: TData) => Promise<void>;
  onUpdate?: (data: TData, deltaTime: number) => Promise<TData>;
}

// 状态转换定义
interface Transition<TData = any> {
  from: string;
  to: string;
  condition: (data: TData) => boolean;
  action?: (data: TData) => Promise<TData>;
  guard?: (data: TData) => boolean;
}

// 状态机实现
export class StateMachine<TData = any> {
  private states: Map<string, State<TData>> = new Map();
  private transitions: Transition<TData>[] = [];
  private currentState: string;
  private data: TData;
  private logger: ILogger;

  constructor(initialState: string, initialData: TData, logger: ILogger) {
    this.currentState = initialState;
    this.data = initialData;
    this.logger = logger;
  }

  // 添加状态
  addState(state: State<TData>): void {
    this.states.set(state.name, state);
  }

  // 添加状态转换
  addTransition(transition: Transition<TData>): void {
    this.transitions.push(transition);
  }

  // 获取当前状态
  getCurrentState(): string {
    return this.currentState;
  }

  // 获取状态数据
  getData(): TData {
    return this.data;
  }

  // 更新状态机（每帧调用）
  async update(deltaTime: number): Promise<void> {
    // 更新当前状态
    const state = this.states.get(this.currentState);
    if (state?.onUpdate) {
      this.data = await state.onUpdate(this.data, deltaTime);
    }

    // 检查状态转换
    for (const transition of this.transitions) {
      if (transition.from === this.currentState) {
        if (transition.guard && !transition.guard(this.data)) {
          continue;
        }

        if (transition.condition(this.data)) {
          await this.transitionTo(transition.to, transition.action);
          break;
        }
      }
    }
  }

  // 强制状态转换
  async transitionTo(
    newState: string,
    action?: (data: TData) => Promise<TData>
  ): Promise<void> {
    if (!this.states.has(newState)) {
      throw new Error(`State ${newState} does not exist`);
    }

    const oldState = this.currentState;

    try {
      // 退出当前状态
      const currentStateObj = this.states.get(this.currentState);
      if (currentStateObj?.onExit) {
        await currentStateObj.onExit(this.data);
      }

      // 执行转换动作
      if (action) {
        this.data = await action(this.data);
      }

      // 更新当前状态
      this.currentState = newState;

      // 进入新状态
      const newStateObj = this.states.get(newState);
      if (newStateObj?.onEnter) {
        await newStateObj.onEnter(this.data);
      }

      this.logger.info(`State transition: ${oldState} -> ${newState}`);
    } catch (error) {
      this.logger.error(`State transition failed: ${oldState} -> ${newState}`, {
        error: error.message,
      });
      throw error;
    }
  }
}

// 公会状态机示例
export class GuildStateMachine extends StateMachine<GuildAggregate> {
  constructor(guild: GuildAggregate, logger: ILogger) {
    super('FORMING', guild, logger);

    // 定义状态
    this.addState({
      name: 'FORMING',
      onEnter: async guild => {
        guild.status = GuildStatus.FORMING;
        guild.formingStartTime = Date.now();
      },
    });

    this.addState({
      name: 'ACTIVE',
      onEnter: async guild => {
        guild.status = GuildStatus.ACTIVE;
        guild.activationTime = Date.now();
      },
      onUpdate: async (guild, deltaTime) => {
        // 定期更新公会活跃度
        guild.updateActivity(deltaTime);
        return guild;
      },
    });

    this.addState({
      name: 'INACTIVE',
      onEnter: async guild => {
        guild.status = GuildStatus.INACTIVE;
        guild.inactiveStartTime = Date.now();
      },
    });

    this.addState({
      name: 'DISBANDED',
      onEnter: async guild => {
        guild.status = GuildStatus.DISBANDED;
        guild.disbandTime = Date.now();
      },
    });

    // 定义状态转换
    this.addTransition({
      from: 'FORMING',
      to: 'ACTIVE',
      condition: guild => guild.members.length >= 3,
      action: async guild => {
        // 公会激活奖励
        guild.treasury += 5000;
        return guild;
      },
    });

    this.addTransition({
      from: 'ACTIVE',
      to: 'INACTIVE',
      condition: guild => {
        const inactiveTime = Date.now() - guild.lastActivityTime;
        return inactiveTime > 7 * 24 * 60 * 60 * 1000; // 7天无活动
      },
    });

    this.addTransition({
      from: 'INACTIVE',
      to: 'ACTIVE',
      condition: guild => guild.recentActivityScore > 100,
    });

    this.addTransition({
      from: 'INACTIVE',
      to: 'DISBANDED',
      condition: guild => {
        const inactiveTime = Date.now() - guild.inactiveStartTime;
        return inactiveTime > 30 * 24 * 60 * 60 * 1000; // 30天不活跃自动解散
      },
    });
  }
}
```

#### 5.3.4 数据校验机制

```typescript
// 校验规则接口
interface ValidationRule<T> {
  field: keyof T;
  validate: (value: any, entity?: T) => ValidationResult;
  message: string;
  level: 'error' | 'warning' | 'info';
}

// 校验结果
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// 校验错误
interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

// 数据校验器基类
export abstract class BaseValidator<T> {
  protected rules: ValidationRule<T>[] = [];

  // 添加校验规则
  addRule(rule: ValidationRule<T>): void {
    this.rules.push(rule);
  }

  // 执行校验
  validate(entity: T): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const rule of this.rules) {
      const fieldValue = entity[rule.field];
      const ruleResult = rule.validate(fieldValue, entity);

      if (!ruleResult.isValid) {
        result.isValid = false;
        result.errors.push(...ruleResult.errors);
      }

      result.warnings.push(...ruleResult.warnings);
    }

    return result;
  }

  // 批量校验
  validateBatch(entities: T[]): ValidationResult {
    const batchResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const entity of entities) {
      const result = this.validate(entity);
      if (!result.isValid) {
        batchResult.isValid = false;
        batchResult.errors.push(...result.errors);
      }
      batchResult.warnings.push(...result.warnings);
    }

    return batchResult;
  }
}

// 公会数据校验器
export class GuildValidator extends BaseValidator<GuildAggregate> {
  constructor() {
    super();

    // 公会名称校验
    this.addRule({
      field: 'name',
      validate: (name: string) => {
        const errors: ValidationError[] = [];

        if (!name || name.trim().length === 0) {
          errors.push({
            field: 'name',
            code: 'REQUIRED',
            message: '公会名称不能为空',
            value: name,
          });
        }

        if (name && (name.length < 2 || name.length > 20)) {
          errors.push({
            field: 'name',
            code: 'LENGTH',
            message: '公会名称长度必须在2-20字符之间',
            value: name,
          });
        }

        if (name && !/^[a-zA-Z0-9\u4e00-\u9fa5]+$/.test(name)) {
          errors.push({
            field: 'name',
            code: 'FORMAT',
            message: '公会名称只能包含字母、数字和中文字符',
            value: name,
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: [],
        };
      },
      message: '公会名称校验失败',
      level: 'error',
    });

    // 公会等级校验
    this.addRule({
      field: 'level',
      validate: (level: number) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (level < 1 || level > 100) {
          errors.push({
            field: 'level',
            code: 'RANGE',
            message: '公会等级必须在1-100之间',
            value: level,
          });
        }

        if (level > 50) {
          warnings.push({
            field: 'level',
            code: 'HIGH_LEVEL',
            message: '公会等级较高，请确认数据准确性',
            value: level,
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
        };
      },
      message: '公会等级校验失败',
      level: 'error',
    });

    // 成员数量校验
    this.addRule({
      field: 'members',
      validate: (members: MemberAggregate[], guild?: GuildAggregate) => {
        const errors: ValidationError[] = [];

        if (members.length > (guild?.maxMembers || 50)) {
          errors.push({
            field: 'members',
            code: 'EXCEED_LIMIT',
            message: `成员数量超过限制 (${guild?.maxMembers || 50})`,
            value: members.length,
          });
        }

        // 检查重复成员
        const memberIds = members.map(m => m.id);
        const uniqueIds = new Set(memberIds);
        if (memberIds.length !== uniqueIds.size) {
          errors.push({
            field: 'members',
            code: 'DUPLICATE',
            message: '存在重复的公会成员',
            value: members.length,
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: [],
        };
      },
      message: '成员列表校验失败',
      level: 'error',
    });
  }
}

// 数据完整性校验引擎
export class DataIntegrityValidator {
  private validators: Map<string, BaseValidator<any>> = new Map();
  private crossReferenceRules: CrossReferenceRule[] = [];

  // 注册实体校验器
  registerValidator<T>(entityType: string, validator: BaseValidator<T>): void {
    this.validators.set(entityType, validator);
  }

  // 添加跨引用校验规则
  addCrossReferenceRule(rule: CrossReferenceRule): void {
    this.crossReferenceRules.push(rule);
  }

  // 校验单个实体
  async validateEntity<T>(
    entityType: string,
    entity: T
  ): Promise<ValidationResult> {
    const validator = this.validators.get(entityType);
    if (!validator) {
      throw new Error(`No validator found for entity type: ${entityType}`);
    }

    return validator.validate(entity);
  }

  // 校验数据完整性（跨实体）
  async validateDataIntegrity(
    entities: Map<string, any[]>
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // 执行跨引用校验
    for (const rule of this.crossReferenceRules) {
      const ruleResult = await rule.validate(entities);
      if (!ruleResult.isValid) {
        result.isValid = false;
        result.errors.push(...ruleResult.errors);
      }
      result.warnings.push(...ruleResult.warnings);
    }

    return result;
  }
}

// 跨引用校验规则示例
export const CrossReferenceRules = {
  // 公会成员引用完整性
  GUILD_MEMBER_INTEGRITY: {
    validate: async (entities: Map<string, any[]>) => {
      const guilds = entities.get('guild') || [];
      const members = entities.get('member') || [];
      const errors: ValidationError[] = [];

      for (const guild of guilds) {
        for (const memberId of guild.memberIds) {
          const member = members.find(m => m.id === memberId);
          if (!member) {
            errors.push({
              field: 'memberIds',
              code: 'MISSING_REFERENCE',
              message: `Guild ${guild.id} references non-existent member ${memberId}`,
              value: memberId,
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: [],
      };
    },
  } as CrossReferenceRule,
};
```

### 5.4 数据一致性与完整性保障

#### 5.4.1 勾稽关系验证引擎

```typescript
// 数据完整性验证引擎
class DataIntegrityEngine {
  private db: Database;
  private eventBus: IEventBus;
  private logger: ILogger;

  constructor(db: Database, eventBus: IEventBus, logger: ILogger) {
    this.db = db;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // 公会数据勾稽验证
  async validateGuildIntegrity(guildId: GuildId): Promise<IntegrityResult> {
    const violations: IntegrityViolation[] = [];

    try {
      // 1. 验证成员数量一致性
      await this.validateMemberCount(guildId, violations);

      // 2. 验证资源总量一致性
      await this.validateResourceTotals(guildId, violations);

      // 3. 验证权限分配一致性
      await this.validatePermissionConsistency(guildId, violations);

      // 4. 验证活动记录完整性
      await this.validateActivityRecords(guildId, violations);

      // 5. 验证统计数据准确性
      await this.validateStatistics(guildId, violations);

      return {
        isValid: violations.length === 0,
        violations,
        validatedAt: new Date(),
        guildId,
      };
    } catch (error) {
      this.logger.error('Guild integrity validation failed', {
        guildId,
        error,
      });
      throw new DataIntegrityException(
        `Integrity validation failed: ${error.message}`
      );
    }
  }

  // 成员数量一致性验证
  private async validateMemberCount(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<void> {
    const guildQuery = `SELECT member_limit, member_count FROM guilds WHERE id = ?`;
    const guild = this.db.prepare(guildQuery).get(guildId.value);

    const actualCountQuery = `SELECT COUNT(*) as actual_count FROM guild_members WHERE guild_id = ?`;
    const actualCount = this.db
      .prepare(actualCountQuery)
      .get(guildId.value).actual_count;

    // 检查记录的成员数量与实际成员数量是否一致
    if (guild.member_count !== actualCount) {
      violations.push({
        type: 'MEMBER_COUNT_MISMATCH',
        description: `Guild member count mismatch: recorded=${guild.member_count}, actual=${actualCount}`,
        severity: 'HIGH',
        guildId,
        expectedValue: actualCount,
        actualValue: guild.member_count,
        fixSuggestion: 'UPDATE guilds SET member_count = ? WHERE id = ?',
      });
    }

    // 检查成员数量是否超出限制
    if (actualCount > guild.member_limit) {
      violations.push({
        type: 'MEMBER_LIMIT_EXCEEDED',
        description: `Guild member limit exceeded: count=${actualCount}, limit=${guild.member_limit}`,
        severity: 'CRITICAL',
        guildId,
        expectedValue: guild.member_limit,
        actualValue: actualCount,
        fixSuggestion: 'Remove excess members or increase member limit',
      });
    }
  }

  // 资源总量一致性验证
  private async validateResourceTotals(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<void> {
    const resourceTotalsQuery = `
      SELECT 
        resource_type,
        SUM(amount) as calculated_total
      FROM guild_resource_transactions 
      WHERE guild_id = ?
      GROUP BY resource_type
    `;

    const calculatedTotals = this.db
      .prepare(resourceTotalsQuery)
      .all(guildId.value);

    const recordedTotalsQuery = `
      SELECT resource_type, amount as recorded_total
      FROM guild_resources 
      WHERE guild_id = ?
    `;

    const recordedTotals = this.db
      .prepare(recordedTotalsQuery)
      .all(guildId.value);

    // 构建对比映射
    const calculatedMap = new Map(
      calculatedTotals.map(r => [r.resource_type, r.calculated_total])
    );
    const recordedMap = new Map(
      recordedTotals.map(r => [r.resource_type, r.recorded_total])
    );

    // 检查每种资源的一致性
    for (const [resourceType, recordedTotal] of recordedMap) {
      const calculatedTotal = calculatedMap.get(resourceType) || 0;

      if (Math.abs(calculatedTotal - recordedTotal) > 0.01) {
        // 允许浮点误差
        violations.push({
          type: 'RESOURCE_TOTAL_MISMATCH',
          description: `Resource total mismatch for ${resourceType}: recorded=${recordedTotal}, calculated=${calculatedTotal}`,
          severity: 'HIGH',
          guildId,
          resourceType,
          expectedValue: calculatedTotal,
          actualValue: recordedTotal,
          fixSuggestion: `UPDATE guild_resources SET amount = ${calculatedTotal} WHERE guild_id = ? AND resource_type = '${resourceType}'`,
        });
      }
    }
  }

  // 权限分配一致性验证
  private async validatePermissionConsistency(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<void> {
    const leaderCountQuery = `
      SELECT COUNT(*) as leader_count 
      FROM guild_members 
      WHERE guild_id = ? AND role = 'leader'
    `;

    const leaderCount = this.db
      .prepare(leaderCountQuery)
      .get(guildId.value).leader_count;

    // 每个公会必须且只能有一个会长
    if (leaderCount !== 1) {
      violations.push({
        type: 'INVALID_LEADER_COUNT',
        description: `Invalid leader count: expected=1, actual=${leaderCount}`,
        severity: 'CRITICAL',
        guildId,
        expectedValue: 1,
        actualValue: leaderCount,
        fixSuggestion:
          leaderCount === 0
            ? 'Assign a leader role'
            : 'Remove duplicate leaders',
      });
    }

    // 验证权限等级一致性
    const invalidPermissionsQuery = `
      SELECT gm.user_id, gm.role, gp.permission
      FROM guild_members gm
      JOIN guild_permissions gp ON gm.user_id = gp.user_id AND gm.guild_id = gp.guild_id
      WHERE gm.guild_id = ? AND gp.permission NOT IN (
        SELECT permission FROM role_permissions WHERE role = gm.role
      )
    `;

    const invalidPermissions = this.db
      .prepare(invalidPermissionsQuery)
      .all(guildId.value);

    for (const invalid of invalidPermissions) {
      violations.push({
        type: 'INVALID_PERMISSION_ASSIGNMENT',
        description: `Invalid permission '${invalid.permission}' for role '${invalid.role}' of user ${invalid.user_id}`,
        severity: 'MEDIUM',
        guildId,
        userId: invalid.user_id,
        fixSuggestion: `Remove invalid permission or update user role`,
      });
    }
  }

  // 自动修复数据不一致问题
  async autoFixIntegrityIssues(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<FixResult> {
    const fixedIssues: string[] = [];
    const failedFixes: string[] = [];

    const transaction = this.db.transaction(() => {
      for (const violation of violations) {
        try {
          switch (violation.type) {
            case 'MEMBER_COUNT_MISMATCH':
              this.fixMemberCountMismatch(guildId, violation);
              fixedIssues.push(`Fixed member count mismatch`);
              break;

            case 'RESOURCE_TOTAL_MISMATCH':
              this.fixResourceTotalMismatch(guildId, violation);
              fixedIssues.push(
                `Fixed resource total for ${violation.resourceType}`
              );
              break;

            case 'INVALID_PERMISSION_ASSIGNMENT':
              this.fixInvalidPermission(guildId, violation);
              fixedIssues.push(
                `Fixed invalid permission for user ${violation.userId}`
              );
              break;

            default:
              failedFixes.push(`Cannot auto-fix: ${violation.type}`);
          }
        } catch (error) {
          failedFixes.push(`Failed to fix ${violation.type}: ${error.message}`);
        }
      }
    });

    transaction();

    // 发布修复完成事件
    await this.eventBus.publish(
      new DataIntegrityFixedEvent(guildId, fixedIssues, failedFixes)
    );

    return {
      fixedCount: fixedIssues.length,
      failedCount: failedFixes.length,
      fixedIssues,
      failedFixes,
    };
  }

  // 修复成员数量不匹配
  private fixMemberCountMismatch(
    guildId: GuildId,
    violation: IntegrityViolation
  ): void {
    const updateSql = `UPDATE guilds SET member_count = ? WHERE id = ?`;
    this.db.prepare(updateSql).run(violation.expectedValue, guildId.value);
  }

  // 修复资源总量不匹配
  private fixResourceTotalMismatch(
    guildId: GuildId,
    violation: IntegrityViolation
  ): void {
    const updateSql = `
      UPDATE guild_resources 
      SET amount = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ? AND resource_type = ?
    `;
    this.db
      .prepare(updateSql)
      .run(violation.expectedValue, guildId.value, violation.resourceType);
  }

  // 修复无效权限分配
  private fixInvalidPermission(
    guildId: GuildId,
    violation: IntegrityViolation
  ): void {
    const deleteSql = `
      DELETE FROM guild_permissions 
      WHERE guild_id = ? AND user_id = ? AND permission = ?
    `;
    this.db
      .prepare(deleteSql)
      .run(guildId.value, violation.userId, violation.permission);
  }
}
```

### 5.5 缓存策略与性能优化

#### 5.5.1 多级缓存架构

```typescript
// 多级缓存管理器
class MultiLevelCacheManager {
  private l1Cache: Map<string, any>; // 组件级内存缓存
  private l2Cache: Map<string, any>; // 应用级Redux缓存
  private l3Cache: Database; // SQLite内存数据库
  private eventBus: IEventBus;

  constructor(l3Database: Database, eventBus: IEventBus) {
    this.l1Cache = new Map();
    this.l2Cache = new Map();
    this.l3Cache = l3Database;
    this.eventBus = eventBus;

    this.setupCacheInvalidationHandlers();
  }

  // L1缓存操作（最快，生命周期短）
  setL1<T>(key: string, value: T, ttlMs: number = 30000): void {
    const expiry = Date.now() + ttlMs;
    this.l1Cache.set(key, { value, expiry });

    // 设置自动过期
    setTimeout(() => {
      this.l1Cache.delete(key);
    }, ttlMs);
  }

  getL1<T>(key: string): T | null {
    const cached = this.l1Cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.l1Cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  // L2缓存操作（中速，应用级生命周期）
  setL2<T>(key: string, value: T): void {
    this.l2Cache.set(key, {
      value,
      cachedAt: Date.now(),
      accessCount: 0,
    });
  }

  getL2<T>(key: string): T | null {
    const cached = this.l2Cache.get(key);
    if (!cached) return null;

    cached.accessCount++;
    cached.lastAccessed = Date.now();

    return cached.value as T;
  }

  // L3缓存操作（较慢，但持久性强）
  async setL3<T>(
    key: string,
    value: T,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const expiry = new Date(Date.now() + ttlSeconds * 1000);
    const serialized = JSON.stringify(value);

    const sql = `
      INSERT OR REPLACE INTO cache_entries 
      (key, value, expires_at, created_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;

    this.l3Cache.prepare(sql).run(key, serialized, expiry.toISOString());
  }

  async getL3<T>(key: string): Promise<T | null> {
    const sql = `
      SELECT value FROM cache_entries 
      WHERE key = ? AND expires_at > CURRENT_TIMESTAMP
    `;

    const result = this.l3Cache.prepare(sql).get(key);
    if (!result) return null;

    try {
      return JSON.parse(result.value) as T;
    } catch (error) {
      // 反序列化失败，删除无效缓存
      this.deleteL3(key);
      return null;
    }
  }

  // 智能缓存获取（尝试所有级别）
  async getFromCache<T>(key: string): Promise<T | null> {
    // 1. 尝试L1缓存
    let value = this.getL1<T>(key);
    if (value !== null) {
      return value;
    }

    // 2. 尝试L2缓存
    value = this.getL2<T>(key);
    if (value !== null) {
      // 将L2的值提升到L1
      this.setL1(key, value, 30000);
      return value;
    }

    // 3. 尝试L3缓存
    value = await this.getL3<T>(key);
    if (value !== null) {
      // 将L3的值提升到L2和L1
      this.setL2(key, value);
      this.setL1(key, value, 30000);
      return value;
    }

    return null;
  }

  // 智能缓存存储（存储到合适的级别）
  async setToCache<T>(
    key: string,
    value: T,
    strategy: CacheStrategy
  ): Promise<void> {
    switch (strategy.level) {
      case 'L1_ONLY':
        this.setL1(key, value, strategy.ttlMs);
        break;

      case 'L2_ONLY':
        this.setL2(key, value);
        break;

      case 'L3_ONLY':
        await this.setL3(key, value, strategy.ttlSeconds);
        break;

      case 'ALL_LEVELS':
        this.setL1(key, value, strategy.ttlMs || 30000);
        this.setL2(key, value);
        await this.setL3(key, value, strategy.ttlSeconds || 3600);
        break;

      case 'L2_L3':
        this.setL2(key, value);
        await this.setL3(key, value, strategy.ttlSeconds || 3600);
        break;
    }
  }

  // 缓存失效处理
  private setupCacheInvalidationHandlers(): void {
    // 公会数据变更时失效相关缓存
    this.eventBus.on('guild.updated', async (event: GuildUpdatedEvent) => {
      const patterns = [
        `guild:${event.guildId}:*`,
        `guild:${event.guildId}:members`,
        `guild:${event.guildId}:statistics`,
        `guild:${event.guildId}:resources`,
      ];

      await this.invalidateByPatterns(patterns);
    });

    // 成员变更时失效相关缓存
    this.eventBus.on(
      'guild.member.joined',
      async (event: MemberJoinedEvent) => {
        await this.invalidateByPatterns([
          `guild:${event.guildId}:members`,
          `guild:${event.guildId}:statistics`,
          `user:${event.memberId}:guilds`,
        ]);
      }
    );

    // 战斗结束时失效相关缓存
    this.eventBus.on('combat.battle.ended', async (event: BattleEndedEvent) => {
      await this.invalidateByPatterns([
        `battle:${event.battleId}:*`,
        `guild:${event.attackerGuildId}:battle_stats`,
        `guild:${event.defenderGuildId}:battle_stats`,
      ]);
    });
  }

  // 按模式失效缓存
  private async invalidateByPatterns(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      // L1和L2缓存：使用通配符匹配
      const regex = new RegExp(pattern.replace('*', '.*'));

      for (const key of this.l1Cache.keys()) {
        if (regex.test(key)) {
          this.l1Cache.delete(key);
        }
      }

      for (const key of this.l2Cache.keys()) {
        if (regex.test(key)) {
          this.l2Cache.delete(key);
        }
      }

      // L3缓存：SQL LIKE查询
      const sqlPattern = pattern.replace('*', '%');
      const sql = `DELETE FROM cache_entries WHERE key LIKE ?`;
      this.l3Cache.prepare(sql).run(sqlPattern);
    }
  }

  // 缓存统计信息
  getCacheStats(): CacheStats {
    const l1Size = this.l1Cache.size;
    const l2Size = this.l2Cache.size;

    const l3Stats = this.l3Cache
      .prepare(
        `
      SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_entries,
        SUM(LENGTH(value)) as total_size_bytes
      FROM cache_entries
    `
      )
      .get();

    return {
      l1: { size: l1Size, type: 'Memory' },
      l2: { size: l2Size, type: 'Memory' },
      l3: {
        totalEntries: l3Stats.total_entries,
        activeEntries: l3Stats.active_entries,
        sizeBytes: l3Stats.total_size_bytes,
        type: 'SQLite',
      },
      generatedAt: new Date(),
    };
  }
}
```

这个第3个文件包含了系统架构和数据设计的核心内容，整合了原版19章文档中的API架构系列、数据库设计和业务逻辑等重要内容。接下来我将继续创建第4个文件。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "\u521b\u5efa\u589e\u5f3a\u7248AI\u4f18\u5148\u67b6\u6784\u6587\u6863\uff0c\u6574\u5408\u539f\u724819\u7ae0\u6240\u6709\u5185\u5bb9", "status": "in_progress", "id": "create_enhanced_ai_first_doc"}, {"content": "\u6587\u4ef61\uff1a\u57fa\u7840\u7ea6\u675f\u4e0e\u5b89\u5168\u9632\u62a4\uff08\u7b2c1-2\u7ae0\uff09", "status": "completed", "id": "create_file1_constraints_security"}, {"content": "\u7ea6\u675f\u4e0e\u76ee\u6807\uff08\u878d\u5408\u98ce\u9669\u8bc4\u4f30+\u5f00\u53d1\u89c4\u8303\uff09", "status": "completed", "id": "enhance_chapter1_constraints"}, {"content": "\u5a01\u80c1\u6a21\u578b\u4e0e\u5b89\u5168\u57fa\u7ebf\uff08\u878d\u5408\u5b89\u5168\u8bbe\u8ba1+Electron\u62a4\u680f\uff09", "status": "completed", "id": "enhance_chapter2_security"}, {"content": "\u6587\u4ef62\uff1a\u8d28\u91cf\u6cd5\u89c4\u4e0e\u6d4b\u8bd5\u7b56\u7565\uff08\u7b2c3\u7ae0\uff09", "status": "completed", "id": "create_file2_testing"}, {"content": "\u6d4b\u8bd5\u7b56\u7565\u4e0e\u8d28\u91cf\u95e8\u7981\uff08\u76f4\u63a5\u91c7\u7528\u6df7\u5408\u4f18\u5316\u7248\u6cd5\u89c4\u4e2d\u5fc3\uff09", "status": "completed", "id": "insert_chapter3_testing"}, {"content": "\u6587\u4ef63\uff1a\u7cfb\u7edf\u67b6\u6784\u4e0e\u6570\u636e\u8bbe\u8ba1\uff08\u7b2c4-5\u7ae0\uff09", "status": "completed", "id": "create_file3_system_data"}, {"content": "\u7cfb\u7edf\u4e0a\u4e0b\u6587\u4e0eC4+\u4e8b\u4ef6\u6d41\uff08\u878d\u5408API\u67b6\u6784\u7cfb\u5217\uff09", "status": "completed", "id": "enhance_chapter4_context"}, {"content": "\u6570\u636e\u6a21\u578b\u4e0e\u5b58\u50a8\u7aef\u53e3\uff08\u878d\u5408\u6570\u636e\u5e93\u8bbe\u8ba1+\u4e1a\u52a1\u903b\u8f91\uff09", "status": "completed", "id": "enhance_chapter5_data"}, {"content": "\u6587\u4ef64\uff1a\u6838\u5fc3\u5b9e\u73b0\u4e0eAI\u5f15\u64ce\uff08\u7b2c6\u7ae0\uff09", "status": "in_progress", "id": "create_file4_runtime_ai"}, {"content": "\u8fd0\u884c\u65f6\u89c6\u56fe\uff08\u878d\u5408\u6e38\u620f\u6838\u5fc3\u7cfb\u7edf+AI\u5f15\u64ce\u8be6\u7ec6\u67b6\u6784\uff09", "status": "pending", "id": "enhance_chapter6_runtime"}, {"content": "\u6587\u4ef65\uff1a\u5f00\u53d1\u73af\u5883\u4e0e\u529f\u80fd\u5b9e\u73b0\uff08\u7b2c7-8\u7ae0\uff09", "status": "pending", "id": "create_file5_dev_features"}, {"content": "\u5f00\u53d1\u73af\u5883\u4e0e\u6784\u5efa\uff08\u878d\u5408\u7ef4\u62a4\u7b56\u7565+\u90e8\u7f72\u8fd0\u7ef4\uff09", "status": "pending", "id": "enhance_chapter7_devenv"}, {"content": "\u529f\u80fd\u7eb5\u5207\uff08\u878d\u5408\u56fd\u9645\u5316\u652f\u6301+\u524d\u7aef\u67b6\u6784\u8bbe\u8ba1\uff09", "status": "pending", "id": "enhance_chapter8_vertical"}, {"content": "\u6587\u4ef66\uff1a\u6027\u80fd\u89c4\u5212\u4e0e\u8fd0\u7ef4\u4fdd\u969c\uff08\u7b2c9\u7ae0\uff09", "status": "pending", "id": "create_file6_performance"}, {"content": "\u6027\u80fd\u4e0e\u5bb9\u91cf\u89c4\u5212\uff08\u878d\u5408\u6027\u80fd\u4f18\u5316\u65b9\u6848+\u98ce\u9669\u8bc4\u4f30\u5e94\u5bf9\uff09", "status": "pending", "id": "enhance_chapter9_performance"}]
