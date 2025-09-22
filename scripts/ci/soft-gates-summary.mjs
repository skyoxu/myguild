#!/usr/bin/env node
/**
 * Read logs/soft-gate-report.json and append a summary markdown.
 */
import fs from 'node:fs';

const s = process.env.GITHUB_STEP_SUMMARY;
let report = null;
try {
  report = JSON.parse(fs.readFileSync('logs/soft-gate-report.json', 'utf8'));
} catch {}

const overall = report?.overallScore ?? 75;
const total = report?.summary?.totalGates ?? 0;
const success = report?.summary?.successCount ?? 0;
const warning = report?.summary?.warningCount ?? 0;
const error = report?.summary?.errorCount ?? 0;

const lines = [
  '## Soft Gates Quality Check Results',
  '',
  `### Quality Score: ${overall}/100`,
  '',
  '| Check Item | Count |',
  '|---------|------|',
  `| Total Checks | ${total} |`,
  `| Success | ${success} |`,
  `| Warning | ${warning} |`,
  `| Error | ${error} |`,
  '',
];

if (report?.feedback?.length) {
  lines.push('### Feedback Details', '');
  for (const f of report.feedback) if (f?.message) lines.push(`- ${f.message}`);
  lines.push('');
}
if (report?.recommendations?.length) {
  lines.push('### Improvement Suggestions', '');
  for (const r of report.recommendations) lines.push(`- ${r}`);
  lines.push('');
}

lines.push(
  '---',
  '*Soft gates provide feedback but do not block merge (ADR-0005)*'
);
const md = lines.join('\n') + '\n';
if (!s) {
  console.log(md);
} else {
  fs.appendFileSync(s, md, 'utf8');
}
