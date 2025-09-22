#!/usr/bin/env node
/**
 * Sanitize non-ASCII content in code comments and string literals.
 * Default: dry-run (report only). Use --write to apply changes.
 * Windows-friendly; logs to logs/ci/YYYY-MM-DD/sanitize-ascii-*.log
 *
 * Usage (PowerShell):
 *   node scripts/sanitize-ascii.mjs --targets "tests/**/*.ts,src/shared/observability/**/*.ts,electron/main.ts" --write
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2).reduce((acc, cur) => {
  const [k, v] = cur.includes('=') ? cur.split('=') : [cur, true];
  acc[k.replace(/^--/, '')] = v === undefined ? true : v;
  return acc;
}, {} as Record<string, any>);

const write = String(args.write || 'false').toLowerCase() === 'true';
const targets = String(
  args.targets || 'tests/**/*.ts,src/shared/observability/**/*.ts,electron/main.ts'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Tiny glob: expand only **/*.ts and exact files to keep dependencies minimal
function listFiles(pattern: string): string[] {
  if (!pattern.includes('**')) {
    return fs.existsSync(pattern) ? [pattern] : [];
  }
  const [base, suffix] = pattern.split('**');
  const root = base || '.';
  const ext = suffix.replace(/^[\/\\]/, '');
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (p.endsWith(ext)) results.push(p);
    }
  }
  if (fs.existsSync(root)) walk(root);
  return results;
}

const now = new Date();
const yyyy = now.getUTCFullYear();
const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
const dd = String(now.getUTCDate()).padStart(2, '0');
const hh = String(now.getUTCHours()).padStart(2, '0');
const mi = String(now.getUTCMinutes()).padStart(2, '0');
const ss = String(now.getUTCSeconds()).padStart(2, '0');
const logDir = path.join('logs', 'ci', `${yyyy}-${mm}-${dd}`);
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `sanitize-ascii-${hh}${mi}${ss}Z.log`);
const log = (s: string) => fs.appendFileSync(logFile, s + '\n', 'utf8');

function sanitizeContent(src: string): { out: string; removed: number; fixed: number } {
  let removed = 0;
  let fixed = 0;
  // Remove common garbled prefix like '?? ' introduced by encoding issues
  let out = src.replace(/[?]{2,}\s*/g, m => {
    removed += m.length;
    return '';
  });
  // Replace full-width punctuation with ASCII
  const punctMap: Record<string, string> = {
    '，': ',', '。': '.', '；': ';', '：': ':', '（': '(', '）': ')', '【': '[', '】': ']', '！': '!', '？': '?', '“': '"', '”': '"', '、': ',',
  };
  out = out.replace(/[，。；：（）【】！？“”、]/g, ch => {
    fixed += 1; return punctMap[ch] || '';
  });
  // Strip non-ASCII chars in comments and string literals (best-effort regex)
  out = out.replace(/(\/\/.*|\/\*[\s\S]*?\*\/|(['"]).*?\2)/g, block => {
    const ascii = block.replace(/[\u0100-\uFFFF]/g, _ => { removed += 1; return ''; });
    return ascii;
  });
  return { out, removed, fixed };
}

let totalFiles = 0, changedFiles = 0, totalRemoved = 0, totalFixed = 0;
for (const pat of targets) {
  for (const file of listFiles(pat)) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    totalFiles++;
    const src = fs.readFileSync(file, 'utf8');
    const { out, removed, fixed } = sanitizeContent(src);
    if (src !== out) {
      changedFiles++;
      totalRemoved += removed;
      totalFixed += fixed;
      log(`${file}: removed=${removed} fixed=${fixed}${write ? ' [written]' : ''}`);
      if (write) fs.writeFileSync(file, out, 'utf8');
    }
  }
}

log(`Summary: files=${totalFiles} changed=${changedFiles} removed=${totalRemoved} fixed=${totalFixed}`);
console.log(`Sanitize report -> ${logFile}`);
if (!write && changedFiles > 0) {
  console.log('Dry-run mode: rerun with --write to apply changes.');
}

