#!/usr/bin/env node
/**
 * Append a release preparation summary to GITHUB_STEP_SUMMARY.
 * Env:
 * - VERSION
 * - ARTIFACT_PATH
 * - CREATE_FEEDS ('true' | 'false')
 */
import fs from 'node:fs';

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const version = process.env.VERSION || 'unknown';
const artifactPath = process.env.ARTIFACT_PATH || '';
const createFeeds = String(process.env.CREATE_FEEDS || 'false');

let manifestList = '';
try {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(
    process.execPath,
    ['scripts/release/manage-manifest.mjs', 'list'],
    { encoding: 'utf8' }
  );
  if (r.status === 0) manifestList = r.stdout.trim();
} catch {}

const md = [
  '## Release Preparation Summary',
  '',
  '| Property | Value |',
  '|----------|-------|',
  `| Version | ${version} |`,
  `| Artifact Path | ${artifactPath} |`,
  `| Feed | ${createFeeds === 'true' ? 'Yes' : 'No'} |`,
  '',
  '### Version Manifest Status',
  '```json',
  manifestList || '{}',
  '```',
  '',
  createFeeds === 'true' ? '### Feed Files Created' : '',
  createFeeds === 'true' ? '- `dist/latest.yml` (Windows)' : '',
  '',
  '### Next Steps',
  '1. Run Release Ramp workflow to begin gradual rollout',
  '2. Rollout stages: 5% → 25% → 50% → 100%',
  '3. Each stage will automatically perform health checks',
  '',
]
  .filter(Boolean)
  .join('\n');

if (!summaryPath) {
  console.log(md);
} else {
  fs.appendFileSync(summaryPath, md + '\n');
  console.log('Release summary appended');
}
