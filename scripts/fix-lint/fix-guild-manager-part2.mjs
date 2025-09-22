import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('tests/e2e/guild-manager-chunk-001.part2.e2e.ts');
let raw = fs.readFileSync(file, 'utf8');

// 0) 清除不可见替换符（�）等常见乱码占位
raw = raw.replace(/\uFFFD/g, '');

const lines = raw.split(/\r?\n/);
const out = [];

// 1) 将同一行中的“注释 + 代码”拆分为两行
//    规则：若出现 // 后仍包含代码token（await/const/let/page./expect 等），按最早代码token断开
const codeTokens = [
  'await ',
  'const ',
  'let ',
  'var ',
  'page.',
  'expect(',
  'return ',
  'if (',
  'while (',
  'switch (',
  'for (',
  'test(',
  'window.',
  'document.',
  'new ',
  ');',
  '.click(',
  '.toBe',
  '.toContain',
  '.locator(',
  'console.log(',
];

function findCommentIndexOutsideStrings(s) {
  let inS = false,
    inD = false,
    inB = false;
  for (let i = 0; i < s.length - 1; i++) {
    const ch = s[i];
    const nx = s[i + 1];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (!inD && !inB && ch === "'") {
      inS = !inS;
      continue;
    }
    if (!inS && !inB && ch === '"') {
      inD = !inD;
      continue;
    }
    if (!inS && !inD && ch === '`') {
      inB = !inB;
      continue;
    }
    if (!inS && !inD && !inB && ch === '/' && nx === '/') return i;
  }
  return -1;
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^(\s*)(.*)$/);
  const indent = m ? m[1] : '';
  let rest = m ? m[2] : line;
  const relIdx = findCommentIndexOutsideStrings(rest);
  if (relIdx >= 0) {
    const before = rest.slice(0, relIdx);
    const tail = rest.slice(relIdx + 2);
    // 若 // 前有代码，先输出这段代码
    if (before.trim().length > 0) {
      out.push(indent + before.trimEnd());
    }
    // 在注释尾部查找代码token
    let minPos = -1;
    for (const tk of codeTokens) {
      const p = tail.indexOf(tk);
      if (p >= 0) {
        if (minPos < 0 || p < minPos) minPos = p;
      }
    }
    if (minPos >= 0) {
      const commentText = tail.slice(0, minPos).trim();
      const codeText = tail.slice(minPos).trim();
      if (commentText) out.push((indent + '// ' + commentText).trimEnd());
      if (codeText) out.push(indent + codeText);
    } else {
      const commentText = tail.trim();
      out.push((indent + '// ' + commentText).trimEnd());
    }
    continue;
  }
  out.push(line);
}

// 2) 修复 data-testid 选择器中误用引号的情况： ..."foo'] -> ..."foo"]
let content = out.join('\n');
content = content
  .replace(/\[data-testid=\\"([^"\]]+)'\]/g, '[data-testid=\\"$1\"]')
  .replace(/\[data-testid="([^"\]]+)'\]/g, '[data-testid="$1\"]');

// 3) 修复被错误拆分的 CloudEvents source: 'gm://e2e-test'
{
  const ls = content.split(/\r?\n/);
  const merged = [];
  for (let i = 0; i < ls.length; i++) {
    const line = ls[i];
    const m = line.match(/^(\s*)source:\s*'gm:\s*$/);
    if (m && i + 1 < ls.length) {
      const next = ls[i + 1];
      const n = next.match(/^\s*\/\/\s*([A-Za-z0-9_\-\/]+)',\s*$/);
      if (n) {
        merged.push(`${m[1]}source: 'gm://${n[1]}',`);
        i++; // skip next line
        continue;
      }
    }
    merged.push(line);
  }
  content = merged.join('\n');
}

// 4) 强制使用 CRLF 行尾
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(file, content, { encoding: 'utf8' });

console.log('fixed');
