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
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

// Parameterized thresholds with safe defaults to preserve current behavior
const CRITICAL_LIMIT = Number.parseInt(process.env.CRITICAL_LIMIT ?? '0', 10);
const HIGH_LIMIT = Number.parseInt(process.env.HIGH_LIMIT ?? '3', 10);
const PR_SOFT_SECURITY_GATE = String(process.env.PR_SOFT_SECURITY_GATE || 'false').toLowerCase() === 'true';
const IS_PR = (process.env.GITHUB_EVENT_NAME || '') === 'pull_request';
const SOFT_GATE_ACTIVE = PR_SOFT_SECURITY_GATE && IS_PR;

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
console.log(`  Thresholds -> critical<=${CRITICAL_LIMIT}, high<=${HIGH_LIMIT}`);

setOutput('critical-count', String(critical));
setOutput('high-count', String(high));

// Persist summary for troubleshooting (logs/)
try {
  const logsDir = path.join('logs', 'unified-security');
  mkdirSync(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = {
    ts: new Date().toISOString(),
    totals: { critical, high },
    limits: { critical: CRITICAL_LIMIT, high: HIGH_LIMIT },
    ci: {
      workflow: process.env.GITHUB_WORKFLOW || '',
      job: process.env.GITHUB_JOB || '',
      runId: process.env.GITHUB_RUN_ID || '',
      event: process.env.GITHUB_EVENT_NAME || '',
      sha: process.env.GITHUB_SHA || '',
      ref: process.env.GITHUB_REF || '',
    },
  };
  writeFileSync(
    path.join(logsDir, `static-security-summary-${stamp}.json`),
    JSON.stringify(out, null, 2),
    'utf8'
  );
} catch {}

// ADR-0002 thresholds with soft/hard enforcement
if (critical > CRITICAL_LIMIT) {
  setOutput('status', 'failed');
  if (SOFT_GATE_ACTIVE) {
    console.log(
      `[Soft Gate] Critical issues (${critical}) > limit (${CRITICAL_LIMIT}); PR soft gate active, not blocking.`
    );
    process.exit(0);
  } else {
    console.log(
      '[Hard Failure] Found critical security issues, ADR-0002 requires zero'
    );
    process.exit(1);
  }
}
if (high > HIGH_LIMIT) {
  setOutput('status', 'failed');
  if (SOFT_GATE_ACTIVE) {
    console.log(
      `[Soft Gate] High issues (${high}) > limit (${HIGH_LIMIT}); PR soft gate active, not blocking.`
    );
    process.exit(0);
  } else {
    console.log(
      '[Hard Failure] Found high-level security issues exceeding limit of 3'
    );
    process.exit(1);
  }
}
setOutput('status', 'pass');
console.log('Static security scan passes ADR-0002 baseline requirements');
process.exit(0);
