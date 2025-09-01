#!/usr/bin/env node
/**
 * Web Vitals CI门禁系统
 *
 * 功能：
 * 1. 从本地存储读取Web Vitals历史数据
 * 2. 计算7天滚动窗口基线
 * 3. 执行"不回退"门禁检查
 * 4. 与现有CI系统集成
 * 5. 生成性能报告和趋势分析
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from './utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载Web Vitals门禁配置
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);
const GATE_CONFIG = {
  ...config.webVitals,

  // 绝对阈值配置（谷歌Web Vitals标准）
  absoluteThresholds: {
    LCP: { good: 2500, poor: 4000 },
    INP: { good: 200, poor: 500 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  },

  // 输出配置
  output: {
    reportPath: './logs/web-vitals-gate-report.json',
    summaryPath: './logs/web-vitals-gate-summary.md',
    trendPath: './logs/web-vitals-trends.json',
  },

  // 存储配置
  storage: {
    dataKey: 'web-vitals-data',
    baselineKey: 'web-vitals-data-baseline',
  },
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      component: 'web-vitals-gate',
      message,
      ...data,
    })
  );
}

/**
 * 从模拟的localStorage读取数据
 * 在实际环境中，这些数据来自浏览器环境
 */
function loadWebVitalsData() {
  try {
    // 在CI环境中，我们需要模拟一些数据来演示门禁逻辑
    // 实际环境中这些数据来自用户浏览器的localStorage

    const mockDataPath = path.join(
      __dirname,
      '..',
      'logs',
      'mock-web-vitals-data.json'
    );

    if (fs.existsSync(mockDataPath)) {
      const data = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
      return data;
    }

    // 生成模拟数据用于演示
    return generateMockData();
  } catch (error) {
    log('error', '无法加载Web Vitals数据', { error: error.message });
    return [];
  }
}

/**
 * 生成模拟Web Vitals数据用于演示
 */
function generateMockData() {
  const data = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 生成最近14天的模拟数据
  for (let i = 14; i >= 0; i--) {
    const dayStart = now - i * dayMs;

    // 每天生成5-15个数据点
    const pointsPerDay = Math.floor(Math.random() * 10) + 5;

    for (let j = 0; j < pointsPerDay; j++) {
      const timestamp = dayStart + Math.random() * dayMs;
      const sessionId = `session-${i}-${j}`;

      // 基准值 + 随机波动
      const baseLCP = 2200 + Math.random() * 800; // 2200-3000ms
      const baseINP = 120 + Math.random() * 100; // 120-220ms
      const baseCLS = 0.08 + Math.random() * 0.05; // 0.08-0.13
      const baseFCP = 1600 + Math.random() * 400; // 1600-2000ms
      const baseTTFB = 600 + Math.random() * 300; // 600-900ms

      // 模拟一些性能回归（最近几天稍差）
      const regressionFactor = i < 3 ? 1.15 : 1.0; // 最近3天性能稍差

      data.push({
        timestamp,
        sessionId,
        userId: `user-${Math.floor(Math.random() * 100)}`,
        metrics: {
          lcp: {
            id: `lcp-${timestamp}`,
            name: 'LCP',
            value: baseLCP * regressionFactor,
            rating:
              baseLCP * regressionFactor <= 2500
                ? 'good'
                : baseLCP * regressionFactor <= 4000
                  ? 'needs-improvement'
                  : 'poor',
          },
          inp: {
            id: `inp-${timestamp}`,
            name: 'INP',
            value: baseINP * regressionFactor,
            rating:
              baseINP * regressionFactor <= 200
                ? 'good'
                : baseINP * regressionFactor <= 500
                  ? 'needs-improvement'
                  : 'poor',
          },
          cls: {
            id: `cls-${timestamp}`,
            name: 'CLS',
            value: baseCLS * regressionFactor,
            rating:
              baseCLS * regressionFactor <= 0.1
                ? 'good'
                : baseCLS * regressionFactor <= 0.25
                  ? 'needs-improvement'
                  : 'poor',
          },
          fcp: {
            id: `fcp-${timestamp}`,
            name: 'FCP',
            value: baseFCP * regressionFactor,
            rating:
              baseFCP * regressionFactor <= 1800
                ? 'good'
                : baseFCP * regressionFactor <= 3000
                  ? 'needs-improvement'
                  : 'poor',
          },
          ttfb: {
            id: `ttfb-${timestamp}`,
            name: 'TTFB',
            value: baseTTFB * regressionFactor,
            rating:
              baseTTFB * regressionFactor <= 800
                ? 'good'
                : baseTTFB * regressionFactor <= 1800
                  ? 'needs-improvement'
                  : 'poor',
          },
          customTimings: {
            [`interaction_click_${j}`]: 50 + Math.random() * 100,
            [`event_load_${j}`]: 20 + Math.random() * 50,
          },
        },
        context: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          viewport: { width: 1920, height: 1080 },
          navigation: { type: 'navigate', redirectCount: 0 },
        },
      });
    }
  }

  log('info', '生成了模拟Web Vitals数据', { totalPoints: data.length });
  return data;
}

/**
 * 计算P95值
 */
function calculateP95(values) {
  if (values.length === 0) return 0;

  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算P50值（中位数）
 */
function calculateP50(values) {
  if (values.length === 0) return 0;

  const sorted = values.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * 计算基线统计数据
 */
function calculateBaseline(data) {
  const cutoff =
    Date.now() - GATE_CONFIG.baseline.windowDays * 24 * 60 * 60 * 1000;
  const baselineData = data.filter(point => point.timestamp > cutoff);

  if (baselineData.length < GATE_CONFIG.baseline.minSampleSize) {
    throw new Error(
      `基线数据不足: ${baselineData.length} < ${GATE_CONFIG.baseline.minSampleSize}`
    );
  }

  // 提取各指标数值
  const lcpValues = baselineData
    .filter(d => d.metrics.lcp)
    .map(d => d.metrics.lcp.value);
  const inpValues = baselineData
    .filter(d => d.metrics.inp)
    .map(d => d.metrics.inp.value);
  const clsValues = baselineData
    .filter(d => d.metrics.cls)
    .map(d => d.metrics.cls.value);
  const fcpValues = baselineData
    .filter(d => d.metrics.fcp)
    .map(d => d.metrics.fcp.value);
  const ttfbValues = baselineData
    .filter(d => d.metrics.ttfb)
    .map(d => d.metrics.ttfb.value);

  const baseline = {
    windowStart: cutoff,
    windowEnd: Date.now(),
    sampleSize: baselineData.length,
    metrics: {
      LCP: {
        p50: calculateP50(lcpValues),
        p95: calculateP95(lcpValues),
        count: lcpValues.length,
      },
      INP: {
        p50: calculateP50(inpValues),
        p95: calculateP95(inpValues),
        count: inpValues.length,
      },
      CLS: {
        p50: calculateP50(clsValues),
        p95: calculateP95(clsValues),
        count: clsValues.length,
      },
      FCP: {
        p50: calculateP50(fcpValues),
        p95: calculateP95(fcpValues),
        count: fcpValues.length,
      },
      TTFB: {
        p50: calculateP50(ttfbValues),
        p95: calculateP95(ttfbValues),
        count: ttfbValues.length,
      },
    },
    lastUpdated: Date.now(),
  };

  log('info', '基线计算完成', {
    sampleSize: baseline.sampleSize,
    windowDays: GATE_CONFIG.baseline.windowDays,
  });

  return baseline;
}

/**
 * 计算最近性能数据
 */
function calculateRecentPerformance(data) {
  // 计算最近24小时的数据作为当前性能
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentData = data.filter(point => point.timestamp > cutoff);

  if (recentData.length === 0) {
    log('warn', '没有最近24小时的性能数据');
    return null;
  }

  const lcpValues = recentData
    .filter(d => d.metrics.lcp)
    .map(d => d.metrics.lcp.value);
  const inpValues = recentData
    .filter(d => d.metrics.inp)
    .map(d => d.metrics.inp.value);
  const clsValues = recentData
    .filter(d => d.metrics.cls)
    .map(d => d.metrics.cls.value);
  const fcpValues = recentData
    .filter(d => d.metrics.fcp)
    .map(d => d.metrics.fcp.value);
  const ttfbValues = recentData
    .filter(d => d.metrics.ttfb)
    .map(d => d.metrics.ttfb.value);

  return {
    sampleSize: recentData.length,
    metrics: {
      LCP: {
        p50: calculateP50(lcpValues),
        p95: calculateP95(lcpValues),
        count: lcpValues.length,
      },
      INP: {
        p50: calculateP50(inpValues),
        p95: calculateP95(inpValues),
        count: inpValues.length,
      },
      CLS: {
        p50: calculateP50(clsValues),
        p95: calculateP95(clsValues),
        count: clsValues.length,
      },
      FCP: {
        p50: calculateP50(fcpValues),
        p95: calculateP95(fcpValues),
        count: fcpValues.length,
      },
      TTFB: {
        p50: calculateP50(ttfbValues),
        p95: calculateP95(ttfbValues),
        count: ttfbValues.length,
      },
    },
  };
}

/**
 * 执行门禁检查
 */
function performGateCheck(baseline, recent) {
  const results = {
    passed: true,
    warnings: [],
    failures: [],
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      warningChecks: 0,
      failedChecks: 0,
    },
  };

  const metrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  metrics.forEach(metric => {
    if (
      baseline.metrics[metric].count === 0 ||
      recent.metrics[metric].count === 0
    ) {
      log('warn', `跳过${metric}检查: 数据不足`);
      return;
    }

    results.summary.totalChecks++;

    const baselineValue = baseline.metrics[metric].p95;
    const recentValue = recent.metrics[metric].p95;
    const regressionPercent =
      ((recentValue - baselineValue) / baselineValue) * 100;

    const thresholds = GATE_CONFIG.regressionThresholds[metric];
    const absoluteThresholds = GATE_CONFIG.absoluteThresholds[metric];

    const check = {
      metric,
      baselineValue,
      recentValue,
      regressionPercent,
      status: 'passed',
    };

    // 检查回归阈值
    if (regressionPercent > thresholds.critical) {
      check.status = 'failed';
      check.reason = `P95回归${regressionPercent.toFixed(1)}% 超过临界阈值${thresholds.critical}%`;
      results.failures.push(check);
      results.passed = false;
      results.summary.failedChecks++;
    } else if (regressionPercent > thresholds.warning) {
      check.status = 'warning';
      check.reason = `P95回归${regressionPercent.toFixed(1)}% 超过警告阈值${thresholds.warning}%`;
      results.warnings.push(check);
      results.summary.warningChecks++;
    } else {
      // 检查绝对阈值
      if (recentValue > absoluteThresholds.poor) {
        check.status = 'warning';
        check.reason = `P95值${recentValue.toFixed(1)} 超过"差"评级阈值${absoluteThresholds.poor}`;
        results.warnings.push(check);
        results.summary.warningChecks++;
      } else {
        results.summary.passedChecks++;
      }
    }
  });

  return results;
}

/**
 * 生成趋势数据
 */
function generateTrendData(data) {
  const trends = {};
  const dayMs = 24 * 60 * 60 * 1000;
  const days = 14; // 最近14天趋势

  const metrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  metrics.forEach(metric => {
    trends[metric] = {
      daily: [],
      overall: {
        trend: 'stable', // stable, improving, degrading
        changePercent: 0,
      },
    };

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = Date.now() - i * dayMs;
      const dayEnd = dayStart + dayMs;

      const dayData = data.filter(
        point =>
          point.timestamp >= dayStart &&
          point.timestamp < dayEnd &&
          point.metrics[metric.toLowerCase()]
      );

      if (dayData.length > 0) {
        const values = dayData.map(d => d.metrics[metric.toLowerCase()].value);
        trends[metric].daily.push({
          date: new Date(dayStart).toISOString().split('T')[0],
          p50: calculateP50(values),
          p95: calculateP95(values),
          count: values.length,
        });
      }
    }

    // 计算整体趋势
    if (trends[metric].daily.length >= 7) {
      const firstWeek = trends[metric].daily.slice(0, 7);
      const lastWeek = trends[metric].daily.slice(-7);

      const firstWeekAvg =
        firstWeek.reduce((sum, day) => sum + day.p95, 0) / firstWeek.length;
      const lastWeekAvg =
        lastWeek.reduce((sum, day) => sum + day.p95, 0) / lastWeek.length;

      const changePercent = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;
      trends[metric].overall.changePercent = changePercent;

      if (changePercent > 5) {
        trends[metric].overall.trend = 'degrading';
      } else if (changePercent < -5) {
        trends[metric].overall.trend = 'improving';
      } else {
        trends[metric].overall.trend = 'stable';
      }
    }
  });

  return trends;
}

/**
 * 生成门禁报告
 */
function generateReport(baseline, recent, gateResults, trends) {
  const report = {
    timestamp: new Date().toISOString(),
    gateConfig: GATE_CONFIG,
    baseline: {
      windowDays: GATE_CONFIG.baseline.windowDays,
      sampleSize: baseline.sampleSize,
      metrics: baseline.metrics,
    },
    recent: {
      sampleSize: recent.sampleSize,
      metrics: recent.metrics,
    },
    gateResults,
    trends,
    recommendations: [],
  };

  // 生成建议
  if (gateResults.failures.length > 0) {
    report.recommendations.push({
      type: 'critical',
      message: '检测到严重性能回归，建议立即调查',
      actions: [
        '检查最近的代码变更',
        '验证第三方依赖更新',
        '检查CDN和网络配置',
        '分析用户群体变化',
      ],
    });
  }

  if (gateResults.warnings.length > 0) {
    report.recommendations.push({
      type: 'warning',
      message: '检测到性能警告，建议优化',
      actions: [
        '分析性能瓶颈',
        '考虑代码分割',
        '优化图片和资源加载',
        '检查数据库查询性能',
      ],
    });
  }

  // 趋势建议
  Object.entries(trends).forEach(([metric, data]) => {
    if (data.overall.trend === 'degrading') {
      report.recommendations.push({
        type: 'trend',
        message: `${metric}指标呈下降趋势`,
        changePercent: data.overall.changePercent,
        actions: [`关注${metric}性能优化`],
      });
    }
  });

  return report;
}

/**
 * 生成Markdown摘要
 */
function generateMarkdownSummary(report) {
  const { gateResults, baseline, recent, trends } = report;

  let markdown = `# Web Vitals CI门禁报告
  
生成时间: ${new Date().toLocaleString()}

## 门禁结果

**状态**: ${gateResults.passed ? '✅ 通过' : '❌ 失败'}

- 总检查项: ${gateResults.summary.totalChecks}
- 通过: ${gateResults.summary.passedChecks}
- 警告: ${gateResults.summary.warningChecks}
- 失败: ${gateResults.summary.failedChecks}

`;

  // 失败项详情
  if (gateResults.failures.length > 0) {
    markdown += `## 🚨 阻断问题\n\n`;
    gateResults.failures.forEach((failure, index) => {
      markdown += `### ${index + 1}. ${failure.metric}
- **基线P95**: ${failure.baselineValue.toFixed(2)}
- **当前P95**: ${failure.recentValue.toFixed(2)}
- **回归程度**: ${failure.regressionPercent.toFixed(1)}%
- **问题**: ${failure.reason}

`;
    });
  }

  // 警告项详情
  if (gateResults.warnings.length > 0) {
    markdown += `## ⚠️ 警告项\n\n`;
    gateResults.warnings.forEach((warning, index) => {
      markdown += `### ${index + 1}. ${warning.metric}
- **基线P95**: ${warning.baselineValue.toFixed(2)}
- **当前P95**: ${warning.recentValue.toFixed(2)}
- **变化**: ${warning.regressionPercent.toFixed(1)}%
- **说明**: ${warning.reason}

`;
    });
  }

  // 基线 vs 当前对比
  markdown += `## 📊 性能对比

| 指标 | 基线P95 | 当前P95 | 变化 | 状态 |
|------|---------|---------|------|------|
`;

  ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].forEach(metric => {
    if (
      baseline.metrics[metric].count > 0 &&
      recent.metrics[metric].count > 0
    ) {
      const baseValue = baseline.metrics[metric].p95;
      const recentValue = recent.metrics[metric].p95;
      const change = ((recentValue - baseValue) / baseValue) * 100;
      const status = Math.abs(change) < 5 ? '🟢' : change > 15 ? '🔴' : '🟡';

      markdown += `| ${metric} | ${baseValue.toFixed(2)} | ${recentValue.toFixed(2)} | ${change > 0 ? '+' : ''}${change.toFixed(1)}% | ${status} |\n`;
    }
  });

  // 趋势分析
  markdown += `\n## 📈 趋势分析 (${GATE_CONFIG.baseline.windowDays}天窗口)\n\n`;

  Object.entries(trends).forEach(([metric, data]) => {
    const trendIcon =
      data.overall.trend === 'improving'
        ? '📈'
        : data.overall.trend === 'degrading'
          ? '📉'
          : '➡️';

    markdown += `- **${metric}**: ${trendIcon} ${data.overall.trend} (${data.overall.changePercent > 0 ? '+' : ''}${data.overall.changePercent.toFixed(1)}%)\n`;
  });

  // 建议
  if (report.recommendations.length > 0) {
    markdown += `\n## 💡 建议\n\n`;

    report.recommendations.forEach((rec, index) => {
      const icon =
        rec.type === 'critical' ? '🚨' : rec.type === 'warning' ? '⚠️' : '📊';
      markdown += `### ${index + 1}. ${icon} ${rec.message}\n\n`;

      if (rec.actions && rec.actions.length > 0) {
        rec.actions.forEach(action => {
          markdown += `- ${action}\n`;
        });
      }
      markdown += '\n';
    });
  }

  // 数据摘要
  markdown += `## 📋 数据摘要

- **基线窗口**: ${GATE_CONFIG.baseline.windowDays}天 (${baseline.sampleSize}个样本)
- **当前数据**: 最近24小时 (${recent.sampleSize}个样本)
- **置信度**: ${GATE_CONFIG.baseline.confidenceLevel * 100}%
- **最小样本**: ${GATE_CONFIG.baseline.minSampleSize}

`;

  return markdown;
}

/**
 * 保存报告文件
 */
function saveReports(report, markdown, trends) {
  try {
    // 确保logs目录存在
    const logsDir = path.dirname(GATE_CONFIG.output.reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 保存JSON报告
    fs.writeFileSync(
      GATE_CONFIG.output.reportPath,
      JSON.stringify(report, null, 2)
    );

    // 保存Markdown摘要
    fs.writeFileSync(GATE_CONFIG.output.summaryPath, markdown);

    // 保存趋势数据
    fs.writeFileSync(
      GATE_CONFIG.output.trendPath,
      JSON.stringify(trends, null, 2)
    );

    log('info', '报告已保存', {
      jsonReport: GATE_CONFIG.output.reportPath,
      markdownSummary: GATE_CONFIG.output.summaryPath,
      trendsData: GATE_CONFIG.output.trendPath,
    });
  } catch (error) {
    log('error', '报告保存失败', { error: error.message });
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  const command = process.argv[2] || 'check';

  try {
    console.log('🔍 Web Vitals CI门禁启动...');
    log('info', 'Web Vitals门禁检查开始', { command });

    switch (command) {
      case 'check':
      case undefined:
        // 1. 加载历史数据
        log('info', '加载Web Vitals历史数据...');
        const data = loadWebVitalsData();

        if (data.length === 0) {
          throw new Error('没有可用的Web Vitals数据');
        }

        // 2. 计算基线
        log('info', '计算性能基线...');
        const baseline = calculateBaseline(data);

        // 3. 计算最近性能
        log('info', '分析最近性能数据...');
        const recent = calculateRecentPerformance(data);

        if (!recent) {
          throw new Error('没有最近的性能数据可供分析');
        }

        // 4. 执行门禁检查
        log('info', '执行门禁检查...');
        const gateResults = performGateCheck(baseline, recent);

        // 5. 生成趋势分析
        log('info', '生成趋势分析...');
        const trends = generateTrendData(data);

        // 6. 生成报告
        log('info', '生成门禁报告...');
        const report = generateReport(baseline, recent, gateResults, trends);
        const markdown = generateMarkdownSummary(report);

        // 7. 保存报告
        saveReports(report, markdown, trends);

        // 8. 输出结果
        console.log('\\n📊 Web Vitals门禁检查结果');
        console.log('================================');
        console.log(`状态: ${gateResults.passed ? '✅ 通过' : '❌ 失败'}`);
        console.log(`总检查项: ${gateResults.summary.totalChecks}`);
        console.log(`通过: ${gateResults.summary.passedChecks}`);
        console.log(`警告: ${gateResults.summary.warningChecks}`);
        console.log(`失败: ${gateResults.summary.failedChecks}`);

        if (gateResults.failures.length > 0) {
          console.log('\\n🚨 阻断问题:');
          gateResults.failures.forEach(failure => {
            console.log(
              `  - ${failure.metric}: P95回归${failure.regressionPercent.toFixed(1)}%`
            );
          });
        }

        if (gateResults.warnings.length > 0) {
          console.log('\\n⚠️ 警告:');
          gateResults.warnings.forEach(warning => {
            console.log(`  - ${warning.metric}: ${warning.reason}`);
          });
        }

        console.log(`\\n📋 详细报告: ${GATE_CONFIG.output.reportPath}`);
        console.log(`📄 摘要: ${GATE_CONFIG.output.summaryPath}`);

        // 根据门禁结果设置退出码
        process.exit(gateResults.passed ? 0 : 1);

      case 'baseline':
        // 仅计算和显示基线
        const baselineData = loadWebVitalsData();
        const baselineOnly = calculateBaseline(baselineData);

        console.log('\\n📊 当前性能基线');
        console.log('==================');
        console.log(`窗口: ${GATE_CONFIG.baseline.windowDays}天`);
        console.log(`样本: ${baselineOnly.sampleSize}个`);

        ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].forEach(metric => {
          const m = baselineOnly.metrics[metric];
          if (m.count > 0) {
            console.log(
              `${metric}: P50=${m.p50.toFixed(2)}, P95=${m.p95.toFixed(2)} (${m.count}个样本)`
            );
          }
        });

        break;

      case 'trends':
        // 仅显示趋势
        const trendData = loadWebVitalsData();
        const trendsOnly = generateTrendData(trendData);

        console.log('\\n📈 性能趋势分析');
        console.log('==================');

        Object.entries(trendsOnly).forEach(([metric, data]) => {
          console.log(
            `${metric}: ${data.overall.trend} (${data.overall.changePercent > 0 ? '+' : ''}${data.overall.changePercent.toFixed(1)}%)`
          );
        });

        break;

      default:
        console.log(`
Web Vitals CI门禁工具

用法: node scripts/web-vitals-gate.mjs [command]

命令:
  check      执行完整门禁检查 (默认)
  baseline   显示当前基线
  trends     显示性能趋势
  
示例:
  npm run guard:web-vitals           # 执行完整门禁
  node scripts/web-vitals-gate.mjs baseline    # 查看基线
`);
        break;
    }
  } catch (error) {
    log('error', 'Web Vitals门禁检查失败', {
      error: error.message,
      stack: error.stack,
    });

    console.error(`\\n❌ 门禁检查失败: ${error.message}`);
    process.exit(1);
  }
}

// 直接运行检查
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}

export {
  loadWebVitalsData,
  calculateBaseline,
  calculateRecentPerformance,
  performGateCheck,
  generateTrendData,
  GATE_CONFIG,
};
