#!/usr/bin/env node
/**
 * Auto-fix GitHub workflows for Windows shell policy and POSIX steps.
 * - For every job with `runs-on: windows-latest`, ensure `defaults.run.shell: pwsh` exists.
 * - For steps inside Windows jobs that use POSIX test syntax, add `shell: bash` at step level.
 * - Writes a summary to logs/YYYY-MM-DD/workflows/autofix.log
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';

const root = '.github/workflows';

function listYaml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listYaml(p));
    else if (/\.ya?ml$/i.test(name)) out.push(p);
  }
  return out;
}

function leadingSpaces(s) {
  const m = s.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function fixFile(file) {
  const orig = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const lines = orig.split('\n');
  const changes = [];

  // Find job headers at indent 2: "  jobid:"
  const jobIdxs = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*jobs:\s*$/.test(lines[i])) {
      // collect following 2-space keys until next top-level section
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\w[\w-]*:\s*$/.test(lines[j])) break; // top-level key
        if (/^\s{2}[A-Za-z0-9_-]+:\s*$/.test(lines[j])) jobIdxs.push(j);
      }
      break;
    }
  }

  const insertions = [];
  const modifications = [];

  function findNextJob(start) {
    for (const idx of jobIdxs) if (idx > start) return idx;
    return lines.length;
  }

  // Process each job
  for (const h of jobIdxs) {
    const jobIndent = leadingSpaces(lines[h]); // typically 2
    const end = findNextJob(h);
    const region = lines.slice(h, end);

    // Detect Windows job
    const winRunIdxRel = region.findIndex(l =>
      /^\s+runs-on:\s*windows-latest\b/.test(l)
    );
    if (winRunIdxRel === -1) continue;

    const regionText = region.join('\n');
    const hasPwsh =
      /\n\s+defaults:\s*\n\s+run:\s*\n\s+shell:\s*pwsh\b/.test(regionText) ||
      /\n\s+shell:\s*pwsh\b/.test(regionText);
    if (!hasPwsh) {
      // Insert defaults after runs-on line
      const absIdx = h + winRunIdxRel + 1;
      const d = ' '.repeat(jobIndent + 2) + 'defaults:';
      const r = ' '.repeat(jobIndent + 4) + 'run:';
      const s = ' '.repeat(jobIndent + 6) + 'shell: pwsh';
      insertions.push({ index: absIdx, lines: [d, r, s] });
      changes.push(`added pwsh defaults in job at line ${h + 1}`);
    }

    // Add step-level shell: bash for POSIX steps
    // Find steps region(s)
    for (let i = h; i < end; i++) {
      if (/^\s+steps:\s*$/.test(lines[i])) {
        const stepsIndent = leadingSpaces(lines[i]);
        // iterate step blocks starting with "- name:" or "- run:" at indent >= stepsIndent + 2
        for (let sIdx = i + 1; sIdx < end; sIdx++) {
          const l = lines[sIdx];
          const ind = leadingSpaces(l);
          if (ind <= stepsIndent) break; // steps block ended
          if (/^\s*-\s*(name|run|uses):/.test(l)) {
            const stepStart = sIdx;
            // find next step or end
            let stepEnd = end;
            for (let k = sIdx + 1; k < end; k++) {
              if (
                leadingSpaces(lines[k]) <= stepsIndent &&
                /^\s*-\s*/.test(lines[k].trim())
              ) {
                stepEnd = k;
                break;
              }
              if (
                leadingSpaces(lines[k]) === stepsIndent + 2 &&
                /^-\s*/.test(lines[k].trim())
              ) {
                stepEnd = k;
                break;
              }
            }
            const stepBlock = lines.slice(stepStart, stepEnd).join('\n');
            // Skip if shell already specified in step
            if (/\n\s+shell:\s*\w+/.test('\n' + stepBlock)) {
              sIdx = stepEnd - 1;
              continue;
            }
            // Extract run content
            let runLineRel = -1;
            for (let rIdx = stepStart; rIdx < stepEnd; rIdx++) {
              if (/^\s+run:\s*/.test(lines[rIdx])) {
                runLineRel = rIdx;
                break;
              }
            }
            if (runLineRel === -1) {
              sIdx = stepEnd - 1;
              continue;
            }
            const runIndent = leadingSpaces(lines[runLineRel]);
            // Collect run content
            let posixFound = false;
            const runLine = lines[runLineRel];
            const isBlock = /\|\s*$/.test(runLine);
            if (!isBlock) {
              const inline = runLine.replace(/^\s*run:\s*/, '');
              posixFound = /(\bif\s*\[|\[\[|\]\]|\bthen\b|\bfi\b)/.test(inline);
            } else {
              for (let r = runLineRel + 1; r < stepEnd; r++) {
                if (leadingSpaces(lines[r]) <= runIndent) break;
                const t = lines[r];
                if (/(\bif\s*\[|\[\[|\]\]|\bthen\b|\bfi\b)/.test(t)) {
                  posixFound = true;
                  break;
                }
              }
            }
            if (posixFound) {
              const shellLine = ' '.repeat(runIndent) + 'shell: bash';
              insertions.push({ index: runLineRel, lines: [shellLine] });
              changes.push(
                `added step-level shell: bash at line ${runLineRel + 1}`
              );
            }
            sIdx = stepEnd - 1;
          }
        }
      }
    }
  }

  if (insertions.length === 0) return { changed: false, changes: [] };

  // Apply insertions in descending index order
  insertions.sort((a, b) => b.index - a.index);
  for (const ins of insertions) {
    lines.splice(ins.index, 0, ...ins.lines);
  }
  const out = lines.join('\n');
  writeFileSync(file, out, 'utf8');
  return { changed: true, changes };
}

function main() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const logDir = join('logs', `${y}-${m}-${d}`, 'workflows');
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, 'autofix.log');
  const files = listYaml(root);
  let changedCount = 0;
  const lines = [];
  lines.push(`[autofix] scanning ${files.length} workflow file(s)`);
  for (const f of files) {
    const res = fixFile(f);
    if (res.changed) {
      changedCount++;
      lines.push(`- ${f}:`);
      for (const c of res.changes) lines.push(`  * ${c}`);
    }
  }
  lines.push(`[autofix] changed files: ${changedCount}`);
  writeFileSync(logFile, lines.join('\n'), 'utf8');
  console.log(`Wrote ${logFile}`);
}

main();
