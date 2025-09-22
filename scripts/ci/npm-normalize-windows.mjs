#!/usr/bin/env node
/**
 * Normalize npm config on Windows runners for CI:
 * - Ensure devDependencies are installed
 * - Avoid cache-min slowdowns
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return r.status ?? 0;
}

// Best-effort clean-ups; ignore failures
run('npm', ['config', 'delete', 'production']);
run('npm', ['config', 'delete', 'cache-min']);
run('npm', ['config', 'set', 'prefer-offline', 'true']);
console.log('npm config normalized for CI (Windows)');
