/**
 * 游戏引擎适配器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngineAdapter } from '../GameEngineAdapter';
import type { GameConfig, GameState } from '../../ports/game-engine.port';

// Mock Phaser 并同步到全局，兼容 BaseScene 对全局 Phaser 的引用
vi.mock('phaser', () => import('./__mocks__/phaser'));
import Phaser from 'phaser';
(globalThis as any).Phaser = Phaser as any;

// Mock DOM API
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock Performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
  },
  writable: true,
});

describe('GameEngineAdapter', () => {
  let gameEngine: GameEngineAdapter;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // 创建模拟容器
    mockContainer = document.createElement('div');
    mockContainer.style.width = '800px';
    mockContainer.style.height = '600px';
    document.body.appendChild(mockContainer);

    // 创建游戏引擎实例
    gameEngine = new GameEngineAdapter();
    gameEngine.setContainer(mockContainer);
  });

  afterEach(() => {
    // 清理
    gameEngine.destroy();
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该能成功创建游戏引擎实例', () => {
      expect(gameEngine).toBeDefined();
      expect(gameEngine.getStateMachineState()).toBe('boot');
    });

    it('应该能初始化游戏配置', async () => {
      const config: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };

      const initialState = await gameEngine.initializeGame(config);

      expect(initialState).toBeDefined();
      expect(initialState.health).toBe(100);
      expect(initialState.level).toBe(1);
      expect(initialState.score).toBe(0);
      expect(gameEngine.getStateMachineState()).toBe('running');
    });
  });

  describe('游戏状态管理', () => {
    beforeEach(async () => {
      const config: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };
      await gameEngine.initializeGame(config);
    });

    it('应该能获取当前游戏状态', () => {
      const state = gameEngine.getCurrentState();

      expect(state).toBeDefined();
      expect(state.id).toBeTruthy();
      expect(state.health).toBe(100);
      expect(state.level).toBe(1);
      expect(state.score).toBe(0);
    });

    it('应该能处理用户输入', async () => {
      const input = {
        type: 'keyboard' as const,
        action: 'keydown',
        data: { key: 'w', code: 'KeyW' },
        timestamp: new Date(),
      };

      // 应该不抛出异常
      await expect(gameEngine.handleInput(input)).resolves.toBeUndefined();
    });
  });

  describe('存档系统', () => {
    let initialState: GameState;

    beforeEach(async () => {
      const config: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };
      initialState = await gameEngine.initializeGame(config);
    });

    it('应该能保存游戏状态', async () => {
      const saveId = await gameEngine.saveGame();

      expect(saveId).toBeTruthy();
      expect(typeof saveId).toBe('string');
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('应该能加载游戏状态', async () => {
      // 先保存
      const saveId = await gameEngine.saveGame();

      // 使用与GameStateManager相同的校验和计算方法
      const calculateChecksum = (state: any): string => {
        const stateStr = JSON.stringify(state, Object.keys(state).sort());
        let hash = 0;
        for (let i = 0; i < stateStr.length; i++) {
          const char = stateStr.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // 转换为32位整数
        }
        return hash.toString(16);
      };

      const correctChecksum = calculateChecksum(initialState);

      // 模拟存储的数据
      const saveData = {
        id: saveId,
        state: initialState,
        config: {
          maxLevel: 50,
          initialHealth: 100,
          scoreMultiplier: 1.0,
          autoSave: true,
          difficulty: 'medium',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          checksum: correctChecksum,
        },
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(saveData));

      // 加载游戏
      const loadedState = await gameEngine.loadGame(saveId);

      expect(loadedState).toBeDefined();
      expect(loadedState.id).toBe(initialState.id);
      expect(loadedState.health).toBe(initialState.health);
    });

    it('加载不存在的存档应该抛出错误', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      await expect(gameEngine.loadGame('nonexistent')).rejects.toThrow();
    });
  });

  describe('事件系统', () => {
    beforeEach(async () => {
      const config: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };
      await gameEngine.initializeGame(config);
    });

    it('应该能订阅和接收游戏事件', done => {
      const eventHandler = vi.fn(event => {
        expect(event).toBeDefined();
        expect(event.type).toBeTruthy();
        expect(event.source).toBeTruthy();
        done();
      });

      gameEngine.onGameEvent(eventHandler);

      // 触发一个输入事件来测试事件系统
      gameEngine.handleInput({
        type: 'keyboard',
        action: 'keydown',
        data: { key: 'test' },
        timestamp: new Date(),
      });
    });

    it('应该能取消订阅游戏事件', async () => {
      const eventHandler = vi.fn();

      gameEngine.onGameEvent(eventHandler);
      gameEngine.offGameEvent(eventHandler);

      await gameEngine.handleInput({
        type: 'keyboard',
        action: 'keydown',
        data: { key: 'test' },
        timestamp: new Date(),
      });

      // 事件处理器不应该被调用
      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('游戏生命周期', () => {
    beforeEach(async () => {
      const config: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };
      await gameEngine.initializeGame(config);
    });

    it('应该能开始游戏会话', async () => {
      const state = await gameEngine.startGame();

      expect(state).toBeDefined();
      expect(state.timestamp).toBeInstanceOf(Date);
    }, 30000); // 游戏启动较慢，30s超时

    it('应该能暂停和恢复游戏', async () => {
      await gameEngine.startGame();

      await gameEngine.pauseGame();
      expect(gameEngine.getStateMachineState()).toBe('paused');

      await gameEngine.resumeGame();
      expect(gameEngine.getStateMachineState()).toBe('running');
    }, 30000); // 游戏生命周期操作较慢，30s超时

    it('应该能结束游戏并获取结果', async () => {
      await gameEngine.startGame();

      // 等待一小段时间以确保游戏运行
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await gameEngine.endGame();

      expect(result).toBeDefined();
      expect(result.finalScore).toBe(0);
      expect(result.levelReached).toBe(1);
      expect(result.playTime).toBeGreaterThanOrEqual(0);
      expect(result.statistics).toBeDefined();
    }, 30000); // 游戏完整生命周期较慢，30s超时
  });

  describe('错误处理', () => {
    it('没有设置容器时开始游戏应该抛出错误', async () => {
      const engineWithoutContainer = new GameEngineAdapter();

      const config: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };

      await engineWithoutContainer.initializeGame(config);

      await expect(engineWithoutContainer.startGame()).rejects.toThrow(
        'Game container not set'
      );

      engineWithoutContainer.destroy();
    });

    it('没有游戏状态时保存应该抛出错误', async () => {
      await expect(gameEngine.saveGame()).rejects.toThrow(
        'No game state to save'
      );
    });
  });
});
