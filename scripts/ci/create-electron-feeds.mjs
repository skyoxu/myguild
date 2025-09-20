#!/usr/bin/env node
/**
 * Create electron-updater feed files based on artifacts/manifest.json.
 * Windows-only: generate dist/latest.yml
 * Env:
 * - VERSION
 */
import fs from 'node:fs';
import path from 'node:path';

const version = process.env.VERSION;
if (!version) { console.error('VERSION is required'); process.exit(1); }

const manifestFile = path.join('artifacts', 'manifest.json');
if (!fs.existsSync(manifestFile)) {
  console.error('artifacts/manifest.json not found');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const data = manifest[version];
if (!data) {
  console.error(`Version ${version} not found in manifest`);
  process.exit(1);
}
fs.mkdirSync('dist', { recursive: true });

const feedFile = path.join('dist', 'latest.yml');
const yaml = [
  `version: ${version}`,
  'files:',
  `  - url: ${data.path}`,
  `    sha512: ${data.sha512}`,
  `    size: ${data.size}`,
  `path: ${data.path}`,
  `sha512: ${data.sha512}`,
  `releaseDate: '${data.releaseDate}'`,
  'stagingPercentage: 0',
  `size: ${data.size}`
].join('\n');

fs.writeFileSync(feedFile, yaml + '\n', 'utf8');
console.log(`Created feed file: ${feedFile}`);

