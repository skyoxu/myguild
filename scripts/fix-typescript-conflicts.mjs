#!/usr/bin/env node
/**
 * TypeScript编译错误自动修复脚本
 *
 * 主要处理：
 * 1. 重复导出和类型冲突
 * 2. 错误的import type使用
 * 3. 不符合erasableSyntaxOnly的语法
 * 4. 未使用的变量和参数
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTRACTS_DIR = join(__dirname, '..', 'src', 'shared', 'contracts');
const VALIDATION_DIR = join(__dirname, '..', 'src', 'shared', 'validation');

/**
 * 修复重复导出冲突
 */
function fixDuplicateExports(content, filename) {
  const lines = content.split('\n');
  const fixes = [];

  // 查找重复的export type块
  let inExportBlock = false;
  let exportBlockStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检测export type块开始
    if (line.startsWith('export type {') || line.startsWith('export {')) {
      if (inExportBlock) {
        // 发现重复的导出块，标记删除
        fixes.push({
          type: 'REMOVE_DUPLICATE_EXPORT_BLOCK',
          start: exportBlockStart,
          end: findBlockEnd(lines, exportBlockStart),
          line: exportBlockStart + 1,
        });
      } else {
        inExportBlock = true;
        exportBlockStart = i;
      }
    }

    // 检测export块结束
    if (line.includes('};') && inExportBlock) {
      inExportBlock = false;
      exportBlockStart = -1;
    }
  }

  return { fixes, modified: fixes.length > 0 };
}

/**
 * 修复erasableSyntaxOnly语法错误
 */
function fixErasableSyntaxOnly(content) {
  const fixes = [];

  // 修复enum导出语法
  content = content.replace(
    /^export const enum\s+(\w+)/gm,
    (match, enumName) => {
      fixes.push({
        type: 'FIX_CONST_ENUM',
        original: match,
        fixed: `export enum ${enumName}`,
      });
      return `export enum ${enumName}`;
    }
  );

  // 修复declare导出
  content = content.replace(
    /^export declare\s+(const|let|var)\s+/gm,
    (match, keyword) => {
      fixes.push({
        type: 'FIX_DECLARE_EXPORT',
        original: match,
        fixed: `export ${keyword} `,
      });
      return `export ${keyword} `;
    }
  );

  return { content, fixes };
}

/**
 * 修复import type错误使用
 */
function fixImportTypeUsage(content) {
  const fixes = [];

  // 查找createCloudEvent等函数被错误标记为type import
  const functionsAsTypeImport = [
    'createCloudEvent',
    'assertCe',
    'validateBatch',
  ];

  for (const func of functionsAsTypeImport) {
    const typeImportRegex = new RegExp(
      `import type \\{([^}]*${func}[^}]*)\\}`,
      'g'
    );
    const match = typeImportRegex.exec(content);

    if (match) {
      const imports = match[1].split(',').map(s => s.trim());
      const typeImports = imports.filter(imp => imp !== func);
      const valueImports = imports.filter(imp => imp === func);

      let replacement = '';
      if (typeImports.length > 0) {
        replacement += `import type { ${typeImports.join(', ')} }`;
      }
      if (valueImports.length > 0) {
        if (replacement) replacement += ';\n';
        replacement += `import { ${valueImports.join(', ')} }`;
      }

      content = content.replace(match[0], replacement);
      fixes.push({
        type: 'FIX_MIXED_IMPORT',
        function: func,
        original: match[0],
        fixed: replacement,
      });
    }
  }

  return { content, fixes };
}

/**
 * 修复类型名称冲突
 */
function fixTypeNameConflicts(content, filename) {
  const fixes = [];

  // CloudEventV1 -> CloudEvent
  if (content.includes('CloudEventV1')) {
    content = content.replace(/CloudEventV1/g, 'CloudEvent');
    fixes.push({
      type: 'RENAME_TYPE',
      from: 'CloudEventV1',
      to: 'CloudEvent',
    });
  }

  // 修复重复的TypedEvent定义
  if (filename.includes('events.ts')) {
    const duplicateTypeRegex = /export type TypedEvent = [^;]+;/g;
    const matches = [...content.matchAll(duplicateTypeRegex)];

    if (matches.length > 1) {
      // 保留第一个，删除其余的
      for (let i = 1; i < matches.length; i++) {
        content = content.replace(matches[i][0], '');
        fixes.push({
          type: 'REMOVE_DUPLICATE_TYPE',
          typeName: 'TypedEvent',
          instance: i,
        });
      }
    }
  }

  return { content, fixes };
}

/**
 * 修复未使用的参数
 */
function fixUnusedParameters(content) {
  const fixes = [];

  // 为未使用的参数添加下划线前缀
  content = content.replace(
    /function\s+(\w+)\s*\(([^)]+)\)\s*:/g,
    (match, funcName, params) => {
      const paramList = params.split(',').map(param => {
        const trimmed = param.trim();
        if (trimmed.includes(':') && !trimmed.startsWith('_')) {
          const [name, type] = trimmed.split(':');
          return `_${name.trim()}: ${type.trim()}`;
        }
        return trimmed;
      });

      const fixed = `function ${funcName}(${paramList.join(', ')}):`;
      if (fixed !== match) {
        fixes.push({
          type: 'FIX_UNUSED_PARAM',
          function: funcName,
          original: match,
          fixed: fixed,
        });
      }
      return fixed;
    }
  );

  return { content, fixes };
}

/**
 * 修复Entity约束错误
 */
function fixEntityConstraints(content) {
  const fixes = [];

  // 为缺少Entity字段的类型添加必要字段
  const entityMissingFields = [
    'Guild',
    'GuildMember',
    'GameTurn',
    'RaidDungeon',
  ];

  entityMissingFields.forEach(typeName => {
    const typeRegex = new RegExp(
      `export interface ${typeName}\\s*{([^}]+)}`,
      's'
    );
    const match = typeRegex.exec(content);

    if (
      match &&
      !match[1].includes('createdAt') &&
      !match[1].includes('updatedAt')
    ) {
      const fields = match[1];
      const newFields =
        fields.trim() +
        `\n  readonly createdAt: Date;\n  readonly updatedAt: Date;\n`;

      content = content.replace(
        match[0],
        `export interface ${typeName} {\n${newFields}}`
      );
      fixes.push({
        type: 'ADD_ENTITY_FIELDS',
        typeName: typeName,
        addedFields: ['createdAt', 'updatedAt'],
      });
    }
  });

  return { content, fixes };
}

/**
 * 查找块结束位置
 */
function findBlockEnd(lines, startIndex) {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        }
      } else {
        if (char === stringChar && line[j - 1] !== '\\') {
          inString = false;
        }
      }
    }

    if (braceCount === 0 && line.includes('};')) {
      return i;
    }
  }

  return lines.length - 1;
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    let modifiedContent = content;
    const allFixes = [];

    const filename = filePath.split(/[\\/]/).pop();

    console.log(`🔧 处理文件: ${filename}`);

    // 应用各种修复
    const duplicateExports = fixDuplicateExports(modifiedContent, filename);
    const erasableSyntax = fixErasableSyntaxOnly(modifiedContent);
    const importTypes = fixImportTypeUsage(erasableSyntax.content);
    const typeConflicts = fixTypeNameConflicts(importTypes.content, filename);
    const unusedParams = fixUnusedParameters(typeConflicts.content);
    const entityConstraints = fixEntityConstraints(unusedParams.content);

    modifiedContent = entityConstraints.content;

    // 收集所有修复信息
    allFixes.push(...duplicateExports.fixes);
    allFixes.push(...erasableSyntax.fixes);
    allFixes.push(...importTypes.fixes);
    allFixes.push(...typeConflicts.fixes);
    allFixes.push(...unusedParams.fixes);
    allFixes.push(...entityConstraints.fixes);

    // 写回文件（如果有修改）
    if (modifiedContent !== content) {
      await writeFile(filePath, modifiedContent, 'utf-8');
      console.log(`✅ 修复了 ${allFixes.length} 个问题`);

      // 显示修复详情
      allFixes.forEach((fix, index) => {
        console.log(
          `   ${index + 1}. [${fix.type}] ${JSON.stringify(fix).substring(0, 100)}...`
        );
      });
    } else {
      console.log(`✨ 无需修复`);
    }

    return {
      file: filename,
      fixes: allFixes,
      modified: modifiedContent !== content,
    };
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}: ${error.message}`);
    return {
      file: filePath.split(/[\\/]/).pop(),
      error: error.message,
      fixes: [],
      modified: false,
    };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始修复TypeScript编译错误...\n');

  try {
    // 获取所有TypeScript文件
    const contractsFiles = await readdir(CONTRACTS_DIR);
    const validationFiles = await readdir(VALIDATION_DIR);

    const tsFiles = [
      ...contractsFiles
        .filter(f => f.endsWith('.ts'))
        .map(f => join(CONTRACTS_DIR, f)),
      ...validationFiles
        .filter(f => f.endsWith('.ts'))
        .map(f => join(VALIDATION_DIR, f)),
    ];

    console.log(`📁 发现 ${tsFiles.length} 个TypeScript文件\n`);

    const results = [];

    // 处理所有文件
    for (const file of tsFiles) {
      const result = await processFile(file);
      results.push(result);
      console.log(''); // 空行分隔
    }

    // 生成报告
    const totalFixes = results.reduce((sum, r) => sum + r.fixes.length, 0);
    const modifiedFiles = results.filter(r => r.modified).length;
    const errorFiles = results.filter(r => r.error).length;

    console.log('📊 修复报告');
    console.log('='.repeat(50));
    console.log(`处理文件: ${tsFiles.length}`);
    console.log(`修改文件: ${modifiedFiles}`);
    console.log(`修复问题: ${totalFixes}`);
    console.log(`错误文件: ${errorFiles}`);

    if (errorFiles > 0) {
      console.log('\n❌ 错误文件:');
      results
        .filter(r => r.error)
        .forEach(r => console.log(`   ${r.file}: ${r.error}`));
    }

    // 按修复类型分类
    const fixesByType = {};
    results.forEach(r => {
      r.fixes.forEach(fix => {
        if (!fixesByType[fix.type]) fixesByType[fix.type] = 0;
        fixesByType[fix.type]++;
      });
    });

    console.log('\n🔧 修复类型统计:');
    Object.entries(fixesByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n✅ TypeScript错误修复完成!');

    if (totalFixes > 0) {
      console.log('\n💡 建议运行以下命令验证修复效果:');
      console.log('   npm run typecheck');
      console.log('   npm run lint');
    }
  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 只有直接运行此脚本时才执行主函数
if (
  process.argv[1] &&
  process.argv[1].endsWith('fix-typescript-conflicts.mjs')
) {
  main().catch(console.error);
}
