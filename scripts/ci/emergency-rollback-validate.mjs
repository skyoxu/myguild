#!/usr/bin/env node
/**
 * Validate rollback prerequisites: artifacts/manifest.json exists and contains PREV_GA_VERSION.
 * Env: PREV_GA_VERSION
 */
import fs from 'node:fs';

const version = process.env.PREV_GA_VERSION || '';
if (!fs.existsSync('artifacts/manifest.json')) {
  console.error('Manifest file missing: artifacts/manifest.json');
  process.exit(1);
}
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync('artifacts/manifest.json', 'utf8'));
} catch (e) {
  console.error('Invalid manifest JSON');
  process.exit(1);
}
if (!version || !manifest[version]) {
  console.error(`Target version not found in manifest: ${version}`);
  console.error('Available versions:', Object.keys(manifest).join(','));
  process.exit(1);
}
console.log(`Rollback target validated: ${version}`);
