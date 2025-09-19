/**
 * 场景管理器 - 统一管理游戏场景的切换和生命周期
 */

// 顶层不再静态导入 phaser，改为 initialize() 内动态加载
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { TestScene } from './scenes/TestScene';
import type { DomainEvent } from '../shared/contracts/events';

export type SceneKey = 'MenuScene' | 'GameScene' | 'TestScene';

export interface SceneManagerConfig {
  onEvent?: (event: DomainEvent) => void;
  onError?: (error: Error, scene?: SceneKey) => void;
}

export class SceneManager {
  private game: any | null = null;
  private phaser: any | null = null;
  private config: SceneManagerConfig;
  private eventCallback?: (event: DomainEvent) => void;

  constructor(config: SceneManagerConfig = {}) {
    this.config = config;
    this.eventCallback = config.onEvent;
  }

  /**
   * 初始化场景管理器
   */
  async initialize(
    container: HTMLElement,
    width: number = 800,
    height: number = 600
  ): Promise<void> {
    try {
      const PhaserMod = (await import('phaser')).default as any;
      this.phaser = PhaserMod;
      // 暴露到全局，供未静态导入的场景访问（BaseScene/各 Scene 引用全局 Phaser）
      (globalThis as any).Phaser = PhaserMod;

      return new Promise<void>(resolve => {
        const gameConfig: any = {
          type: PhaserMod.AUTO,
          width,
          height,
          parent: container,
          backgroundColor: '#1a202c',
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false,
            },
          },
          scale: {
            mode: PhaserMod.Scale.FIT,
            autoCenter: PhaserMod.Scale.CENTER_BOTH,
            min: {
              width: 400,
              height: 300,
            },
            max: {
              width: 1600,
              height: 1200,
            },
          },
          scene: [MenuScene, GameScene, TestScene],
          callbacks: {
            postBoot: () => {
              this.setupEventHandlers();
              resolve();
            },
          },
        };

        this.game = new PhaserMod.Game(gameConfig);
      });
    } catch (error) {
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.game) return;

    // 监听所有场景的域事件
    this.game.events.on('domain-event', (event: DomainEvent) => {
      this.handleDomainEvent(event);
    });

    // 为已经存在的场景设置事件转发
    this.setupSceneEventListeners();

    // 延迟设置场景监听器，确保所有场景都已创建
    setTimeout(() => {
      console.log('🔗 SceneManager: 延迟设置场景监听器');
      this.setupSceneEventListeners();
    }, 500);
  }

  /**
   * 为单个场景设置事件监听器
   */
  private setupListenerForScene(scene: any): void {
    const sceneKey = scene.scene.key;
    console.log(`🔗 SceneManager: 为场景 ${sceneKey} 设置事件监听器`);

    // 避免重复监听器
    scene.events.off('domain-event');

    scene.events.on('domain-event', (event: DomainEvent) => {
      console.log(`🔗 SceneManager: 收到来自 ${sceneKey} 的事件:`, event.type);
      console.log(`🔗 SceneManager: eventCallback 存在:`, !!this.eventCallback);
      this.eventCallback?.(event);
      console.log(`🔗 SceneManager: 已转发事件给 eventCallback`);
    });
  }

  /**
   * 为所有场景设置事件监听器
   */
  private setupSceneEventListeners(): void {
    if (!this.game) return;

    const sceneManager = this.game.scene;

    ['MenuScene', 'GameScene', 'TestScene'].forEach(sceneKey => {
      const scene = sceneManager.getScene(sceneKey);
      if (scene) {
        this.setupListenerForScene(scene);
      } else {
        console.warn(`⚠️ SceneManager: 场景 ${sceneKey} 未找到，稍后重试`);
      }
    });
  }

  /**
   * 处理域事件
   */
  private handleDomainEvent(event: DomainEvent): void {
    // 记录事件（可以发送到外部系统）
    console.log('Domain Event:', event);

    // 根据事件类型执行相应逻辑
    switch (event.type) {
      case 'game.menu.action':
        this.handleMenuAction(event);
        break;

      case 'game.state.paused':
        this.handleGamePaused(event);
        break;

      case 'game.exit.requested':
        this.handleExitRequested(event);
        break;

      case 'game.error':
        this.handleGameError(event);
        break;
    }

    // 转发事件到外部处理器
    this.eventCallback?.(event);
  }

  /**
   * 处理菜单动作事件
   */
  private handleMenuAction(event: DomainEvent): void {
    const { action } = event.data as { action: string };

    switch (action) {
      case 'start-game':
        this.startGame();
        break;
      case 'exit':
        this.exitGame();
        break;
    }
  }

  /**
   * 处理游戏暂停事件
   */
  private handleGamePaused(event: DomainEvent): void {
    // 可以显示暂停菜单或保存游戏状态
    console.log('Game paused:', event.data);
  }

  /**
   * 处理退出请求事件
   */
  private handleExitRequested(event: DomainEvent): void {
    this.exitGame();
  }

  /**
   * 处理游戏错误事件
   */
  private handleGameError(event: DomainEvent): void {
    const errorData = event.data as { error: string; scene?: string };
    this.config.onError?.(
      new Error(errorData.error),
      errorData.scene as SceneKey
    );
  }

  /**
   * 开始游戏
   */
  startGame(): void {
    if (!this.game) return;
    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('scene_switch_triggered:GameScene');
      }
    } catch {}

    const gameScene = this.game.scene.getScene('GameScene') as GameScene;
    if (gameScene) {
      this.game.scene.start('GameScene');
    }
  }

  /**
   * 暂停游戏
   */
  pauseGame(): void {
    if (!this.game) return;

    const gameScene = this.game.scene.getScene('GameScene');
    if (gameScene && gameScene.scene.isActive()) {
      gameScene.scene.pause();
    }
  }

  /**
   * 恢复游戏
   */
  resumeGame(): void {
    if (!this.game) return;

    const gameScene = this.game.scene.getScene('GameScene');
    if (gameScene && gameScene.scene.isPaused()) {
      gameScene.scene.resume();
    }
  }

  /**
   * 重启游戏
   */
  restartGame(): void {
    if (!this.game) return;

    this.game.scene.start('GameScene');
  }

  /**
   * 启动测试场景
   */
  startTestScene(): void {
    if (!this.game) return;
    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('scene_switch_triggered:TestScene');
      }
    } catch {}

    console.log('🎮 SceneManager: 启动TestScene');
    this.game.scene.start('TestScene');
  }

  /**
   * 返回菜单
   */
  returnToMenu(): void {
    if (!this.game) return;
    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('scene_switch_triggered:MenuScene');
      }
    } catch {}

    this.game.scene.start('MenuScene');
  }

  /**
   * 退出游戏
   */
  exitGame(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }

  /**
   * 获取当前活动场景
   */
  getCurrentScene(): any | null {
    if (!this.game) return null;

    const scenes = this.game.scene.getScenes(true);
    return scenes.length > 0 ? scenes[0] : null;
  }

  /**
   * 获取游戏状态（如果在游戏场景中）
   */
  getGameState(): any {
    if (!this.game) return null;

    const gameScene = this.game.scene.getScene('GameScene') as GameScene;
    if (gameScene && gameScene.scene.isActive()) {
      return gameScene.getGameState();
    }

    return null;
  }

  /**
   * 设置游戏状态（如果在游戏场景中）
   */
  setGameState(state: any): void {
    if (!this.game) return;

    const gameScene = this.game.scene.getScene('GameScene') as GameScene;
    if (gameScene && gameScene.scene.isActive()) {
      gameScene.setGameState(state);
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.game !== null;
  }

  /**
   * 销毁场景管理器
   */
  destroy(): void {
    this.exitGame();
    this.eventCallback = undefined;
  }
}
