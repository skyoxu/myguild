#!/usr/bin/env node
/**
 * Unified security gate check using job outputs.
 * Inputs via env:
 *  - SCAN_RESULT: needs.security-scan.result
 *  - E2E_STATUS: aggregated e2e status (pass|failed)
 * Fails (exit 1) if static scan did not succeed or E2E failed.
 */
const scanResult = process.env.SCAN_RESULT || '';
const e2eStatus = process.env.E2E_STATUS || '';
console.log('Starting unified security gate check...');
if (scanResult !== 'success') {
  console.log(
    '[Hard Failure] Static security scan failed, violates ADR-0002 security baseline'
  );
  process.exit(1);
}
if (e2eStatus === 'failed') {
  console.log(
    '[Hard Failure] E2E security tests failed (from aggregated outputs)'
  );
  process.exit(1);
}
console.log(
  'Unified security gate pre-checks passed (static scan + E2E outputs)'
);
process.exit(0);
