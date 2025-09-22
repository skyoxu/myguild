#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const r = spawnSync(
  'npx',
  ['tsx', 'scripts/benchmarks/event-loop-latency.ts'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);
process.exit(r.status ?? 0);
