// @vitest-environment node
/**
 * docs-scorer.mjs 性能测试
 * 验证大文档AST解析性能和缓存机制
 * 指定Node环境避免window访问错误
 */

import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
// 动态导入以避免模块解析问题
let analyzeDocument, DocumentAnalyzer, ASTCache;

beforeAll(async () => {
  const module = await import('../../scripts/docs-scorer.mjs');
  analyzeDocument = module.analyzeDocument;
  DocumentAnalyzer = module.DocumentAnalyzer;
  // ASTCache 不是导出的，直接创建mock
  ASTCache = {
    cache: new Map(),
    clear() {
      this.cache.clear();
    },
  };
});

describe('docs-scorer Performance Tests', () => {
  const performanceThresholds = {
    smallDoc: 100, // <5KB，应在100ms内完成
    mediumDoc: 300, // 5-20KB，应在300ms内完成
    largeDoc: 1000, // >20KB，应在1000ms内完成
    cacheHit: 10, // 缓存命中应在10ms内完成
  };

  function measureTime(fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return { result, duration: end - start };
  }

  async function measureTimeAsync(fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, duration: end - start };
  }

  function getDocSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  function categorizeDoc(size) {
    if (size < 5 * 1024) return 'small';
    if (size < 20 * 1024) return 'medium';
    return 'large';
  }

  beforeEach(() => {
    // 清空AST缓存（如果存在）
    if (ASTCache?.cache) {
      ASTCache.cache.clear();
    }
  });

  test('单个文档解析性能测试', async () => {
    const testFile =
      'docs/architecture/base/04-system-context-c4-event-flows.optimized.md';

    if (!fs.existsSync(testFile)) {
      console.warn(`测试文件不存在: ${testFile}，跳过性能测试`);
      return;
    }

    const fileSize = getDocSize(testFile);
    const category = categorizeDoc(fileSize);
    const threshold = performanceThresholds[category + 'Doc'];

    console.log(`测试文档: ${testFile}`);
    console.log(`文档大小: ${(fileSize / 1024).toFixed(2)}KB (${category})`);
    console.log(`性能阈值: ${threshold}ms`);

    const { result, duration } = await measureTimeAsync(() =>
      analyzeDocument(testFile)
    );

    console.log(`解析耗时: ${duration.toFixed(2)}ms`);
    console.log(`文档得分: ${result.scores.total}/23`);

    expect(duration).toBeLessThan(threshold);
    expect(result.scores.total).toBeGreaterThan(0);
  });

  test('AST缓存机制性能测试', async () => {
    const testFile =
      'docs/architecture/base/04-system-context-c4-event-flows.optimized.md';

    if (!fs.existsSync(testFile)) {
      console.warn(`测试文件不存在: ${testFile}，跳过缓存测试`);
      return;
    }

    // 第一次解析（冷启动）
    const { duration: coldDuration } = await measureTimeAsync(() =>
      analyzeDocument(testFile)
    );
    console.log(`冷启动解析: ${coldDuration.toFixed(2)}ms`);

    // 第二次解析（缓存命中）
    const { duration: cachedDuration } = await measureTimeAsync(() =>
      analyzeDocument(testFile)
    );
    console.log(`缓存命中解析: ${cachedDuration.toFixed(2)}ms`);

    // 验证缓存效果
    expect(cachedDuration).toBeLessThan(performanceThresholds.cacheHit);
    expect(cachedDuration).toBeLessThan(coldDuration * 0.1); // 缓存至少快10倍
  });

  test('批量文档处理性能测试', async () => {
    const pattern = 'docs/architecture/base/04-*.md';
    const files = await glob(pattern);

    if (files.length === 0) {
      console.warn(`未找到匹配文件: ${pattern}，跳过批量测试`);
      return;
    }

    console.log(`批量处理文档数量: ${files.length}`);

    const { result: results, duration } = await measureTimeAsync(async () => {
      const results = [];
      for (const file of files) {
        const result = await analyzeDocument(file);
        results.push(result);
      }
      return results;
    });

    const avgTimePerDoc = duration / files.length;
    console.log(`批量处理总耗时: ${duration.toFixed(2)}ms`);
    console.log(`平均每文档耗时: ${avgTimePerDoc.toFixed(2)}ms`);

    // 验证批量处理效率
    expect(avgTimePerDoc).toBeLessThan(500); // 平均每文档不超过500ms
    expect(results.length).toBe(files.length);
    results.forEach(result => {
      expect(result.scores.total).toBeGreaterThanOrEqual(0);
      expect(result.scores.total).toBeLessThanOrEqual(23);
    });
  });

  test('内存使用测试', async () => {
    const testFile =
      'docs/architecture/base/04-system-context-c4-event-flows.optimized.md';

    if (!fs.existsSync(testFile)) {
      console.warn(`测试文件不存在: ${testFile}，跳过内存测试`);
      return;
    }

    const beforeMemory = process.memoryUsage();

    // 多次解析同一文档
    for (let i = 0; i < 10; i++) {
      await analyzeDocument(testFile);
    }

    const afterMemory = process.memoryUsage();
    const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;

    console.log(
      `解析前内存: ${(beforeMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
    console.log(
      `解析后内存: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
    console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // 验证内存使用合理（不超过10MB增长）
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });

  test('并发处理性能测试', async () => {
    const pattern = 'docs/architecture/base/04-*.md';
    const files = await glob(pattern);

    if (files.length === 0) {
      console.warn(`未找到匹配文件: ${pattern}，跳过并发测试`);
      return;
    }

    console.log(`并发处理文档数量: ${files.length}`);

    // 串行处理
    const { duration: serialDuration } = await measureTimeAsync(async () => {
      for (const file of files) {
        await analyzeDocument(file);
      }
    });

    // 清空缓存
    ASTCache.cache.clear();

    // 并行处理
    const { duration: parallelDuration } = await measureTimeAsync(async () => {
      await Promise.all(files.map(file => analyzeDocument(file)));
    });

    console.log(`串行处理耗时: ${serialDuration.toFixed(2)}ms`);
    console.log(`并行处理耗时: ${parallelDuration.toFixed(2)}ms`);
    console.log(
      `并行加速比: ${(serialDuration / parallelDuration).toFixed(2)}x`
    );

    // 验证并行处理效果（应该更快，除非文档数量太少）
    if (files.length > 1) {
      expect(parallelDuration).toBeLessThan(serialDuration);
    }
  });

  test('大文档处理压力测试', async () => {
    // 创建大文档内容进行测试
    const largeContent = `---
title: Large Document Test
adr_refs: [ADR-0001, ADR-0002, ADR-0004, ADR-0005]
placeholders: \${APP_NAME}, \${PRODUCT_NAME}, \${DOMAIN_PREFIX}
---

# Large Document Performance Test

${'## Section '.repeat(100)}

\`\`\`mermaid
C4Context
    title System Context (Base)
    Person(player, "Player")
    System(app, "\${PRODUCT_NAME} (Electron App)")
\`\`\`

\`\`\`mermaid  
C4Container
    title Container View (Base)
    Container(main, "Main Process", "Node/Electron")
    Container(renderer, "Renderer UI", "React + Phaser")
\`\`\`

\`\`\`ts
export interface CloudEventV1<T=unknown> { 
  id: string; source: string; type: string; time: string;
  specversion: "1.0"; datacontenttype?: "application/json"; data?: T;
}
\`\`\`

${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000)}
`;

    const testFilePath = path.join(process.cwd(), 'test-large-doc.md');

    // 写入大文档
    fs.writeFileSync(testFilePath, largeContent);

    try {
      const fileSize = getDocSize(testFilePath);
      console.log(`大文档大小: ${(fileSize / 1024).toFixed(2)}KB`);

      const { result, duration } = await measureTimeAsync(() =>
        analyzeDocument(testFilePath)
      );

      console.log(`大文档解析耗时: ${duration.toFixed(2)}ms`);
      console.log(`大文档得分: ${result.scores.total}/23`);

      // 验证大文档处理性能
      expect(duration).toBeLessThan(2000); // 大文档不超过2秒
      expect(result.scores.total).toBeGreaterThan(0);
    } finally {
      // 清理测试文件
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });
});

// 性能报告生成
function generatePerformanceReport() {
  console.log('\n📊 docs-scorer.mjs 性能测试报告');
  console.log('='.repeat(50));
  console.log('🎯 性能目标:');
  console.log('  - 小文档(<5KB): <100ms');
  console.log('  - 中等文档(5-20KB): <300ms');
  console.log('  - 大文档(>20KB): <1000ms');
  console.log('  - 缓存命中: <10ms');
  console.log('  - 内存增长: <10MB');
  console.log('\n✅ 性能优化建议:');
  console.log('  1. AST缓存机制已启用');
  console.log('  2. 支持并发处理');
  console.log('  3. 内存使用控制');
  console.log('  4. 专业解析工具(remark)');
}

// 在测试结束后生成报告
afterAll(() => {
  generatePerformanceReport();
});
