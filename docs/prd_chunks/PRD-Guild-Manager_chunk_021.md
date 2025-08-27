---
PRD-ID: "PRD-GM-PRD-GUILD-MANAGER_CHUNK_021"
Title: "公会管理器PRD - 分片21"
Status: "Active"
Owner: "Product-Team"
Created: "2024-12-01T00:00:00Z"
Updated: "2025-08-22T17: 08: 02.242Z"
Version: "v1.2.0"
Priority: "High"
Risk: "Medium"
Depends-On:
  - "PRD-GM-BASE-ARCHITECTURE"
chunk: "21/24"
size: "6619 chars"
source: "/guild-manager/chunk-021"
Arch-Refs: [CH01, CH03, CH04, CH05]
Test-Refs:
  - "tests/unit/guild-manager-chunk-021.spec.ts"
Monitors:
  - "txn.prd-guild-manager_chunk_021.primary"
SLO-Refs:
  - "UI_P95_100ms"
  - "EVENT_P95_50ms"
  - "CRASH_FREE_99.5"
ADRs: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009]
Release_Gates:
  Quality_Gate:
    enabled: true
    threshold: "unit_test_coverage >= 80%"
    blockingFailures:
      - "test_failures"
      - "coverage_below_threshold"
    windowHours: 24
  Security_Gate:
    enabled: true
    threshold: "security_scan_passed == true"
    blockingFailures:
      - "security_vulnerabilities"
      - "dependency_vulnerabilities"
    windowHours: 12
  Performance_Gate:
    enabled: true
    threshold: "p95_response_time <= 100ms"
    blockingFailures:
      - "performance_regression"
      - "memory_leaks"
    windowHours: 6
  Acceptance_Gate:
    enabled: true
    threshold: "acceptance_criteria_met >= 95%"
    blockingFailures:
      - "acceptance_test_failures"
      - "user_story_incomplete"
    windowHours: 48
  API_Contract_Gate:
    enabled: true
    threshold: "api_contract_compliance >= 100%"
    blockingFailures:
      - "contract_violations"
      - "breaking_changes"
    windowHours: 12
  Sentry_Release_Health_Gate:
    enabled: true
    threshold: "crash_free_users >= 99.5% AND crash_free_sessions >= 99.9%"
    blockingFailures:
      - "crash_free_threshold_violation"
      - "insufficient_adoption_data" 
      - "release_health_regression"
    windowHours: 24
    params:
      sloRef: "CRASH_FREE_99.5"
      thresholds:
        crashFreeUsers: 99.5
        crashFreeSessions: 99.9
        minAdoptionPercent: 25
        durationHours: 24

Contract_Definitions:
  types:
    - "src/shared/contracts/guild/chunk-021-types.ts"
  events:
    specversion: "1.0"
    id: "guild-manager-chunk-021-w4uy2k8s"
    time: "2025-08-24T15: 18: 34.517Z"
    type: "com.guildmanager.chunk021.event"
    source: "/guild-manager/chunk-021"
    subject: "guild-management-chunk-21"
    datacontenttype: "application/json"
    dataschema: "src/shared/contracts/guild/chunk-021-events.ts"
  interfaces:
    - "src/shared/contracts/guild/chunk-021-interfaces.ts"
  validation_rules:
    - "src/shared/validation/chunk-021-validation.ts"

Security_Policies:
permissions:
read:
  - "guild-member"
  - "guild-officer"
  - "guild-master"
write:
  - "guild-officer"
  - "guild-master"
admin:
  - "guild-master"
  - "system-admin"
cspNotes: "Electron CSP: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; connect-src 'self' https://api.${PRODUCT_DOMAIN}; style-src 'self' 'nonce-${NONCE_PLACEHOLDER}'; img-src 'self' data: https: ; font-src 'self'"
Traceability_Matrix:
requirementTags:
  - "guild-management"
  - "user-experience"
  - "performance"
acceptance:
functional: "功能需求100%实现"
performance: "性能指标达到SLO要求"
security: "安全要求完全满足"
usability: "用户体验达到设计标准"
evidence:
implementation: "源代码实现"
testing: "自动化测试覆盖"
documentation: "技术文档完备"
validation: "用户验收确认"
---
## 4. 技术架构规范

### 4.1 技术栈选择

#### 4.1.1 核心技术栈
```typescript
// 确认的技术选择 (Windows专用版本)
const TechStack = {
  desktop: "Electron",           // Windows桌面应用
  gameEngine: "Phaser 3",        // 游戏逻辑和时间管理
  uiFramework: "React 19",       // 复杂界面和数据展示
  buildTool: "Vite",            // 开发和构建工具
  language: "TypeScript",        // 全栈类型安全
  styling: "Tailwind CSS",       // 原子化CSS开发
  dataStorage: "SQLite",         // 高性能本地数据库
  aiComputing: "Web Worker",     // AI计算线程分离
  configStorage: "Local JSON",   // 配置文件存储
  communication: "EventBus"      // Phaser ↔ React通信
}

// 性能优化架构
const PerformanceStack = {
  aiWorker: "Dedicated Web Worker",    // 专用AI计算线程
  database: "SQLite with WAL mode",   // 高并发数据库模式
  caching: "LRU Memory Cache",        // 智能内存缓存
  eventQueue: "Priority Queue System" // 事件优先级队列
}
```

#### 4.1.2 架构设计原则
- **事件驱动**: 所有系统基于事件通信
- **模块化**: 清晰的模块边界，支持并行开发
- **可扩展**: 插件化架构支持DLC和功能扩展
- **离线优先**: 本地数据存储，无网络依赖

### 4.2 系统架构设计

#### 4.2.1 整体架构图
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Container                       │
├─────────────────────────────────────────────────────────────┤
│  React UI Layer                  │  Phaser Game Layer      │
│  ├── Dashboard Components        │  ├── Game State Mgr    │
│  ├── Form Interactions          │  ├── Event Engine      │
│  ├── Data Visualization         │  ├── AI Coordinator    │
│  └── Modal Systems              │  └── Time Manager      │
├─────────────────────────────────────────────────────────────┤
│                     EventBus Communication                  │
├─────────────────────────────────────────────────────────────┤
│  Core Game Logic (TypeScript)                              │
│  ├── Event System Engine        │  ├── AI Behavior Mgr   │
│  ├── State Management          │  ├── Data Validation   │
│  ├── Business Logic            │  └── Save/Load System  │
├─────────────────────────────────────────────────────────────┤
│                    Local JSON Storage                       │
│  ├── Events Data               │  ├── AI Personalities  │
│  ├── Game State               │  └── User Preferences  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 核心组件规格

**事件引擎核心**
```typescript
class EventEngine {
  private eventPool: Map<string, EventTemplate>
  private activeEvents: Map<string, ActiveEvent>
  private eventQueue: PriorityQueue<PendingEvent>
  
  // 核心功能
  processGameCycle(gameWeek: number): void
  evaluateEventConditions(context: GameContext): EventTrigger[]
  executeEventEffects(event: ActiveEvent): EventResult
  resolveEventConflicts(conflicts: EventConflict[]): Resolution[]
  
  // 扩展接口
  registerPlugin(plugin: EventPlugin): void
  validateEventDefinition(event: EventTemplate): ValidationResult
}
```

**AI协调系统**
```typescript
class AICoordinator {
  private guildAIs: Map<string, NPCGuildAI>
  private memberAIs: Map<string, GuildMemberAI>
  private environmentAI: EnvironmentAI
  
  // 协调功能
  processAICycle(): AIAction[]
  resolveAIConflicts(conflicts: AIConflict[]): Resolution[]
  updateRelationshipNetwork(): void
  generateAIEvents(): AITriggeredEvent[]
}
```

### 4.3 性能要求

#### 4.3.1 性能指标
| 指标类型 | 目标值 | 测量方法 |
|----------|--------|----------|
| 启动时间 | <10秒 | 应用启动到主界面可用 |
| 内存使用 | <2GB | 运行时峰值内存消耗 |
| 响应时间 | <500ms | UI交互响应时间 |
| 事件处理 | <200ms | 单个事件的处理时间 |
| 数据加载 | <3秒 | 游戏存档加载时间 |

#### 4.3.2 扩展性要求
- **事件池**: 支持扩展至1000+事件而不影响性能
- **AI数量**: 支持200+AI实体同时运行
- **数据规模**: 支持10MB+的游戏存档文件
- **并发处理**: 支持多个系统的并发操作

### 4.4 安全性和数据保护

#### 4.4.1 数据安全
```typescript
interface DataSecurity {
  backup: {
    autoBackup: boolean          // 自动备份功能
    backupFrequency: number      // 备份频率（分钟）
    maxBackups: number          // 最大备份数量
  }
  
  validation: {
    schemaValidation: boolean    // JSON结构验证
    dataIntegrity: boolean      // 数据完整性检查
    checksumVerification: boolean // 校验和验证
  }
  
  recovery: {
    corruptionDetection: boolean // 损坏检测
    autoRecovery: boolean       // 自动恢复
    manualRestore: boolean      // 手动恢复选项
  }
}
```

#### 4.4.2 用户隐私
- **本地存储**: 所有数据存储在用户本地，无云端收集
- **无网络通信**: 游戏运行无需网络连接
- **可选遥测**: 性能数据收集需用户明确同意

**Acceptance（就地验收，占位）**
- P95 ≤ 200ms 首屏反馈；≤1s 上报 `txn.prd-guild-manager_chunk_021.primary`。