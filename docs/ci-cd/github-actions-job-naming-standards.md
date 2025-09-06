# GitHub Actions Job ID 命名标准化策略

## 概述

本文档定义了 GitHub Actions 工作流中 job ID 的标准化命名策略，确保依赖引用的一致性和可维护性。

## 核心原则

### 1. 稳定性优先（Stability First）

- **必需检查的核心 job** 使用稳定、可预测的后缀 `-core`
- **扩展测试 job** 使用后缀 `-extended`
- **门禁检查 job** 使用后缀 `-gate`

### 2. 描述性命名（Descriptive Naming）

- job ID 必须清楚表达其功能和职责
- 使用 kebab-case（连字符分隔）
- 避免缩写，除非是行业标准缩写（如 `e2e`, `api`）

### 3. 层次化组织（Hierarchical Organization）

- 按功能域分组：`quality-*`, `security-*`, `test-*`, `build-*`, `deploy-*`
- 按环境分组：`*-development`, `*-staging`, `*-production`

## 标准命名模式

### 核心作业（必需检查）

这些作业是分支保护和CI/CD流程的关键依赖：

```yaml
jobs:
  # 质量门禁 - 始终作为第一道关口
  quality-gates:
    name: Quality Gates Check

  # 单元测试 - 稳定的核心测试
  unit-tests-core:
    name: Unit Tests (windows-latest, Node 20)

  # 构建验证 - 核心构建检查
  build-verification-core:
    name: Build Verification (windows-latest)

  # 安全门禁 - 必需的安全检查
  electron-security-gate:
    name: Electron Security Gate

  # 覆盖率门禁 - 代码质量控制
  coverage-gate:
    name: Coverage Gate
```

### 扩展作业（可选）

这些作业提供更全面的测试覆盖，但不阻断基本流程：

```yaml
jobs:
  # 扩展单元测试 - 多平台矩阵测试
  unit-tests-extended:
    name: Unit Tests Extended Matrix

  # 扩展构建验证 - 多平台构建
  build-verification-extended:
    name: Build Verification Extended Matrix
```

### 专项检查作业

按功能域组织的专项检查：

```yaml
jobs:
  # 依赖安全审计
  dependency-audit:
    name: Dependency Security Audit

  # 可观测性验证
  observability-verification:
    name: Observability Verification

  # 性能基准测试
  performance-benchmarks:
    name: Performance Benchmarks

  # 发布健康检查
  release-health-gate:
    name: Release Health Gate

  # 部署就绪检查
  deployment-readiness:
    name: Deployment Readiness Check
```

## 命名约定详细规范

### 1. Job ID 格式

```
<domain>-<function>[-<qualifier>][-<environment>]
```

**示例：**

- `quality-gates` (domain: quality, function: gates)
- `unit-tests-core` (domain: unit-tests, function: core)
- `observability-gate-production` (domain: observability, function: gate, environment: production)

### 2. 常用域前缀（Domain Prefixes）

- `quality-*`: 代码质量检查
- `security-*`: 安全扫描和审计
- `test-*`: 各类测试作业
- `build-*`: 构建和编译
- `deploy-*`: 部署相关
- `release-*`: 发布流程
- `monitor-*`: 监控和健康检查

### 3. 常用限定符（Qualifiers）

- `-core`: 必需的核心检查
- `-extended`: 扩展的非阻断检查
- `-gate`: 门禁控制点
- `-audit`: 审计和扫描
- `-verification`: 验证和确认

### 4. 环境后缀（Environment Suffixes）

- `-development`: 开发环境
- `-staging`: 预发布环境
- `-production`: 生产环境

## 依赖引用最佳实践

### 1. 稳定核心作业引用

```yaml
jobs:
  coverage-gate:
    needs: unit-tests-core # ✅ 正确：引用稳定的核心作业

  build-verification-core:
    needs: unit-tests-core # ✅ 正确：一致的核心作业引用

  release-health-gate:
    needs: [unit-tests-core, coverage-gate, electron-security-gate] # ✅ 正确：多个稳定引用
```

### 2. 避免的反模式

```yaml
jobs:
  coverage-gate:
    needs: unit-tests # ❌ 错误：引用不存在的作业

  build-verification:
    needs: tests # ❌ 错误：模糊的作业名

  deploy:
    needs: build-and-test # ❌ 错误：不一致的命名风格
```

## 分支保护配置

### Required Status Checks

以下作业必须配置为分支保护的必需检查：

```yaml
# .github/settings.yml 或通过 GitHub UI 配置
branches:
  main:
    protection:
      required_status_checks:
        strict: true
        contexts:
          - 'quality-gates'
          - 'unit-tests-core'
          - 'coverage-gate'
          - 'build-verification-core'
          - 'electron-security-gate'
          - 'release-health-gate' # 仅对主分支
```

## 迁移指南

### 现有工作流迁移

1. **识别核心作业**：标识必需的检查点
2. **重命名为标准格式**：应用 `-core` 后缀
3. **更新依赖引用**：确保 `needs` 指向正确的作业ID
4. **验证依赖关系**：运行 `npm run guard:workflows` 验证
5. **更新分支保护**：同步更新必需状态检查

### 渐进式迁移步骤

```bash
# 1. 验证当前状态
npm run guard:workflows

# 2. 识别需要重命名的作业
grep -r "needs:" .github/workflows/

# 3. 应用标准命名
# 手动编辑或使用脚本批量替换

# 4. 验证迁移结果
npm run guard:workflows

# 5. 测试 CI 流程
git push --dry-run  # 确保不会破坏现有流程
```

## 验证工具

### 自动化检查

项目包含以下验证工具：

```bash
# 检查单个工作流依赖
npm run guard:workflow-deps

# 检查所有工作流
npm run guard:workflows

# 集成到 CI 流程
npm run guard:ci  # 包含工作流验证
```

### 持续集成集成

在 `.github/workflows/ci.yml` 中已集成工作流验证：

```yaml
steps:
  - name: 🔍 工作流依赖验证
    run: npm run guard:workflows
```

## 故障排查

### 常见问题

1. **依赖引用错误**

   ```
   Error: Job 'coverage-gate' depends on 'unit-tests' which doesn't exist
   ```

   **解决方案**：将 `unit-tests` 更新为 `unit-tests-core`

2. **循环依赖**

   ```
   Error: Circular dependency detected: job-a → job-b → job-a
   ```

   **解决方案**：重新设计作业依赖关系，消除循环

3. **分支保护失败**
   ```
   Error: Required status check "unit-tests" is missing
   ```
   **解决方案**：更新分支保护配置中的状态检查名称

### 调试工具

```bash
# 检查特定工作流
node scripts/ci/workflow-dependency-check.cjs .github/workflows/ci.yml

# 生成依赖图（如果需要可视化）
# 可考虑集成 Graphviz 或其他依赖图生成工具
```

## 未来扩展

### 计划中的改进

1. **语义化版本集成**：作业名称包含版本信息
2. **动态作业生成**：基于文件变更动态调整作业
3. **作业依赖优化**：基于变更影响分析优化依赖链
4. **可视化工具**：依赖关系图的可视化展示

### 工具路线图

- [ ] 集成 actionlint 进行语法检查
- [ ] 添加作业性能监控
- [ ] 实现智能作业调度
- [ ] 支持条件性作业依赖

---

## 变更历史

| 版本 | 日期       | 变更描述                   |
| ---- | ---------- | -------------------------- |
| 1.0  | 2025-09-04 | 初始版本，定义核心命名标准 |

## 相关文档

- [GitHub Actions 最佳实践](../docs/github-actions-best-practices.md)
- [CI/CD 流程设计](../docs/cicd-process-design.md)
- [分支保护策略](../docs/branch-protection-strategy.md)
