# 分支保护规则配置建议

## 当前Windows核心作业识别

根据工作流分析，以下是应该设为必需检查的Windows核心作业：

### 必需检查 (Required Status Checks)

这些作业在Windows上运行，是核心质量门禁：

1. **build-and-test** (from `build-and-test.yml`)
   - 运行环境: `windows-latest`
   - 作用: 核心构建和单元测试
   - 必需原因: 验证代码编译和基本功能

2. **workflow-guardian** (from `ci.yml`)
   - 运行环境: `windows-latest`
   - 作用: 工作流自检和依赖验证
   - 必需原因: 确保CI/CD配置正确

3. **coverage-check** (from `ci.yml`)
   - 运行环境: `windows-latest`
   - 作用: 代码覆盖率验证
   - 必需原因: 质量门禁 (≥90%)

4. **security-baseline** (from `ci.yml`)
   - 运行环境: `windows-latest`
   - 作用: 安全基线检查
   - 必需原因: 安全合规要求

5. **observability-check** (from `ci.yml`)
   - 运行环境: `windows-latest`
   - 作用: 可观测性配置验证
   - 必需原因: 生产环境监控要求

### 非阻塞检查 (Optional/Informational)

这些作业可以设为非必需，失败不阻止合并：

1. **pr-gatekeeper** (from `pr-gatekeeper.yml`)
   - 运行环境: `ubuntu-latest`
   - 作用: PR规则检查
   - 设置: 非必需，仅提供建议

2. **validate-workflows** (Linux部分)
   - 运行环境: `ubuntu-latest`
   - 作用: 工作流语法验证
   - 设置: 非必需，仅Linux特定验证

## GitHub分支保护规则配置

### main分支保护设置

```
Branch name pattern: main
✅ Require a pull request before merging
  ✅ Require approvals: 1
  ✅ Dismiss stale PR approvals when new commits are pushed
✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  Required status checks:
    - build-and-test
    - workflow-guardian
    - coverage-check
    - security-baseline
    - observability-check
✅ Restrict pushes that create files
✅ Do not allow bypassing the above settings
```

### develop分支保护设置

```
Branch name pattern: develop
✅ Require a pull request before merging
  ✅ Require approvals: 1
✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  Required status checks:
    - build-and-test
    - workflow-guardian
    - coverage-check
    - security-baseline
```

## 实施步骤

1. **确认作业名称**: 在GitHub Actions页面确认实际的作业名称
2. **逐步迁移**: 先添加Windows核心作业为必需检查
3. **观察期**: 运行1-2天确认稳定性
4. **移除Linux依赖**: 将Linux/macOS作业从必需检查中移除
5. **文档更新**: 更新CONTRIBUTING.md说明新的规则

## 注意事项

- 作业名称必须与实际GitHub Actions中显示的完全一致
- 考虑设置timeout避免长时间运行的作业阻塞合并
- 定期审查必需检查列表，确保仍然相关
- 保留回滚选项，以防新规则导致问题
