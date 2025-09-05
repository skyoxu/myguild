# CI/CD 管道维护指南

> **目标受众**: 维护者、技术负责人、高级开发者  
> **最后更新**: 2025年 | **维护频率**: 每月审查，重大变更时立即更新

## 📋 稳定 Job 名称清单

### 🔒 核心硬门禁 Jobs（分支保护必须）

这些 job 名称**不可随意更改**，它们与分支保护规则绑定：

| Job 名称                 | 工作流 | 用途              | 分支保护 | 变更风险  |
| ------------------------ | ------ | ----------------- | -------- | --------- |
| `quality-gates`          | ci.yml | 质量门禁总控      | ✅ 必需  | 🔴 高风险 |
| `unit-tests-core`        | ci.yml | 核心单元测试      | ✅ 必需  | 🔴 高风险 |
| `coverage-gate`          | ci.yml | 覆盖率门禁        | ✅ 必需  | 🔴 高风险 |
| `electron-security-gate` | ci.yml | Electron 安全检查 | ✅ 必需  | 🔴 高风险 |

### 🛡️ 守护检查 Jobs（推荐保留）

| Job 名称             | 工作流         | 用途           | 分支保护  | 变更风险  |
| -------------------- | -------------- | -------------- | --------- | --------- |
| `workflow-guardian`  | ci.yml         | 工作流守护自检 | 🔶 推荐   | 🟡 中风险 |
| `soft-gate-guardian` | soft-gates.yml | 软门禁守护检查 | ❌ 不需要 | 🟢 低风险 |

### 🔄 支撑 Jobs（可适度调整）

| Job 名称              | 工作流         | 用途           | 分支保护  | 变更风险  |
| --------------------- | -------------- | -------------- | --------- | --------- |
| `unit-tests-extended` | ci.yml         | 扩展单元测试   | ❌ 不需要 | 🟢 低风险 |
| `integration-tests`   | ci.yml         | 集成测试       | ❌ 不需要 | 🟢 低风险 |
| `release-health-gate` | ci.yml         | 发布健康度检查 | ❌ 不需要 | 🟢 低风险 |
| `quality-gate-check`  | soft-gates.yml | 软门禁质量检查 | ❌ 不需要 | 🟢 低风险 |

## 🔧 分支保护配置标准

### 主分支 (main) 必需检查清单

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "quality-gates",
      "unit-tests-core",
      "coverage-gate",
      "electron-security-gate"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null
}
```

### 检查配置原则

1. **硬门禁 Jobs**: 必须在分支保护中，确保代码质量
2. **软门禁 Jobs**: 不应在分支保护中，仅提供反馈
3. **守护 Jobs**: 推荐包含，提升管道稳定性
4. **支撑 Jobs**: 按需包含，不影响合并流程

## 🚨 Job 名称变更流程

### 🔴 高风险变更（核心硬门禁）

**影响**: 分支保护失效，合并可能绕过质量检查

**流程**:

1. **通知**: 提前 1 周通知所有维护者
2. **计划**: 安排在非高峰期（周五晚或周末）
3. **同步操作**:
   ```bash
   # 步骤 1: 更新工作流中的 job 名称
   # 步骤 2: 等待新名称的 job 运行成功
   # 步骤 3: 立即更新分支保护规则
   gh api repos/:owner/:repo/branches/main/protection \
     --method PATCH \
     --field required_status_checks[contexts][]=新job名称
   # 步骤 4: 从分支保护规则中移除旧名称
   ```
4. **验证**: 创建测试 PR 确认保护规则生效
5. **文档**: 更新本文档和相关 README

### 🟡 中风险变更（守护检查）

**影响**: 自检功能受影响，但不阻断开发

**流程**:

1. **通知**: 在团队频道通知
2. **操作**: 直接更新 job 名称
3. **验证**: 确认守护功能正常工作

### 🟢 低风险变更（支撑功能）

**影响**: 仅功能本身受影响

**流程**:

1. **操作**: 直接更新并测试
2. **记录**: 在变更日志中记录

## 🔍 守护自检系统

### Actionlint 集成

- **位置**: 每个工作流的第一步
- **工具**: `rhysd/actionlint-action@v1`
- **失败策略**: 立即失败，阻断执行

### Needs 依赖校验

- **脚本**: `scripts/ci/workflow-guardian.mjs`
- **功能**: 检查 needs 引用完整性、循环依赖
- **失败策略**: 立即失败，防止死锁

### 分支保护同步检查

- **脚本**: `scripts/ci/branch-protection-guardian.mjs`
- **功能**: 比对分支保护与关键 jobs
- **失败策略**: 警告模式，记录但不阻断

## 📊 容错机制矩阵

| 功能类型 | API 失败处理 | 权限不足处理 | 网络超时处理 |
| -------- | ------------ | ------------ | ------------ |
| 硬门禁   | ❌ 构建失败  | ❌ 构建失败  | 🔄 重试 3 次 |
| 软门禁   | ⚠️ 降级继续  | ⚠️ 记录警告  | ⚠️ 跳过评论  |
| 守护检查 | ⚠️ 警告模式  | ⚠️ 跳过检查  | ⚠️ 记录日志  |

## 🛠️ 常用维护命令

### 检查当前分支保护状态

```bash
gh api repos/:owner/:repo/branches/main/protection | jq '.required_status_checks.contexts'
```

### 验证工作流语法

```bash
actionlint .github/workflows/*.yml
```

### 运行本地守护检查

```bash
node scripts/ci/workflow-guardian.mjs
node scripts/ci/branch-protection-guardian.mjs
```

### 更新分支保护规则（示例）

```bash
# 添加新的必需检查
gh api repos/:owner/:repo/branches/main/protection \
  --method PATCH \
  --field required_status_checks[contexts][]="新job名称"

# 移除废弃检查
gh api repos/:owner/:repo/branches/main/protection \
  --method PATCH \
  --field required_status_checks[contexts]-="废弃job名称"
```

## 🚀 最佳实践

### Job 命名规范

1. **描述性**: 名称应清楚表达功能 (`unit-tests-core` ✅ vs `tests` ❌)
2. **稳定性**: 核心 job 名称一经确定就不轻易变更
3. **层次性**: 使用连字符分隔逻辑层次 (`electron-security-gate`)
4. **简洁性**: 避免过长名称，控制在 20 字符内

### 变更管理

1. **渐进式**: 先添加新 job，确认稳定后再移除旧 job
2. **文档驱动**: 所有名称变更都要更新维护文档
3. **通知机制**: 高风险变更要提前通知团队
4. **回滚预案**: 准备快速回滚方案

### 监控告警

1. **分支保护检查**: 定期运行守护脚本，发现不一致及时修复
2. **失败分析**: 监控 CI 失败率，识别系统性问题
3. **性能监控**: 关注 job 执行时间，优化管道效率

## 📞 故障处理

### 分支保护失效

**症状**: 可以合并未通过检查的 PR  
**处理**: 立即检查并修复分支保护规则，可能需要临时锁定合并

### 工作流依赖死锁

**症状**: Job 无限等待，工作流卡住  
**处理**: 运行 `workflow-guardian.mjs` 检查循环依赖，修复 needs 关系

### 软门禁阻断合并

**症状**: 软门禁 job 失败导致 PR 无法合并  
**处理**: 检查 job 的 `conclusion` 是否为 `neutral`，确保容错机制生效

---

**📢 重要提醒**: 本文档的准确性直接影响 CI/CD 管道稳定性。任何相关变更都要同步更新此文档。
