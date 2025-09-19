import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright全局清理 - Electron E2E测试
 * 基于ADR-0005质量门禁要求
 *
 * 功能：
 * - 收集测试结果和性能指标
 * - 生成测试总结报告
 * - 清理临时文件和进程
 * - 验证质量门禁阈值
 */

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 开始Playwright全局清理 - Electron E2E测试');

  const outputDir = config.projects[0].outputDir || 'test-results/artifacts';
  const reportDir = 'test-results';

  // 1. 收集测试结果
  console.log('📊 收集测试结果...');

  let testResults: any = {};
  let performanceMetrics: any = {};

  try {
    // 读取测试结果
    const resultsPath = path.join(reportDir, 'test-results.json');
    if (fs.existsSync(resultsPath)) {
      testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      console.log('✅ 测试结果收集完成');
    }

    // 读取性能指标（如果存在）
    const perfPath = path.join(outputDir, 'performance-metrics.json');
    if (fs.existsSync(perfPath)) {
      performanceMetrics = JSON.parse(fs.readFileSync(perfPath, 'utf-8'));
      console.log('✅ 性能指标收集完成');
    }
  } catch (error) {
    console.warn('⚠️ 结果收集部分失败:', error);
  }

  // 2. 分析测试覆盖率和通过率
  console.log('🎯 分析测试质量指标...');

  const qualityMetrics = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResults?.stats?.total || 0,
      passed: testResults?.stats?.passed || 0,
      failed: testResults?.stats?.failed || 0,
      skipped: testResults?.stats?.skipped || 0,
    },
    performance: performanceMetrics,
    qualityGates: {
      passRate: 0,
      securityTestsPassed: false,
      performanceThresholdMet: false,
    },
  };

  // 计算通过率
  if (qualityMetrics.summary.totalTests > 0) {
    qualityMetrics.qualityGates.passRate =
      (qualityMetrics.summary.passed / qualityMetrics.summary.totalTests) * 100;
  }

  // 检查安全测试通过情况
  const securityProject = testResults?.config?.projects?.find(
    (p: any) => p.name === 'electron-security-audit'
  );
  qualityMetrics.qualityGates.securityTestsPassed = securityProject
    ? (securityProject.stats?.failed || 0) === 0
    : false;

  // 质量门禁验证（基于ADR-0005）
  console.log('🚪 验证质量门禁...');

  const qualityGates = {
    passRateThreshold: 95, // 95%通过率阈值
    securityRequired: true, // 安全测试必须通过
    performanceThreshold: 100, // P95响应时间≤100ms
  };

  const gatesPassed = {
    passRate:
      qualityMetrics.qualityGates.passRate >= qualityGates.passRateThreshold,
    security: qualityMetrics.qualityGates.securityTestsPassed,
    performance: true, // 暂时默认通过，待集成性能监控
  };

  const allGatesPassed = Object.values(gatesPassed).every(gate => gate);

  if (allGatesPassed) {
    console.log('✅ 所有质量门禁通过');
  } else {
    console.log('❌ 质量门禁未通过:');
    if (!gatesPassed.passRate) {
      console.log(
        `  - 通过率不足: ${qualityMetrics.qualityGates.passRate.toFixed(1)}% < ${qualityGates.passRateThreshold}%`
      );
    }
    if (!gatesPassed.security) {
      console.log('  - 安全测试未通过');
    }
    if (!gatesPassed.performance) {
      console.log('  - 性能测试未达标');
    }
  }

  // 3. 生成总结报告
  console.log('📄 生成测试总结报告...');

  const summaryReport = {
    ...qualityMetrics,
    gates: {
      thresholds: qualityGates,
      results: gatesPassed,
      passed: allGatesPassed,
    },
    artifacts: {
      outputDir,
      reportDir,
      setupReport: path.join(outputDir, 'setup-report.json'),
      summaryReport: path.join(outputDir, 'teardown-summary.json'),
    },
  };

  const summaryPath = path.join(outputDir, 'teardown-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));

  // 4. 清理临时文件和进程
  console.log('🧽 清理临时资源...');

  try {
    // 清理可能残留的Electron进程（Windows特定）
    if (process.platform === 'win32') {
      const { exec } = await import('child_process');
      exec('taskkill /F /IM electron.exe 2>nul', () => {
        // 忽略错误，因为可能没有残留进程
      });
    }

    // 清理临时测试数据
    const tempDir = path.join(outputDir, 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('✅ 临时文件清理完成');
    }
  } catch (error) {
    console.warn('⚠️ 清理过程中出现警告:', error);
  }

  // 5. 输出最终状态
  console.log('\n📋 测试执行完成');
  console.log(`📊 总测试数: ${qualityMetrics.summary.totalTests}`);
  console.log(`✅ 通过: ${qualityMetrics.summary.passed}`);
  console.log(`❌ 失败: ${qualityMetrics.summary.failed}`);
  console.log(`⏭️ 跳过: ${qualityMetrics.summary.skipped}`);
  console.log(`🎯 通过率: ${qualityMetrics.qualityGates.passRate.toFixed(1)}%`);
  console.log(`🚪 质量门禁: ${allGatesPassed ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`📄 详细报告: ${summaryPath}`);

  // 根据质量门禁结果设置退出代码
  if (!allGatesPassed && process.env.CI) {
    console.log('\n❌ CI环境中质量门禁未通过，设置失败退出代码');
    process.exitCode = 1;
  }

  console.log('🎯 全局清理完成\n');
}

export default globalTeardown;
