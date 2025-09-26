/*
 * Vitest global test setup
 * Supports TDD development workflow
 * Fixes: ReferenceError window is not defined (when window is absent)
 */

import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});

// Only mock when window exists
const g: any = globalThis as any;
if (typeof g.window !== 'undefined') {
  // Global mocks
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

  // Electron environment mock
  Object.defineProperty(g.window, 'electronAPI', {
    value: {
      platform: 'test',
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  });
}

// ResizeObserver mock (some UI components require it)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// HTMLCanvasElement mock (required by Phaser 3 game engine)
global.HTMLCanvasElement = vi.fn().mockImplementation(() => ({
  getContext: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    drawImage: vi.fn(),
    canvas: { width: 800, height: 600 },
  })),
  width: 800,
  height: 600,
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// CanvasRenderingContext2D mock
global.CanvasRenderingContext2D = vi.fn().mockImplementation(() => ({}));

// Extend expect matchers
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
          `Expected ${received} not to be within threshold ${threshold} of ${expected}`,
        pass: true,
      };
    }
    return {
      message: () =>
        `Expected ${received} to be within threshold ${threshold} of ${expected}`,
      pass: false,
    };
  },
});

// Type augmentation
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeWithinThreshold(expected: number, threshold?: number): any;
    }
  }
}

// Test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_ENV = 'test';

console.log('🧪 Vitest test environment initialized');
