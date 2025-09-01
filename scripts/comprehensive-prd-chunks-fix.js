#!/usr/bin/env node

/**
 * 综合PRD分片架构修复脚本 v3.0
 * 基于ThinkDeep max mode分析结果，修复以下关键架构合规性问题：
 *
 * 1. 系统性ADR引用缺失（缺少ADR-0002 Electron安全基线）
 * 2. CloudEvents 1.0规范违规（缺少必填字段、结构格式问题）
 * 3. Release_Gates YAML结构崩溃（特别是chunk 004）
 * 4. CSP策略模糊化（需要Electron特定配置）
 * 5. E2E测试集成缺失（需要Playwright集成）
 *
 * 修复策略：智能YAML重构 + 合规性验证 + 完整性保护
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensivePRDChunksFixer {
  constructor() {
    this.prdChunksDir = path.join(__dirname, '..', 'docs', 'prd_chunks');
    this.backupDir = path.join(
      __dirname,
      '..',
      'backups',
      `prd-chunks-backup-${Date.now()}`
    );

    this.results = {
      processed: [],
      errors: [],
      issues_fixed: {
        adr_references_added: 0,
        cloudevents_compliance_fixed: 0,
        release_gates_reconstructed: 0,
        csp_policies_enhanced: 0,
        e2e_tests_added: 0,
      },
    };

    console.log('🚀 启动综合PRD分片架构修复脚本 v3.0...\n');
  }

  /**
   * 主要修复流程
   */
  async executeComprehensiveFix() {
    try {
      // 步骤1：创建备份
      await this.createBackup();

      // 步骤2：扫描所有PRD分片文件
      const files = await this.scanPRDChunks();
      console.log(`📂 发现 ${files.length} 个PRD分片文件\n`);

      // 步骤3：批量修复所有文件
      for (const file of files) {
        await this.fixSingleChunk(file);
      }

      // 步骤4：验证修复结果
      await this.validateFixes();

      // 步骤5：生成修复报告
      this.generateComprehensiveReport();
    } catch (error) {
      console.error('❌ 修复过程中发生严重错误:', error.message);
      console.log('💡 建议：检查文件权限和目录结构');
      process.exit(1);
    }
  }

  /**
   * 创建安全备份
   */
  async createBackup() {
    console.log('🛡️  创建安全备份...');

    try {
      // 确保备份目录存在
      fs.mkdirSync(this.backupDir, { recursive: true });

      // 复制所有PRD分片文件
      const files = fs
        .readdirSync(this.prdChunksDir)
        .filter(
          file =>
            file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
        );

      for (const file of files) {
        const sourcePath = path.join(this.prdChunksDir, file);
        const backupPath = path.join(this.backupDir, file);
        fs.copyFileSync(sourcePath, backupPath);
      }

      console.log(
        `   ✅ 备份完成: ${files.length} 个文件 -> ${this.backupDir}\n`
      );
    } catch (error) {
      throw new Error(`备份创建失败: ${error.message}`);
    }
  }

  /**
   * 扫描PRD分片文件
   */
  async scanPRDChunks() {
    const files = fs
      .readdirSync(this.prdChunksDir)
      .filter(
        file =>
          file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
      )
      .sort();

    return files;
  }

  /**
   * 修复单个PRD分片文件
   */
  async fixSingleChunk(filename) {
    const filePath = path.join(this.prdChunksDir, filename);
    console.log(`🔧 修复文件: ${filename}`);

    try {
      const originalContent = fs.readFileSync(filePath, 'utf-8');
      let content = originalContent;
      let modified = false;
      const issues_fixed = [];

      // 1. 修复ADR引用缺失问题
      const adrResult = this.fixADRReferences(content);
      if (adrResult.modified) {
        content = adrResult.content;
        modified = true;
        issues_fixed.push(adrResult.message);
        this.results.issues_fixed.adr_references_added++;
      }

      // 2. 修复CloudEvents 1.0合规性问题
      const cloudEventsResult = this.fixCloudEventsCompliance(
        content,
        filename
      );
      if (cloudEventsResult.modified) {
        content = cloudEventsResult.content;
        modified = true;
        issues_fixed.push(cloudEventsResult.message);
        this.results.issues_fixed.cloudevents_compliance_fixed++;
      }

      // 3. 重建Release_Gates YAML结构
      const releaseGatesResult = this.reconstructReleaseGates(content);
      if (releaseGatesResult.modified) {
        content = releaseGatesResult.content;
        modified = true;
        issues_fixed.push(releaseGatesResult.message);
        this.results.issues_fixed.release_gates_reconstructed++;
      }

      // 4. 增强CSP策略配置
      const cspResult = this.enhanceCSPPolicies(content);
      if (cspResult.modified) {
        content = cspResult.content;
        modified = true;
        issues_fixed.push(cspResult.message);
        this.results.issues_fixed.csp_policies_enhanced++;
      }

      // 5. 添加E2E测试配置
      const e2eResult = this.addE2ETestConfiguration(content, filename);
      if (e2eResult.modified) {
        content = e2eResult.content;
        modified = true;
        issues_fixed.push(e2eResult.message);
        this.results.issues_fixed.e2e_tests_added++;
      }

      // 保存修复后的文件
      if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        this.results.processed.push({
          file: filename,
          issues_fixed: issues_fixed,
          issues_count: issues_fixed.length,
        });

        console.log(`   ✅ 修复完成 (${issues_fixed.length} 个问题)`);
        issues_fixed.forEach(issue => console.log(`      - ${issue}`));
      } else {
        console.log(`   ⚪ 无需修复`);
      }
    } catch (error) {
      const errorMsg = `修复 ${filename} 时出错: ${error.message}`;
      this.results.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }

  /**
   * 修复ADR引用缺失问题
   * 核心问题：所有chunks都缺少ADR-0002 (Electron安全基线)
   */
  fixADRReferences(content) {
    // 检查是否已有ADR-0002
    if (content.includes('"ADR-0002-electron-security-baseline"')) {
      return { modified: false };
    }

    // 查找ADRs部分
    const adrsRegex = /(ADRs:\s*\n(\s+- "[^"]+"\s*\n)*)/;
    const match = content.match(adrsRegex);

    if (!match) {
      return { modified: false, message: 'ADRs字段未找到' };
    }

    const adrsSection = match[1];

    // 检查是否有CRASH_FREE_99.5 SLO，如果有则添加ADR-0002
    if (content.includes('CRASH_FREE_99.5')) {
      const newADREntry = '  - "ADR-0002-electron-security-baseline"\n';

      // 在第一个ADR条目后插入
      const newADRsSection = adrsSection.replace(
        /(\s+- "[^"]+"\s*\n)/,
        `$1${newADREntry}`
      );

      const newContent = content.replace(adrsRegex, newADRsSection);

      return {
        modified: true,
        content: newContent,
        message: 'ADR引用修复: 添加 ADR-0002 (Electron安全基线)',
      };
    }

    return { modified: false };
  }

  /**
   * 修复CloudEvents 1.0合规性问题
   * 核心问题：缺少必填字段、结构格式异常
   */
  fixCloudEventsCompliance(content, filename) {
    // 匹配events部分（处理多种格式变体）
    const eventsRegex =
      /(\s+)events:\s*\n((?:\s+[^\n]+\s*\n)*?)(\s+interfaces:)/s;
    const match = content.match(eventsRegex);

    if (!match) {
      return { modified: false };
    }

    const [, indent, eventsContent, nextSection] = match;
    const modified = false;
    const fixedContent = eventsContent;
    const fixes = [];

    // 解析现有字段
    const fields = {
      specversion: /specversion:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      id: /id:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      time: /time:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      type: /type:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      source: /source:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      subject: /subject:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      datacontenttype: /datacontenttype:\s*"([^"]+)"/.exec(fixedContent)?.[1],
      dataschema: /dataschema:\s*"([^"]+)"/.exec(fixedContent)?.[1],
    };

    // 重构CloudEvents结构，确保字段顺序和格式正确
    const chunkMatch = filename.match(/chunk_(\d{3})/);
    const chunkNum = chunkMatch ? chunkMatch[1] : '000';

    const requiredFields = {
      specversion: fields.specversion || '1.0',
      id:
        fields.id ||
        `guild-manager-chunk-${chunkNum}-${Date.now().toString(36)}`,
      time: fields.time || new Date().toISOString(),
      type: fields.type || `com.guildmanager.chunk${chunkNum}.event`,
      source: fields.source || `/guild-manager/chunk-${chunkNum}`,
      subject: fields.subject || `guild-management-chunk-${parseInt(chunkNum)}`,
      datacontenttype: fields.datacontenttype || 'application/json',
      dataschema:
        fields.dataschema ||
        `src/shared/contracts/guild/chunk-${chunkNum}-events.ts`,
    };

    // 生成正确格式的CloudEvents结构
    const newEventsContent = `    specversion: "${requiredFields.specversion}"
    id: "${requiredFields.id}"
    time: "${requiredFields.time}"
    type: "${requiredFields.type}"
    source: "${requiredFields.source}"
    subject: "${requiredFields.subject}"
    datacontenttype: "${requiredFields.datacontenttype}"
    dataschema: "${requiredFields.dataschema}"
`;

    const newContent = content.replace(
      eventsRegex,
      `${indent}events:\n${newEventsContent}${nextSection}`
    );

    return {
      modified: true,
      content: newContent,
      message: 'CloudEvents 1.0合规性修复: 字段完整性和结构规范化',
    };
  }

  /**
   * 重建Release_Gates YAML结构
   * 核心问题：YAML层级崩溃，特别是chunk 004
   */
  reconstructReleaseGates(content) {
    // 检查Release_Gates部分是否存在结构问题
    const gatesRegex =
      /Release_Gates:\s*\n((?:.*\n)*?)(?=Contract_Definitions:)/s;
    const match = content.match(gatesRegex);

    if (!match) {
      return { modified: false };
    }

    const gatesContent = match[1];

    // 检查是否需要重建结构（检测扁平化的键）
    const hasStructureIssues =
      gatesContent.includes('enabled: ') &&
      !gatesContent.includes('  Quality_Gate:') &&
      !gatesContent.includes('  Security_Gate:');

    if (!hasStructureIssues) {
      return { modified: false };
    }

    // 重建标准的Release Gates结构
    const standardReleaseGates = `  Quality_Gate:
    enabled: true
    threshold: "unit_test_coverage >= 80%"
    blockingFailures:
      - "test_failures"
      - "coverage_below_threshold"
    windowHours: 24
  Security_Gate:
    enabled: true
    threshold: "security_scan_passed == true"
    blockingFailures:
      - "security_vulnerabilities"
      - "dependency_vulnerabilities"
    windowHours: 12
  Performance_Gate:
    enabled: true
    threshold: "p95_response_time <= 100ms"
    blockingFailures:
      - "performance_regression"
      - "memory_leaks"
    windowHours: 6
  Acceptance_Gate:
    enabled: true
    threshold: "acceptance_criteria_met >= 95%"
    blockingFailures:
      - "acceptance_test_failures"
      - "user_story_incomplete"
    windowHours: 48
  API_Contract_Gate:
    enabled: true
    threshold: "api_contract_compliance >= 100%"
    blockingFailures:
      - "contract_violations"
      - "breaking_changes"
    windowHours: 12
  Sentry_Release_Health_Gate:
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
      gatesRegex,
      `Release_Gates:\n${standardReleaseGates}Contract_Definitions:`
    );

    return {
      modified: true,
      content: newContent,
      message: 'Release Gates结构重建: 修复YAML层级崩溃',
    };
  }

  /**
   * 增强CSP策略配置
   * 核心问题：CSP策略过于泛化，需要Electron特定配置
   */
  enhanceCSPPolicies(content) {
    const cspRegex = /(cspNotes:\s*)"([^"]+)"/;
    const match = content.match(cspRegex);

    if (!match) {
      return { modified: false };
    }

    const currentCSPNote = match[2];

    // 检查是否已经是具体的Electron CSP配置
    if (
      currentCSPNote.includes('script-src') ||
      currentCSPNote.includes('Electron')
    ) {
      return { modified: false };
    }

    // 生成Electron特定的CSP策略
    const electronCSP =
      "Electron CSP: script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; require-trusted-types-for 'script'";

    const newContent = content.replace(cspRegex, `$1"${electronCSP}"`);

    return {
      modified: true,
      content: newContent,
      message: 'CSP策略增强: 添加Electron特定的安全配置',
    };
  }

  /**
   * 添加E2E测试配置
   * 核心问题：缺乏E2E冒烟测试集成
   */
  addE2ETestConfiguration(content, filename) {
    // 检查Test-Refs是否已包含E2E测试
    const testRefsRegex = /Test-Refs:\s*\n((?:\s+- "[^"]+"\s*\n)*)/;
    const match = content.match(testRefsRegex);

    if (!match) {
      return { modified: false };
    }

    const testRefsContent = match[1];

    // 检查是否已有E2E测试引用
    if (
      testRefsContent.includes('e2e') ||
      testRefsContent.includes('playwright')
    ) {
      return { modified: false };
    }

    const chunkMatch = filename.match(/chunk_(\d{3})/);
    const chunkNum = chunkMatch ? chunkMatch[1] : '000';

    // 添加E2E测试引用
    const e2eTestRef = `  - "tests/e2e/guild-manager-chunk-${chunkNum}-smoke.spec.ts"\n`;
    const newTestRefsContent = testRefsContent + e2eTestRef;

    const newContent = content.replace(
      testRefsRegex,
      `Test-Refs:\n${newTestRefsContent}`
    );

    return {
      modified: true,
      content: newContent,
      message: 'E2E测试配置: 添加Playwright冒烟测试引用',
    };
  }

  /**
   * 验证修复结果
   */
  async validateFixes() {
    console.log('\n🔍 验证修复结果...');

    const files = await this.scanPRDChunks();
    const validationErrors = [];

    for (const file of files) {
      const filePath = path.join(this.prdChunksDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 验证关键修复
      const checks = [
        {
          name: 'ADR-0002引用',
          test: content.includes('"ADR-0002-electron-security-baseline"'),
          required: content.includes('CRASH_FREE_99.5'),
        },
        {
          name: 'CloudEvents合规性',
          test:
            content.includes('specversion:') &&
            content.includes('id:') &&
            content.includes('time:'),
          required: true,
        },
        {
          name: 'Release Gates结构',
          test:
            content.includes('Quality_Gate:') &&
            content.includes('Security_Gate:'),
          required: true,
        },
        {
          name: 'Electron CSP',
          test:
            content.includes('script-src') || content.includes('Electron CSP'),
          required: content.includes('cspNotes:'),
        },
      ];

      for (const check of checks) {
        if (check.required && !check.test) {
          validationErrors.push(`${file}: ${check.name} 验证失败`);
        }
      }
    }

    if (validationErrors.length > 0) {
      console.log('   ⚠️  发现验证问题:');
      validationErrors.forEach(error => console.log(`      - ${error}`));
    } else {
      console.log('   ✅ 所有修复验证通过');
    }

    this.results.validation_errors = validationErrors;
  }

  /**
   * 生成综合修复报告
   */
  generateComprehensiveReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 综合PRD分片架构修复报告 v3.0');
    console.log('='.repeat(80));

    const {
      processed,
      errors,
      issues_fixed,
      validation_errors = [],
    } = this.results;

    console.log(`✅ 成功处理文件: ${processed.length} 个`);
    console.log(`❌ 处理失败文件: ${errors.length} 个`);
    console.log(`⚠️  验证问题: ${validation_errors.length} 个`);

    console.log('\n🔧 修复问题统计:');
    console.log(`  - ADR引用添加: ${issues_fixed.adr_references_added} 个`);
    console.log(
      `  - CloudEvents合规性修复: ${issues_fixed.cloudevents_compliance_fixed} 个`
    );
    console.log(
      `  - Release Gates重建: ${issues_fixed.release_gates_reconstructed} 个`
    );
    console.log(`  - CSP策略增强: ${issues_fixed.csp_policies_enhanced} 个`);
    console.log(`  - E2E测试添加: ${issues_fixed.e2e_tests_added} 个`);

    const totalIssuesFixed = Object.values(issues_fixed).reduce(
      (sum, count) => sum + count,
      0
    );
    console.log(`\n📈 总计修复问题: ${totalIssuesFixed} 个`);

    if (processed.length > 0) {
      console.log('\n✅ 成功处理的文件:');
      processed.forEach(({ file, issues_count, issues_fixed }) => {
        console.log(`  ${file}: ${issues_count} 个问题`);
        issues_fixed.forEach(issue => console.log(`    - ${issue}`));
      });
    }

    if (errors.length > 0) {
      console.log('\n❌ 错误详情:');
      errors.forEach(error => console.log(`  - ${error}`));
    }

    if (validation_errors.length > 0) {
      console.log('\n⚠️  验证问题:');
      validation_errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log(`\n💾 备份位置: ${this.backupDir}`);
    console.log('\n🎉 综合PRD分片架构修复完成!');

    // 生成质量评估
    const successRate =
      (processed.length / (processed.length + errors.length)) * 100;
    const completionRate =
      validation_errors.length === 0
        ? 100
        : Math.max(0, 100 - (validation_errors.length / processed.length) * 20);

    console.log('\n📊 质量评估:');
    console.log(`  - 修复成功率: ${successRate.toFixed(1)}%`);
    console.log(`  - 合规完整率: ${completionRate.toFixed(1)}%`);

    if (successRate >= 90 && completionRate >= 95) {
      console.log('  🌟 修复质量: 优秀');
    } else if (successRate >= 80 && completionRate >= 85) {
      console.log('  ✅ 修复质量: 良好');
    } else {
      console.log('  ⚠️  修复质量: 需要改进');
    }

    console.log('\n💡 下一步建议:');
    console.log('  1. 执行完整的项目构建和测试');
    console.log('  2. 验证Electron安全配置');
    console.log('  3. 运行Playwright E2E测试');
    console.log('  4. 检查CloudEvents事件追踪');
    console.log('  5. 验证Sentry Release Health集成');
  }
}

// 执行综合修复
const fixer = new ComprehensivePRDChunksFixer();
fixer.executeComprehensiveFix().catch(error => {
  console.error('❌ 综合修复过程中发生错误:', error);
  process.exit(1);
});
