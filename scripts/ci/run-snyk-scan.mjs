#!/usr/bin/env node
/**
 * Run Snyk test if SNYK_TOKEN is present.
 * Best-effort: install snyk CLI and run scan.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const token = process.env.SNYK_TOKEN || '';
if (!token) {
  console.log('Skipping Snyk scan (no SNYK_TOKEN)');
  process.exit(0);
}
console.log('Installing and running Snyk CLI...');
const install = spawnSync('npm', ['install', '-g', 'snyk'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (install.status !== 0) {
  console.warn('Failed to install snyk (non-blocking).');
  process.exit(0);
}
const test = spawnSync(
  'snyk',
  ['test', '--severity-threshold=high', '--json'],
  { encoding: 'utf-8', shell: process.platform === 'win32' }
);

try {
  const logsDir = path.join('logs', 'security');
  mkdirSync(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath1 = path.join(logsDir, `snyk-results-${stamp}.json`);
  const outPath2 = path.join(process.cwd(), 'snyk-results.json');
  if (test.stdout && test.stdout.length > 0) {
    writeFileSync(outPath1, test.stdout, 'utf8');
    writeFileSync(outPath2, test.stdout, 'utf8');
    console.log(`Snyk JSON written: ${outPath1}`);
  }
} catch {}

if (test.status !== 0) {
  console.warn('Snyk scan completed with findings (non-blocking).');
  process.exit(0);
}
console.log('Snyk scan completed');
