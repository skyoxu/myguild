#!/usr/bin/env node
/**
 * Aggregate security scan results and set GitHub Action outputs.
 * Inputs (optional):
 *  - npm-audit-results.json (npm audit --json > file)
 *  - snyk-results.json (snyk test --json > file)
 *  - electronegativity-scan.csv (optional; not parsed here)
 * Outputs:
 *  - critical-count
 *  - high-count
 *  - status (pass|failed)
 * Notes: Fails (exit 1) when ADR-0002 thresholds are violated (critical>0 or high>3).
 */
import { readFileSync, existsSync } from 'node:fs';

function readJson(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    const txt = readFileSync(path, 'utf8');
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

let critical = 0;
let high = 0;

// npm audit format
const npmAudit = readJson('npm-audit-results.json');
if (npmAudit && npmAudit.vulnerabilities) {
  for (const sev of Object.keys(npmAudit.vulnerabilities)) {
    const v = npmAudit.vulnerabilities[sev];
    if (!v || typeof v.total !== 'number') continue;
    if (sev === 'critical') critical += v.total;
    if (sev === 'high') high += v.total;
  }
}

// snyk format
const snyk = readJson('snyk-results.json');
if (snyk && Array.isArray(snyk.vulnerabilities)) {
  for (const item of snyk.vulnerabilities) {
    const sev = (item && item.severity) || '';
    if (sev === 'critical') critical += 1;
    if (sev === 'high') high += 1;
  }
}

const outPath = process.env.GITHUB_OUTPUT;
function setOutput(k, v) {
  if (!outPath) return;
  try {
    require('node:fs').appendFileSync(outPath, `${k}=${v}\n`);
  } catch {}
}

console.log('Static scan summary:');
console.log(`  Critical total: ${critical}`);
console.log(`  High total: ${high}`);

setOutput('critical-count', String(critical));
setOutput('high-count', String(high));

// ADR-0002 thresholds
if (critical > 0) {
  setOutput('status', 'failed');
  console.log(
    '[Hard Failure] Found critical security issues, ADR-0002 requires zero'
  );
  process.exit(1);
}
if (high > 3) {
  setOutput('status', 'failed');
  console.log(
    '[Hard Failure] Found high-level security issues exceeding limit of 3'
  );
  process.exit(1);
}
setOutput('status', 'pass');
console.log('Static security scan passes ADR-0002 baseline requirements');
process.exit(0);
