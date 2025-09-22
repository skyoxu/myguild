#!/usr/bin/env node
/**
 * Post a JSON alert to WEBHOOK_URL. Non-fatal if missing.
 * Env:
 * - WEBHOOK_URL (required to send)
 * - APP_VERSION
 * - STAGING_PERCENTAGE
 */
const url = process.env.WEBHOOK_URL || '';
if (!url) {
  console.log('WEBHOOK_URL not set; skipping alert');
  process.exit(0);
}

const body = {
  text: 'Release Health Alert',
  attachments: [
    {
      color: 'danger',
      fields: [
        {
          title: 'App Version',
          value: process.env.APP_VERSION || 'unknown',
          short: true,
        },
        {
          title: 'Staging %',
          value: String(process.env.STAGING_PERCENTAGE || ''),
          short: true,
        },
        { title: 'Status', value: 'Health degradation detected', short: false },
        {
          title: 'Action',
          value: 'Emergency rollback triggered',
          short: false,
        },
      ],
      text: 'Continuous monitoring detected health issues. Emergency rollback has been initiated.',
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
  .catch(e => {
    console.warn(`Webhook error: ${String(e)}`);
  });
