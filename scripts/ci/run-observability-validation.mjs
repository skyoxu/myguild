#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
fs.mkdirSync('logs', { recursive: true });
const r = spawnSync(
  process.execPath,
  ['scripts/observability-config-validation.js'],
  { stdio: 'inherit' }
);
process.exit(r.status ?? 0);
