/**
 * 主游戏场景 - 公会管理游戏的核心场景
 * 处理游戏逻辑、UI 交互和事件管理
 */

// 顶层移除对 phaser 的静态导入，改用全局 Phaser（由 SceneManager.initialize 注入）
declare const Phaser: any;
import { BaseScene } from './BaseScene';
import type {
  GameState,
  Position,
  GameInput,
} from '../../ports/game-engine.port';
import type { DomainEvent } from '../../shared/contracts/events';
import { EventUtils } from '../../shared/contracts/events';
import {
  setupTexturePipeline,
  DEFAULT_TEXTURES,
} from '../assets/texture-pipeline';

export class GameScene extends BaseScene {
  private gameState: Partial<GameState> = {
    level: 1,
    score: 0,
    health: 100,
    inventory: [],
    position: { x: 400, y: 300 },
    timestamp: new Date(),
  };

  private player?: Phaser.GameObjects.Graphics;
  private ui?: {
    scoreText?: Phaser.GameObjects.Text;
    healthText?: Phaser.GameObjects.Text;
    levelText?: Phaser.GameObjects.Text;
  };

  constructor() {
    super({ key: 'GameScene' });
    this.ui = {};
  }

  /**
   * 预加载资源
   */
  preload(): void {
    // 纹理/atlas 管线（占位配置，可按需填充 DEFAULT_TEXTURES）
    // @ts-ignore - Phaser 注入 loader API
    setupTexturePipeline(this.load as any, DEFAULT_TEXTURES);
    // 创建简单的像素图形作为占位符
    this.load.image(
      'player',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    );

    // 发布加载进度事件
    this.load.on('progress', (progress: number) => {
      this.publishEvent(
        EventUtils.createEvent({
          type: 'game.loading.progress',
          source: 'game-scene',
          data: { progress },
          id: `loading-${Date.now()}`,
        })
      );
    });
  }

  /**
   * 初始化场景特定逻辑
   */
  initializeScene(): void {
    this.setupBackground();
    this.setupPlayer();
    this.setupUI();
    this.setupInput();
    this.setupPhysics();

    // 发布场景初始化完成事件
    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.scene.initialized',
        source: 'game-scene',
        data: { scene: 'GameScene' },
        id: `scene-init-${Date.now()}`,
      })
    );
  }

  /**
   * 设置背景
   */
  private setupBackground(): void {
    this.cameras.main.setBackgroundColor('#1a202c');

    // 添加网格背景
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 0.5);

    const gridSize = 50;
    for (let x = 0; x < this.scale.width; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, this.scale.height);
    }
    for (let y = 0; y < this.scale.height; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(this.scale.width, y);
    }
    graphics.strokePath();
  }

  /**
   * 设置玩家
   */
  private setupPlayer(): void {
    const pos = this.gameState.position!;

    this.player = this.add.graphics();
    this.player.fillStyle(0x3182ce, 1);
    this.player.fillCircle(0, 0, 20);
    this.player.x = pos.x;
    this.player.y = pos.y;

    // 启用物理体
    this.physics.add.existing(this.player);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(
      true
    );
  }

  /**
   * 设置UI
   */
  private setupUI(): void {
    const padding = 20;

    this.ui!.scoreText = this.add.text(
      padding,
      padding,
      `分数: ${this.gameState.score}`,
      {
        font: '18px Arial',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );

    this.ui!.healthText = this.add.text(
      padding,
      padding + 30,
      `生命值: ${this.gameState.health}`,
      {
        font: '18px Arial',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );

    this.ui!.levelText = this.add.text(
      padding,
      padding + 60,
      `等级: ${this.gameState.level}`,
      {
        font: '18px Arial',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );

    // 设置UI层级
    this.ui!.scoreText.setDepth(100);
    this.ui!.healthText.setDepth(100);
    this.ui!.levelText.setDepth(100);
  }

  /**
   * 设置输入处理
   */
  private setupInput(): void {
    // 键盘输入
    const cursors = this.input.keyboard!.createCursorKeys();
    const wasd = this.input.keyboard!.addKeys('W,S,A,D');

    // 鼠标输入
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleInput({
        type: 'mouse',
        action: 'click',
        data: { x: pointer.x, y: pointer.y, button: pointer.button },
        timestamp: new Date(),
      });
    });

    // 键盘输入事件
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      this.handleInput({
        type: 'keyboard',
        action: 'keydown',
        data: { key: event.key, code: event.code },
        timestamp: new Date(),
      });
    });

    // 存储输入对象以供后续使用
    (this as any).cursors = cursors;
    (this as any).wasd = wasd;
  }

  /**
   * 设置物理系统
   */
  private setupPhysics(): void {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
  }

  /**
   * 处理游戏输入
   */
  handleInput(input: GameInput): void {
    if (!this.player) return;

    const speed = 200;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    switch (input.action) {
      case 'click':
        if (input.type === 'mouse') {
          const targetX = input.data.x as number;
          const targetY = input.data.y as number;

          // 移动玩家到点击位置
          this.tweens.add({
            targets: this.player,
            x: targetX,
            y: targetY,
            duration: 500,
            ease: 'Power2',
          });

          // 更新游戏状态
          this.setGameState({ position: { x: targetX, y: targetY } });
        }
        break;

      case 'keydown':
        if (input.type === 'keyboard') {
          const key = input.data.key as string;

          switch (key.toLowerCase()) {
            case 'w':
            case 'arrowup':
              body.setVelocityY(-speed);
              break;
            case 's':
            case 'arrowdown':
              body.setVelocityY(speed);
              break;
            case 'a':
            case 'arrowleft':
              body.setVelocityX(-speed);
              break;
            case 'd':
            case 'arrowright':
              body.setVelocityX(speed);
              break;
            case ' ':
              // 空格键暂停游戏
              this.scene.pause();
              this.publishEvent(
                EventUtils.createEvent({
                  type: 'game.state.paused',
                  source: 'game-scene',
                  data: { reason: 'user_input' },
                  id: `pause-${Date.now()}`,
                })
              );
              break;
          }
        }
        break;
    }

    // 发布输入处理事件
    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.input.processed',
        source: 'game-scene',
        data: { input },
        id: `input-${Date.now()}`,
      })
    );
  }

  /**
   * 更新场景逻辑
   */
  updateScene(time: number, delta: number): void {
    if (!this.player) return;

    // 更新玩家位置和时间戳
    this.setGameState({
      position: {
        x: this.player.x,
        y: this.player.y,
      },
      timestamp: new Date(),
    });

    // 处理连续输入（移动）
    const cursors = (this as any).cursors;
    const wasd = (this as any).wasd;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (cursors || wasd) {
      let velocityX = 0;
      let velocityY = 0;

      if (cursors.left.isDown || wasd.A.isDown) {
        velocityX = -200;
      } else if (cursors.right.isDown || wasd.D.isDown) {
        velocityX = 200;
      }

      if (cursors.up.isDown || wasd.W.isDown) {
        velocityY = -200;
      } else if (cursors.down.isDown || wasd.S.isDown) {
        velocityY = 200;
      }

      body.setVelocity(velocityX, velocityY);
    }

    // 定期发布游戏状态更新事件（每秒一次）
    if (time % 1000 < delta) {
      this.publishEvent(
        EventUtils.createEvent({
          type: 'game.state.updated',
          source: 'game-scene',
          data: { gameState: this.gameState },
          id: `state-update-${Date.now()}`,
        })
      );
    }
  }

  /**
   * 获取当前游戏状态
   */
  getGameState(): Partial<GameState> {
    return { ...this.gameState };
  }

  /**
   * 设置游戏状态
   */
  setGameState(newState: Partial<GameState>): void {
    this.gameState = { ...this.gameState, ...newState };

    // 更新UI
    if (this.ui!.scoreText && newState.score !== undefined) {
      this.ui!.scoreText.setText(`分数: ${newState.score}`);
    }
    if (this.ui!.healthText && newState.health !== undefined) {
      this.ui!.healthText.setText(`生命值: ${newState.health}`);
    }
    if (this.ui!.levelText && newState.level !== undefined) {
      this.ui!.levelText.setText(`等级: ${newState.level}`);
    }

    // 发布状态变更事件
    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.state.changed',
        source: 'game-scene',
        data: { gameState: this.gameState },
        id: `state-change-${Date.now()}`,
      })
    );
  }
}
