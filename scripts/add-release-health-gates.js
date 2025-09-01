#!/usr/bin/env node

/**
 * 为所有PRD分片文件添加Release Health门禁配置
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReleaseHealthGateAdder {
  constructor() {
    this.prdChunksDir = path.join(__dirname, '..', 'docs', 'prd_chunks');
    this.processed = [];
    this.errors = [];
  }

  async addGatestoAllChunks() {
    console.log('🚀 为所有PRD分片文件添加Release Health门禁配置...\n');

    try {
      const files = fs
        .readdirSync(this.prdChunksDir)
        .filter(
          file =>
            file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
        )
        .sort();

      console.log(`📂 发现 ${files.length} 个 PRD 分片文件`);

      for (const file of files) {
        await this.addGateToFile(file);
      }

      this.printSummary();
    } catch (error) {
      console.error('❌ 处理文件失败:', error.message);
      process.exit(1);
    }
  }

  async addGateToFile(filename) {
    const filePath = path.join(this.prdChunksDir, filename);
    console.log(`🔧 处理文件: ${filename}`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // 检查是否已有 Sentry_Release_Health_Gate
      if (content.includes('Sentry_Release_Health_Gate')) {
        console.log('   ⚪ 已存在Release Health门禁，跳过');
        return;
      }

      // 检查是否有 CRASH_FREE_99.5 SLO
      if (!content.includes('CRASH_FREE_99.5')) {
        console.log('   ⚪ 未找到CRASH_FREE_99.5 SLO，跳过');
        return;
      }

      // 查找合适的插入位置
      const gatesEndRegex =
        /(\s+windowHours: \d+\s*\n)(\s*Contract_Definitions:)/;
      const match = content.match(gatesEndRegex);

      if (!match) {
        console.log('   ⚠️  未找到合适的插入位置');
        return;
      }

      const [, lastGate, contractsSection] = match;

      // 构建Release Health门禁配置
      const releaseHealthGate = `  Sentry_Release_Health_Gate:
    enabled: true
    threshold: "crash_free_users >= 99.5% AND crash_free_sessions >= 99.9%"
    blockingFailures:
      - "crash_free_threshold_violation"
      - "insufficient_adoption_data" 
      - "release_health_regression"
    windowHours: 24
    params:
      sloRef: "CRASH_FREE_99.5"
      thresholds:
        crashFreeUsers: 99.5
        crashFreeSessions: 99.9
        minAdoptionPercent: 25
        durationHours: 24
`;

      const newContent = content.replace(
        gatesEndRegex,
        `${lastGate}\t${releaseHealthGate}\t${contractsSection}`
      );

      fs.writeFileSync(filePath, newContent, 'utf-8');
      this.processed.push(filename);
      console.log('   ✅ 添加Release Health门禁完成');
    } catch (error) {
      const errorMsg = `处理 ${filename} 时出错: ${error.message}`;
      this.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Release Health门禁添加结果摘要');
    console.log('='.repeat(60));

    console.log(`✅ 成功处理文件: ${this.processed.length} 个`);
    console.log(`❌ 处理失败文件: ${this.errors.length} 个`);

    if (this.processed.length > 0) {
      console.log('\n✅ 处理成功的文件:');
      this.processed.forEach(file => console.log(`  - ${file}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n🎉 Release Health门禁配置完成!');
  }
}

const adder = new ReleaseHealthGateAdder();
adder.addGatestoAllChunks().catch(error => {
  console.error('❌ 处理过程中发生错误:', error);
  process.exit(1);
});
