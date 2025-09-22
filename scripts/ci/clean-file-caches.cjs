#!/usr/bin/env node
/**
 * Clean common build/test caches to avoid stale entry and artifacts.
 * Windows-friendly; logs to logs/ci/YYYY-MM-DD/clean-file-caches-*.log.
 *
 * Targets (safe to remove):
 *  - dist/
 *  - dist-electron/ (legacy top-level entries only, keep fresh electron/ tree unless FULL=1)
 *  - coverage/
 *  - test-results/
 *  - .e2e-build-cache
 *  - logs/playwright-traces (keep logs/ci)
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function now() {
  return new Date().toISOString();
}

function mkLogFile() {
  const d = new Date();
  const dateDir = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const dir = path.join(process.cwd(), 'logs', 'ci', dateDir);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  const stamp = d.toISOString().replace(/[:.]/g, '-');
  return path.join(dir, `clean-file-caches-${stamp}.log`);
}

const logFile = mkLogFile();
function log(msg) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, line + '\n', 'utf8');
  } catch {}
}

function rmrf(target) {
  try {
    if (!fs.existsSync(target)) return false;
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function clean() {
  let removed = 0;
  // dist/ always safe
  if (rmrf('dist')) {
    log('removed: dist/');
    removed++;
  }

  // dist-electron: remove legacy top-level files; keep electron/ tree unless FULL=1
  const de = 'dist-electron';
  if (fs.existsSync(de)) {
    const legacy = [
      'main.js',
      'main.cjs',
      'preload.js',
      'preload.cjs',
      'security.js',
      'security.cjs',
    ].map(n => path.join(de, n));
    let leg = 0;
    for (const f of legacy) {
      if (rmrf(f)) leg++;
    }
    if (leg) log(`removed: dist-electron legacy files (${leg})`);
    if (process.env.CLEAN_FULL === '1') {
      if (rmrf(de)) {
        log('removed: dist-electron/ (FULL=1)');
        removed++;
      }
    }
  }

  if (rmrf('coverage')) {
    log('removed: coverage/');
    removed++;
  }
  if (rmrf('test-results')) {
    log('removed: test-results/');
    removed++;
  }
  if (rmrf('.e2e-build-cache')) {
    log('removed: .e2e-build-cache');
    removed++;
  }

  // traces under logs/
  const traces = path.join('logs', 'playwright-traces');
  if (rmrf(traces)) {
    log('removed: logs/playwright-traces/');
    removed++;
  }

  log(`clean finished, removed groups=${removed}`);
}

clean();
