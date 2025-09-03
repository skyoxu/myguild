/**
 * 菜单场景 - 游戏主菜单和导航
 */

import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { EventUtils } from '../../shared/contracts/events';

export class MenuScene extends BaseScene {
  private menuButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  preload(): void {
    // 预加载菜单资源
  }

  initializeScene(): void {
    this.setupBackground();
    this.setupTitle();
    this.setupMenu();
    this.setupInput();

    // 发布菜单初始化完成事件
    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.menu.initialized',
        source: 'menu-scene',
        data: { scene: 'MenuScene' },
        id: `menu-init-${Date.now()}`,
      })
    );
  }

  private setupBackground(): void {
    this.cameras.main.setBackgroundColor('#0f172a');

    // 添加装饰性背景
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x1e293b, 0.8);

    // 绘制装饰性线条
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height);
      const length = Phaser.Math.Between(50, 200);
      const angle = (Phaser.Math.Between(0, 360) * Math.PI) / 180;

      graphics.moveTo(x, y);
      graphics.lineTo(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      );
    }
    graphics.strokePath();
  }

  private setupTitle(): void {
    const centerX = this.scale.width / 2;
    const title = this.add
      .text(centerX, 150, '公会经理', {
        font: 'bold 48px Arial',
        color: '#ffffff',
        stroke: '#3182ce',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(centerX, 200, 'Guild Manager', {
        font: '24px Arial',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // 标题动画
    this.tweens.add({
      targets: title,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 2000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private setupMenu(): void {
    const centerX = this.scale.width / 2;
    const startY = 300;
    const spacing = 60;

    const menuOptions = [
      { text: '开始游戏', action: 'start-game' },
      { text: '加载存档', action: 'load-game' },
      { text: '设置', action: 'settings' },
      { text: '退出', action: 'exit' },
    ];

    menuOptions.forEach((option, index) => {
      const button = this.add
        .text(centerX, startY + index * spacing, option.text, {
          font: '32px Arial',
          color: '#e2e8f0',
          backgroundColor: '#1e293b',
          padding: { x: 20, y: 10 },
        })
        .setOrigin(0.5);

      button.setInteractive();
      button.setData('action', option.action);

      // 悬停效果
      button.on('pointerover', () => {
        button.setStyle({ color: '#ffffff', backgroundColor: '#3182ce' });
        this.tweens.add({
          targets: button,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 200,
          ease: 'Power2',
        });
      });

      button.on('pointerout', () => {
        button.setStyle({ color: '#e2e8f0', backgroundColor: '#1e293b' });
        this.tweens.add({
          targets: button,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: 'Power2',
        });
      });

      button.on('pointerdown', () => {
        this.handleMenuAction(option.action);
      });

      this.menuButtons.push(button);
    });
  }

  private setupInput(): void {
    // 键盘导航
    this.input.keyboard!.on('keydown-ENTER', () => {
      const selectedButton = this.menuButtons.find(
        btn => btn.style.backgroundColor === '#3182ce'
      );
      if (selectedButton) {
        this.handleMenuAction(selectedButton.getData('action'));
      } else {
        // 默认开始游戏
        this.handleMenuAction('start-game');
      }
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      this.handleMenuAction('exit');
    });
  }

  private handleMenuAction(action: string): void {
    // 发布菜单动作事件
    this.publishEvent(
      EventUtils.createEvent({
        type: 'game.menu.action',
        source: 'menu-scene',
        data: { action },
        id: `menu-action-${Date.now()}`,
      })
    );

    switch (action) {
      case 'start-game':
        // 过渡到游戏场景
        this.cameras.main.fade(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene');
        });
        break;

      case 'load-game':
        // TODO: 实现加载存档功能
        console.log('Load game not implemented yet');
        break;

      case 'settings':
        // TODO: 实现设置界面
        console.log('Settings not implemented yet');
        break;

      case 'exit':
        // 发布退出事件
        this.publishEvent(
          EventUtils.createEvent({
            type: 'game.exit.requested',
            source: 'menu-scene',
            data: { reason: 'user_menu_selection' },
            id: `exit-${Date.now()}`,
          })
        );
        break;
    }
  }

  updateScene(time: number, delta: number): void {
    // 菜单场景通常不需要复杂的更新逻辑
    // 可以添加背景动画或粒子效果
  }
}
