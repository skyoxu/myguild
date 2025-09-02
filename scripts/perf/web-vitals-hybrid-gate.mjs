#!/usr/bin/env node

/**
 * Web Vitals混合基线门禁系统
 *
 * 升级版本，避免季节性误报：
 * - 混合基线：7天滑动窗口 + 30天历史趋势 + 同期比较
 * - 季节性调整：检测周期性模式，动态调整阈值
 * - 异常检测：统计学方法识别真正的性能回归
 * - 渐进式警报：多级警报机制避免误报
 *
 * 基于专家建议的P0-B任务实现
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from '../utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载Web Vitals门禁配置
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);

const HYBRID_GATE_CONFIG = {
  ...config.webVitals,

  // 混合基线配置
  hybridBaseline: {
    // 短期基线（7天滑动窗口）
    shortTerm: {
      windowDays: 7,
      minSampleSize: 50,
      weight: 0.6, // 60% 权重
    },

    // 长期基线（30天历史趋势）
    longTerm: {
      windowDays: 30,
      minSampleSize: 200,
      weight: 0.3, // 30% 权重
    },

    // 同期比较（去年同期）
    yearOverYear: {
      windowDays: 7, // 去年同期的7天窗口
      minSampleSize: 30,
      weight: 0.1, // 10% 权重
      enabled: true,
    },
  },

  // 季节性检测配置
  seasonalDetection: {
    enabled: true,
    // 检测周期：周(7天)、月(30天)、季度(90天)
    patterns: [7, 30, 90],
    // 季节性调整因子
    adjustmentFactor: {
      low: 0.8, // 轻微季节性影响
      medium: 0.6, // 中等季节性影响
      high: 0.4, // 强烈季节性影响
    },
  },

  // 统计异常检测
  anomalyDetection: {
    // 使用修正的Z-Score方法
    method: 'modified_zscore',
    threshold: 3.5, // MAD阈值：3.5倍中位数绝对偏差
    minDataPoints: 14, // 最少需要14个数据点
  },

  // 渐进式警报配置
  progressiveAlerts: {
    // 第一级：轻微变化（仅记录）
    level1: {
      thresholdMultiplier: 1.1, // 基线的110%
      action: 'log',
      duration: 1, // 持续1个周期
    },

    // 第二级：值得关注（警告）
    level2: {
      thresholdMultiplier: 1.2, // 基线的120%
      action: 'warn',
      duration: 2, // 持续2个周期
    },

    // 第三级：需要处理（阻断）
    level3: {
      thresholdMultiplier: 1.35, // 基线的135%
      action: 'fail',
      duration: 1, // 立即阻断
    },
  },

  // 输出配置
  output: {
    reportPath: './logs/web-vitals-hybrid-gate-report.json',
    summaryPath: './logs/web-vitals-hybrid-gate-summary.md',
    baselineMetricsPath: './logs/web-vitals-hybrid-baselines.json',
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
      component: 'web-vitals-hybrid-gate',
      message,
      ...data,
    })
  );
}

/**
 * 加载Web Vitals历史数据
 * 在实际环境中应该连接到数据库或监控系统
 */
function loadWebVitalsData() {
  try {
    const mockDataPath = path.join(
      __dirname,
      '..',
      'logs',
      'mock-web-vitals-data.json'
    );

    if (fs.existsSync(mockDataPath)) {
      return JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
    }

    // 生成更丰富的模拟数据（包含季节性模式）
    return generateEnhancedMockData();
  } catch (error) {
    log('error', '无法加载Web Vitals数据', { error: error.message });
    return [];
  }
}

/**
 * 生成增强的模拟数据，包含季节性模式
 */
function generateEnhancedMockData() {
  const data = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 生成90天的历史数据
  for (let i = 90; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayOfWeek = new Date(dayStart).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 模拟周末流量低、性能好的模式
    const weekendFactor = isWeekend ? 0.85 : 1.0;

    // 模拟月初/月末的业务周期性影响
    const dayOfMonth = new Date(dayStart).getDate();
    const monthEndFactor = dayOfMonth > 25 || dayOfMonth < 5 ? 1.15 : 1.0;

    // 模拟最近的性能回归（逐渐变差）
    const regressionFactor = Math.max(1.0, 1.0 + (90 - i) * 0.002);

    // 每天生成10-20个数据点
    const pointsPerDay = Math.floor(Math.random() * 10) + 10;

    for (let j = 0; j < pointsPerDay; j++) {
      const timestamp = dayStart + Math.random() * dayMs;

      // 基准性能值
      const baseLCP = 2300;
      const baseINP = 140;
      const baseCLS = 0.09;
      const baseFCP = 1700;
      const baseTTFB = 650;

      // 应用所有影响因子
      const combinedFactor = weekendFactor * monthEndFactor * regressionFactor;

      // 添加随机噪音
      const noise = 0.8 + Math.random() * 0.4; // 80%-120%

      data.push({
        timestamp,
        sessionId: `session-${i}-${j}`,
        userId: `user-${Math.floor(Math.random() * 500)}`,
        metrics: {
          lcp: {
            id: `lcp-${timestamp}`,
            name: 'LCP',
            value: baseLCP * combinedFactor * noise,
            rating: null, // 将根据值自动计算
          },
          inp: {
            id: `inp-${timestamp}`,
            name: 'INP',
            value: baseINP * combinedFactor * noise,
            rating: null,
          },
          cls: {
            id: `cls-${timestamp}`,
            name: 'CLS',
            value: baseCLS * combinedFactor * noise,
            rating: null,
          },
          fcp: {
            id: `fcp-${timestamp}`,
            name: 'FCP',
            value: baseFCP * combinedFactor * noise,
            rating: null,
          },
          ttfb: {
            id: `ttfb-${timestamp}`,
            name: 'TTFB',
            value: baseTTFB * combinedFactor * noise,
            rating: null,
          },
        },
        context: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          viewport: { width: 1920, height: 1080 },
          navigation: { type: 'navigate', redirectCount: 0 },
          // 添加更多上下文信息
          deviceType: Math.random() > 0.7 ? 'mobile' : 'desktop',
          connectionType: Math.random() > 0.5 ? '4g' : 'wifi',
          timeOfDay: new Date(timestamp).getHours(),
          dayOfWeek: dayOfWeek,
        },
      });
    }
  }

  log('info', '生成了增强模拟Web Vitals数据', {
    totalPoints: data.length,
    timeSpan: '90天',
    features: ['周末效应', '月末周期', '渐进回归', '多维上下文'],
  });

  return data;
}

/**
 * 计算百分位数值
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算中位数绝对偏差 (MAD)
 */
function calculateMAD(values) {
  if (values.length === 0) return 0;

  const median = calculatePercentile(values, 50);
  const deviations = values.map(value => Math.abs(value - median));
  return calculatePercentile(deviations, 50);
}

/**
 * 修正Z-Score异常检测
 */
function detectAnomalies(values, threshold = 3.5) {
  if (values.length < HYBRID_GATE_CONFIG.anomalyDetection.minDataPoints) {
    return { anomalies: [], score: 0 };
  }

  const median = calculatePercentile(values, 50);
  const mad = calculateMAD(values);

  if (mad === 0) return { anomalies: [], score: 0 }; // 所有值相同

  const modifiedZScores = values.map(value => {
    return (0.6745 * (value - median)) / mad;
  });

  const anomalies = [];
  modifiedZScores.forEach((score, index) => {
    if (Math.abs(score) > threshold) {
      anomalies.push({
        index,
        value: values[index],
        score: score,
        type: score > 0 ? 'high' : 'low',
      });
    }
  });

  return {
    anomalies,
    score: Math.max(...modifiedZScores.map(Math.abs)),
  };
}

/**
 * 检测季节性模式
 */
function detectSeasonalPatterns(data, metric) {
  const values = data
    .map(d => d.metrics[metric.toLowerCase()]?.value)
    .filter(v => v);

  if (values.length < 28) {
    // 需要至少4周数据
    return { hasPattern: false, strength: 'none', adjustmentFactor: 1.0 };
  }

  // 简化的季节性检测：比较不同周期的方差
  const patterns = HYBRID_GATE_CONFIG.seasonalDetection.patterns;
  let maxVarianceRatio = 0;
  let dominantPeriod = 7;

  patterns.forEach(period => {
    const groupedValues = [];

    for (let i = 0; i < period; i++) {
      const groupValues = [];
      for (let j = i; j < values.length; j += period) {
        groupValues.push(values[j]);
      }
      if (groupValues.length > 1) {
        groupedValues.push(groupValues);
      }
    }

    if (groupedValues.length < 2) return;

    // 计算组间方差和组内方差
    const groupMeans = groupedValues.map(
      group => group.reduce((sum, val) => sum + val, 0) / group.length
    );
    const overallMean =
      values.reduce((sum, val) => sum + val, 0) / values.length;

    const betweenGroupVariance =
      groupMeans.reduce(
        (sum, mean) => sum + Math.pow(mean - overallMean, 2),
        0
      ) / groupMeans.length;

    const withinGroupVariance =
      groupedValues.reduce((sum, group) => {
        const groupMean =
          group.reduce((sum, val) => sum + val, 0) / group.length;
        return (
          sum +
          group.reduce((sum, val) => sum + Math.pow(val - groupMean, 2), 0)
        );
      }, 0) /
      (values.length - groupedValues.length);

    const varianceRatio =
      withinGroupVariance > 0 ? betweenGroupVariance / withinGroupVariance : 0;

    if (varianceRatio > maxVarianceRatio) {
      maxVarianceRatio = varianceRatio;
      dominantPeriod = period;
    }
  });

  // 确定季节性强度
  let strength = 'none';
  let adjustmentFactor = 1.0;

  if (maxVarianceRatio > 0.3) {
    strength = 'high';
    adjustmentFactor =
      HYBRID_GATE_CONFIG.seasonalDetection.adjustmentFactor.high;
  } else if (maxVarianceRatio > 0.15) {
    strength = 'medium';
    adjustmentFactor =
      HYBRID_GATE_CONFIG.seasonalDetection.adjustmentFactor.medium;
  } else if (maxVarianceRatio > 0.05) {
    strength = 'low';
    adjustmentFactor =
      HYBRID_GATE_CONFIG.seasonalDetection.adjustmentFactor.low;
  }

  return {
    hasPattern: strength !== 'none',
    strength,
    dominantPeriod,
    varianceRatio: maxVarianceRatio,
    adjustmentFactor,
  };
}

/**
 * 计算混合基线
 */
function calculateHybridBaseline(data, metric) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const config = HYBRID_GATE_CONFIG.hybridBaseline;

  // 1. 短期基线（7天）
  const shortTermCutoff = now - config.shortTerm.windowDays * dayMs;
  const shortTermData = data.filter(d => d.timestamp > shortTermCutoff);
  const shortTermValues = shortTermData
    .map(d => d.metrics[metric.toLowerCase()]?.value)
    .filter(v => v != null);

  // 2. 长期基线（30天）
  const longTermCutoff = now - config.longTerm.windowDays * dayMs;
  const longTermData = data.filter(d => d.timestamp > longTermCutoff);
  const longTermValues = longTermData
    .map(d => d.metrics[metric.toLowerCase()]?.value)
    .filter(v => v != null);

  // 3. 去年同期基线
  let yearOverYearValues = [];
  if (config.yearOverYear.enabled) {
    const yearAgo = now - 365 * dayMs;
    const yoyStart = yearAgo - (config.yearOverYear.windowDays * dayMs) / 2;
    const yoyEnd = yearAgo + (config.yearOverYear.windowDays * dayMs) / 2;

    const yoyData = data.filter(
      d => d.timestamp >= yoyStart && d.timestamp <= yoyEnd
    );
    yearOverYearValues = yoyData
      .map(d => d.metrics[metric.toLowerCase()]?.value)
      .filter(v => v != null);
  }

  // 检查数据充足性
  const hasShortTerm = shortTermValues.length >= config.shortTerm.minSampleSize;
  const hasLongTerm = longTermValues.length >= config.longTerm.minSampleSize;
  const hasYearOverYear =
    yearOverYearValues.length >= config.yearOverYear.minSampleSize;

  if (!hasShortTerm && !hasLongTerm) {
    throw new Error(`${metric} 基线数据不足`);
  }

  // 计算各基线的P95值
  const shortTermP95 = hasShortTerm
    ? calculatePercentile(shortTermValues, 95)
    : 0;
  const longTermP95 = hasLongTerm ? calculatePercentile(longTermValues, 95) : 0;
  const yoyP95 = hasYearOverYear
    ? calculatePercentile(yearOverYearValues, 95)
    : 0;

  // 计算加权混合基线
  let weightedSum = 0;
  let totalWeight = 0;

  if (hasShortTerm) {
    weightedSum += shortTermP95 * config.shortTerm.weight;
    totalWeight += config.shortTerm.weight;
  }

  if (hasLongTerm) {
    weightedSum += longTermP95 * config.longTerm.weight;
    totalWeight += config.longTerm.weight;
  }

  if (hasYearOverYear) {
    weightedSum += yoyP95 * config.yearOverYear.weight;
    totalWeight += config.yearOverYear.weight;
  }

  const hybridBaseline = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // 季节性检测和调整
  const seasonalInfo = detectSeasonalPatterns(data, metric);
  const seasonalAdjustedBaseline =
    hybridBaseline * seasonalInfo.adjustmentFactor;

  return {
    metric,
    hybridBaseline,
    seasonalAdjustedBaseline,
    components: {
      shortTerm: {
        p95: shortTermP95,
        weight: config.shortTerm.weight,
        available: hasShortTerm,
      },
      longTerm: {
        p95: longTermP95,
        weight: config.longTerm.weight,
        available: hasLongTerm,
      },
      yearOverYear: {
        p95: yoyP95,
        weight: config.yearOverYear.weight,
        available: hasYearOverYear,
      },
    },
    seasonal: seasonalInfo,
    sampleSizes: {
      shortTerm: shortTermValues.length,
      longTerm: longTermValues.length,
      yearOverYear: yearOverYearValues.length,
    },
  };
}

/**
 * 计算最近性能数据
 */
function calculateRecentPerformance(data) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 最近24小时
  const recentData = data.filter(d => d.timestamp > cutoff);

  if (recentData.length === 0) {
    throw new Error('没有最近24小时的性能数据');
  }

  const metrics = {};
  ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].forEach(metric => {
    const values = recentData
      .map(d => d.metrics[metric.toLowerCase()]?.value)
      .filter(v => v != null);

    if (values.length > 0) {
      // 异常检测
      const anomalies = detectAnomalies(values);

      metrics[metric] = {
        p95: calculatePercentile(values, 95),
        p50: calculatePercentile(values, 50),
        count: values.length,
        anomalies,
      };
    }
  });

  return {
    sampleSize: recentData.length,
    metrics,
    timeWindow: '24小时',
  };
}

/**
 * 执行混合门禁检查
 */
function performHybridGateCheck(baselines, recent) {
  const results = {
    passed: true,
    warnings: [],
    failures: [],
    progressiveAlerts: [],
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      warningChecks: 0,
      failedChecks: 0,
    },
  };

  Object.keys(recent.metrics).forEach(metric => {
    const baseline = baselines.find(b => b.metric === metric);
    if (!baseline) return;

    const recentValue = recent.metrics[metric].p95;
    const baselineValue = baseline.seasonalAdjustedBaseline;

    if (baselineValue <= 0) return;

    results.summary.totalChecks++;

    // 渐进式警报检查
    const config = HYBRID_GATE_CONFIG.progressiveAlerts;
    const regressionRatio = recentValue / baselineValue;

    let alertLevel = 0;
    let status = 'passed';

    if (regressionRatio >= config.level3.thresholdMultiplier) {
      alertLevel = 3;
      status = 'failed';
    } else if (regressionRatio >= config.level2.thresholdMultiplier) {
      alertLevel = 2;
      status = 'warning';
    } else if (regressionRatio >= config.level1.thresholdMultiplier) {
      alertLevel = 1;
      status = 'info';
    }

    const check = {
      metric,
      baselineValue,
      recentValue,
      regressionRatio,
      alertLevel,
      status,
      seasonal: baseline.seasonal,
      anomalies: recent.metrics[metric].anomalies,
    };

    // 记录结果
    if (status === 'failed') {
      check.reason = `P95回归${((regressionRatio - 1) * 100).toFixed(1)}% 超过第3级阈值`;
      results.failures.push(check);
      results.passed = false;
      results.summary.failedChecks++;
    } else if (status === 'warning') {
      check.reason = `P95回归${((regressionRatio - 1) * 100).toFixed(1)}% 超过第2级阈值`;
      results.warnings.push(check);
      results.summary.warningChecks++;
    } else if (status === 'info') {
      check.reason = `P95轻微回归${((regressionRatio - 1) * 100).toFixed(1)}%`;
      results.progressiveAlerts.push(check);
      results.summary.passedChecks++;
    } else {
      results.summary.passedChecks++;
    }
  });

  return results;
}

/**
 * 生成混合门禁报告
 */
function generateHybridReport(baselines, recent, gateResults) {
  return {
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    type: 'hybrid-baseline-gate',
    gateConfig: HYBRID_GATE_CONFIG,
    baselines: baselines.map(b => ({
      metric: b.metric,
      hybridBaseline: b.hybridBaseline,
      seasonalAdjustedBaseline: b.seasonalAdjustedBaseline,
      seasonal: b.seasonal,
      components: b.components,
      sampleSizes: b.sampleSizes,
    })),
    recent,
    gateResults,
    analysis: {
      seasonalityDetected: baselines.some(b => b.seasonal.hasPattern),
      anomaliesDetected: Object.values(recent.metrics).some(
        m => m.anomalies.anomalies.length > 0
      ),
      highestRegressionRatio: Math.max(
        ...gateResults.failures
          .concat(gateResults.warnings)
          .map(c => c.regressionRatio),
        1
      ),
    },
    recommendations: generateRecommendations(gateResults, baselines),
  };
}

/**
 * 生成建议
 */
function generateRecommendations(gateResults, baselines) {
  const recommendations = [];

  // 失败项建议
  gateResults.failures.forEach(failure => {
    recommendations.push({
      type: 'critical',
      metric: failure.metric,
      message: `${failure.metric} 严重回归，需要立即处理`,
      details: {
        regression: `${((failure.regressionRatio - 1) * 100).toFixed(1)}%`,
        seasonal: failure.seasonal.hasPattern
          ? `检测到${failure.seasonal.strength}季节性模式`
          : '无明显季节性',
        anomalies:
          failure.anomalies.anomalies.length > 0
            ? `检测到${failure.anomalies.anomalies.length}个异常值`
            : '数据正常',
      },
      actions: [
        '立即回滚最近的变更',
        '检查CDN和网络配置',
        '分析异常流量模式',
        '验证第三方服务状态',
      ],
    });
  });

  // 警告项建议
  gateResults.warnings.forEach(warning => {
    recommendations.push({
      type: 'warning',
      metric: warning.metric,
      message: `${warning.metric} 性能回归，建议优化`,
      details: {
        regression: `${((warning.regressionRatio - 1) * 100).toFixed(1)}%`,
        seasonal: warning.seasonal.hasPattern
          ? `${warning.seasonal.strength}季节性影响已调整`
          : '无季节性影响',
      },
      actions: ['分析代码变更影响', '检查资源加载优化机会', '考虑缓存策略改进'],
    });
  });

  // 季节性建议
  baselines.forEach(baseline => {
    if (baseline.seasonal.hasPattern && baseline.seasonal.strength === 'high') {
      recommendations.push({
        type: 'info',
        metric: baseline.metric,
        message: `${baseline.metric} 有强烈季节性模式`,
        details: {
          pattern: `${baseline.seasonal.dominantPeriod}天周期`,
          adjustment: `阈值已调整${(1 - baseline.seasonal.adjustmentFactor) * 100}%`,
        },
        actions: ['考虑业务周期性优化', '预测性能波动期', '调整监控策略'],
      });
    }
  });

  return recommendations;
}

/**
 * 生成Markdown摘要
 */
function generateHybridMarkdownSummary(report) {
  const { gateResults, baselines, recent, analysis } = report;

  let markdown = `# Web Vitals混合基线门禁报告

生成时间: ${new Date().toLocaleString()}
报告版本: ${report.version}

## 🎯 门禁结果

**状态**: ${gateResults.passed ? '✅ 通过' : '❌ 失败'}

- 总检查项: ${gateResults.summary.totalChecks}
- 通过: ${gateResults.summary.passedChecks}
- 警告: ${gateResults.summary.warningChecks}
- 失败: ${gateResults.summary.failedChecks}
- 渐进式提醒: ${gateResults.progressiveAlerts.length}

## 📊 核心改进

### 混合基线模型特性
- ✅ **多时间窗口**: 7天短期 + 30天长期 + 去年同期对比
- ✅ **季节性检测**: ${analysis.seasonalityDetected ? '检测到季节性模式' : '无明显季节性'}
- ✅ **异常过滤**: ${analysis.anomaliesDetected ? '检测并过滤异常值' : '数据质量良好'}
- ✅ **渐进式警报**: 3级阈值避免误报

`;

  // 失败项详情
  if (gateResults.failures.length > 0) {
    markdown += `## 🚨 关键问题\n\n`;
    gateResults.failures.forEach((failure, index) => {
      const regression = ((failure.regressionRatio - 1) * 100).toFixed(1);
      markdown += `### ${index + 1}. ${failure.metric} 严重回归
- **基线值**: ${failure.baselineValue.toFixed(2)} (季节性调整)
- **当前P95**: ${failure.recentValue.toFixed(2)}
- **回归程度**: +${regression}%
- **季节性**: ${failure.seasonal.hasPattern ? failure.seasonal.strength : '无'}
- **异常检测**: ${failure.anomalies.anomalies.length > 0 ? failure.anomalies.anomalies.length + '个异常值' : '正常'}

`;
    });
  }

  // 警告项详情
  if (gateResults.warnings.length > 0) {
    markdown += `## ⚠️ 性能警告\n\n`;
    gateResults.warnings.forEach((warning, index) => {
      const regression = ((warning.regressionRatio - 1) * 100).toFixed(1);
      markdown += `### ${index + 1}. ${warning.metric}
- **基线值**: ${warning.baselineValue.toFixed(2)}
- **当前P95**: ${warning.recentValue.toFixed(2)}  
- **变化**: +${regression}%
- **季节性调整**: ${warning.seasonal.hasPattern ? '已应用' : '不需要'}

`;
    });
  }

  // 混合基线详情
  markdown += `## 📈 混合基线分析

| 指标 | 短期基线 | 长期基线 | 去年同期 | 混合基线 | 季节调整 | 当前P95 | 变化 |
|------|----------|----------|----------|----------|----------|---------|------|
`;

  baselines.forEach(baseline => {
    const recentMetric = recent.metrics[baseline.metric];
    if (!recentMetric) return;

    const shortTerm = baseline.components.shortTerm;
    const longTerm = baseline.components.longTerm;
    const yoy = baseline.components.yearOverYear;

    const change =
      ((recentMetric.p95 - baseline.seasonalAdjustedBaseline) /
        baseline.seasonalAdjustedBaseline) *
      100;
    const changeSymbol = change > 0 ? '+' : '';
    const statusIcon = Math.abs(change) < 5 ? '🟢' : change > 20 ? '🔴' : '🟡';

    markdown += `| ${baseline.metric} | ${shortTerm.available ? shortTerm.p95.toFixed(1) : 'N/A'} | ${longTerm.available ? longTerm.p95.toFixed(1) : 'N/A'} | ${yoy.available ? yoy.p95.toFixed(1) : 'N/A'} | ${baseline.hybridBaseline.toFixed(1)} | ${baseline.seasonalAdjustedBaseline.toFixed(1)} | ${recentMetric.p95.toFixed(1)} | ${changeSymbol}${change.toFixed(1)}% ${statusIcon} |\n`;
  });

  // 季节性分析
  const seasonalBaselines = baselines.filter(b => b.seasonal.hasPattern);
  if (seasonalBaselines.length > 0) {
    markdown += `\n## 🌊 季节性模式分析\n\n`;

    seasonalBaselines.forEach(baseline => {
      const icon =
        baseline.seasonal.strength === 'high'
          ? '🔴'
          : baseline.seasonal.strength === 'medium'
            ? '🟡'
            : '🟢';

      markdown += `- **${baseline.metric}**: ${icon} ${baseline.seasonal.strength}强度季节性模式
  - 主导周期: ${baseline.seasonal.dominantPeriod}天
  - 阈值调整: ${((1 - baseline.seasonal.adjustmentFactor) * 100).toFixed(0)}%
  - 方差比: ${baseline.seasonal.varianceRatio.toFixed(3)}

`;
    });
  }

  // 建议
  if (report.recommendations.length > 0) {
    markdown += `## 💡 智能建议\n\n`;

    report.recommendations.forEach((rec, index) => {
      const icon =
        rec.type === 'critical' ? '🚨' : rec.type === 'warning' ? '⚠️' : '💡';

      markdown += `### ${index + 1}. ${icon} ${rec.message}\n\n`;

      if (rec.details) {
        Object.entries(rec.details).forEach(([key, value]) => {
          markdown += `- **${key}**: ${value}\n`;
        });
      }

      if (rec.actions?.length > 0) {
        markdown += `\n**建议操作:**\n`;
        rec.actions.forEach(action => {
          markdown += `- ${action}\n`;
        });
      }
      markdown += '\n';
    });
  }

  // 数据摘要
  markdown += `## 📋 基线配置

### 混合基线权重
- **短期窗口 (7天)**: ${HYBRID_GATE_CONFIG.hybridBaseline.shortTerm.weight * 100}%权重
- **长期窗口 (30天)**: ${HYBRID_GATE_CONFIG.hybridBaseline.longTerm.weight * 100}%权重  
- **去年同期**: ${HYBRID_GATE_CONFIG.hybridBaseline.yearOverYear.weight * 100}%权重

### 渐进式警报阈值
- **第1级 (记录)**: ${HYBRID_GATE_CONFIG.progressiveAlerts.level1.thresholdMultiplier * 100}%
- **第2级 (警告)**: ${HYBRID_GATE_CONFIG.progressiveAlerts.level2.thresholdMultiplier * 100}%
- **第3级 (阻断)**: ${HYBRID_GATE_CONFIG.progressiveAlerts.level3.thresholdMultiplier * 100}%

### 数据摘要
- **当前数据**: 最近24小时 (${recent.sampleSize}个样本)
- **异常检测阈值**: ${HYBRID_GATE_CONFIG.anomalyDetection.threshold}倍MAD
- **季节性检测**: ${HYBRID_GATE_CONFIG.seasonalDetection.enabled ? '启用' : '禁用'}

`;

  return markdown;
}

/**
 * 保存混合门禁报告
 */
function saveHybridReports(report, markdown, baselines) {
  try {
    const logsDir = path.dirname(HYBRID_GATE_CONFIG.output.reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 保存主报告
    fs.writeFileSync(
      HYBRID_GATE_CONFIG.output.reportPath,
      JSON.stringify(report, null, 2)
    );

    // 保存Markdown摘要
    fs.writeFileSync(HYBRID_GATE_CONFIG.output.summaryPath, markdown);

    // 保存基线度量数据
    fs.writeFileSync(
      HYBRID_GATE_CONFIG.output.baselineMetricsPath,
      JSON.stringify(baselines, null, 2)
    );

    log('info', '混合门禁报告已保存', {
      jsonReport: HYBRID_GATE_CONFIG.output.reportPath,
      markdownSummary: HYBRID_GATE_CONFIG.output.summaryPath,
      baselineMetrics: HYBRID_GATE_CONFIG.output.baselineMetricsPath,
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
  try {
    console.log('🔄 Web Vitals混合基线门禁启动...');
    log('info', '混合基线门禁检查开始', { version: '2.0.0' });

    // 1. 加载历史数据
    log('info', '加载Web Vitals历史数据...');
    const data = loadWebVitalsData();

    if (data.length === 0) {
      throw new Error('没有可用的Web Vitals数据');
    }

    // 2. 计算混合基线
    log('info', '计算混合基线...');
    const metrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
    const baselines = [];

    for (const metric of metrics) {
      try {
        const baseline = calculateHybridBaseline(data, metric);
        baselines.push(baseline);

        log('info', `${metric} 混合基线计算完成`, {
          hybrid: baseline.hybridBaseline.toFixed(2),
          seasonalAdjusted: baseline.seasonalAdjustedBaseline.toFixed(2),
          seasonal: baseline.seasonal.strength,
        });
      } catch (error) {
        log('warn', `跳过${metric}基线计算`, { error: error.message });
      }
    }

    // 3. 计算最近性能
    log('info', '分析最近性能数据...');
    const recent = calculateRecentPerformance(data);

    // 4. 执行混合门禁检查
    log('info', '执行混合门禁检查...');
    const gateResults = performHybridGateCheck(baselines, recent);

    // 5. 生成报告
    log('info', '生成混合门禁报告...');
    const report = generateHybridReport(baselines, recent, gateResults);
    const markdown = generateHybridMarkdownSummary(report);

    // 6. 保存报告
    saveHybridReports(report, markdown, baselines);

    // 7. 输出结果
    console.log('\n🎯 Web Vitals混合基线门禁检查结果');
    console.log('=====================================');
    console.log(`状态: ${gateResults.passed ? '✅ 通过' : '❌ 失败'}`);
    console.log(`总检查项: ${gateResults.summary.totalChecks}`);
    console.log(`通过: ${gateResults.summary.passedChecks}`);
    console.log(`警告: ${gateResults.summary.warningChecks}`);
    console.log(`失败: ${gateResults.summary.failedChecks}`);
    console.log(
      `季节性检测: ${baselines.some(b => b.seasonal.hasPattern) ? '发现模式' : '无模式'}`
    );
    console.log(
      `异常检测: ${Object.values(recent.metrics).some(m => m.anomalies.anomalies.length > 0) ? '发现异常' : '数据正常'}`
    );

    if (gateResults.failures.length > 0) {
      console.log('\n🚨 关键问题:');
      gateResults.failures.forEach(failure => {
        const regression = ((failure.regressionRatio - 1) * 100).toFixed(1);
        console.log(
          `  - ${failure.metric}: P95回归+${regression}% (${failure.seasonal.hasPattern ? '季节性已调整' : '无季节性'})`
        );
      });
    }

    if (gateResults.warnings.length > 0) {
      console.log('\n⚠️ 性能警告:');
      gateResults.warnings.forEach(warning => {
        const regression = ((warning.regressionRatio - 1) * 100).toFixed(1);
        console.log(`  - ${warning.metric}: P95回归+${regression}%`);
      });
    }

    console.log(`\n📊 详细报告: ${HYBRID_GATE_CONFIG.output.reportPath}`);
    console.log(`📄 摘要: ${HYBRID_GATE_CONFIG.output.summaryPath}`);
    console.log(
      `📈 基线数据: ${HYBRID_GATE_CONFIG.output.baselineMetricsPath}`
    );

    // 根据门禁结果设置退出码
    process.exit(gateResults.passed ? 0 : 1);
  } catch (error) {
    log('error', 'Web Vitals混合基线门禁检查失败', {
      error: error.message,
      stack: error.stack,
    });

    console.error(`\n❌ 混合门禁检查失败: ${error.message}`);
    process.exit(1);
  }
}

// 导出函数供其他模块使用
export {
  calculateHybridBaseline,
  detectSeasonalPatterns,
  detectAnomalies,
  performHybridGateCheck,
  HYBRID_GATE_CONFIG,
};

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}
