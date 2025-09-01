// scripts/enrich-tasks.mjs
// Node ≥16, ES Modules
// Usage:
//   node scripts/enrich-tasks.mjs --tasks tasks/tasks.json --overlays docs/architecture/overlays --map scripts/overlay-map.json --aliases scripts/prd-aliases.json --dry-run

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import fg from 'fast-glob';

// ---------- args / constants ----------
const args = parseArgs(process.argv.slice(2));
const TASKS_PATH = args.tasks ?? 'tasks/tasks.json';
const OVERLAY_ROOT = args.overlays ?? 'docs/architecture/overlays';
const MAP_PATH = args.map ?? 'scripts/overlay-map.json';
const ALIAS_PATH = args.aliases ?? 'scripts/prd-aliases.json';
const DRY_RUN = has('--dry-run');

const ACCEPT_FILES = (
  args.accept ?? 'ACCEPTANCE_CHECKLIST.md,Acceptance.md,ACCEPTANCE.md'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// 最小治理集（可用 ENV 覆盖）
const ADRS_MIN = (process.env.MIN_ADRS ?? 'ADR-0002')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const CH_MIN = (process.env.MIN_CH ?? 'CH01,CH03')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ---------- helpers ----------
function parseArgs(av) {
  const out = {};
  for (let i = 0; i < av.length; i++) {
    const a = av[i];
    if (a.startsWith('--'))
      out[a.slice(2)] =
        i + 1 < av.length && !av[i + 1].startsWith('--') ? av[++i] : true;
  }
  return out;
}
function has(flag) {
  return process.argv.includes(flag);
}
const uniq = xs => Array.from(new Set((xs || []).filter(Boolean)));
const asArray = x => (Array.isArray(x) ? x : x ? [x] : []);
const toPosix = p => p.replace(/\\/g, '/');

const normADR = s =>
  (String(s || '')
    .toUpperCase()
    .match(/ADR-\d{4}[A-Z0-9-]*/) || [''])[0];
const normCH = s =>
  (String(s || '')
    .toUpperCase()
    .match(/CH\d{2}/) || [''])[0];

// ---------- PRD alias resolver ----------
async function loadAliases(file = ALIAS_PATH) {
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    // 默认别名表（至少覆盖本 PRD）
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
function resolvePrdId(input, aliasDefs) {
  if (!input) return { canonical: '', chunk: null, matched: false };
  const s = String(input);
  for (const def of aliasDefs) {
    if ((def.aliases || []).some(a => a.toLowerCase() === s.toLowerCase()))
      return { canonical: def.canonical, chunk: null, matched: true };
    for (const p of def.patterns || []) {
      const re = new RegExp(p);
      const m = s.match(re);
      if (m)
        return {
          canonical: def.canonical,
          chunk: m[1] ? Number(m[1]) : null,
          matched: true,
        };
    }
  }
  return { canonical: s, chunk: null, matched: false };
}

// ---------- 1) load tasks ----------
const rawTasks = JSON.parse(
  await fs.readFile(TASKS_PATH, 'utf8').catch(() => '[]')
);
const tasks = Array.isArray(rawTasks)
  ? rawTasks
  : rawTasks && typeof rawTasks === 'object'
    ? (console.warn('ℹ️ tasks.json 是对象，已转为数组'),
      Object.values(rawTasks))
    : [];
if (!tasks.length) console.warn('⚠️ 没有任务可处理。');

// ---------- 2) load overlay-map (optional) ----------
const mapKeywords = new Map(); // kw -> overlay abs path
const mapFiles = new Map(); // overlay abs -> { frontMatter, prdId, accept? }

try {
  const text = await fs.readFile(MAP_PATH, 'utf8');
  const mp = JSON.parse(text);
  if (mp?.keywords && typeof mp.keywords === 'object') {
    for (const [k, v] of Object.entries(mp.keywords)) {
      const p = typeof v === 'string' ? v : v?.path;
      if (p) mapKeywords.set(k.toLowerCase(), path.resolve(p));
    }
  } else {
    for (const [k, v] of Object.entries(mp || {})) {
      if (typeof v === 'string')
        mapKeywords.set(k.toLowerCase(), path.resolve(v));
    }
  }
  if (mp?.files && typeof mp.files === 'object') {
    for (const [p, meta] of Object.entries(mp.files)) {
      mapFiles.set(path.resolve(p), {
        frontMatter: meta?.frontMatter || {},
        prdId: meta?.prdId || '',
        accept: meta?.accept,
      });
    }
  }
} catch {
  /* optional */
}

// ---------- 3) scan overlays ----------
const overlayMdPaths = await fg([toPosix(path.join(OVERLAY_ROOT, '**/*.md'))], {
  dot: true,
});
const overlayIndex = new Map(); // abs md -> { adrs, chs, acceptancePath, prdId }

const aliases = await loadAliases(ALIAS_PATH);

for (const md of overlayMdPaths) {
  const abs = path.resolve(md);
  const content = await fs.readFile(abs, 'utf8');
  const fm = matter(content).data || {}; // gray-matter 解析 Front-matter（YAML/JSON/TOML） :contentReference[oaicite:4]{index=4}

  const adrs = uniq(asArray(fm.ADRs).map(normADR));
  const chs = uniq(asArray(fm['Arch-Refs'] ?? fm.ArchRefs).map(normCH));

  // acceptance in same dir
  const dir = path.dirname(abs);
  let acceptancePath = '';
  for (const cand of ACCEPT_FILES) {
    try {
      await fs.access(path.join(dir, cand));
      acceptancePath = path.join(dir, cand);
      break;
    } catch {}
  }

  // PRD-ID：FM 优先，其次 overlay-map.files
  const r1 = resolvePrdId(fm['PRD-ID'] ?? fm['prd-id'] ?? '', aliases);
  const r2 = resolvePrdId(mapFiles.get(abs)?.prdId ?? '', aliases);
  const prdId = r1.matched
    ? r1.canonical
    : r2.matched
      ? r2.canonical
      : r1.canonical || r2.canonical;

  overlayIndex.set(abs, { adrs, chs, acceptancePath, prdId });
}

// ---------- 4) pick overlay for a task ----------
function pickOverlayForTask(t) {
  if (t.overlay) {
    const abs = path.resolve(String(t.overlay));
    if (overlayIndex.has(abs)) return abs;
  }
  const title = String(t.title || '').toLowerCase();
  const labels = (t.labels || []).map(x => String(x).toLowerCase());

  for (const [kw, abs] of mapKeywords.entries()) {
    if (title.includes(kw) || labels.some(l => l.includes(kw))) {
      if (overlayIndex.has(abs)) return abs;
    }
  }
  // fuzzy via path tokens
  for (const abs of overlayIndex.keys()) {
    const tokens = toPosix(abs)
      .split('/')
      .slice(-4)
      .map(s => s.toLowerCase());
    if (
      tokens.some(
        tok =>
          tok.length >= 3 &&
          (title.includes(tok) || labels.some(l => l.includes(tok)))
      )
    )
      return abs;
  }
  return '';
}

// ---------- 5) enrich ----------
let changed = 0,
  noOverlay = 0;
for (const t of tasks) {
  const before = JSON.stringify(t);

  const ovAbs = pickOverlayForTask(t);
  if (ovAbs) t.overlay = toPosix(path.relative(process.cwd(), ovAbs));
  else noOverlay++;

  const meta = ovAbs ? overlayIndex.get(ovAbs) : undefined;

  t.adrRefs = uniq([
    ...asArray(t.adrRefs).map(normADR),
    ...(meta?.adrs || []),
    ...ADRS_MIN.map(normADR),
  ]);
  t.archRefs = uniq([
    ...asArray(t.archRefs).map(normCH),
    ...(meta?.chs || []),
    ...CH_MIN.map(normCH),
  ]);

  if (meta?.acceptancePath) {
    const rel = toPosix(path.relative(process.cwd(), meta.acceptancePath));
    const marker = `See: ${rel}`;
    t.acceptance = uniq([...asArray(t.acceptance), marker]);
  }

  // 解析/回写 PRD-ID（规范 + 分片号）
  if (meta?.prdId) {
    const r = resolvePrdId(meta.prdId, aliases);
    if (r.canonical) {
      t.meta = { ...(t.meta || {}), prdId: r.canonical };
      if (r.chunk != null) t.meta.prdChunk = r.chunk;
    }
  }

  if (JSON.stringify(t) !== before) changed++;
}

// ---------- 6) write / dry-run ----------
await fs.mkdir(path.dirname(TASKS_PATH), { recursive: true });
if (!DRY_RUN) {
  await fs.writeFile(TASKS_PATH, JSON.stringify(tasks, null, 2), 'utf8');
  console.log(
    `✅ enriched ${changed}/${tasks.length} tasks; overlay unresolved: ${noOverlay}.`
  );
} else {
  console.log(
    `🧪 dry-run: would update ${changed}/${tasks.length}; overlay unresolved: ${noOverlay}.`
  );
}
