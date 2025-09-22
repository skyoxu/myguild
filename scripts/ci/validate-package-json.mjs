#!/usr/bin/env node
/**
 * Validate required fields in package.json and print a brief summary.
 */
import fs from 'node:fs';

const raw = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(raw);
const required = ['name', 'version'];
const missing = required.filter(k => !pkg[k]);
if (missing.length) {
  console.error('Missing required fields in package.json:', missing);
  process.exit(1);
}
console.log('package.json validation passed.');
console.log(`Name: ${pkg.name}`);
console.log(`Version: ${pkg.version}`);
console.log(`ProductName: ${pkg.productName || '(unset)'}`);
