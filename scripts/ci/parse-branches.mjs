#!/usr/bin/env node
/**
 * Parse a comma- or newline-separated branch list and emit a multiline output "branches".
 * Inputs (env):
 * - INPUT_BRANCHES: string (e.g., "main,develop")
 * Outputs (GITHUB_OUTPUT):
 * - branches: multiline list of branches
 */
import fs from 'node:fs';

const input = process.env.INPUT_BRANCHES || '';
const outFile = process.env.GITHUB_OUTPUT;

function normalizeBranches(s) {
  return s
    .split(/[\n,]/g)
    .map(v => v.trim())
    .filter(Boolean)
    .join('\n');
}

const branches = normalizeBranches(input);
if (!branches) {
  console.log('No branches provided; defaulting to "main"');
}
if (!outFile) {
  console.error('GITHUB_OUTPUT not set. Cannot publish outputs.');
  process.exit(1);
}

const content = `branches<<EOF\n${branches || 'main'}\nEOF\n`;
fs.appendFileSync(outFile, content, 'utf8');
console.log('Branches parsed and set to GITHUB_OUTPUT.');
