import { defineConfig } from '@playwright/test';

export default defineConfig({ testDir: './e2e', fullyParallel: true, reporter: [['list']], use: { headless: true }, timeout: 60_000 });
