#!/usr/bin/env node
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { join, basename } from 'node:path';

const root = '.github/workflows';

function list(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...list(p));
    else if (/\.ya?ml$/i.test(n)) out.push(p);
  }
  return out;
}

function sanitizeEchoText(s) {
  return s.replace(/[\u0100-\uFFFF]+/g, '');
}

function fixNameLine(file, line) {
  const map = {
    'release-monitor.yml': 'name: Release Monitor - 发布监控',
    'release-prepare.yml': 'name: Release Preparation - 发布准备',
    'release-ramp.yml': 'name: Release Ramp - 渐进发布与自动回滚',
    'pr-gatekeeper.yml': 'name: PR Status Gatekeeper - Windows CI',
  };
  const key = basename(file);
  if (map[key]) return map[key];
  return line;
}

function run() {
  const files = list(root);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  mkdirSync(join('logs', ymd, 'workflows'), { recursive: true });
  const log = [];

  for (const f of files) {
    const raw = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const lines = raw.split('\n');
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // Fix top-level name line with mojibake
      if (/^name:\s/.test(line) && /[\u0100-\uFFFF]/.test(line)) {
        const fixed = fixNameLine(f, line);
        if (fixed !== line) {
          lines[i] = fixed;
          changed = true;
          continue;
        }
      }
      // Clean comment lines (only text, keep '# ' prefix)
      if (/^\s*#/.test(line) && /[\u0100-\uFFFF]/.test(line)) {
        const m = line.match(/^(\s*#\s*)(.*)$/);
        if (m) {
          const clean = sanitizeEchoText(m[2]);
          lines[i] = m[1] + clean;
          changed = true;
          continue;
        }
      }
      // Clean echo/Write-Host/Add-Content/curl JSON free-text (keep logic)
      if (
        /\becho\b|Write-Host|Add-Content/.test(line) &&
        /[\u0100-\uFFFF]/.test(line)
      ) {
        lines[i] = sanitizeEchoText(line);
        changed = true;
        continue;
      }
    }
    if (changed) {
      writeFileSync(f, lines.join('\n'), 'utf8');
      log.push(`cleaned: ${f}`);
    }
  }
  writeFileSync(
    join('logs', ymd, 'workflows', 'cleanup-i18n.log'),
    log.join('\n') || 'no changes',
    'utf8'
  );
  console.log(`workflow cleanup done. files changed: ${log.length}`);
}

run();
