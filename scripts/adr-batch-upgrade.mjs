/**
 * ADR批量升级工具
 * 自动为旧格式的ADR添加标准化Front-Matter
 * 基于ADR-0002/0003/0004/0005的模板模式
 */
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';

// ADR模板映射
const ADR_TEMPLATES = {
  'ADR-0006': {
    title: 'SQLite数据存储策略 - WAL模式与性能优化',
    'tech-tags': ['sqlite', 'wal', 'database', 'performance', 'storage'],
    'impact-scope': [
      'src/shared/db/',
      'electron/db/',
      'scripts/db-migration.mjs',
    ],
    'executable-deliverables': [
      'src/main/db/init.ts',
      'scripts/db-checkpoint.mjs',
      'tests/unit/db/sqlite-wal.spec.ts',
    ],
  },
  'ADR-0007': {
    title: '端口适配器架构 - 六边形架构模式',
    'tech-tags': [
      'hexagonal-architecture',
      'ports-adapters',
      'dependency-injection',
      'interfaces',
    ],
    'impact-scope': [
      'src/ports/',
      'src/adapters/',
      'src/domain/',
      'src/shared/contracts/',
    ],
    'executable-deliverables': [
      'src/ports/GameEnginePort.ts',
      'src/adapters/PhaserGameAdapter.ts',
      'tests/unit/architecture/ports-adapters.spec.ts',
    ],
  },
  'ADR-0008': {
    title: '部署与发布策略 - Electron Builder + GitHub Releases',
    'tech-tags': [
      'electron-builder',
      'github-releases',
      'deployment',
      'ci-cd',
      'auto-update',
    ],
    'impact-scope': [
      'build/',
      'electron-builder.json',
      '.github/workflows/',
      'scripts/release.mjs',
    ],
    'executable-deliverables': [
      'electron-builder.json',
      '.github/workflows/release.yml',
      'scripts/release-automation.mjs',
    ],
  },
  'ADR-0009': {
    title: '跨平台兼容策略 - Windows/macOS/Linux统一',
    'tech-tags': [
      'cross-platform',
      'windows',
      'macos',
      'linux',
      'compatibility',
    ],
    'impact-scope': ['electron/', 'scripts/platform/', 'tests/e2e/platform/'],
    'executable-deliverables': [
      'scripts/platform-detection.mjs',
      'electron/platform-specific.ts',
      'tests/e2e/platform/cross-platform.spec.ts',
    ],
  },
  'ADR-0010': {
    title: '国际化策略 - i18next + 动态语言切换',
    'tech-tags': ['i18n', 'i18next', 'localization', 'internationalization'],
    'impact-scope': ['src/i18n/', 'locales/', 'src/components/'],
    'executable-deliverables': [
      'src/i18n/config.ts',
      'locales/en/translation.json',
      'tests/unit/i18n/translation.spec.ts',
    ],
  },
};

/**
 * 从现有ADR内容中提取基本信息
 */
function extractADRInfo(content, _adrId) {
  const lines = content.split('\n');
  let title = '';
  let status = 'Accepted';
  let decisionTime = '2025-08-17';
  let deciders = ['架构团队'];

  // 提取标题
  const titleLine = lines.find(line => line.startsWith('# ADR-'));
  if (titleLine) {
    title = titleLine.replace(/^# ADR-\d+:\s*/, '').trim();
  }

  // 提取状态和日期
  for (const line of lines) {
    if (line.includes('* Status:') || line.includes('Status:')) {
      const match = line.match(/Status:\s*(.+)/);
      if (match) status = match[1].trim();
    }
    if (line.includes('* Date:') || line.includes('Date:')) {
      const match = line.match(/Date:\s*(.+)/);
      if (match) decisionTime = match[1].trim();
    }
    if (line.includes('* Deciders:') || line.includes('Deciders:')) {
      const match = line.match(/Deciders:\s*(.+)/);
      if (match) {
        try {
          deciders = JSON.parse(match[1].trim());
        } catch {
          deciders = [match[1].trim()];
        }
      }
    }
  }

  return { title, status, decisionTime, deciders };
}

/**
 * 生成标准化Front-Matter
 */
function generateFrontMatter(adrId, extractedInfo, template) {
  const depends = [];
  const depended = [];

  // 基于ADR序号推断依赖关系
  const adrNum = parseInt(adrId.replace('ADR-', ''));

  if (adrNum >= 2) {
    if (adrId === 'ADR-0002' || adrId === 'ADR-0005') {
      depends.push('ADR-0001'); // 技术栈依赖
    }
    if (adrId === 'ADR-0005') {
      depends.push('ADR-0002', 'ADR-0003'); // 质量门禁依赖安全和监控
    }
    if (adrId === 'ADR-0008') {
      depends.push('ADR-0005'); // 部署依赖质量门禁
    }
  }

  return {
    'ADR-ID': adrId,
    title: template.title || extractedInfo.title,
    status: extractedInfo.status,
    'decision-time': `"${extractedInfo.decisionTime}"`,
    deciders: extractedInfo.deciders,
    'impact-scope': template['impact-scope'],
    'tech-tags': template['tech-tags'],
    'depends-on': depends,
    'depended-by': depended,
    'test-coverage': `tests/unit/${adrId.toLowerCase()}.spec.ts`,
    'monitoring-metrics': ['implementation_coverage', 'compliance_rate'],
    'executable-deliverables': template['executable-deliverables'],
    supersedes: [],
  };
}

/**
 * 升级单个ADR文件
 */
function upgradeADR(filePath) {
  console.log(`📝 升级 ${filePath}...`);

  const content = readFileSync(filePath, 'utf8');
  const { data: existingFrontMatter } = matter(content);

  // 如果已经有ADR-ID，跳过
  if (existingFrontMatter['ADR-ID']) {
    console.log(`   ⏭️ 已有Front-Matter，跳过`);
    return false;
  }

  // 提取ADR-ID
  const adrMatch = filePath.match(/ADR-(\d{4})/);
  if (!adrMatch) {
    console.log(`   ❌ 无法提取ADR-ID`);
    return false;
  }

  const adrId = `ADR-${adrMatch[1]}`;
  const template = ADR_TEMPLATES[adrId];

  if (!template) {
    console.log(`   ❌ 没有找到 ${adrId} 的模板`);
    return false;
  }

  // 提取现有信息
  const extractedInfo = extractADRInfo(content, adrId);

  // 生成Front-Matter
  const frontMatter = generateFrontMatter(adrId, extractedInfo, template);

  // 移除旧的标题行和旧的元数据
  let cleanContent = content;

  // 移除旧的元数据行（* Status:, * Date: 等）
  const metadataLines = [
    /^\* Status:/,
    /^\* Date:/,
    /^\* Deciders:/,
    /^\* Tags:/,
  ];

  const lines = cleanContent.split('\n');
  const filteredLines = lines.filter(line => {
    return !metadataLines.some(pattern => pattern.test(line.trim()));
  });

  cleanContent = filteredLines.join('\n');

  // 构建新内容
  const frontMatterYaml = Object.entries(frontMatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return `${key}: []`;
        }
        return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
      } else {
        return `${key}: ${value}`;
      }
    })
    .join('\n');

  const newContent = `---
${frontMatterYaml}
---

${cleanContent.trim()}`;

  // 写入文件
  writeFileSync(filePath, newContent, 'utf8');
  console.log(`   ✅ 升级完成`);

  return true;
}

/**
 * 批量升级ADR文件
 */
async function batchUpgradeADRs(pattern = 'docs/adr/ADR-*.md') {
  console.log('🚀 ADR批量升级工具');
  console.log('='.repeat(50));

  const files = await glob(pattern);
  let upgraded = 0;
  let skipped = 0;

  console.log(`📂 找到 ${files.length} 个ADR文件`);

  for (const file of files) {
    if (upgradeADR(file)) {
      upgraded++;
    } else {
      skipped++;
    }
  }

  console.log('\n📊 升级统计:');
  console.log(`✅ 已升级: ${upgraded} 个`);
  console.log(`⏭️ 已跳过: ${skipped} 个`);
  console.log(`📝 总计: ${files.length} 个`);

  if (upgraded > 0) {
    console.log('\n🔍 建议运行验证:');
    console.log('   node scripts/adr-fm-validator.mjs');
  }

  console.log('\n✨ 批量升级完成！');
}

// CLI入口
if (process.argv[1] && process.argv[1].endsWith('adr-batch-upgrade.mjs')) {
  const pattern = process.argv[2] || 'docs/adr/ADR-*.md';
  batchUpgradeADRs(pattern).catch(console.error);
}
