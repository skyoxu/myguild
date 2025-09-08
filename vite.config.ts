/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// ESLint configuration fix applied - this file should now pass linting

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle可视化插件 - 生成bundle分析报告
    visualizer({
      filename: 'dist/bundle-analysis.html',
      template: 'treemap', // treemap | sunburst | network
      open: process.env.BUNDLE_ANALYZE === 'true',
      gzipSize: true,
      brotliSize: true,
      // 使用 sourcemap 进行更准确的体积计算
      sourcemap: true,
    }),
  ],
  server: {
    open: true,
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: 'hidden', // 生成 map，但不在产物中注释引用（等价于生成并"隐藏"）
    rollupOptions: {
      output: {
        // 手动拆分；示例：把 heavy libs 拆出去
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('phaser')) return 'phaser';
            if (id.includes('@sentry')) return 'sentry';
            if (id.includes('react')) return 'react-vendor';
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1024, // 1 MiB，仅调阈值是提示级；真正靠拆包
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@core': path.resolve(__dirname, './src/core'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@infra': path.resolve(__dirname, './src/infra'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // 超时配置 - 为慢测试设置合理超时
    testTimeout: 30_000, // 默认 5s -> 30s （允许execSync脚本测试）
    hookTimeout: 15_000, // 钩子默认 10s -> 15s
    setupFiles: ['./src/test-setup.ts', './vitest.setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      'electron-dist',
      'tests/e2e/**',
      'tests_08_templates/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.{js,ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts,tsx}',
        'src/**/*.spec.{js,ts,tsx}',
        'src/test-setup.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions']
      : ['default', 'html'],
    outputFile: {
      html: 'coverage/index.html',
      json: 'coverage/coverage.json',
    },
  },
});
