#!/usr/bin/env node
/**
 * Validate that all workflow YAML files are UTF-8 and use LF line endings.
 * Fails when CR (\r) or Unicode replacement char (\uFFFD) or BOM (\uFEFF) are detected.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function list(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...list(p));
    else if (/\.ya?ml$/i.test(name)) out.push(p);
  }
  return out;
}

const root = '.github/workflows';
let failed = false;
let checked = 0;

try {
  const files = list(root);
  for (const f of files) {
    const buf = readFileSync(f);
    const txt = buf.toString('utf8');
    checked++;

    // Check BOM
    if (txt.charCodeAt(0) === 0xfeff) {
      console.error(`[encoding-guard] FAIL: BOM found in ${f}`);
      failed = true;
    }
    // Check CRLF
    if (/\r\n/.test(txt) || /\r(?!\n)/.test(txt)) {
      console.error(`[encoding-guard] FAIL: CR characters (non-LF EOL) in ${f}`);
      failed = true;
    }
    // Check replacement characters (mojibake sign)
    if (txt.includes('\uFFFD')) {
      console.error(`[encoding-guard] FAIL: Replacement character (\uFFFD) found in ${f}`);
      failed = true;
    }
  }
} catch (e) {
  console.error(`[encoding-guard] ERROR: ${e.message}`);
  process.exit(1);
}

if (!checked) {
  console.log('[encoding-guard] No workflow YAML files found');
} else {
  console.log(`[encoding-guard] Checked ${checked} workflow file(s)`);
}

if (failed) {
  console.error('[encoding-guard] Encoding/EOL violations detected');
  process.exit(1);
}
console.log('[encoding-guard] OK: UTF-8 + LF enforced for workflows');

