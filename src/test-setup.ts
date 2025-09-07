/*
 * Vitest 全局测试配置
 * 支持 TDD 开发模式
 * 已修复: ReferenceError window is not defined (按cifix1.txt执行)
 */

import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});

// C建议：按cifix1.txt严格执行 - 只在存在 window 时才 mock
const g: any = globalThis;
if (typeof g.window !== 'undefined') {
  // 全局模拟配置
  Object.defineProperty(g.window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Electron 环境模拟
  Object.defineProperty(g.window, 'electronAPI', {
    value: {
      platform: 'test',
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  });
}

// ResizeObserver 模拟 (某些UI组件需要)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 扩展 expect 匹配器
expect.extend({
  toBeWithinThreshold(
    received: number,
    expected: number,
    threshold: number = 0.1
  ) {
    const pass = Math.abs(received - expected) <= threshold;
    if (pass) {
      return {
        message: () =>
          `期望 ${received} 不在阈值 ${threshold} 内接近 ${expected}`,
        pass: true,
      };
    }
    return {
      message: () => `期望 ${received} 在阈值 ${threshold} 内接近 ${expected}`,
      pass: false,
    };
  },
});

// 类型扩展
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeWithinThreshold(expected: number, threshold?: number): any;
    }
  }
}

// 测试环境变量配置
process.env.NODE_ENV = 'test';
process.env.VITE_ENV = 'test';

console.log('🧪 Vitest 测试环境已初始化');
