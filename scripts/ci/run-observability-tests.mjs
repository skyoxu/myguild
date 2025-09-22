#!/usr/bin/env node
/**
 * Ensure reports directory and run observability tests, writing output to file.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

fs.mkdirSync('reports', { recursive: true });
// Prefer the canonical script name; alias exists for backward compatibility
const r = spawnSync('npm', ['run', 'observability:test'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
try {
  fs.writeFileSync(
    'reports/observability-verification.json',
    r.stdout || '',
    'utf8'
  );
} catch {}
process.exit(r.status ?? 0);
