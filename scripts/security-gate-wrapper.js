#!/usr/bin/env node
/**
 * 安全门禁统一包装脚本
 *
 * 功能：整合E2E安全测试与Electron安全测试，避免重复阻塞
 * 替代：原来的分离E2E和Electron安全检查项
 * 基于：ADR-0002 Electron安全基线
 */

import { exec as execCallback } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const exec = promisify(execCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 统一安全E2E超时（默认300s），与 Playwright 共享同一旋钮
const rawTimeout =
  process.env.E2E_SECURITY_TIMEOUT_MS ??
  process.env.SECURITY_E2E_TIMEOUT_MS ??
  '300000';
const E2E_SECURITY_TIMEOUT_MS = Number(rawTimeout);
if (
  !Number.isFinite(E2E_SECURITY_TIMEOUT_MS) ||
  E2E_SECURITY_TIMEOUT_MS < 60000
) {
  throw new Error(`Invalid E2E_SECURITY_TIMEOUT_MS: ${rawTimeout}`);
}
console.log(
  `[security-gate] E2E_SECURITY_TIMEOUT_MS=${E2E_SECURITY_TIMEOUT_MS}`
);

const SECURITY_TESTS = {
  electron: {
    name: 'Electron安全测试',
    command: 'npm run test:security:electron',
    critical: true,
    timeout: E2E_SECURITY_TIMEOUT_MS,
  },
  e2e: {
    name: 'E2E安全测试',
    command: 'npm run test:security:e2e',
    critical: true,
    timeout: E2E_SECURITY_TIMEOUT_MS,
  },
  static: {
    name: '静态安全扫描',
    command: 'npm run scan:security',
    critical: false,
    timeout: E2E_SECURITY_TIMEOUT_MS,
  },
};

class SecurityGateWrapper {
  constructor() {
    this.results = {};
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  /**
   * 执行单个安全测试
   */
  async runSecurityTest(testKey, testConfig) {
    console.log(`\n🔐 开始执行: ${testConfig.name}...`);

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await this.executeWithTimeout(
        testConfig.command,
        testConfig.timeout
      );

      const duration = Date.now() - startTime;
      const result = {
        name: testConfig.name,
        command: testConfig.command,
        status: 'PASS',
        duration: duration,
        output: stdout,
        critical: testConfig.critical,
      };

      if (stderr && stderr.trim()) {
        result.warnings = stderr;
        this.warnings.push(`⚠️  ${testConfig.name}: ${stderr}`);
      }

      this.results[testKey] = result;
      console.log(`✅ ${testConfig.name} 通过 (${duration}ms)`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result = {
        name: testConfig.name,
        command: testConfig.command,
        status: 'FAIL',
        duration: duration,
        error: error.message,
        critical: testConfig.critical,
      };

      this.results[testKey] = result;

      if (testConfig.critical) {
        this.errors.push(
          `❌ 关键安全测试失败: ${testConfig.name} - ${error.message}`
        );
        console.error(`❌ ${testConfig.name} 失败: ${error.message}`);

        // 立即硬失败：关键安全测试失败不允许继续
        console.error('🚨 [硬失败] 关键安全测试失败，立即终止');
        process.exit(1);
      } else {
        this.warnings.push(
          `⚠️  非关键安全测试失败: ${testConfig.name} - ${error.message}`
        );
        console.warn(`⚠️  ${testConfig.name} 失败: ${error.message}`);
      }

      return result;
    }
  }

  /**
   * 带超时的命令执行
   */
  async executeWithTimeout(command, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`命令超时 (${timeout}ms): ${command}`));
      }, timeout);
    });

    try {
      const result = await Promise.race([exec(command), timeoutPromise]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 并行执行所有安全测试
   */
  async runAllSecurityTests() {
    console.log('🚀 开始并行执行安全门禁测试...\n');

    const testPromises = Object.entries(SECURITY_TESTS).map(([key, config]) =>
      this.runSecurityTest(key, config)
    );

    try {
      await Promise.allSettled(testPromises);
    } catch (error) {
      console.error('执行安全测试时出现异常:', error);
    }
  }

  /**
   * 验证CSP和安全基线
   */
  async validateSecurityBaseline() {
    console.log('\n🛡️  验证安全基线配置...');

    try {
      // 检查CSP配置
      const indexHtml = fs.readFileSync('index.html', 'utf8');
      const cspRegex =
        /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i;
      const cspMatch = indexHtml.match(cspRegex);

      if (!cspMatch) {
        this.errors.push('❌ 未找到CSP配置');
        console.error('🚨 [硬失败] CSP配置缺失，违反ADR-0002安全基线');
        process.exit(1);
      } else {
        const cspValue = cspMatch[1];

        // 检查关键CSP指令
        const requiredDirectives = [
          'default-src',
          'script-src',
          'style-src',
          'img-src',
          'connect-src',
        ];

        const missingDirectives = requiredDirectives.filter(
          directive => !cspValue.includes(directive)
        );

        if (missingDirectives.length > 0) {
          this.warnings.push(
            `⚠️  CSP缺少指令: ${missingDirectives.join(', ')}`
          );
        }

        // 检查不安全的CSP配置
        if (
          cspValue.includes("'unsafe-inline'") ||
          cspValue.includes("'unsafe-eval'")
        ) {
          this.errors.push(
            '❌ CSP包含不安全配置: unsafe-inline 或 unsafe-eval'
          );
          console.error('🚨 [硬失败] CSP包含不安全配置，违反ADR-0002安全基线');
          process.exit(1);
        } else {
          console.log('✅ CSP配置安全');
        }
      }

      // 检查Electron安全配置
      const electronMainPath = 'electron/main.ts';
      if (fs.existsSync(electronMainPath)) {
        const mainContent = fs.readFileSync(electronMainPath, 'utf8');

        // 检查关键安全设置
        const securityChecks = [
          {
            setting: 'nodeIntegration: false',
            pattern: /nodeIntegration:\s*false/i,
          },
          {
            setting: 'contextIsolation: true',
            pattern: /contextIsolation:\s*true/i,
          },
          { setting: 'sandbox: true', pattern: /sandbox:\s*true/i },
        ];

        securityChecks.forEach(check => {
          if (!check.pattern.test(mainContent)) {
            this.errors.push(`❌ Electron安全配置缺失: ${check.setting}`);
            console.error(
              `🚨 [硬失败] Electron安全配置缺失: ${check.setting}，违反ADR-0002安全基线`
            );
            process.exit(1);
          } else {
            console.log(`✅ ${check.setting} 配置正确`);
          }
        });
      }
    } catch (error) {
      this.errors.push(`❌ 安全基线验证失败: ${error.message}`);
    }
  }

  /**
   * 生成统一安全报告
   */
  generateSecurityReport() {
    console.log('\n📊 生成安全测试报告...');

    const totalDuration = Date.now() - this.startTime;
    const passedTests = Object.values(this.results).filter(
      r => r.status === 'PASS'
    ).length;
    const failedTests = Object.values(this.results).filter(
      r => r.status === 'FAIL'
    ).length;
    const criticalFailures = Object.values(this.results).filter(
      r => r.status === 'FAIL' && r.critical
    ).length;

    const report = {
      timestamp: new Date().toISOString(),
      status: criticalFailures === 0 ? 'PASS' : 'FAIL',
      summary: {
        totalTests: Object.keys(this.results).length,
        passed: passedTests,
        failed: failedTests,
        criticalFailures: criticalFailures,
        totalDuration: totalDuration,
      },
      results: this.results,
      errors: this.errors,
      warnings: this.warnings,
      securityBaseline: {
        cspConfigured: this.errors.filter(e => e.includes('CSP')).length === 0,
        electronSecure:
          this.errors.filter(e => e.includes('Electron')).length === 0,
      },
    };

    // 保存报告文件
    const reportPath = 'logs/security-gate-report.json';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 安全报告已保存: ${reportPath}`);
    return report;
  }

  /**
   * 执行完整安全门禁流程
   */
  async executeSecurityGate() {
    console.log('🔒 开始执行统一安全门禁检查...\n');

    // 并行执行所有安全测试
    await this.runAllSecurityTests();

    // 验证安全基线
    await this.validateSecurityBaseline();

    // 生成报告
    const report = this.generateSecurityReport();

    // 输出摘要
    console.log('\n=== 安全门禁结果摘要 ===');
    console.log(`状态: ${report.status}`);
    console.log(`总测试数: ${report.summary.totalTests}`);
    console.log(`通过: ${report.summary.passed}`);
    console.log(`失败: ${report.summary.failed}`);
    console.log(`关键失败: ${report.summary.criticalFailures}`);
    console.log(`总耗时: ${report.summary.totalDuration}ms`);

    if (report.errors.length > 0) {
      console.log('\n❌ 发现关键安全问题:');
      report.errors.forEach(error => console.log(`  ${error}`));
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️  发现安全警告:');
      report.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    return report;
  }
}

// 主执行逻辑
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const securityGate = new SecurityGateWrapper();

  securityGate
    .executeSecurityGate()
    .then(report => {
      // 基于关键失败数设置进程退出码
      process.exit(report.summary.criticalFailures > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 安全门禁执行异常:', error);
      process.exit(1);
    });
}

export default SecurityGateWrapper;
