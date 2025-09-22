#!/usr/bin/env node
/**
 * Append ramp result summary.
 * Env: STAGE, HEALTH_RESULT, HEALTH_STATUS
 */
import fs from 'node:fs';

const s = process.env.GITHUB_STEP_SUMMARY;
const stage = process.env.STAGE || '';
const health = process.env.HEALTH_RESULT || '';
const status = process.env.HEALTH_STATUS || '';

const lines = ['## Release Ramp Results', '', `- Stage: ${stage}%`, ''];
if (health) {
  lines.push('### Health Check Details', '```json', health, '```', '');
}
if (status === 'passed' && stage !== '100') {
  let next = '25';
  if (stage === '25') next = '50';
  else if (stage === '50') next = '100';
  lines.push(
    `- Continue to ${next}% stage`,
    '- Wait 10-15 minutes before next stage'
  );
} else if (status === 'failed') {
  lines.push(
    '- Health check failed - immediate action required',
    '- Review release metrics and error reports'
  );
} else if (stage === '100' && status === 'passed') {
  lines.push(
    '- Gradual release completed. Application is fully deployed.',
    '- Consider updating PREV_GA_VERSION to current version'
  );
}

const md = lines.join('\n') + '\n';
if (!s) {
  console.log(md);
} else {
  fs.appendFileSync(s, md, 'utf8');
}
