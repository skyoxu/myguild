/*
 * App 组件测试
 * 演示 React 组件的 TDD 测试方法
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './app';

describe('App 组件', () => {
  describe('渲染测试', () => {
    it('应该正确渲染应用标题', () => {
      render(<App />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Phaser 3 + React 19 + TypeScript');
    });

    it('应该包含正确的技术栈信息', () => {
      render(<App />);

      const title = screen.getByText(/Phaser 3.*React 19.*TypeScript/);
      expect(title).toBeInTheDocument();
    });

    it('应该包含主容器元素', () => {
      const { container } = render(<App />);

      const mainDiv = container.querySelector('div');
      expect(mainDiv).toBeInTheDocument();
    });
  });

  describe('可访问性测试', () => {
    it('应该有正确的语义结构', () => {
      render(<App />);

      // 检查标题层级
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('应该支持屏幕阅读器', () => {
      render(<App />);

      const heading = screen.getByRole('heading');
      expect(heading.tagName).toBe('H1');
    });
  });

  describe('结构稳定性', () => {
    it('应包含 app 根容器与关键交互入口', () => {
      render(<App />);
      const root = screen.getByTestId('app-root');
      expect(root).toBeInTheDocument();
      // 顶部标题
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      // 模式切换的两个按钮（Normal / Vertical Slice），不校验具体文案，避免样式/文案抖动
      const buttons = root.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      // 首屏应提供开始游戏入口（未自动开始时）
      const startBtn = screen.queryByTestId('start-game');
      expect(startBtn).toBeTruthy();
    });
  });
});
