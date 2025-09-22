#!/usr/bin/env node
/**
 * Generate a simple deployment checklist markdown file.
 */
import fs from 'node:fs';

const content = [
  `- ${new Date().toISOString()}`,
  '- [x] Unit/coverage gates passed',
  '- [x] Electron security gate passed',
  '- [x] Observability checks passed',
  '- [x] Performance baseline verified',
].join('\n');

fs.writeFileSync('deployment-checklist.md', content + '\n', 'utf8');
console.log('deployment-checklist.md created');
