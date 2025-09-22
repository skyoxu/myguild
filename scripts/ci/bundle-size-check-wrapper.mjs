#!/usr/bin/env node
/**
 * Run a build (best-effort) and then execute bundle size check script.
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return r.status ?? 0;
}

// Build ignoring non-zero (warnings)
run('npm', ['run', 'build']);
// Now run size check (must pass/fail on its own)
const code = run('node', ['scripts/bundle-size-check.mjs']);
process.exit(code);
