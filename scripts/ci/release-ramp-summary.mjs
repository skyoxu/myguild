#!/usr/bin/env node
/**
 * Append pre-ramp summary to GITHUB_STEP_SUMMARY.
 * Env: STAGE, FEED_FILE, APP_VERSION, PREV_GA_VERSION, SENTRY_ORG, SENTRY_PROJECT,
 *       THRESHOLD_CF_USERS, THRESHOLD_CF_SESSIONS
 */
import fs from 'node:fs';

const s = process.env.GITHUB_STEP_SUMMARY;
const md = [
  '## Release Ramp Context',
  '',
  `- Stage: ${process.env.STAGE || ''}%`,
  `- Feed File: ${process.env.FEED_FILE || ''}`,
  `- App Version: ${process.env.APP_VERSION || ''}`,
  `- Previous GA: ${process.env.PREV_GA_VERSION || ''}`,
  `- Sentry: ${process.env.SENTRY_ORG || ''}/${process.env.SENTRY_PROJECT || ''}`,
  '',
  'Thresholds:',
  `- Crash-Free Users: ${process.env.THRESHOLD_CF_USERS || ''}`,
  `- Crash-Free Sessions: ${process.env.THRESHOLD_CF_SESSIONS || ''}`,
  '',
].join('\n');
if (!s) {
  console.log(md);
} else {
  fs.appendFileSync(s, md + '\n');
}
