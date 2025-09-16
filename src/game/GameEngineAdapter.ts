/**
 * 游戏引擎适配器 - 实现GameEnginePort接口
 * 连接Phaser场景管理器与六边形架构端口
 */

import { SceneManager, type SceneManagerConfig } from './SceneManager';
import { GameStateManager } from './state/GameStateManager';
import { StateSynchronizer } from './state/StateSynchronizer';
import type {
  GameEnginePort,
  GameState,
  GameConfig,
  GameInput,
  GameResult,
  GameStatistics,
} from '../ports/game-engine.port';
import type { DomainEvent } from '../shared/contracts/events';
import { EventUtils } from '../shared/contracts/events';
import type { GameDomainEvent } from '../shared/contracts/events/GameEvents';
import { globalEventBus } from '../hooks/useGameEvents';
import { EventPriority } from '../shared/contracts/events/GameEvents';
import { GameLoop } from '../runtime/loop';
import { StateMachine, type AppState } from '../runtime/state';

export class GameEngineAdapter implements GameEnginePort {
  private sceneManager: SceneManager;
  private gameLoop: GameLoop;
  private stateMachine: StateMachine;
  private stateManager: GameStateManager;
  private stateSynchronizer: StateSynchronizer;
  private eventCallbacks: Set<(event: DomainEvent) => void> = new Set();
  private eventBusSubscriptions: string[] = []; // 存储EventBus订阅ID
  private currentConfig?: GameConfig;
  private currentState: GameState;
  private container?: HTMLElement;
  private gameStartTime: number = 0;
  private gameStatistics: GameStatistics = {
    totalMoves: 0,
    itemsCollected: 0,
    enemiesDefeated: 0,
    distanceTraveled: 0,
    averageReactionTime: 0,
  };

  constructor() {
    // 初始化状态机
    this.stateMachine = new StateMachine();

    // 初始化状态管理器
    this.stateManager = new GameStateManager({
      storageKey: 'guild-manager-game',
      maxSaves: 10,
      autoSaveInterval: 30000,
      enableCompression: true,
    });

    // 初始化状态同步器
    this.stateSynchronizer = new StateSynchronizer({
      syncInterval: 1000,
      conflictResolution: 'priority',
      enableBidirectionalSync: true,
    });

    // 初始化场景管理器
    this.sceneManager = new SceneManager({
      onEvent: (event: DomainEvent) => {
        this.handleDomainEvent(event);
      },
      onError: (error: Error, scene) => {
        console.error('Game engine error:', error, scene);
        this.stateMachine.transition('error');
      },
    });

    // 初始化游戏循环
    this.gameLoop = new GameLoop(
      (delta: number) => this.updateGame(delta),
      (error: unknown) => {
        console.error('Game loop error:', error);
        this.stateMachine.transition('error');
      }
    );

    // 初始化默认游戏状态
    this.currentState = {
      id: `game-${Date.now()}`,
      level: 1,
      score: 0,
      health: 100,
      inventory: [],
      position: { x: 400, y: 300 },
      timestamp: new Date(),
    };

    // 设置状态管理器事件监听
    this.stateManager.onEvent(event => this.handleDomainEvent(event));
    this.stateSynchronizer.onEvent(event => this.handleDomainEvent(event));

    // 订阅React命令事件
    this.setupEventBusListeners();

    // 注册自身作为状态源
    this.stateSynchronizer.registerSource(
      {
        id: 'game-engine',
        getState: () => this.currentState,
        setState: (state: GameState) => {
          this.currentState = { ...state };
          this.stateManager.setState(state, this.currentConfig);
        },
      },
      10
    ); // 高优先级

    // 启动状态同步
    this.stateSynchronizer.startSync();
  }

  /**
   * 初始化游戏
   */
  async initializeGame(config: GameConfig): Promise<GameState> {
    try {
      this.stateMachine.transition('loading');
      this.currentConfig = config;

      // 重置游戏状态
      this.currentState = {
        id: `game-${Date.now()}`,
        level: 1,
        score: 0,
        health: config.initialHealth,
        inventory: [],
        position: { x: 400, y: 300 },
        timestamp: new Date(),
      };

      // 重置统计信息
      this.gameStatistics = {
        totalMoves: 0,
        itemsCollected: 0,
        enemiesDefeated: 0,
        distanceTraveled: 0,
        averageReactionTime: 0,
      };

      // 发布初始化事件
      this.publishEvent(
        EventUtils.createEvent({
          type: 'game.engine.initialized',
          source: '/vitegame/game-engine',
          data: { config },
        })
      );

      this.stateMachine.transition('running');
      return this.currentState;
    } catch (error) {
      this.stateMachine.transition('error');
      throw error;
    }
  }

  /**
   * 开始游戏会话
   */
  async startGame(saveId?: string): Promise<GameState> {
    if (!this.container) {
      throw new Error('Game container not set. Call setContainer() first.');
    }

    try {
      // 如果提供了存档ID，先加载存档
      if (saveId) {
        await this.loadGame(saveId);
      }

      // 初始化场景管理器
      if (!this.sceneManager.isInitialized()) {
        await this.sceneManager.initialize(this.container, 800, 600);

        // 启动TestScene
        console.log('🚀 GameEngineAdapter: 启动TestScene');
        this.sceneManager.startTestScene();
      }

      // 开始游戏循环
      this.gameLoop.start();
      this.gameStartTime = Date.now();

      // 转换状态机到运行状态（如果还不是运行状态）
      if (this.stateMachine.current !== 'running') {
        this.stateMachine.transition('running');
      }

      // 发布游戏开始事件
      this.publishEvent(
        EventUtils.createEvent({
          type: 'game.engine.started',
          source: '/vitegame/game-engine',
          data: {
            saveId,
            state: this.currentState,
            timestamp: this.gameStartTime,
          },
          id: `start-${Date.now()}`,
        })
      );

      return this.currentState;
    } catch (error) {
      this.stateMachine.transition('error');
      throw error;
    }
  }

  /**
   * 暂停游戏
   */
  async pauseGame(): Promise<void> {
    this.gameLoop.stop();
    this.sceneManager.pauseGame();

    // 只在running状态时才能暂停
    if (this.stateMachine.current === 'running') {
      this.stateMachine.transition('paused');
    }

    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.engine.paused',
        source: '/vitegame/game-engine',
        data: { state: this.currentState },
        id: `pause-${Date.now()}`,
      })
    );
  }

  /**
   * 恢复游戏
   */
  async resumeGame(): Promise<void> {
    this.gameLoop.start();
    this.sceneManager.resumeGame();

    // 只在paused状态时才能恢复到running
    if (this.stateMachine.current === 'paused') {
      this.stateMachine.transition('running');
    }

    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.engine.resumed',
        source: '/vitegame/game-engine',
        data: { state: this.currentState },
        id: `resume-${Date.now()}`,
      })
    );
  }

  /**
   * 保存游戏状态
   */
  async saveGame(): Promise<string> {
    if (!this.currentState || !this.currentConfig) {
      throw new Error('No game state to save');
    }

    // 更新状态管理器中的当前状态
    this.stateManager.setState(this.currentState, this.currentConfig);

    // 使用状态管理器保存游戏
    const saveId = await this.stateManager.saveGame();

    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.save.completed',
        source: 'game-engine-adapter',
        data: { saveId },
        id: `save-${Date.now()}`,
      })
    );

    return saveId;
  }

  /**
   * 加载游戏状态
   */
  async loadGame(saveId: string): Promise<GameState> {
    try {
      // 使用状态管理器加载游戏
      const { state, config } = await this.stateManager.loadGame(saveId);

      this.currentState = state;
      this.currentConfig = config;

      // 同步状态到所有源
      this.stateSynchronizer.forceState(state);

      // 应用加载的状态到场景管理器
      this.sceneManager.setGameState(this.currentState);

      this.publishEvent(
        EventUtils.createEvent({
          type: 'game.save.loaded',
          source: 'game-engine-adapter',
          data: { saveId, state: this.currentState },
          id: `load-${Date.now()}`,
        })
      );

      return this.currentState;
    } catch (error) {
      this.publishEvent(
        EventUtils.createEvent({
          type: 'game.save.load_failed',
          source: 'game-engine-adapter',
          data: { saveId, error: (error as Error).message },
          id: `load-error-${Date.now()}`,
        })
      );
      throw error;
    }
  }

  /**
   * 处理用户输入
   */
  async handleInput(input: GameInput): Promise<void> {
    console.log(
      '🎛️ GameEngineAdapter.handleInput:',
      input.type,
      input.action,
      input.data
    );
    // 更新统计信息
    this.gameStatistics.totalMoves++;

    // 计算反应时间（简单实现）
    const reactionTime = Date.now() - input.timestamp.getTime();
    this.gameStatistics.averageReactionTime =
      (this.gameStatistics.averageReactionTime + reactionTime) / 2;

    // 转发输入到当前场景
    const currentScene = this.sceneManager.getCurrentScene();
    if (currentScene && 'handleInput' in currentScene) {
      (currentScene as any).handleInput(input);
    }

    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.input.received',
        source: 'game-engine-adapter',
        data: { input },
        id: `input-${Date.now()}`,
      })
    );
  }

  /**
   * 获取当前游戏状态
   */
  getCurrentState(): GameState {
    // 同步场景管理器的状态
    const sceneState = this.sceneManager.getGameState();
    if (sceneState) {
      this.currentState = { ...this.currentState, ...sceneState };
    }

    return { ...this.currentState };
  }

  /**
   * 订阅游戏事件
   */
  onGameEvent(callback: (event: DomainEvent) => void): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * 取消订阅游戏事件
   */
  offGameEvent(callback: (event: DomainEvent) => void): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * 结束游戏
   */
  async endGame(): Promise<GameResult> {
    this.gameLoop.stop();

    const playTime =
      this.gameStartTime > 0 ? Date.now() - this.gameStartTime : 0;

    const result: GameResult = {
      finalScore: this.currentState.score,
      levelReached: this.currentState.level,
      playTime,
      achievements: [], // TODO: 实现成就系统
      statistics: this.gameStatistics,
    };

    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.session.ended',
        source: 'game-engine-adapter',
        data: { result },
        id: `end-${Date.now()}`,
      })
    );

    return result;
  }

  /**
   * 设置游戏容器
   */
  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * 获取当前状态机状态
   */
  getStateMachineState(): AppState {
    return this.stateMachine.current;
  }

  /**
   * 更新游戏逻辑
   */
  private async updateGame(delta: number): Promise<void> {
    try {
      // 更新时间戳
      this.currentState = { ...this.currentState, timestamp: new Date() };

      // 从场景管理器获取最新状态（如果场景管理器已初始化）
      if (this.sceneManager.isInitialized()) {
        const sceneState = this.sceneManager.getGameState();
        if (sceneState) {
          // 计算移动距离
          const oldPos = this.currentState.position;
          const newPos = sceneState.position;
          if (oldPos && newPos) {
            const distance = Math.sqrt(
              Math.pow(newPos.x - oldPos.x, 2) +
                Math.pow(newPos.y - oldPos.y, 2)
            );
            this.gameStatistics.distanceTraveled += distance;
          }

          this.currentState = { ...this.currentState, ...sceneState };
        }
      }
    } catch (error) {
      console.warn('Error in updateGame:', error);
      // 在测试环境中，不要因为updateGame的错误而终止游戏
      // 仅记录警告而不抛出异常
    }
  }

  /**
   * 处理域事件
   */
  private handleDomainEvent(event: DomainEvent): void {
    console.log('🎯 GameEngineAdapter.handleDomainEvent:', event.type, event);

    // 转发事件给所有监听器
    console.log('🎯 转发事件给', this.eventCallbacks.size, '个监听器');
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }

  /**
   * 发布事件
   */
  private publishEvent(event: DomainEvent): void {
    this.handleDomainEvent(event);
  }

  /**
   * 发布游戏事件到EventBus
   */
  private publishGameEvent(event: GameDomainEvent): void {
    globalEventBus.publish(event, {
      source: 'phaser-engine',
      priority: EventPriority.NORMAL,
    });
  }

  /**
   * 设置EventBus监听器
   */
  private setupEventBusListeners(): void {
    // 监听React发送的命令
    const pauseSubId = globalEventBus.subscribe(
      'react.command.pause',
      async event => {
        console.log('Received pause command from React:', event);
        await this.pauseGame();
        this.publishGameEvent({
          type: 'phaser.response.completed',
          data: { command: 'pause', timestamp: new Date() },
        });
      },
      { context: 'phaser-adapter', priority: EventPriority.HIGH }
    );

    const resumeSubId = globalEventBus.subscribe(
      'react.command.resume',
      async event => {
        console.log('Received resume command from React:', event);
        await this.resumeGame();
        this.publishGameEvent({
          type: 'phaser.response.completed',
          data: { command: 'resume', timestamp: new Date() },
        });
      },
      { context: 'phaser-adapter', priority: EventPriority.HIGH }
    );

    const saveSubId = globalEventBus.subscribe(
      'react.command.save',
      async event => {
        console.log('Received save command from React:', event);
        try {
          const saveId = await this.saveGame();
          this.publishGameEvent({
            type: 'phaser.response.completed',
            data: {
              command: 'save',
              result: { saveId },
              timestamp: new Date(),
            },
          });
        } catch (error) {
          this.publishGameEvent({
            type: 'game.error',
            data: {
              error: (error as Error).message,
              context: 'save-command',
              timestamp: new Date(),
            },
          });
        }
      },
      { context: 'phaser-adapter', priority: EventPriority.HIGH }
    );

    const loadSubId = globalEventBus.subscribe(
      'react.command.load',
      async event => {
        console.log('Received load command from React:', event);
        try {
          if (
            !event.data ||
            typeof event.data !== 'object' ||
            !('saveId' in event.data)
          ) {
            throw new Error('Invalid load command: missing saveId');
          }
          const saveId = (event.data as any).saveId;
          const gameState = await this.loadGame(saveId);
          this.publishGameEvent({
            type: 'phaser.response.completed',
            data: {
              command: 'load',
              result: { gameState },
              timestamp: new Date(),
            },
          });
        } catch (error) {
          this.publishGameEvent({
            type: 'game.error',
            data: {
              error: (error as Error).message,
              context: 'load-command',
              timestamp: new Date(),
            },
          });
        }
      },
      { context: 'phaser-adapter', priority: EventPriority.HIGH }
    );

    const restartSubId = globalEventBus.subscribe(
      'react.command.restart',
      async event => {
        console.log('Received restart command from React:', event);
        try {
          await this.endGame();
          if (this.currentConfig) {
            const newGameState = await this.initializeGame(this.currentConfig);
            await this.startGame();
            this.publishGameEvent({
              type: 'phaser.response.completed',
              data: {
                command: 'restart',
                result: { gameState: newGameState },
                timestamp: new Date(),
              },
            });
          }
        } catch (error) {
          this.publishGameEvent({
            type: 'game.error',
            data: {
              error: (error as Error).message,
              context: 'restart-command',
              timestamp: new Date(),
            },
          });
        }
      },
      { context: 'phaser-adapter', priority: EventPriority.HIGH }
    );

    // 保存订阅ID以便清理
    this.eventBusSubscriptions.push(
      pauseSubId,
      resumeSubId,
      saveSubId,
      loadSubId,
      restartSubId
    );

    // 发布Phaser就绪事件
    this.publishGameEvent({
      type: 'phaser.response.ready',
      data: { timestamp: new Date() },
    });
  }

  /**
   * 将域事件发布到EventBus供React监听
   */

  /**
   * 将域事件转换并发布到EventBus
   */
  private publishDomainEventToEventBus(event: DomainEvent): void {
    // 将当前的DomainEvent转换为GameDomainEvent格式
    let gameEvent: GameDomainEvent | null = null;

    switch (event.type) {
      case 'game.state.manager.updated':
        gameEvent = {
          type: 'game.state.updated',
          data: {
            gameState:
              event.data &&
              typeof event.data === 'object' &&
              'state' in event.data
                ? (event.data as any).state
                : {},
            timestamp: new Date(),
          },
        };
        break;

      case 'game.save.created':
        gameEvent = {
          type: 'game.save.created',
          data: {
            saveId:
              event.data &&
              typeof event.data === 'object' &&
              'saveId' in event.data
                ? (event.data as any).saveId
                : '',
            gameState:
              event.data &&
              typeof event.data === 'object' &&
              'state' in event.data
                ? (event.data as any).state
                : {},
          },
        };
        break;

      case 'game.save.loaded':
        gameEvent = {
          type: 'game.save.loaded',
          data: {
            saveId:
              event.data &&
              typeof event.data === 'object' &&
              'saveId' in event.data
                ? (event.data as any).saveId
                : '',
            gameState:
              event.data &&
              typeof event.data === 'object' &&
              'state' in event.data
                ? (event.data as any).state
                : {},
          },
        };
        break;

      case 'game.autosave.completed':
        gameEvent = {
          type: 'game.autosave.completed',
          data: {
            saveId:
              event.data &&
              typeof event.data === 'object' &&
              'saveId' in event.data
                ? (event.data as any).saveId
                : '',
            timestamp: new Date(),
          },
        };
        break;
    }

    // 发布转换后的事件
    if (gameEvent) {
      globalEventBus.publish(gameEvent, {
        source: 'phaser-adapter',
        priority: EventPriority.NORMAL,
      });
    }
  }

  /**
   * 销毁游戏引擎
   */
  destroy(): void {
    // 清理EventBus订阅
    this.eventBusSubscriptions.forEach(subId => {
      globalEventBus.unsubscribe(subId);
    });
    this.eventBusSubscriptions = [];

    // 清理其他资源
    this.gameLoop.stop();
    this.sceneManager.destroy();
    this.stateManager.destroy();
    this.stateSynchronizer.destroy();
    this.eventCallbacks.clear();
  }
}
