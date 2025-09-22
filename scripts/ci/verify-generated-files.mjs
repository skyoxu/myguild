#!/usr/bin/env node
import fs from 'node:fs';
function dir(p) {
  try {
    console.log(fs.readdirSync(p).join('\n'));
  } catch {
    console.log(`(missing) ${p}`);
  }
}
dir('dist');
dir('src/generated');
try {
  if (fs.existsSync('src/generated/config.ts')) {
    const s = fs
      .readFileSync('src/generated/config.ts', 'utf8')
      .split(/\r?\n/)
      .slice(0, 20)
      .join('\n');
    console.log(s);
  }
} catch {}
