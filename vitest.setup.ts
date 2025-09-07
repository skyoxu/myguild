/**
 * Vitest 全局设置文件
 * 配置测试环境和模拟对象
 */

import { vi } from 'vitest';

// 模拟 HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    canvas: {
      width: 800,
      height: 600,
    },
  })),
  writable: true,
});

// 模拟 HTMLCanvasElement.width 和 height 属性
Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
  value: 800,
  writable: true,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
  value: 600,
  writable: true,
});

// 模拟 WebGL context
const mockWebGLContext = {
  getParameter: vi.fn(() => 'WebGL'),
  getExtension: vi.fn(),
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  useProgram: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  createTexture: vi.fn(),
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  blendFunc: vi.fn(),
  viewport: vi.fn(),
  clear: vi.fn(),
  clearColor: vi.fn(),
  drawElements: vi.fn(),
  drawArrays: vi.fn(),
};

// 扩展 HTMLCanvasElement getContext 以支持 webgl 和 webgl2
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  contextType: string,
  ...args: any[]
) {
  if (
    contextType === 'webgl' ||
    contextType === 'webgl2' ||
    contextType === 'experimental-webgl'
  ) {
    return mockWebGLContext;
  }
  return originalGetContext.call(this, contextType, ...args);
};

// 模拟 requestAnimationFrame
global.requestAnimationFrame = vi.fn(callback => {
  return setTimeout(callback, 16);
});

global.cancelAnimationFrame = vi.fn(id => {
  clearTimeout(id);
});

// 模拟 performance API (添加环境保护)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
    },
    writable: true,
  });
}

// 模拟 ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 模拟 Image 构造函数
global.Image = vi.fn().mockImplementation(() => ({
  src: '',
  width: 100,
  height: 100,
  onload: null,
  onerror: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// 模拟 Audio 构造函数
global.Audio = vi.fn().mockImplementation(() => ({
  src: '',
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  volume: 1,
  muted: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// 抑制 console 输出以减少测试噪音
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// 全局模拟 Phaser
vi.mock('phaser', async () => {
  const mockScene = class MockScene {
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

    init() {}
    preload() {}
    create() {}
    update() {}
  };

  const mockGame = class MockGame {
    events = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    scene = {
      add: vi.fn(),
      getScene: vi.fn().mockReturnValue(new mockScene()),
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
      // 模拟构造函数
    }
  };

  return {
    default: {
      Scene: mockScene,
      Game: mockGame,
      AUTO: 'AUTO',
      Scale: {
        FIT: 'FIT',
        CENTER_BOTH: 'CENTER_BOTH',
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
    },
  };
});

console.log('🧪 Vitest 测试环境已初始化');
