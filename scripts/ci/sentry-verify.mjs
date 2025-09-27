#!/usr/bin/env node
/**
 * Verify presence of Sentry credentials and optionally run `sentry-cli info`.
 * Outputs:
 * - token_present: 'true' | 'false'
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
const localCli = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'sentry-cli.cmd' : 'sentry-cli'
);

/**
 * Run a command and return { ok, code } without throwing.
 */
function tryRun(cmd, args) {
  try {
    const r = spawnSync(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    return { ok: r.status === 0, code: r.status ?? 1 };
  } catch (e) {
    return { ok: false, code: 1 };
  }
}

let ran = false;
let ok = false;

if (fs.existsSync(localCli)) {
  const r = tryRun(localCli, ['info']);
  ran = true;
  ok = r.ok;
} else {
  const r = tryRun('sentry-cli', ['info']);
  ran = true;
  ok = r.ok;
}

if (!ok) {
  // Treat missing CLI as non-fatal (print a notice and continue)
  console.log('sentry-cli not available or failed to run; continuing without CLI validation');
  process.exit(0);
}
console.log(
  `Sentry org=${org || '[unset]'} project=${project || '[unset]'} validated`
);
