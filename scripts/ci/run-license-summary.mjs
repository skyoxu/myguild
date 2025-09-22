#!/usr/bin/env node
/**
 * Run license checker summary.
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['license-checker', '--summary'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 0);
