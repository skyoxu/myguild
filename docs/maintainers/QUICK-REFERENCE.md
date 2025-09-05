# CI/CD 快速参考卡

> 🚨 **紧急情况**: 如果分支保护失效或 CI 全面故障，立即联系技术负责人

## 🔥 应急处理

### 分支保护失效（🔴 高优先级）

```bash
# 1. 立即检查当前保护状态
gh api repos/:owner/:repo/branches/main/protection

# 2. 快速恢复标准配置
gh api repos/:owner/:repo/branches/main/protection \
  --method PATCH \
  --field required_status_checks[contexts][0]="quality-gates" \
  --field required_status_checks[contexts][1]="unit-tests-core" \
  --field required_status_checks[contexts][2]="coverage-gate" \
  --field required_status_checks[contexts][3]="electron-security-gate"
```

### 软门禁误阻断（🟡 中优先级）

```bash
# 检查软门禁状态
gh api repos/:owner/:repo/actions/runs?branch=main | jq '.workflow_runs[0].jobs_url'

# 手动设置中性状态（如需要）
# 联系技术负责人处理
```

## 📋 关键 Job 名称

**绝对不可更改**（分支保护依赖）:
- `quality-gates`
- `unit-tests-core`  
- `coverage-gate`
- `electron-security-gate`

**更改需要同步分支保护**:
- `workflow-guardian` (推荐保护)

## 🛠️ 常用检查命令

```bash
# 检查工作流语法
actionlint .github/workflows/*.yml

# 检查依赖完整性
node scripts/ci/workflow-guardian.mjs

# 检查分支保护同步
node scripts/ci/branch-protection-guardian.mjs

# 查看当前保护规则
gh api repos/:owner/:repo/branches/main/protection | jq '.required_status_checks.contexts'
```

## 📞 联系信息

**技术负责人**: [待填写]  
**GitHub 仓库**: [当前仓库]  
**文档位置**: `docs/maintainers/CI-CD-MAINTENANCE.md`

---

**更新频率**: 每次关键变更后立即更新