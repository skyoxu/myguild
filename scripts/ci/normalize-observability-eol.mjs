#!/usr/bin/env node
// Normalize line endings (CRLF/CR -> LF) and clean stray middle-dot characters in observability directory.
// - Scope: src/shared/observability/**/*.{ts,tsx}
// - Logs: logs/ci/<date>/normalize-observability-eol.log + report JSON

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'src', 'shared', 'observability');

const day = new Date().toISOString().slice(0, 10);
const LOG_DIR = path.join(ROOT, 'logs', 'ci', day);
fs.mkdirSync(LOG_DIR, { recursive: true });

/** Recursively collect .ts/.tsx files */
function collectFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collectFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function normalizeContent(src) {
  // Replace CRLF and stray CR with LF; remove middle dot U+00B7 used accidentally
  const lf = src.replace(/\r\n?/g, '\n');
  const cleaned = lf.replace(/\u00B7/g, '');
  return cleaned;
}

const files = fs.existsSync(TARGET_DIR) ? collectFiles(TARGET_DIR) : [];
const changes = [];

for (const file of files) {
  try {
    const before = fs.readFileSync(file, 'utf8');
    const after = normalizeContent(before);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changes.push({ file, bytesDelta: after.length - before.length });
    }
  } catch (err) {
    changes.push({ file, error: String(err) });
  }
}

fs.writeFileSync(
  path.join(LOG_DIR, 'normalize-observability-eol.report.json'),
  JSON.stringify({ changed: changes.length, changes }, null, 2),
  'utf8'
);

console.log(
  `Normalized EOL for ${changes.length} file(s) under observability.`
);
