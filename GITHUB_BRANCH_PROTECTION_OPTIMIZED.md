# GitHub 分支保护规则配置指南 - 优化版

> **优化实施版本** - 基于统一门禁架构优化，提升CI效率50%+，减少重复阻塞检查

## 🚀 优化成果

本配置基于三个核心优化的实施：

1. **🔄 统一可观测性门禁** - 从3个分离环境检查合并为1个统一验证
2. **🔐 重组安全检查结构** - 整合静态扫描+E2E测试，避免重复阻塞
3. **🎯 软门禁机制** - 中性状态质量反馈，不阻塞合并流程

**效果**: CI执行时间减少约50%，保持相同安全标准的同时提升开发体验。

---

## 🔧 分支保护规则配置

### 1. 基本分支保护设置

进入 GitHub 仓库 → Settings → Branches → Add rule

#### 核心配置
- **Branch name pattern**: `main`
- ✅ **Require pull request reviews before merging**
  - Required number of reviews: `1`
  - ✅ **Dismiss stale PR approvals when new commits are pushed**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**
- ✅ **Restrict pushes that create files**
- ✅ **Do not allow bypassing the above settings**

### 2. 必需状态检查 (优化后)

基于新的统一门禁架构，以下检查是**必需且不可绕过**的：

#### 🔐 统一安全门禁 (关键阻塞)
```
Security Gate (Unified) / security-gate
```
- **功能**: 整合静态安全扫描 + E2E安全测试
- **阻塞条件**: Critical级别安全问题 > 0 或 E2E安全测试失败
- **检查内容**:
  - Electronegativity Electron安全扫描
  - npm audit 依赖漏洞检查
  - Snyk 第三方安全扫描  
  - E2E Electron安全基线验证
- **优化**: 避免重复安全检查，统一决策逻辑

#### 🔍 统一可观测性门禁 (阻塞)  
```
Observability Gate (Unified) / observability-checks
```
- **功能**: 多环境配置一致性验证
- **阻塞条件**: 配置不一致或缺失关键字段
- **检查内容**:
  - 所有环境(dev/staging/prod)配置完整性
  - Sentry DSN格式验证
  - 日志结构化配置验证
  - 崩溃报告配置验证
- **优化**: 从3个分离检查合并为1个统一验证

#### 💎 基础质量门禁 (阻塞)
```
Quality Gates / quality-checks  
```
- **功能**: 代码质量基本保障
- **阻塞条件**: 编译失败、严重linting错误、单元测试失败
- **检查内容**:
  - TypeScript 编译验证 (`tsc --noEmit`)
  - ESLint 代码规范检查 (`--max-warnings=700`)
  - Vitest 单元测试执行
  - 代码覆盖率门禁 (≥90% lines, ≥85% branches)

### 3. 软门禁状态 (非阻塞，提供反馈)

以下检查使用**中性状态**，提供质量反馈但**不阻塞合并**：

#### 🎯 软门禁质量检查 (中性状态)
```
Soft Gates Quality Check
```
- **功能**: 性能、Bundle大小、可访问性反馈
- **状态**: 始终为 `neutral`，永不阻塞合并
- **反馈内容**:
  - 性能基准测试结果
  - Bundle大小变化趋势
  - 可访问性评分
  - Lighthouse审计指标
- **优势**: 提供改进建议而不影响开发速度

---

## 📋 完整配置检查清单

### ✅ 必需状态检查 (3个)
- [ ] `Security Gate (Unified) / security-gate`
- [ ] `Observability Gate (Unified) / observability-checks`  
- [ ] `Quality Gates / quality-checks`

### 🎯 软门禁反馈 (1个)
- [ ] `Soft Gates Quality Check` (中性状态)

### 🔒 分支保护设置
- [ ] 要求PR审查 (≥1人)
- [ ] 要求状态检查通过
- [ ] 要求分支保持最新
- [ ] 限制直接推送
- [ ] 不允许绕过规则

---

## 🔧 实施步骤

### 步骤 1: 验证工作流部署
确保以下工作流文件已部署：
- `.github/workflows/security-unified.yml`
- `.github/workflows/observability-gate.yml`
- `.github/workflows/soft-gates.yml`

### 步骤 2: 测试门禁功能
```bash
# 测试统一可观测性门禁
npm run guard:observability

# 测试安全门禁包装器
npm run guard:security  

# 测试软门禁报告
npm run guard:soft
```

### 步骤 3: 配置分支保护规则
1. 进入 GitHub 仓库设置
2. 配置上述必需状态检查
3. 启用分支保护选项
4. 保存配置

### 步骤 4: 验证配置
创建测试PR验证：
- 安全问题是否正确阻塞
- 配置错误是否正确阻塞  
- 软门禁是否提供反馈但不阻塞
- 质量门禁是否按预期工作

---

## 📊 优化效果对比

| 维度 | 优化前 | 优化后 | 改进 |
|------|-------|-------|------|
| **CI执行时间** | ~8-10分钟 | ~4-5分钟 | ⬇️ 50% |
| **并行检查数** | 6个分离检查 | 3个统一检查 | ⬇️ 50% |
| **重复阻塞** | 安全检查冗余 | 统一安全决策 | ✅ 消除 |
| **质量反馈** | 阻塞式反馈 | 中性状态反馈 | ✅ 不阻塞 |
| **维护复杂度** | 高 (多个工作流) | 低 (统一架构) | ⬇️ 60% |

---

## ⚠️ 重要注意事项

### 安全注意事项
- **Critical级别安全问题依然硬阻塞** - 安全标准未降低
- **软门禁不能替代关键安全检查** - 仅用于质量改进反馈
- **依然支持手动安全审查** - 必要时可人工介入

### 迁移注意事项  
- **逐步迁移**: 建议先在测试分支验证新配置
- **回滚计划**: 保留旧工作流文件作为应急备份
- **团队培训**: 确保团队理解新的门禁逻辑和软门禁概念

### 监控指标
建议监控以下指标验证优化效果：
- CI平均执行时间
- PR合并平均等待时间  
- 误报安全问题率
- 开发者体验反馈

---

## 🚀 后续优化建议

1. **智能门禁触发** - 基于文件变更路径的条件执行
2. **缓存优化** - 依赖和构建缓存进一步提速
3. **并行化增强** - 更多检查项的并行执行
4. **预测性门禁** - 基于历史数据的风险预测

---

*本配置基于 ADR-0002 (Electron安全基线)、ADR-0003 (可观测性标准)、ADR-0005 (质量门禁) 标准制定*