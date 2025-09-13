/**
 * Menu Scene - main menu and navigation
 */

declare const Phaser: any;
import { BaseScene } from './BaseScene';
import { EventUtils } from '../../shared/contracts/events';
import {
  setupTexturePipeline,
  DEFAULT_TEXTURES,
} from '../assets/texture-pipeline';

export class MenuScene extends BaseScene {
  private menuButtons: any[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  preload(): void {
    // @ts-ignore
    setupTexturePipeline(this.load as any, DEFAULT_TEXTURES);
  }

  initializeScene(): void {
    this.setupBackground();
    this.setupTitle();
    this.setupMenu();
    this.setupInput();

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
    const g = this.add.graphics();
    g.lineStyle(2, 0x1e293b, 0.8);
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height);
      const len = Phaser.Math.Between(50, 200);
      const ang = (Phaser.Math.Between(0, 360) * Math.PI) / 180;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    }
    g.strokePath();
  }

  private setupTitle(): void {
    const cx = this.scale.width / 2;
    const title = this.add
      .text(cx, 150, 'Main Menu', { font: 'bold 36px Arial', color: '#ffffff' })
      .setOrigin(0.5);
    this.tweens.add({
      targets: title,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 2000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private setupMenu(): void {
    const cx = this.scale.width / 2;
    const startY = 300;
    const spacing = 60;
    const options = [
      { text: 'Start Game', action: 'start-game' },
      { text: 'Load', action: 'load-game' },
      { text: 'Settings', action: 'settings' },
      { text: 'Exit', action: 'exit' },
    ];
    options.forEach((opt, i) => {
      const btn = this.add
        .text(cx, startY + i * spacing, opt.text, {
          font: '28px Arial',
          color: '#e2e8f0',
          backgroundColor: '#1e293b',
          padding: { x: 20, y: 10 },
        })
        .setOrigin(0.5);
      btn.setInteractive();
      btn.setData('action', opt.action);
      btn.on('pointerover', () => {
        btn.setStyle({ color: '#ffffff', backgroundColor: '#3182ce' });
        this.tweens.add({
          targets: btn,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 200,
        });
      });
      btn.on('pointerout', () => {
        btn.setStyle({ color: '#e2e8f0', backgroundColor: '#1e293b' });
        this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 200 });
      });
      btn.on('pointerdown', () => this.handleMenuAction(opt.action));
      this.menuButtons.push(btn);
    });
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ENTER', () => {
      const selected = this.menuButtons[0];
      if (selected) this.handleMenuAction(selected.getData('action'));
      else this.handleMenuAction('start-game');
    });
    this.input.keyboard!.on('keydown-ESC', () => this.handleMenuAction('exit'));
  }

  private handleMenuAction(action: string): void {
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
        this.cameras.main.fade(250, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene');
        });
        break;
      case 'load-game':
        console.log('Load game not implemented yet');
        break;
      case 'settings':
        console.log('Settings not implemented yet');
        break;
      case 'exit':
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
    // no-op for menu
  }
}
