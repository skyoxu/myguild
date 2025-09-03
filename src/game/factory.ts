/**
 * 游戏引擎工厂函数
 * 提供便捷的游戏引擎创建和配置方法
 */

import { GameEngineAdapter } from './GameEngineAdapter';
import type { GameConfig } from '../ports/game-engine.port';
import type { DomainEvent } from '../shared/contracts/events';

export interface GameEngineOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  config?: Partial<GameConfig>;
  onEvent?: (event: DomainEvent) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
}

/**
 * 创建并初始化游戏引擎
 */
export async function createGameEngine(
  options: GameEngineOptions
): Promise<GameEngineAdapter> {
  const {
    container,
    width = 800,
    height = 600,
    config = {},
    onEvent,
    onError,
    autoStart = true,
  } = options;

  // 创建游戏引擎实例
  const gameEngine = new GameEngineAdapter();

  try {
    // 设置容器
    gameEngine.setContainer(container);

    // 订阅事件
    if (onEvent) {
      gameEngine.onGameEvent(onEvent);
    }

    // 设置错误处理
    gameEngine.onGameEvent((event: DomainEvent) => {
      if (
        event.type === 'game.error' &&
        onError &&
        event.data &&
        typeof event.data === 'object' &&
        'error' in event.data
      ) {
        onError(new Error((event.data as { error: string }).error));
      }
    });

    // 默认游戏配置
    const defaultConfig: GameConfig = {
      maxLevel: 50,
      initialHealth: 100,
      scoreMultiplier: 1.0,
      autoSave: true,
      difficulty: 'medium',
      ...config,
    };

    // 初始化游戏
    await gameEngine.initializeGame(defaultConfig);

    // 自动开始游戏
    if (autoStart) {
      await gameEngine.startGame();
    }

    return gameEngine;
  } catch (error) {
    // 清理资源
    gameEngine.destroy();
    throw error;
  }
}

/**
 * 创建游戏配置的预设
 */
export const gameConfigPresets = {
  /**
   * 简单模式配置
   */
  easy: {
    maxLevel: 30,
    initialHealth: 150,
    scoreMultiplier: 0.8,
    autoSave: true,
    difficulty: 'easy' as const,
  },

  /**
   * 标准模式配置
   */
  medium: {
    maxLevel: 50,
    initialHealth: 100,
    scoreMultiplier: 1.0,
    autoSave: true,
    difficulty: 'medium' as const,
  },

  /**
   * 困难模式配置
   */
  hard: {
    maxLevel: 100,
    initialHealth: 75,
    scoreMultiplier: 1.5,
    autoSave: false,
    difficulty: 'hard' as const,
  },

  /**
   * 开发测试模式
   */
  development: {
    maxLevel: 999,
    initialHealth: 9999,
    scoreMultiplier: 10.0,
    autoSave: true,
    difficulty: 'easy' as const,
  },
} as const;

/**
 * 使用预设配置创建游戏引擎
 */
export async function createGameEngineWithPreset(
  preset: keyof typeof gameConfigPresets,
  options: Omit<GameEngineOptions, 'config'>
): Promise<GameEngineAdapter> {
  return createGameEngine({
    ...options,
    config: gameConfigPresets[preset],
  });
}
