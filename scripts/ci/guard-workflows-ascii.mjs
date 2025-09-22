#!/usr/bin/env node
/**
 * Guard to ensure all workflow files are ASCII-only.
 * Fails with a list of files and line numbers if non-ASCII characters are found.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
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
for (const file of list(root)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((ln, idx) => {
    for (let i = 0; i < ln.length; i++) {
      const code = ln.charCodeAt(i);
      if (code > 127) {
        if (!failed)
          console.error('Non-ASCII characters found in workflow files:');
        failed = true;
        console.error(`${file}:${idx + 1}`);
        break;
      }
    }
  });
}
if (failed) process.exit(1);
console.log('ASCII guard passed: all workflow files are ASCII-only.');
process.exit(0);
