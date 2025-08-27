# Claude Code CLI 自动化执行指南

> 本指南说明如何使用 Claude Code CLI 执行文档生成、测试、构建、监控等自动化流程

---

## 📋 快速参考

### 核心自动化命令
```bash
# 完整质量检查链
npm run guard:ci

# 文档生成与更新
node scripts/update-changelog.mjs --add "新功能描述"

# 本地开发环境启动
npm run dev && npm run dev:electron
```

---

## 🤖 Claude Code CLI 集成方式

### 1. BMAD Slash Commands (交互式)

#### 可用的BMAD代理命令
```bash
# 核心代理
/bmad-master          # 主控代理，万能任务执行器
/architect             # 软件架构师代理
/dev                   # 开发工程师代理
/qa                    # 质量保证代理

# 游戏开发专用
/game-designer         # 游戏设计师代理（Phaser专用）
/game-developer        # 游戏开发者代理
/game-architect        # 游戏架构师代理（Unity专用）
```

#### BMAD工作流示例
```bash
# 1. 启动架构师代理
/architect

# 2. 使用内部命令
*help                  # 显示可用命令
*create-doc            # 创建文档模板
*task                  # 执行预定义任务
*execute-checklist     # 执行检查清单
*exit                  # 退出代理模式

# 3. 创建架构文档
*create-doc architecture-tmpl.yaml
*execute-checklist architect-checklist.md
```

#### 游戏开发工作流
```bash
# 游戏设计师代理
/game-designer
*help
*create-doc game-design-tmpl.yaml
*task create-game-module

# 游戏开发者代理
/game-developer  
*task create-phaser-scene
*execute-checklist game-dev-checklist.md
```

### 2. NPM Scripts (脚本化)

#### 开发环境自动化
```bash
# 启动开发环境
npm run dev                    # Vite开发服务器
npm run dev:electron           # Electron应用

# 代码检查
npm run typecheck             # TypeScript类型检查
npm run lint                  # ESLint代码规范
npm run test:unit             # 单元测试
npm run test:e2e              # E2E测试
```

#### 质量门禁自动化
```bash
# 完整质量检查链
npm run guard:ci

# 分项质量检查
npm run guard:electron         # Electron安全检查
npm run guard:quality          # 覆盖率+Release Health
npm run guard:base             # Base文档清洁检查
npm run guard:version          # 版本同步检查
```

#### 构建与发布自动化
```bash
# 构建
npm run build                  # 生产构建
npm run build:electron         # Electron应用打包

# 安全扫描
npm run security:scan          # Electron安全扫描
npm run security:audit         # 依赖安全审计
```

---

## 🔧 本地开发环境 Mock 服务

### 1. Sentry Mock 服务

#### 快速启动 Sentry Mock
```bash
# 启动 Node.js Mock 服务
npm run sentry:mock

# 验证 Mock 服务状态
npm run sentry:mock:test

# 查看 Mock 数据
curl http://localhost:9000/api/0/projects/test/releases/latest/
```

#### Sentry Mock 配置
创建 `scripts/sentry-mock-server.mjs`：
```javascript
#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 9000;

app.use(cors());
app.use(express.json());

// Mock Release Health API
app.get('/api/0/projects/:org/:project/releases/:version/', (req, res) => {
  res.json({
    version: req.params.version,
    healthData: {
      crashFreeSessionsRate: 99.8,
      crashFreeUsersRate: 99.7,
      adoptionRate: 85.2
    },
    created: new Date().toISOString()
  });
});

// Mock Error Tracking
app.post('/api/0/projects/:org/:project/events/', (req, res) => {
  console.log('📊 Sentry Event:', req.body.message || 'Unknown event');
  res.json({ id: 'mock-event-' + Date.now() });
});

app.listen(PORT, () => {
  console.log(`🔍 Sentry Mock Server running on http://localhost:${PORT}`);
  console.log('📊 Available endpoints:');
  console.log('  - GET /api/0/projects/test/test/releases/latest/');
  console.log('  - POST /api/0/projects/test/test/events/');
});
```

#### 环境变量配置
在开发环境 `.env.local` 中：
```bash
# Sentry Mock 配置
SENTRY_DSN=http://mock@localhost:9000/1
SENTRY_ENVIRONMENT=development
SENTRY_MOCK_MODE=true

# 本地Release Health Mock
RELEASE_HEALTH_MOCK=true
CRASH_FREE_SESSIONS_THRESHOLD=99.0
CRASH_FREE_USERS_THRESHOLD=98.5
```

#### Docker 可选方案
如需完整 Sentry 环境：
```bash
# 创建 docker-compose.sentry.yml
version: '3.8'
services:
  redis:
    image: redis:alpine
  postgres:
    image: postgres:13
    environment:
      POSTGRES_HOST_AUTH_METHOD: trust
  sentry:
    image: getsentry/sentry:latest
    depends_on:
      - redis
      - postgres
    ports:
      - "9000:9000"
    environment:
      SENTRY_SECRET_KEY: 'mock-secret-key'
```

```bash
# 启动完整 Sentry Mock
docker-compose -f docker-compose.sentry.yml up -d

# 停止服务
docker-compose -f docker-compose.sentry.yml down
```

### 2. 性能测试环境

#### 本地性能测试套件
扩展现有 `scripts/benchmarks/` 目录：

**启动时间测试**
```bash
# 测试 Electron 启动时间
npm run perf:startup

# 实现: scripts/benchmarks/startup-time.ts
export async function measureStartupTime() {
  const startTime = process.hrtime.bigint();
  
  // 启动 Electron 应用
  const electronProcess = spawn('electron', ['.']);
  
  return new Promise((resolve) => {
    electronProcess.stdout.on('data', (data) => {
      if (data.includes('App Ready')) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // ms
        resolve(duration);
      }
    });
  });
}
```

**内存使用监控**
```bash
# 持续监控内存使用
npm run perf:memory

# 实现: scripts/benchmarks/memory-usage.ts  
export async function monitorMemoryUsage(durationMs = 60000) {
  const measurements = [];
  const startTime = Date.now();
  
  const interval = setInterval(() => {
    const usage = process.memoryUsage();
    measurements.push({
      timestamp: Date.now() - startTime,
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024,
      external: usage.external / 1024 / 1024
    });
  }, 1000);
  
  setTimeout(() => {
    clearInterval(interval);
    analyzeMemoryTrend(measurements);
  }, durationMs);
}
```

**渲染性能测试**
```bash
# 测试游戏渲染帧率
npm run perf:rendering

# 实现: scripts/benchmarks/rendering-fps.ts
export async function measureRenderingFPS(sceneCount = 5) {
  const fpsData = [];
  
  // 模拟不同场景的渲染测试
  for (let i = 0; i < sceneCount; i++) {
    const fps = await measureSceneFPS(`test-scene-${i}`);
    fpsData.push({
      scene: `test-scene-${i}`,
      avgFPS: fps.average,
      minFPS: fps.minimum,
      maxFPS: fps.maximum
    });
  }
  
  return fpsData;
}
```

#### 性能基准集成
将性能测试集成到质量门禁：
```bash
# 在 scripts/quality_gates.mjs 中添加性能检查
async function checkPerformanceGates() {
  console.log('⚡ 检查性能基准...');
  
  const startupTime = await measureStartupTime();
  const memoryUsage = await measurePeakMemoryUsage();
  const renderingFPS = await measureAverageRenderingFPS();
  
  const failed = [];
  
  if (startupTime > 3000) { // 3秒阈值
    failed.push(`启动时间 ${startupTime}ms > 3000ms`);
  }
  
  if (memoryUsage > 200) { // 200MB阈值
    failed.push(`内存使用 ${memoryUsage}MB > 200MB`);
  }
  
  if (renderingFPS < 55) { // 55 FPS阈值
    failed.push(`渲染帧率 ${renderingFPS} FPS < 55 FPS`);
  }
  
  if (failed.length > 0) {
    throw new Error(`性能基准失败:\n${failed.map(f => `  - ${f}`).join('\n')}`);
  }
  
  console.log('✅ 性能基准检查通过！');
  return { startupTime, memoryUsage, renderingFPS };
}
```

---

## 🚪 CI门禁阻断机制

### 1. 质量门禁阈值配置

#### 环境变量配置
```bash
# 覆盖率阈值
COVERAGE_LINES_THRESHOLD=90
COVERAGE_BRANCHES_THRESHOLD=85
COVERAGE_FUNCTIONS_THRESHOLD=90
COVERAGE_STATEMENTS_THRESHOLD=90

# Release Health 阈值
CRASH_FREE_SESSIONS_THRESHOLD=99.5
CRASH_FREE_USERS_THRESHOLD=99.0
ADOPTION_RATE_THRESHOLD=80.0

# 性能阈值
STARTUP_TIME_THRESHOLD=3000        # 毫秒
MEMORY_USAGE_THRESHOLD=200         # MB
RENDERING_FPS_THRESHOLD=55         # FPS
```

#### 门禁配置文件
创建 `.quality-gates.config.json`：
```json
{
  "gates": {
    "coverage": {
      "lines": 90,
      "branches": 85,
      "functions": 90,
      "statements": 90,
      "enforceIncrease": false
    },
    "releaseHealth": {
      "crashFreeSessionsThreshold": 99.5,
      "crashFreeUsersThreshold": 99.0,
      "adoptionRateThreshold": 80.0
    },
    "performance": {
      "startupTimeMs": 3000,
      "memoryUsageMB": 200,
      "renderingFPS": 55
    },
    "security": {
      "allowHighVulnerabilities": 0,
      "allowMediumVulnerabilities": 2
    }
  },
  "notifications": {
    "onFailure": ["console", "file"],
    "reportPath": "logs/quality-gates/"
  }
}
```

### 2. 门禁失败处理流程

#### 自动修复建议
```bash
# 当门禁失败时，提供自动修复建议
npm run guard:diagnose

# 实现: scripts/gate-diagnostics.mjs
function provideDiagnosticSuggestions(failures) {
  const suggestions = {
    'coverage-low': [
      '1. 运行 npm run test:coverage:open 查看详细报告',
      '2. 识别未覆盖的关键代码路径',
      '3. 添加单元测试或E2E测试',
      '4. 考虑移除无用的死代码'
    ],
    'performance-slow': [
      '1. 运行 npm run perf:profile 生成性能分析',
      '2. 检查是否有内存泄漏',
      '3. 优化启动时的同步操作',
      '4. 考虑延迟加载非关键模块'
    ],
    'security-vulnerabilities': [
      '1. 运行 npm audit fix 自动修复',
      '2. 查看 npm audit 详细报告',
      '3. 评估是否可以升级依赖版本',
      '4. 考虑寻找替代依赖库'
    ]
  };
  
  return suggestions;
}
```

#### CI环境门禁阻断
GitHub Actions 集成：
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates
on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Quality Gates
        run: npm run guard:ci
        env:
          # 在CI环境中使用更严格的阈值
          COVERAGE_LINES_THRESHOLD: 92
          CRASH_FREE_SESSIONS_THRESHOLD: 99.7
          
      - name: Upload Quality Report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: quality-gates-report
          path: logs/quality/
          
      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const reportPath = 'logs/quality/quality-gates-latest.json';
            
            if (fs.existsSync(reportPath)) {
              const report = JSON.parse(fs.readFileSync(reportPath));
              
              const body = `
              ## 🚪 质量门禁报告
              
              **总检查项**: ${report.summary.totalChecks}
              **通过检查**: ${report.summary.passedChecks}
              **失败检查**: ${report.summary.failedChecks}
              
              ${report.summary.failedChecks > 0 ? '❌ **质量门禁未通过，请修复后重新提交**' : '✅ **质量门禁检查通过**'}
              `;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: body
              });
            }
```

### 3. 发布阻断策略

#### 分支保护规则
```bash
# 通过脚本配置GitHub分支保护
node scripts/setup-branch-protection.mjs

# 实现: 要求所有质量门禁通过才能合并
const protectionRules = {
  required_status_checks: {
    strict: true,
    checks: [
      { context: "quality-gates" },
      { context: "security-scan" },
      { context: "performance-test" }
    ]
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    dismiss_stale_reviews: true
  },
  restrictions: null
};
```

#### 发布门禁检查
```bash
# 发布前最终检查
npm run release:preflight

# 实现: scripts/release-preflight.mjs
async function releasePreflightCheck() {
  console.log('🚁 开始发布预检...');
  
  // 1. 确保在正确分支
  await verifyBranch('main');
  
  // 2. 确保工作区清洁
  await verifyCleanWorkingDirectory();
  
  // 3. 运行完整质量门禁
  await runQualityGates();
  
  // 4. 验证版本号合规性
  await verifyVersionCompliance();
  
  // 5. 检查发布健康指标
  await verifyReleaseHealthMetrics();
  
  console.log('✅ 发布预检通过，可以安全发布！');
}
```

---

## 📚 文档生成自动化

### 1. 自动化文档生成
```bash
# 生成架构文档
/architect
*create-doc architecture-tmpl.yaml
*task update-architecture-docs

# 生成API文档
npm run docs:generate

# 更新变更日志
node scripts/update-changelog.mjs --add "新功能描述" --ai 80
```

### 2. 文档同步验证
```bash
# 检查文档与代码同步性
npm run docs:verify

# 检查Base文档清洁性
npm run guard:base
```

---

## 🔍 监控与可观测性

### 1. 本地监控启动
```bash
# 启动Sentry Mock (开发环境)
npm run sentry:mock

# 验证可观测性配置
npm run test:observability

# 检查Release Health数据
npm run ci:gate:sentry-up
```

### 2. 性能监控
```bash
# 启动性能监控
npm run perf:monitor

# 生成性能报告
npm run perf:report

# 事件循环延迟监控
node scripts/benchmarks/event-loop-latency.ts
```

---

## 🛠️ 故障排查

### 常见问题与解决方案

#### 1. 质量门禁失败
```bash
# 诊断质量门禁问题
npm run guard:diagnose

# 查看详细报告
cat logs/quality/quality-gates-latest.json

# 逐项检查
npm run typecheck        # TypeScript错误
npm run lint            # 代码规范
npm run test:coverage   # 覆盖率不足
```

#### 2. Sentry连接问题
```bash
# 检查Sentry配置
npm run test:observability

# 启动本地Mock
npm run sentry:mock

# 验证环境变量
echo $SENTRY_DSN
```

#### 3. 性能测试异常
```bash
# 重新校准性能基准
npm run perf:calibrate

# 检查系统资源
npm run perf:system-check

# 查看性能历史
cat logs/performance/benchmark-history.json
```

---

## 📖 相关文档

- [贡献指南](./CONTRIBUTING.md) - 开发流程和规范
- [架构文档](./architecture/base/) - 系统架构设计
- [ADR记录](./adr/) - 架构决策记录
- [文档索引](./README.md) - 全部文档导航

---

## 💡 最佳实践

### 开发工作流建议
```bash
# 1. 每日开发启动序列
npm run dev && npm run dev:electron &
npm run sentry:mock &
npm run perf:monitor &

# 2. 提交前检查序列
npm run guard:ci
node scripts/update-changelog.mjs --add "今日开发内容"

# 3. 发布前检查序列
npm run release:preflight
npm run guard:ci --strict
```

### BMAD + 自动化混合工作流
```bash
# 交互式架构设计
/architect
*create-doc architecture-update.yaml

# 脚本化质量检查
npm run guard:ci

# 交互式测试设计
/qa
*execute-checklist testing-checklist.md

# 脚本化测试执行
npm run test:unit && npm run test:e2e
```

---

> **提示**: 本指南随项目发展持续更新。如发现问题或需要补充内容，请提交Issue或更新文档。