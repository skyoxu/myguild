#!/usr/bin/env node
/**
 * CSP策略自动验证脚本
 * 验证ADR-0002中定义的内容安全策略是否符合安全基线
 * 防止'unsafe-inline'等不安全指令意外重新引入
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CSP安全基线配置
const SECURITY_BASELINE = {
  // 禁止的不安全指令
  FORBIDDEN_DIRECTIVES: [
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'unsafe-hashes'",
    "'unsafe-allow-redirects'",
  ],

  // 必需的安全指令
  REQUIRED_DIRECTIVES: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  },

  // 推荐的额外指令
  RECOMMENDED_DIRECTIVES: ['img-src', 'font-src', 'connect-src'],
};

/**
 * 解析CSP策略字符串
 */
function parseCSP(cspString) {
  const directives = {};
  const parts = cspString
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [directive, ...sources] = part.split(/\s+/);
    if (directive) {
      directives[directive] = sources.map(s => s.trim()).filter(Boolean);
    }
  }

  return directives;
}

/**
 * 验证CSP策略安全性
 */
function validateCSPSecurity(cspDirectives) {
  const issues = [];
  const warnings = [];

  // 检查禁止的不安全指令
  for (const [directive, sources] of Object.entries(cspDirectives)) {
    for (const forbidden of SECURITY_BASELINE.FORBIDDEN_DIRECTIVES) {
      if (sources.includes(forbidden)) {
        issues.push({
          severity: 'CRITICAL',
          type: 'UNSAFE_DIRECTIVE',
          directive,
          value: forbidden,
          message: `发现不安全的CSP指令: ${directive} ${forbidden}`,
        });
      }
    }

    // 检查connect-src的协议通配符使用（新增安全检查）
    if (directive === 'connect-src') {
      const protocolWildcards = sources.filter(
        source =>
          source === 'ws:' ||
          source === 'wss:' ||
          source === 'http:' ||
          source === 'https:'
      );

      if (protocolWildcards.length > 0) {
        issues.push({
          severity: 'CRITICAL',
          type: 'PROTOCOL_WILDCARD',
          directive,
          value: protocolWildcards.join(' '),
          message: `connect-src 使用协议通配符过于宽松: ${protocolWildcards.join(' ')}，应使用精确白名单`,
        });
      }
    }
  }

  // 检查必需的安全指令
  for (const [requiredDirective, expectedSources] of Object.entries(
    SECURITY_BASELINE.REQUIRED_DIRECTIVES
  )) {
    if (!cspDirectives[requiredDirective]) {
      issues.push({
        severity: 'HIGH',
        type: 'MISSING_DIRECTIVE',
        directive: requiredDirective,
        message: `缺失必需的CSP指令: ${requiredDirective}`,
      });
    } else {
      // 验证指令值是否符合安全基线
      const actualSources = cspDirectives[requiredDirective];
      for (const expectedSource of expectedSources) {
        if (!actualSources.includes(expectedSource)) {
          warnings.push({
            severity: 'MEDIUM',
            type: 'DIRECTIVE_MISMATCH',
            directive: requiredDirective,
            expected: expectedSource,
            actual: actualSources.join(' '),
            message: `CSP指令 ${requiredDirective} 可能需要包含 ${expectedSource}`,
          });
        }
      }
    }
  }

  // 检查推荐的额外指令
  for (const recommended of SECURITY_BASELINE.RECOMMENDED_DIRECTIVES) {
    if (!cspDirectives[recommended]) {
      warnings.push({
        severity: 'LOW',
        type: 'MISSING_RECOMMENDED',
        directive: recommended,
        message: `建议添加CSP指令: ${recommended}`,
      });
    }
  }

  return { issues, warnings };
}

/**
 * 从ADR文档中提取CSP策略
 */
async function extractCSPFromADR() {
  try {
    const adrPath = join(
      __dirname,
      '..',
      'docs',
      'adr',
      'ADR-0002-electron-security.md'
    );
    const content = await readFile(adrPath, 'utf-8');

    // 查找CSP策略代码块
    const cspMatch = content.match(
      /Content-Security-Policy[^>]*content="([^"]+)"/
    );
    if (!cspMatch) {
      throw new Error('未在ADR-0002中找到CSP策略定义');
    }

    return cspMatch[1].replace(/\s+/g, ' ').trim();
  } catch (error) {
    throw new Error(`读取ADR文档失败: ${error.message}`);
  }
}

/**
 * 从HTML文件中提取CSP策略
 */
async function extractCSPFromHTML() {
  const policies = [];
  const htmlFiles = ['index.html']; // 可扩展更多HTML文件

  for (const htmlFile of htmlFiles) {
    try {
      const htmlPath = join(__dirname, '..', htmlFile);
      const content = await readFile(htmlPath, 'utf-8');

      // 查找CSP meta标签
      const cspMatches = content.matchAll(
        /Content-Security-Policy[^>]*content="([^"]+)"/gi
      );
      for (const match of cspMatches) {
        policies.push({
          file: htmlFile,
          policy: match[1].replace(/\s+/g, ' ').trim(),
        });
      }
    } catch (error) {
      console.warn(`警告: 无法读取HTML文件 ${htmlFile}: ${error.message}`);
    }
  }

  return policies;
}

/**
 * 从实现文档中提取CSP策略（TypeScript代码）
 */
async function extractCSPFromImplementation() {
  const policies = [];
  const implementationFiles = [
    'docs/architecture/base/02-security-baseline-electron-v2.md',
  ];

  for (const implFile of implementationFiles) {
    try {
      const implPath = join(__dirname, '..', implFile);
      const content = await readFile(implPath, 'utf-8');

      // 查找开发环境CSP配置
      const devCspMatch = content.match(
        /if\s*\(env\s*===\s*'development'\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\]\.join\(/
      );
      if (devCspMatch) {
        const cspArrayContent = devCspMatch[1];
        // 提取所有CSP指令，包括模板字符串和普通字符串
        const cspStrings = [];

        // 匹配普通字符串
        const normalStrings = cspArrayContent.match(/"[^"]+"/g) || [];
        cspStrings.push(...normalStrings.map(s => s.replace(/"/g, '')));

        // 匹配模板字符串（如 `style-src 'self' 'nonce-${nonce}' localhost:* 127.0.0.1:*`）
        const templateStrings = cspArrayContent.match(/`[^`]+`/g) || [];
        cspStrings.push(
          ...templateStrings.map(s =>
            s.replace(/`/g, '').replace(/\${[^}]+}/g, 'NONCE_PLACEHOLDER')
          )
        );

        // 处理commonCsp展开
        if (cspArrayContent.includes('...commonCsp')) {
          cspStrings.unshift(
            "default-src 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            'upgrade-insecure-requests'
          );
        }

        const policy = cspStrings.join('; ');

        policies.push({
          file: implFile,
          policy: policy,
          environment: 'development',
        });
      }

      // 查找生产环境CSP配置
      const prodCspMatch = content.match(
        /const\s+productionCsp\s*=\s*\[([\s\S]*?)\]\.join\(/
      );
      if (prodCspMatch) {
        const cspArray = prodCspMatch[1];
        const cspStrings = [];

        // 处理...commonCsp展开（包含核心安全指令）
        if (cspArray.includes('...commonCsp')) {
          cspStrings.push(
            "default-src 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            'upgrade-insecure-requests'
          );
        }

        // 提取字符串字面量
        const literals = cspArray.match(/"[^"]+"/g) || [];
        cspStrings.push(...literals.map(s => s.replace(/"/g, '')));

        // 处理模板字符串（如script-src, style-src动态构建）
        const templateStrings = cspArray.match(/`[^`]+`/g) || [];
        cspStrings.push(
          ...templateStrings.map(s =>
            s.replace(/`/g, '').replace(/\${[^}]+}/g, 'PLACEHOLDER')
          )
        );

        const policy = cspStrings.join('; ');

        policies.push({
          file: implFile,
          policy: policy,
          environment: 'production',
        });
      }
    } catch (error) {
      console.warn(`警告: 无法读取实现文件 ${implFile}: ${error.message}`);
    }
  }

  return policies;
}

/**
 * 生成验证报告
 */
function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_policies: results.length,
      critical_issues: 0,
      high_issues: 0,
      medium_warnings: 0,
      low_warnings: 0,
    },
    details: results,
  };

  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.severity === 'CRITICAL') report.summary.critical_issues++;
      else if (issue.severity === 'HIGH') report.summary.high_issues++;
    }
    for (const warning of result.warnings) {
      if (warning.severity === 'MEDIUM') report.summary.medium_warnings++;
      else if (warning.severity === 'LOW') report.summary.low_warnings++;
    }
  }

  return report;
}

/**
 * 主验证函数
 */
async function main() {
  console.log('🔒 开始CSP策略安全验证...\n');

  const results = [];

  try {
    // 验证ADR文档中的CSP策略
    console.log('📋 验证ADR-0002中的CSP策略...');
    const adrCSP = await extractCSPFromADR();
    const adrDirectives = parseCSP(adrCSP);
    const adrValidation = validateCSPSecurity(adrDirectives);

    results.push({
      source: 'ADR-0002-electron-security.md',
      policy: adrCSP,
      directives: adrDirectives,
      ...adrValidation,
    });

    // 验证HTML文件中的CSP策略
    console.log('🌐 验证HTML文件中的CSP策略...');
    const htmlPolicies = await extractCSPFromHTML();

    for (const { file, policy } of htmlPolicies) {
      const directives = parseCSP(policy);
      const validation = validateCSPSecurity(directives);

      results.push({
        source: file,
        policy: policy,
        directives: directives,
        ...validation,
      });
    }

    // 验证实现文档中的CSP策略（新增）
    console.log('🔧 验证实现文档中的CSP策略...');
    const implPolicies = await extractCSPFromImplementation();

    for (const { file, policy, environment } of implPolicies) {
      const directives = parseCSP(policy);
      const validation = validateCSPSecurity(directives);

      results.push({
        source: `${file} (${environment})`,
        policy: policy,
        directives: directives,
        ...validation,
      });
    }

    // 生成验证报告
    const report = generateReport(results);

    // 输出结果
    console.log('📊 CSP安全验证报告');
    console.log('='.repeat(50));
    console.log(`验证时间: ${report.timestamp}`);
    console.log(`策略总数: ${report.summary.total_policies}`);
    console.log(`🔴 严重问题: ${report.summary.critical_issues}`);
    console.log(`🟠 高风险问题: ${report.summary.high_issues}`);
    console.log(`🟡 中风险警告: ${report.summary.medium_warnings}`);
    console.log(`🟢 低风险建议: ${report.summary.low_warnings}\n`);

    // 详细问题报告
    let hasIssues = false;

    for (const result of results) {
      if (result.issues.length > 0 || result.warnings.length > 0) {
        console.log(`📄 ${result.source}:`);
        console.log(`   策略: ${result.policy}`);

        for (const issue of result.issues) {
          hasIssues = true;
          const icon = issue.severity === 'CRITICAL' ? '🔴' : '🟠';
          console.log(`   ${icon} [${issue.severity}] ${issue.message}`);
        }

        for (const warning of result.warnings) {
          const icon = warning.severity === 'MEDIUM' ? '🟡' : '🟢';
          console.log(`   ${icon} [${warning.severity}] ${warning.message}`);
        }

        console.log();
      }
    }

    if (!hasIssues) {
      console.log('✅ 所有CSP策略均符合安全基线要求！');
    }

    // 写入JSON报告文件
    const reportPath = join(
      __dirname,
      '..',
      'logs',
      'csp-security-report.json'
    );
    await import('fs/promises').then(fs =>
      fs
        .mkdir(join(__dirname, '..', 'logs'), { recursive: true })
        .then(() => fs.writeFile(reportPath, JSON.stringify(report, null, 2)))
    );

    console.log(`\n📁 详细报告已保存到: ${reportPath}`);

    // 根据问题严重程度设置退出码
    if (report.summary.critical_issues > 0) {
      console.error('\n❌ 发现严重安全问题，构建应该失败');
      process.exit(1);
    } else if (report.summary.high_issues > 0) {
      console.warn('\n⚠️  发现高风险问题，建议修复后再部署');
      process.exit(1);
    } else {
      console.log('\n✅ CSP安全验证通过');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ CSP验证失败:', error.message);
    process.exit(1);
  }
}

// 只有直接运行此脚本时才执行主函数
if (process.argv[1] && process.argv[1].endsWith('verify_csp_policy.mjs')) {
  main().catch(console.error);
}

export {
  parseCSP,
  validateCSPSecurity,
  extractCSPFromADR,
  extractCSPFromHTML,
  extractCSPFromImplementation,
};
