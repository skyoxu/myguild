#!/usr/bin/env node
/**
 * Normalize selected workflow YAML files to UTF-8 (no BOM) + LF line endings.
 * Content remains the same besides EOL/BOM normalization.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  '.github/workflows/ci.yml',
  '.github/workflows/config-management.yml',
  '.github/workflows/observability-gate.yml',
  '.github/workflows/pr-gatekeeper.yml',
  '.github/workflows/pr-performance-check.yml',
  '.github/workflows/release-monitor.yml',
  '.github/workflows/release-prepare.yml',
  '.github/workflows/release-ramp.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-emergency-rollback.yml',
  '.github/workflows/security-unified.yml',
  '.github/workflows/soft-gates.yml',
  '.github/workflows/staged-release.yml',
  '.github/workflows/tasks-governance.yml',
];

let changed = 0;
for (const f of files) {
  try {
    let buf = readFileSync(f);
    let txt = buf.toString('utf8');
    const orig = txt;
    // strip BOM
    if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
    // normalize EOL: CRLF/CR -> LF
    txt = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (txt !== orig) {
      writeFileSync(f, txt, { encoding: 'utf8' });
      changed++;
      console.log(`[normalize-yaml] Updated ${f}`);
    } else {
      console.log(`[normalize-yaml] OK ${f}`);
    }
  } catch (e) {
    console.warn(`[normalize-yaml] Skip ${f}: ${e.message}`);
  }
}

console.log(`[normalize-yaml] Done. Changed ${changed} file(s).`);
