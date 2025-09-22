#!/usr/bin/env node
/**
 * Stage and commit release preparation changes.
 * Env:
 * - CREATE_FEEDS ('true' | 'false')
 * - VERSION
 * - ARTIFACT_PATH
 */
import { spawnSync } from 'node:child_process';

const createFeeds = String(process.env.CREATE_FEEDS || 'false') === 'true';
const version = process.env.VERSION || '';
const artifact = process.env.ARTIFACT_PATH || '';

function run(cmd, args) {
  return (
    spawnSync(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }).status ?? 0
  );
}

run('git', ['config', 'user.name', 'github-actions[bot]']);
run('git', [
  'config',
  'user.email',
  '41898282+github-actions[bot]@users.noreply.github.com',
]);

// Check diff
const diff = spawnSync('git', ['diff', '--quiet'], {
  shell: process.platform === 'win32',
});
const diffCached = spawnSync('git', ['diff', '--cached', '--quiet'], {
  shell: process.platform === 'win32',
});
if (diff.status === 0 && diffCached.status === 0) {
  console.log('No changes need to be committed');
  process.exit(0);
}

run('git', ['add', 'artifacts/manifest.json']);
if (createFeeds) run('git', ['add', 'dist/latest*.yml']);

const msg = [
  `Release preparation: v${version}`,
  `Version: ${version}`,
  `Artifact: ${artifact}`,
  `Feed files: ${createFeeds}`,
  `Workflow: ${process.env.GITHUB_WORKFLOW || ''}`,
  `Run: ${process.env.GITHUB_RUN_NUMBER || ''}`,
].join('\n');

run('git', ['commit', '-m', msg]);
console.log('Changes committed successfully');
