#!/usr/bin/env node
// Collect Playwright traces into logs/ with date subfolder (Windows-friendly)
// Copies test-results/artifacts/**/trace.zip to logs/playwright-traces/YYYY-MM-DD/**/trace.zip
// Also mirrors test-results/test-results.json when present for correlation
import {
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ARTIFACTS_DIR = join('test-results', 'artifacts');
const RESULTS_JSON = join('test-results', 'test-results.json');
const LOG_BASE =
  process.env.PW_TRACE_LOG_DIR || join('logs', 'playwright-traces');

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

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

async function main() {
  if (!existsSync(ARTIFACTS_DIR)) {
    console.log('[trace-collect] No artifacts directory:', ARTIFACTS_DIR);
    process.exit(0);
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateDir = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const outRoot = join(LOG_BASE, dateDir);
  ensureDir(outRoot);

  const files = walk(ARTIFACTS_DIR).filter(f =>
    f.toLowerCase().endsWith('trace.zip')
  );
  const manifest = [];

  for (const src of files) {
    const rel = relative(ARTIFACTS_DIR, src);
    const dst = join(outRoot, rel);
    ensureDir(dirname(dst));
    try {
      copyFileSync(src, dst);
      const st = statSync(src);
      manifest.push({
        source: src,
        target: dst,
        size: st.size,
        mtime: st.mtimeMs,
      });
    } catch (e) {
      console.warn(
        '[trace-collect] copy failed:',
        src,
        '->',
        dst,
        e?.message || e
      );
    }
  }

  // Mirror top-level JSON result if available
  if (existsSync(RESULTS_JSON)) {
    try {
      const dst = join(outRoot, 'test-results.json');
      copyFileSync(RESULTS_JSON, dst);
    } catch {}
  }

  const manifestPath = join(outRoot, 'trace-manifest.json');
  try {
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          timestamp: now.toISOString(),
          source: ARTIFACTS_DIR,
          output: outRoot,
          count: manifest.length,
          entries: manifest,
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(
      `[trace-collect] Saved manifest: ${manifestPath} (count=${manifest.length})`
    );
  } catch (e) {
    console.warn('[trace-collect] failed writing manifest:', e?.message || e);
  }
}

main().catch(e => {
  console.error('[trace-collect] ERROR', e);
  process.exit(1);
});
