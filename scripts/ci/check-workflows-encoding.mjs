#!/usr/bin/env node
/**
 * Workflow encoding/EOL guard with reporting.
 * - Validates UTF-8 without BOM and LF-only EOLs for .github/workflows (yml/yaml)
 * - Detects: BOM, CRLF, CR-only, and replacement chars (\uFFFD)
 * - Emits per-file stats, writes a Markdown Step Summary when available
 * - Also saves a JSON + Markdown report under logs/workflow-encoding/YYYY-MM-DD/
 */
import {
  readdirSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

function list(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...list(p));
    else if (/\.ya?ml$/i.test(name)) out.push(p);
  }
  return out;
}

const root = '.github/workflows';
let failed = false;
let checked = 0;
const results = [];

try {
  const files = list(root);
  for (const f of files) {
    const buf = readFileSync(f);
    const txt = buf.toString('utf8');
    checked++;

    // EOL stats
    const crlfCount = (txt.match(/\r\n/g) || []).length;
    const lfOnlyCount = (txt.replace(/\r\n/g, '').match(/\n/g) || []).length;
    const crOnlyCount = (txt.replace(/\r\n/g, '').match(/\r/g) || []).length;
    const hasFFFD = txt.includes('\uFFFD');
    const hasBOM =
      buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;

    // Violations
    let violated = false;
    if (hasBOM) {
      console.error(`[encoding-guard] FAIL: BOM found in ${f}`);
      violated = true;
    }
    if (crlfCount > 0 || crOnlyCount > 0) {
      console.error(
        `[encoding-guard] FAIL: Non-LF EOL detected in ${f} (CRLF=${crlfCount}, CR-only=${crOnlyCount})`
      );
      violated = true;
    }
    if (hasFFFD) {
      console.error(
        `[encoding-guard] FAIL: Replacement character (\\uFFFD) in ${f}`
      );
      violated = true;
    }

    failed ||= violated;
    results.push({
      file: f,
      hasBOM,
      crlfCount,
      lfOnlyCount,
      crOnlyCount,
      hasFFFD,
      violated,
    });
  }
} catch (e) {
  console.error(`[encoding-guard] ERROR: ${e.message}`);
  process.exit(1);
}

// Write summary (GitHub Step Summary if available)
try {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const outDir = join('logs', 'workflow-encoding', ymd);
  mkdirSync(outDir, { recursive: true });

  const summaryLines = [];
  summaryLines.push(`## Workflow Encoding/EOL Report (${checked} files)`);
  summaryLines.push('');
  summaryLines.push(
    '| File | BOM | CRLF | CR-only | LF-only | FFFD | Status |'
  );
  summaryLines.push('| --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const r of results) {
    summaryLines.push(
      `| ${r.file} | ${r.hasBOM ? 'yes' : 'no'} | ${r.crlfCount} | ${r.crOnlyCount} | ${r.lfOnlyCount} | ${r.hasFFFD ? 'yes' : 'no'} | ${r.violated ? 'FAIL' : 'OK'} |`
    );
  }
  summaryLines.push('');
  if (results.some(r => r.crlfCount > 0 || r.crOnlyCount > 0)) {
    summaryLines.push('### How to fix EOL on Windows');
    summaryLines.push(
      '- Prefer LF in repo: add `.gitattributes` → `*.yml text eol=lf`'
    );
    summaryLines.push('- Convert in-place (PowerShell):');
    summaryLines.push(
      '  - `Get-ChildItem -Recurse .github/workflows -Filter *.yml | % { (Get-Content $_ -Raw).Replace("`r`n","`n") | Set-Content -NoNewline -Encoding UTF8 $_ }`'
    );
    summaryLines.push('- Git config options:');
    summaryLines.push(
      '  - `git config --global core.autocrlf false` (or use `.gitattributes` to enforce LF per path)'
    );
  }

  const md = summaryLines.join('\n');
  const json = JSON.stringify(
    { timestamp: now.toISOString(), checked, failed, results },
    null,
    2
  );
  writeFileSync(join(outDir, `summary-${ts}.md`), md, 'utf8');
  writeFileSync(join(outDir, `report-${ts}.json`), json, 'utf8');

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', {
      encoding: 'utf8',
      flag: 'a',
    });
  }
} catch (e) {
  console.warn(
    '[encoding-guard] Failed to write summary/report:',
    e?.message || e
  );
}

if (!checked) {
  console.log('[encoding-guard] No workflow YAML files found');
} else {
  console.log(`[encoding-guard] Checked ${checked} workflow file(s)`);
}

if (failed) {
  console.error('[encoding-guard] Encoding/EOL violations detected');
  process.exit(1);
}
console.log('[encoding-guard] OK: UTF-8 + LF enforced for workflows');
