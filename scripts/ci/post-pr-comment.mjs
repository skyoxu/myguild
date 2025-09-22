#!/usr/bin/env node
/**
 * Wrapper to post a PR comment via scripts/pr-integration.mjs comment <PR_NUMBER>
 * Env:
 * - PR_NUMBER (required)
 */
import { spawnSync } from 'node:child_process';

const pr = process.env.PR_NUMBER;
if (!pr) {
  console.log('PR_NUMBER not provided; skipping PR comment.');
  process.exit(0);
}
const r = spawnSync('node', ['scripts/pr-integration.mjs', 'comment', pr], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (r.status !== 0) {
  console.log('PR comment failed (non-blocking).');
  process.exit(0);
}
