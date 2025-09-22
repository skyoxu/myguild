#!/usr/bin/env node
/**
 * Generate unified security report JSON under logs/.
 * Inputs via env: CRITICAL_COUNT, HIGH_COUNT, E2E_STATUS, SCAN_STATUS, GIT_SHA, GIT_REF, RUN_ID
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function val(k, d = '') {
  return process.env[k] ?? d;
}
const report = {
  timestamp: new Date().toISOString(),
  git_sha: val('GIT_SHA'),
  git_ref: val('GIT_REF'),
  workflow_run: val('RUN_ID'),
  static_scan: {
    status: val('SCAN_STATUS'),
    critical_count: Number(val('CRITICAL_COUNT', '0')),
    high_count: Number(val('HIGH_COUNT', '0')),
  },
  e2e_test: {
    status: val('E2E_STATUS'),
    executed: val('E2E_EXECUTED', 'true') === 'true',
  },
};

mkdirSync('logs', { recursive: true });
writeFileSync(
  join('logs', 'unified-security-report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);
console.log(
  'Unified security report written to logs/unified-security-report.json'
);
