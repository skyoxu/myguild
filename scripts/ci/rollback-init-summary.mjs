#!/usr/bin/env node
/**
 * Append an initiation summary for emergency rollback.
 * Env: REASON, TARGET_VERSION, FEED_FILES, TRIGGERED_BY
 */
import fs from 'node:fs';
const s = process.env.GITHUB_STEP_SUMMARY;
const md = [
  '### Emergency rollback initiated',
  '',
  `- Reason: ${process.env.REASON || ''}`,
  `- Target version: ${process.env.TARGET_VERSION || ''}`,
  `- Feed files: ${process.env.FEED_FILES || ''}`,
  `- Triggered by: ${process.env.TRIGGERED_BY || ''}`,
  '',
].join('\n');
if (!s) {
  console.log(md);
} else {
  fs.appendFileSync(s, md + '\n');
}
