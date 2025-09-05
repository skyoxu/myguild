#!/usr/bin/env node

/**
 * 部署就绪性验证脚本
 *
 * 验证统一门禁系统是否已准备好部署到生产环境
 *
 * 检查项目：
 * - 所有基础设施脚本是否存在且可执行
 * - GitHub Actions工作流语法是否正确
 * - package.json脚本是否正确配置
 * - 必要的配置文件是否存在
 * - 系统能否通过完整的门禁检查
 *
 * 使用：node scripts/validate-deployment-readiness.js
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeploymentValidator {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.results = {
      checks: [],
      passed: 0,
      failed: 0,
      warnings: 0,
    };
  }

  /**
   * 添加检查结果
   */
  addCheck(category, name, status, message, details = null) {
    const check = {
      category,
      name,
      status, // 'pass', 'fail', 'warn'
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    this.results.checks.push(check);

    if (status === 'pass') {
      this.results.passed++;
      console.log(`✅ [${category}] ${name}: ${message}`);
    } else if (status === 'fail') {
      this.results.failed++;
      console.log(`❌ [${category}] ${name}: ${message}`);
      if (details) console.log(`   详情: ${details}`);
    } else if (status === 'warn') {
      this.results.warnings++;
      console.log(`⚠️  [${category}] ${name}: ${message}`);
    }
  }

  /**
   * 验证基础设施脚本存在且可执行
   */
  async validateInfrastructureScripts() {
    console.log('\n🔍 验证基础设施脚本...');

    const requiredScripts = [
      {
        path: 'scripts/observability-config-validation.js',
        description: '可观测性统一验证脚本',
      },
      {
        path: 'scripts/security-gate-wrapper.js',
        description: '安全统一包装器脚本',
      },
      {
        path: 'scripts/soft-gate-reporter.js',
        description: '软门禁报告脚本',
      },
      {
        path: 'scripts/monitor-ci-performance.js',
        description: 'CI性能监控脚本',
      },
    ];

    for (const script of requiredScripts) {
      const fullPath = path.join(this.projectRoot, script.path);

      try {
        await fs.access(fullPath);

        // 尝试执行脚本检查语法
        try {
          execSync(`node -c "${fullPath}"`, { timeout: 5000, stdio: 'pipe' });
          this.addCheck(
            '基础设施',
            script.description,
            'pass',
            '脚本存在且语法正确'
          );
        } catch (syntaxError) {
          this.addCheck(
            '基础设施',
            script.description,
            'fail',
            '脚本语法错误',
            syntaxError.message
          );
        }
      } catch (error) {
        this.addCheck(
          '基础设施',
          script.description,
          'fail',
          '脚本文件不存在',
          script.path
        );
      }
    }
  }

  /**
   * 验证GitHub Actions工作流
   */
  async validateWorkflows() {
    console.log('\n🔍 验证GitHub Actions工作流...');

    const requiredWorkflows = [
      {
        path: '.github/workflows/security-unified.yml',
        description: '统一安全工作流',
      },
      {
        path: '.github/workflows/observability-gate.yml',
        description: '统一可观测性工作流',
      },
      {
        path: '.github/workflows/soft-gates.yml',
        description: '软门禁工作流',
      },
    ];

    for (const workflow of requiredWorkflows) {
      const fullPath = path.join(this.projectRoot, workflow.path);

      try {
        const content = await fs.readFile(fullPath, 'utf8');

        // 基本YAML结构验证
        if (
          content.includes('name:') &&
          content.includes('on:') &&
          content.includes('jobs:')
        ) {
          // 检查是否包含统一门禁相关的脚本调用
          const hasCorrectScripts = this.validateWorkflowScripts(
            content,
            workflow.path
          );

          if (hasCorrectScripts) {
            this.addCheck(
              '工作流',
              workflow.description,
              'pass',
              'YAML结构正确且包含必需脚本'
            );
          } else {
            this.addCheck(
              '工作流',
              workflow.description,
              'warn',
              'YAML结构正确但脚本调用可能需要检查'
            );
          }
        } else {
          this.addCheck(
            '工作流',
            workflow.description,
            'fail',
            'YAML结构不完整'
          );
        }
      } catch (error) {
        this.addCheck(
          '工作流',
          workflow.description,
          'fail',
          '工作流文件不存在或无法读取',
          workflow.path
        );
      }
    }
  }

  /**
   * 验证工作流中的脚本调用
   */
  validateWorkflowScripts(content, workflowPath) {
    const scriptMappings = {
      'security-unified.yml': [
        'guard:security',
        'scripts/security-gate-wrapper.js',
      ],
      'observability-gate.yml': [
        'guard:observability',
        'scripts/observability-config-validation.js',
      ],
      'soft-gates.yml': ['guard:soft', 'scripts/soft-gate-reporter.js'],
    };

    const workflowName = path.basename(workflowPath);
    const expectedScripts = scriptMappings[workflowName];

    if (!expectedScripts) return true;

    return expectedScripts.some(script => content.includes(script));
  }

  /**
   * 验证package.json脚本配置
   */
  async validatePackageScripts() {
    console.log('\n🔍 验证package.json脚本配置...');

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      const requiredScripts = [
        'guard:observability',
        'guard:security',
        'guard:soft',
        'monitor:ci',
      ];

      const missingScripts = requiredScripts.filter(
        script => !packageJson.scripts[script]
      );

      if (missingScripts.length === 0) {
        this.addCheck(
          '配置',
          'package.json脚本',
          'pass',
          '所有必需的npm脚本都已配置'
        );
      } else {
        this.addCheck(
          '配置',
          'package.json脚本',
          'fail',
          '缺少必需的npm脚本',
          `缺少: ${missingScripts.join(', ')}`
        );
      }
    } catch (error) {
      this.addCheck(
        '配置',
        'package.json脚本',
        'fail',
        '无法读取或解析package.json',
        error.message
      );
    }
  }

  /**
   * 验证配置文件存在
   */
  async validateConfigFiles() {
    console.log('\n🔍 验证配置文件...');

    const requiredConfigs = [
      {
        path: 'config/development.json',
        description: '开发环境配置',
        required: false,
      },
      {
        path: 'config/staging.json',
        description: '预发环境配置',
        required: false,
      },
      {
        path: 'config/production.json',
        description: '生产环境配置',
        required: false,
      },
      {
        path: '.github/workflows',
        description: 'GitHub Actions工作流目录',
        required: true,
      },
      {
        path: 'logs',
        description: '日志目录',
        required: false,
      },
    ];

    for (const config of requiredConfigs) {
      const fullPath = path.join(this.projectRoot, config.path);

      try {
        const stats = await fs.stat(fullPath);
        this.addCheck('配置', config.description, 'pass', '配置文件/目录存在');
      } catch (error) {
        const status = config.required ? 'fail' : 'warn';
        const message = config.required ? '必需配置缺失' : '可选配置缺失';
        this.addCheck('配置', config.description, status, message, config.path);
      }
    }
  }

  /**
   * 执行功能性测试
   */
  async validateFunctionality() {
    console.log('\n🔍 执行功能性验证...');

    const functionalTests = [
      {
        name: '可观测性门禁测试',
        command: 'npm run guard:observability',
        timeout: 30000,
      },
      {
        name: '安全门禁测试',
        command: 'npm run guard:security',
        timeout: 60000,
      },
      {
        name: '软门禁测试',
        command: 'npm run guard:soft',
        timeout: 30000,
      },
    ];

    for (const test of functionalTests) {
      try {
        console.log(`   执行: ${test.command}`);
        const result = execSync(test.command, {
          timeout: test.timeout,
          stdio: 'pipe',
          encoding: 'utf8',
        });

        this.addCheck('功能测试', test.name, 'pass', '执行成功');
      } catch (error) {
        // 软门禁失败不应影响整体验证（它们设计为中性状态）
        if (test.name.includes('软门禁')) {
          this.addCheck(
            '功能测试',
            test.name,
            'warn',
            '软门禁执行异常（正常情况）',
            '软门禁设计为不阻塞流程'
          );
        } else {
          this.addCheck(
            '功能测试',
            test.name,
            'fail',
            '执行失败',
            error.message.slice(0, 200)
          );
        }
      }
    }
  }

  /**
   * 验证文档完整性
   */
  async validateDocumentation() {
    console.log('\n🔍 验证文档完整性...');

    const requiredDocs = [
      {
        path: 'GITHUB_BRANCH_PROTECTION_OPTIMIZED.md',
        description: '优化后的分支保护配置文档',
      },
      {
        path: 'GITHUB_BRANCH_PROTECTION_MIGRATION.md',
        description: '分支保护迁移指南',
      },
      {
        path: 'GITHUB_BRANCH_PROTECTION_DEPLOYMENT_GUIDE.md',
        description: '生产部署指南',
      },
    ];

    for (const doc of requiredDocs) {
      const fullPath = path.join(this.projectRoot, doc.path);

      try {
        const content = await fs.readFile(fullPath, 'utf8');

        // 检查文档基本结构
        const hasTitle = content.includes('#');
        const hasContent = content.length > 500;

        if (hasTitle && hasContent) {
          this.addCheck('文档', doc.description, 'pass', '文档存在且内容完整');
        } else {
          this.addCheck(
            '文档',
            doc.description,
            'warn',
            '文档存在但内容可能不完整'
          );
        }
      } catch (error) {
        this.addCheck('文档', doc.description, 'fail', '文档不存在', doc.path);
      }
    }
  }

  /**
   * 生成部署就绪性报告
   */
  async generateReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.checks.length,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        readyForDeployment: this.results.failed === 0,
      },
      checks: this.results.checks,
      recommendations: this.generateRecommendations(),
    };

    // 保存详细报告
    const reportPath = path.join(
      this.projectRoot,
      'logs',
      'deployment-readiness-report.json'
    );

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📋 详细报告已保存到: ${reportPath}`);
    } catch (error) {
      console.log(`\n⚠️  无法保存详细报告: ${error.message}`);
    }

    return reportData;
  }

  /**
   * 生成改进建议
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.results.failed > 0) {
      recommendations.push('❌ 存在失败项目，建议修复所有失败检查后再部署');
    }

    if (this.results.warnings > 0) {
      recommendations.push('⚠️  存在警告项目，建议在部署前处理警告问题');
    }

    if (this.results.failed === 0) {
      recommendations.push('✅ 所有关键检查都通过，系统已准备好部署到生产环境');
      recommendations.push('📋 建议按照部署指南执行分阶段部署');
      recommendations.push('📊 建议在部署后监控CI性能指标');
    }

    return recommendations;
  }

  /**
   * 显示最终摘要
   */
  displaySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 部署就绪性验证结果');
    console.log('='.repeat(60));

    console.log(`\n📊 检查统计:`);
    console.log(`   总检查项: ${report.summary.total}`);
    console.log(`   ✅ 通过: ${report.summary.passed}`);
    console.log(`   ❌ 失败: ${report.summary.failed}`);
    console.log(`   ⚠️  警告: ${report.summary.warnings}`);

    console.log(
      `\n🚀 部署状态: ${report.summary.readyForDeployment ? '✅ 准备就绪' : '❌ 需要修复'}`
    );

    if (report.recommendations.length > 0) {
      console.log(`\n💡 建议:`);
      report.recommendations.forEach(rec => console.log(`   ${rec}`));
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * 主要验证流程
   */
  async validate() {
    console.log('🚀 开始部署就绪性验证...');
    console.log(`📂 项目路径: ${this.projectRoot}\n`);

    try {
      // 执行所有验证检查
      await this.validateInfrastructureScripts();
      await this.validateWorkflows();
      await this.validatePackageScripts();
      await this.validateConfigFiles();
      await this.validateFunctionality();
      await this.validateDocumentation();

      // 生成和显示报告
      const report = await this.generateReport();
      this.displaySummary(report);

      // 设置退出码
      if (report.summary.failed > 0) {
        process.exit(1);
      } else {
        console.log('\n🎉 验证完成，系统已准备好部署！');
        process.exit(0);
      }
    } catch (error) {
      console.error('\n❌ 验证过程发生错误:', error.message);
      process.exit(1);
    }
  }
}

// 如果直接运行此脚本
if (process.argv[1] === __filename) {
  const validator = new DeploymentValidator();
  validator.validate();
}

export default DeploymentValidator;
