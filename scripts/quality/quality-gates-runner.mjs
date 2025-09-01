#!/usr/bin/env node

/**
 * 质量门禁统一运行器 - 工具链门禁补强系统
 *
 * 整合：
 * - Bundle体积闸：Vite可视化 + 体积阈值监控
 * - 依赖安全闸：许可和高危依赖检查
 * - 性能门禁：关键事务P95断言（交互≤100ms、事件≤50ms）
 * - 综合报告：HTML报告生成与CI集成
 *
 * Usage:
 *   node scripts/quality/quality-gates-runner.mjs --all
 *   node scripts/quality/quality-gates-runner.mjs --bundle --deps --perf
 *   node scripts/quality/quality-gates-runner.mjs --report-only
 *
 * Environment Variables:
 *   QUALITY_GATES_REPORT_DIR  - 报告输出目录（默认：logs/quality）
 *   QUALITY_GATES_FAIL_FAST   - 快速失败模式（默认：false）
 *   CI                        - CI环境检测（GitHub Actions等）
 *
 * Exit Codes:
 *   0  - 所有门禁通过
 *   1  - Bundle体积超限
 *   2  - 依赖安全问题
 *   4  - 性能不达标
 *   7  - 多项门禁失败（组合码）
 *   10 - 工具执行错误
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

// 配置
const CONFIG = {
  reportDir: process.env.QUALITY_GATES_REPORT_DIR || 'logs/quality',
  failFast: process.env.QUALITY_GATES_FAIL_FAST === 'true',
  isCI: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
  outputFormat: process.env.OUTPUT_FORMAT || 'console',
};

// 质量门禁定义
const QUALITY_GATES = {
  bundle: {
    name: 'Bundle体积闸',
    script: 'scripts/quality/bundle-analyzer.mjs',
    args: ['gate'],
    exitCodeMask: 1,
    timeout: 120000, // 2分钟
    description: 'Vite包体积分析与阈值检查',
  },
  deps: {
    name: '依赖安全闸',
    script: 'scripts/quality/dependency-security.mjs',
    args: ['--check'],
    exitCodeMask: 2,
    timeout: 300000, // 5分钟
    description: '许可证合规性与漏洞检查',
  },
  perf: {
    name: '性能门禁',
    script: 'scripts/quality/performance-gates.mjs',
    args: ['--gate'],
    exitCodeMask: 4,
    timeout: 600000, // 10分钟
    description: 'P95性能断言与回归检测',
  },
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'quality-gates-runner',
    message,
    ...data,
  };

  if (CONFIG.outputFormat === 'json') {
    console.log(JSON.stringify(logEntry));
  } else {
    const levelEmoji =
      {
        debug: '🔍',
        info: '🏗️',
        warn: '⚠️',
        error: '❌',
        success: '✅',
      }[level] || '📝';

    console.log(`${levelEmoji} [${level.toUpperCase()}] ${message}`);
    if (Object.keys(data).length > 0 && level !== 'info') {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * 执行单个质量门禁
 */
async function runQualityGate(gateName, gate) {
  log('info', `开始执行: ${gate.name}`);
  const startTime = performance.now();

  return new Promise(resolve => {
    const scriptPath = path.resolve(process.cwd(), gate.script);

    if (!fs.existsSync(scriptPath)) {
      resolve({
        gate: gateName,
        passed: false,
        error: `脚本文件不存在: ${scriptPath}`,
        duration: 0,
      });
      return;
    }

    // 设置超时
    let hasTimedOut = false;
    const timeout = setTimeout(() => {
      hasTimedOut = true;
      child.kill('SIGTERM');
    }, gate.timeout);

    const child = spawn('node', [gate.script, ...gate.args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OUTPUT_FORMAT: 'json', // 强制JSON输出便于解析
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      clearTimeout(timeout);
      const duration = performance.now() - startTime;

      if (hasTimedOut) {
        resolve({
          gate: gateName,
          passed: false,
          error: '执行超时',
          duration: Math.round(duration),
          timeout: gate.timeout,
        });
        return;
      }

      // 解析输出数据
      let outputData = null;
      try {
        // 尝试从stdout解析JSON结果
        const lines = stdout.split('\n').filter(line => line.trim());
        const jsonLine = lines.find(
          line => line.startsWith('{') && line.includes('"timestamp"')
        );
        if (jsonLine) {
          outputData = JSON.parse(jsonLine);
        }
      } catch (error) {
        // 解析失败，使用基础数据
      }

      resolve({
        gate: gateName,
        name: gate.name,
        description: gate.description,
        passed: code === 0,
        exitCode: code,
        duration: Math.round(duration),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        data: outputData,
      });
    });

    child.on('error', error => {
      clearTimeout(timeout);
      const duration = performance.now() - startTime;

      resolve({
        gate: gateName,
        passed: false,
        error: error.message,
        duration: Math.round(duration),
      });
    });
  });
}

/**
 * 生成HTML报告
 */
function generateHTMLReport(results, summary) {
  const timestamp = new Date().toISOString();
  const reportDate = new Date().toLocaleString('zh-CN');

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>质量门禁检查报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #1890ff; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 28px; color: #1f2937; margin: 0 0 10px 0; font-weight: 600; }
    .subtitle { color: #6b7280; font-size: 16px; margin: 5px 0; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card.failed { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 18px; }
    .summary-card .value { font-size: 32px; font-weight: bold; margin: 10px 0; }
    .gate { margin: 30px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .gate-header { background: #f9fafb; padding: 20px; border-bottom: 1px solid #e5e7eb; }
    .gate-title { font-size: 20px; margin: 0 0 5px 0; display: flex; align-items: center; }
    .gate-status { margin-right: 10px; font-size: 24px; }
    .gate-description { color: #6b7280; margin: 5px 0 0 34px; }
    .gate-content { padding: 20px; }
    .gate-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0; }
    .metric { background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; }
    .metric-label { font-size: 12px; color: #6b7280; margin-bottom: 5px; text-transform: uppercase; }
    .metric-value { font-size: 18px; font-weight: 600; color: #1f2937; }
    .error { background: #fef2f2; color: #dc2626; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
    .recommendations { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 20px; margin: 20px 0; }
    .recommendations h4 { margin: 0 0 15px 0; color: #0ea5e9; }
    .recommendations ul { margin: 0; padding-left: 20px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    pre { background: #f8fafc; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 13px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🏗️ 质量门禁检查报告</h1>
      <div class="subtitle">📅 生成时间: ${reportDate}</div>
      <div class="subtitle">⚡ 总耗时: ${summary.totalDuration}ms (${(summary.totalDuration / 1000).toFixed(1)}秒)</div>
      <div class="subtitle">🎯 整体状态: <strong style="color: ${summary.allPassed ? '#10b981' : '#dc2626'}">${summary.allPassed ? '✅ 通过' : '❌ 失败'}</strong></div>
    </div>

    <div class="summary">
      <div class="summary-card${summary.allPassed ? '' : ' failed'}">
        <h3>门禁结果</h3>
        <div class="value">${summary.passedCount}/${summary.totalCount}</div>
        <div>通过率: ${((summary.passedCount / summary.totalCount) * 100).toFixed(0)}%</div>
      </div>
      <div class="summary-card">
        <h3>检查项目</h3>
        <div class="value">${summary.totalCount}</div>
        <div>Bundle • 依赖 • 性能</div>
      </div>
      <div class="summary-card">
        <h3>总耗时</h3>
        <div class="value">${(summary.totalDuration / 1000).toFixed(1)}</div>
        <div>秒</div>
      </div>
    </div>

    ${results
      .map(
        result => `
    <div class="gate">
      <div class="gate-header">
        <h2 class="gate-title">
          <span class="gate-status">${result.passed ? '✅' : '❌'}</span>
          ${result.name}
        </h2>
        <div class="gate-description">${result.description}</div>
      </div>
      <div class="gate-content">
        <div class="gate-metrics">
          <div class="metric">
            <div class="metric-label">执行时间</div>
            <div class="metric-value">${result.duration}ms</div>
          </div>
          <div class="metric">
            <div class="metric-label">退出码</div>
            <div class="metric-value">${result.exitCode}</div>
          </div>
          ${
            result.timeout
              ? `
          <div class="metric">
            <div class="metric-label">超时限制</div>
            <div class="metric-value">${result.timeout / 1000}s</div>
          </div>
          `
              : ''
          }
        </div>

        ${
          result.error
            ? `
        <div class="error">
          <strong>错误信息:</strong> ${result.error}
        </div>
        `
            : ''
        }

        ${
          result.stderr && result.stderr.length > 0
            ? `
        <details>
          <summary>错误输出 (点击展开)</summary>
          <pre>${result.stderr}</pre>
        </details>
        `
            : ''
        }
        
        ${
          result.stdout && result.stdout.length > 0 && !result.data
            ? `
        <details>
          <summary>详细输出 (点击展开)</summary>
          <pre>${result.stdout}</pre>
        </details>
        `
            : ''
        }
      </div>
    </div>
    `
      )
      .join('')}

    ${
      !summary.allPassed
        ? `
    <div class="recommendations">
      <h4>💡 修复建议</h4>
      <ul>
        ${results
          .filter(r => !r.passed)
          .map(r =>
            r.gate === 'bundle'
              ? '<li>🎁 <strong>Bundle体积</strong>: 检查大型依赖，启用代码分割，移除未使用代码</li>'
              : r.gate === 'deps'
                ? '<li>🔒 <strong>依赖安全</strong>: 运行 npm audit fix，更新许可证白名单，替换违规依赖</li>'
                : r.gate === 'perf'
                  ? '<li>⚡ <strong>性能优化</strong>: 分析性能瓶颈，优化关键路径，减少渲染阻塞</li>'
                  : `<li>🔧 <strong>${r.name}</strong>: ${r.error || '检查失败，请查看详细日志'}</li>`
          )
          .join('')}
        <li>📊 查看详细日志文件获取更多信息</li>
        <li>🔄 修复问题后重新运行质量门禁检查</li>
      </ul>
    </div>
    `
        : `
    <div class="recommendations" style="background: #f0fdf4; border-color: #10b981;">
      <h4 style="color: #10b981;">🎉 恭喜！所有质量门禁检查通过</h4>
      <ul>
        <li>✅ Bundle体积在合理范围内</li>
        <li>✅ 依赖安全合规</li>
        <li>✅ 性能指标达标</li>
        <li>📦 代码可以安全发布</li>
      </ul>
    </div>
    `
    }

    <div class="footer">
      <div>Generated by ViteGame Quality Gates System</div>
      <div>Timestamp: ${timestamp}</div>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * 保存报告
 */
function saveReports(results, summary) {
  // 确保报告目录存在
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .split('T')[0];

  // 保存JSON报告
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary,
    results,
    config: CONFIG,
  };

  const jsonFile = path.join(
    CONFIG.reportDir,
    `quality-gates-${timestamp}.json`
  );
  fs.writeFileSync(jsonFile, JSON.stringify(jsonReport, null, 2));

  // 保存HTML报告
  const htmlReport = generateHTMLReport(results, summary);
  const htmlFile = path.join(
    CONFIG.reportDir,
    `quality-gates-${timestamp}.html`
  );
  fs.writeFileSync(htmlFile, htmlReport);

  // 保存最新报告副本
  const latestJsonFile = path.join(
    CONFIG.reportDir,
    'latest-quality-gates.json'
  );
  const latestHtmlFile = path.join(
    CONFIG.reportDir,
    'latest-quality-gates.html'
  );
  fs.writeFileSync(latestJsonFile, JSON.stringify(jsonReport, null, 2));
  fs.writeFileSync(latestHtmlFile, htmlReport);

  return { jsonFile, htmlFile, latestHtmlFile };
}

/**
 * 主执行函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
质量门禁统一运行器

用法:
  node scripts/quality/quality-gates-runner.mjs [选项]

选项:
  --all              运行所有质量门禁 (默认)
  --bundle           仅运行Bundle体积检查
  --deps             仅运行依赖安全检查  
  --perf             仅运行性能门禁检查
  --report-only      仅生成最新报告，不执行检查
  --help, -h         显示此帮助信息

环境变量:
  QUALITY_GATES_REPORT_DIR   报告输出目录
  QUALITY_GATES_FAIL_FAST    快速失败模式
  OUTPUT_FORMAT              输出格式 (json|console)

示例:
  node scripts/quality/quality-gates-runner.mjs
  node scripts/quality/quality-gates-runner.mjs --bundle --deps
  QUALITY_GATES_FAIL_FAST=true node scripts/quality/quality-gates-runner.mjs --all
`);
    process.exit(0);
  }

  const startTime = performance.now();

  try {
    log('info', '🏗️ 启动质量门禁检查系统');
    log('info', `📊 配置: ${JSON.stringify(CONFIG)}`);

    // 确定要运行的门禁
    const gatesToRun = [];

    if (args.includes('--report-only')) {
      // 仅生成报告模式，读取最新结果
      const latestFile = path.join(
        CONFIG.reportDir,
        'latest-quality-gates.json'
      );
      if (fs.existsSync(latestFile)) {
        const latestData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        const reportFiles = saveReports(latestData.results, latestData.summary);
        log('info', `📄 报告已更新: ${reportFiles.htmlFile}`);
        process.exit(latestData.summary.allPassed ? 0 : 7);
      } else {
        log('error', '没有找到历史检查结果，请先运行质量门禁');
        process.exit(10);
      }
    }

    if (
      args.includes('--bundle') ||
      args.includes('--all') ||
      args.length === 0
    ) {
      gatesToRun.push('bundle');
    }

    if (
      args.includes('--deps') ||
      args.includes('--all') ||
      args.length === 0
    ) {
      gatesToRun.push('deps');
    }

    if (
      args.includes('--perf') ||
      args.includes('--all') ||
      args.length === 0
    ) {
      gatesToRun.push('perf');
    }

    log(
      'info',
      `🎯 计划执行门禁: ${gatesToRun.map(g => QUALITY_GATES[g].name).join(', ')}`
    );

    // 执行质量门禁
    const results = [];
    let combinedExitCode = 0;

    for (const gateName of gatesToRun) {
      const gate = QUALITY_GATES[gateName];

      log('info', `▶️ 执行 ${gate.name}...`);

      const result = await runQualityGate(gateName, gate);
      results.push(result);

      if (result.passed) {
        log('success', `✅ ${gate.name} 通过 (耗时: ${result.duration}ms)`);
      } else {
        log('error', `❌ ${gate.name} 失败 (耗时: ${result.duration}ms)`, {
          exitCode: result.exitCode,
          error: result.error,
        });

        combinedExitCode |= gate.exitCodeMask;

        if (CONFIG.failFast) {
          log('warn', '⚡ 快速失败模式，停止后续检查');
          break;
        }
      }
    }

    // 生成总结
    const totalDuration = performance.now() - startTime;
    const summary = {
      totalCount: results.length,
      passedCount: results.filter(r => r.passed).length,
      allPassed: results.every(r => r.passed),
      totalDuration: Math.round(totalDuration),
      combinedExitCode,
    };

    // 保存报告
    const reportFiles = saveReports(results, summary);

    // 显示最终结果
    if (CONFIG.outputFormat === 'json') {
      console.log(
        JSON.stringify(
          {
            summary,
            results,
            reportFiles,
          },
          null,
          2
        )
      );
    } else {
      console.log('\n' + '='.repeat(80));
      log('info', '📊 质量门禁检查完成');
      console.log('='.repeat(80));

      log(
        'info',
        `🎯 检查结果: ${summary.passedCount}/${summary.totalCount} 通过`
      );
      log('info', `⏱️ 总耗时: ${(summary.totalDuration / 1000).toFixed(1)} 秒`);
      log('info', `📄 HTML报告: ${reportFiles.htmlFile}`);
      log('info', `📊 JSON报告: ${reportFiles.jsonFile}`);

      if (summary.allPassed) {
        log('success', '🎉 所有质量门禁检查通过！');
      } else {
        log('error', '❌ 质量门禁检查失败，请查看报告详情');

        // 显示失败摘要
        const failedGates = results.filter(r => !r.passed);
        failedGates.forEach(result => {
          log('error', `  • ${result.name}: ${result.error || '检查未通过'}`);
        });
      }

      console.log('='.repeat(80));
    }

    process.exit(combinedExitCode);
  } catch (error) {
    log('error', '质量门禁运行器执行失败', {
      error: error.message,
      stack: error.stack,
    });

    if (CONFIG.outputFormat === 'json') {
      console.log(
        JSON.stringify({
          ok: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      );
    }

    process.exit(10);
  }
}

// 导出函数供其他脚本使用
export {
  runQualityGate,
  generateHTMLReport,
  saveReports,
  QUALITY_GATES,
  CONFIG,
};

// 如果直接运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(10);
  });
}
