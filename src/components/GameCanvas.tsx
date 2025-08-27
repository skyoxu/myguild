/**
 * Phaser游戏画布组件
 * 符合 CLAUDE.md 技术栈要求：Phaser 3 WebGL渲染 & 场景管理
 */

import { useRef, useEffect } from 'react';
import Phaser from 'phaser';

interface GameCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function GameCanvas({
  width = 800,
  height = 600,
  className = '',
}: GameCanvasProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 基础Phaser场景
    class DemoScene extends Phaser.Scene {
      constructor() {
        super({ key: 'DemoScene' });
      }

      preload() {
        // 创建简单的图形作为演示
        this.load.image(
          'logo',
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        );
      }

      create() {
        // 添加背景色
        this.cameras.main.setBackgroundColor('#1a202c');

        // 添加简单文本
        this.add
          .text(width / 2, height / 2, 'Phaser 3 + React + TypeScript', {
            font: '24px Arial',
            color: '#ffffff',
          })
          .setOrigin(0.5);

        // 添加一个简单的旋转方块作为演示
        const graphics = this.add.graphics();
        graphics.fillStyle(0x3182ce);
        graphics.fillRect(-25, -25, 50, 50);
        graphics.x = width / 2;
        graphics.y = height / 2 + 60;

        // 添加旋转动画
        this.tweens.add({
          targets: graphics,
          rotation: Math.PI * 2,
          duration: 2000,
          repeat: -1,
          ease: 'Linear',
        });
      }
    }

    // Phaser游戏配置
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: canvasRef.current,
      backgroundColor: '#1a202c',
      scene: DemoScene,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    // 创建游戏实例
    gameRef.current = new Phaser.Game(config);

    // 清理函数
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [width, height]);

  return (
    <div
      ref={canvasRef}
      className={`game-canvas ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        border: '2px solid #3182ce',
        borderRadius: '8px',
        padding: '10px',
      }}
    />
  );
}
