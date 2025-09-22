#!/usr/bin/env node
/**
 * Bundle 预算 Gate：扫描 dist/ 下的产物，按 gzip 大小进行预算校验。
 * - phaser chunk: ≤ 500 kB (gzip)
 * - react vendor: ≤ 150 kB (gzip)
 * - initial index+vendor 合计: ≤ 400 kB (gzip)
 */
import { createGzip } from 'node:zlib';
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const ASSETS = join(DIST, 'assets');

function gzipSize(buf) {
  return new Promise((resolve, reject) => {
    const gz = createGzip();
    const chunks = [];
    gz.on('data', c => chunks.push(c));
    gz.on('end', () => resolve(Buffer.concat(chunks).length));
    gz.on('error', reject);
    gz.end(buf);
  });
}

async function fileGzipSize(path) {
  const buf = readFileSync(path);
  return await gzipSize(buf);
}

function listJs() {
  try {
    return readdirSync(ASSETS).filter(f => f.endsWith('.js'));
  } catch {
    return [];
  }
}

function matchOne(files, patterns) {
  const regex = new RegExp(patterns.join('|'));
  return files.find(f => regex.test(f));
}

async function main() {
  const files = listJs();
  if (!files.length) {
    console.error('[bundle-budget] No JS files under dist/assets');
    process.exit(1);
  }

  const phaserFile = matchOne(files, ['phaser']);
  const reactFile = matchOne(files, ['react', 'react-vendor']);
  const indexFile = matchOne(files, ['index-']);
  const vendorFile = matchOne(files, ['vendor-']);

  const results = [];

  if (phaserFile) {
    const size = await fileGzipSize(join(ASSETS, phaserFile));
    results.push({
      name: 'phaser',
      file: phaserFile,
      gzip: size,
      limit: 500 * 1024,
    });
  }
  if (reactFile) {
    const size = await fileGzipSize(join(ASSETS, reactFile));
    results.push({
      name: 'react-vendor',
      file: reactFile,
      gzip: size,
      limit: 150 * 1024,
    });
  }
  if (indexFile || vendorFile) {
    let total = 0;
    if (indexFile) total += await fileGzipSize(join(ASSETS, indexFile));
    if (vendorFile) total += await fileGzipSize(join(ASSETS, vendorFile));
    results.push({
      name: 'initial-total',
      file: `${indexFile || ''} + ${vendorFile || ''}`.trim(),
      gzip: total,
      limit: 400 * 1024,
    });
  }

  const mode = (process.env.BUNDLE_GUARD || '').toLowerCase();
  const soft = mode === 'warn' || mode === 'soft';
  let failed = false;
  const summaryLines = [];
  for (const r of results) {
    const ratio = (r.gzip / r.limit) * 100;
    const line = `${r.name}: ${Math.round(r.gzip / 1024)} kB gzip (limit ${Math.round(r.limit / 1024)} kB) -> ${ratio.toFixed(1)}%`;
    if (r.gzip > r.limit) {
      console.error(
        '[bundle-budget] FAIL',
        line,
        r.file ? `file=${r.file}` : ''
      );
      failed = true;
    } else {
      console.log('[bundle-budget] OK  ', line, r.file ? `file=${r.file}` : '');
    }
    summaryLines.push(
      `${r.name}\t${(r.gzip / 1024).toFixed(1)}kB\tlimit ${(r.limit / 1024).toFixed(0)}kB\tfile=${r.file || ''}`
    );
  }

  // Persist report under logs/ with date/subdir (Windows-friendly, no symlink)
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateDir = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const baseDir =
      process.env.BUNDLE_BUDGET_LOG_DIR || join('logs', 'bundle-budget');
    const outDir = join(baseDir, dateDir);
    mkdirSync(outDir, { recursive: true });

    const report = {
      timestamp: now.toISOString(),
      mode: mode || 'hard',
      soft,
      assetsDir: ASSETS,
      failed,
      results: results.map(r => ({ ...r })),
    };
    const jsonPath = join(outDir, `bundle-budget-${ts}.json`);
    const txtPath = join(outDir, `bundle-budget-${ts}.txt`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
    writeFileSync(
      txtPath,
      [
        `[bundle-budget] ${now.toISOString()} mode=${mode || 'hard'} soft=${soft} failed=${failed}`,
        ...summaryLines,
      ].join('\n'),
      'utf-8'
    );
    console.log(`[bundle-budget] Report saved to ${jsonPath}`);
  } catch (e) {
    console.warn('[bundle-budget] Failed to write logs/', e?.message || e);
  }

  if (failed) {
    if (soft) {
      console.warn(
        '[bundle-budget] Soft mode active (warn) — not failing the job'
      );
    } else {
      process.exit(1);
    }
  }
}

main().catch(e => {
  console.error('[bundle-budget] ERROR', e);
  process.exit(1);
});
