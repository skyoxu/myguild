#!/usr/bin/env node
/**
 * Verify presence of Sentry credentials and optionally run `sentry-cli info`.
 * Outputs:
 * - token_present: 'true' | 'false'
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const outFile = process.env.GITHUB_OUTPUT;
const token = process.env.SENTRY_AUTH_TOKEN || '';
const org = process.env.SENTRY_ORG || '';
const project = process.env.SENTRY_PROJECT || '';

function setOutput(k, v) {
  if (!outFile) return;
  fs.appendFileSync(outFile, `${k}=${v}\n`, 'utf8');
}

if (!token) {
  console.log('Sentry token not configured; skipping');
  setOutput('token_present', 'false');
  process.exit(0);
}

setOutput('token_present', 'true');

// Try to run sentry-cli info if available; do not hard-fail if missing
const cmd = spawnSync('sentry-cli', ['info'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (cmd.error) {
  console.log('sentry-cli not available; continuing without CLI validation');
  process.exit(0);
}
if (cmd.status !== 0) {
  console.error(`sentry-cli info failed with code ${cmd.status}`);
  process.exit(1);
}
console.log(
  `Sentry org=${org || '[unset]'} project=${project || '[unset]'} validated`
);
