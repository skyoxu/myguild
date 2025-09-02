#!/usr/bin/env node
/**
 * 综合安全验证脚本
 *
 * 验证所有已实施的高优先级安全修复：
 * 1. CSP统一管理模块
 * 2. 权限管理器增强
 * 3. 预加载脚本安全加固
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

class ComprehensiveSecurityValidator {
  constructor() {
    this.results = [];
    this.overallScore = 0;
    this.maxScore = 0;
  }

  log(message, level = 'info') {
    const prefix =
      {
        info: '✅',
        warn: '⚠️',
        error: '❌',
        security: '🔒',
        test: '🧪',
      }[level] || 'ℹ️';

    console.log(`${prefix} ${message}`);
  }

  async runValidationScript(scriptPath, testName) {
    this.log(`执行${testName}验证...`, 'test');

    try {
      const result = execSync(`node "${scriptPath}"`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      this.results.push({
        test: testName,
        status: 'pass',
        score: 100,
        output: result,
      });

      this.overallScore += 100;
      this.log(`${testName}验证通过`, 'info');
      return true;
    } catch (error) {
      this.results.push({
        test: testName,
        status: 'fail',
        score: 0,
        error: error.message,
        output: error.stdout || error.stderr,
      });

      this.log(`${testName}验证失败`, 'error');
      return false;
    } finally {
      this.maxScore += 100;
    }
  }

  // 验证文件结构完整性
  validateFileStructure() {
    this.log('验证安全文件结构...', 'security');

    const requiredFiles = [
      'electron/security/csp-policy.ts',
      'electron/security/permissions.ts',
      'electron/preload.ts',
      'electron/preload.d.ts',
      'scripts/validate-csp-consistency.mjs',
      'scripts/validate-preload-security.mjs',
    ];

    let structureScore = 0;
    const maxStructureScore = requiredFiles.length;

    requiredFiles.forEach(file => {
      const filePath = join(ROOT_DIR, file);
      if (existsSync(filePath)) {
        structureScore++;
        this.log(`  ✓ ${file}`);
      } else {
        this.log(`  ✗ ${file} 不存在`, 'error');
      }
    });

    const structurePercentage = Math.round(
      (structureScore / maxStructureScore) * 100
    );

    this.results.push({
      test: '文件结构完整性',
      status: structureScore === maxStructureScore ? 'pass' : 'partial',
      score: structurePercentage,
      details: `${structureScore}/${maxStructureScore} 文件存在`,
    });

    this.overallScore += structurePercentage;
    this.maxScore += 100;

    return structureScore === maxStructureScore;
  }

  // 验证配置文件安全性
  validateConfigurationSecurity() {
    this.log('验证配置文件安全性...', 'security');

    let configScore = 0;
    const maxConfigScore = 3;

    // 检查 main.ts 安全配置
    const mainPath = join(ROOT_DIR, 'electron', 'main.ts');
    if (existsSync(mainPath)) {
      const mainContent = readFileSync(mainPath, 'utf8');

      // 检查安全基线设置
      const securitySettings = [
        'nodeIntegration: false',
        'contextIsolation: true',
        'sandbox: true',
      ];

      const foundSettings = securitySettings.filter(setting =>
        mainContent.includes(setting)
      );

      if (foundSettings.length === securitySettings.length) {
        configScore++;
        this.log('  ✓ Electron安全基线配置正确');
      } else {
        this.log('  ✗ Electron安全基线配置不完整', 'error');
      }
    }

    // 检查 CSPManager 集成
    if (existsSync(mainPath)) {
      const mainContent = readFileSync(mainPath, 'utf8');

      if (
        mainContent.includes('import { CSPManager }') &&
        mainContent.includes('CSPManager.generateDevelopmentCSP')
      ) {
        configScore++;
        this.log('  ✓ CSPManager集成正确');
      } else {
        this.log('  ✗ CSPManager集成不完整', 'error');
      }
    }

    // 检查 index.html CSP
    const indexPath = join(ROOT_DIR, 'index.html');
    if (existsSync(indexPath)) {
      const indexContent = readFileSync(indexPath, 'utf8');

      if (
        indexContent.includes("default-src 'none'") &&
        indexContent.includes("object-src 'none'") &&
        indexContent.includes("frame-ancestors 'none'")
      ) {
        configScore++;
        this.log('  ✓ index.html CSP配置安全');
      } else {
        this.log('  ✗ index.html CSP配置不安全', 'error');
      }
    }

    const configPercentage = Math.round((configScore / maxConfigScore) * 100);

    this.results.push({
      test: '配置文件安全性',
      status: configScore === maxConfigScore ? 'pass' : 'partial',
      score: configPercentage,
      details: `${configScore}/${maxConfigScore} 配置检查通过`,
    });

    this.overallScore += configPercentage;
    this.maxScore += 100;

    return configScore === maxConfigScore;
  }

  // 检查代码质量和最佳实践
  validateCodeQuality() {
    this.log('验证代码质量...', 'test');

    let qualityScore = 0;
    const maxQualityScore = 4;

    // 检查 CSPManager 实现
    const cspPath = join(ROOT_DIR, 'electron', 'security', 'csp-policy.ts');
    if (existsSync(cspPath)) {
      const cspContent = readFileSync(cspPath, 'utf8');

      if (
        cspContent.includes('validateCSP') &&
        cspContent.includes('generateTestingConfig')
      ) {
        qualityScore++;
        this.log('  ✓ CSPManager功能完整');
      }
    }

    // 检查权限管理器审计功能
    const permPath = join(ROOT_DIR, 'electron', 'security', 'permissions.ts');
    if (existsSync(permPath)) {
      const permContent = readFileSync(permPath, 'utf8');

      if (
        permContent.includes('auditLog') &&
        permContent.includes('logSecurityEvent') &&
        permContent.includes('getSecurityAuditReport')
      ) {
        qualityScore++;
        this.log('  ✓ 权限管理器审计功能完整');
      }
    }

    // 检查预加载脚本安全检查
    const preloadPath = join(ROOT_DIR, 'electron', 'preload.ts');
    if (existsSync(preloadPath)) {
      const preloadContent = readFileSync(preloadPath, 'utf8');

      if (
        preloadContent.includes('Context isolation must be enabled') &&
        !preloadContent.includes('window.electronAPI')
      ) {
        qualityScore++;
        this.log('  ✓ 预加载脚本安全检查完整');
      }
    }

    // 检查类型定义
    const typesPath = join(ROOT_DIR, 'electron', 'preload.d.ts');
    if (existsSync(typesPath)) {
      qualityScore++;
      this.log('  ✓ TypeScript类型定义存在');
    }

    const qualityPercentage = Math.round(
      (qualityScore / maxQualityScore) * 100
    );

    this.results.push({
      test: '代码质量',
      status: qualityScore >= maxQualityScore * 0.75 ? 'pass' : 'partial',
      score: qualityPercentage,
      details: `${qualityScore}/${maxQualityScore} 质量检查通过`,
    });

    this.overallScore += qualityPercentage;
    this.maxScore += 100;

    return qualityScore >= maxQualityScore * 0.75;
  }

  // 生成安全报告
  generateSecurityReport() {
    const finalScore =
      this.maxScore > 0
        ? Math.round((this.overallScore / this.maxScore) * 100)
        : 0;

    const report = {
      timestamp: new Date().toISOString(),
      overallScore: finalScore,
      grade: this.getSecurityGrade(finalScore),
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.status === 'pass').length,
      failedTests: this.results.filter(r => r.status === 'fail').length,
      partialTests: this.results.filter(r => r.status === 'partial').length,
      details: this.results,
      recommendations: this.generateRecommendations(),
    };

    return report;
  }

  getSecurityGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  generateRecommendations() {
    const recommendations = [];

    this.results.forEach(result => {
      if (result.status === 'fail') {
        recommendations.push(`修复${result.test}中发现的问题`);
      } else if (result.status === 'partial') {
        recommendations.push(`完善${result.test}中的部分实现`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('所有安全检查通过，建议定期重新验证');
    }

    return recommendations;
  }

  // 主验证函数
  async validate() {
    this.log('开始综合安全验证...', 'security');
    this.log('验证范围: CSP统一管理 + 权限管理增强 + 预加载脚本加固', 'info');

    // 1. 文件结构验证
    this.validateFileStructure();

    // 2. 配置文件安全性验证
    this.validateConfigurationSecurity();

    // 3. 代码质量验证
    this.validateCodeQuality();

    // 4. 运行专项验证脚本
    await this.runValidationScript(
      'scripts/validate-csp-consistency.mjs',
      'CSP策略一致性'
    );
    await this.runValidationScript(
      'scripts/validate-preload-security.mjs',
      '预加载脚本安全性'
    );

    // 5. 生成安全报告
    const report = this.generateSecurityReport();

    // 6. 输出结果
    this.log(`\n🔒 综合安全验证完成`, 'security');
    this.log(`总体评分: ${report.overallScore}/100 (${report.grade}级)`);
    this.log(`通过测试: ${report.passedTests}/${report.totalTests}`);

    if (report.failedTests > 0) {
      this.log(`失败测试: ${report.failedTests}`, 'error');
    }

    if (report.partialTests > 0) {
      this.log(`部分通过: ${report.partialTests}`, 'warn');
    }

    // 输出建议
    if (report.recommendations.length > 0) {
      this.log('\n修复建议:', 'info');
      report.recommendations.forEach(rec => this.log(`  • ${rec}`, 'info'));
    }

    // 判断是否通过安全门禁
    const passThreshold = 85; // 85分以上通过
    const isPassed = report.overallScore >= passThreshold;

    this.log(
      `\n${isPassed ? '✅ 安全门禁通过' : '❌ 安全门禁未通过'}`,
      isPassed ? 'info' : 'error'
    );

    if (!isPassed) {
      this.log(`需要达到${passThreshold}分以上才能通过安全门禁`, 'warn');
    }

    return isPassed ? 0 : 1;
  }
}

// 执行综合验证
async function main() {
  const validator = new ComprehensiveSecurityValidator();
  const exitCode = await validator.validate();
  process.exit(exitCode);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('综合安全验证执行失败:', error);
    process.exit(1);
  });
}

export { ComprehensiveSecurityValidator };
