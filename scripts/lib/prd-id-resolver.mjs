import fs from 'node:fs/promises';

export async function loadAliases(path = 'scripts/prd-aliases.json') {
  const raw = JSON.parse(await fs.readFile(path, 'utf8'));
  return Array.isArray(raw) ? raw : [raw];
}

export function resolvePrdId(input, aliasDefs) {
  if (!input) return { canonical: '', chunk: null, matched: false };

  const s = String(input);
  for (const def of aliasDefs) {
    // 1) 直接命中 aliases（忽略大小写）
    if ((def.aliases || []).some(a => a.toLowerCase() === s.toLowerCase())) {
      return { canonical: def.canonical, chunk: null, matched: true };
    }
    // 2) 命中 patterns（提取 chunk）
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

  // 3) 兜底：做一次 slug/清洗，然后与 canonical 比较（可选）
  return { canonical: s, chunk: null, matched: false };
}
