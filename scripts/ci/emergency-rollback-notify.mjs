#!/usr/bin/env node
/**
 * Send emergency rollback notification to WEBHOOK_URL.
 * Env: WEBHOOK_URL, PREV_GA_VERSION, FEED_FILES, TRIGGERED_BY, REPOSITORY, REASON
 */
const url = process.env.WEBHOOK_URL || '';
if (!url) {
  console.log('WEBHOOK_URL not set; skipping');
  process.exit(0);
}

const status = 'Emergency Rollback Completed';
const color = 'warning';
const message = `Emergency rollback to version ${process.env.PREV_GA_VERSION || ''} has been executed.`;

const body = {
  text: status,
  attachments: [
    {
      color,
      fields: [
        {
          title: 'Target Version',
          value: process.env.PREV_GA_VERSION || '',
          short: true,
        },
        {
          title: 'Feed Files',
          value: process.env.FEED_FILES || '',
          short: true,
        },
        {
          title: 'Triggered By',
          value: process.env.TRIGGERED_BY || '',
          short: true,
        },
        {
          title: 'Repository',
          value: process.env.REPOSITORY || '',
          short: true,
        },
        { title: 'Reason', value: process.env.REASON || '', short: false },
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
