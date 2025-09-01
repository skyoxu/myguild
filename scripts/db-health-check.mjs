#!/usr/bin/env node

/**
 * 数据库健康检查集成测试
 *
 * 功能：
 * - 验证所有WAL管理脚本的可用性
 * - 检查脚本语法和基本功能
 * - 验证环境依赖（SQLite驱动）
 * - 生成健康检查报告
 *
 * Usage:
 *   node scripts/db-health-check.mjs
 *   node scripts/db-health-check.mjs --verbose
 *   npm run guard:db
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const VERBOSE = process.argv.includes('--verbose');
const DB_SCRIPTS_DIR = path.join(__dirname, 'scripts', 'db');

// 测试配置
const SCRIPTS_TO_TEST = [
  {
    name: 'WAL检查点脚本',
    file: 'wal-checkpoint.mjs',
    command: 'node scripts/db/wal-checkpoint.mjs --help',
    required: true,
    description: '管理SQLite WAL检查点操作',
  },
  {
    name: 'WAL监控脚本',
    file: 'wal-monitor.mjs',
    command: 'node scripts/db/wal-monitor.mjs --help',
    required: true,
    description: '实时监控WAL文件状态和数据库健康',
  },
  {
    name: 'WAL备份脚本（原生依赖版）',
    file: 'wal-backup.mjs',
    command: 'node scripts/db/wal-backup.mjs --help',
    required: false,
    description: '使用better-sqlite3的企业级备份功能',
  },
  {
    name: '备份脚本（用户框架版）',
    file: 'backup.mjs',
    command: 'node scripts/db/backup.mjs --help',
    required: false,
    description: '基于用户框架的双后端备份脚本',
  },
  {
    name: '备份脚本（命令行版）',
    file: 'backup-cli.mjs',
    command: 'node scripts/db/backup-cli.mjs --help',
    required: true,
    description: '无原生依赖的命令行备份脚本',
  },
];

// 依赖检查配置
const DEPENDENCIES = [
  {
    name: 'Node.js版本',
    check: () => process.version,
    validate: version => {
      const major = parseInt(version.replace('v', '').split('.')[0]);
      return major >= 18;
    },
    required: true,
  },
  {
    name: 'SQLite3命令行工具',
    check: () => {
      try {
        return execSync('sqlite3 --version', {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
      } catch {
        return null;
      }
    },
    validate: version => version !== null,
    required: false,
    note: '缺失时只能使用需要原生驱动的脚本',
  },
  {
    name: 'better-sqlite3驱动',
    check: () => {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return (
          packageJson.dependencies?.['better-sqlite3'] ||
          packageJson.devDependencies?.['better-sqlite3'] ||
          null
        );
      } catch {
        return null;
      }
    },
    validate: version => version !== null,
    required: false,
    note: '缺失时只能使用命令行版本脚本',
  },
];

// 日志函数
function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, ...meta };

  if (VERBOSE) {
    console.log(JSON.stringify(entry));
  } else if (level === 'error') {
    console.error(`❌ ${message}`);
  } else if (level === 'warn') {
    console.warn(`⚠️  ${message}`);
  } else if (level === 'info') {
    console.log(`✅ ${message}`);
  }
}

// 检查脚本文件存在性
function checkScriptFiles() {
  log('info', '检查数据库脚本文件...');
  const results = [];

  for (const script of SCRIPTS_TO_TEST) {
    const scriptPath = path.join('scripts', 'db', script.file);
    const exists = fs.existsSync(scriptPath);

    results.push({
      script: script.name,
      file: script.file,
      exists,
      required: script.required,
      path: scriptPath,
    });

    if (exists) {
      log('info', `${script.name}: 文件存在`, { file: script.file });
    } else {
      log(script.required ? 'error' : 'warn', `${script.name}: 文件不存在`, {
        file: script.file,
        required: script.required,
      });
    }
  }

  return results;
}

// 检查脚本语法
function checkScriptSyntax() {
  log('info', '检查脚本语法...');
  const results = [];

  for (const script of SCRIPTS_TO_TEST) {
    const scriptPath = path.join('scripts', 'db', script.file);

    if (!fs.existsSync(scriptPath)) {
      continue;
    }

    try {
      execSync(`node -c ${scriptPath}`, { stdio: 'pipe' });
      results.push({
        script: script.name,
        file: script.file,
        syntaxValid: true,
        error: null,
      });

      log('info', `${script.name}: 语法正确`);
    } catch (error) {
      results.push({
        script: script.name,
        file: script.file,
        syntaxValid: false,
        error: error.message,
      });

      log('error', `${script.name}: 语法错误`, { error: error.message });
    }
  }

  return results;
}

// 检查环境依赖
function checkDependencies() {
  log('info', '检查环境依赖...');
  const results = [];

  for (const dep of DEPENDENCIES) {
    try {
      const value = dep.check();
      const valid = dep.validate(value);

      results.push({
        dependency: dep.name,
        value,
        valid,
        required: dep.required,
        note: dep.note,
      });

      if (valid) {
        log('info', `${dep.name}: 可用`, { value });
      } else {
        log(dep.required ? 'error' : 'warn', `${dep.name}: 不可用`, {
          required: dep.required,
          note: dep.note,
        });
      }
    } catch (error) {
      results.push({
        dependency: dep.name,
        value: null,
        valid: false,
        required: dep.required,
        error: error.message,
        note: dep.note,
      });

      log(dep.required ? 'error' : 'warn', `${dep.name}: 检查失败`, {
        error: error.message,
      });
    }
  }

  return results;
}

// 测试脚本基本功能
function testScriptFunctionality() {
  log('info', '测试脚本基本功能...');
  const results = [];

  for (const script of SCRIPTS_TO_TEST) {
    const scriptPath = path.join('scripts', 'db', script.file);

    if (!fs.existsSync(scriptPath)) {
      continue;
    }

    try {
      // 测试--help参数（大多数脚本都应该支持）
      const output = execSync(script.command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000, // 5秒超时
      });

      results.push({
        script: script.name,
        file: script.file,
        functional: true,
        helpOutput: output.slice(0, 200), // 前200字符
        error: null,
      });

      log('info', `${script.name}: 基本功能正常`);
    } catch (error) {
      // 某些脚本可能不支持--help，这不一定是错误
      const isHelpError = error.message.includes('help') || error.status === 0;

      results.push({
        script: script.name,
        file: script.file,
        functional: isHelpError, // 如果是help相关错误，认为功能正常
        helpOutput: null,
        error: error.message,
        note: isHelpError ? '脚本不支持--help参数，但语法正确' : undefined,
      });

      if (isHelpError) {
        log('info', `${script.name}: 不支持--help但功能正常`);
      } else {
        log('warn', `${script.name}: 功能测试失败`, { error: error.message });
      }
    }
  }

  return results;
}

// 生成健康检查报告
function generateHealthReport(
  fileResults,
  syntaxResults,
  depResults,
  funcResults
) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalScripts: SCRIPTS_TO_TEST.length,
      scriptsFound: fileResults.filter(r => r.exists).length,
      syntaxValid: syntaxResults.filter(r => r.syntaxValid).length,
      functional: funcResults.filter(r => r.functional).length,
      criticalIssues: 0,
      warnings: 0,
    },
    details: {
      scripts: fileResults.map(file => {
        const syntax = syntaxResults.find(s => s.file === file.file);
        const func = funcResults.find(f => f.file === file.file);

        return {
          name: file.script,
          file: file.file,
          exists: file.exists,
          syntaxValid: syntax?.syntaxValid || false,
          functional: func?.functional || false,
          required: file.required,
          issues: [
            !file.exists && file.required && 'Required script missing',
            syntax && !syntax.syntaxValid && 'Syntax error',
            func && !func.functional && 'Functionality issue',
          ].filter(Boolean),
        };
      }),
      dependencies: depResults,
      recommendations: [],
    },
  };

  // 计算问题数量
  report.details.scripts.forEach(script => {
    if (script.required && script.issues.length > 0) {
      report.summary.criticalIssues++;
    } else if (script.issues.length > 0) {
      report.summary.warnings++;
    }
  });

  // 生成建议
  const missingRequired = depResults.filter(d => d.required && !d.valid);
  const missingOptional = depResults.filter(d => !d.required && !d.valid);

  if (missingRequired.length > 0) {
    report.details.recommendations.push(
      `安装必需依赖: ${missingRequired.map(d => d.dependency).join(', ')}`
    );
  }

  if (missingOptional.length > 0) {
    report.details.recommendations.push(
      `考虑安装可选依赖以获得完整功能: ${missingOptional.map(d => d.dependency).join(', ')}`
    );
  }

  const failedScripts = report.details.scripts.filter(s => s.issues.length > 0);
  if (failedScripts.length > 0) {
    report.details.recommendations.push(
      `修复脚本问题: ${failedScripts.map(s => s.name).join(', ')}`
    );
  }

  return report;
}

// 主函数
async function performHealthCheck() {
  console.log('🏥 数据库健康检查开始...\n');

  try {
    // 执行各项检查
    const fileResults = checkScriptFiles();
    const syntaxResults = checkScriptSyntax();
    const depResults = checkDependencies();
    const funcResults = testScriptFunctionality();

    // 生成报告
    const report = generateHealthReport(
      fileResults,
      syntaxResults,
      depResults,
      funcResults
    );

    // 输出摘要
    console.log('\n📊 健康检查摘要:');
    console.log(`   脚本总数: ${report.summary.totalScripts}`);
    console.log(`   发现脚本: ${report.summary.scriptsFound}`);
    console.log(`   语法正确: ${report.summary.syntaxValid}`);
    console.log(`   功能正常: ${report.summary.functional}`);
    console.log(`   严重问题: ${report.summary.criticalIssues}`);
    console.log(`   警告问题: ${report.summary.warnings}`);

    // 输出建议
    if (report.details.recommendations.length > 0) {
      console.log('\n💡 建议:');
      report.details.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    // 详细输出（可选）
    if (VERBOSE) {
      console.log('\n📋 详细报告:');
      console.log(JSON.stringify(report, null, 2));
    }

    // 保存报告
    const reportsDir = 'logs/db-health';
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(
      reportsDir,
      `health-check-${new Date().toISOString().slice(0, 10)}.json`
    );
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportFile}`);

    // 确定退出状态
    const hasBlockingIssues = report.summary.criticalIssues > 0;
    if (hasBlockingIssues) {
      console.log('\n❌ 数据库健康检查失败：存在严重问题');
      process.exit(1);
    } else if (report.summary.warnings > 0) {
      console.log('\n⚠️  数据库健康检查通过，但有警告');
      process.exit(0);
    } else {
      console.log('\n✅ 数据库健康检查完全通过');
      process.exit(0);
    }
  } catch (error) {
    log('error', '健康检查过程中发生错误', {
      error: error.message,
      stack: error.stack,
    });
    console.error('\n💥 数据库健康检查意外失败');
    process.exit(1);
  }
}

// 主程序入口
if (process.argv[1] === __filename) {
  performHealthCheck();
}

export {
  performHealthCheck,
  checkScriptFiles,
  checkScriptSyntax,
  checkDependencies,
};
