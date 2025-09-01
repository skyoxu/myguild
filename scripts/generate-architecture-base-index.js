/**
 * Architecture Base Index Generator - FIXED VERSION
 *
 * 修正的语义错误：
 * 1. CH字段：从文件名前缀提取章节代码（01-xxx.md → CH01）
 * 2. ADRs字段：从front-matter的adr_refs字段正确提取
 * 3. 文件范围：只处理docs/architecture/base/下的12个标准章节
 * 4. 输出格式：标准NDJSON格式
 *
 * 基于ThinkDeep分析和PageIndex最佳实践设计
 */

import fs from 'fs';
import path from 'path';

// === 配置参数 ===
const BASE_DIR = 'docs/architecture/base';
const OUTPUT_FILE = 'docs/index/architecture_base.index';
const CHAPTER_PATTERN = /^(\d{2})-.*\.md$/; // 匹配 01-xxx.md 格式

// === 工具函数 ===

/**
 * 提取YAML Front-matter
 */
function extractFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * 解析YAML字段值（简化版）
 */
function parseYAMLField(frontMatter, fieldName) {
  // 处理标量字段: title: "value"
  const scalarMatch = frontMatter.match(
    new RegExp(`^${fieldName}\\s*:\\s*(.+)$`, 'm')
  );
  if (scalarMatch) {
    return scalarMatch[1].replace(/^['"]|['"]$/g, '').trim();
  }

  // 处理数组字段: adr_refs: [ADR-0001, ADR-0002]
  const arrayMatch = frontMatter.match(
    new RegExp(`^${fieldName}\\s*:\\s*\\[(.*)\\]`, 'm')
  );
  if (arrayMatch) {
    return arrayMatch[1]
      .split(',')
      .map(item => item.replace(/^['"]|['"]$/g, '').trim())
      .filter(Boolean);
  }

  return null;
}

/**
 * 从文件名提取章节代码
 */
function extractChapterCode(fileName) {
  const match = fileName.match(CHAPTER_PATTERN);
  if (match) {
    const chapterNum = match[1];
    return `CH${chapterNum}`;
  }
  return null;
}

/**
 * 获取所有base章节文件
 */
function getBaseChapterFiles() {
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`❌ Base directory not found: ${BASE_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(BASE_DIR)
    .filter(file => file.endsWith('.md'))
    .filter(file => CHAPTER_PATTERN.test(file))
    .sort(); // 确保按章节顺序处理

  console.log(`📁 Found ${files.length} chapter files in ${BASE_DIR}`);
  return files.map(file => path.join(BASE_DIR, file));
}

/**
 * 处理单个章节文档
 */
function processChapterFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // 提取章节代码
    const chapterCode = extractChapterCode(fileName);
    if (!chapterCode) {
      return {
        success: false,
        error: `Invalid chapter file name format: ${fileName}`,
      };
    }

    // 解析front-matter
    const frontMatter = extractFrontMatter(content);
    if (!frontMatter) {
      return {
        success: false,
        error: `No front-matter found in ${fileName}`,
      };
    }

    // 提取字段
    const title =
      parseYAMLField(frontMatter, 'title') || fileName.replace('.md', '');
    const adrRefs = parseYAMLField(frontMatter, 'adr_refs') || [];
    const lastAdjusted = parseYAMLField(frontMatter, 'last_adjusted');

    // 生成索引记录
    const record = {
      file: filePath.replace(/\\/g, '/'), // 统一正斜杠
      slug: fileName.replace('.md', ''),
      title: title,
      CH: chapterCode, // 正确的章节代码
      ADRs: Array.isArray(adrRefs) ? adrRefs.join(', ') : adrRefs || '', // 从adr_refs提取
      updatedAt: lastAdjusted || new Date().toISOString().split('T')[0], // YYYY-MM-DD格式
    };

    return {
      success: true,
      record: record,
    };
  } catch (error) {
    return {
      success: false,
      error: `Processing error in ${path.basename(filePath)}: ${error.message}`,
    };
  }
}

/**
 * 主函数
 */
function generateFixedArchitectureIndex() {
  console.log('🔧 Architecture Base Index Generator - FIXED VERSION');
  console.log('📋 Correcting semantic errors in CH/ADRs field mapping...\n');

  // 获取章节文件
  const chapterFiles = getBaseChapterFiles();

  if (chapterFiles.length === 0) {
    console.error('❌ No valid chapter files found');
    process.exit(1);
  }

  const results = [];
  const errors = [];
  const chapters = new Set();

  // 处理所有章节文件
  for (const filePath of chapterFiles) {
    const result = processChapterFile(filePath);

    if (result.success) {
      results.push(result.record);
      chapters.add(result.record.CH);
      console.log(`✅ ${result.record.CH}: ${result.record.slug}`);
    } else {
      errors.push(result.error);
      console.error(`❌ Error: ${result.error}`);
    }
  }

  // 检查章节完整性
  const expectedChapters = Array.from(
    { length: 12 },
    (_, i) => `CH${String(i + 1).padStart(2, '0')}`
  );
  const missingChapters = expectedChapters.filter(ch => !chapters.has(ch));

  if (missingChapters.length > 0) {
    console.warn(`⚠️ Missing chapters: ${missingChapters.join(', ')}`);
  }

  // 检查错误
  if (errors.length > 0) {
    console.error(`\n🚨 Generation failed with ${errors.length} errors:`);
    errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }

  // 创建输出目录
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`\n📁 Created directory: ${outputDir}`);
  }

  // 生成NDJSON格式索引文件
  const ndjsonContent = results
    .sort((a, b) => a.CH.localeCompare(b.CH)) // 按章节排序
    .map(record => JSON.stringify(record))
    .join('\n');

  fs.writeFileSync(OUTPUT_FILE, ndjsonContent, 'utf8');

  console.log(`\n🎯 Fixed Architecture Base Index Generation Complete:`);
  console.log(
    `📄 Chapter files processed: ${results.length}/${expectedChapters.length}`
  );
  console.log(`📋 Index file: ${OUTPUT_FILE}`);
  console.log(`📊 Format: NDJSON (${results.length} records)`);

  // 显示语义修正摘要
  console.log(`\n✅ Semantic Corrections Applied:`);
  console.log(
    `   - CH field: Chapter codes (CH01-CH${String(results.length).padStart(2, '0')})`
  );
  console.log(`   - ADRs field: Extracted from adr_refs front-matter`);
  console.log(`   - File scope: ${results.length} base chapter files only`);
  console.log(`   - Output: Standard NDJSON format`);

  // 显示示例记录
  if (results.length > 0) {
    console.log(`\n📋 Sample record (${results[0].CH}):`);
    console.log(JSON.stringify(results[0], null, 2));
  }

  console.log('\n🚀 Ready for accurate RAG queries and Overlay generation!');
}

// 执行
generateFixedArchitectureIndex();

export { generateFixedArchitectureIndex, processChapterFile };
