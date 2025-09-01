---
ADR-ID: ADR-0003
title: 可观测性与Release Health策略 - Sentry监控集成
status: Accepted
decision-time: '2025-08-24'
deciders: [架构团队, SRE团队]
archRefs: [CH01, CH03, CH07]
verification:
  - path: .release-health.json
    assert: CrashFreeUsers, CrashFreeSessions, minAdoption, noRegression thresholds are defined
  - path: scripts/release-health-gate.mjs
    assert: Build fails if crash-free or adoption thresholds are not met
  - path: scripts/telemetry/self-check.mjs
    assert: Sessions telemetry is enabled for release health
impact-scope: [src/shared/observability/, .release-health.json, scripts/]
tech-tags: [sentry, logging, monitoring, release-health, observability]
depends-on: []
depended-by: [ADR-0005, ADR-0008]
test-coverage: tests/unit/observability/sentry.spec.ts
monitoring-metrics:
  [crash_free_sessions, crash_free_users, error_rate, release_adoption]
executable-deliverables:
  - .release-health.json
  - src/shared/observability/sentry-config.ts
  - scripts/release-health-gate.mjs
supersedes: []
---

# ADR-0003: 可观测性与Release Health策略

## Context and Problem Statement

Electron应用需要完善的可观测性体系来监控应用健康状况、用户体验质量和发布质量。需要建立统一的监控、日志、错误追踪和Release Health门禁机制，确保应用发布质量和用户体验，同时满足数据隐私和合规要求。

## Decision Drivers

- 需要实时监控应用崩溃率和用户会话质量
- 需要建立发布质量门禁，防止有问题的版本大规模发布
- 需要统一的错误追踪和日志系统，便于问题排查
- 需要支持渐进式发布和自动回滚机制
- 符合GDPR、CCPA等数据隐私法规要求
- 需要PII数据清洗和敏感信息保护机制

## Considered Options

- **Sentry Release Health + 结构化日志** (选择方案)
- **ApplicationInsights + Azure Monitor**
- **Bugsnag + ELK Stack**
- **自建监控系统 + Prometheus/Grafana**
- **仅使用Electron自带崩溃报告** (已拒绝)

## Decision Outcome

选择的方案：**Sentry Release Health + 结构化日志**

原因：Sentry提供完整的Release Health功能，包括Crash-Free Users/Sessions指标，能够直接作为发布门禁的数据源。同时支持Error Tracking、Performance Monitoring和用户反馈收集，具备强大的PII数据清洗能力。

### 核心配置架构

**Sentry SDK配置**：

```javascript
import * as Sentry from '@sentry/electron';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Release Health配置
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMs: 30000,

  // 采样配置
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // PII数据清洗
  beforeSend(event) {
    return sanitizeEvent(event);
  },

  beforeSendTransaction(transaction) {
    return sanitizeTransaction(transaction);
  },

  // 错误过滤
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ChunkLoadError',
    'Loading CSS chunk',
  ],
});
```

**PII清洗策略**：

```javascript
function sanitizeEvent(event) {
  // 移除敏感数据字段
  const sensitiveFields = ['email', 'password', 'token', 'apiKey', 'userId'];

  // 清洗用户数据
  if (event.user) {
    sensitiveFields.forEach(field => {
      if (event.user[field]) {
        event.user[field] = '[Filtered]';
      }
    });
  }

  // 清洗请求数据
  if (event.request && event.request.data) {
    event.request.data = sanitizeObject(event.request.data);
  }

  // 清洗堆栈信息中的敏感路径
  if (event.exception) {
    event.exception.values.forEach(exception => {
      if (exception.stacktrace) {
        exception.stacktrace.frames.forEach(frame => {
          frame.filename = sanitizePath(frame.filename);
        });
      }
    });
  }

  return event;
}
```

**结构化日志配置**：

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message: sanitizeMessage(message),
        ...sanitizeObject(meta),
      });
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
    ...(process.env.NODE_ENV === 'development'
      ? [new winston.transports.Console()]
      : []),
  ],
});
```

### Release Health门禁配置

**质量门禁阈值**：

- **Crash-Free Users**: ≥99.5%
- **Crash-Free Sessions**: ≥99.8%
- **最小采样数**: 1000个会话
- **回滚触发**: 连续30分钟低于阈值

**门禁脚本示例**：

```javascript
// scripts/release_health_check.js
async function checkReleaseHealth(releaseVersion) {
  const healthData = await sentryApi.getReleaseHealth(releaseVersion);

  const metrics = {
    crashFreeUsers: healthData.sessions.crashFreeUsers,
    crashFreeSessions: healthData.sessions.crashFreeSessions,
    totalSessions: healthData.sessions.total,
    duration: healthData.timePeriod,
  };

  // 验证最小采样数
  if (metrics.totalSessions < 1000) {
    throw new Error(
      `Insufficient session count: ${metrics.totalSessions} < 1000`
    );
  }

  // 验证Crash-Free指标
  if (metrics.crashFreeUsers < 0.995) {
    throw new Error(
      `Crash-Free Users too low: ${metrics.crashFreeUsers} < 99.5%`
    );
  }

  if (metrics.crashFreeSessions < 0.998) {
    throw new Error(
      `Crash-Free Sessions too low: ${metrics.crashFreeSessions} < 99.8%`
    );
  }

  return metrics;
}
```

### Positive Consequences

- 统一的错误追踪和性能监控平台
- 内置Release Health指标，便于自动化门禁
- 支持用户反馈和崩溃上下文收集
- 良好的Electron集成支持和社区生态
- 支持渐进式发布和质量监控
- 强大的PII数据清洗和隐私保护能力
- 丰富的告警和通知机制

### Negative Consequences

- 增加第三方服务依赖和单点故障风险
- 需要考虑数据隐私和合规要求（GDPR、CCPA）
- 月费成本（基于事件量），大规模使用时成本较高
- 需要网络连接才能发送遥测数据
- 数据留存期限和地域限制
- 需要定期审计和清理敏感数据

## Verification

- **测试验证**: tests/unit/observability.spec.ts, tests/integration/sentry-integration.spec.ts
- **门禁脚本**: scripts/quality_gates.mjs, scripts/release_health_check.js
- **监控指标**: sentry.crash_free_users, sentry.crash_free_sessions, sentry.error_rate, sentry.performance_score
- **SLO阈值**: Crash-Free Users ≥99.5%, Crash-Free Sessions ≥99.8%, min adoption 1000 sessions, P95 response time <2s

### 监控仪表板指标

**应用健康指标**：

- 崩溃率和错误率趋势
- 会话质量和用户留存
- 性能指标（P50/P95/P99响应时间）
- 内存使用和CPU占用率

**发布质量指标**：

- Release Health评分
- 版本采用率和推广速度
- 回滚触发和恢复时间
- 用户反馈和满意度

**运营效率指标**：

- 问题发现和解决时间（MTTR）
- 告警准确率和误报率
- 监控覆盖率和盲点识别
- 成本效率和ROI分析

## Operational Playbook

### 升级步骤

1. **SDK安装**: 安装并配置Sentry SDK for Electron
2. **Release配置**: 配置Release Health tracking和版本标签
3. **环境区分**: 设置不同环境的DSN和采样率
4. **PII清洗**: 配置敏感数据过滤和清洗规则
5. **告警设置**: 建立监控Dashboard和告警通知
6. **门禁集成**: 集成Release Health检查到CI/CD流程

### 回滚步骤

1. **实时监控**: 持续监控Release Health指标变化
2. **告警触发**: 当Crash-Free率低于阈值时自动告警
3. **发布暂停**: 自动停止新版本的推广发布
4. **问题分析**: 通知相关团队进行紧急问题分析
5. **回滚决策**: 根据影响范围决定是否执行版本回滚
6. **恢复验证**: 回滚后验证系统恢复正常状态

### 迁移指南

- **日志兼容**: 现有日志输出保持不变，额外增加结构化日志
- **文件管理**: 日志文件统一写入logs/目录，按日期和模块分类
- **敏感信息**: 不记录用户输入、密码、token等敏感信息
- **采样策略**: 开发环境100%，测试环境50%，生产环境根据负载调整
- **数据治理**: 建立数据保留和清理策略，定期清理过期数据

### 数据隐私和合规

**GDPR合规措施**：

- 用户同意机制：可选择退出遥测数据收集
- 数据最小化：仅收集必要的错误和性能数据
- 数据透明：提供用户数据收集和使用说明
- 删除权利：支持用户数据删除请求

**PII数据处理**：

- 数据分类：明确标识和分类敏感数据类型
- 清洗机制：自动清洗和脱敏敏感信息
- 访问控制：限制敏感数据的访问权限
- 审计日志：记录敏感数据的访问和操作

## References

- **CH章节关联**: CH01, CH03
- **相关ADR**: ADR-0005-quality-gates, ADR-0002-electron-security
- **外部文档**:
  - [Sentry Electron Integration](https://docs.sentry.io/platforms/javascript/guides/electron/)
  - [Sentry Release Health](https://docs.sentry.io/product/releases/health/)
  - [GDPR Compliance Guide](https://docs.sentry.io/data-management/sensitive-data/)
  - [Winston Logging Best Practices](https://github.com/winstonjs/winston#readme)
- **合规框架**: GDPR Article 25, CCPA Section 1798.100
- **相关PRD-ID**: 适用于所有PRD的基线监控需求
