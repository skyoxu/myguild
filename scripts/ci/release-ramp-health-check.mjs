#!/usr/bin/env node
/**
 * Run auto-rollback health check and set outputs.
 * Outputs: health_result, health_exit_code, health_status
 * Exit with code 42 to propagate rollback condition when failed threshold.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const outFile = process.env.GITHUB_OUTPUT;
function setOut(k, v) {
  if (outFile) fs.appendFileSync(outFile, `${k}=${v}\n`, 'utf8');
}

const r = spawnSync(process.execPath, ['scripts/release/auto-rollback.mjs'], {
  encoding: 'utf8',
});
const exit = r.status ?? 1;
const result = (r.stdout || '').trim() || 'null';
setOut('health_result', result);
setOut('health_exit_code', String(exit));

if (exit === 0) {
  setOut('health_status', 'passed');
  process.exit(0);
}
if (exit === 42) {
  setOut('health_status', 'failed');
  process.exit(42);
}
setOut('health_status', 'error');
process.exit(exit);
