#!/usr/bin/env node
/**
 * Wait for a calculated time window based on stage.
 * Env: STAGE
 */
const stage = String(process.env.STAGE || '5');
let minutes = 3;
if (stage === '25') minutes = 5;
else if (stage === '50') minutes = 8;
else if (stage === '100') minutes = 10;
console.log(`Waiting ${minutes} minutes for health signals...`);
setTimeout(
  () => {
    console.log('Wait completed');
  },
  minutes * 60 * 1000
);
