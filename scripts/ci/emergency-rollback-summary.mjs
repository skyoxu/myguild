#!/usr/bin/env node
/**
 * Append emergency rollback summary to GITHUB_STEP_SUMMARY.
 * Env: TARGET_VERSION, REQUESTED_BY, ROLLBACK_RESULTS (for all) or ROLLBACK_RESULT (single), TRIGGERED_BY
 */
import fs from 'node:fs';

const s = process.env.GITHUB_STEP_SUMMARY;
const md = [
  '## Emergency Rollback Summary',
  '',
  `- Target Version: ${process.env.TARGET_VERSION || ''}`,
  `- Requested By: ${process.env.REQUESTED_BY || ''}`,
  '',
  '### Execution Steps',
  '1. Validated prerequisites successfully',
  '2. Executed rollback operations',
  '3. Committed rollback changes',
  '',
];
const all = process.env.ROLLBACK_RESULTS;
const single = process.env.ROLLBACK_RESULT;
if (all) {
  md.push('### All Feed Files Results', '```json', all, '```');
} else if (single) {
  md.push('### Single Feed Result', '```json', single, '```');
}
if ((process.env.TRIGGERED_BY || '') === 'monitor') {
  md.push(
    '',
    'Note: This rollback was triggered automatically by monitoring systems'
  );
}

const txt = md.join('\n') + '\n';
if (!s) {
  console.log(txt);
} else {
  fs.appendFileSync(s, txt, 'utf8');
}
