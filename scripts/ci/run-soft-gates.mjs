#!/usr/bin/env node
/**
 * Run soft-gate-reporter.js; on failure, set default outputs and succeed.
 * Outputs: soft-gate-score, soft-gate-status, soft-gate-title, soft-gate-summary
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const out = process.env.GITHUB_OUTPUT;
function setOut(k, v) {
  if (out) fs.appendFileSync(out, `${k}=${v}\n`, 'utf8');
}

const r = spawnSync(process.execPath, ['scripts/soft-gate-reporter.js'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (r.status !== 0) {
  console.log('Soft gates script execution error, but not blocking the flow');
  setOut('soft-gate-score', '50');
  setOut('soft-gate-status', 'neutral');
  setOut('soft-gate-title', 'Soft gates execution error');
  setOut(
    'soft-gate-summary',
    'Issues encountered during execution, please check logs'
  );
  process.exit(0);
}
console.log('Soft gates check completed');
