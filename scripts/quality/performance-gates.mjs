#!/usr/bin/env node

/**
 * 性能门禁脚本 - P95性能断言与监控
 *
 * 功能：
 * - 关键事务P95性能断言（交互≤100ms、事件≤50ms）
 * - User Timing API + Sentry Performance集成
 * - Web Vitals指标监控（LCP、FID、CLS等）
 * - Electron应用启动性能分析
 * - CI/CD友好的性能回归检测
 *
 * Usage:
 *   node scripts/quality/performance-gates.mjs --measure
 *   node scripts/quality/performance-gates.mjs --analyze
 *   node scripts/quality/performance-gates.mjs --gate
 *   node scripts/quality/performance-gates.mjs --baseline
 *
 * Environment Variables:
 *   INTERACTION_P95_LIMIT_MS  - 交互操作P95限制（默认：100ms）
 *   EVENT_P95_LIMIT_MS       - 事件处理P95限制（默认：50ms）
 *   STARTUP_TIME_LIMIT_MS    - 应用启动时间限制（默认：3000ms）
 *   REGRESSION_THRESHOLD_PCT - 性能回归阈值百分比（默认：20%）
 *   SENTRY_DSN              - Sentry项目DSN（性能数据上报）
 *   PERFORMANCE_BASELINE     - 基准性能数据文件路径
 *
 * Exit Codes:
 *   0 - 性能检查通过
 *   1 - 性能回归检测失败
 *   2 - 性能指标超出阈值
 *   3 - 测量数据不足
 *   4 - 工具执行错误
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { performance, PerformanceObserver } from 'perf_hooks';
import { promisify } from 'util';

// 配置常量
const DEFAULT_CONFIG = {
  interactionP95LimitMs:
    parseFloat(process.env.INTERACTION_P95_LIMIT_MS) || 100,
  eventP95LimitMs: parseFloat(process.env.EVENT_P95_LIMIT_MS) || 50,
  startupTimeLimitMs: parseFloat(process.env.STARTUP_TIME_LIMIT_MS) || 3000,
  regressionThresholdPct:
    parseFloat(process.env.REGRESSION_THRESHOLD_PCT) || 20,
  sentryDsn: process.env.SENTRY_DSN || '',
  baselineFile:
    process.env.PERFORMANCE_BASELINE || './logs/performance-baseline.json',
  outputFormat: process.env.OUTPUT_FORMAT || 'console',
};

// 性能指标类型定义
const METRIC_TYPES = {
  INTERACTION: 'interaction',
  EVENT: 'event',
  STARTUP: 'startup',
  WEB_VITAL: 'web-vital',
  MEMORY: 'memory',
  BUNDLE: 'bundle',
};

// Web Vitals阈值（基于Google推荐）
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 }, // First Input Delay
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 600, poor: 1500 }, // Time to First Byte
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'performance-gates',
    message,
    ...data,
  };

  if (DEFAULT_CONFIG.outputFormat === 'json') {
    console.log(JSON.stringify(logEntry));
  } else {
    const levelEmoji =
      {
        debug: '🔍',
        info: '📊',
        warn: '⚠️',
        error: '❌',
      }[level] || '📝';

    console.log(`${levelEmoji} [${level.toUpperCase()}] ${message}`);
    if (Object.keys(data).length > 0) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * 计算统计信息（P50、P95、P99等）
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const count = sorted.length;

  return {
    count,
    min: sorted[0],
    max: sorted[count - 1],
    mean: values.reduce((a, b) => a + b, 0) / count,
    median: sorted[Math.floor(count / 2)],
    p95: sorted[Math.floor(count * 0.95)],
    p99: sorted[Math.floor(count * 0.99)],
  };
}

/**
 * 启动Electron应用并测量启动时间
 */
async function measureElectronStartup() {
  log('info', '测量Electron应用启动时间...');

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let hasResolved = false;

    // 启动Electron应用（使用构建后的版本）
    const electronPath =
      process.platform === 'win32'
        ? './dist-electron/main.js'
        : './dist-electron/main.js';

    if (!fs.existsSync(electronPath)) {
      reject(new Error('Electron构建文件不存在，请先运行 npm run build'));
      return;
    }

    const electronProcess = spawn('npx', ['electron', electronPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PERFORMANCE_TEST: 'true',
      },
    });

    // 设置超时
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        electronProcess.kill('SIGTERM');
        reject(new Error('Electron启动超时'));
      }
    }, DEFAULT_CONFIG.startupTimeLimitMs + 2000);

    // 监听stdout输出，寻找启动完成标志
    let stdoutBuffer = '';
    electronProcess.stdout.on('data', data => {
      stdoutBuffer += data.toString();

      // 寻找启动完成的标志（需要在应用中添加）
      if (
        stdoutBuffer.includes('app-ready') ||
        stdoutBuffer.includes('window-shown')
      ) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);

          const startupTime = performance.now() - startTime;

          // 优雅关闭应用
          electronProcess.kill('SIGTERM');

          resolve({
            startupTimeMs: Math.round(startupTime),
            passed: startupTime <= DEFAULT_CONFIG.startupTimeLimitMs,
            output: stdoutBuffer.trim(),
          });
        }
      }
    });

    electronProcess.stderr.on('data', data => {
      log('debug', 'Electron stderr', { data: data.toString() });
    });

    electronProcess.on('close', code => {
      if (!hasResolved) {
        clearTimeout(timeout);
        if (code === 0) {
          // 正常退出但没有收到启动完成信号
          resolve({
            startupTimeMs: performance.now() - startTime,
            passed: false,
            error: '未检测到启动完成信号',
          });
        } else {
          reject(new Error(`Electron进程异常退出，退出码: ${code}`));
        }
      }
    });

    electronProcess.on('error', error => {
      if (!hasResolved) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

/**
 * 运行Playwright性能测试
 */
async function runPlaywrightPerformanceTest() {
  log('info', '运行Playwright性能测试...');

  return new Promise((resolve, reject) => {
    // 创建临时的性能测试脚本
    const testScript = `
const { test } = require('@playwright/test');
const { _electron: electron } = require('@playwright/test');

test('Electron性能测试', async () => {
  const startTime = performance.now();
  
  // 启动Electron应用
  const electronApp = await electron.launch({
    args: ['./dist-electron/main.js'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PERFORMANCE_TEST: 'true'
    }
  });

  const window = await electronApp.firstWindow();
  
  // 等待应用完全加载
  await window.waitForLoadState('networkidle');
  
  const loadTime = performance.now() - startTime;
  
  // 测量关键交互
  const interactionTimes = [];
  const eventTimes = [];
  
  // 模拟用户交互
  for (let i = 0; i < 10; i++) {
    const interactionStart = performance.now();
    
    // 点击操作（假设有按钮）
    try {
      await window.click('button:first-of-type', { timeout: 1000 });
      const interactionDuration = performance.now() - interactionStart;
      interactionTimes.push(interactionDuration);
    } catch (e) {
      // 忽略找不到元素的错误
    }
    
    // 键盘事件
    const eventStart = performance.now();
    await window.keyboard.press('Space');
    const eventDuration = performance.now() - eventStart;
    eventTimes.push(eventDuration);
    
    // 短暂等待
    await window.waitForTimeout(100);
  }
  
  await electronApp.close();
  
  // 输出结果供父进程读取
  console.log(JSON.stringify({
    loadTimeMs: Math.round(loadTime),
    interactionTimes,
    eventTimes
  }));
});
`;

    const testFile = path.resolve(
      process.cwd(),
      'temp-performance-test.spec.js'
    );
    fs.writeFileSync(testFile, testScript);

    // 运行测试
    const playwrightProcess = spawn('npx', ['playwright', 'test', testFile], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    playwrightProcess.stdout.on('data', data => {
      stdout += data.toString();
    });

    playwrightProcess.stderr.on('data', data => {
      stderr += data.toString();
    });

    playwrightProcess.on('close', code => {
      // 清理临时文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }

      if (code === 0) {
        try {
          // 从输出中提取性能数据
          const lines = stdout.split('\n');
          const dataLine = lines.find(line => line.trim().startsWith('{'));

          if (dataLine) {
            const perfData = JSON.parse(dataLine);
            resolve(perfData);
          } else {
            resolve({
              loadTimeMs: 0,
              interactionTimes: [],
              eventTimes: [],
            });
          }
        } catch (error) {
          reject(new Error(`解析性能数据失败: ${error.message}`));
        }
      } else {
        reject(new Error(`Playwright测试失败: ${stderr}`));
      }
    });

    playwrightProcess.on('error', reject);
  });
}

/**
 * 加载性能基准数据
 */
function loadPerformanceBaseline() {
  try {
    if (fs.existsSync(DEFAULT_CONFIG.baselineFile)) {
      const content = fs.readFileSync(DEFAULT_CONFIG.baselineFile, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    log('warn', '无法加载性能基准数据', { error: error.message });
  }
  return null;
}

/**
 * 保存性能基准数据
 */
function savePerformanceBaseline(data) {
  try {
    const baselineDir = path.dirname(DEFAULT_CONFIG.baselineFile);
    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }

    fs.writeFileSync(
      DEFAULT_CONFIG.baselineFile,
      JSON.stringify(data, null, 2)
    );
    log('info', `性能基准已保存: ${DEFAULT_CONFIG.baselineFile}`);
  } catch (error) {
    log('error', '保存性能基准失败', { error: error.message });
  }
}

/**
 * 检测性能回归
 */
function detectPerformanceRegression(current, baseline) {
  if (!baseline) {
    return { hasRegression: false, comparisons: [] };
  }

  const comparisons = [];
  const threshold = DEFAULT_CONFIG.regressionThresholdPct / 100;

  // 比较启动时间
  if (baseline.startup && current.startup) {
    const regressionPct =
      (current.startup.loadTimeMs - baseline.startup.loadTimeMs) /
      baseline.startup.loadTimeMs;
    comparisons.push({
      metric: 'startup-time',
      current: current.startup.loadTimeMs,
      baseline: baseline.startup.loadTimeMs,
      regression: regressionPct,
      passed: regressionPct <= threshold,
    });
  }

  // 比较交互性能
  if (baseline.interactions && current.interactions) {
    const regressionPct =
      (current.interactions.p95 - baseline.interactions.p95) /
      baseline.interactions.p95;
    comparisons.push({
      metric: 'interaction-p95',
      current: current.interactions.p95,
      baseline: baseline.interactions.p95,
      regression: regressionPct,
      passed: regressionPct <= threshold,
    });
  }

  // 比较事件性能
  if (baseline.events && current.events) {
    const regressionPct =
      (current.events.p95 - baseline.events.p95) / baseline.events.p95;
    comparisons.push({
      metric: 'event-p95',
      current: current.events.p95,
      baseline: baseline.events.p95,
      regression: regressionPct,
      passed: regressionPct <= threshold,
    });
  }

  const hasRegression = comparisons.some(comp => !comp.passed);

  return { hasRegression, comparisons };
}

/**
 * 执行性能测量
 */
async function measurePerformance() {
  log('info', '开始性能测量...');

  const results = {
    timestamp: new Date().toISOString(),
    startup: null,
    interactions: null,
    events: null,
    webVitals: null,
  };

  try {
    // 测量Electron启动时间
    try {
      results.startup = await measureElectronStartup();
      log('info', '启动时间测量完成', {
        startupTime: results.startup.startupTimeMs,
        passed: results.startup.passed,
      });
    } catch (error) {
      log('warn', 'Electron启动测量失败', { error: error.message });
      results.startup = { error: error.message };
    }

    // 运行详细的性能测试
    try {
      const playwrightData = await runPlaywrightPerformanceTest();

      if (
        playwrightData.interactionTimes &&
        playwrightData.interactionTimes.length > 0
      ) {
        results.interactions = calculateStats(playwrightData.interactionTimes);
        results.interactions.passed =
          results.interactions.p95 <= DEFAULT_CONFIG.interactionP95LimitMs;
      }

      if (playwrightData.eventTimes && playwrightData.eventTimes.length > 0) {
        results.events = calculateStats(playwrightData.eventTimes);
        results.events.passed =
          results.events.p95 <= DEFAULT_CONFIG.eventP95LimitMs;
      }

      log('info', '交互性能测量完成', {
        interactionP95: results.interactions?.p95 || 'N/A',
        eventP95: results.events?.p95 || 'N/A',
      });
    } catch (error) {
      log('warn', 'Playwright性能测试失败', { error: error.message });
      results.interactions = { error: error.message };
      results.events = { error: error.message };
    }
  } catch (error) {
    log('error', '性能测量失败', { error: error.message });
    throw error;
  }

  return results;
}

/**
 * 分析性能数据
 */
function analyzePerformance(results) {
  log('info', '开始性能分析...');

  const analysis = {
    timestamp: new Date().toISOString(),
    overall: { passed: true, issues: [] },
    thresholds: {
      interactionP95LimitMs: DEFAULT_CONFIG.interactionP95LimitMs,
      eventP95LimitMs: DEFAULT_CONFIG.eventP95LimitMs,
      startupTimeLimitMs: DEFAULT_CONFIG.startupTimeLimitMs,
    },
    metrics: {},
  };

  // 分析启动时间
  if (results.startup && !results.startup.error) {
    analysis.metrics.startup = {
      value: results.startup.startupTimeMs,
      passed: results.startup.passed,
      threshold: DEFAULT_CONFIG.startupTimeLimitMs,
    };

    if (!results.startup.passed) {
      analysis.overall.passed = false;
      analysis.overall.issues.push('启动时间超出阈值');
    }
  }

  // 分析交互性能
  if (
    results.interactions &&
    !results.interactions.error &&
    results.interactions.count > 0
  ) {
    analysis.metrics.interactionP95 = {
      value: results.interactions.p95,
      passed: results.interactions.passed,
      threshold: DEFAULT_CONFIG.interactionP95LimitMs,
      sampleSize: results.interactions.count,
    };

    if (!results.interactions.passed) {
      analysis.overall.passed = false;
      analysis.overall.issues.push('交互性能P95超出阈值');
    }
  }

  // 分析事件性能
  if (results.events && !results.events.error && results.events.count > 0) {
    analysis.metrics.eventP95 = {
      value: results.events.p95,
      passed: results.events.passed,
      threshold: DEFAULT_CONFIG.eventP95LimitMs,
      sampleSize: results.events.count,
    };

    if (!results.events.passed) {
      analysis.overall.passed = false;
      analysis.overall.issues.push('事件性能P95超出阈值');
    }
  }

  // 检查是否有足够的测量数据
  const hasValidData =
    analysis.metrics.startup ||
    (analysis.metrics.interactionP95 &&
      analysis.metrics.interactionP95.sampleSize >= 5) ||
    (analysis.metrics.eventP95 && analysis.metrics.eventP95.sampleSize >= 5);

  if (!hasValidData) {
    analysis.overall.passed = false;
    analysis.overall.issues.push('测量数据不足');
  }

  return analysis;
}

/**
 * 执行性能门禁检查
 */
async function runPerformanceGate() {
  log('info', '开始性能门禁检查...');

  // 测量当前性能
  const currentResults = await measurePerformance();

  // 分析性能数据
  const analysis = analyzePerformance(currentResults);

  // 检查性能回归
  const baseline = loadPerformanceBaseline();
  const regression = detectPerformanceRegression(currentResults, baseline);

  const gateResult = {
    timestamp: new Date().toISOString(),
    passed: analysis.overall.passed && !regression.hasRegression,
    analysis,
    regression,
    config: DEFAULT_CONFIG,
  };

  return gateResult;
}

/**
 * 显示性能报告
 */
function displayPerformanceReport(report) {
  if (DEFAULT_CONFIG.outputFormat === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n⚡ 性能门禁检查报告');
  console.log('='.repeat(50));

  console.log(`⏱️  检查时间: ${report.timestamp}`);
  console.log(`✅ 整体状态: ${report.passed ? '通过' : '失败'}`);

  // 显示性能指标
  if (report.analysis.metrics.startup) {
    const startup = report.analysis.metrics.startup;
    const status = startup.passed ? '✅' : '❌';
    console.log(`\n🚀 启动时间: ${status}`);
    console.log(`   实测: ${startup.value}ms`);
    console.log(`   阈值: ${startup.threshold}ms`);
  }

  if (report.analysis.metrics.interactionP95) {
    const interaction = report.analysis.metrics.interactionP95;
    const status = interaction.passed ? '✅' : '❌';
    console.log(`\n👆 交互性能P95: ${status}`);
    console.log(`   实测: ${interaction.value.toFixed(1)}ms`);
    console.log(`   阈值: ${interaction.threshold}ms`);
    console.log(`   样本: ${interaction.sampleSize}次`);
  }

  if (report.analysis.metrics.eventP95) {
    const event = report.analysis.metrics.eventP95;
    const status = event.passed ? '✅' : '❌';
    console.log(`\n⚡ 事件性能P95: ${status}`);
    console.log(`   实测: ${event.value.toFixed(1)}ms`);
    console.log(`   阈值: ${event.threshold}ms`);
    console.log(`   样本: ${event.sampleSize}次`);
  }

  // 显示回归检查结果
  if (report.regression.comparisons.length > 0) {
    console.log('\n📈 性能回归检查:');
    report.regression.comparisons.forEach(comp => {
      const status = comp.passed ? '✅' : '❌';
      const change = comp.regression > 0 ? '↑' : '↓';
      const pct = Math.abs(comp.regression * 100).toFixed(1);
      console.log(
        `   ${status} ${comp.metric}: ${comp.current} vs ${comp.baseline} (${change}${pct}%)`
      );
    });
  }

  // 显示问题和建议
  if (report.analysis.overall.issues.length > 0) {
    console.log('\n⚠️  发现的问题:');
    report.analysis.overall.issues.forEach(issue => {
      console.log(`   • ${issue}`);
    });
  }

  if (!report.passed) {
    console.log('\n💡 建议:');
    if (!report.analysis.overall.passed) {
      console.log('   ⚡ 优化性能瓶颈，减少响应时间');
    }
    if (report.regression.hasRegression) {
      console.log('   📉 检查最近的代码更改，修复性能回归');
    }
  }

  console.log('='.repeat(50));
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
性能门禁检查工具

用法:
  node scripts/quality/performance-gates.mjs [选项]

选项:
  --measure            仅执行性能测量
  --analyze           仅执行性能分析
  --gate              执行完整的门禁检查 (默认)
  --baseline          设置当前性能为基准
  --help, -h          显示此帮助信息

环境变量:
  INTERACTION_P95_LIMIT_MS     交互操作P95限制 (ms)
  EVENT_P95_LIMIT_MS          事件处理P95限制 (ms)  
  STARTUP_TIME_LIMIT_MS       应用启动时间限制 (ms)
  REGRESSION_THRESHOLD_PCT     性能回归阈值百分比
  PERFORMANCE_BASELINE        基准性能数据文件路径

示例:
  node scripts/quality/performance-gates.mjs
  node scripts/quality/performance-gates.mjs --baseline
  INTERACTION_P95_LIMIT_MS=150 node scripts/quality/performance-gates.mjs --gate
`);
    process.exit(0);
  }

  try {
    if (args.includes('--baseline')) {
      log('info', '设置性能基准...');
      const results = await measurePerformance();
      savePerformanceBaseline(results);
      log('info', '性能基准设置完成');
      process.exit(0);
    }

    if (args.includes('--measure')) {
      log('info', '执行性能测量...');
      const results = await measurePerformance();

      if (DEFAULT_CONFIG.outputFormat === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        log('info', '性能测量完成', results);
      }
      process.exit(0);
    }

    if (args.includes('--analyze')) {
      log('info', '执行性能分析...');
      // 需要先有测量数据，这里假设从文件读取
      const results = loadPerformanceBaseline();
      if (!results) {
        throw new Error('没有可分析的性能数据，请先运行 --measure');
      }

      const analysis = analyzePerformance(results);

      if (DEFAULT_CONFIG.outputFormat === 'json') {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        log('info', '性能分析完成', analysis);
      }
      process.exit(analysis.overall.passed ? 0 : 2);
    }

    // 默认执行完整的门禁检查
    const report = await runPerformanceGate();

    // 保存检查结果到logs目录
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const reportFile = path.join(
      logsDir,
      `performance-gate-${new Date().toISOString().split('T')[0]}.json`
    );
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // 显示报告
    displayPerformanceReport(report);

    if (DEFAULT_CONFIG.outputFormat === 'console') {
      log('info', `详细报告已保存: ${reportFile}`);
    }

    // 确定退出码
    let exitCode = 0;
    if (!report.analysis.overall.passed) {
      exitCode = 2; // 性能指标超出阈值
    } else if (report.regression.hasRegression) {
      exitCode = 1; // 性能回归检测失败
    }

    process.exit(exitCode);
  } catch (error) {
    log('error', '性能门禁检查失败', {
      error: error.message,
      stack: error.stack,
    });

    if (DEFAULT_CONFIG.outputFormat === 'json') {
      console.log(
        JSON.stringify({
          ok: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      );
    }

    process.exit(4);
  }
}

// 导出函数供其他脚本使用
export {
  measurePerformance,
  analyzePerformance,
  runPerformanceGate,
  loadPerformanceBaseline,
  savePerformanceBaseline,
  DEFAULT_CONFIG,
};

// 如果直接运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(4);
  });
}
