/**
 * 扫描 docs/architecture/overlays 下的 08 章节文档
 * 解析 Front-matter 并生成关键词映射到文件路径的索引
 * 输出到 scripts/overlay-map.json
 */

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');
const matter = require('gray-matter');

// 辅助函数：生成 slug（小写、去空格、去特殊字符）
function makeSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, '-') // 空格、下划线、连字符 -> 单个连字符
    .replace(/[^\w\u4e00-\u9fa5\-]/g, '') // 保留字母、数字、中文、连字符
    .replace(/^-+|-+$/g, ''); // 去除首尾连字符
}

// 辅助函数：中文分词（简单实现，按字符和标点分割）
function segmentChinese(text) {
  if (!text) return [];

  // 简单的中文英文分词
  const segments = text
    .replace(/([a-zA-Z]+)/g, ' $1 ') // 英文词两边加空格
    .replace(/([0-9]+)/g, ' $1 ') // 数字两边加空格
    .replace(/[\s\-_\/\\\(\)\[\]]+/g, ' ') // 标点符号替换为空格
    .split(/\s+/)
    .filter(seg => seg.length > 0);

  const result = [];

  segments.forEach(seg => {
    if (/^[a-zA-Z0-9]+$/.test(seg)) {
      // 英文数字直接加入
      result.push(seg);
    } else if (/[\u4e00-\u9fa5]/.test(seg)) {
      // 中文按字符分割（简单分词）
      const chars = seg.split('');
      chars.forEach(char => {
        if (/[\u4e00-\u9fa5]/.test(char)) {
          result.push(char);
        }
      });
      // 也保留完整词
      if (seg.length > 1) {
        result.push(seg);
      }
    }
  });

  return result;
}

// 辅助函数：提取PRD-ID从路径
function extractPrdId(filePath) {
  const match = filePath.match(/overlays[\/\\]([^\/\\]+)[\/\\]/);
  return match ? match[1] : null;
}

// 主函数
async function scanOverlays() {
  console.log('🔍 扫描 overlay 文档...');

  // 扫描所有 overlay 08 章节文档
  const pattern = 'docs/architecture/overlays/**/08/*.md';
  const files = await glob(pattern, {
    cwd: process.cwd(),
    onlyFiles: true,
  });

  console.log(`📁 找到 ${files.length} 个文档文件`);

  if (files.length === 0) {
    console.log('⚠️  没有找到 overlay 文档，跳过映射生成');
    return { metadata: { totalFiles: 0 }, keywords: {}, files: {} };
  }

  const overlayMap = {
    metadata: {
      generated: new Date().toISOString(),
      totalFiles: files.length,
      pattern: pattern,
    },
    keywords: {}, // keyword -> [files]
    files: {}, // filepath -> metadata
  };

  let processedCount = 0;

  for (const file of files) {
    try {
      const fullPath = path.resolve(file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = matter(content);
      const fm = parsed.data;

      // 提取 PRD-ID
      const prdId = extractPrdId(file);

      // 收集关键词
      const keywords = new Set();

      // 1. 从 title 分词
      if (fm.title) {
        const titleSegments = segmentChinese(fm.title);
        titleSegments.forEach(seg => keywords.add(makeSlug(seg)));
      }

      // 2. 从 keywords/tags 提取
      const keywordFields = ['keywords', 'tags', 'tag'];
      keywordFields.forEach(field => {
        if (fm[field]) {
          const vals = Array.isArray(fm[field]) ? fm[field] : [fm[field]];
          vals.forEach(val => {
            if (typeof val === 'string') {
              const segs = segmentChinese(val);
              segs.forEach(seg => keywords.add(makeSlug(seg)));
            }
          });
        }
      });

      // 3. 从 aliases 提取
      if (fm.aliases) {
        const aliases = Array.isArray(fm.aliases) ? fm.aliases : [fm.aliases];
        aliases.forEach(alias => {
          if (typeof alias === 'string') {
            const segs = segmentChinese(alias);
            segs.forEach(seg => keywords.add(makeSlug(seg)));
          }
        });
      }

      // 4. PRD-ID 作为关键词
      if (prdId) {
        keywords.add(makeSlug(prdId));
        // 也添加不带前缀的部分
        const cleanId = prdId.replace(/^PRD-/, '').replace(/^prd-/i, '');
        if (cleanId !== prdId) {
          keywords.add(makeSlug(cleanId));
        }
      }

      // 5. 从文件名提取关键词
      const fileName = path.basename(file, '.md');
      const fileSegments = segmentChinese(fileName.replace(/^08-/, ''));
      fileSegments.forEach(seg => keywords.add(makeSlug(seg)));

      // 去除空关键词
      const validKeywords = Array.from(keywords).filter(k => k.length > 0);

      // 存储文件元数据
      overlayMap.files[file] = {
        title: fm.title || fileName,
        prdId: prdId,
        keywords: validKeywords,
        frontMatter: fm,
        path: file,
      };

      // 建立关键词反向索引
      validKeywords.forEach(keyword => {
        if (!overlayMap.keywords[keyword]) {
          overlayMap.keywords[keyword] = [];
        }
        overlayMap.keywords[keyword].push(file);
      });

      processedCount++;
      console.log(
        `✅ [${processedCount}/${files.length}] ${file} -> ${validKeywords.length} 关键词`
      );
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`, error.message);
    }
  }

  // 对关键词按文件数量排序
  const sortedKeywords = Object.entries(overlayMap.keywords)
    .sort(([, a], [, b]) => b.length - a.length)
    .reduce((obj, [key, val]) => {
      obj[key] = val;
      return obj;
    }, {});

  overlayMap.keywords = sortedKeywords;
  overlayMap.metadata.processedFiles = processedCount;
  overlayMap.metadata.totalKeywords = Object.keys(sortedKeywords).length;

  // 确保输出目录存在
  const outputDir = path.dirname('scripts/overlay-map.json');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 输出结果
  fs.writeFileSync(
    'scripts/overlay-map.json',
    JSON.stringify(overlayMap, null, 2),
    'utf8'
  );

  console.log('\n📊 统计信息:');
  console.log(`   文档文件: ${overlayMap.metadata.totalFiles}`);
  console.log(`   处理成功: ${overlayMap.metadata.processedFiles}`);
  console.log(`   关键词数: ${overlayMap.metadata.totalKeywords}`);
  console.log(`   输出文件: scripts/overlay-map.json`);

  // 显示前10个最常见的关键词
  if (overlayMap.metadata.totalKeywords > 0) {
    console.log('\n🔝 最常见关键词 (前10):');
    Object.entries(sortedKeywords)
      .slice(0, 10)
      .forEach(([keyword, files], index) => {
        console.log(`   ${index + 1}. "${keyword}" -> ${files.length} 文件`);
      });
  }

  return overlayMap;
}

// 如果直接运行此脚本
if (require.main === module) {
  scanOverlays()
    .then(() => {
      console.log('\n✅ overlay 映射生成完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 扫描失败:', error);
      process.exit(1);
    });
}

module.exports = { scanOverlays };
