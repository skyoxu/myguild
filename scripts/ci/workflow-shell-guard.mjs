#!/usr/bin/env node
/**
 * Enforce Windows shell policy across workflows:
 * - Windows jobs should default to pwsh (either top-level defaults or job-level)
 * - If a step uses POSIX test syntax ([ or [[ ), that step must declare shell: bash
 */
import fs from 'node:fs';
import path from 'node:path';

function listFiles(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) res = res.concat(listFiles(p));
    else if (p.endsWith('.yml') || p.endsWith('.yaml')) res.push(p);
  }
  return res;
}

const root = '.github/workflows';
const files = listFiles(root);
const failures = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const hasTopLevelPwsh =
    /(^|\n)defaults:\s*[\r\n]+\s*run:\s*[\r\n]+\s*shell:\s*pwsh/i.test(content);

  // If no top-level pwsh, ensure each windows-latest job has pwsh defaults nearby
  if (!hasTopLevelPwsh) {
    const reWin = /runs-on:\s*windows-latest/g;
    let m;
    while ((m = reWin.exec(content))) {
      const region = content.slice(m.index, m.index + 2000);
      const hasPwshDefault =
        /defaults:\s*[\r\n]+\s*run:\s*[\r\n]+\s*shell:\s*pwsh/i.test(region);
      if (!hasPwshDefault)
        failures.push(
          `${file}: windows-latest job missing defaults.run.shell: pwsh`
        );
    }
  }

  // Build step index: locate "- name:" and whether that step declares shell: bash
  const lines = content.split(/\r?\n/);
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^-\s*name:\s*/.test(l.trim())) {
      let hasBash = false;
      for (let j = i; j < Math.min(lines.length, i + 20); j++) {
        const lj = lines[j];
        if (/^\s*shell:\s*bash\b/i.test(lj)) {
          hasBash = true;
          break;
        }
        if (/^-\s*name:\s*/.test(lj.trim()) && j !== i) break; // next step boundary
      }
      steps.push({ start: i, hasBash });
    }
  }
  function stepHasBashForLine(idx) {
    let s = null;
    for (const st of steps) {
      if (st.start <= idx) s = st;
      else break;
    }
    return s ? s.hasBash : false;
  }

  // Detect POSIX test syntax usage and require shell: bash at step-level
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^if:\s*/.test(trimmed)) continue; // YAML condition line
    if (/(^|\s)if\s*\[|^\s*\[\[/.test(line)) {
      if (!stepHasBashForLine(i)) {
        failures.push(
          `${file}:${i + 1}: POSIX test syntax without step-level shell: bash`
        );
      }
    }
  }
}

if (failures.length) {
  console.error('Shell policy violations found:');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
} else {
  console.log('Shell guard passed: Windows-only + pwsh policy compliant.');
}
