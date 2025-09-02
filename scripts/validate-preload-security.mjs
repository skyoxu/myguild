#!/usr/bin/env node
/**
 * 预加载脚本安全验证工具
 *
 * 验证预加载脚本的安全配置和API暴露符合安全基线要求
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// 预加载脚本安全要求
const PRELOAD_SECURITY_REQUIREMENTS = {
  // 必须存在的安全检查
  requiredSecurityChecks: [
    'process.contextIsolated',
    'process.sandboxed',
    'contextBridge.exposeInMainWorld',
  ],

  // 禁止的不安全模式
  forbiddenPatterns: [
    'window.electronAPI', // 直接挂载到window对象
    'window.__', // 直接挂载全局变量
    'nodeIntegration: true',
    'contextIsolation: false',
  ],

  // 必须的错误处理
  requiredErrorHandling: [
    'throw new Error',
    'Context isolation must be enabled',
    'Context isolation is required',
  ],

  // 安全API暴露约束
  allowedAPIExposure: [
    'electronAPI',
    '__APP_VERSION__',
    '__CUSTOM_API__',
    '__SECURITY_VALIDATION__', // 仅测试模式
  ],
};

class PreloadSecurityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.violations = [];
  }

  log(message, level = 'info') {
    const prefix =
      {
        info: '✅',
        warn: '⚠️',
        error: '❌',
        security: '🔒',
      }[level] || 'ℹ️';

    console.log(`${prefix} ${message}`);
  }

  // 检查预加载文件存在性
  checkPreloadFileExists() {
    const preloadPath = join(ROOT_DIR, 'electron', 'preload.ts');

    if (!existsSync(preloadPath)) {
      this.errors.push('预加载脚本文件不存在: electron/preload.ts');
      return false;
    }

    this.log('预加载脚本文件存在性检查通过');
    return true;
  }

  // 验证安全检查存在性
  validateSecurityChecks(content) {
    this.log('验证安全检查...', 'security');

    let checksPass = true;

    // 检查必须的安全验证
    const missingChecks =
      PRELOAD_SECURITY_REQUIREMENTS.requiredSecurityChecks.filter(
        check => !content.includes(check)
      );

    if (missingChecks.length > 0) {
      this.errors.push(`缺少必需的安全检查: ${missingChecks.join(', ')}`);
      checksPass = false;
    }

    // 检查错误处理
    const missingErrorHandling =
      PRELOAD_SECURITY_REQUIREMENTS.requiredErrorHandling.filter(
        handler => !content.includes(handler)
      );

    if (missingErrorHandling.length > 0) {
      this.warnings.push(
        `建议加强错误处理: ${missingErrorHandling.join(', ')}`
      );
    }

    return checksPass;
  }

  // 检查禁止的不安全模式
  checkForbiddenPatterns(content) {
    this.log('检查禁止的不安全模式...', 'security');

    let isSafe = true;

    const foundViolations =
      PRELOAD_SECURITY_REQUIREMENTS.forbiddenPatterns.filter(pattern =>
        content.includes(pattern)
      );

    if (foundViolations.length > 0) {
      this.violations.push(...foundViolations);
      this.errors.push(`发现禁止的不安全模式: ${foundViolations.join(', ')}`);
      isSafe = false;
    }

    return isSafe;
  }

  // 验证API暴露安全性
  validateAPIExposure(content) {
    this.log('验证API暴露安全性...', 'security');

    // 提取所有exposeInMainWorld调用
    const exposeMatches = content.match(
      /exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/g
    );

    if (!exposeMatches) {
      this.warnings.push('未找到API暴露调用');
      return false;
    }

    const exposedAPIs = exposeMatches
      .map(match => {
        const nameMatch = match.match(
          /exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/
        );
        return nameMatch ? nameMatch[1] : null;
      })
      .filter(Boolean);

    this.log(`发现API暴露: ${exposedAPIs.join(', ')}`);

    // 检查是否只暴露了允许的API
    const unauthorizedAPIs = exposedAPIs.filter(
      api => !PRELOAD_SECURITY_REQUIREMENTS.allowedAPIExposure.includes(api)
    );

    if (unauthorizedAPIs.length > 0) {
      this.errors.push(`发现未授权的API暴露: ${unauthorizedAPIs.join(', ')}`);
      return false;
    }

    // 验证contextBridge使用
    if (!content.includes('contextBridge.exposeInMainWorld')) {
      this.errors.push('必须使用contextBridge.exposeInMainWorld进行API暴露');
      return false;
    }

    return true;
  }

  // 检查测试模式安全性
  validateTestModeSecurity(content) {
    this.log('验证测试模式安全性...', 'security');

    // 检查测试模式API是否正确保护
    if (content.includes('SECURITY_TEST_MODE')) {
      if (!content.includes("process.env.SECURITY_TEST_MODE === 'true'")) {
        this.warnings.push('测试模式API缺少环境变量保护');
      } else {
        this.log('测试模式API保护检查通过');
      }
    }

    // 检查信息泄露风险
    if (
      content.includes('new Date().toISOString()') &&
      content.includes('__CUSTOM_API__')
    ) {
      // 检查是否在生产模式下限制了时间戳暴露
      if (!content.includes('SECURITY_TEST_MODE')) {
        this.warnings.push('生产环境中暴露时间戳可能构成信息泄露风险');
      }
    }

    return true;
  }

  // 验证类型定义文件
  checkTypeDefinitions() {
    const dtsPath = join(ROOT_DIR, 'electron', 'preload.d.ts');

    if (!existsSync(dtsPath)) {
      this.warnings.push('未找到预加载脚本类型定义文件');
      return false;
    }

    const dtsContent = readFileSync(dtsPath, 'utf8');

    // 检查是否定义了暴露的API
    if (!dtsContent.includes('electronAPI')) {
      this.warnings.push('类型定义文件缺少electronAPI声明');
      return false;
    }

    this.log('类型定义文件检查通过');
    return true;
  }

  // 主验证函数
  async validate() {
    this.log('开始预加载脚本安全验证...', 'security');

    // 1. 检查文件存在性
    if (!this.checkPreloadFileExists()) {
      return 1;
    }

    // 2. 读取文件内容
    const preloadPath = join(ROOT_DIR, 'electron', 'preload.ts');
    const content = readFileSync(preloadPath, 'utf8');

    // 3. 执行各项安全检查
    const securityChecksPass = this.validateSecurityChecks(content);
    const noForbiddenPatterns = this.checkForbiddenPatterns(content);
    const apiExposureSecure = this.validateAPIExposure(content);
    const testModeSecure = this.validateTestModeSecurity(content);

    // 4. 检查类型定义（非必需但推荐）
    this.checkTypeDefinitions();

    // 汇总结果
    const allChecksPass =
      securityChecksPass &&
      noForbiddenPatterns &&
      apiExposureSecure &&
      testModeSecure;

    this.log(
      `\n验证完成: ${allChecksPass ? '通过' : '失败'}`,
      allChecksPass ? 'info' : 'error'
    );
    this.log(
      `错误: ${this.errors.length}, 警告: ${this.warnings.length}, 违规: ${this.violations.length}`
    );

    if (this.errors.length > 0) {
      this.log('\n错误详情:', 'error');
      this.errors.forEach(error => this.log(`  ${error}`, 'error'));
    }

    if (this.violations.length > 0) {
      this.log('\n安全违规详情:', 'error');
      this.violations.forEach(violation => this.log(`  ${violation}`, 'error'));
    }

    if (this.warnings.length > 0) {
      this.log('\n警告详情:', 'warn');
      this.warnings.forEach(warning => this.log(`  ${warning}`, 'warn'));
    }

    // 提供修复建议
    if (!allChecksPass) {
      this.log('\n修复建议:', 'info');
      this.log('  1. 确保启用 contextIsolation 和 sandbox');
      this.log('  2. 使用 contextBridge.exposeInMainWorld 进行API暴露');
      this.log('  3. 避免直接挂载到 window 对象');
      this.log('  4. 添加必要的安全验证和错误处理');
      this.log('  5. 限制测试模式下的信息暴露');
    }

    return allChecksPass ? 0 : 1;
  }
}

// 执行验证
async function main() {
  const validator = new PreloadSecurityValidator();
  const exitCode = await validator.validate();
  process.exit(exitCode);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('预加载脚本安全验证失败:', error);
    process.exit(1);
  });
}

export { PreloadSecurityValidator };
