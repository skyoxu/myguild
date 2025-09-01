/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

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
    // 超时配置 - 按止疼法提升基线
    testTimeout: 20_000, // 默认 5s -> 20s
    hookTimeout: 20_000, // 钩子默认 10s -> 20s
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
    reporters: ['default', 'html'],
    outputFile: {
      html: 'coverage/index.html',
      json: 'coverage/coverage.json',
    },
  },
});
