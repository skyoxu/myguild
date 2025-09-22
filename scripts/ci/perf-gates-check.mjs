#!/usr/bin/env node
/**
 * Run PR performance analysis and enforce basic failure on critical regressions.
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('node', ['scripts/pr-integration.mjs', 'analyze'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const out = (r.stdout || '').trim();
console.log(out);
if (/"critical"\s*:\s*[1-9]/.test(out)) {
  console.error('Critical performance regressions detected!');
  console.error(
    'This PR introduces performance regressions that exceed critical thresholds.'
  );
  console.error('Please review the changes and optimize before merging.');
  process.exit(1);
}
console.log('Performance gates passed!');
