#!/usr/bin/env node
/**
 * Guard: Verify that every "needs" reference points to an existing job id
 * across all workflow files in .github/workflows.
 *
 * - No external deps; simple line-based parser focused on jobs/needs blocks.
 * - Fails with exit(1) and prints a concise report if any unknown needs are found.
 */

import fs from 'node:fs';
import path from 'node:path';

const wfDir = path.join(process.cwd(), '.github', 'workflows');

function listWorkflowFiles() {
  if (!fs.existsSync(wfDir)) return [];
  return fs
    .readdirSync(wfDir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => path.join(wfDir, f));
}

function parseJobsAndNeeds(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const jobIds = new Set();
  const needRefs = [];

  let inJobs = false;
  let topIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, '    ');

    // Enter jobs section
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      topIndent = 0;
      continue;
    }

    // Outside jobs block, ignore
    if (!inJobs) continue;

    // Detect next top-level key -> exit jobs
    if (/^[a-zA-Z0-9_][^:]*:\s*$/.test(line) && !/^\s/.test(line)) {
      // A new top-level key encountered
      break;
    }

    // Job id lines are two-space indented keys ending with ':'
    const jobMatch = line.match(/^\s{2}([a-zA-Z0-9_-]+):\s*$/);
    if (jobMatch) {
      jobIds.add(jobMatch[1]);
      continue;
    }

    // needs: value lines anywhere within a job definition
    const needsMatch = line.match(/^\s+needs:\s*(.+)\s*$/);
    if (needsMatch) {
      let val = needsMatch[1].trim();
      if (val.startsWith('[')) {
        // Possibly multi-line list; accumulate until ']'
        let agg = val;
        while (!/\]/.test(agg) && i + 1 < lines.length) {
          i++;
          agg += ' ' + lines[i].trim();
        }
        val = agg;
      }
      // Normalize list → tokens
      if (val.startsWith('[') && val.endsWith(']')) {
        const items = val
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        needRefs.push(...items);
      } else {
        needRefs.push(val.replace(/^['"]|['"]$/g, ''));
      }
    }
  }

  return { jobIds, needRefs };
}

function main() {
  const files = listWorkflowFiles();
  if (files.length === 0) {
    console.log('No workflow files found.');
    return;
  }

  let hasError = false;
  const report = [];

  for (const f of files) {
    const { jobIds, needRefs } = parseJobsAndNeeds(f);
    const unknown = [...new Set(needRefs.filter(n => n && !jobIds.has(n)))];
    if (unknown.length) {
      hasError = true;
      report.push({
        file: path.basename(f),
        jobs: [...jobIds],
        needs: needRefs,
        unknown,
      });
    }
  }

  if (hasError) {
    console.error('✖ Workflow jobs/needs consistency check failed:');
    for (const r of report) {
      console.error(`  • ${r.file}`);
      console.error(`    Unknown needs: ${r.unknown.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('✔ Workflow jobs/needs consistency OK');
}

main();
