#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if ((r.status ?? 0) !== 0) process.exit(r.status ?? 1);
}
run('npm', ['run', 'config:layers:init']);
run('npm', [
  'run',
  'config:layers:export',
  '--',
  '--format',
  'json',
  '--output',
  'dist/config',
]);
run('npm', [
  'run',
  'config:layers:export',
  '--',
  '--format',
  'typescript',
  '--output',
  'src/generated/config',
]);
run('npm', [
  'run',
  'config:layers:export',
  '--',
  '--format',
  'env',
  '--output',
  '.env.production',
]);
run('npm', ['run', 'config:substitute:docs']);
