/*
 * App 组件测试
 * 演示 React 组件的 TDD 测试方法
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

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

  describe('快照测试', () => {
    it('应该匹配快照', () => {
      const { container } = render(<App />);

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
