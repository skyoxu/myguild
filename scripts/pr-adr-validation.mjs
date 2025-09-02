#!/usr/bin/env node
/**
 * PR ADR引用验证脚本
 * 检查PR描述是否包含必需的ADR引用
 *
 * 用法：
 * node scripts/pr-adr-validation.mjs --pr-body="PR描述内容"
 * node scripts/pr-adr-validation.mjs --pr-file=".github/pr-body.txt"
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

// ADR引用正则模式
const ADR_PATTERNS = {
  // 匹配 ADR-0001, ADR-0002 等格式
  reference: /ADR-(\d{4})/gi,
  // 匹配完整的ADR引用行
  fullReference: /^[-\s]*\[[\sx]\]\s*ADR-\d{4}[:\s].*$/gim,
  // 匹配新增ADR声明
  newADR: /本PR新增ADR:\s*ADR-(\d{4})/i,
  // 匹配替代ADR声明
  replaceADR: /以\s*ADR-(\d{4})\s*替代\s*ADR-(\d{4})/i,
};

// 已知的核心ADR列表
const CORE_ADRS = [
  'ADR-0001', // 技术栈选型
  'ADR-0002', // Electron安全基线
  'ADR-0003', // 可观测性和发布健康
  'ADR-0004', // 事件总线和契约
  'ADR-0005', // 质量门禁
  'ADR-0006', // 数据存储
  'ADR-0007', // 端口适配器
  'ADR-0008', // 部署发布
  'ADR-0009', // 跨平台
  'ADR-0010', // 国际化
];

/**
 * 验证ADR文件是否存在
 */
function validateADRExists(adrId) {
  const adrPath = resolve(`docs/adr/${adrId.toLowerCase()}-*.md`);
  const adrDir = 'docs/adr/';

  if (!existsSync(adrDir)) {
    return { exists: false, reason: 'ADR目录不存在' };
  }

  // 检查是否有匹配的ADR文件
  try {
    const files = readdirSync(adrDir);
    const adrFile = files.find(file =>
      file.toLowerCase().startsWith(adrId.toLowerCase())
    );

    if (adrFile) {
      const content = readFileSync(resolve(adrDir, adrFile), 'utf8');
      const isAccepted = /Status:\s*Accepted/i.test(content);

      return {
        exists: true,
        filePath: resolve(adrDir, adrFile),
        status: isAccepted ? 'Accepted' : 'Other',
        isAccepted,
      };
    }
  } catch (error) {
    console.error('检查ADR文件时出错:', error.message);
  }

  return { exists: false, reason: `未找到 ${adrId} 对应的文件` };
}

/**
 * 解析PR描述中的ADR引用
 */
function parseADRReferences(prBody) {
  const results = {
    referencedADRs: new Set(),
    newADRs: [],
    replacedADRs: [],
    fullReferences: [],
    hasValidFormat: false,
  };

  // 提取所有ADR引用
  const matches = [...prBody.matchAll(ADR_PATTERNS.reference)];
  matches.forEach(match => {
    results.referencedADRs.add(match[0].toUpperCase());
  });

  // 提取完整的引用行
  const fullRefs = [...prBody.matchAll(ADR_PATTERNS.fullReference)];
  results.fullReferences = fullRefs.map(match => match[0].trim());

  // 检查格式是否包含必需的复选框和描述
  results.hasValidFormat = results.fullReferences.length > 0;

  // 提取新增ADR声明
  const newADRMatch = prBody.match(ADR_PATTERNS.newADR);
  if (newADRMatch) {
    results.newADRs.push(`ADR-${newADRMatch[1]}`);
  }

  // 提取替代ADR声明
  const replaceMatch = prBody.match(ADR_PATTERNS.replaceADR);
  if (replaceMatch) {
    results.replacedADRs.push({
      new: `ADR-${replaceMatch[1]}`,
      old: `ADR-${replaceMatch[2]}`,
    });
  }

  return results;
}

/**
 * 验证PR ADR引用
 */
async function validatePRADRs(prBody) {
  console.log('🔍 开始验证PR ADR引用...\n');

  const parsed = parseADRReferences(prBody);
  const validation = {
    passed: true,
    errors: [],
    warnings: [],
    info: [],
  };

  // 1. 检查是否至少引用了1个ADR
  if (parsed.referencedADRs.size === 0) {
    validation.passed = false;
    validation.errors.push('❌ PR必须引用至少1条Accepted状态的ADR');
  } else {
    validation.info.push(`✅ 发现 ${parsed.referencedADRs.size} 个ADR引用`);
  }

  // 2. 检查ADR引用格式
  if (!parsed.hasValidFormat) {
    validation.passed = false;
    validation.errors.push('❌ ADR引用格式不正确，请使用PR模板中的复选框格式');
  } else {
    validation.info.push(
      `✅ ADR引用格式正确 (${parsed.fullReferences.length} 条完整引用)`
    );
  }

  // 3. 验证引用的ADR是否存在且为Accepted状态
  const adrValidations = [];
  for (const adrId of parsed.referencedADRs) {
    const adrCheck = validateADRExists(adrId);
    adrValidations.push({ adrId, ...adrCheck });

    if (!adrCheck.exists) {
      validation.passed = false;
      validation.errors.push(`❌ ${adrId}: ${adrCheck.reason}`);
    } else if (!adrCheck.isAccepted) {
      validation.warnings.push(
        `⚠️  ${adrId}: 状态为 ${adrCheck.status}，建议引用Accepted状态的ADR`
      );
    } else {
      validation.info.push(`✅ ${adrId}: Accepted状态，文件存在`);
    }
  }

  // 4. 检查核心ADR覆盖情况
  const missingCoreADRs = CORE_ADRS.filter(
    adr => !parsed.referencedADRs.has(adr)
  );
  if (missingCoreADRs.length > 0) {
    validation.warnings.push(
      `⚠️  未引用核心ADR: ${missingCoreADRs.join(', ')} - 请确认是否相关`
    );
  }

  // 5. 验证新增ADR声明
  for (const newADR of parsed.newADRs) {
    const newADRCheck = validateADRExists(newADR);
    if (newADRCheck.exists) {
      validation.info.push(`✅ 新增ADR ${newADR}: 文件已存在`);
    } else {
      validation.errors.push(`❌ 声明新增ADR ${newADR}，但文件不存在`);
      validation.passed = false;
    }
  }

  // 6. 验证替代ADR声明
  for (const replacement of parsed.replacedADRs) {
    const newCheck = validateADRExists(replacement.new);
    const oldCheck = validateADRExists(replacement.old);

    if (!newCheck.exists) {
      validation.errors.push(`❌ 替代ADR ${replacement.new} 文件不存在`);
      validation.passed = false;
    }

    if (!oldCheck.exists) {
      validation.warnings.push(`⚠️  被替代的ADR ${replacement.old} 文件不存在`);
    }

    if (newCheck.exists && oldCheck.exists) {
      validation.info.push(
        `✅ ADR替代声明: ${replacement.new} → ${replacement.old}`
      );
    }
  }

  return { validation, parsed, adrValidations };
}

/**
 * 输出验证结果
 */
function outputResults(results) {
  const { validation, parsed } = results;

  console.log('\n📊 ADR引用验证结果');
  console.log('═'.repeat(50));

  // 输出信息
  if (validation.info.length > 0) {
    validation.info.forEach(info => console.log(info));
  }

  // 输出警告
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    validation.warnings.forEach(warning => console.log(warning));
  }

  // 输出错误
  if (validation.errors.length > 0) {
    console.log('\n❌ 错误:');
    validation.errors.forEach(error => console.log(error));
  }

  // 输出统计
  console.log('\n📈 统计信息:');
  console.log(`- 引用的ADR数量: ${parsed.referencedADRs.size}`);
  console.log(`- 完整引用格式: ${parsed.fullReferences.length}`);
  console.log(`- 新增ADR: ${parsed.newADRs.length}`);
  console.log(`- 替代ADR: ${parsed.replacedADRs.length}`);

  // 输出最终结果
  console.log('\n' + '═'.repeat(50));
  if (validation.passed) {
    console.log('✅ ADR引用验证通过！');
    return 0;
  } else {
    console.log('❌ ADR引用验证失败！');
    console.log('\n💡 修复建议:');
    console.log('1. 使用 .github/PULL_REQUEST_TEMPLATE.md 中的格式');
    console.log('2. 确保至少引用1条Accepted状态的ADR');
    console.log('3. 检查引用的ADR文件是否存在于 docs/adr/ 目录');
    console.log('4. 新增或修改ADR时请正确声明');
    return 1;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  let prBody = '';

  // 解析命令行参数
  for (const arg of args) {
    if (arg.startsWith('--pr-body=')) {
      prBody = arg.substring('--pr-body='.length);
    } else if (arg.startsWith('--pr-file=')) {
      const filePath = arg.substring('--pr-file='.length);
      if (existsSync(filePath)) {
        prBody = readFileSync(filePath, 'utf8');
      } else {
        console.error(`❌ 文件不存在: ${filePath}`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
用法: node scripts/pr-adr-validation.mjs [选项]

选项:
  --pr-body="内容"     直接指定PR描述内容
  --pr-file=path       从文件读取PR描述内容  
  --help, -h          显示帮助信息

示例:
  node scripts/pr-adr-validation.mjs --pr-body="修复ADR-0001相关问题"
  node scripts/pr-adr-validation.mjs --pr-file=.github/pr-body.txt
      `);
      process.exit(0);
    }
  }

  // 如果没有提供PR内容，从stdin读取
  if (!prBody) {
    console.log('请提供PR描述内容 (可使用Ctrl+D结束输入):');

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const lines = [];
    rl.on('line', line => {
      lines.push(line);
    });

    await new Promise(resolve => {
      rl.on('close', resolve);
    });

    prBody = lines.join('\n');
  }

  if (!prBody.trim()) {
    console.error('❌ PR描述内容不能为空');
    process.exit(1);
  }

  try {
    const results = await validatePRADRs(prBody);
    const exitCode = outputResults(results);
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ 验证过程中出现错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
