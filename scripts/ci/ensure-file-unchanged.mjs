#!/usr/bin/env node
/**
 * Ensure a file has no uncommitted changes (git diff --exit-code <file>).
 * Usage: node scripts/ci/ensure-file-unchanged.mjs <path>
 */
import { spawnSync } from 'node:child_process';

const target = process.argv[2];
if (!target) {
  console.error('Usage: ensure-file-unchanged <file>');
  process.exit(2);
}

const diff = spawnSync('git', ['diff', '--exit-code', target], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (diff.status !== 0) {
  console.error(`${target} has changes. Please commit the updated file.`);
  process.exit(1);
}
console.log(`${target} is up to date.`);
