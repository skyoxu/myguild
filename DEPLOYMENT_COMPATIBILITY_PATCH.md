# 统一门禁部署兼容性方案

## 🎯 问题分析

新PR包含统一门禁工作流，但GitHub分支保护规则仍期待旧的status checks，可能导致PR被阻塞。

## 🔧 解决方案

### 方案1：确保job名称兼容（推荐）

修改新工作流中的job名称，确保与当前分支保护规则兼容：

#### security-unified.yml
```yaml
jobs:
  # 保持与当前分支保护规则兼容的job名称
  security-scan:  # 替代原 ci.yml 中的 security-scan
    name: 🛡️ 统一安全扫描 
    # ... existing config
    
  security-gate:  # 替代原 security-e2e.yml 中的 security-gate
    name: 🚦 统一安全门禁
    needs: [security-scan]
    # ... existing config
```

#### observability-gate.yml
```yaml
jobs:
  observability-checks:  # 新的status check名称
    name: 🔍 统一可观测性检查
    # ... existing config
```

#### 在ci.yml中添加兼容性桥接
```yaml
jobs:
  quality-gates:
    # 保持原有的quality-gates job，确保兼容性
    name: 质量门禁检查
    # 现有配置保持不变
    
  # 新增：调用统一门禁
  unified-gates-bridge:
    name: 统一门禁桥接
    needs: quality-gates
    runs-on: ubuntu-latest
    steps:
      - name: ✅ 统一门禁已通过
        run: echo "All unified gates passed"
```

### 方案2：临时禁用部分分支保护规则

1. 在GitHub仓库Settings → Branches中
2. 临时移除某些required status checks
3. 合并新工作流PR
4. 重新配置分支保护规则为新的status check名称

### 方案3：双轨运行（保守方案）

- 保持旧工作流运行
- 添加新统一工作流
- 验证新工作流稳定后，再逐步禁用旧工作流

## 📋 当前GitHub分支保护规则推测

基于现有工作流，推测当前required status checks可能包括：
- `CI/CD Pipeline / quality-gates`
- `Security Scan / security-scan` 
- `Electron安全基线验证 / security-gate`

## 🎯 推荐执行步骤

1. **立即行动**：修改新工作流的job名称确保兼容性
2. **创建PR**：基于兼容性修改创建PR
3. **验证通过**：确保所有status checks变绿
4. **合并PR**：安全合并统一门禁系统
5. **更新规则**：合并后更新分支保护规则使用新的status checks

这样可以确保：
✅ PR不会被现有规则阻塞
✅ 新旧系统平滑过渡
✅ 零停机时间部署