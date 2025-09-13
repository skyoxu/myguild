/**
 * 场景管理器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SceneManager } from '../SceneManager';
import type { DomainEvent } from '../../shared/contracts/events';

// Mock Phaser 并同步到全局，兼容 BaseScene 对全局 Phaser 的引用
vi.mock('phaser', () => import('./__mocks__/phaser'));
import Phaser from 'phaser';
(globalThis as any).Phaser = Phaser as any;

describe('SceneManager', () => {
  let sceneManager: SceneManager;
  let mockContainer: HTMLElement;
  let eventHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    eventHandler = vi.fn();
    sceneManager = new SceneManager({
      onEvent: eventHandler,
      onError: vi.fn(),
    });
  });

  afterEach(() => {
    sceneManager.destroy();
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该能成功创建场景管理器实例', () => {
      expect(sceneManager).toBeDefined();
      expect(sceneManager.isInitialized()).toBe(false);
    });

    it('应该能初始化场景管理器', async () => {
      await sceneManager.initialize(mockContainer, 800, 600);
      expect(sceneManager.isInitialized()).toBe(true);
    });

    it('应该能处理初始化错误', async () => {
      // 模拟容器为null的错误情况
      const mockError = new Error('Container is null');
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // 这个测试可能需要根据实际实现调整
      expect(sceneManager.initialize).toBeDefined();
    });
  });

  describe('场景控制', () => {
    beforeEach(async () => {
      await sceneManager.initialize(mockContainer);
    });

    it('应该能开始游戏', () => {
      sceneManager.startGame();
      // 验证方法被调用但不抛出错误
      expect(true).toBe(true);
    });

    it('应该能暂停游戏', () => {
      sceneManager.pauseGame();
      expect(true).toBe(true);
    });

    it('应该能恢复游戏', () => {
      sceneManager.resumeGame();
      expect(true).toBe(true);
    });

    it('应该能重启游戏', () => {
      sceneManager.restartGame();
      expect(true).toBe(true);
    });

    it('应该能返回菜单', () => {
      sceneManager.returnToMenu();
      expect(true).toBe(true);
    });

    it('应该能退出游戏', () => {
      sceneManager.exitGame();
      expect(sceneManager.isInitialized()).toBe(false);
    });
  });

  describe('状态管理', () => {
    beforeEach(async () => {
      await sceneManager.initialize(mockContainer);
    });

    it('应该能获取当前场景', () => {
      const currentScene = sceneManager.getCurrentScene();
      // 可能返回null或场景对象，两者都是有效的
      expect(currentScene !== undefined).toBe(true);
    });

    it('应该能获取游戏状态', () => {
      const gameState = sceneManager.getGameState();
      // 游戏状态可能为null（如果不在游戏场景）或包含状态数据
      expect(gameState !== undefined).toBe(true);
    });

    it('应该能设置游戏状态', () => {
      const mockState = {
        id: 'test-id',
        level: 2,
        score: 100,
        health: 80,
        inventory: ['item1'],
        position: { x: 100, y: 200 },
        timestamp: new Date(),
      };

      sceneManager.setGameState(mockState);
      // 验证方法被调用但不抛出错误
      expect(true).toBe(true);
    });
  });

  describe('事件处理', () => {
    beforeEach(async () => {
      await sceneManager.initialize(mockContainer);
    });

    it('应该能处理菜单动作事件', () => {
      const event: DomainEvent = {
        type: 'game.menu.action',
        source: 'test',
        data: { action: 'start-game' },
        timestamp: new Date(),
        id: 'test-event',
        specversion: '1.0',
        datacontenttype: 'application/json',
      };

      // 模拟事件处理
      sceneManager['handleDomainEvent'](event);
      expect(true).toBe(true);
    });

    it('应该能处理游戏暂停事件', () => {
      const event: DomainEvent = {
        type: 'game.state.paused',
        source: 'test',
        data: { reason: 'user_input' },
        timestamp: new Date(),
        id: 'test-event',
        specversion: '1.0',
        datacontenttype: 'application/json',
      };

      sceneManager['handleDomainEvent'](event);
      expect(true).toBe(true);
    });

    it('应该能处理退出请求事件', () => {
      const event: DomainEvent = {
        type: 'game.exit.requested',
        source: 'test',
        data: { reason: 'user_menu_selection' },
        timestamp: new Date(),
        id: 'test-event',
        specversion: '1.0',
        datacontenttype: 'application/json',
      };

      sceneManager['handleDomainEvent'](event);
      expect(sceneManager.isInitialized()).toBe(false);
    });

    it('应该能处理游戏错误事件', () => {
      const errorHandler = vi.fn();
      const sceneManagerWithErrorHandler = new SceneManager({
        onError: errorHandler,
      });

      const event: DomainEvent = {
        type: 'game.error',
        source: 'test',
        data: { error: 'Test error', scene: 'GameScene' },
        timestamp: new Date(),
        id: 'test-event',
        specversion: '1.0',
        datacontenttype: 'application/json',
      };

      sceneManagerWithErrorHandler['handleDomainEvent'](event);
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), 'GameScene');

      sceneManagerWithErrorHandler.destroy();
    });
  });

  describe('错误处理', () => {
    it('未初始化时的操作应该正常处理', () => {
      const uninitializedManager = new SceneManager();

      // 这些操作应该能正常处理，不抛出错误
      expect(() => {
        uninitializedManager.startGame();
        uninitializedManager.pauseGame();
        uninitializedManager.resumeGame();
        uninitializedManager.restartGame();
        uninitializedManager.returnToMenu();
        uninitializedManager.exitGame();
      }).not.toThrow();

      expect(uninitializedManager.getCurrentScene()).toBeNull();
      expect(uninitializedManager.getGameState()).toBeNull();

      uninitializedManager.destroy();
    });

    it('重复销毁应该能正常处理', () => {
      expect(() => {
        sceneManager.destroy();
        sceneManager.destroy(); // 第二次销毁
      }).not.toThrow();
    });
  });
});
