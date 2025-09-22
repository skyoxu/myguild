#!/usr/bin/env node
/**
 * Read Playwright JSON report (test-results/test-results.json), compute summary and write to step summary.
 */
import { existsSync, readFileSync, appendFileSync } from 'node:fs';

const reportPath = 'test-results/test-results.json';
if (!existsSync(reportPath)) {
  console.log('No Playwright JSON report at test-results/test-results.json.');
  process.exit(0);
}
const data = JSON.parse(readFileSync(reportPath, 'utf8'));
const durations = [];
function collect(n) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n.suites)) n.suites.forEach(collect);
  if (Array.isArray(n.specs)) {
    for (const sp of n.specs) {
      for (const t of sp.tests || []) {
        for (const r of t.results || []) {
          if (typeof r.duration === 'number') durations.push(r.duration);
        }
      }
    }
  }
}
collect(data);
if (durations.length === 0) {
  console.log('No E2E durations found to compute P95.');
  process.exit(0);
}
durations.sort((a, b) => a - b);
const avg =
  Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) /
  100;
function pct(p) {
  const idx = Math.floor((durations.length - 1) * p);
  return durations[idx] | 0;
}
const p50 = pct(0.5);
const p90 = pct(0.9);
const p95 = pct(0.95);
const p99 = pct(0.99);
const max = durations[durations.length - 1] | 0;

const lines = [];
lines.push('## E2E Perf (Playwright)');
lines.push(`- samples: ${durations.length}`);
lines.push(`- p50: ${p50} ms`);
lines.push(`- p90: ${p90} ms`);
lines.push(`- p95: ${p95} ms`);
lines.push(`- p99: ${p99} ms`);
lines.push(`- avg: ${avg} ms`);
lines.push(`- max: ${max} ms`);

const sum = process.env.GITHUB_STEP_SUMMARY;
if (sum) appendFileSync(sum, lines.join('\n') + '\n');
else console.log(lines.join('\n'));
process.exit(0);
