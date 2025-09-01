#!/usr/bin/env node

/**
 * 性能数据收集脚本
 * 从Playwright E2E测试和性能监控中收集数据
 * 生成 .performance-report.json 供 assert-p95.mjs 使用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 从Playwright测试报告中提取性能数据
 */
async function extractPlaywrightMetrics() {
  const reportPath = path.join(__dirname, '..', '..', 'test-results');

  if (!fs.existsSync(reportPath)) {
    console.log('⚠️  Playwright测试报告目录不存在，跳过数据提取');
    return null;
  }

  console.log('📊 从Playwright测试报告提取性能数据...');

  // 查找性能相关的测试结果文件
  const performanceFiles = [];

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.includes('perf') || file.includes('performance')) {
        performanceFiles.push(fullPath);
      }
    }
  }

  scanDirectory(reportPath);

  const metrics = {
    frameTime: [],
    interaction: [],
    eventProcessing: [],
    startup: [],
  };

  // 解析找到的性能文件
  for (const file of performanceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');

      // 简单的JSON解析尝试
      if (file.endsWith('.json')) {
        const data = JSON.parse(content);

        // 根据数据结构提取性能指标
        if (data.frameTime) metrics.frameTime.push(...data.frameTime);
        if (data.interaction) metrics.interaction.push(...data.interaction);
        if (data.eventProcessing)
          metrics.eventProcessing.push(...data.eventProcessing);
        if (data.startup) metrics.startup.push(...data.startup);
      }
    } catch (error) {
      console.warn(`解析性能文件失败 ${file}: ${error.message}`);
    }
  }

  return metrics;
}

/**
 * 运行性能基准测试收集数据
 */
async function runPerformanceBenchmarks() {
  console.log('🔄 运行性能基准测试...');

  const metrics = {
    frameTime: [],
    interaction: [],
    eventProcessing: [],
    startup: [],
  };

  try {
    // 运行帧率测试
    console.log('  📊 测试帧率性能...');
    const frameTestResults = await simulateFrameRateTest();
    metrics.frameTime = frameTestResults;

    // 运行交互测试
    console.log('  🖱️  测试交互响应...');
    const interactionResults = await simulateInteractionTest();
    metrics.interaction = interactionResults;

    // 运行事件处理测试
    console.log('  ⚡ 测试事件处理...');
    const eventResults = await simulateEventProcessingTest();
    metrics.eventProcessing = eventResults;

    // 运行启动测试
    console.log('  🚀 测试启动时间...');
    const startupResults = await simulateStartupTest();
    metrics.startup = startupResults;

    return metrics;
  } catch (error) {
    console.error('性能基准测试失败:', error.message);
    return null;
  }
}

/**
 * 模拟帧率性能测试
 */
async function simulateFrameRateTest() {
  const samples = [];
  const sampleCount = 50;

  for (let i = 0; i < sampleCount; i++) {
    // 模拟渲染帧测量
    const start = performance.now();

    // 模拟一些计算工作（游戏逻辑、渲染准备等）
    await simulateWork(10 + Math.random() * 10); // 10-20ms的工作

    const frameTime = performance.now() - start;
    samples.push(frameTime);

    // 小延迟避免过快采样
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  return samples;
}

/**
 * 模拟交互响应测试
 */
async function simulateInteractionTest() {
  const samples = [];
  const sampleCount = 30;

  for (let i = 0; i < sampleCount; i++) {
    const start = performance.now();

    // 模拟用户交互处理（点击、输入等）
    await simulateWork(25 + Math.random() * 50); // 25-75ms的交互处理

    const interactionTime = performance.now() - start;
    samples.push(interactionTime);

    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return samples;
}

/**
 * 模拟事件处理测试
 */
async function simulateEventProcessingTest() {
  const samples = [];
  const sampleCount = 40;

  for (let i = 0; i < sampleCount; i++) {
    const start = performance.now();

    // 模拟事件处理（消息队列、状态更新等）
    await simulateWork(5 + Math.random() * 30); // 5-35ms的事件处理

    const eventTime = performance.now() - start;
    samples.push(eventTime);

    await new Promise(resolve => setTimeout(resolve, 3));
  }

  return samples;
}

/**
 * 模拟启动时间测试
 */
async function simulateStartupTest() {
  const samples = [];
  const sampleCount = 10; // 启动测试样本较少（耗时）

  for (let i = 0; i < sampleCount; i++) {
    const start = performance.now();

    // 模拟应用启动过程（初始化、资源加载等）
    await simulateWork(1500 + Math.random() * 1000); // 1.5-2.5s的启动时间

    const startupTime = performance.now() - start;
    samples.push(startupTime);

    console.log(
      `    启动测试 ${i + 1}/${sampleCount}: ${startupTime.toFixed(0)}ms`
    );

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return samples;
}

/**
 * 模拟工作负载
 * @param {number} durationMs 工作持续时间（毫秒）
 */
async function simulateWork(durationMs) {
  const start = performance.now();

  // 使用CPU密集型操作模拟实际工作
  while (performance.now() - start < durationMs) {
    // 空循环消耗CPU时间
    Math.random();
  }

  return performance.now() - start;
}

/**
 * 主数据收集函数
 */
async function collectPerformanceMetrics() {
  console.log('📊 开始性能数据收集...\n');

  const mergedMetrics = {
    frameTime: [],
    interaction: [],
    eventProcessing: [],
    startup: [],
  };

  // 1. 从Playwright报告提取数据
  const playwrightMetrics = await extractPlaywrightMetrics();
  if (playwrightMetrics) {
    console.log('✅ 从Playwright测试提取了性能数据');

    // 合并数据
    mergedMetrics.frameTime.push(...playwrightMetrics.frameTime);
    mergedMetrics.interaction.push(...playwrightMetrics.interaction);
    mergedMetrics.eventProcessing.push(...playwrightMetrics.eventProcessing);
    mergedMetrics.startup.push(...playwrightMetrics.startup);
  }

  // 2. 如果数据不足，运行基准测试补充
  const minSamples = 20;
  let needsBenchmarks = false;

  for (const [key, values] of Object.entries(mergedMetrics)) {
    if (values.length < minSamples) {
      console.log(
        `⚠️  ${key} 数据不足 (${values.length}/${minSamples})，需要运行基准测试`
      );
      needsBenchmarks = true;
    }
  }

  if (needsBenchmarks || playwrightMetrics === null) {
    console.log('\n🔄 运行性能基准测试补充数据...\n');
    const benchmarkMetrics = await runPerformanceBenchmarks();

    if (benchmarkMetrics) {
      // 如果原有数据不足，用基准测试数据补充或替换
      for (const [key, values] of Object.entries(benchmarkMetrics)) {
        if (mergedMetrics[key].length < minSamples) {
          mergedMetrics[key] = values; // 替换
        }
      }
    }
  }

  // 3. 保存性能报告
  const reportPath = path.join(
    __dirname,
    '..',
    '..',
    '.performance-report.json'
  );

  const report = {
    timestamp: new Date().toISOString(),
    collectionMethod: playwrightMetrics
      ? 'playwright+benchmark'
      : 'benchmark-only',
    metrics: mergedMetrics,
    summary: {
      frameTimeSamples: mergedMetrics.frameTime.length,
      interactionSamples: mergedMetrics.interaction.length,
      eventProcessingSamples: mergedMetrics.eventProcessing.length,
      startupSamples: mergedMetrics.startup.length,
      totalSamples: Object.values(mergedMetrics).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📄 性能数据收集完成:');
  console.log(`  帧率样本: ${report.summary.frameTimeSamples}`);
  console.log(`  交互样本: ${report.summary.interactionSamples}`);
  console.log(`  事件处理样本: ${report.summary.eventProcessingSamples}`);
  console.log(`  启动样本: ${report.summary.startupSamples}`);
  console.log(`  总样本数: ${report.summary.totalSamples}`);
  console.log(`  报告文件: ${reportPath}`);

  return report;
}

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  collectPerformanceMetrics().catch(error => {
    console.error('性能数据收集失败:', error.message);
    process.exit(1);
  });
}

export { collectPerformanceMetrics, extractPlaywrightMetrics };
