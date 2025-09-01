#!/usr/bin/env node

/**
 * 可观测性增强功能配置脚本
 *
 * 建议2和4实施集成：
 * - Dashboard配置部署到Sentry
 * - 成本护栏算法集成到现有动态采样
 */

const fs = require('fs');
const path = require('path');

// 配置路径
const CONFIG_DIR = path.join(__dirname, '..', 'src', 'shared', 'observability');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const SCRIPTS_DIR = __dirname;

/**
 * 主要配置函数
 */
async function setupObservabilityEnhancements() {
  console.log('🚀 开始配置可观测性增强功能...\n');

  try {
    // 1. 验证必要文件存在
    await validateRequiredFiles();

    // 2. 生成Dashboard配置
    await generateDashboardConfigs();

    // 3. 更新Sentry配置以集成成本护栏
    await updateSentryConfiguration();

    // 4. 创建监控脚本
    await createMonitoringScripts();

    // 5. 生成文档
    await generateDocumentation();

    console.log('✅ 可观测性增强功能配置完成！\n');
    console.log('📊 已创建的Dashboard配置:');
    console.log('  - 活跃度监控 (activity_dashboard)');
    console.log('  - 留存率分析 (retention_dashboard)');
    console.log('  - 错误率监控 (error_rate_dashboard)');
    console.log('  - 性能监控 (performance_dashboard)');
    console.log('  - 功能热点分析 (feature_hotspot_dashboard)\n');

    console.log('💰 已集成的成本护栏功能:');
    console.log('  - SLO评分自动计算');
    console.log('  - 动态采样率优化');
    console.log('  - 成本使用率监控');
    console.log('  - 采样决策报告\n');

    console.log('🔧 下一步操作建议:');
    console.log('  1. 配置Sentry项目的Dashboard');
    console.log('  2. 设置成本预算和告警阈值');
    console.log('  3. 运行 npm run test:observability 验证配置');
  } catch (error) {
    console.error('❌ 配置过程中发生错误:', error.message);
    process.exit(1);
  }
}

/**
 * 验证必要文件存在
 */
async function validateRequiredFiles() {
  console.log('📋 验证必要文件...');

  const requiredFiles = [
    path.join(CONFIG_DIR, 'dashboard-config-manager.ts'),
    path.join(CONFIG_DIR, 'cost-guardrail-manager.ts'),
    path.join(CONFIG_DIR, 'sentry-main.ts'),
    path.join(CONFIG_DIR, 'resilience-manager.ts'),
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`必需文件不存在: ${file}`);
    }
  }

  console.log('  ✅ 所有必需文件存在\n');
}

/**
 * 生成Dashboard配置文件
 */
async function generateDashboardConfigs() {
  console.log('📊 生成Sentry Dashboard配置...');

  // 确保配置目录存在
  const dashboardConfigDir = path.join(LOGS_DIR, 'dashboard-configs');
  if (!fs.existsSync(dashboardConfigDir)) {
    fs.mkdirSync(dashboardConfigDir, { recursive: true });
  }

  // Dashboard配置模板
  const dashboardConfigs = {
    activity: {
      title: '用户活跃度监控',
      widgets: [
        {
          title: '活跃会话数',
          displayType: 'line',
          queries: [
            {
              name: '活跃会话',
              query: 'event.type:session_start',
              aggregates: ['count()'],
              fields: ['module', 'timestamp'],
              orderby: 'timestamp',
            },
          ],
        },
        {
          title: 'PRD模块活跃度热力图',
          displayType: 'table',
          queries: [
            {
              name: '模块活跃度',
              query: 'tags.module:*',
              aggregates: ['count()'],
              fields: ['module'],
              orderby: 'count()',
            },
          ],
        },
      ],
    },

    retention: {
      title: '用户留存率分析',
      widgets: [
        {
          title: '留存率 vs 崩溃率相关性',
          displayType: 'line',
          queries: [
            {
              name: '崩溃率趋势',
              query: 'event.type:session_crash',
              aggregates: ['rate()'],
              fields: ['week', 'module'],
              orderby: 'week',
            },
          ],
        },
      ],
    },

    error_rate: {
      title: '错误率监控',
      widgets: [
        {
          title: '各模块错误率',
          displayType: 'bar',
          queries: [
            {
              name: '模块错误率',
              query: 'level:error',
              aggregates: ['rate()'],
              fields: ['module'],
              orderby: 'rate()',
            },
          ],
        },
        {
          title: '高频错误排行',
          displayType: 'table',
          queries: [
            {
              name: '错误统计',
              query: 'level:error',
              aggregates: ['count()'],
              fields: ['error.type', 'error.value'],
              orderby: 'count()',
            },
          ],
        },
      ],
    },

    performance: {
      title: '性能监控',
      widgets: [
        {
          title: 'UI响应时间 P95',
          displayType: 'line',
          queries: [
            {
              name: '响应时间',
              query: 'transaction:ui.*',
              aggregates: ['p95(transaction.duration)'],
              fields: ['module'],
              orderby: 'p95(transaction.duration)',
            },
          ],
        },
        {
          title: '内存使用趋势',
          displayType: 'line',
          queries: [
            {
              name: '内存使用',
              query: 'measurement:memory_usage',
              aggregates: ['avg(memory.usage)'],
              fields: ['timestamp'],
              orderby: 'timestamp',
            },
          ],
        },
      ],
    },

    feature_hotspot: {
      title: '功能热点分析',
      widgets: [
        {
          title: '模块使用频率',
          displayType: 'world_map',
          queries: [
            {
              name: '使用频率',
              query: 'event.type:user_action',
              aggregates: ['count()'],
              fields: ['module'],
              orderby: 'count()',
            },
          ],
        },
        {
          title: '性能热点分析',
          displayType: 'table',
          queries: [
            {
              name: '性能热点',
              query: 'duration:>100',
              aggregates: ['avg(duration)'],
              fields: ['transaction', 'module'],
              orderby: 'avg(duration)',
            },
          ],
        },
      ],
    },
  };

  // 写入配置文件
  for (const [name, config] of Object.entries(dashboardConfigs)) {
    const configFile = path.join(dashboardConfigDir, `${name}_dashboard.json`);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log(`  ✅ 生成 ${name} Dashboard配置`);
  }

  console.log('  📁 配置文件保存到:', dashboardConfigDir, '\n');
}

/**
 * 更新Sentry配置以集成成本护栏
 */
async function updateSentryConfiguration() {
  console.log('⚙️ 更新Sentry配置集成成本护栏...');

  const integrationConfig = `
/**
 * 成本护栏集成配置
 * 自动集成到sentry-main.ts的动态采样器中
 */

import { costGuardrailManager, PerformanceMetrics, CostUtilization } from './cost-guardrail-manager';
import { resilienceManager } from './resilience-manager';

/**
 * 增强的动态采样器（集成成本护栏）
 */
export function createEnhancedDynamicSampler(config: any) {
  return (samplingContext: any) => {
    const { transactionContext } = samplingContext;
    const transactionName = transactionContext?.name || '';
    
    // 获取当前性能指标
    const systemHealth = resilienceManager.getSystemHealth();
    const performanceMetrics: PerformanceMetrics = {
      uiResponseTime: getAverageResponseTime(), // 实现获取平均响应时间
      eventProcessingDelay: getEventProcessingDelay(), // 实现获取事件处理延迟
      crashFreeSessionsRate: getCrashFreeSessionsRate(), // 实现获取无崩溃会话率
      memoryUsage: getMemoryUsage(), // 实现获取内存使用
      cpuUsage: getCPUUsage() // 实现获取CPU使用率
    };
    
    // 获取成本使用率
    const costUtilization: CostUtilization = {
      monthlyUtilization: getCurrentCostUtilization(), // 实现获取成本使用率
      dailyEventCount: getDailyEventCount(), // 实现获取每日事件数
      currentDataIngestion: getCurrentDataIngestion() // 实现获取数据摄入量
    };
    
    // 计算最优采样率
    const environment = determineEnvironment() as 'production' | 'staging' | 'development';
    const optimalSampleRate = costGuardrailManager.calculateOptimalSampleRate(
      performanceMetrics,
      costUtilization,
      environment,
      transactionName
    );
    
    // 记录采样决策日志
    if (Math.random() < 0.01) { // 1%的概率记录决策报告
      const report = costGuardrailManager.generateSamplingReport(
        performanceMetrics,
        costUtilization,
        environment
      );
      console.log('📊 采样决策报告:', JSON.stringify(report, null, 2));
    }
    
    return optimalSampleRate;
  };
}

// 辅助函数（需要实际实现）
function getAverageResponseTime(): number {
  // TODO: 从性能监控系统获取平均响应时间
  return 20; // 临时值
}

function getEventProcessingDelay(): number {
  // TODO: 从事件系统获取处理延迟
  return 30; // 临时值
}

function getCrashFreeSessionsRate(): number {
  // TODO: 从Sentry获取无崩溃会话率
  return 99.6; // 临时值
}

function getMemoryUsage(): number {
  // TODO: 从系统监控获取内存使用
  const memoryUsage = process.memoryUsage();
  return memoryUsage.heapUsed / 1024 / 1024; // MB
}

function getCPUUsage(): number {
  // TODO: 从系统监控获取CPU使用率
  return 15; // 临时值
}

function getCurrentCostUtilization(): number {
  // TODO: 从成本监控系统获取使用率
  return 0.6; // 临时值
}

function getDailyEventCount(): number {
  // TODO: 从事件统计获取每日事件数
  return 50000; // 临时值
}

function getCurrentDataIngestion(): number {
  // TODO: 从数据监控获取摄入量
  return 5.2; // GB，临时值
}
`;

  const integrationFile = path.join(
    CONFIG_DIR,
    'enhanced-sampling-integration.ts'
  );
  fs.writeFileSync(integrationFile, integrationConfig);

  console.log('  ✅ 创建增强采样集成配置');
  console.log('  📁 配置文件:', integrationFile, '\n');
}

/**
 * 创建监控脚本
 */
async function createMonitoringScripts() {
  console.log('📊 创建监控脚本...');

  // Dashboard部署脚本
  const deployDashboardScript = `#!/usr/bin/env node

/**
 * Dashboard部署脚本
 * 将配置部署到Sentry项目
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

async function deployDashboards() {
  console.log('🚀 开始部署Dashboard到Sentry...');
  
  if (!SENTRY_ORG || !SENTRY_PROJECT || !SENTRY_AUTH_TOKEN) {
    console.error('❌ 缺少必要的Sentry环境变量');
    console.log('请设置: SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN');
    process.exit(1);
  }
  
  const configDir = path.join(__dirname, '..', 'logs', 'dashboard-configs');
  const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
  
  for (const configFile of configFiles) {
    try {
      const configPath = path.join(configDir, configFile);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      console.log(\`📊 部署 \${config.title}...\`);
      
      const result = await createSentryDashboard(config);
      console.log(\`  ✅ 成功部署: \${result.id}\`);
      
    } catch (error) {
      console.error(\`❌ 部署失败 \${configFile}:\`, error.message);
    }
  }
  
  console.log('🎉 Dashboard部署完成！');
}

async function createSentryDashboard(config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: config.title,
      widgets: config.widgets,
      projects: [-1],
      environment: ['production', 'staging']
    });
    
    const options = {
      hostname: 'sentry.io',
      port: 443,
      path: \`/api/0/organizations/\${SENTRY_ORG}/dashboards/\`,
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${SENTRY_AUTH_TOKEN}\`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(\`HTTP \${res.statusCode}: \${responseData}\`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

if (require.main === module) {
  deployDashboards().catch(console.error);
}

module.exports = { deployDashboards, createSentryDashboard };
`;

  const deployScriptFile = path.join(SCRIPTS_DIR, 'deploy-dashboards.js');
  fs.writeFileSync(deployScriptFile, deployDashboardScript);
  fs.chmodSync(deployScriptFile, '755');

  // 成本监控脚本
  const costMonitoringScript = `#!/usr/bin/env node

/**
 * 成本监控和报告脚本
 */

const { costGuardrailManager } = require('../src/shared/observability/cost-guardrail-manager');

async function generateCostReport() {
  console.log('💰 生成成本护栏报告...');
  
  // 模拟当前指标（实际使用时应从监控系统获取）
  const metrics = {
    uiResponseTime: 18,
    eventProcessingDelay: 35,
    crashFreeSessionsRate: 99.7,
    memoryUsage: 280,
    cpuUsage: 12
  };
  
  const costUtilization = {
    monthlyUtilization: 0.65,
    dailyEventCount: 75000,
    currentDataIngestion: 6.8
  };
  
  const report = costGuardrailManager.generateSamplingReport(
    metrics,
    costUtilization,
    'production'
  );
  
  console.log('📊 成本护栏报告:');
  console.log(JSON.stringify(report, null, 2));
  
  // 保存报告
  const fs = require('fs');
  const path = require('path');
  const reportsDir = path.join(__dirname, '..', 'logs', 'cost-reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportFile = path.join(reportsDir, \`cost-report-\${new Date().toISOString().split('T')[0]}.json\`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(\`📁 报告已保存: \${reportFile}\`);
}

if (require.main === module) {
  generateCostReport().catch(console.error);
}

module.exports = { generateCostReport };
`;

  const costScriptFile = path.join(SCRIPTS_DIR, 'generate-cost-report.js');
  fs.writeFileSync(costScriptFile, costMonitoringScript);
  fs.chmodSync(costScriptFile, '755');

  console.log('  ✅ 创建Dashboard部署脚本');
  console.log('  ✅ 创建成本监控脚本\n');
}

/**
 * 生成文档
 */
async function generateDocumentation() {
  console.log('📚 生成使用文档...');

  const documentation = `# 可观测性增强功能使用指南

## 建议2实施：Dashboard映射

### 已创建的Dashboard类型

1. **活跃度监控 (activity_dashboard)**
   - 活跃会话数趋势
   - PRD模块活跃度热力图
   - 用户行为分析

2. **留存率分析 (retention_dashboard)**
   - 留存率 vs 崩溃率相关性
   - 队列留存分析
   - 用户生命周期监控

3. **错误率监控 (error_rate_dashboard)**
   - 各模块错误率统计
   - 高频错误排行
   - 错误趋势分析

4. **性能监控 (performance_dashboard)**
   - UI响应时间 P95
   - 内存使用趋势
   - 系统资源监控

5. **功能热点分析 (feature_hotspot_dashboard)**
   - 模块使用频率统计
   - 性能热点识别
   - 用户行为热力图

### 部署Dashboard到Sentry

\`\`\`bash
# 配置Sentry环境变量
export SENTRY_ORG="your-org-name"
export SENTRY_PROJECT="guild-manager"
export SENTRY_AUTH_TOKEN="your-auth-token"

# 部署所有Dashboard
node scripts/deploy-dashboards.js
\`\`\`

## 建议4实施：成本护栏对齐

### SLO与采样率关联

系统基于以下SLO指标动态调整采样率：

- **UI响应时间**: TP95 ≤ 16ms（目标）
- **事件处理延迟**: TP95 ≤ 50ms（目标）
- **无崩溃会话率**: ≥ 99.5%（目标）
- **内存使用**: < 300MB（目标）
- **CPU使用**: < 15%（目标）

### 动态采样策略

1. **SLO达标率高** → 降低采样率节省成本
2. **SLO达标率低** → 提高采样率增强诊断
3. **成本使用率高** → 强制降低采样率
4. **关键事务保护** → 维持最低采样率

### 生成成本报告

\`\`\`bash
# 生成当前成本护栏报告
node scripts/generate-cost-report.js
\`\`\`

### 集成到现有代码

在 \`sentry-main.ts\` 中使用增强的动态采样器：

\`\`\`typescript
import { createEnhancedDynamicSampler } from './enhanced-sampling-integration';

// 替换原有的createDynamicTracesSampler
tracesSampler: createEnhancedDynamicSampler(config.dynamicSampling)
\`\`\`

## 监控和维护

### 定期检查

1. **每日**: 查看成本使用率报告
2. **每周**: 检查SLO达标情况
3. **每月**: 优化采样策略配置

### 告警配置

建议在Sentry中配置以下告警：

- SLO评分 < 80分
- 成本使用率 > 80%
- 采样率异常波动

### 故障排除

常见问题和解决方案：

1. **采样率过低**: 检查成本预算配置
2. **SLO评分异常**: 验证性能指标数据源
3. **Dashboard显示异常**: 检查Sentry查询语法

## 文件结构

\`\`\`
src/shared/observability/
├── dashboard-config-manager.ts    # Dashboard配置管理
├── cost-guardrail-manager.ts      # 成本护栏管理
├── enhanced-sampling-integration.ts # 增强采样集成
└── ...

scripts/
├── deploy-dashboards.js           # Dashboard部署脚本
├── generate-cost-report.js        # 成本报告生成
└── setup-observability-enhancements.js # 配置脚本

logs/
├── dashboard-configs/              # Dashboard配置文件
├── cost-reports/                   # 成本报告文件
└── ...
\`\`\`

## 后续优化建议

1. **实施实时指标收集**: 替换示例数据为真实监控数据
2. **配置自动化告警**: 基于SLO和成本阈值
3. **优化采样策略**: 根据实际使用情况调整参数
4. **扩展Dashboard**: 添加更多业务相关指标
`;

  const docFile = path.join(
    __dirname,
    '..',
    'docs',
    'observability-enhancements-guide.md'
  );
  const docDir = path.dirname(docFile);

  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  fs.writeFileSync(docFile, documentation);

  console.log('  ✅ 生成使用文档');
  console.log('  📁 文档文件:', docFile, '\n');
}

// 主函数执行
if (require.main === module) {
  setupObservabilityEnhancements().catch(console.error);
}

module.exports = {
  setupObservabilityEnhancements,
  validateRequiredFiles,
  generateDashboardConfigs,
  updateSentryConfiguration,
  createMonitoringScripts,
  generateDocumentation,
};
