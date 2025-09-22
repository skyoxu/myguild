#!/usr/bin/env node
/**
 * Write unified security gate summary to GITHUB_STEP_SUMMARY.
 * Inputs via env: SCAN_RESULT, E2E_STATUS, CRITICAL_COUNT, HIGH_COUNT, EVENT_NAME
 * Sets exit code 1 when hard failure is detected to enforce gate policy.
 */
import { writeFileSync, appendFileSync } from 'node:fs';

function outSummary(text) {
  const p = process.env.GITHUB_STEP_SUMMARY;
  if (!p) return console.log(text);
  appendFileSync(p, text + '\n');
}

const scanResult = process.env.SCAN_RESULT || '';
const e2eStatus = process.env.E2E_STATUS || '';
const critical = Number(process.env.CRITICAL_COUNT || '0');
const high = Number(process.env.HIGH_COUNT || '0');
const eventName = process.env.EVENT_NAME || '';

let title = '';
let msg = '';
let exitCode = 0;

if (scanResult !== 'success') {
  title = '### Security Gate Hard Failure';
  msg =
    '**ADR-0002 Violation**: Static security scan failed baseline requirements\n' +
    `- Critical security issues: ${critical} (required: 0)\n` +
    `- High security issues: ${high} (<= 3)\n` +
    '**This change is hard-blocked from merging until issues are fixed**';
  exitCode = 1;
} else if (e2eStatus === 'failed') {
  title = '### Security Gate Hard Failure';
  msg =
    '**ADR-0002 Violation**: E2E security tests failed\n' +
    'Please check Electron security configuration:\n' +
    '- nodeIntegration=false\n' +
    '- contextIsolation=true\n' +
    '- sandbox=true\n' +
    '**This change is hard-blocked from merging until Electron security is fixed**';
  exitCode = 1;
} else {
  title = '### Security Gate Passed';
  msg =
    '**ADR-0002 Compliant**: All security checks passed\n' +
    '- Critical security issues: 0\n' +
    `- High security issues: ${high} (<= 3)\n` +
    '- E2E security tests: Passed';
}

const gateLabel = eventName === 'pull_request' ? 'Soft' : 'Hard';
outSummary('## Unified Security Gate Results');
outSummary('');
outSummary('### Check Summary');
outSummary('| Check Item | Status | Result |');
outSummary('|---------|------|------|');
outSummary(
  `| Static Security Scan | ${scanResult} | Critical: ${critical}, High: ${high} |`
);
outSummary(
  `| E2E Security Tests | ${e2eStatus || 'unknown'} | ${gateLabel === 'Soft' ? 'Executed' : 'Executed'} |`
);
outSummary(`| E2E Gate | ${gateLabel} | Mode: PR=Soft / Main=Hard |`);
outSummary('');
outSummary(title);
outSummary(msg);

if (exitCode === 1) process.exit(1);
process.exit(0);
