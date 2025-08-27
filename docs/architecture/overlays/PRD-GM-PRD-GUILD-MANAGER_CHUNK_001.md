---
PRD-ID: "PRD-GM-PRD-GUILD-MANAGER_CHUNK_001"
title: "Overlay: PRD-GM-PRD-GUILD-MANAGER_CHUNK_001 — 公会管理器PRD - 分片1"
status: "overlay-active"
owner: "Product-Team"
created: "2025-08-23T00:00:00Z"
version: "v1.0.0"
priority: "High"
Arch-Refs:
  - "01-introduction-and-goals-v2"
  - "03-observability-sentry-logging-v2"
  - "04-system-context-c4-event-flows-v2"
  - "05-data-models-and-storage-ports-v2"
Test-Refs:
  - "tests/unit/guild-manager-chunk-001.spec.ts"
  - "tests/e2e/guild-manager-chunk-001.e2e.ts"
Monitors:
  - "txn.prd-guild-manager_chunk_001.primary"
SLO-Refs:
  - "UI_P95_100ms"
  - "EVENT_P95_50ms"
  - "CRASH_FREE_99.5"
ADRs:
  - "ADR-0001-tech-stack"
  - "ADR-0003-observability-release-health"
  - "ADR-0004-event-bus-and-contracts"
  - "ADR-0005-quality-gates"
  - "ADR-0006-data-storage-architecture"
  - "ADR-0007-ports-adapters-pattern"
  - "ADR-0008-deployment-release-strategy"
---

# Overlay: PRD-GM-PRD-GUILD-MANAGER_CHUNK_001 — 公会管理器PRD - 分片1

> **目的**: 基于Base架构，实现公会管理器PRD分片1的具体功能纵切，包含事件系统、AI生态、回合制系统的领域细节与技术实现。

---

## O1. 背景与范围（Overlay Scope）

### 1.1 PRD分片概述
本分片专注实现《公会经理》游戏的核心管理循环：
- **回合制系统架构**: 3阶段回合制（结算-玩家-AI模拟）
- **事件池系统**: 200+基础事件驱动的管理决策
- **AI生态系统**: 三层AI架构（成员AI、NPC公会AI、环境AI）
- **公会管理模块**: 工作面板、会长邮箱、基础管理功能

### 1.2 技术约束与依赖
基于Base章节的约束：
- **技术栈**: Electron + React 19 + Phaser 3 + TypeScript（ADR-0001）
- **安全基线**: `nodeIntegration=false`、`contextIsolation=true`（ADR-0002）
- **数据持久化**: SQLite WAL模式，端口-适配器架构（ADR-0006, ADR-0007）
- **事件总线**: CloudEvents 1.0标准，跨平台兼容（ADR-0004）

### 1.3 功能边界
**包含范围（In-Scope）**:
- 回合制游戏循环的完整实现
- 工作面板信息中枢功能
- 会长邮箱事件驱动系统
- 基础AI决策和状态管理
- 事件触发和处理机制

**排除范围（Out-of-Scope）**:
- 完整的战斗系统（属于后续分片）
- 复杂的社交网络（属于后续分片）
- 外部集成功能
- 多人协作功能

---

## O2. 实体/事件表（CloudEvents 1.0）

### 2.1 核心实体定义

```typescript
// 公会管理核心实体
interface Guild {
  id: GuildId;
  name: string;
  level: number;
  reputation: number;
  resources: ResourceState;
  members: GuildMember[];
  currentTurn: number;
  status: GuildStatus;
  updatedAt: string;
}

interface GuildMember {
  id: MemberId;
  name: string;
  level: number;
  role: MemberRole;
  personalityTraits: PersonalityTraits;
  relationships: RelationshipMap;
  currentState: MemberState;
  aiGoals: PersonalGoal[];
  updatedAt: string;
}

interface GameTurn {
  id: TurnId;
  weekNumber: number;
  currentPhase: TurnPhase;
  startedAt: string;
  phaseDeadlines: PhaseDeadlines;
  pendingDecisions: CriticalDecision[];
}
```

### 2.2 CloudEvents 事件规范

基于Base章节04的CloudEvents 1.0标准：

```typescript
// 公会管理器领域事件
export type GuildManagerEvent = 
  | 'gm.guild.turn.started'
  | 'gm.guild.turn.phase_changed'
  | 'gm.guild.turn.completed'
  | 'gm.member.state_changed'
  | 'gm.member.relationship_updated'
  | 'gm.decision.created'
  | 'gm.decision.resolved'
  | 'gm.event.triggered'
  | 'gm.ai.action_executed'
  | 'gm.workpanel.data_updated';

// 事件源标识
export const GUILD_EVENT_SOURCES = {
  TURN_SYSTEM: 'gm://turn-system',
  AI_ENGINE: 'gm://ai-engine',
  WORK_PANEL: 'gm://work-panel',
  MAILBOX: 'gm://mailbox',
  MEMBER_MANAGER: 'gm://member-manager'
} as const;

// CloudEvents样例
interface GuildTurnStartedEvent extends CloudEventV1<{
  guildId: GuildId;
  weekNumber: number;
  previousPhaseResults: PhaseResult[];
}> {
  type: 'gm.guild.turn.started';
  source: 'gm://turn-system';
  subject: 'guild-turn-management';
}

interface MemberStateChangedEvent extends CloudEventV1<{
  memberId: MemberId;
  guildId: GuildId;
  previousState: MemberState;
  newState: MemberState;
  trigger: StateChangeTrigger;
}> {
  type: 'gm.member.state_changed';
  source: 'gm://ai-engine';
  subject: 'member-ai-behavior';
}
```

---

## O3. 合同/端口/数据口径

### 3.1 数据端口定义

基于Base章节05的端口-适配器模式：

```typescript
// 公会管理器数据端口
export interface IGuildRepository extends IRepository<Guild, GuildId> {
  findByLevel(minLevel: number): Promise<Guild[]>;
  findByStatus(status: GuildStatus): Promise<Guild[]>;
  updateResources(id: GuildId, resources: ResourceState): Promise<void>;
  incrementTurn(id: GuildId): Promise<number>;
}

export interface IMemberRepository extends IRepository<GuildMember, MemberId> {
  findByGuildId(guildId: GuildId): Promise<GuildMember[]>;
  findByRole(role: MemberRole): Promise<GuildMember[]>;
  findByState(state: MemberState): Promise<GuildMember[]>;
  updateState(id: MemberId, newState: MemberState): Promise<void>;
  updateRelationships(id: MemberId, relationships: RelationshipMap): Promise<void>;
}

export interface ITurnRepository extends IRepository<GameTurn, TurnId> {
  getCurrentTurn(guildId: GuildId): Promise<GameTurn | null>;
  findByPhase(phase: TurnPhase): Promise<GameTurn[]>;
  updatePhase(id: TurnId, newPhase: TurnPhase): Promise<void>;
}
```

### 3.2 业务服务端口

```typescript
// 公会管理业务服务
export interface IGuildManagementService extends Port {
  readonly portType: 'primary';
  
  // 回合制系统
  startNewTurn(guildId: GuildId): Promise<TurnStartResult>;
  executeResolutionPhase(turnId: TurnId): Promise<ResolutionResult>;
  advanceToPlayerPhase(turnId: TurnId): Promise<PlayerPhaseResult>;
  executeAIPhase(turnId: TurnId): Promise<AISimulationResult>;
  
  // 工作面板
  getWorkPanelData(guildId: GuildId): Promise<WorkPanelData>;
  refreshGuildStats(guildId: GuildId): Promise<GuildStats>;
  
  // 邮箱系统
  getMailboxEvents(guildId: GuildId): Promise<MailboxEvent[]>;
  processDecision(decisionId: DecisionId, choice: DecisionChoice): Promise<DecisionResult>;
  
  // AI管理
  triggerMemberAI(memberId: MemberId): Promise<AIActionResult[]>;
  updateMemberRelationships(memberId: MemberId): Promise<RelationshipUpdateResult>;
}

export interface IEventSystemService extends Port {
  readonly portType: 'primary';
  
  triggerEvent(eventId: EventId, context: EventContext): Promise<EventResult>;
  processEventQueue(guildId: GuildId): Promise<ProcessedEvent[]>;
  registerEventHandler(eventType: string, handler: EventHandler): void;
  getAvailableEvents(guildId: GuildId, filters: EventFilters): Promise<GameEvent[]>;
}
```

---

## O4. SLI/SLO 与放量门禁

### 4.1 服务水平指标（SLI）

基于Base章节01的SLO框架：

```typescript
// 公会管理器性能指标
export interface GuildManagerSLI {
  // UI响应时间
  workPanelLoadTime: Metric<'ms'>;      // 工作面板加载时间
  mailboxLoadTime: Metric<'ms'>;        // 邮箱加载时间  
  turnPhaseTransitionTime: Metric<'ms'>; // 回合阶段切换时间
  
  // AI处理性能
  memberAIDecisionTime: Metric<'ms'>;    // 成员AI决策时间
  eventProcessingTime: Metric<'ms'>;     // 事件处理时间
  
  // 数据一致性
  turnStateConsistency: Metric<'%'>;     // 回合状态一致性
  memberDataSyncRate: Metric<'%'>;       // 成员数据同步率
  
  // 错误率指标
  aiDecisionErrorRate: Metric<'%'>;      // AI决策错误率
  eventTriggerFailureRate: Metric<'%'>;  // 事件触发失败率
}
```

### 4.2 服务水平目标（SLO）

| 指标类别 | SLO目标 | 度量窗口 | 错误预算 |
|---------|---------|----------|----------|
| UI响应性能 | 工作面板加载 P95 ≤ 100ms | 24h滚动 | 5% |
| AI处理性能 | 成员AI决策 P95 ≤ 50ms | 1h窗口 | 2% |
| 回合系统 | 阶段切换 P95 ≤ 200ms | 1h窗口 | 3% |
| 数据一致性 | 状态同步率 ≥ 99.5% | 24h滚动 | 0.5% |
| 系统可靠性 | Crash-Free Sessions ≥ 99.5% | 24h滚动 | 0.5% |

### 4.3 放量门禁

基于Base章节01的Release Health门禁：

```typescript
// 公会管理器放量策略
export interface GuildManagerReleaseGate {
  sloThresholds: {
    workPanelP95: number;      // ≤ 100ms
    aiDecisionP95: number;     // ≤ 50ms  
    turnTransitionP95: number; // ≤ 200ms
    crashFreeSessions: number; // ≥ 0.995
    crashFreeUsers: number;    // ≥ 0.995
  };
  
  qualityGates: {
    unitTestCoverage: number;  // ≥ 80%
    e2eTestPass: boolean;      // true
    performanceRegression: boolean; // false
  };
  
  adoptionGates: {
    minAdoptionRate: number;   // ≥ 0.05
    windowHours: number;       // 24
  };
}
```

---

## O5. 安全收口

### 5.1 Electron安全基线应用

严格遵循Base章节02的安全约束：

```typescript
// preload脚本白名单API
export interface GuildManagerContextBridge {
  // 安全的IPC通信
  guildManager: {
    // 回合制系统
    startTurn: (guildId: string) => Promise<TurnStartResult>;
    getPhaseStatus: (turnId: string) => Promise<PhaseStatus>;
    
    // 工作面板
    getWorkPanelData: (guildId: string) => Promise<WorkPanelData>;
    
    // 邮箱系统  
    getMailboxEvents: (guildId: string) => Promise<MailboxEvent[]>;
    processDecision: (decisionId: string, choice: DecisionChoice) => Promise<DecisionResult>;
    
    // 订阅事件（安全事件总线）
    onEvent: (callback: (event: CloudEventV1) => void) => () => void;
  };
}

// CSP策略（无额外内联脚本需求）
const cspPolicy = `
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self';
`;
```

### 5.2 权限控制

```typescript
// 公会管理权限模型
export enum GuildManagerPermission {
  READ_GUILD_DATA = 'guild:read',
  WRITE_GUILD_DATA = 'guild:write', 
  MANAGE_MEMBERS = 'members:manage',
  PROCESS_TURNS = 'turns:process',
  VIEW_AI_DECISIONS = 'ai:view',
  ADMIN_OVERRIDE = 'admin:override'
}

export interface PermissionContext {
  userId: string;
  guildId: string;
  role: MemberRole;
  permissions: GuildManagerPermission[];
}
```

---

## O6. 运行时主路径/状态机/错误路径

### 6.1 回合制系统状态机

```typescript
// 回合系统核心状态机
export enum TurnPhase {
  IDLE = 'idle',
  RESOLUTION = 'resolution', 
  PLAYER = 'player',
  AI_SIMULATION = 'ai_simulation',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface TurnStateMachine {
  currentPhase: TurnPhase;
  
  // 状态转换
  transitions: {
    [TurnPhase.IDLE]: [TurnPhase.RESOLUTION];
    [TurnPhase.RESOLUTION]: [TurnPhase.PLAYER, TurnPhase.ERROR];
    [TurnPhase.PLAYER]: [TurnPhase.AI_SIMULATION, TurnPhase.ERROR];
    [TurnPhase.AI_SIMULATION]: [TurnPhase.COMPLETED, TurnPhase.ERROR];
    [TurnPhase.COMPLETED]: [TurnPhase.IDLE];
    [TurnPhase.ERROR]: [TurnPhase.IDLE, TurnPhase.RESOLUTION];
  };
}
```

### 6.2 主要业务流程

```typescript
// 回合制主流程
export class TurnSystemWorkflow {
  async executeCompleteTurn(guildId: GuildId): Promise<TurnResult> {
    const turn = await this.turnRepository.getCurrentTurn(guildId);
    let currentPhase = turn.currentPhase;
    
    try {
      // 阶段1：结算阶段
      if (currentPhase === TurnPhase.RESOLUTION) {
        const resolutionResult = await this.executeResolutionPhase(turn.id);
        await this.transitionToPhase(turn.id, TurnPhase.PLAYER);
        currentPhase = TurnPhase.PLAYER;
      }
      
      // 阶段2：玩家阶段（等待玩家操作）
      if (currentPhase === TurnPhase.PLAYER) {
        // 非阻塞：返回控制权给玩家
        return { status: 'waiting_player', phase: TurnPhase.PLAYER };
      }
      
      // 阶段3：AI模拟阶段
      if (currentPhase === TurnPhase.AI_SIMULATION) {
        const aiResult = await this.executeAIPhase(turn.id);
        await this.transitionToPhase(turn.id, TurnPhase.COMPLETED);
        return { status: 'completed', result: aiResult };
      }
      
    } catch (error) {
      await this.transitionToPhase(turn.id, TurnPhase.ERROR);
      throw new TurnExecutionError('Turn execution failed', error);
    }
  }
}
```

### 6.3 错误处理路径

```typescript
// 错误恢复策略
export class ErrorRecoveryService {
  async handleTurnSystemError(turnId: TurnId, error: TurnError): Promise<RecoveryResult> {
    // 根据错误类型选择恢复策略
    switch (error.type) {
      case 'AI_DECISION_TIMEOUT':
        return await this.fallbackToDefaultAIDecision(turnId);
      
      case 'DATA_CORRUPTION':
        return await this.restoreFromBackup(turnId);
      
      case 'PHASE_TRANSITION_FAILED':
        return await this.retryPhaseTransition(turnId);
      
      default:
        // 最后兜底：重置到安全状态
        return await this.resetToSafeState(turnId);
    }
  }
}
```

---

## O7. 质量门禁

### 7.1 测试策略

基于Base章节07的质量门禁框架：

```typescript
// 测试配置
export interface GuildManagerTestConfig {
  unit: {
    coverage: {
      statements: 85;
      branches: 80;
      functions: 90;
      lines: 85;
    };
    timeout: 5000;
  };
  
  integration: {
    database: 'sqlite::memory:';
    timeout: 10000;
  };
  
  e2e: {
    headless: boolean;
    viewport: { width: 1280, height: 720 };
    timeout: 30000;
  };
}
```

### 7.2 CI门禁脚本

```bash
#!/bin/bash
# scripts/guild-manager-gates.sh

echo "🏗️ Running Guild Manager Quality Gates..."

# TypeScript检查
echo "1/5 TypeScript检查..."
npx tsc --noEmit --project tsconfig.json
if [ $? -ne 0 ]; then echo "❌ TypeScript检查失败"; exit 1; fi

# Linting
echo "2/5 代码规范检查..."
npx eslint src/guild-manager/**/*.ts
if [ $? -ne 0 ]; then echo "❌ Lint检查失败"; exit 2; fi

# 单元测试
echo "3/5 单元测试..."
npx vitest run --coverage --config vitest.guild-manager.config.ts
if [ $? -ne 0 ]; then echo "❌ 单元测试失败"; exit 3; fi

# 集成测试
echo "4/5 集成测试..."
npm run test:integration:guild-manager
if [ $? -ne 0 ]; then echo "❌ 集成测试失败"; exit 4; fi

# E2E测试
echo "5/5 E2E测试..."
npx playwright test tests/e2e/guild-manager-chunk-001.e2e.ts
if [ $? -ne 0 ]; then echo "❌ E2E测试失败"; exit 5; fi

echo "✅ 所有质量门禁通过！"
```

---

## O8. 验收清单与就地测试

### 8.1 功能验收清单

- [ ] **回合制系统**
  - [ ] 三阶段回合流程正常工作
  - [ ] 状态机转换无错误
  - [ ] 错误恢复机制有效
  
- [ ] **工作面板**
  - [ ] 数据加载P95 ≤ 100ms
  - [ ] 实时更新正常
  - [ ] UI响应流畅
  
- [ ] **邮箱系统**
  - [ ] 事件邮件自动生成
  - [ ] 决策处理流程完整
  - [ ] AI互动反馈及时
  
- [ ] **AI系统**
  - [ ] 成员AI决策合理
  - [ ] 关系动态更新
  - [ ] 状态转换正确

### 8.2 性能验收清单

- [ ] **响应时间SLO**
  - [ ] 工作面板加载 ≤ 100ms (P95)
  - [ ] AI决策处理 ≤ 50ms (P95)
  - [ ] 回合阶段切换 ≤ 200ms (P95)
  
- [ ] **可靠性SLO**
  - [ ] Crash-Free Sessions ≥ 99.5%
  - [ ] Crash-Free Users ≥ 99.5%
  - [ ] 数据同步率 ≥ 99.5%

### 8.3 安全验收清单

- [ ] **Electron安全基线**
  - [ ] `nodeIntegration=false`
  - [ ] `contextIsolation=true`
  - [ ] `sandbox=true`
  - [ ] 严格CSP策略生效
  
- [ ] **IPC安全**
  - [ ] 白名单API正常工作
  - [ ] 无直接Node.js访问
  - [ ] 输入验证完整

---

## 追踪表（PRD-ID ↔ NFR/SLO ↔ ADR ↔ Tests）

| PRD-ID | 功能需求 | 对应SLO | 相关ADR | 单元测试 | E2E测试 |
|--------|----------|---------|---------|----------|---------|
| PRD-GM-CHUNK-001-R01 | 回合制系统 | EVENT_P95_50ms | ADR-0004, ADR-0005 | turn-system.spec.ts | turn-workflow.e2e.ts |
| PRD-GM-CHUNK-001-R02 | 工作面板 | UI_P95_100ms | ADR-0001, ADR-0003 | work-panel.spec.ts | work-panel.e2e.ts |
| PRD-GM-CHUNK-001-R03 | 邮箱系统 | EVENT_P95_50ms | ADR-0004 | mailbox.spec.ts | mailbox.e2e.ts |
| PRD-GM-CHUNK-001-R04 | AI决策系统 | EVENT_P95_50ms | ADR-0006, ADR-0007 | member-ai.spec.ts | ai-decisions.e2e.ts |
| PRD-GM-CHUNK-001-R05 | 数据持久化 | CRASH_FREE_99.5 | ADR-0006, ADR-0007 | repository.spec.ts | data-consistency.e2e.ts |

---

## ADR-TODO 占位

基于当前分析，以下全局规则变更需要新增ADR：

- **ADR-TODO-001**: 游戏回合制事件循环与Electron主进程集成策略
- **ADR-TODO-002**: AI决策引擎的性能优化和内存管理策略  
- **ADR-TODO-003**: 复杂游戏状态的增量保存和快照策略

> **护栏提醒**: 本文档严格遵循Overlay规范，未定义全局跨切规则。所有架构决策均引用已接受的ADR，新增规则以ADR-TODO形式标记待后续处理。