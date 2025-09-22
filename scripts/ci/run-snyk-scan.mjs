#!/usr/bin/env node
/**
 * Run Snyk test if SNYK_TOKEN is present.
 * Best-effort: install snyk CLI and run scan.
 */
import { spawnSync } from 'node:child_process';

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
  { stdio: 'inherit', shell: process.platform === 'win32' }
);
if (test.status !== 0) {
  console.warn('Snyk scan completed with findings (non-blocking).');
  process.exit(0);
}
console.log('Snyk scan completed');
