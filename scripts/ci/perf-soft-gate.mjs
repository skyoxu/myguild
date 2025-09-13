#!/usr/bin/env node
/**
 * Perf soft gate: parse Playwright JSON results (test-results/test-results.json)
 * and summarize status for performance smoke tests. Also prints initial bundle sizes (gzip).
 * Does not fail the job; prints to console and appends to GITHUB_STEP_SUMMARY when available.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';

const path = 'test-results/test-results.json';
if (!existsSync(path)) {
  console.warn('[perf-soft-gate] No JSON report found at', path);
  process.exit(0);
}

let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.warn('[perf-soft-gate] Failed to parse JSON report:', e.message);
  process.exit(0);
}

const results = [];
const stdoutLines = [];
function traverse(node) {
  if (!node) return;
  if (Array.isArray(node.suites)) node.suites.forEach(traverse);
  if (Array.isArray(node.specs))
    node.specs.forEach(s => {
      for (const test of s.tests || []) {
        results.push({
          title: [...(s.titlePath || [])].join(' > '),
          status: test.status,
          location: s.location || s.file,
        });
        if (Array.isArray(test.stdout)) {
          for (const out of test.stdout) {
            if (typeof out === 'string') stdoutLines.push(out);
            else if (out && typeof out.text === 'string')
              stdoutLines.push(out.text);
          }
        }
      }
    });
}

if (Array.isArray(data.suites)) data.suites.forEach(traverse);

const perfRelated = results.filter(r =>
  /perf|性能|交互|帧率|冷启动/i.test(r.title)
);
const failed = perfRelated.filter(r => r.status !== 'passed');

console.log('[perf-soft-gate] Perf-related tests:', perfRelated.length);
console.log('[perf-soft-gate] Failed:', failed.length);
for (const f of failed) {
  console.log(' - FAIL', f.title, '@', f.location || 'unknown');
}

if (failed.length > 0) {
  console.warn(
    '[perf-soft-gate] Soft gate: performance tests had failures (not failing job)'
  );
}

// Try to extract P95 numbers from stdout (PerformanceTestUtils log lines)
function extractP95(lines, tag) {
  // look for a line containing tag and P95 value (e.g. "cold_startup P95采样统计:") followed by a line with p95 number
  let p95 = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(tag) && /P95/.test(line)) {
      // scan next few lines for a number and 'ms'
      for (let j = i; j < Math.min(lines.length, i + 6); j++) {
        const l2 = lines[j];
        const m = l2.match(/P95[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*ms/i);
        if (m) {
          p95 = Number(m[1]);
          break;
        }
      }
    }
    if (p95 != null) break;
  }
  return p95;
}

const p95Cold = extractP95(stdoutLines, 'cold_startup');
const p95Interact = extractP95(stdoutLines, 'interaction_response');

console.log('[perf-soft-gate] P95 cold_startup:', p95Cold ?? 'N/A');
console.log('[perf-soft-gate] P95 interaction_response:', p95Interact ?? 'N/A');

// Compute initial bundle sizes (gzip)
async function gzipSize(buf) {
  return await new Promise((resolve, reject) => {
    const gz = createGzip();
    const chunks = [];
    gz.on('data', c => chunks.push(c));
    gz.on('end', () => resolve(Buffer.concat(chunks).length));
    gz.on('error', reject);
    gz.end(buf);
  });
}
async function fileGzipSize(path) {
  return await gzipSize(readFileSync(path));
}

let initialTotal = null,
  phaserGz = null,
  reactGz = null;
try {
  const ASSETS = 'dist/assets';
  const files = readdirSync(ASSETS);
  const index = files.find(f => /^index-.*\.js$/.test(f));
  const vendor = files.find(f => /^vendor-.*\.js$/.test(f));
  const phaser = files.find(f => /phaser.*\.js$/.test(f));
  const react = files.find(f => /react-vendor.*\.js$/.test(f));
  let total = 0;
  if (index) total += await fileGzipSize(join(ASSETS, index));
  if (vendor) total += await fileGzipSize(join(ASSETS, vendor));
  initialTotal = total;
  if (phaser) phaserGz = await fileGzipSize(join(ASSETS, phaser));
  if (react) reactGz = await fileGzipSize(join(ASSETS, react));
} catch {}

console.log(
  '[perf-soft-gate] initial js gzip (index+vendor):',
  initialTotal != null ? Math.round(initialTotal / 1024) + ' kB' : 'N/A'
);
if (phaserGz != null)
  console.log(
    '[perf-soft-gate] phaser gzip:',
    Math.round(phaserGz / 1024) + ' kB'
  );
if (reactGz != null)
  console.log(
    '[perf-soft-gate] react-vendor gzip:',
    Math.round(reactGz / 1024) + ' kB'
  );

// Append to GitHub Step Summary
try {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = [];
    lines.push('## Perf Soft Gate Summary');
    lines.push('');
    lines.push(`- Perf tests: ${perfRelated.length}, Failed: ${failed.length}`);
    lines.push(`- P95 cold_startup: ${p95Cold ?? 'N/A'} ms`);
    lines.push(`- P95 interaction_response: ${p95Interact ?? 'N/A'} ms`);
    if (initialTotal != null)
      lines.push(
        `- Initial JS (gzip index+vendor): ${Math.round(initialTotal / 1024)} kB`
      );
    if (phaserGz != null)
      lines.push(`- phaser (gzip): ${Math.round(phaserGz / 1024)} kB`);
    if (reactGz != null)
      lines.push(`- react-vendor (gzip): ${Math.round(reactGz / 1024)} kB`);
    lines.push('');
    await (
      await import('node:fs/promises')
    ).appendFile(summary, lines.join('\n') + '\n');
  }
} catch {}
