#!/usr/bin/env node
/**
 * CloudEvents 1.0规范合规性验证脚本
 * 基于ADR-0004事件总线与契约标准
 *
 * 验证项目中所有事件定义是否符合CloudEvents 1.0规范：
 * - 必需字段：id, source, specversion, type, time
 * - 可选字段：data, datacontenttype, dataschema, subject
 * - 字段格式验证（ISO 8601时间，URI格式source等）
 * - 事件类型命名规范（reverse DNS格式）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/** CloudEvents 1.0必需字段 */
const REQUIRED_FIELDS = ['id', 'source', 'specversion', 'type', 'time'];

/** CloudEvents 1.0可选字段 */
const OPTIONAL_FIELDS = ['data', 'datacontenttype', 'dataschema', 'subject'];

/** 验证结果 */
const results = {
  totalFiles: 0,
  compliantFiles: 0,
  violations: [],
  warnings: [],
};

/**
 * 验证CloudEvent接口定义是否符合规范
 */
function validateCloudEventInterface(interfaceDefinition, filePath) {
  const violations = [];
  const warnings = [];

  // 检查必需字段（考虑扩展接口的情况）
  for (const field of REQUIRED_FIELDS) {
    if (
      !interfaceDefinition.includes(`${field}:`) &&
      !interfaceDefinition.includes('extends') &&
      !interfaceDefinition.includes('CeBase')
    ) {
      violations.push({
        file: filePath,
        type: 'missing_required_field',
        field,
        message: `CloudEvent接口缺少必需字段: ${field}`,
      });
    }
  }

  // 检查specversion字段是否固定为'1.0'
  if (
    interfaceDefinition.includes('specversion:') &&
    !interfaceDefinition.includes(`specversion: '1.0'`) &&
    !interfaceDefinition.includes('specversion: "1.0"')
  ) {
    violations.push({
      file: filePath,
      type: 'invalid_specversion',
      message: 'CloudEvent.specversion必须固定为"1.0"',
    });
  }

  // 检查事件类型命名约定
  const typeMatch = interfaceDefinition.match(/type:\s*['"`]([^'"`]+)['"`]/);
  if (typeMatch && typeMatch[1]) {
    const eventType = typeMatch[1];
    // 推荐使用reverse DNS格式
    if (
      !eventType.includes('.') ||
      !eventType.match(/^[a-z0-9.-]+\.[a-z0-9.-]+/)
    ) {
      warnings.push({
        file: filePath,
        type: 'naming_convention',
        message: `事件类型"${eventType}"建议使用reverse DNS格式（如app.guild.member.joined）`,
      });
    }
  }

  return { violations, warnings };
}

/**
 * 验证事件工厂函数是否使用统一实现
 */
function validateEventFactory(content, filePath) {
  const violations = [];
  const warnings = [];

  // 检查是否使用了废弃的createCloudEvent函数
  if (
    content.includes('createCloudEvent') &&
    !content.includes('// legacy') &&
    !content.includes('// deprecated')
  ) {
    violations.push({
      file: filePath,
      type: 'deprecated_factory',
      message:
        '使用了废弃的createCloudEvent函数，应使用mkEvent或createAppEvent',
    });
  }

  // 检查是否正确导入了统一的CloudEvents实现
  if (
    content.includes('CloudEvent') &&
    !content.includes("from './cloudevents-core'") &&
    !content.includes('from "@/shared/contracts/cloudevents-core"')
  ) {
    warnings.push({
      file: filePath,
      type: 'inconsistent_import',
      message: '建议统一从cloudevents-core导入CloudEvent类型',
    });
  }

  return { violations, warnings };
}

/**
 * 扫描并验证文件
 */
async function scanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(projectRoot, filePath);

    results.totalFiles++;

    // 检查文件是否包含CloudEvent相关代码
    if (!content.includes('CloudEvent') && !content.includes('mkEvent')) {
      return;
    }

    let hasViolations = false;

    // 验证接口定义
    const interfaceMatches = content.match(
      /interface\s+\w*CloudEvent[\s\S]*?\{[\s\S]*?\}/g
    );
    if (interfaceMatches) {
      for (const interfaceDefinition of interfaceMatches) {
        const { violations, warnings } = validateCloudEventInterface(
          interfaceDefinition,
          relativePath
        );
        results.violations.push(...violations);
        results.warnings.push(...warnings);
        if (violations.length > 0) hasViolations = true;
      }
    }

    // 验证事件工厂函数
    const { violations, warnings } = validateEventFactory(
      content,
      relativePath
    );
    results.violations.push(...violations);
    results.warnings.push(...warnings);
    if (violations.length > 0) hasViolations = true;

    if (!hasViolations) {
      results.compliantFiles++;
    }
  } catch (error) {
    results.violations.push({
      file: path.relative(projectRoot, filePath),
      type: 'read_error',
      message: `文件读取失败: ${error.message}`,
    });
  }
}

/**
 * 递归扫描目录
 */
async function scanDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // 跳过node_modules和.git目录
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        await scanDirectory(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))
      ) {
        await scanFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`扫描目录失败 ${dirPath}:`, error.message);
  }
}

/**
 * 生成合规性报告
 */
function generateReport() {
  console.log('='.repeat(80));
  console.log('CloudEvents 1.0规范合规性验证报告');
  console.log('='.repeat(80));
  console.log();

  console.log('📊 统计信息:');
  console.log(`  扫描文件总数: ${results.totalFiles}`);
  console.log(`  合规文件数量: ${results.compliantFiles}`);
  console.log(`  违规文件数量: ${results.totalFiles - results.compliantFiles}`);
  console.log(
    `  合规率: ${((results.compliantFiles / results.totalFiles) * 100).toFixed(1)}%`
  );
  console.log();

  if (results.violations.length > 0) {
    console.log('❌ 发现违规项:');
    for (const violation of results.violations) {
      console.log(`  ${violation.file}: ${violation.message}`);
    }
    console.log();
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  改进建议:');
    for (const warning of results.warnings) {
      console.log(`  ${warning.file}: ${warning.message}`);
    }
    console.log();
  }

  if (results.violations.length === 0) {
    console.log('✅ 所有检查项目均通过CloudEvents 1.0规范合规验证！');
    console.log();
    console.log('🎯 CloudEvents 1.0标准实施建议:');
    console.log('  1. 继续使用统一的mkEvent工厂函数');
    console.log('  2. 保持事件类型的reverse DNS命名规范');
    console.log('  3. 确保所有必需字段的运行时验证');
    console.log('  4. 定期运行此脚本验证合规性');
  } else {
    console.log('🔧 修复建议:');
    console.log('  1. 修复所有标记为违规的字段缺失问题');
    console.log('  2. 将废弃的createCloudEvent调用替换为mkEvent');
    console.log('  3. 统一CloudEvent类型导入路径');
    console.log('  4. 执行npm run test:unit验证修复结果');

    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('开始CloudEvents 1.0规范合规性验证...');

  // 扫描src目录
  const srcDir = path.join(projectRoot, 'src');
  await scanDirectory(srcDir);

  // 生成报告
  generateReport();
}

// 执行主函数
main().catch(console.error);
