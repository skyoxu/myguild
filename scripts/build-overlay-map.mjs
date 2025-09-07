// scripts/build-overlay-map.mjs
// Node ≥16, ES Modules
// Usage: node scripts/build-overlay-map.mjs --overlays docs/architecture/overlays --out scripts/overlay-map.json --aliases scripts/prd-aliases.json

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import fg from 'fast-glob';
import stringify from 'json-stringify-pretty-compact';
import stable from 'json-stable-stringify'; // 确定性序列化（键按字典序）

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--'))
      acc.push([
        cur.slice(2),
        arr[i + 1]?.startsWith('--') ? true : arr[i + 1],
      ]);
    return acc;
  }, [])
);
const OVERLAYS = args.overlays || 'docs/architecture/overlays';
const OUT = args.out || 'scripts/overlay-map.json';
const ALIAS = args.aliases || 'scripts/prd-aliases.json';

const mdFiles = await fg([`${OVERLAYS.replace(/\\/g, '/')}/**/08/**/*.md`], {
  dot: true,
});

// ---- alias resolver (与 enrich 同步) ----
async function loadAliases(file = ALIAS) {
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
const aliases = await loadAliases(ALIAS);

// ---- build maps ----
const keywords = {}; // kw -> { path }
const files = {}; // path -> { frontMatter, prdId, accept }

// 扩展停用词表，增加低信号词防止误命中
const stop = new Set([
  // 英文通用词
  'the',
  'a',
  'an',
  'of',
  'to',
  'for',
  'and',
  'with',
  'by',
  'on',
  'in',
  'at',
  'from',
  // 中文通用词
  '功能',
  '模块',
  '管理',
  '管理器',
  '系统',
  '开发',
  '实现',
  '构建',
  // 文件名/数字类（低信号）
  '08',
  'overlays',
  'md',
  'task',
  'tasks',
  'acceptance',
  'checklist',
  // 通用技术词（容易误命中）
  'member',
  '成员',
  'data',
  '数据',
  'report',
  '报告',
  'api',
  'interface',
]);

function tokens(s = '') {
  return String(s)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s_-]+/)
    .filter(Boolean);
}
function addKw(k, p) {
  const key = String(k).toLowerCase();
  if (!key || key.length < 2 || stop.has(key)) return;
  // 使用相对POSIX路径
  const relativePath = path
    .relative(process.cwd(), path.resolve(p))
    .replace(/\\/g, '/');
  if (!keywords[key]) keywords[key] = { path: relativePath };
}

for (const file of mdFiles) {
  const abs = path.resolve(file);
  const rel = path.relative(process.cwd(), abs).replace(/\\/g, '/'); // 使用相对POSIX路径
  const fm = matter(await fs.readFile(abs, 'utf8')).data || {}; // gray-matter 解析 FM :contentReference[oaicite:5]{index=5}

  const fmOut = {
    ADRs: fm.ADRs || [],
    'Arch-Refs': fm['Arch-Refs'] || fm.ArchRefs || [],
    'PRD-ID': fm['PRD-ID'] || fm['prd-id'] || '',
  };

  // 解析规范 PRD-ID
  const r = resolvePrdId(fmOut['PRD-ID'], aliases);
  const prdId = r.canonical || fmOut['PRD-ID'];

  // 目录关键词 & FM 关键词
  const title = fm.title || fm.Title || ''; // 支持 title 和 Title 两种格式
  const kw = new Set([
    ...tokens(title),
    ...tokens(
      [...(fm.keywords || []), ...(fm.tags || []), ...(fm.aliases || [])].join(
        ' '
      )
    ),
    ...rel.toLowerCase().split('/').slice(-4), // 最近目录名
  ]);
  // 仅保留强领域关键词，避免通用词误命中
  for (const k of kw) {
    if (k.length >= 3 && !stop.has(k.toLowerCase())) addKw(k, rel);
  }
  if (title.toLowerCase().includes('guild')) {
    addKw('guild', rel);
    addKw('公会', rel);
  }
  if (title.includes('公会')) {
    addKw('guild', rel);
    addKw('公会', rel);
    addKw('guild-manager', rel);
    // 公会管理相关功能关键词
    addKw('成员', rel);
    addKw('member', rel);
    addKw('财务', rel);
    addKw('finance', rel);
    addKw('任务', rel);
    addKw('task', rel);
    addKw('权限', rel);
    addKw('permission', rel);
    addKw('角色', rel);
    addKw('role', rel);

    // 管理层级关键词
    addKw('会长', rel);
    addKw('guild-leader', rel);
    addKw('副会长', rel);
    addKw('vice-leader', rel);
    addKw('长老', rel);
    addKw('elder', rel);
    addKw('管理员', rel);
    addKw('admin', rel);
    addKw('普通成员', rel);
    addKw('regular-member', rel);

    // 管理功能关键词
    addKw('招募', rel);
    addKw('recruit', rel);
    addKw('审批', rel);
    addKw('approve', rel);
    addKw('踢出', rel);
    addKw('kick', rel);
    addKw('升职', rel);
    addKw('promote', rel);
    addKw('降职', rel);
    addKw('demote', rel);
    addKw('邀请', rel);
    addKw('invite', rel);

    // 业务流程关键词
    addKw('申请', rel);
    addKw('apply', rel);
    addKw('退会', rel);
    addKw('leave', rel);
    addKw('转让', rel);
    addKw('transfer', rel);
    addKw('合并', rel);
    addKw('merge', rel);
    addKw('解散', rel);
    addKw('disband', rel);
    addKw('创建', rel);
    addKw('create', rel);

    // 数据指标关键词
    addKw('活跃度', rel);
    addKw('activity', rel);
    addKw('贡献值', rel);
    addKw('contribution', rel);
    addKw('排行榜', rel);
    addKw('ranking', rel);
    addKw('历史', rel);
    addKw('history', rel);
    addKw('统计', rel);
    addKw('stats', rel);

    // 系统功能关键词
    addKw('dashboard', rel);
    addKw('仪表板', rel);
    addKw('报告', rel);
    addKw('report', rel);
    addKw('搜索', rel);
    addKw('search', rel);
    addKw('筛选', rel);
    addKw('filter', rel);
  }

  // 查找验收清单
  let accept = '';
  for (const cand of [
    'ACCEPTANCE_CHECKLIST.md',
    'Acceptance.md',
    'ACCEPTANCE.md',
  ]) {
    try {
      await fs.access(path.join(path.dirname(abs), cand));
      accept = path
        .relative(process.cwd(), path.join(path.dirname(abs), cand))
        .replace(/\\/g, '/');
      break;
    } catch {}
  }

  // 解析段落锚点（用于精确追溯）
  const content = await fs.readFile(abs, 'utf8');
  const anchors = {};
  const anchorPatterns = [
    { key: 'ui', pattern: /##\s*8\.2\s*UI层?设计|##\s*[Uu][Ii]层?设计/m },
    { key: 'events', pattern: /##\s*8\.3\s*事件系统设计|##\s*事件系统?设计/m },
    { key: 'domain', pattern: /##\s*8\.4\s*领域模型设计|##\s*领域模型?设计/m },
    {
      key: 'persistence',
      pattern: /##\s*8\.5\s*持久化层设计|##\s*持久化层?设计/m,
    },
    { key: 'acceptance', pattern: /##\s*8\.7\s*验收标准|##\s*验收标准?/m },
  ];

  for (const { key, pattern } of anchorPatterns) {
    const match = content.match(pattern);
    if (match) anchors[key] = match[0].trim();
  }

  files[rel] = { frontMatter: fmOut, prdId, accept, anchors };
}

// 递归"排序"对象键（顶层按指定顺序，其它按字典序）
function sortKeys(x, topLevel = false) {
  if (Array.isArray(x)) return x.map(v => sortKeys(v));
  if (x && typeof x === 'object') {
    const order = topLevel ? ['metadata', 'keywords', 'files'] : []; // 固定顶层顺序
    const keys = Object.keys(x).sort((a, b) => {
      const ia = order.indexOf(a),
        ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 1 : ia) - (ib === -1 ? 1 : ib);
      return a < b ? -1 : a > b ? 1 : 0; // 使用代码点序，避免locale依赖
    });
    const o = {};
    for (const k of keys) o[k] = sortKeys(x[k]);
    return o;
  }
  return x;
}

// 读取旧文件（若存在）
let old = null;
try {
  const oldData = await fs.readFile(OUT, 'utf8');
  old = JSON.parse(oldData);
} catch {
  // 文件不存在或解析失败，继续使用新数据
}

// 1) 先规范化"语义内容"（排除 metadata 可变字段）
const semantic = sortKeys({ keywords, files }, true);

// 2) 稳定哈希（与键顺序无关，用确定性序列化）
const contentHash = crypto
  .createHash('sha256')
  .update(stable(semantic)) // 关键：用 json-stable-stringify
  .digest('hex');

// 3) metadata：只有内容变更时才刷新 generatedAt
const prevHash = old?.metadata?.contentHash;
const generatedAt =
  prevHash === contentHash
    ? old.metadata.generatedAt
    : new Date().toISOString();

// 4) 合成最终对象（再次规范化，确保顶层顺序一致）
const finalObj = sortKeys(
  { metadata: { contentHash, generatedAt }, ...semantic },
  true
);

// 5) 紧凑稳定输出（行宽120）
const json = stringify(finalObj, { indent: 2, maxLength: 120 }) + '\n';

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, json, 'utf8');
console.log(
  `✅ overlay-map written: ${OUT} (files=${Object.keys(files).length}, keywords=${Object.keys(keywords).length}, hash=${contentHash.slice(0, 8)})`
);
