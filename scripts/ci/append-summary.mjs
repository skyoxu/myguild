#!/usr/bin/env node
/**
 * Append markdown content to GitHub step summary.
 * Env:
 * - SUMMARY_MD_CONTENT: inline markdown content (preferred)
 * - SUMMARY_FILE: optional path to a markdown file
 */
import fs from 'node:fs';

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (!summaryPath) {
  console.error('GITHUB_STEP_SUMMARY not set.');
  process.exit(1);
}

let content = process.env.SUMMARY_MD_CONTENT || '';
const file = process.env.SUMMARY_FILE;
if (!content && file) {
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {}
}

if (!content) {
  content = 'No content provided.';
}

fs.appendFileSync(summaryPath, content + '\n', 'utf8');
console.log('Summary appended.');
