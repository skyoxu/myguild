#!/usr/bin/env node
/**
 * Summarize Playwright JSON results and classify failures into P0–P3 buckets.
 * Windows-friendly; outputs to logs/ directory.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const resultsPath = resolve(ROOT, 'test-results', 'test-results.json');
if (!existsSync(resultsPath)) {
  console.error(
    '[e2e-summary] test-results/test-results.json not found. Run npm run test:e2e first.'
  );
  process.exit(2);
}

/** @typedef {{ title:string, location?:{file:string,line:number}, projectName?:string, results:Array<{status:string, error?:{message?:string}}>} } PlaywrightTest */

/** @typedef {{ title:string, file?:string, suites?:any[], specs?:{tests:PlaywrightTest[]}[] }} Suite */

/**
 * Recursively walk Playwright JSON report to collect tests with their results.
 * @param {Suite} suite
 * @param {Array<any>} acc
 */
function walkSuite(suite, acc) {
  if (!suite) return;
  const childSuites = suite.suites || [];
  for (const s of childSuites) walkSuite(s, acc);
  const specs = suite.specs || [];
  for (const spec of specs) {
    const tests = spec.tests || [];
    for (const t of tests) {
      const loc = t.location || { file: suite.file || spec.file, line: 0 };
      for (const r of t.results || []) {
        acc.push({
          suiteTitle: suite.title || suite.file || 'unknown',
          file: (loc && loc.file) || suite.file || 'unknown',
          line: (loc && loc.line) || 0,
          title: t.title,
          project: r.projectName || t.projectName || 'unknown',
          status: r.status,
          error: r.error && (r.error.message || String(r.error)),
        });
      }
    }
  }
}

/**
 * Classify an item into P0–P3 level and category.
 */
function classify(item) {
  const file = String(item.file || '').toLowerCase();
  const suite = String(item.suiteTitle || '').toLowerCase();
  const proj = String(item.project || '').toLowerCase();
  const title = String(item.title || '').toLowerCase();

  const inSecurity =
    file.includes('\\security\\') ||
    file.includes('/security/') ||
    proj.includes('security');
  if (inSecurity)
    return { level: 'P0', category: 'Electron安全基线/导航/权限' };

  const inSmoke =
    file.includes('\\smoke\\') ||
    file.includes('/smoke/') ||
    file.endsWith('perf.smoke.spec.ts');
  if (inSmoke) {
    const isBoot = /(render|启动|可见|protocol|窗口|launch|visible)/.test(
      title
    );
    return isBoot
      ? { level: 'P0', category: '启动与基本渲染' }
      : { level: 'P1', category: '交互P95/轻性能' };
  }

  if (file.includes('scene-transition'))
    return { level: 'P1', category: '场景转换性能' };
  if (file.includes('framerate'))
    return { level: 'P1', category: '帧率稳定性' };
  if (file.includes('\\quality\\') || file.includes('/quality/'))
    return { level: 'P3', category: '质量护栏/框架一致性' };
  if (
    file.includes('guild-manager') ||
    file.includes('vertical-slice') ||
    file.includes('playable')
  )
    return { level: 'P3', category: '领域/可玩度验证' };
  return { level: 'P3', category: '其他' };
}

const raw = readFileSync(resultsPath, 'utf8');
/** @type {{suites: Suite[]}} */
const report = JSON.parse(raw);
const all = [];
for (const s of report.suites || []) walkSuite(s, all);

const failures = all.filter(
  x => x.status && x.status !== 'passed' && x.status !== 'skipped'
);
const skipped = all.filter(x => x.status === 'skipped');
const passed = all.filter(x => x.status === 'passed');

const classified = failures.map(f => ({ ...f, ...classify(f) }));
const buckets = classified.reduce((m, it) => {
  const key = `${it.level}::${it.category}`;
  (m[key] ||= []).push(it);
  return m;
}, {});

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logsDir = resolve(ROOT, 'logs');
try {
  mkdirSync(logsDir, { recursive: true });
} catch {}

writeFileSync(
  resolve(logsDir, `e2e-px-summary-${stamp}.json`),
  JSON.stringify(
    {
      summary: {
        passed: passed.length,
        skipped: skipped.length,
        failures: failures.length,
      },
      buckets,
    },
    null,
    2
  ),
  'utf8'
);

let txt = [];
txt.push('E2E 失败分类（按 P0–P3）');
txt.push(
  `总失败: ${failures.length}  |  通过: ${passed.length}  |  跳过: ${skipped.length}`
);
txt.push('');
for (const key of Object.keys(buckets).sort()) {
  const arr = buckets[key];
  const [level, category] = key.split('::');
  txt.push(`[${level}] ${category} — ${arr.length}`);
  for (const it of arr.slice(0, 12)) {
    txt.push(`- (${it.project}) ${it.file}:${it.line}  ${it.title}`);
    if (it.error) txt.push(`  • ${String(it.error).split('\n')[0]}`);
  }
  txt.push('');
}
writeFileSync(
  resolve(logsDir, `e2e-px-summary-${stamp}.txt`),
  txt.join('\n'),
  'utf8'
);

console.log(`[e2e-summary] 输出: logs/e2e-px-summary-${stamp}.json | .txt`);
console.log(
  '[e2e-summary] 提示：P0=安全/启动，P1=可观测/轻性能，P2=构建/一致性(非E2E)，P3=领域无关/可玩度。'
);
