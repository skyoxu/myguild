#!/usr/bin/env node
/**
 * Ensure dist-electron runs as CommonJS regardless of root package "type": "module".
 * - Writes dist-electron/package.json with { "type": "commonjs" } if missing or different.
 * - Optional compatibility: when GENERATE_CJS_DUP=true, duplicates .js -> .cjs for main and security modules.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  copyFileSync,
  statSync,
} from 'node:fs';
import { join, dirname, extname } from 'node:path';

const DIST_ELECTRON = 'dist-electron';
const PKG_PATH = join(DIST_ELECTRON, 'package.json');

function ensureDir(p) {
  try {
    mkdirSync(p, { recursive: true });
  } catch {}
}

function ensureCommonJsPackage() {
  ensureDir(DIST_ELECTRON);
  let needWrite = true;
  if (existsSync(PKG_PATH)) {
    try {
      const cur = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      if (cur && String(cur.type).toLowerCase() === 'commonjs')
        needWrite = false;
    } catch {}
  }
  if (needWrite) {
    writeFileSync(
      PKG_PATH,
      JSON.stringify({ type: 'commonjs' }, null, 2),
      'utf-8'
    );
    console.log(
      '[postbuild] wrote dist-electron/package.json { type: commonjs }'
    );
  } else {
    console.log('[postbuild] dist-electron/package.json already commonjs');
  }
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function duplicateAllJsToCjs() {
  const candidates = walk(DIST_ELECTRON).filter(p => extname(p) === '.js');
  let count = 0;
  for (const js of candidates) {
    const cjs = js.replace(/\.js$/i, '.cjs');
    try {
      if (!existsSync(cjs)) {
        copyFileSync(js, cjs);
        count++;
      }
    } catch {}
  }
  console.log(`[postbuild] ensured .cjs duplicates for ${count} files`);
}

ensureCommonJsPackage();
duplicateAllJsToCjs();

// Remove legacy top-level entry files to avoid stale entry usage
try {
  const legacyFiles = [
    'main.js',
    'main.cjs',
    'preload.js',
    'preload.cjs',
    'security.js',
    'security.cjs',
  ].map(n => join(DIST_ELECTRON, n));
  let removed = 0;
  for (const f of legacyFiles) {
    try {
      if (existsSync(f)) {
        // Avoid removing files inside the new electron/ subfolder
        if (
          !f.includes(
            `${join(DIST_ELECTRON, 'electron')}${require('path').sep}`
          )
        ) {
          require('fs').rmSync(f, { force: true });
          removed++;
        }
      }
    } catch {}
  }
  if (removed > 0) {
    console.log(`[postbuild] cleaned legacy top-level entries: ${removed}`);
  }
} catch {}
