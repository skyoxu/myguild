#!/usr/bin/env node
/**
 * 安全问题自动修复脚本
 *
 * 功能:
 * 1. 自动修复常见安全配置问题
 * 2. 更新不安全的依赖
 * 3. 应用安全最佳实践
 * 4. 生成修复报告
 *
 * 使用: node scripts/security-auto-fix.mjs [--dry-run] [--category=all|csp|electron|deps]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

class SecurityAutoFix {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.category = options.category || 'all';
    this.fixes = [];
    this.errors = [];
  }

  log(message, level = 'info') {
    const prefix =
      {
        info: '✅',
        warn: '⚠️',
        error: '❌',
        fix: '🔧',
      }[level] || 'ℹ️';

    console.log(`${prefix} ${message}`);
  }

  recordFix(description, file = null, changes = null) {
    this.fixes.push({
      description,
      file,
      changes,
      timestamp: new Date().toISOString(),
    });
    this.log(description, 'fix');
  }

  recordError(error, context = null) {
    this.errors.push({
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
    this.log(`修复失败: ${error.message}`, 'error');
  }

  // 修复CSP配置问题
  async fixCSPIssues() {
    if (this.category !== 'all' && this.category !== 'csp') return;

    this.log('开始修复CSP配置问题...', 'info');

    try {
      // 修复index.html中的CSP
      const indexFile = join(ROOT_DIR, 'index.html');
      if (existsSync(indexFile)) {
        const content = readFileSync(indexFile, 'utf8');

        // 安全的CSP策略
        const secureCSP = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://sentry.io https://*.sentry.io; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none';`;

        // 查找并替换CSP
        const cspRegex =
          /(<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=["'])([^"']+)(["'][^>]*>)/i;
        const match = content.match(cspRegex);

        if (match) {
          const currentCSP = match[2];

          // 检查是否包含不安全的指令
          const unsafePatterns = [
            "'unsafe-inline'",
            "'unsafe-eval'",
            'data: ',
            '* ',
            'http:',
          ];

          let needsFix = false;
          unsafePatterns.forEach(pattern => {
            if (currentCSP.includes(pattern)) {
              needsFix = true;
            }
          });

          if (needsFix || !currentCSP.includes("default-src 'none'")) {
            const newContent = content.replace(cspRegex, `$1${secureCSP}$3`);

            if (!this.dryRun) {
              writeFileSync(indexFile, newContent, 'utf8');
            }

            this.recordFix('修复index.html中的CSP策略', indexFile, {
              old: currentCSP,
              new: secureCSP,
            });
          }
        } else {
          // 添加CSP meta标签
          const headMatch = content.match(/(<head[^>]*>)/i);
          if (headMatch) {
            const cspMeta = `\n    <meta http-equiv="Content-Security-Policy" content="${secureCSP}" />`;
            const newContent = content.replace(
              /(<head[^>]*>)/i,
              `$1${cspMeta}`
            );

            if (!this.dryRun) {
              writeFileSync(indexFile, newContent, 'utf8');
            }

            this.recordFix('添加CSP meta标签到index.html', indexFile);
          }
        }
      }

      // 修复main.ts中的CSP配置
      const mainFile = join(ROOT_DIR, 'electron/main.ts');
      if (existsSync(mainFile)) {
        let content = readFileSync(mainFile, 'utf8');

        // 检查是否有不安全的CSP配置
        if (
          content.includes("'unsafe-inline'") ||
          content.includes("'unsafe-eval'")
        ) {
          // 替换不安全的CSP配置
          content = content.replace(/'unsafe-inline'/g, "'self'");
          content = content.replace(/'unsafe-eval'/g, "'self'");

          if (!this.dryRun) {
            writeFileSync(mainFile, content, 'utf8');
          }

          this.recordFix('移除main.ts中的不安全CSP指令', mainFile);
        }
      }
    } catch (error) {
      this.recordError(error, 'CSP修复');
    }
  }

  // 修复Electron安全配置
  async fixElectronSecurity() {
    if (this.category !== 'all' && this.category !== 'electron') return;

    this.log('开始修复Electron安全配置...', 'info');

    try {
      const mainFile = join(ROOT_DIR, 'electron/main.ts');
      if (existsSync(mainFile)) {
        let content = readFileSync(mainFile, 'utf8');
        let modified = false;

        // 修复危险的安全配置
        const dangerousConfigs = [
          {
            pattern: /nodeIntegration:\s*true/g,
            fix: 'nodeIntegration: false',
          },
          {
            pattern: /contextIsolation:\s*false/g,
            fix: 'contextIsolation: true',
          },
          { pattern: /sandbox:\s*false/g, fix: 'sandbox: true' },
          { pattern: /webSecurity:\s*false/g, fix: 'webSecurity: true' },
        ];

        dangerousConfigs.forEach(config => {
          if (config.pattern.test(content)) {
            content = content.replace(config.pattern, config.fix);
            modified = true;
            this.recordFix(`修复Electron配置: ${config.fix}`, mainFile);
          }
        });

        if (modified && !this.dryRun) {
          writeFileSync(mainFile, content, 'utf8');
        }
      }

      // 修复preload.ts安全问题
      const preloadFile = join(ROOT_DIR, 'electron/preload.ts');
      if (existsSync(preloadFile)) {
        let content = readFileSync(preloadFile, 'utf8');
        let modified = false;

        // 确保有context isolation检查
        if (!content.includes('process.contextIsolated')) {
          const checkCode = `
// 验证上下文隔离是否正确启用
if (!process.contextIsolated) {
  throw new Error('Context isolation must be enabled for security');
}

`;
          content = checkCode + content;
          modified = true;
          this.recordFix('添加预加载脚本上下文隔离检查', preloadFile);
        }

        // 移除不安全的全局变量暴露
        if (
          content.includes('window.require') ||
          content.includes('window.process')
        ) {
          content = content.replace(/window\.require\s*=.*$/gm, '');
          content = content.replace(/window\.process\s*=.*$/gm, '');
          modified = true;
          this.recordFix('移除预加载脚本中的危险全局变量暴露', preloadFile);
        }

        if (modified && !this.dryRun) {
          writeFileSync(preloadFile, content, 'utf8');
        }
      }
    } catch (error) {
      this.recordError(error, 'Electron安全修复');
    }
  }

  // 修复依赖安全问题
  async fixDependencyIssues() {
    if (this.category !== 'all' && this.category !== 'deps') return;

    this.log('开始修复依赖安全问题...', 'info');

    try {
      // 运行npm audit fix
      if (!this.dryRun) {
        try {
          execSync('npm audit fix', {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            timeout: 120000, // 2分钟超时
          });
          this.recordFix('执行npm audit fix修复依赖漏洞');
        } catch (auditError) {
          // audit fix失败时尝试force fix
          try {
            execSync('npm audit fix --force', {
              cwd: ROOT_DIR,
              stdio: 'inherit',
              timeout: 120000,
            });
            this.recordFix('执行npm audit fix --force修复依赖漏洞');
          } catch (forceError) {
            this.recordError(forceError, '依赖修复');
          }
        }
      }

      // 检查package.json中的危险依赖
      const packageFile = join(ROOT_DIR, 'package.json');
      if (existsSync(packageFile)) {
        const packageData = JSON.parse(readFileSync(packageFile, 'utf8'));

        // 检查已知的危险包
        const dangerousPackages = [
          'eval',
          'serialize-javascript',
          'node-serialize',
          'unsafe-eval',
        ];

        const modified = false;
        const allDeps = {
          ...packageData.dependencies,
          ...packageData.devDependencies,
        };

        dangerousPackages.forEach(pkg => {
          if (allDeps[pkg]) {
            this.log(`发现潜在危险依赖: ${pkg}`, 'warn');
            // 这里不自动删除，而是记录警告
            this.recordFix(
              `检测到潜在危险依赖: ${pkg}，请手动审查`,
              packageFile
            );
          }
        });
      }
    } catch (error) {
      this.recordError(error, '依赖安全修复');
    }
  }

  // 修复测试配置安全问题
  async fixTestSecurity() {
    if (this.category !== 'all' && this.category !== 'test') return;

    this.log('开始修复测试配置安全问题...', 'info');

    try {
      const playwrightConfig = join(ROOT_DIR, 'playwright.config.ts');
      if (existsSync(playwrightConfig)) {
        let content = readFileSync(playwrightConfig, 'utf8');
        let modified = false;

        // 移除测试中的不安全参数
        const unsafeArgs = [
          '--disable-web-security',
          '--no-sandbox',
          '--disable-features=VizDisplayCompositor',
        ];

        unsafeArgs.forEach(arg => {
          const regex = new RegExp(
            `['"]${arg.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}['"],?\\s*`,
            'g'
          );
          if (regex.test(content)) {
            content = content.replace(regex, '');
            modified = true;
            this.recordFix(
              `移除测试配置中的不安全参数: ${arg}`,
              playwrightConfig
            );
          }
        });

        // 确保有安全的测试环境配置
        if (!content.includes('SECURITY_TEST_MODE')) {
          const envSection = content.match(/env:\s*{([^}]*)}/);
          if (envSection) {
            const newEnv = envSection[0].replace(
              /}$/,
              `  SECURITY_TEST_MODE: 'true',\n        }`
            );
            content = content.replace(envSection[0], newEnv);
            modified = true;
            this.recordFix('添加安全测试模式环境变量', playwrightConfig);
          }
        }

        if (modified && !this.dryRun) {
          writeFileSync(playwrightConfig, content, 'utf8');
        }
      }
    } catch (error) {
      this.recordError(error, '测试安全修复');
    }
  }

  // 生成修复报告
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      mode: this.dryRun ? 'DRY_RUN' : 'APPLIED',
      category: this.category,

      summary: {
        total_fixes: this.fixes.length,
        total_errors: this.errors.length,
        status: this.errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
      },

      fixes: this.fixes,
      errors: this.errors,

      recommendations: [
        '运行完整的安全门禁检查验证修复效果',
        '手动审查所有配置文件更改',
        '运行测试套件确保功能正常',
        '检查应用是否正常启动和运行',
      ],
    };

    return report;
  }

  // 主执行函数
  async run() {
    this.log(
      `开始自动安全修复... (模式: ${this.dryRun ? 'DRY_RUN' : 'APPLY'})`,
      'info'
    );
    this.log(`修复类别: ${this.category}`, 'info');

    const fixFunctions = [
      ['CSP配置', () => this.fixCSPIssues()],
      ['Electron安全', () => this.fixElectronSecurity()],
      ['依赖安全', () => this.fixDependencyIssues()],
      ['测试安全', () => this.fixTestSecurity()],
    ];

    for (const [category, fixFn] of fixFunctions) {
      try {
        this.log(`执行修复: ${category}`);
        await fixFn();
      } catch (error) {
        this.recordError(error, category);
      }
    }

    const report = this.generateReport();

    this.log(`\n=== 修复完成 ===`);
    this.log(`修复项目: ${report.summary.total_fixes}`);
    this.log(`错误数量: ${report.summary.total_errors}`);
    this.log(`状态: ${report.summary.status}`);

    if (this.dryRun) {
      this.log('\n这是试运行模式，未实际修改文件', 'warn');
      this.log('使用 --apply 参数应用修复', 'info');
    }

    // 输出详细报告
    if (process.env.VERBOSE === 'true') {
      console.log('\n=== 详细报告 ===');
      console.log(JSON.stringify(report, null, 2));
    }

    return report;
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: !args.includes('--apply') && !args.includes('--force'),
    category: 'all',
  };

  args.forEach(arg => {
    if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1];
    }
  });

  const fixer = new SecurityAutoFix(options);
  const report = await fixer.run();

  process.exit(report.summary.status === 'SUCCESS' ? 0 : 1);
}

// 如果直接运行此脚本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('自动修复执行异常:', error);
    process.exit(1);
  });
}

export { SecurityAutoFix };
