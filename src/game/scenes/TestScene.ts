/**
 * 测试场景 - 竖切验证场景
 * 最小化实现：精灵移动 → 触发level.complete事件 → 数据持久化
 */

import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { GameState, GameInput } from '../../ports/game-engine.port';
import type { GameDomainEvent } from '../../shared/contracts/events/GameEvents';

interface TestSceneState {
  playerPosition: { x: number; y: number };
  totalMoves: number;
  startTime: Date;
  levelCompleted: boolean;
}

export class TestScene extends BaseScene {
  private testState: TestSceneState = {
    playerPosition: { x: 400, y: 300 },
    totalMoves: 0,
    startTime: new Date(),
    levelCompleted: false,
  };

  private player?: Phaser.GameObjects.Graphics;
  private goalArea?: Phaser.GameObjects.Graphics;
  private ui?: {
    instructionText?: Phaser.GameObjects.Text;
    movesText?: Phaser.GameObjects.Text;
    statusText?: Phaser.GameObjects.Text;
  };

  constructor() {
    super({ key: 'TestScene' });
    this.ui = {};
  }

  /**
   * 预加载资源（测试场景无需外部资源）
   */
  preload(): void {
    // 发布场景开始加载事件
    this.publishEvent({
      type: 'game.scene.started',
      source: 'test-scene',
      data: { sceneKey: 'TestScene', timestamp: new Date() },
      timestamp: new Date(),
      id: `test-scene-start-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    } as GameDomainEvent);
  }

  /**
   * 初始化测试场景
   */
  initializeScene(): void {
    this.setupBackground();
    this.setupPlayer();
    this.setupGoalArea();
    this.setupUI();
    this.setupInput();

    // 发布场景创建事件
    this.publishEvent({
      type: 'game.scene.created',
      source: 'test-scene',
      data: { sceneKey: 'TestScene', timestamp: new Date() },
      timestamp: new Date(),
      id: `test-scene-created-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    } as GameDomainEvent);
  }

  /**
   * 设置简单背景
   */
  private setupBackground(): void {
    this.cameras.main.setBackgroundColor('#2d3748');

    // 添加简单的网格指示器
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x4a5568, 0.3);

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
   * 设置玩家精灵（简单的蓝色圆形）
   */
  private setupPlayer(): void {
    const pos = this.testState.playerPosition;

    this.player = this.add.graphics();
    this.player.fillStyle(0x3182ce, 1);
    this.player.fillCircle(0, 0, 25);
    this.player.x = pos.x;
    this.player.y = pos.y;

    // 添加白色边框以增强可见性
    this.player.lineStyle(3, 0xffffff, 0.8);
    this.player.strokeCircle(0, 0, 25);
  }

  /**
   * 设置目标区域（到达后触发level.complete）
   */
  private setupGoalArea(): void {
    const goalX = 700;
    const goalY = 100;

    this.goalArea = this.add.graphics();
    this.goalArea.fillStyle(0x48bb78, 0.3);
    this.goalArea.fillRect(0, 0, 80, 80);
    this.goalArea.lineStyle(3, 0x48bb78, 1);
    this.goalArea.strokeRect(0, 0, 80, 80);
    this.goalArea.x = goalX;
    this.goalArea.y = goalY;

    // 添加目标标识文字
    this.add.text(goalX + 10, goalY + 30, '目标', {
      font: '16px Arial',
      color: '#ffffff',
      backgroundColor: '#48bb78',
      padding: { x: 8, y: 4 },
    });
  }

  /**
   * 设置UI界面
   */
  private setupUI(): void {
    const padding = 20;

    this.ui!.instructionText = this.add.text(
      padding,
      padding,
      '使用WASD或方向键移动蓝色精灵到右上角绿色区域',
      {
        font: '18px Arial',
        color: '#ffffff',
        backgroundColor: '#2d3748',
        padding: { x: 15, y: 10 },
        wordWrap: { width: this.scale.width - 40 },
      }
    );

    this.ui!.movesText = this.add.text(
      padding,
      padding + 50,
      `移动次数: ${this.testState.totalMoves}`,
      {
        font: '16px Arial',
        color: '#e2e8f0',
        backgroundColor: '#4a5568',
        padding: { x: 10, y: 5 },
      }
    );

    this.ui!.statusText = this.add.text(
      padding,
      padding + 80,
      '状态: 进行中...',
      {
        font: '16px Arial',
        color: '#fbb6ce',
        backgroundColor: '#553c9a',
        padding: { x: 10, y: 5 },
      }
    );

    // 设置UI层级
    this.ui!.instructionText.setDepth(100);
    this.ui!.movesText.setDepth(100);
    this.ui!.statusText.setDepth(100);
  }

  /**
   * 设置输入处理
   */
  private setupInput(): void {
    // WASD和方向键
    const cursors = this.input.keyboard!.createCursorKeys();
    const wasd = this.input.keyboard!.addKeys('W,S,A,D');

    // 存储输入对象
    (this as any).cursors = cursors;
    (this as any).wasd = wasd;

    // 键盘事件监听
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (this.testState.levelCompleted) return;

      this.handleInput({
        type: 'keyboard',
        action: 'keydown',
        data: { key: event.key, code: event.code },
        timestamp: new Date(),
      });
    });

    // 也支持鼠标点击移动（可选）
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.testState.levelCompleted) return;

      this.handleInput({
        type: 'mouse',
        action: 'click',
        data: { x: pointer.x, y: pointer.y, button: pointer.button },
        timestamp: new Date(),
      });
    });
  }

  /**
   * 处理玩家输入
   */
  handleInput(input: GameInput): void {
    if (!this.player || this.testState.levelCompleted) return;

    const speed = 50;
    let moved = false;
    let newX = this.player.x;
    let newY = this.player.y;

    switch (input.action) {
      case 'keydown':
        if (input.type === 'keyboard') {
          const key = input.data.key as string;

          switch (key.toLowerCase()) {
            case 'w':
            case 'arrowup':
              newY = Math.max(25, this.player.y - speed);
              moved = true;
              break;
            case 's':
            case 'arrowdown':
              newY = Math.min(this.scale.height - 25, this.player.y + speed);
              moved = true;
              break;
            case 'a':
            case 'arrowleft':
              newX = Math.max(25, this.player.x - speed);
              moved = true;
              break;
            case 'd':
            case 'arrowright':
              newX = Math.min(this.scale.width - 25, this.player.x + speed);
              moved = true;
              break;
            case ' ':
            case 'enter':
              // 空格键或回车键也可以触发完成（调试用）
              this.triggerLevelComplete('manual_trigger');
              return;
          }
        }
        break;

      case 'click':
        if (input.type === 'mouse') {
          const targetX = Math.max(
            25,
            Math.min(this.scale.width - 25, input.data.x as number)
          );
          const targetY = Math.max(
            25,
            Math.min(this.scale.height - 25, input.data.y as number)
          );

          newX = targetX;
          newY = targetY;
          moved = true;
        }
        break;
    }

    if (moved) {
      // 移动玩家
      this.player.x = newX;
      this.player.y = newY;

      // 更新状态
      this.testState.playerPosition = { x: newX, y: newY };
      this.testState.totalMoves++;

      // 更新UI
      this.updateUI();

      // 发布移动事件
      this.publishEvent({
        type: 'game.player.moved',
        source: 'test-scene',
        data: {
          position: { x: newX, y: newY },
          timestamp: new Date(),
        },
        timestamp: new Date(),
        id: `player-move-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      } as GameDomainEvent);

      // 检查是否到达目标区域
      this.checkGoalCollision();

      // 发布输入处理事件
      this.publishEvent({
        type: 'game.input.keyboard',
        source: 'test-scene',
        data: {
          key: input.type === 'keyboard' ? input.data.key : 'click',
          action: 'keydown',
          timestamp: new Date(),
        },
        timestamp: new Date(),
        id: `input-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      } as GameDomainEvent);
    }
  }

  /**
   * 检查玩家是否到达目标区域
   */
  private checkGoalCollision(): void {
    if (!this.player || !this.goalArea || this.testState.levelCompleted) return;

    const playerBounds = {
      left: this.player.x - 25,
      right: this.player.x + 25,
      top: this.player.y - 25,
      bottom: this.player.y + 25,
    };

    const goalBounds = {
      left: this.goalArea.x,
      right: this.goalArea.x + 80,
      top: this.goalArea.y,
      bottom: this.goalArea.y + 80,
    };

    // 检查碰撞
    if (
      playerBounds.right > goalBounds.left &&
      playerBounds.left < goalBounds.right &&
      playerBounds.bottom > goalBounds.top &&
      playerBounds.top < goalBounds.bottom
    ) {
      this.triggerLevelComplete('goal_reached');
    }
  }

  /**
   * 触发关卡完成事件
   */
  private triggerLevelComplete(reason: string): void {
    if (this.testState.levelCompleted) return;

    this.testState.levelCompleted = true;
    const endTime = new Date();
    const duration = endTime.getTime() - this.testState.startTime.getTime();

    // 计算简单的分数
    const score = Math.max(100 - this.testState.totalMoves, 10) * 10;

    const levelResult = {
      levelId: 'test-level-1',
      completed: true,
      score: score,
      totalMoves: this.testState.totalMoves,
      duration: duration,
      completionReason: reason,
      timestamp: endTime,
    };

    // 发布关键的 level.complete 事件（用于数据持久化）
    this.publishEvent({
      type: 'game.level.completed',
      source: 'test-scene',
      data: { result: levelResult, timestamp: endTime },
      timestamp: endTime,
      id: `level-complete-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    } as GameDomainEvent);

    // 发布分数事件
    this.publishEvent({
      type: 'game.player.scored',
      source: 'test-scene',
      data: {
        score: score,
        increment: score,
        timestamp: endTime,
      },
      timestamp: endTime,
      id: `score-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    } as GameDomainEvent);

    // 更新UI显示完成状态
    this.updateUI();

    // 添加完成效果
    this.showCompletionEffects(levelResult);
  }

  /**
   * 显示完成特效和信息
   */
  private showCompletionEffects(result: any): void {
    if (!this.player) return;

    // 玩家变成金色
    this.player.clear();
    this.player.fillStyle(0xffd700, 1);
    this.player.fillCircle(0, 0, 30);
    this.player.lineStyle(3, 0xffffff, 1);
    this.player.strokeCircle(0, 0, 30);

    // 显示完成信息
    const completionText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      `🎉 关卡完成！\n分数: ${result.score}\n移动次数: ${result.totalMoves}\n用时: ${Math.round(result.duration / 1000)}秒\n\n按ESC键返回或等待5秒自动返回`,
      {
        font: '24px Arial',
        color: '#ffffff',
        backgroundColor: '#2d3748',
        padding: { x: 20, y: 15 },
        align: 'center',
      }
    );
    completionText.setOrigin(0.5);
    completionText.setDepth(200);

    // 添加闪烁效果
    this.tweens.add({
      targets: completionText,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // 5秒后自动返回首页或触发下一步
    this.time.delayedCall(5000, () => {
      this.triggerSceneEnd();
    });

    // ESC键立即返回
    this.input.keyboard!.on('keydown-ESC', () => {
      this.triggerSceneEnd();
    });
  }

  /**
   * 触发场景结束
   */
  private triggerSceneEnd(): void {
    // 发布场景结束事件
    this.publishEvent({
      type: 'game.scene.stopped',
      source: 'test-scene',
      data: { sceneKey: 'TestScene', timestamp: new Date() },
      timestamp: new Date(),
      id: `scene-end-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    } as GameDomainEvent);

    // 这里可以切换回主场景或触发应用退出
    // 具体逻辑将在GameVerticalSlice组件中处理
    this.events.emit('level-completed', this.testState);
  }

  /**
   * 更新UI显示
   */
  private updateUI(): void {
    if (this.ui!.movesText) {
      this.ui!.movesText.setText(`移动次数: ${this.testState.totalMoves}`);
    }

    if (this.ui!.statusText) {
      if (this.testState.levelCompleted) {
        this.ui!.statusText.setText('状态: 已完成! 🎉');
        this.ui!.statusText.setStyle({ color: '#68d391' });
      } else {
        this.ui!.statusText.setText('状态: 进行中...');
      }
    }
  }

  /**
   * 场景更新循环
   */
  updateScene(time: number, delta: number): void {
    // 测试场景的更新逻辑较简单
    // 主要是检测连续按键（如果需要的话）

    if (this.testState.levelCompleted) return;

    const cursors = (this as any).cursors;
    const wasd = (this as any).wasd;

    // 检查连续按键移动（平滑移动）
    if (cursors || wasd) {
      let moveX = 0;
      let moveY = 0;
      const smoothSpeed = 3;

      if (cursors.left.isDown || wasd.A.isDown) {
        moveX = -smoothSpeed;
      } else if (cursors.right.isDown || wasd.D.isDown) {
        moveX = smoothSpeed;
      }

      if (cursors.up.isDown || wasd.W.isDown) {
        moveY = -smoothSpeed;
      } else if (cursors.down.isDown || wasd.S.isDown) {
        moveY = smoothSpeed;
      }

      if (moveX !== 0 || moveY !== 0) {
        const newX = Math.max(
          25,
          Math.min(this.scale.width - 25, this.player!.x + moveX)
        );
        const newY = Math.max(
          25,
          Math.min(this.scale.height - 25, this.player!.y + moveY)
        );

        if (newX !== this.player!.x || newY !== this.player!.y) {
          this.player!.x = newX;
          this.player!.y = newY;
          this.testState.playerPosition = { x: newX, y: newY };

          // 检查目标碰撞（平滑移动时也检查）
          this.checkGoalCollision();
        }
      }
    }
  }

  /**
   * 获取测试状态（供外部组件使用）
   */
  getTestState(): TestSceneState {
    return { ...this.testState };
  }
}
