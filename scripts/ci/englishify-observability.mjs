#!/usr/bin/env node
// Englishify comments and log/description strings in observability modules.
// - Scope: src/shared/observability/**/*.{ts,tsx}
// - Strategy: dictionary replacements first; then strip remaining non‑ASCII chars
// - Output report: logs/ci/<date>/englishify-report.json

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src', 'shared', 'observability');

const dict = new Map([
  // Headings & sections
  ['��Ϸָ�����Ͷ���', 'Game metric definition'],
  ['Ԥ�������Ϸָ��', 'Predefined game metrics'],
  ['�ؿ��������ָ��', 'Level-related metrics'],
  ['ս�����ָ��', 'Battle metrics'],
  ['UI�������ָ��', 'UI metrics'],
  ['��Դ�������ָ��', 'Resource metrics'],
  ['��Ϸ�Ự���ָ��', 'Session metrics'],
  ['�������ָ��', 'Reliability'],

  // Metric descriptions
  ['�ؿ�����ʱ��', 'Level loading time'],
  ['�ؿ����سɹ�����', 'Level load success count'],
  ['�ؿ�����ʧ�ܴ���', 'Level load failure count'],
  ['ս���غϺ�ʱ', 'Battle round duration'],
  ['AI���ߺ�ʱ', 'AI decision latency'],
  ['ս����ɴ���', 'Battle completion count'],
  ['UI��Ⱦ��ʱ', 'UI render time'],
  ['UI������Ӧ�ӳ�', 'UI interaction delay'],
  ['��Դ����ʱ��', 'Asset load time'],
  ['�ڴ�ʹ����', 'Memory usage'],
  ['��Ϸ�Ựʱ��', 'Session duration'],
  ['�浵������ʱ', 'Save operation time'],
  ['��Ϸ�������', 'Game error count'],

  // Gatekeeper text (observability-gatekeeper)
  ['�ɹ۲����Ž�������', 'Observability gatekeeper'],
  ['�Ž����������', 'Gate result structure'],
  ['�Ž�����', 'Gate issue'],
  ['ϵͳ��Ϣ', 'System info'],
  ['�Ž�ѡ��', 'Gatekeeper options'],
  ['�ϸ�ģʽ', 'strict mode'],
  ['�ɹ۲����Ž���������', 'Observability gatekeeper implementation'],
  ['ִ�������Ŀɹ۲����Ž����', 'Run full observability gate checks'],
  ['��ʼ�ɹ۲����Ž����', 'Start observability gate checks'],
  ['����', 'Environment'],
  ['����ִ�з�ʽ', 'Choose execution mode'],
  ['������������Ž�����', 'Analyze results and produce gate decision'],
  ['�Ž������ɣ��ܷ�', 'Gate finished, score'],
  ['�Ž����ʧ��', 'Gate execution failed'],
  ['ִ��ʧ��', 'execution failed'],
  ['�޷�ȷ���ɹ۲���ϵͳ��������', 'Cannot verify observability system readiness'],
  ['����ִ�м��', 'Run parallel checks'],
  ['����ִ�����м��', 'Running parallel checks'],
  ['���ɽ���', 'Generate recommendations'],
  ['����ժҪ', 'Generate summary'],
  ['�Ž����', 'Gate result'],
  ['��鳬ʱ', 'check timed out'],
]);

function englishifyText(text) {
  let out = text;
  for (const [from, to] of dict.entries()) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  // Replace common garbled emojis/symbols like '?? '
  out = out.replace(/\?\?\s*/g, '');
  // Remove remaining non‑ASCII chars in comments and string literals conservatively
  out = out.replace(/(\/\/.*|\/\*[\s\S]*?\*\/|(['"]).*?\2)/g, m =>
    m.replace(/[\u0100-\uFFFF]/g, '')
  );
  return out;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) targets.push(p);
  }
}

const targets = [];
if (fs.existsSync(SRC_DIR)) walk(SRC_DIR);

function fixGameMetrics(file, text) {
  if (!file.endsWith('game-metrics.ts')) return text;
  const descMap = new Map([
    ['level.load.ms', 'Level loading time'],
    ['level.load.success', 'Level load success count'],
    ['level.load.failure', 'Level load failure count'],
    ['battle.round.ms', 'Battle round duration'],
    ['battle.decision.ms', 'AI decision latency'],
    ['battle.completed', 'Battle completion count'],
    ['ui.render.ms', 'UI render time'],
    ['ui.interaction.delay.ms', 'UI interaction delay'],
    ['asset.load.ms', 'Asset load time'],
    ['memory.usage.mb', 'Memory usage'],
    ['session.duration.min', 'Session duration'],
    ['save.operation.ms', 'Save operation time'],
    ['game.error.count', 'Game error count'],
  ]);
  let out = text;
  // Line-oriented safe replacement for description fields
  const lines = out.split(/\r?\n/);
  let pendingMetric = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameMatch = line.match(/name:\s*'([^']+)'/);
    if (nameMatch) {
      const metric = nameMatch[1];
      if (descMap.has(metric)) pendingMetric = metric;
      else pendingMetric = null;
      continue;
    }
    if (pendingMetric && /description:\s*'[^']*'/.test(line)) {
      const desc = descMap.get(pendingMetric);
      lines[i] = line.replace(
        /description:\s*'[^']*'/,
        `description: '${desc}'`
      );
      pendingMetric = null;
    }
  }
  out = lines.join('\n');
  // Summary breadcrumb + logs
  out = out
    .replace(
      /Sentry\.addBreadcrumb\(\{\s*message:\s*''/m,
      "Sentry.addBreadcrumb({ message: 'game.metrics.summary'"
    )
    .replace(
      /console\.log\('\s*',\s*\{/m,
      "console.log('[game-metrics] summary emitted', {"
    )
    .replace(
      /console\.warn\('\s*:\s*',\s*error\.message\);/m,
      "console.warn('[game-metrics] summary emission failed:', (error)?.message ?? error);"
    );
  // Leading blank // above interface -> meaningful comment
  out = out.replace(
    /(\n)\/\/\s*\nexport interface GameMetricDefinition/,
    '$1// Game metric definition\nexport interface GameMetricDefinition'
  );
  // First comment above GAME_METRICS
  out = out.replace(
    /(\n)\/\/\s*\nexport const GAME_METRICS:/,
    '$1// Predefined game metrics\nexport const GAME_METRICS:'
  );
  // Comment above LEVEL_LOAD_TIME block
  out = out.replace(
    /(\n)\/\/\s*\n\s*LEVEL_LOAD_TIME:/,
    '$1// Level-related metrics\n  LEVEL_LOAD_TIME:'
  );
  return out;
}

function fixGatekeeper(file, text) {
  if (!file.endsWith('observability-gatekeeper.ts')) return text;
  let out = text;
  const lines = out.split(/\r?\n/);

  // 1) Top-of-file doc block
  if (lines[0]?.startsWith('/**')) {
    const end = lines.findIndex((l, i) => i > 0 && l.includes('*/'));
    if (end > 0) {
      lines.splice(
        0,
        end + 1,
        '/**',
        ' * Observability gatekeeper',
        ' *',
        ' * Runs a unified set of observability checks and produces a gate decision.',
        ' */'
      );
    }
  }

  const replaceLogAfter = (startIdx, message) => {
    for (let i = startIdx; i < lines.length; i++) {
      if (lines[i].includes("this.log(' ...');")) {
        const indent = lines[i].match(/^\s*/)?.[0] ?? '';
        lines[i] = `${indent}this.log('${message}');`;
        return i;
      }
      if (lines[i].includes('{') && lines[i].includes('}')) break;
    }
    return -1;
  };

  const idxRunFull = lines.findIndex(l =>
    l.includes('async runFullGateCheck(')
  );
  if (idxRunFull >= 0) {
    replaceLogAfter(idxRunFull, '[gate] Starting observability gate checks...');
    // environment/strictMode line
    const envIdx = lines.findIndex(
      (l, i) => i > idxRunFull && l.includes('${this.options.environment}')
    );
    if (envIdx > 0) {
      const indent = lines[envIdx - 1].match(/^\s*/)?.[0] ?? '    ';
      lines[envIdx - 1] =
        indent +
        'this.log(`[gate] environment=${this.options.environment} strictMode=${this.options.strictMode}`);';
      // clear continued lines if they belong to the old multi-line template
      if (
        lines[envIdx].trim().startsWith('`') &&
        lines[envIdx + 1]?.trim() === ');'
      ) {
        lines[envIdx] = '';
        lines[envIdx + 1] = '';
      }
    }
    // finished message with score/decision
    const finIdx = lines.findIndex(
      (l, i) => i > idxRunFull && l.includes('result.overall.score')
    );
    if (finIdx > 0) {
      const indent = lines[finIdx - 1].match(/^\s*/)?.[0] ?? '    ';
      lines[finIdx - 1] =
        indent +
        'this.log(`[gate] finished: score=${result.overall.score} decision=${result.overall.recommendation}`);';
      if (lines[finIdx].trim().startsWith(')')) lines[finIdx] = '';
    }
    // failure message inside catch
    const catchIdx = lines.findIndex(
      (l, i) => i > idxRunFull && l.includes('catch (error)')
    );
    if (catchIdx > 0) {
      const failLogIdx = lines.findIndex(
        (l, i) => i > catchIdx && l.includes('this.log(')
      );
      if (failLogIdx > 0) {
        const indent = lines[failLogIdx].match(/^\s*/)?.[0] ?? '    ';
        lines[failLogIdx] =
          indent + 'this.log(`[gate] failed: ${String(error)}`);';
      }
      // issue block standardization
      const issueIdx = lines.findIndex(
        (l, i) => i > catchIdx && l.includes('result.gate.p0Issues.push({')
      );
      if (issueIdx > 0) {
        const setField = (key, value) => {
          const kIdx = lines.findIndex(
            (l, i) => i > issueIdx && l.trim().startsWith(`${key}:`)
          );
          if (kIdx > 0) lines[kIdx] = lines[kIdx].replace(/:.*/, `: ${value},`);
        };
        setField('title', `'Gate check execution failed'`);
        setField(
          'description',
          '`Gatekeeper threw during execution: ${String(error)}`'
        );
        setField('impact', `'Cannot assert observability readiness'`);
        setField('recommendation', `'Fix gatekeeper script errors and rerun'`);
      }
    }
  }

  const idxPar = lines.findIndex(l =>
    l.includes('private async runParallelChecks(')
  );
  if (idxPar >= 0) {
    replaceLogAfter(idxPar, '[gate] running checks in parallel...');
    // else branch failure log + issue fields
    const elseFailIdx = lines.findIndex(
      (l, i) => i > idxPar && l.includes('checkResult.reason')
    );
    if (elseFailIdx > 0) {
      const logIdx = lines.findIndex(
        (l, i) =>
          i >= elseFailIdx - 5 &&
          i <= elseFailIdx + 1 &&
          l.includes('this.log(')
      );
      if (logIdx > 0) {
        const indent = lines[logIdx].match(/^\s*/)?.[0] ?? '    ';
        lines[logIdx] =
          indent +
          'this.log(`[gate] ${checkName} check failed: ${checkResult.reason}`);';
      }
      const titleIdx = lines.findIndex(
        (l, i) => i > elseFailIdx && l.trim().startsWith('title:')
      );
      if (titleIdx > 0)
        lines[titleIdx] = lines[titleIdx].replace(
          /:.*/,
          ': `${checkName} check failed`,'
        );
      const descIdx = lines.findIndex(
        (l, i) => i > elseFailIdx && l.trim().startsWith('description:')
      );
      if (descIdx > 0)
        lines[descIdx] = lines[descIdx].replace(
          /:.*/,
          ': `Failed to execute ${checkName} check: ${checkResult.reason}`,'
        );
      const impactIdx = lines.findIndex(
        (l, i) => i > elseFailIdx && l.trim().startsWith('impact:')
      );
      if (impactIdx > 0)
        lines[impactIdx] = lines[impactIdx].replace(
          /:.*/,
          `: 'Cannot verify observability guarantees for this area',`
        );
      const recIdx = lines.findIndex(
        (l, i) => i > elseFailIdx && l.trim().startsWith('recommendation:')
      );
      if (recIdx > 0)
        lines[recIdx] = lines[recIdx].replace(
          /:.*/,
          ': `Fix ${checkName} configuration or implementation`,'
        );
    }
  }

  const idxSeq = lines.findIndex(l =>
    l.includes('private async runSequentialChecks(')
  );
  if (idxSeq >= 0) {
    replaceLogAfter(idxSeq, '[gate] running checks sequentially...');
    const afterDur = (token, msg) => {
      const dIdx = lines.findIndex(l =>
        l.includes(`result.metrics.checkDurations.${token} = duration`)
      );
      if (dIdx > 0 && lines[dIdx + 1]?.includes('this.log(')) {
        const indent = lines[dIdx + 1].match(/^\s*/)?.[0] ?? '      ';
        lines[dIdx + 1] =
          indent + 'this.log(`[gate] ' + msg + ' (${duration}ms)`);';
      }
    };
    afterDur('sentryRenderer', 'sentryRenderer check completed');
    afterDur('sentryMain', 'sentryMain check completed');
    afterDur('configValidation', 'configValidation check completed');
    afterDur('loggingHealth', 'loggingHealth check completed');
    // skipped long running
    const skipIdx = lines.findIndex(
      (l, i) => i > idxSeq && l.includes("this.log('  ');")
    );
    if (skipIdx > 0)
      lines[skipIdx] = lines[skipIdx].replace(
        "this.log('  ');",
        "this.log('[gate] skipped long-running checks');"
      );
  }

  const idxAnalyze = lines.findIndex(l =>
    l.includes('private async analyzeResults(')
  );
  if (idxAnalyze >= 0) {
    replaceLogAfter(idxAnalyze, '[gate] analyzing check results...');
  }

  // Recommendations section
  const idxRec = lines.findIndex(l =>
    l.includes('private generateRecommendations(')
  );
  if (idxRec >= 0) {
    // outcome guidance
    const blockLine = lines.findIndex(
      (l, i) => i > idxRec && l.includes("case 'block':")
    );
    if (blockLine > 0) {
      const p1 = lines.findIndex(
        (l, i) => i > blockLine && l.trim().startsWith('recommendations.push(')
      );
      if (p1 > 0) {
        lines[p1] =
          "        recommendations.push('Fix Critical issues before proceeding.');";
        const p2 = p1 + 1;
        if (lines[p2]?.trim().startsWith('recommendations.push('))
          lines[p2] =
            "        recommendations.push('Prioritize P0 issues; they directly impact observability guarantees.');";
      }
    }
    const warnLine = lines.findIndex(
      (l, i) => i > idxRec && l.includes("case 'warning':")
    );
    if (warnLine > 0) {
      const p1 = lines.findIndex(
        (l, i) => i > warnLine && l.trim().startsWith('recommendations.push(')
      );
      if (p1 > 0) {
        lines[p1] =
          "        recommendations.push('Resolve all P1 issues in next iteration.');";
        const p2 = p1 + 1;
        if (lines[p2]?.trim().startsWith('recommendations.push('))
          lines[p2] =
            "        recommendations.push('Proceed with caution and monitor impact.');";
      }
    }
    const procLine = lines.findIndex(
      (l, i) => i > idxRec && l.includes("case 'proceed':")
    );
    if (procLine > 0) {
      const p1 = lines.findIndex(
        (l, i) => i > procLine && l.trim().startsWith('recommendations.push(')
      );
      if (p1 > 0) {
        lines[p1] = "        recommendations.push('Gate passed; proceed.');";
        const p2 = p1 + 1;
        if (lines[p2]?.trim().startsWith('recommendations.push('))
          lines[p2] =
            "        recommendations.push('Schedule routine improvements to maintain reliability.');";
      }
    }
    // environment
    const prodLine = lines.findIndex(
      (l, i) =>
        i > idxRec && l.includes("this.options.environment === 'production'")
    );
    if (prodLine > 0) {
      const pushIdx = lines.findIndex(
        (l, i) => i > prodLine && l.trim().startsWith('recommendations.push(')
      );
      if (pushIdx > 0)
        lines[pushIdx] =
          "      recommendations.push('Enable detailed monitoring/alerting and verify rollout gates.');";
    }
    const devLine = lines.findIndex(
      (l, i) =>
        i > idxRec && l.includes("this.options.environment === 'development'")
    );
    if (devLine > 0) {
      const pushIdx = lines.findIndex(
        (l, i) => i > devLine && l.trim().startsWith('recommendations.push(')
      );
      if (pushIdx > 0)
        lines[pushIdx] =
          "      recommendations.push('Enable verbose logging to aid debugging.');";
    }
    // score based
    const scoreLt60 = lines.findIndex(
      (l, i) => i > idxRec && l.includes('result.overall.score < 60')
    );
    if (scoreLt60 > 0) {
      const pushIdx = lines.findIndex(
        (l, i) => i > scoreLt60 && l.trim().startsWith('recommendations.push(')
      );
      if (pushIdx > 0)
        lines[pushIdx] =
          "      recommendations.push('Low observability score; perform comprehensive improvements.');";
    }
    const scoreLt80 = lines.findIndex(
      (l, i) => i > idxRec && l.includes('result.overall.score < 80')
    );
    if (scoreLt80 > 0) {
      const pushIdx = lines.findIndex(
        (l, i) => i > scoreLt80 && l.trim().startsWith('recommendations.push(')
      );
      if (pushIdx > 0)
        lines[pushIdx] =
          "      recommendations.push('Moderate score; prioritize improvements to increase reliability.');";
    }
  }

  // Summary section
  const idxSum = lines.findIndex(l => l.includes('private generateSummary('));
  if (idxSum >= 0) {
    const start = lines.findIndex(
      (l, i) => i > idxSum && l.includes('let summary =')
    );
    if (start > 0) {
      const indent = lines[start].match(/^\s*/)?.[0] ?? '    ';
      lines[start] =
        indent +
        "let summary = `Gate ${overall.passed ? 'passed' : 'failed'} (${overall.grade}, ${overall.score})\\n`;";
      const l2 = start + 1;
      lines[l2] =
        indent +
        'summary += `Issues: P0=${gate.p0Issues.length}, P1=${gate.p1Issues.length}, P2=${gate.p2Issues.length} (total=${totalIssues})\\n`;';
      const l3 = l2 + 1;
      lines[l3] =
        indent + 'summary += `Decision: ${overall.recommendation}\\n`;';
      const l4 = l3 + 1;
      lines[l4] =
        indent +
        'summary += `Confidence: ${Math.round(overall.confidence * 100)}%`;';
    }
  }

  // timedCheck timeout message
  out = lines.join('\n');
  out = out.replace(/\$\{name\}[^`]*`\)/, '${name} check timed out`)');

  return out;
}
const changes = [];
for (const file of targets) {
  const before = fs.readFileSync(file, 'utf8');
  let after = englishifyText(before);
  after = fixGameMetrics(file, after);
  after = fixGatekeeper(file, after);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changes.push({ file, bytes: before.length - after.length });
  }
}

// Write report
const day = new Date().toISOString().slice(0, 10);
const outDir = path.join(ROOT, 'logs', 'ci', day);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'englishify-report.json'),
  JSON.stringify({ changed: changes.length, changes }, null, 2),
  'utf8'
);

console.log(`Englishified ${changes.length} file(s). Report written.`);
