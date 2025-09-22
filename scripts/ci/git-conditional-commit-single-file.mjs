#!/usr/bin/env node
/**
 * Commit a single file if it has changes.
 * Env: FILE_PATH (required), MESSAGE (required)
 * Outputs: committed ('true'|'false'), commit_type (optional), commit_sha
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const file = process.env.FILE_PATH || '';
const message = process.env.MESSAGE || '';
if (!file || !message) {
  console.error('FILE_PATH and MESSAGE are required');
  process.exit(1);
}

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

const diff = spawnSync('git', ['diff', '--quiet', file], {
  shell: process.platform === 'win32',
});
if (diff.status === 0) {
  console.log('No changes in file');
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'committed=false\n');
  process.exit(0);
}

run('git', ['add', file]);
run('git', ['commit', '-m', message]);

const sha = spawnSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'committed=true\n');
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `commit_sha=${(sha.stdout || '').trim()}\n`
  );
}
console.log('Committed changes');
