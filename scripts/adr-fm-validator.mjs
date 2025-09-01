/**
 * ADR Front-Matter 验证器
 * 用于验证 ADR 文档的 YAML Front-Matter 是否符合标准格式
 * 支持自动化质量门禁集成
 */
import { readFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';
import Ajv from 'ajv';

const ADR_SCHEMA = {
  type: 'object',
  required: [
    'ADR-ID',
    'title',
    'status',
    'decision-time',
    'impact-scope',
    'tech-tags',
  ],
  properties: {
    'ADR-ID': {
      type: 'string',
      pattern: '^ADR-\\d{4}$',
    },
    title: {
      type: 'string',
      minLength: 10,
      maxLength: 100,
    },
    status: {
      type: 'string',
      enum: ['Proposed', 'Accepted', 'Superseded', 'Rejected'],
    },
    'decision-time': {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    },
    'impact-scope': {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    'tech-tags': {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    'depends-on': {
      type: 'array',
      items: { pattern: '^ADR-\\d{4}$' },
    },
    'depended-by': {
      type: 'array',
      items: { pattern: '^ADR-\\d{4}$' },
    },
    'test-coverage': {
      type: 'string',
      minLength: 1,
    },
    'monitoring-metrics': {
      type: 'array',
      items: { type: 'string' },
    },
    'executable-deliverables': {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: true,
};

/**
 * 验证单个ADR文件的Front-Matter
 */
export function validateADRFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const { data: frontMatter, isEmpty } = matter(content);

    if (isEmpty) {
      return {
        valid: false,
        file: filePath,
        errors: [{ message: 'ADR文档缺少Front-Matter' }],
      };
    }

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(ADR_SCHEMA);
    const isValid = validate(frontMatter);

    return {
      valid: isValid,
      file: filePath,
      errors: isValid ? [] : validate.errors,
      frontMatter: frontMatter,
    };
  } catch (error) {
    return {
      valid: false,
      file: filePath,
      errors: [{ message: `文件解析错误: ${error.message}` }],
    };
  }
}

/**
 * 验证所有ADR文件
 */
export async function validateAllADRs(pattern = 'docs/adr/ADR-*.md') {
  const files = await glob(pattern);
  const results = [];
  const violations = [];

  console.log(`🔍 开始验证 ${files.length} 个ADR文件...`);

  for (const file of files) {
    const result = validateADRFile(file);
    results.push(result);

    if (!result.valid) {
      violations.push(result);
      console.log(`❌ ${file}: ${result.errors.length} 个错误`);
      result.errors.forEach(err => {
        console.log(`   - ${err.instancePath || 'root'}: ${err.message}`);
      });
    } else {
      console.log(`✅ ${file}: 验证通过`);
    }
  }

  return {
    total: files.length,
    valid: results.length - violations.length,
    violations: violations,
    summary: {
      validCount: results.length - violations.length,
      invalidCount: violations.length,
      passRate: (
        ((results.length - violations.length) / results.length) *
        100
      ).toFixed(1),
    },
  };
}

/**
 * 生成ADR依赖关系报告
 */
export function generateDependencyReport(results) {
  const dependencies = new Map();

  results.forEach(result => {
    if (result.valid && result.frontMatter) {
      const adrId = result.frontMatter['ADR-ID'];
      const dependsOn = result.frontMatter['depends-on'] || [];
      const dependedBy = result.frontMatter['depended-by'] || [];

      dependencies.set(adrId, {
        file: result.file,
        dependsOn,
        dependedBy,
        status: result.frontMatter.status,
      });
    }
  });

  return dependencies;
}

/**
 * CLI入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const pattern = args[0] || 'docs/adr/ADR-*.md';
  const strictMode = args.includes('--strict');

  console.log('🚀 ADR Front-Matter 验证器');
  console.log('='.repeat(50));

  const validation = await validateAllADRs(pattern);

  console.log('\n📊 验证结果统计:');
  console.log(`总计: ${validation.total} 个文件`);
  console.log(`通过: ${validation.summary.validCount} 个`);
  console.log(`失败: ${validation.summary.invalidCount} 个`);
  console.log(`通过率: ${validation.summary.passRate}%`);

  if (validation.violations.length > 0) {
    console.log('\n❌ 验证失败的文件:');
    validation.violations.forEach(v => {
      console.log(`\n📄 ${v.file}:`);
      v.errors.forEach(err => {
        console.log(
          `  • ${err.instancePath || 'Front-Matter'}: ${err.message}`
        );
      });
    });
  }

  // 严格模式下，如果有违例则退出码为1
  if (strictMode && validation.violations.length > 0) {
    console.log('\n🚫 严格模式：检测到违例，退出状态码 1');
    process.exit(1);
  }

  console.log('\n✨ ADR验证完成！');
}

// 直接执行时运行main函数
if (process.argv[1] && process.argv[1].endsWith('adr-fm-validator.mjs')) {
  main().catch(console.error);
}
