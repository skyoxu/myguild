#!/usr/bin/env node
/**
 * Push current ref to origin.
 */
import { spawnSync } from 'node:child_process';

const ref = process.env.GITHUB_REF || 'HEAD';
const r = spawnSync('git', ['push', 'origin', ref], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 0);
