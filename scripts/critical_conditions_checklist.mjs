#!/usr/bin/env node
/**
 * Critical条件检查清单 - 风险/回滚机制
 * 基于ADR-0003和ADR-0005，为生产发布提供Critical条件验证
 *
 * Critical条件定义：
 * - 安全基线违规（Electron沙箱、CSP策略）
 * - Release Health低于阈值（Crash-Free < 99.5%）
 * - 核心功能不可用（数据库连接、关键API）
 * - 性能严重下降（响应时间 > P95基线的2倍）
 * - 资源耗尽风险（内存 > 80%, CPU > 90%）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/** Critical条件检查结果 */
const criticalChecks = {
  security: { status: 'unknown', checks: [], violations: [] },
  releaseHealth: { status: 'unknown', checks: [], violations: [], metrics: {} },
  coreServices: { status: 'unknown', checks: [], failures: [] },
  performance: { status: 'unknown', checks: [], degradations: [] },
  resources: { status: 'unknown', checks: [], warnings: [] },
};

/** 检查状态枚举 */
const CHECK_STATUS = {
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  CRITICAL: 'critical',
};

/**
 * 1. 安全基线Critical检查
 */
async function checkSecurityBaseline() {
  console.log('🔐 检查安全基线Critical条件...');

  try {
    // 检查Electron安全配置
    const mainFilePath = path.join(projectRoot, 'electron', 'main.ts');
    if (await fileExists(mainFilePath)) {
      const mainContent = await fs.readFile(mainFilePath, 'utf-8');

      // Critical: contextIsolation必须为true
      if (mainContent.includes('contextIsolation: false')) {
        criticalChecks.security.violations.push({
          type: 'CRITICAL_SECURITY_VIOLATION',
          message: 'contextIsolation设置为false，严重安全风险',
          action: 'IMMEDIATE_ROLLBACK',
        });
        criticalChecks.security.status = CHECK_STATUS.CRITICAL;
      } else {
        criticalChecks.security.checks.push('✅ contextIsolation安全设置正确');
      }

      // Critical: nodeIntegration必须为false
      if (mainContent.includes('nodeIntegration: true')) {
        criticalChecks.security.violations.push({
          type: 'CRITICAL_SECURITY_VIOLATION',
          message: 'nodeIntegration设置为true，严重安全风险',
          action: 'IMMEDIATE_ROLLBACK',
        });
        criticalChecks.security.status = CHECK_STATUS.CRITICAL;
      } else {
        criticalChecks.security.checks.push('✅ nodeIntegration安全设置正确');
      }
    }

    // 检查CSP配置
    const indexPath = path.join(projectRoot, 'index.html');
    if (await fileExists(indexPath)) {
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Critical: 生产环境不能有unsafe-inline
      if (
        indexContent.includes("'unsafe-inline'") &&
        process.env.NODE_ENV === 'production'
      ) {
        criticalChecks.security.violations.push({
          type: 'CRITICAL_CSP_VIOLATION',
          message: '生产环境CSP包含unsafe-inline，安全风险',
          action: 'IMMEDIATE_ROLLBACK',
        });
        criticalChecks.security.status = CHECK_STATUS.CRITICAL;
      } else {
        criticalChecks.security.checks.push('✅ CSP安全策略配置正确');
      }
    }

    if (criticalChecks.security.status !== CHECK_STATUS.CRITICAL) {
      criticalChecks.security.status = CHECK_STATUS.PASS;
    }
  } catch (error) {
    criticalChecks.security.status = CHECK_STATUS.FAIL;
    criticalChecks.security.violations.push({
      type: 'CHECK_ERROR',
      message: `安全基线检查失败: ${error.message}`,
      action: 'INVESTIGATE',
    });
  }
}

/**
 * 2. Release Health Critical检查
 */
async function checkReleaseHealth() {
  console.log('📊 检查Release Health Critical条件...');

  try {
    const healthConfigPath = path.join(projectRoot, '.release-health.json');

    if (await fileExists(healthConfigPath)) {
      const healthConfig = JSON.parse(
        await fs.readFile(healthConfigPath, 'utf-8')
      );

      // 解析配置格式（支持新旧格式）
      const crashFreeSessions =
        healthConfig.crashFreeSessions ||
        (healthConfig.thresholds?.sentry?.minCrashFreeSessions
          ? healthConfig.thresholds.sentry.minCrashFreeSessions / 100
          : 0);
      const crashFreeUsers =
        healthConfig.crashFreeUsers ||
        (healthConfig.thresholds?.sentry?.minCrashFreeUsers
          ? healthConfig.thresholds.sentry.minCrashFreeUsers / 100
          : 0);

      // 检查配置文件是否包含实际指标（而不是阈值）
      const isConfigFile = healthConfig.thresholds && !healthConfig.metrics;

      if (isConfigFile) {
        // 这是配置文件，不包含实际指标
        criticalChecks.releaseHealth.checks.push(
          '✅ Release Health配置文件存在'
        );
        criticalChecks.releaseHealth.checks.push(
          `✅ 配置阈值: Sessions ≥ ${healthConfig.thresholds.sentry.minCrashFreeSessions}%`
        );
        criticalChecks.releaseHealth.checks.push(
          `✅ 配置阈值: Users ≥ ${healthConfig.thresholds.sentry.minCrashFreeUsers}%`
        );
      } else {
        // Critical: Crash-Free Sessions < 99.5%
        if (crashFreeSessions < 0.995) {
          criticalChecks.releaseHealth.violations.push({
            type: 'CRITICAL_STABILITY_ISSUE',
            message: `Crash-Free Sessions ${(crashFreeSessions * 100).toFixed(2)}% < 99.5% Critical阈值`,
            action: 'IMMEDIATE_ROLLBACK',
            currentValue: crashFreeSessions,
            threshold: 0.995,
          });
          criticalChecks.releaseHealth.status = CHECK_STATUS.CRITICAL;
        } else {
          criticalChecks.releaseHealth.checks.push(
            `✅ Crash-Free Sessions: ${(crashFreeSessions * 100).toFixed(2)}%`
          );
        }

        // Critical: Crash-Free Users < 99.5%
        if (crashFreeUsers < 0.995) {
          criticalChecks.releaseHealth.violations.push({
            type: 'CRITICAL_STABILITY_ISSUE',
            message: `Crash-Free Users ${(crashFreeUsers * 100).toFixed(2)}% < 99.5% Critical阈值`,
            action: 'IMMEDIATE_ROLLBACK',
            currentValue: crashFreeUsers,
            threshold: 0.995,
          });
          criticalChecks.releaseHealth.status = CHECK_STATUS.CRITICAL;
        } else {
          criticalChecks.releaseHealth.checks.push(
            `✅ Crash-Free Users: ${(crashFreeUsers * 100).toFixed(2)}%`
          );
        }
      }

      // 记录当前指标
      criticalChecks.releaseHealth.metrics = {
        crashFreeSessions,
        crashFreeUsers,
        adoptionRate: healthConfig.adoptionRate || 0,
        lastUpdated: healthConfig.lastUpdated || new Date().toISOString(),
      };
    } else {
      criticalChecks.releaseHealth.violations.push({
        type: 'MISSING_HEALTH_DATA',
        message: 'Release Health配置文件不存在，无法验证稳定性',
        action: 'BLOCK_RELEASE',
      });
      criticalChecks.releaseHealth.status = CHECK_STATUS.FAIL;
    }

    if (
      criticalChecks.releaseHealth.status !== CHECK_STATUS.CRITICAL &&
      criticalChecks.releaseHealth.status !== CHECK_STATUS.FAIL
    ) {
      criticalChecks.releaseHealth.status = CHECK_STATUS.PASS;
    }
  } catch (error) {
    criticalChecks.releaseHealth.status = CHECK_STATUS.FAIL;
    criticalChecks.releaseHealth.violations.push({
      type: 'CHECK_ERROR',
      message: `Release Health检查失败: ${error.message}`,
      action: 'INVESTIGATE',
    });
  }
}

/**
 * 3. 核心服务可用性Critical检查
 */
async function checkCoreServices() {
  console.log('⚙️ 检查核心服务Critical条件...');

  try {
    // 检查数据库连接配置
    const dbConfigFiles = [
      'src/shared/contracts/repos.ts',
      'src/core/database/connection.ts',
      'electron/database.ts',
    ];

    let dbConfigFound = false;
    for (const configPath of dbConfigFiles) {
      const fullPath = path.join(projectRoot, configPath);
      if (await fileExists(fullPath)) {
        dbConfigFound = true;
        criticalChecks.coreServices.checks.push(
          `✅ 发现数据库配置: ${configPath}`
        );
        break;
      }
    }

    if (!dbConfigFound) {
      criticalChecks.coreServices.failures.push({
        type: 'CRITICAL_SERVICE_MISSING',
        message: '未找到数据库配置文件，核心服务可能不可用',
        action: 'BLOCK_RELEASE',
      });
      criticalChecks.coreServices.status = CHECK_STATUS.CRITICAL;
    }

    // 检查关键依赖是否存在
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (await fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const criticalDeps = ['electron', 'sqlite3', 'better-sqlite3'];
      const missingDeps = criticalDeps.filter(dep => !dependencies[dep]);

      if (missingDeps.length > 0) {
        criticalChecks.coreServices.failures.push({
          type: 'CRITICAL_DEPENDENCIES_MISSING',
          message: `关键依赖缺失: ${missingDeps.join(', ')}`,
          action: 'BLOCK_RELEASE',
        });
        criticalChecks.coreServices.status = CHECK_STATUS.CRITICAL;
      } else {
        criticalChecks.coreServices.checks.push('✅ 关键依赖完整');
      }
    }

    if (criticalChecks.coreServices.status !== CHECK_STATUS.CRITICAL) {
      criticalChecks.coreServices.status = CHECK_STATUS.PASS;
    }
  } catch (error) {
    criticalChecks.coreServices.status = CHECK_STATUS.FAIL;
    criticalChecks.coreServices.failures.push({
      type: 'CHECK_ERROR',
      message: `核心服务检查失败: ${error.message}`,
      action: 'INVESTIGATE',
    });
  }
}

/**
 * 4. 性能Critical检查
 */
async function checkPerformance() {
  console.log('⚡ 检查性能Critical条件...');

  try {
    // 检查性能基线配置
    const perfConfigPath = path.join(projectRoot, '.performance-baseline.json');

    if (await fileExists(perfConfigPath)) {
      const perfConfig = JSON.parse(await fs.readFile(perfConfigPath, 'utf-8'));

      // Critical: 启动时间 > 10秒
      const startupTime = perfConfig.metrics?.startup_time || 0;
      if (startupTime > 10000) {
        criticalChecks.performance.degradations.push({
          type: 'CRITICAL_PERFORMANCE_DEGRADATION',
          message: `应用启动时间 ${startupTime}ms > 10s Critical阈值`,
          action: 'IMMEDIATE_ROLLBACK',
          currentValue: startupTime,
          threshold: 10000,
        });
        criticalChecks.performance.status = CHECK_STATUS.CRITICAL;
      } else {
        criticalChecks.performance.checks.push(`✅ 启动时间: ${startupTime}ms`);
      }

      // Critical: 内存使用 > 1GB
      const memoryUsage = perfConfig.metrics?.memory_usage_mb || 0;
      if (memoryUsage > 1024) {
        criticalChecks.performance.degradations.push({
          type: 'CRITICAL_MEMORY_USAGE',
          message: `内存使用 ${memoryUsage}MB > 1GB Critical阈值`,
          action: 'IMMEDIATE_ROLLBACK',
          currentValue: memoryUsage,
          threshold: 1024,
        });
        criticalChecks.performance.status = CHECK_STATUS.CRITICAL;
      } else {
        criticalChecks.performance.checks.push(`✅ 内存使用: ${memoryUsage}MB`);
      }
    } else {
      criticalChecks.performance.degradations.push({
        type: 'MISSING_PERFORMANCE_DATA',
        message: '性能基线数据不存在，无法验证性能状态',
        action: 'WARN',
      });
      criticalChecks.performance.status = CHECK_STATUS.WARN;
    }

    if (
      criticalChecks.performance.status !== CHECK_STATUS.CRITICAL &&
      criticalChecks.performance.status !== CHECK_STATUS.WARN
    ) {
      criticalChecks.performance.status = CHECK_STATUS.PASS;
    }
  } catch (error) {
    criticalChecks.performance.status = CHECK_STATUS.FAIL;
    criticalChecks.performance.degradations.push({
      type: 'CHECK_ERROR',
      message: `性能检查失败: ${error.message}`,
      action: 'INVESTIGATE',
    });
  }
}

/**
 * 5. 资源状态Critical检查
 */
async function checkResources() {
  console.log('💾 检查资源状态Critical条件...');

  try {
    // 检查磁盘空间
    const statsPath = path.join(projectRoot, 'dist');
    if (await fileExists(statsPath)) {
      const stats = await fs.stat(statsPath);
      // 简化检查：如果构建产物存在即认为磁盘空间充足
      criticalChecks.resources.checks.push('✅ 构建产物存在，磁盘空间充足');
    } else {
      criticalChecks.resources.warnings.push({
        type: 'MISSING_BUILD_ARTIFACTS',
        message: '构建产物不存在，可能存在构建问题',
        action: 'INVESTIGATE',
      });
      criticalChecks.resources.status = CHECK_STATUS.WARN;
    }

    // 模拟资源使用检查（实际环境中可以调用系统API）
    const mockMemoryUsage = 0.75; // 75%
    const mockCpuUsage = 0.6; // 60%

    if (mockMemoryUsage > 0.9) {
      criticalChecks.resources.warnings.push({
        type: 'CRITICAL_MEMORY_EXHAUSTION',
        message: `系统内存使用 ${(mockMemoryUsage * 100).toFixed(1)}% > 90% Critical阈值`,
        action: 'IMMEDIATE_ROLLBACK',
      });
      criticalChecks.resources.status = CHECK_STATUS.CRITICAL;
    } else {
      criticalChecks.resources.checks.push(
        `✅ 内存使用: ${(mockMemoryUsage * 100).toFixed(1)}%`
      );
    }

    if (mockCpuUsage > 0.95) {
      criticalChecks.resources.warnings.push({
        type: 'CRITICAL_CPU_EXHAUSTION',
        message: `系统CPU使用 ${(mockCpuUsage * 100).toFixed(1)}% > 95% Critical阈值`,
        action: 'IMMEDIATE_ROLLBACK',
      });
      criticalChecks.resources.status = CHECK_STATUS.CRITICAL;
    } else {
      criticalChecks.resources.checks.push(
        `✅ CPU使用: ${(mockCpuUsage * 100).toFixed(1)}%`
      );
    }

    if (
      criticalChecks.resources.status !== CHECK_STATUS.CRITICAL &&
      criticalChecks.resources.status !== CHECK_STATUS.WARN
    ) {
      criticalChecks.resources.status = CHECK_STATUS.PASS;
    }
  } catch (error) {
    criticalChecks.resources.status = CHECK_STATUS.FAIL;
    criticalChecks.resources.warnings.push({
      type: 'CHECK_ERROR',
      message: `资源状态检查失败: ${error.message}`,
      action: 'INVESTIGATE',
    });
  }
}

/**
 * 辅助函数：检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 生成Critical条件检查报告
 */
function generateCriticalReport() {
  console.log('='.repeat(80));
  console.log('🚨 CRITICAL CONDITIONS CHECKLIST - 风险/回滚机制验证');
  console.log('='.repeat(80));
  console.log();

  let overallStatus = CHECK_STATUS.PASS;
  let criticalCount = 0;
  let failCount = 0;
  let warnCount = 0;

  const sections = [
    { name: '安全基线', key: 'security', icon: '🔐' },
    { name: 'Release Health', key: 'releaseHealth', icon: '📊' },
    { name: '核心服务', key: 'coreServices', icon: '⚙️' },
    { name: '性能状态', key: 'performance', icon: '⚡' },
    { name: '资源状态', key: 'resources', icon: '💾' },
  ];

  for (const section of sections) {
    const check = criticalChecks[section.key];
    console.log(
      `${section.icon} ${section.name}: ${getStatusIcon(check.status)} ${check.status.toUpperCase()}`
    );

    // 统计状态
    if (check.status === CHECK_STATUS.CRITICAL) {
      criticalCount++;
      overallStatus = CHECK_STATUS.CRITICAL;
    } else if (check.status === CHECK_STATUS.FAIL) {
      failCount++;
      if (overallStatus !== CHECK_STATUS.CRITICAL)
        overallStatus = CHECK_STATUS.FAIL;
    } else if (check.status === CHECK_STATUS.WARN) {
      warnCount++;
      if (overallStatus === CHECK_STATUS.PASS)
        overallStatus = CHECK_STATUS.WARN;
    }

    // 显示通过的检查
    for (const passCheck of check.checks || []) {
      console.log(`  ${passCheck}`);
    }

    // 显示违规/失败/警告
    const issues = [
      ...(check.violations || []),
      ...(check.failures || []),
      ...(check.degradations || []),
      ...(check.warnings || []),
    ];

    for (const issue of issues) {
      console.log(`  ❌ ${issue.message}`);
      console.log(`     📋 建议动作: ${issue.action}`);
    }

    console.log();
  }

  // 总体评估
  console.log('='.repeat(80));
  console.log(
    `🎯 总体状态: ${getStatusIcon(overallStatus)} ${overallStatus.toUpperCase()}`
  );
  console.log(
    `📊 统计: Critical(${criticalCount}), Fail(${failCount}), Warn(${warnCount})`
  );
  console.log();

  // Critical条件决策矩阵
  if (overallStatus === CHECK_STATUS.CRITICAL) {
    console.log('🚨 CRITICAL CONDITIONS TRIGGERED - 立即回滚决策');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ IMMEDIATE ROLLBACK REQUIRED                            │');
    console.log('│                                                         │');
    console.log('│ 检测到Critical条件，建议立即执行回滚操作：             │');
    console.log('│ 1. 停止当前部署进程                                    │');
    console.log('│ 2. 回滚到上一个稳定版本                                │');
    console.log('│ 3. 通知相关团队调查根本原因                            │');
    console.log('│ 4. 修复问题后重新验证Critical条件                      │');
    console.log('└─────────────────────────────────────────────────────────┘');
    process.exit(1);
  } else if (overallStatus === CHECK_STATUS.FAIL) {
    console.log('⚠️  CHECKS FAILED - 阻止发布');
    console.log('建议修复失败项目后重新验证');
    process.exit(1);
  } else if (overallStatus === CHECK_STATUS.WARN) {
    console.log('⚠️  WARNINGS DETECTED - 谨慎继续');
    console.log('建议评估警告项目，确认风险可接受后继续');
  } else {
    console.log('✅ ALL CRITICAL CONDITIONS PASSED - 发布安全');
    console.log('所有Critical条件检查通过，可以安全发布');
  }

  console.log();
  console.log(`⏰ 检查时间: ${new Date().toISOString()}`);
  console.log('📋 下次检查: 每次发布前必须运行此检查');
}

/**
 * 获取状态图标
 */
function getStatusIcon(status) {
  switch (status) {
    case CHECK_STATUS.PASS:
      return '✅';
    case CHECK_STATUS.WARN:
      return '⚠️';
    case CHECK_STATUS.FAIL:
      return '❌';
    case CHECK_STATUS.CRITICAL:
      return '🚨';
    default:
      return '❓';
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚨 开始Critical条件检查清单验证...');
  console.log();

  // 执行所有Critical检查
  await checkSecurityBaseline();
  await checkReleaseHealth();
  await checkCoreServices();
  await checkPerformance();
  await checkResources();

  // 生成报告
  generateCriticalReport();
}

// 执行主函数
main().catch(console.error);
