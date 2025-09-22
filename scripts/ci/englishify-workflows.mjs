#!/usr/bin/env node
/**
 * Englishify echo/Write-Host messages inside GitHub workflows.
 * - For lines containing echo/Write-Host with quoted text, strip non-ASCII from the quoted segment(s)
 * - Preserve YAML structure and variables
 * - Write changes back to the same files (UTF-8 LF)
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function listWorkflows(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listWorkflows(p));
    else if (/\.ya?ml$/i.test(name)) out.push(p);
  }
  return out;
}

function cleanQuotedSegments(line) {
  if (!/(echo\s+|Write-Host\s+)/i.test(line)) return line;
  if (!/[\u0100-\uFFFF]/.test(line)) return line; // no non-ASCII
  // Replace inside all quoted segments
  return line.replace(/(["'])(.*?)(\1)/g, (m, q, inner, q2) => {
    // Keep ${...} and $env:... tokens intact; only strip non-ASCII from text
    // Split by token-like patterns and clean the rest
    const parts = inner.split(
      /(\$\{[^}]+\}|\$env:[A-Za-z0-9_]+|\$\([^)]+\)|\$\w+)/g
    );
    const rebuilt = parts
      .map((seg, idx) => {
        if (!seg) return seg;
        if (seg.match(/^(\$\{[^}]+\}|\$env:[A-Za-z0-9_]+|\$\([^)]+\)|\$\w+)$/))
          return seg;
        const cleaned = seg
          .replace(/[\u0100-\uFFFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return cleaned;
      })
      .join('');
    return q + rebuilt + q2;
  });
}

const root = '.github/workflows';
const files = listWorkflows(root);
let changedAny = false;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\n/);
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const nl = cleanQuotedSegments(lines[i]);
    if (nl !== lines[i]) {
      lines[i] = nl;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(f, lines.join('\n'), 'utf8');
    console.log('[englishify] updated', f);
    changedAny = true;
  }
}
console.log(
  '[englishify] done',
  changedAny ? '(changes applied)' : '(no changes)'
);
