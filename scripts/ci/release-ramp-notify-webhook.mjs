#!/usr/bin/env node
/**
 * Send a post-action webhook notification for release ramp.
 * Env: WEBHOOK_URL, STAGE, HEALTH_PASSED ('true'|'false'), ROLLBACK_EXECUTED ('true'|'false'), APP_VERSION, REPOSITORY, WORKFLOW
 */
const url = process.env.WEBHOOK_URL || '';
if (!url) {
  console.log('WEBHOOK_URL not set; skipping');
  process.exit(0);
}

const stage = process.env.STAGE || '';
const healthPassed = String(process.env.HEALTH_PASSED || '') === 'true';
const rollback = String(process.env.ROLLBACK_EXECUTED || '') === 'true';

let status, color, message;
if (rollback) {
  status = 'Rollback Executed';
  color = 'danger';
  message = `Release ramp failed health check at ${stage}% and was automatically rolled back`;
} else if (healthPassed) {
  status = `Stage ${stage}% Complete`;
  color = 'good';
  message = `Release ramp to ${stage}% completed successfully with healthy metrics`;
} else {
  status = `Stage ${stage}% - No Health Check`;
  color = 'warning';
  message = `Release ramp to ${stage}% completed (health check skipped)`;
}

const body = {
  text: status,
  attachments: [
    {
      color,
      fields: [
        {
          title: 'App Version',
          value: process.env.APP_VERSION || '',
          short: true,
        },
        { title: 'Stage', value: `${stage}%`, short: true },
        {
          title: 'Repository',
          value: process.env.REPOSITORY || '',
          short: true,
        },
        { title: 'Workflow', value: process.env.WORKFLOW || '', short: true },
      ],
      text: message,
    },
  ],
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
  .then(r => {
    if (!r.ok) console.warn(`Webhook failed: ${r.status} ${r.statusText}`);
    else console.log('Webhook sent');
  })
  .catch(e => console.warn(`Webhook error: ${String(e)}`));
