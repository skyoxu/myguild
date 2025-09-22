#!/usr/bin/env node
/**
 * Decide whether to monitor release now based on time window and feed settings.
 * Outputs:
 * - should_monitor: 'true' | 'false'
 * - staging_percentage: string (if true)
 */
import fs from 'node:fs';
import path from 'node:path';

const outFile = process.env.GITHUB_OUTPUT;
function setOutput(k, v) {
  if (!outFile) return;
  fs.appendFileSync(outFile, `${k}=${v}\n`, 'utf8');
}

const force = String(process.env.FORCE_CHECK || '').toLowerCase() === 'true';
const hour = new Date().getUTCHours();
if ((hour < 6 || hour > 22) && !force) {
  setOutput('should_monitor', 'false');
  process.exit(0);
}

const feed = path.join(process.cwd(), 'dist', 'latest.yml');
if (!fs.existsSync(feed)) {
  setOutput('should_monitor', 'false');
  process.exit(0);
}

let staging = '0';
try {
  const txt = fs.readFileSync(feed, 'utf8');
  const m = txt.match(/^stagingPercentage:\s*(\d+)/m);
  if (m) staging = m[1];
} catch {}

if (staging === '0' || staging === '100') {
  setOutput('should_monitor', 'false');
  process.exit(0);
}

setOutput('should_monitor', 'true');
setOutput('staging_percentage', staging);
console.log(`Monitoring enabled; stagingPercentage=${staging}%`);
