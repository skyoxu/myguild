#!/usr/bin/env node
/**
 * Verify Vite build artifacts exist in dist/.
 */
import fs from 'node:fs';

if (!fs.existsSync('dist')) {
  console.error('dist/ directory not found');
  process.exit(1);
}
if (!fs.existsSync('dist/index.html')) {
  console.error('dist/index.html not found');
  process.exit(1);
}
if (!fs.existsSync('dist/assets')) {
  console.error('dist/assets/ directory not found');
  process.exit(1);
}
console.log('dist/ build artifacts verified');
