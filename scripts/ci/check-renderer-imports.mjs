#!/usr/bin/env node
/**
 * Renderer import guard: ensure src/** does not import main-process modules.
 * - Scans TypeScript/TSX files under src/
 * - Flags forbidden imports: '@sentry/electron/main', 'electron', 'fs', 'path',
 *   'child_process', 'net', './sentry-main', './release-health'
 * - Logs results to logs/ci/YYYY-MM-DD/renderer-import-check-*.log
 * - Exits non-zero on violations
 */
import fs from 'node:fs';
import path from 'node:path';

const forbidden = [
  '@sentry/electron/main',
  'electron',
  'fs',
  'path',
  'child_process',
  'net',
  './sentry-main',
  '../sentry-main',
  './release-health',
  '../release-health',
];

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const now = new Date();
const yyyy = now.getUTCFullYear();
const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
const dd = String(now.getUTCDate()).padStart(2, '0');
const hh = String(now.getUTCHours()).padStart(2, '0');
const mi = String(now.getUTCMinutes()).padStart(2, '0');
const ss = String(now.getUTCSeconds()).padStart(2, '0');
const logDir = path.join('logs', 'ci', `${yyyy}-${mm}-${dd}`);
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `renderer-import-check-${hh}${mi}${ss}Z.log`);
function log(msg) {
  fs.appendFileSync(logFile, msg + '\n', 'utf8');
}

const violations = [];
function shouldSkip(file, src) {
  const p = file.replace(/\\+/g, '/');
  // Allow main/preload trees inside src
  if (p.startsWith('src/main/') || p.startsWith('src/preload/')) return true;
  // Allow test files
  if (p.includes('/__tests__/') || /\.spec\.(ts|tsx)$/.test(p)) return true;
  // Observability: allow files explicitly for main side or release health under shared
  if (p.startsWith('src/shared/observability/')) {
    const name = p.split('/').pop() || '';
    if (/\.main\.(ts|tsx)$/.test(name)) return true;
    if (name === 'release-health.ts') return true;
    if (name.includes('sentry-main') || name.includes('sentry-main-detector'))
      return true;
    // Content marker: files declaring [main-only] in header are skipped
    if (src && src.slice(0, 400).includes('[main-only]')) return true;
  }
  return false;
}

const files = fs.existsSync('src') ? listFiles('src') : [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (shouldSkip(file, src)) continue;
  // Rough import detection (static + dynamic)
  const lines = src.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const m =
      line.match(/import\s+(?:[^'";]+?from\s+)?['\"]([^'\"]+)['\"]/) ||
      line.match(/require\(\s*['\"]([^'\"]+)['\"]\s*\)/) ||
      line.match(/import\(\s*['\"]([^'\"]+)['\"]\s*\)/);
    if (m) {
      const spec = m[1];
      if (forbidden.some(f => spec === f)) {
        violations.push({ file, line: idx + 1, spec });
      }
    }
  });
}

if (violations.length === 0) {
  log('Renderer import guard: PASS (no forbidden imports found under src/)');
  console.log(`Renderer import guard: PASS -> ${logFile}`);
  process.exit(0);
}

log('Renderer import guard: FAIL');
for (const v of violations) log(`${v.file}:${v.line} -> ${v.spec}`);
console.error('Renderer import guard: FAIL');
violations.forEach(v => console.error(`${v.file}:${v.line} -> ${v.spec}`));
console.error(`Report: ${logFile}`);
process.exit(1);
