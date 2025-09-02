#!/usr/bin/env node

/**
 * 可观测性系统验证脚本
 *
 * 用于CI/CD环境中快速验证可观测性系统的基本功能
 */

// 加载环境变量
import fs from 'fs';
import path from 'path';

try {
  await import('dotenv/config');
} catch (error) {
  // dotenv 可能未安装，继续执行
}

// 验证结果
class VerificationResult {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.checks = [];
    this.overall = {
      passed: false,
      score: 0,
      grade: 'F',
      total: 0,
      successful: 0,
      failed: 0,
    };
    this.recommendations = [];
    this.errors = [];
  }

  addCheck(name, passed, details = null, error = null) {
    this.checks.push({
      name,
      passed,
      details,
      error: error ? error.message : null,
    });

    this.overall.total++;
    if (passed) {
      this.overall.successful++;
    } else {
      this.overall.failed++;
      if (error) {
        this.errors.push(`${name}: ${error.message}`);
      }
    }
  }

  finalize() {
    this.overall.score =
      this.overall.total > 0
        ? Math.round((this.overall.successful / this.overall.total) * 100)
        : 0;

    this.overall.passed = this.overall.score >= 80;
    this.overall.grade = this.scoreToGrade(this.overall.score);

    this.generateRecommendations();
  }

  scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  generateRecommendations() {
    if (this.overall.score < 60) {
      this.recommendations.push('🚨 可观测性系统存在严重问题，建议立即修复');
    } else if (this.overall.score < 80) {
      this.recommendations.push(
        '⚠️ 可观测性系统需要改进，建议修复失败的检查项'
      );
    } else if (this.overall.score < 95) {
      this.recommendations.push('✅ 可观测性系统基本正常，建议优化剩余问题');
    } else {
      this.recommendations.push('🎉 可观测性系统配置优秀！');
    }

    if (this.errors.length > 0) {
      this.recommendations.push('📋 请优先修复以下错误:');
      this.errors.forEach(error => {
        this.recommendations.push(`   - ${error}`);
      });
    }
  }

  printSummary() {
    console.log('\n📊 === 可观测性系统验证结果 ===');
    console.log(`🕐 验证时间: ${this.timestamp}`);
    console.log(`📈 总分: ${this.overall.score}/100 (${this.overall.grade}级)`);
    console.log(`✅ 成功: ${this.overall.successful}/${this.overall.total}`);
    console.log(`❌ 失败: ${this.overall.failed}/${this.overall.total}`);
    console.log(`🎯 结果: ${this.overall.passed ? '通过' : '失败'}`);

    console.log('\n📋 检查详情:');
    this.checks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      console.log(`  ${status} ${check.name}`);
      if (!check.passed && check.error) {
        console.log(`     错误: ${check.error}`);
      }
    });

    if (this.recommendations.length > 0) {
      console.log('\n💡 建议:');
      this.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log('='.repeat(50));
  }
}

/**
 * 可观测性验证器
 */
class ObservabilityVerifier {
  constructor() {
    this.result = new VerificationResult();
    this.projectRoot = process.cwd();
  }

  async runVerification() {
    console.log('🔍 开始可观测性系统验证...');

    try {
      // 1. 文件结构验证
      await this.verifyFileStructure();

      // 2. 配置文件验证
      await this.verifyConfiguration();

      // 3. 环境变量验证
      await this.verifyEnvironmentVariables();

      // 4. 依赖验证
      await this.verifyDependencies();

      // 5. 基础功能验证
      await this.verifyBasicFunctionality();

      // 6. 安全检查
      await this.verifySecurity();
    } catch (error) {
      console.error('❌ 验证过程中发生错误:', error);
      this.result.addCheck('验证过程完整性', false, null, error);
    }

    this.result.finalize();
    return this.result;
  }

  async verifyFileStructure() {
    console.log('📁 验证文件结构...');

    const requiredFiles = [
      'src/shared/observability/sentry-main.ts',
      'src/shared/observability/sentry-renderer.ts',
      'src/shared/observability/sentry-detector.ts',
      'src/shared/observability/sentry-main-detector.ts',
      'src/shared/observability/config-validator.ts',
      'src/shared/observability/logging-health-checker.ts',
      'src/shared/observability/observability-gatekeeper.ts',
      'src/shared/observability/resilience-manager.ts',
    ];

    const requiredDirs = [
      'src/shared/observability',
      'logs',
      '.github/workflows',
    ];

    // 检查必需文件
    for (const file of requiredFiles) {
      try {
        const filePath = path.join(this.projectRoot, file);
        const exists = fs.existsSync(filePath);
        this.result.addCheck(
          `必需文件: ${file}`,
          exists,
          exists ? { size: fs.statSync(filePath).size } : null,
          exists ? null : new Error('文件不存在')
        );
      } catch (error) {
        this.result.addCheck(`必需文件: ${file}`, false, null, error);
      }
    }

    // 检查必需目录
    for (const dir of requiredDirs) {
      try {
        const dirPath = path.join(this.projectRoot, dir);
        const exists = fs.existsSync(dirPath);

        if (!exists && dir === 'logs') {
          // 尝试创建logs目录
          fs.mkdirSync(dirPath, { recursive: true });
        }

        const finalExists = fs.existsSync(dirPath);
        this.result.addCheck(
          `必需目录: ${dir}`,
          finalExists,
          finalExists ? { created: !exists } : null,
          finalExists ? null : new Error('目录不存在且无法创建')
        );
      } catch (error) {
        this.result.addCheck(`必需目录: ${dir}`, false, null, error);
      }
    }
  }

  async verifyConfiguration() {
    console.log('⚙️ 验证配置文件...');

    // 检查package.json
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const hasSentryDeps =
        packageJson.dependencies &&
        (packageJson.dependencies['@sentry/electron'] ||
          packageJson.dependencies['@sentry/node'] ||
          packageJson.dependencies['@sentry/browser']);

      this.result.addCheck(
        'package.json Sentry依赖',
        !!hasSentryDeps,
        { dependencies: hasSentryDeps },
        hasSentryDeps ? null : new Error('缺少Sentry依赖')
      );

      // 检查scripts
      const hasTestScript = packageJson.scripts && packageJson.scripts.test;
      this.result.addCheck(
        'package.json 测试脚本',
        !!hasTestScript,
        { testScript: hasTestScript },
        hasTestScript ? null : new Error('缺少测试脚本')
      );
    } catch (error) {
      this.result.addCheck('package.json 检查', false, null, error);
    }

    // 检查TypeScript配置
    try {
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      const tsconfigAppPath = path.join(this.projectRoot, 'tsconfig.app.json');
      const tsconfigNodePath = path.join(
        this.projectRoot,
        'tsconfig.node.json'
      );

      let hasStrictMode = false;
      let configDetails = {};

      // 辅助函数：解析JSONC格式（移除注释）
      const parseJSONC = content => {
        // 简单的注释移除逻辑
        const cleanContent = content
          .replace(/\/\*[\s\S]*?\*\//g, '') // 移除 /* */ 注释
          .replace(/\/\/.*$/gm, ''); // 移除 // 注释
        return JSON.parse(cleanContent);
      };

      // 检查主配置文件
      if (fs.existsSync(tsconfigPath)) {
        try {
          const content = fs.readFileSync(tsconfigPath, 'utf8');
          const tsconfig = parseJSONC(content);
          if (tsconfig.compilerOptions && tsconfig.compilerOptions.strict) {
            hasStrictMode = true;
            configDetails = { strict: true, file: 'tsconfig.json' };
          }
        } catch (e) {
          // 忽略解析错误，继续检查其他文件
        }
      }

      // 检查 tsconfig.app.json（项目引用配置）
      if (!hasStrictMode && fs.existsSync(tsconfigAppPath)) {
        try {
          const content = fs.readFileSync(tsconfigAppPath, 'utf8');
          const tsconfigApp = parseJSONC(content);
          if (
            tsconfigApp.compilerOptions &&
            tsconfigApp.compilerOptions.strict
          ) {
            hasStrictMode = true;
            configDetails = { strict: true, file: 'tsconfig.app.json' };
          }
        } catch (e) {
          // 忽略解析错误，继续检查其他文件
        }
      }

      // 检查 tsconfig.node.json
      if (!hasStrictMode && fs.existsSync(tsconfigNodePath)) {
        try {
          const content = fs.readFileSync(tsconfigNodePath, 'utf8');
          const tsconfigNode = parseJSONC(content);
          if (
            tsconfigNode.compilerOptions &&
            tsconfigNode.compilerOptions.strict
          ) {
            hasStrictMode = true;
            configDetails = { strict: true, file: 'tsconfig.node.json' };
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      this.result.addCheck(
        'TypeScript配置',
        hasStrictMode,
        configDetails,
        hasStrictMode ? null : new Error('建议启用strict模式')
      );
    } catch (error) {
      this.result.addCheck('TypeScript配置检查', false, null, error);
    }

    // 检查.env.example
    try {
      const envExamplePath = path.join(this.projectRoot, '.env.example');
      const envExampleExists = fs.existsSync(envExamplePath);

      if (envExampleExists) {
        const envContent = fs.readFileSync(envExamplePath, 'utf8');
        const hasSentryDsn = envContent.includes('SENTRY_DSN');
        const hasNodeEnv = envContent.includes('NODE_ENV');

        this.result.addCheck(
          '.env.example 配置',
          hasSentryDsn && hasNodeEnv,
          { hasSentryDsn, hasNodeEnv },
          hasSentryDsn && hasNodeEnv
            ? null
            : new Error('缺少必要的环境变量模板')
        );
      } else {
        this.result.addCheck(
          '.env.example 配置',
          false,
          null,
          new Error('.env.example文件不存在')
        );
      }
    } catch (error) {
      this.result.addCheck('.env.example 检查', false, null, error);
    }
  }

  async verifyEnvironmentVariables() {
    console.log('🌍 验证环境变量...');

    const requiredVars = ['NODE_ENV'];
    const optionalVars = [
      'SENTRY_DSN',
      'SENTRY_ORG',
      'SENTRY_PROJECT',
      'LOG_LEVEL',
    ];

    // 检查必需环境变量
    for (const varName of requiredVars) {
      const value = process.env[varName];
      this.result.addCheck(
        `环境变量: ${varName}`,
        !!value,
        { value: value || 'undefined' },
        value ? null : new Error('必需的环境变量未设置')
      );
    }

    // 检查可选环境变量
    let optionalVarsSet = 0;
    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value) optionalVarsSet++;
    }

    this.result.addCheck(
      '可选环境变量覆盖率',
      optionalVarsSet >= 2, // 至少设置2个可选变量
      {
        setVars: optionalVarsSet,
        totalOptional: optionalVars.length,
        coverage: Math.round((optionalVarsSet / optionalVars.length) * 100),
      },
      optionalVarsSet >= 2 ? null : new Error('建议设置更多可选环境变量')
    );

    // 检查环境变量安全性
    const sentryDsn = process.env.SENTRY_DSN;
    if (sentryDsn) {
      const isSafeDsn =
        !sentryDsn.includes('test') &&
        !sentryDsn.includes('example') &&
        sentryDsn.startsWith('https://');

      this.result.addCheck(
        'SENTRY_DSN 安全性',
        isSafeDsn,
        { format: 'https检查', noTestValues: '无测试值' },
        isSafeDsn ? null : new Error('SENTRY_DSN可能包含测试值或格式不正确')
      );
    }
  }

  async verifyDependencies() {
    console.log('📦 验证依赖...');

    try {
      // 检查node_modules是否存在
      const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
      const nodeModulesExists = fs.existsSync(nodeModulesPath);

      this.result.addCheck(
        'node_modules 安装',
        nodeModulesExists,
        { path: nodeModulesPath },
        nodeModulesExists ? null : new Error('依赖未安装，请运行 npm install')
      );

      if (nodeModulesExists) {
        // 检查关键依赖
        const criticalDeps = [
          '@sentry/electron',
          '@sentry/node',
          '@sentry/browser',
          'typescript',
        ];

        for (const dep of criticalDeps) {
          const depPath = path.join(nodeModulesPath, dep);
          const depExists = fs.existsSync(depPath);

          this.result.addCheck(
            `依赖: ${dep}`,
            depExists,
            { installed: depExists },
            depExists ? null : new Error(`${dep} 未安装`)
          );
        }
      }
    } catch (error) {
      this.result.addCheck('依赖验证', false, null, error);
    }
  }

  async verifyBasicFunctionality() {
    console.log('🔧 验证基础功能...');

    // 检查JSON处理能力
    try {
      const testObject = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '功能测试',
        context: { test: true },
      };

      const jsonString = JSON.stringify(testObject);
      const parsed = JSON.parse(jsonString);

      const jsonWorks =
        parsed.timestamp === testObject.timestamp &&
        parsed.level === testObject.level;

      this.result.addCheck(
        'JSON序列化/反序列化',
        jsonWorks,
        {
          originalSize: JSON.stringify(testObject).length,
          roundTrip: jsonWorks,
        },
        jsonWorks ? null : new Error('JSON处理失败')
      );
    } catch (error) {
      this.result.addCheck('JSON处理测试', false, null, error);
    }

    // 检查文件系统操作
    try {
      const testDir = path.join(this.projectRoot, 'logs', 'test');
      const testFile = path.join(testDir, 'functionality-test.log');

      // 创建测试目录
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // 写入测试文件
      fs.writeFileSync(testFile, 'functionality test\n');

      // 验证文件存在
      const fileExists = fs.existsSync(testFile);

      // 清理测试文件
      if (fileExists) {
        fs.unlinkSync(testFile);
      }

      this.result.addCheck(
        '文件系统读写',
        fileExists,
        { testFile, created: fileExists, cleaned: true },
        fileExists ? null : new Error('文件系统操作失败')
      );
    } catch (error) {
      this.result.addCheck('文件系统测试', false, null, error);
    }

    // 检查内存使用
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const memoryHealthy = heapUsedMB < 200; // 小于200MB认为正常

      this.result.addCheck(
        '内存使用检查',
        memoryHealthy,
        {
          heapUsedMB,
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        memoryHealthy ? null : new Error(`内存使用过高: ${heapUsedMB}MB`)
      );
    } catch (error) {
      this.result.addCheck('内存检查', false, null, error);
    }
  }

  async verifySecurity() {
    console.log('🔒 验证安全配置...');

    // 检查.gitignore
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      const gitignoreExists = fs.existsSync(gitignorePath);

      if (gitignoreExists) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        const ignoresEnv = gitignoreContent.includes('.env');
        const ignoresLogs =
          gitignoreContent.includes('logs/') ||
          gitignoreContent.includes('*.log');
        const ignoresNodeModules = gitignoreContent.includes('node_modules');

        const securityScore = [
          ignoresEnv,
          ignoresLogs,
          ignoresNodeModules,
        ].filter(Boolean).length;

        this.result.addCheck(
          '.gitignore 安全配置',
          securityScore >= 2,
          { ignoresEnv, ignoresLogs, ignoresNodeModules, score: securityScore },
          securityScore >= 2 ? null : new Error('gitignore安全配置不完整')
        );
      } else {
        this.result.addCheck(
          '.gitignore 安全配置',
          false,
          null,
          new Error('.gitignore文件不存在')
        );
      }
    } catch (error) {
      this.result.addCheck('.gitignore 检查', false, null, error);
    }

    // 检查硬编码密钥
    try {
      const suspiciousPatterns = [
        'sk_test_',
        'sk_live_',
        'password=',
        'secret=',
        'api_key=',
      ];

      let suspiciousFound = false;
      const suspiciousFiles = [];

      // 简化的源码扫描
      const scanFiles = [
        'src/shared/observability/sentry-main.ts',
        'src/shared/observability/sentry-renderer.ts',
      ];

      for (const file of scanFiles) {
        const filePath = path.join(this.projectRoot, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');

          for (const pattern of suspiciousPatterns) {
            if (content.includes(pattern)) {
              suspiciousFound = true;
              suspiciousFiles.push({ file, pattern });
            }
          }
        }
      }

      this.result.addCheck(
        '硬编码密钥检查',
        !suspiciousFound,
        {
          scannedFiles: scanFiles.length,
          suspiciousFiles: suspiciousFiles.length,
          clean: !suspiciousFound,
        },
        !suspiciousFound
          ? null
          : new Error(`发现可疑的硬编码密钥: ${suspiciousFiles.length}处`)
      );
    } catch (error) {
      this.result.addCheck('密钥安全检查', false, null, error);
    }
  }
}

// 主执行函数
async function main() {
  const verifier = new ObservabilityVerifier();

  try {
    const result = await verifier.runVerification();
    result.printSummary();

    // 保存验证结果
    const resultFile = path.join(
      process.cwd(),
      'logs',
      'observability-verification.json'
    );
    try {
      const resultDir = path.dirname(resultFile);
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
      }
      fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
      console.log(`\n📄 验证结果已保存到: ${resultFile}`);
    } catch (saveError) {
      console.warn('⚠️ 无法保存验证结果:', saveError.message);
    }

    // 设置退出码
    process.exit(result.overall.passed ? 0 : 1);
  } catch (error) {
    console.error('💥 验证失败:', error);
    process.exit(1);
  }
}

// 如果直接运行
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { ObservabilityVerifier, VerificationResult };
