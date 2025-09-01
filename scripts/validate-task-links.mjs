// scripts/validate-task-links.mjs
// Node ≥16, ES Modules
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import addKeywords from 'ajv-keywords';
// Use addFormats to handle the draft 2020-12 schema support

const TASKS = 'tasks/tasks.json';
const SCHEMA = 'tasks/schema.json';
const ADR_DIR = 'docs/adr';
const CH_ALLOW = new Set([
  'CH01',
  'CH02',
  'CH03',
  'CH04',
  'CH05',
  'CH06',
  'CH07',
  'CH08',
  'CH09',
  'CH10',
  'CH11',
  'CH12',
]);
const ALIAS_PATH = 'scripts/prd-aliases.json';

// ---- PRD alias resolver（与上游一致） ----
async function loadAliases(file = ALIAS_PATH) {
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    return [
      {
        canonical: 'PRD-Guild-Manager',
        aliases: [
          'PRD-GM-GUILD-MANAGER',
          'PRD-GUILD-MANAGER',
          'prd-guild-manager',
        ],
        patterns: [
          '(?i)^PRD-GUILD-MANAGER(?:[_-]chunk[_-]?)(\\d+)$',
          '(?i)^PRD-GM-GUILD-MANAGER(?:[_-]chunk[_-]?)(\\d+)$',
        ],
      },
    ];
  }
}
function resolvePrdId(input, defs) {
  if (!input) return { canonical: '', chunk: null, matched: false };
  const s = String(input);
  for (const d of defs) {
    if ((d.aliases || []).some(a => a.toLowerCase() === s.toLowerCase()))
      return { canonical: d.canonical, chunk: null, matched: true };
    for (const p of d.patterns || []) {
      const re = new RegExp(p);
      const m = s.match(re);
      if (m)
        return {
          canonical: d.canonical,
          chunk: m[1] ? Number(m[1]) : null,
          matched: true,
        };
    }
  }
  return { canonical: s, chunk: null, matched: false };
}

const ajv = new Ajv({
  allErrors: true,
  strict: false, // Disable strict mode for compatibility
});
addFormats(ajv);
addKeywords(ajv, ['uniqueItemProperties', 'transform']); // ajv-keywords 扩展。

const schema = JSON.parse(await fs.readFile(SCHEMA, 'utf8'));
const validate = ajv.compile(schema);

const tasks = JSON.parse(await fs.readFile(TASKS, 'utf8'));

// 0) 预归一：别名→规范
const aliases = await loadAliases(ALIAS_PATH);
for (const t of tasks) {
  if (t?.meta?.prdId) {
    const r = resolvePrdId(t.meta.prdId, aliases);
    if (r.canonical) {
      t.meta.prdId = r.canonical;
      if (r.chunk != null) t.meta.prdChunk = r.chunk;
    }
  }
}

// 1) 结构校验（JSON Schema 2020-12）
let ok = true;
if (!validate(tasks)) {
  console.error('❌ schema validation failed:', validate.errors);
  ok = false;
}

// 2) ADR 文件存在性
const adrFiles = new Set(
  (await fs.readdir(ADR_DIR).catch(() => []))
    .filter(n => /^ADR-\d{4}/i.test(n))
    .map(n => n.replace(/\.mdx?$/i, '').toUpperCase())
);
for (const t of tasks) {
  const missingAdr = (t.adrRefs || []).filter(a => {
    const key = String(a || '')
      .toUpperCase()
      .match(/^ADR-\d{4}/)?.[0];
    if (!key) return true;
    for (const f of adrFiles) if (f.startsWith(key)) return false;
    return true;
  });
  if (missingAdr.length) {
    ok = false;
    console.error(`❌ ${t.id}: missing ADR files:`, missingAdr);
  }

  // 3) CH 合法集合
  const badCh = (t.archRefs || []).filter(
    ch => !CH_ALLOW.has(String(ch || '').toUpperCase())
  );
  if (badCh.length) {
    ok = false;
    console.error(`❌ ${t.id}: invalid CH refs:`, badCh);
  }

  // 4) overlay 存在（若填写了）
  if (t.overlay) {
    try {
      await fs.access(t.overlay);
    } catch {
      ok = false;
      console.error(`❌ ${t.id}: overlay not found: ${t.overlay}`);
    }
  }

  // 5) acceptance 引用文件（可选检查）
  for (const a of t.acceptance || []) {
    const m = String(a).match(/See:\s+(.+)$/);
    if (m) {
      try {
        await fs.access(m[1]);
      } catch {
        ok = false;
        console.error(`❌ ${t.id}: acceptance ref not found: ${m[1]}`);
      }
    }
  }
}

if (!ok) process.exit(1);
console.log('✅ task links ok');
