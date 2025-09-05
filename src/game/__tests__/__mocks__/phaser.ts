/**
 * Phaser 3 Mock for testing
 */

import { vi } from 'vitest';

// 模拟 Phaser.Scene 基类
export class MockScene {
  events = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  };

  scene = {
    key: 'MockScene',
    isActive: vi.fn().mockReturnValue(true),
    isPaused: vi.fn().mockReturnValue(false),
    pause: vi.fn(),
    resume: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    switch: vi.fn(),
    get: vi.fn(),
    getScene: vi.fn().mockReturnValue(this),
    manager: {
      keys: {},
      scenes: [],
      getScene: vi.fn().mockReturnValue(this),
    },
  };

  add = {
    text: vi.fn().mockReturnValue({
      setOrigin: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
    }),
    sprite: vi.fn().mockReturnValue({
      setOrigin: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setTexture: vi.fn().mockReturnThis(),
    }),
    rectangle: vi.fn().mockReturnValue({
      setOrigin: vi.fn().mockReturnThis(),
      setFillStyle: vi.fn().mockReturnThis(),
    }),
  };

  input = {
    keyboard: {
      createCursorKeys: vi.fn().mockReturnValue({
        left: { isDown: false },
        right: { isDown: false },
        up: { isDown: false },
        down: { isDown: false },
      }),
      addKeys: vi.fn().mockReturnValue({
        W: { isDown: false },
        A: { isDown: false },
        S: { isDown: false },
        D: { isDown: false },
      }),
      on: vi.fn(),
      off: vi.fn(),
    },
    on: vi.fn(),
    off: vi.fn(),
  };

  physics = {
    add: {
      sprite: vi.fn().mockReturnValue({
        setOrigin: vi.fn().mockReturnThis(),
        setBounce: vi.fn().mockReturnThis(),
        setCollideWorldBounds: vi.fn().mockReturnThis(),
        body: {
          setSize: vi.fn(),
          setVelocity: vi.fn(),
          setVelocityX: vi.fn(),
          setVelocityY: vi.fn(),
        },
      }),
    },
  };

  cameras = {
    main: {
      scrollX: 0,
      scrollY: 0,
      setScroll: vi.fn(),
      startFollow: vi.fn(),
    },
  };

  constructor(config?: any) {
    // 模拟构造函数
  }

  init() {}
  preload() {}
  create() {}
  update() {}

  // 游戏状态相关方法（用于GameScene）
  private mockGameState: any = {
    level: 1,
    score: 0,
    health: 100,
    inventory: [],
    position: { x: 400, y: 300 },
    timestamp: new Date(),
  };

  getGameState() {
    return { ...this.mockGameState };
  }

  setGameState(state: any) {
    this.mockGameState = { ...this.mockGameState, ...state };
  }
}

// 模拟 Phaser.Game
export class MockGame {
  events = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  scene = {
    add: vi.fn(),
    getScene: vi.fn().mockReturnValue(new MockScene()),
    getScenes: vi.fn().mockReturnValue([]),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    remove: vi.fn(),
    keys: {},
    scenes: [],
  };

  scale = {
    width: 800,
    height: 600,
  };

  destroy = vi.fn();

  constructor(config?: any) {
    // 模拟构造函数 - 立即触发postBoot回调
    setTimeout(() => {
      config?.callbacks?.postBoot?.();
    }, 10);
  }
}

// 模拟主要的 Phaser 常量和类
const Phaser = {
  Scene: MockScene,
  Game: MockGame,
  AUTO: 'AUTO' as const,
  Scale: {
    FIT: 'FIT' as const,
    CENTER_BOTH: 'CENTER_BOTH' as const,
  },
  Physics: {
    Arcade: {
      STATIC_BODY: 0,
      DYNAMIC_BODY: 1,
    },
  },
  Input: {
    Keyboard: {
      KeyCodes: {
        W: 87,
        A: 65,
        S: 83,
        D: 68,
        SPACE: 32,
        UP: 38,
        DOWN: 40,
        LEFT: 37,
        RIGHT: 39,
      },
    },
  },
};

export default Phaser;
