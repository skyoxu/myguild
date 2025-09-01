# 06-运行时视图扩展：进程/线程拓扑详细架构

## 6.1 进程/线程拓扑架构

> **设计哲学**：通过"关注点分离"实现高性能、高响应的桌面游戏应用。进程分离确保OS级任务与应用渲染分离；UI与游戏逻辑解耦；计算密集型AI任务独立运行，防止主线程卡顿。

### 6.1.1 架构拓扑总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Electron 主进程 (Main Process) - Node.js 环境                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ • 窗口管理 (BrowserWindow)           • 应用生命周期 (app events)                │
│ • 系统原生API (文件、菜单、对话框)    • IPC通信中心枢纽                         │
│ • 安全策略执行                       • 全局状态管理 (设置、存档)               │
└─────────────────────────────────────────────────────────────────────────────────┘
      ▲                                       │ IPC (ipcMain ↔ ipcRenderer)
      │ (通过 preload.js 安全暴露API)           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Electron 渲染进程 (Renderer Process) - 浏览器环境                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─────────────────────┐      EventBus      ┌──────────────────────────────────┐ │
│ │ React 19 (UI层)     │ <───────────────> │ Phaser 3 (游戏引擎)              │ │
│ ├─────────────────────┤                    ├──────────────────────────────────┤ │
│ │ • UI组件 (HUD, 菜单) │                    │ • 游戏场景管理 (Scene)           │ │
│ │ • 用户输入事件处理  │                    │ • 60FPS渲染循环                  │ │
│ │ • 状态管理 (Store)  │                    │ • WebGL渲染管道                  │ │
│ │ • 生命周期管理      │                    │ • 物理引擎、动画、游戏逻辑       │ │
│ └─────────────────────┘                    └──────────────────────────────────┘ │
│                                                    │                            │
│                                                    │ postMessage / onmessage    │
│                                                    ▼                            │
│                                            ┌──────────────────────────────────┐ │
│                                            │ Web Worker (AI计算线程)          │ │
│                                            ├──────────────────────────────────┤ │
│                                            │ • NPC决策计算 (Decision Trees)   │ │
│                                            │ • 路径规划 (A* Pathfinding)      │ │
│                                            │ • 战术分析与策略计算             │ │
│                                            │ • 异步计算 + 结果缓存            │ │
│                                            └──────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1.2 Electron进程模型详解

#### 主进程 (Main Process) 职责与实现

**核心职责**：

- **唯一入口点**：应用启动/退出的控制中心
- **窗口管理器**：BrowserWindow实例的创建与管理
- **OS集成层**：原生菜单、系统托盘、文件对话框、全局快捷键
- **特权操作代理**：所有Node.js API操作的安全执行点
- **应用状态中心**：全局配置、用户设置、游戏存档的读写管理

**安全配置实现**：

```typescript
// main.ts - 主进程安全配置
const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 🔒 安全基线配置 (必须)
      contextIsolation: true, // V8上下文隔离
      nodeIntegration: false, // 禁用Node.js集成
      enableRemoteModule: false, // 禁用remote模块
      webSecurity: true, // 启用Web安全策略
      preload: path.join(__dirname, 'preload.js'), // 安全桥接脚本
    },
  });
};
```

#### 渲染进程 (Renderer Process) 架构与安全

**核心职责**：

- **UI渲染层**：React 19组件树的渲染与交互处理
- **游戏运行时**：Phaser 3游戏引擎的宿主环境
- **沙箱环境**：在受限浏览器环境中运行，无直接Node.js访问
- **请求代理**：通过IPC向主进程请求特权操作

**安全桥接实现**：

```typescript
// preload.js - 安全桥接脚本
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 游戏存档操作
  saveGameData: (data: GameSaveData) => ipcRenderer.invoke('save-game', data),
  loadGameData: () => ipcRenderer.invoke('load-game'),

  // 系统对话框
  showSaveDialog: (options: SaveDialogOptions) =>
    ipcRenderer.invoke('show-save-dialog', options),

  // 设置管理
  getUserSettings: () => ipcRenderer.invoke('get-user-settings'),
  updateUserSettings: (settings: UserSettings) =>
    ipcRenderer.invoke('update-user-settings', settings),

  // 事件监听
  onWindowFocus: (callback: () => void) =>
    ipcRenderer.on('window-focus', callback),
  onWindowBlur: (callback: () => void) =>
    ipcRenderer.on('window-blur', callback),
});
```

### 6.1.3 Web Worker线程模型

#### AI计算线程架构

**设计目标**：将CPU密集型AI计算从主渲染线程分离，确保60FPS游戏循环不被阻塞。

**线程职责划分**：

- **主UI线程**：React UI渲染 + Phaser游戏循环 + DOM事件处理
- **AI Worker线程**：NPC决策 + 路径规划 + 战术分析 + 策略计算

#### 消息传递协议设计

```typescript
// types/worker-messages.ts - Worker通信协议
export interface AIWorkerMessage {
  id: string;
  type: 'pathfinding' | 'decision_making' | 'tactical_analysis';
  timestamp: number;
  payload: unknown;
}

export interface PathfindingRequest {
  unitId: string;
  start: Point2D;
  target: Point2D;
  obstacles: Point2D[];
  unitType: 'infantry' | 'tank' | 'aircraft';
}

export interface DecisionMakingRequest {
  npcId: string;
  gameState: GameStateSnapshot;
  availableActions: Action[];
  personality: NPCPersonality;
}
```

#### Worker实现示例

```typescript
// workers/ai.worker.ts - AI计算工作线程
import { PathfindingEngine } from './engines/PathfindingEngine';
import { DecisionTreeEngine } from './engines/DecisionTreeEngine';

class AIWorker {
  private pathfinding = new PathfindingEngine();
  private decisionTree = new DecisionTreeEngine();

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private async handleMessage(event: MessageEvent<AIWorkerMessage>) {
    const { id, type, payload } = event.data;

    try {
      let result: unknown;

      switch (type) {
        case 'pathfinding':
          result = await this.pathfinding.findPath(
            payload as PathfindingRequest
          );
          break;
        case 'decision_making':
          result = await this.decisionTree.makeDecision(
            payload as DecisionMakingRequest
          );
          break;
        case 'tactical_analysis':
          result = await this.analyzeTacticalSituation(payload);
          break;
      }

      // 返回计算结果
      self.postMessage({
        id,
        type: `${type}_result`,
        timestamp: Date.now(),
        payload: result,
      });
    } catch (error) {
      // 错误处理
      self.postMessage({
        id,
        type: 'error',
        timestamp: Date.now(),
        payload: {
          originalType: type,
          error: error.message,
          stack: error.stack,
        },
      });
    }
  }
}

new AIWorker();
```

### 6.1.4 React-Phaser集成架构

#### DOM结构与生命周期管理

```typescript
// components/PhaserGameContainer.tsx - Phaser容器组件
import React, { useRef, useEffect, useState } from 'react';
import Phaser from 'phaser';
import { EventBus } from '@/core/events/EventBus';
import { gameConfig } from '@/game/config';

interface PhaserGameContainerProps {
  eventBus: EventBus;
  onGameReady?: (game: Phaser.Game) => void;
}

export const PhaserGameContainer: React.FC<PhaserGameContainerProps> = ({
  eventBus,
  onGameReady
}) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGameReady, setIsGameReady] = useState(false);

  useEffect(() => {
    // 初始化Phaser游戏实例
    const config: Phaser.Types.Core.GameConfig = {
      ...gameConfig,
      parent: containerRef.current!,
      callbacks: {
        postBoot: () => {
          setIsGameReady(true);
          onGameReady?.(gameRef.current!);
        }
      }
    };

    const game = new Phaser.Game(config);

    // 将EventBus注入Phaser registry
    game.registry.set('eventBus', eventBus);
    game.registry.set('reactContainer', containerRef.current);

    gameRef.current = game;

    // 清理函数
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      setIsGameReady(false);
    };
  }, [eventBus, onGameReady]);

  return (
    <div
      ref={containerRef}
      className="phaser-game-container"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
```

#### EventBus通信机制

```typescript
// core/events/EventBus.ts - React-Phaser事件总线
import mitt, { Emitter } from 'mitt';

export interface GameEvents {
  // UI -> Game 事件
  'ui:build_unit': { unitType: string; position: Point2D };
  'ui:pause_game': { paused: boolean };
  'ui:save_game': { saveSlot: number };

  // Game -> UI 事件
  'game:health_changed': { playerId: string; health: number };
  'game:resource_updated': { resource: string; amount: number };
  'game:scene_changed': { from: string; to: string };

  // AI Worker 事件
  'ai:calculation_complete': { requestId: string; result: unknown };
  'ai:error': { requestId: string; error: Error };
}

export class EventBus {
  private emitter: Emitter<GameEvents>;

  constructor() {
    this.emitter = mitt<GameEvents>();
  }

  // 发送事件
  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    this.emitter.emit(type, payload);
  }

  // 监听事件
  on<K extends keyof GameEvents>(
    type: K,
    handler: (payload: GameEvents[K]) => void
  ): void {
    this.emitter.on(type, handler);
  }

  // 移除监听
  off<K extends keyof GameEvents>(
    type: K,
    handler: (payload: GameEvents[K]) => void
  ): void {
    this.emitter.off(type, handler);
  }

  // 清理所有监听器
  clear(): void {
    this.emitter.all.clear();
  }
}
```

### 6.1.5 进程间通信拓扑总结

#### 通信层次与协议

| 通信路径                     | 技术实现                  | 特性               | 适用场景                 |
| ---------------------------- | ------------------------- | ------------------ | ------------------------ |
| **React UI ↔ Phaser Game**  | EventBus (mitt)           | 同步、低延迟、高频 | UI交互、游戏状态实时同步 |
| **Phaser Game ↔ AI Worker** | postMessage/onmessage     | 异步、序列化开销   | AI计算任务、结果回调     |
| **Renderer ↔ Main Process** | Electron IPC + preload.js | 异步、安全隔离     | 文件操作、系统对话框     |

#### 数据流向与性能优化

```typescript
// core/communication/DataFlow.ts - 数据流控制器
export class DataFlowController {
  private eventBus: EventBus;
  private aiWorker: Worker;
  private gameStateCache = new Map<string, unknown>();

  constructor(eventBus: EventBus, aiWorker: Worker) {
    this.eventBus = eventBus;
    this.aiWorker = aiWorker;
    this.setupDataFlowOptimization();
  }

  private setupDataFlowOptimization(): void {
    // 限制AI Worker通信频率 (最多4次/秒)
    let lastAIUpdate = 0;
    const AI_UPDATE_INTERVAL = 250;

    this.eventBus.on('game:state_update', gameState => {
      const now = Date.now();
      if (now - lastAIUpdate >= AI_UPDATE_INTERVAL) {
        this.sendToAIWorker('state_update', gameState);
        lastAIUpdate = now;
      }
    });

    // 缓存频繁访问的游戏状态
    this.eventBus.on('game:resource_updated', data => {
      this.gameStateCache.set(`resource_${data.resource}`, data.amount);
    });
  }

  private sendToAIWorker(type: string, payload: unknown): void {
    this.aiWorker.postMessage({
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      payload,
    });
  }
}
```

### 6.1.6 生命周期管理与错误处理

#### 应用启动序列

```typescript
// main.ts - 应用启动序列管理
class ApplicationLifecycle {
  private static instance: ApplicationLifecycle;
  private startupTasks: (() => Promise<void>)[] = [];

  async startup(): Promise<void> {
    console.log('🚀 开始应用启动序列...');

    // 1. 主进程初始化
    await this.initializeMainProcess();

    // 2. 创建主窗口
    const mainWindow = await this.createMainWindow();

    // 3. 等待渲染进程就绪
    await this.waitForRendererReady(mainWindow);

    // 4. 初始化游戏系统
    await this.initializeGameSystems(mainWindow);

    console.log('✅ 应用启动完成');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 开始应用关闭序列...');

    // 1. 保存游戏状态
    await this.saveApplicationState();

    // 2. 停止AI Worker
    await this.terminateWorkers();

    // 3. 清理Phaser资源
    await this.cleanupGameResources();

    // 4. 关闭所有窗口
    await this.closeAllWindows();

    console.log('✅ 应用关闭完成');
  }
}
```

#### 错误传播与恢复策略

```typescript
// core/error/ErrorBoundary.ts - 错误边界管理
export class RuntimeErrorHandler {
  private errorCounts = new Map<string, number>();
  private readonly MAX_ERRORS_PER_COMPONENT = 3;

  handleWorkerError(error: Error, workerId: string): void {
    console.error(`Worker ${workerId} error:`, error);

    const count = this.errorCounts.get(workerId) || 0;
    this.errorCounts.set(workerId, count + 1);

    if (count >= this.MAX_ERRORS_PER_COMPONENT) {
      // 达到错误阈值，重启Worker
      this.restartWorker(workerId);
      this.errorCounts.delete(workerId);
    }
  }

  handlePhaserError(error: Error, scene: string): void {
    console.error(`Phaser scene ${scene} error:`, error);

    // 将游戏错误传播到React错误边界
    this.eventBus.emit('game:error', {
      error: error.message,
      scene,
      timestamp: Date.now(),
    });
  }

  private restartWorker(workerId: string): void {
    console.log(`🔄 重启Worker: ${workerId}`);
    // 实现Worker重启逻辑
  }
}
```

---

## 6.2 循环与调度

> 采用 `GameLoop` 封装 **tick(update)** 调度，与 Phaser 的 `scene.update` 接口对齐。

### 6.2.1 游戏循环架构设计

**核心设计原则**：

- **60FPS目标**：每帧16.67ms的预算控制
- **优先级调度**：UI响应 > 游戏逻辑 > AI计算
- **时间切片**：长时间任务自动分片处理
- **背压控制**：负载过高时优雅降级

```typescript
// core/loop/GameLoop.ts - 游戏循环管理器
export class GameLoop {
  private static readonly TARGET_FPS = 60;
  private static readonly FRAME_BUDGET = 1000 / GameLoop.TARGET_FPS; // 16.67ms

  private isRunning = false;
  private lastFrameTime = 0;
  private frameId: number | null = null;
  private performanceMonitor = new PerformanceMonitor();

  constructor(
    private phaserGame: Phaser.Game,
    private reactUpdater: ReactUpdater,
    private aiScheduler: AITaskScheduler
  ) {}

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    const remainingBudget = GameLoop.FRAME_BUDGET;

    // 性能监控
    this.performanceMonitor.startFrame();

    try {
      // 1. 高优先级：UI更新 (预留5ms)
      const uiStartTime = performance.now();
      this.reactUpdater.update(deltaTime);
      const uiTime = performance.now() - uiStartTime;

      // 2. 核心优先级：Phaser游戏循环 (预留8ms)
      const gameStartTime = performance.now();
      this.updatePhaserGame(deltaTime);
      const gameTime = performance.now() - gameStartTime;

      // 3. 低优先级：AI任务调度 (剩余时间)
      const remainingTime = remainingBudget - uiTime - gameTime - 2; // 保留2ms缓冲
      if (remainingTime > 0) {
        this.aiScheduler.processTasksWithBudget(remainingTime);
      }
    } catch (error) {
      this.handleLoopError(error);
    } finally {
      this.performanceMonitor.endFrame();
      this.lastFrameTime = currentTime;
      this.frameId = requestAnimationFrame(this.tick);
    }
  };
}
```

## 6.3 状态机

> `AppState`：`boot -> loading -> running -> paused -> error`，明确每个状态的进入/退出条件与回退路径。

### 6.3.1 应用状态机设计

```typescript
// core/state/AppStateMachine.ts - 应用状态机
export enum AppState {
  BOOT = 'boot', // 应用启动中
  LOADING = 'loading', // 资源加载中
  RUNNING = 'running', // 正常运行
  PAUSED = 'paused', // 暂停状态
  ERROR = 'error', // 错误状态
  SHUTDOWN = 'shutdown', // 关闭中
}

export class AppStateMachine {
  private currentState = AppState.BOOT;
  private previousState: AppState | null = null;
  private stateHistory: AppState[] = [];
  private transitionHandlers = new Map<string, () => Promise<void>>();

  // 状态转换定义
  private readonly validTransitions = new Map<AppState, AppState[]>([
    [AppState.BOOT, [AppState.LOADING, AppState.ERROR]],
    [AppState.LOADING, [AppState.RUNNING, AppState.ERROR]],
    [AppState.RUNNING, [AppState.PAUSED, AppState.ERROR, AppState.SHUTDOWN]],
    [AppState.PAUSED, [AppState.RUNNING, AppState.ERROR, AppState.SHUTDOWN]],
    [AppState.ERROR, [AppState.LOADING, AppState.SHUTDOWN]],
    [AppState.SHUTDOWN, []], // 终态
  ]);

  async transitionTo(
    newState: AppState,
    context?: StateTransitionContext
  ): Promise<boolean> {
    const validTargets = this.validTransitions.get(this.currentState) || [];

    if (!validTargets.includes(newState)) {
      console.warn(`❌ 无效状态转换: ${this.currentState} -> ${newState}`);
      return false;
    }

    try {
      // 执行状态退出处理
      await this.executeExitHandler(this.currentState);

      // 记录状态历史
      this.previousState = this.currentState;
      this.stateHistory.push(this.currentState);

      // 切换状态
      this.currentState = newState;

      // 执行状态进入处理
      await this.executeEnterHandler(newState, context);

      console.log(`✅ 状态转换成功: ${this.previousState} -> ${newState}`);
      return true;
    } catch (error) {
      console.error(
        `❌ 状态转换失败: ${this.previousState} -> ${newState}`,
        error
      );
      await this.handleTransitionError(error);
      return false;
    }
  }
}
```

## 6.4 负载与背压

> 帧预算/任务切片/Worker池，将60FPS的帧预算映射到update开销控制。

### 6.4.1 性能预算管理

```typescript
// core/performance/PerformanceBudget.ts - 性能预算管理
export class PerformanceBudgetManager {
  private static readonly FRAME_BUDGET = 16.67; // 60FPS预算

  private budgetAllocations = {
    ui: 5.0, // React UI更新 (30%)
    game: 8.0, // Phaser游戏逻辑 (48%)
    ai: 2.0, // AI计算 (12%)
    buffer: 1.67, // 缓冲区 (10%)
  };

  private currentFrameUsage = {
    ui: 0,
    game: 0,
    ai: 0,
    total: 0,
  };

  checkBudgetExceeded(component: keyof typeof this.budgetAllocations): boolean {
    const allocated = this.budgetAllocations[component];
    const used = this.currentFrameUsage[component];
    return used > allocated;
  }

  applyBackpressure(): void {
    if (this.currentFrameUsage.total > PerformanceBudgetManager.FRAME_BUDGET) {
      // 应用背压策略
      this.reduceAITaskPriority();
      this.enableFrameSkipping();
      this.notifyPerformanceIssue();
    }
  }
}
```

## 6.5 错误路径与可观测性

> 循环内部异常捕获→状态机迁移到error→UI降级/提示→Sentry记录。

### 6.5.1 错误监控与上报

```typescript
// monitoring/ErrorMonitoring.ts - 错误监控系统
import * as Sentry from '@sentry/electron/renderer';

export class ErrorMonitoringSystem {
  constructor() {
    this.initializeSentry();
    this.setupErrorBoundaries();
  }

  private initializeSentry(): void {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations: [
        new Sentry.Integrations.Electron.ElectronRendererIntegration(),
      ],
      beforeSend: this.filterSensitiveData,
    });
  }

  captureGameLoopError(error: Error, context: GameLoopErrorContext): void {
    Sentry.withScope(scope => {
      scope.setTag('error_type', 'game_loop');
      scope.setContext('game_state', context.gameState);
      scope.setContext('performance', context.performanceMetrics);
      Sentry.captureException(error);
    });
  }
}
```

## 6.6 就地验收

> 验收测试确保运行时架构的稳定性和性能指标。

### 6.6.1 Playwright Electron测试

```typescript
// tests/runtime/process-topology.spec.ts - 进程拓扑验证
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('进程/线程拓扑验证', () => {
  test('Electron进程架构验证', async () => {
    const electronApp = await electron.launch({ args: ['.'] });
    const window = await electronApp.firstWindow();

    // 验证安全配置
    const securityConfig = await window.evaluate(() => ({
      contextIsolation: process.contextIsolated,
      nodeIntegration: process.versions.node === undefined,
    }));

    expect(securityConfig.contextIsolation).toBe(true);
    expect(securityConfig.nodeIntegration).toBe(true);

    await electronApp.close();
  });

  test('React-Phaser通信验证', async () => {
    // 验证EventBus通信机制
    // 测试UI事件到游戏逻辑的传递
    // 验证游戏状态到UI的同步
  });

  test('AI Worker性能验证', async () => {
    // 验证Worker线程正常启动
    // 测试消息传递性能
    // 验证计算任务不阻塞主线程
  });
});
```

---

**小结**：本章建立了完整的进程/线程拓扑架构，为后续的性能优化、错误处理和可观测性提供了坚实的基础。每个组件都有明确的职责边界和通信协议，确保系统的可维护性和扩展性。
