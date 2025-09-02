/* 安全配置验证脚本 */
import fs from 'fs';
import path from 'path';

/**
 * 安全配置验证器
 */
class SecurityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  /**
   * 运行所有安全验证
   */
  async runAllValidations() {
    console.log('🔒 开始安全配置验证...\n');

    // P0级验证
    this.validateCSPConfiguration();
    this.validateElectronMainSecurity();
    this.validateFusesConfiguration();
    this.validatePackageJsonSecurity();

    // P1级验证
    this.validateCIConfiguration();
    this.validateSecurityToolsConfiguration();
    this.validatePermissionMiddleware();

    // 输出结果
    this.outputResults();
  }

  /**
   * 验证CSP配置
   */
  validateCSPConfiguration() {
    const mainFile = this.readFile('electron/main.ts');
    if (!mainFile) {
      this.addError('CSP', '无法读取 electron/main.ts 文件');
      return;
    }

    // 检查是否移除了 unsafe-inline
    if (mainFile.includes("'unsafe-inline'")) {
      this.addError('CSP', 'CSP配置仍包含 unsafe-inline，违反P0安全要求');
    } else {
      this.addPassed('CSP', '已移除 unsafe-inline，CSP配置安全');
    }

    // 检查是否包含 nonce 配置
    if (mainFile.includes('nonce-${nonce}')) {
      this.addPassed('CSP', 'CSP nonce配置正确');
    } else {
      this.addWarning('CSP', '未找到CSP nonce配置');
    }

    // 检查其他安全指令
    const requiredDirectives = [
      "default-src 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ];

    requiredDirectives.forEach(directive => {
      if (mainFile.includes(directive)) {
        this.addPassed('CSP', `安全指令 ${directive} 配置正确`);
      } else {
        this.addWarning('CSP', `缺少安全指令: ${directive}`);
      }
    });
  }

  /**
   * 验证Electron主进程安全配置
   */
  validateElectronMainSecurity() {
    const mainFile = this.readFile('electron/main.ts');
    if (!mainFile) return;

    // 检查关键安全配置
    const securityChecks = [
      { config: 'sandbox: true', name: '沙盒模式' },
      { config: 'contextIsolation: true', name: '上下文隔离' },
      { config: 'nodeIntegration: false', name: 'Node集成禁用' },
      { config: 'webSecurity: true', name: 'Web安全启用' },
    ];

    securityChecks.forEach(check => {
      if (mainFile.includes(check.config)) {
        this.addPassed('ELECTRON', `${check.name}配置正确`);
      } else {
        this.addError('ELECTRON', `缺少关键安全配置: ${check.name}`);
      }
    });

    // 检查安全策略管理器集成
    if (mainFile.includes('securityPolicyManager.applySecurityPolicies')) {
      this.addPassed('ELECTRON', '统一安全策略管理器已集成');
    } else {
      this.addError('ELECTRON', '未找到统一安全策略管理器集成');
    }
  }

  /**
   * 验证Electron Fuses配置
   */
  validateFusesConfiguration() {
    const fusesFile = this.readFile('scripts/fuses.js');
    if (!fusesFile) {
      this.addError('FUSES', '无法找到 scripts/fuses.js 文件');
      return;
    }

    // 检查关键Fuses配置
    const criticalFuses = [
      { fuse: 'runAsNode: false', name: 'runAsNode禁用' },
      { fuse: 'enableRunAsNode: false', name: 'enableRunAsNode禁用' },
      { fuse: 'onlyLoadAppFromAsar: true', name: 'ASAR专用加载' },
      {
        fuse: 'enableEmbeddedAsarIntegrityValidation: true',
        name: 'ASAR完整性验证',
      },
      {
        fuse: 'enableNodeOptionsEnvironmentVariable: false',
        name: 'NODE_OPTIONS禁用',
      },
    ];

    criticalFuses.forEach(check => {
      if (fusesFile.includes(check.fuse)) {
        this.addPassed('FUSES', `${check.name}配置正确`);
      } else {
        this.addError('FUSES', `缺少关键Fuses配置: ${check.name}`);
      }
    });

    // 检查package.json中的fuses脚本
    const packageJson = this.readJsonFile('package.json');
    if (packageJson && packageJson.scripts) {
      if (packageJson.scripts['security:fuses:prod']) {
        this.addPassed('FUSES', 'package.json中包含Fuses生产环境脚本');
      } else {
        this.addWarning('FUSES', 'package.json中缺少Fuses生产环境脚本');
      }
    }
  }

  /**
   * 验证package.json安全配置
   */
  validatePackageJsonSecurity() {
    const packageJson = this.readJsonFile('package.json');
    if (!packageJson) {
      this.addError('PACKAGE', '无法读取 package.json 文件');
      return;
    }

    // 检查安全工具依赖
    const requiredSecurityDeps = [
      '@electron/fuses',
      '@doyensec/electronegativity',
      'audit-ci',
      'eslint-plugin-security',
    ];

    const devDeps = packageJson.devDependencies || {};
    requiredSecurityDeps.forEach(dep => {
      if (devDeps[dep]) {
        this.addPassed('PACKAGE', `安全依赖 ${dep} 已安装`);
      } else {
        this.addError('PACKAGE', `缺少安全依赖: ${dep}`);
      }
    });

    // 检查安全脚本
    const securityScripts = [
      'security:scan',
      'security:audit',
      'security:check',
    ];

    const scripts = packageJson.scripts || {};
    securityScripts.forEach(script => {
      if (scripts[script]) {
        this.addPassed('PACKAGE', `安全脚本 ${script} 已配置`);
      } else {
        this.addError('PACKAGE', `缺少安全脚本: ${script}`);
      }
    });
  }

  /**
   * 验证CI配置
   */
  validateCIConfiguration() {
    const workflowFile = this.readFile('.github/workflows/security.yml');
    if (!workflowFile) {
      this.addError('CI', '无法找到 .github/workflows/security.yml 文件');
      return;
    }

    // 检查关键CI配置
    const ciChecks = [
      { check: 'P0安全门禁检查', name: 'P0安全门禁' },
      { check: 'CRITICAL_ERRORS', name: 'Critical级别错误检查' },
      { check: 'electronegativity --input', name: 'Electronegativity扫描' },
      { check: 'npm audit', name: 'npm依赖审计' },
      { check: 'snyk test', name: 'Snyk安全扫描' },
    ];

    ciChecks.forEach(check => {
      if (workflowFile.includes(check.check)) {
        this.addPassed('CI', `${check.name}配置正确`);
      } else {
        this.addError('CI', `缺少CI配置: ${check.name}`);
      }
    });

    // 检查是否包含安全门禁的失败机制
    if (
      workflowFile.includes('exit 1') &&
      workflowFile.includes('CRITICAL_ERRORS')
    ) {
      this.addPassed('CI', 'P0安全门禁失败机制配置正确');
    } else {
      this.addError('CI', 'P0安全门禁缺少失败机制');
    }
  }

  /**
   * 验证安全工具配置文件
   */
  validateSecurityToolsConfiguration() {
    // 检查Electronegativity配置
    if (this.fileExists('.electronegativity.config.js')) {
      this.addPassed('TOOLS', 'Electronegativity配置文件存在');
    } else {
      this.addError('TOOLS', '缺少Electronegativity配置文件');
    }

    // 检查audit-ci配置
    if (this.fileExists('.audit-ci.json')) {
      this.addPassed('TOOLS', 'audit-ci配置文件存在');
    } else {
      this.addError('TOOLS', '缺少audit-ci配置文件');
    }

    // 检查安全监控模块
    if (this.fileExists('src/security/monitoring.ts')) {
      this.addPassed('TOOLS', '安全监控模块存在');
    } else {
      this.addWarning('TOOLS', '缺少安全监控模块');
    }
  }

  /**
   * 验证权限中间件
   */
  validatePermissionMiddleware() {
    const permissionsFile = this.readFile('electron/security/permissions.ts');
    if (!permissionsFile) {
      this.addError('PERMISSIONS', '无法找到权限中间件文件');
      return;
    }

    // 检查关键权限配置
    const permissionChecks = [
      'setPermissionRequestHandler',
      'setWindowOpenHandler',
      'will-navigate',
      'allowedOrigins',
      'allowedPermissions',
    ];

    permissionChecks.forEach(check => {
      if (permissionsFile.includes(check)) {
        this.addPassed('PERMISSIONS', `权限控制 ${check} 配置正确`);
      } else {
        this.addError('PERMISSIONS', `缺少权限控制: ${check}`);
      }
    });
  }

  /**
   * 辅助方法
   */
  readFile(filePath) {
    try {
      // 使用 process.cwd() 代替 __dirname 在 ES 模块中
      return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
    } catch (error) {
      return null;
    }
  }

  readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(
        path.join(process.cwd(), filePath),
        'utf8'
      );
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  fileExists(filePath) {
    try {
      return fs.existsSync(path.join(process.cwd(), filePath));
    } catch (error) {
      return false;
    }
  }

  addError(category, message) {
    this.errors.push({ category, message });
  }

  addWarning(category, message) {
    this.warnings.push({ category, message });
  }

  addPassed(category, message) {
    this.passed.push({ category, message });
  }

  /**
   * 输出验证结果
   */
  outputResults() {
    console.log('\n📊 安全配置验证结果\n');

    // 成功的配置
    if (this.passed.length > 0) {
      console.log('✅ 通过的安全配置:');
      this.passed.forEach(item => {
        console.log(`   [${item.category}] ${item.message}`);
      });
      console.log('');
    }

    // 警告
    if (this.warnings.length > 0) {
      console.log('⚠️  警告:');
      this.warnings.forEach(item => {
        console.log(`   [${item.category}] ${item.message}`);
      });
      console.log('');
    }

    // 错误
    if (this.errors.length > 0) {
      console.log('❌ 需要修复的问题:');
      this.errors.forEach(item => {
        console.log(`   [${item.category}] ${item.message}`);
      });
      console.log('');
    }

    // 总结
    const total =
      this.passed.length + this.warnings.length + this.errors.length;
    const successRate = ((this.passed.length / total) * 100).toFixed(1);

    console.log('📈 验证摘要:');
    console.log(`   ✅ 通过: ${this.passed.length}`);
    console.log(`   ⚠️  警告: ${this.warnings.length}`);
    console.log(`   ❌ 错误: ${this.errors.length}`);
    console.log(`   📊 成功率: ${successRate}%`);

    // 安全等级评估
    if (this.errors.length === 0) {
      console.log('\n🎯 安全等级: 企业级 (所有P0要求已满足)');
    } else if (this.errors.length <= 3) {
      console.log('\n🎯 安全等级: 高级 (存在少量问题)');
    } else {
      console.log('\n🎯 安全等级: 中等 (需要重点改进)');
    }

    // 退出代码
    if (this.errors.length > 0) {
      console.log('\n🚨 发现安全配置问题，请修复后重新验证');
      process.exit(1);
    } else {
      console.log('\n🎉 所有安全配置验证通过！');
      process.exit(0);
    }
  }
}

// 如果直接运行此脚本
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const validator = new SecurityValidator();
  validator.runAllValidations();
}

export default SecurityValidator;
