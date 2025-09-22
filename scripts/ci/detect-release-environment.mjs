#!/usr/bin/env node
/**
 * Decide environment from event: workflow_dispatch input or ref.
 * Output: environment
 */
import fs from 'node:fs';

const eventName = process.env.GITHUB_EVENT_NAME || '';
const inputEnv = process.env.INPUT_ENVIRONMENT || '';
const ref = process.env.GITHUB_REF || '';
let envName = 'staging';
if (eventName === 'workflow_dispatch' && inputEnv) envName = inputEnv;
else if (ref === 'refs/heads/main') envName = 'production';
if (process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `environment=${envName}\n`);
console.log(`environment=${envName}`);
