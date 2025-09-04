# GitHub 分支保护规则迁移指南

> **安全无缝迁移** - 从分离门禁架构升级到统一门禁系统

## 🎯 迁移目标

从现有的分离门禁架构安全迁移到优化的统一门禁系统，确保：
- **零停机迁移** - 不影响现有开发流程
- **安全标准保持** - 不降低任何安全要求  
- **向后兼容** - 平滑过渡期支持
- **可回滚** - 出现问题时快速回退

## 📋 迁移前置条件检查

### ✅ 必需准备工作
- [ ] 确认所有统一门禁脚本已部署并测试通过
- [ ] 验证新的GitHub Actions工作流语法正确
- [ ] 备份现有分支保护规则配置
- [ ] 获得团队迁移确认
- [ ] 准备回滚计划

### 🔍 环境验证命令
```bash
# 验证统一门禁脚本
npm run guard:observability  # 可观测性统一验证
npm run guard:security       # 安全统一包装器  
npm run guard:soft          # 软门禁报告

# 验证工作流语法
node scripts/validate-yaml.js

# 检查必需的配置文件
ls config/development.json config/staging.json config/production.json
```

---

## 🚀 分阶段迁移计划

### 阶段 1: 并行运行期 (1周)
**目标**: 新旧系统同时运行，验证新系统稳定性

#### 1.1 部署新工作流 (保持旧工作流)
```bash
# 新工作流文件已就绪
.github/workflows/security-unified.yml      # 新统一安全门禁
.github/workflows/observability-gate.yml    # 新统一可观测性门禁  
.github/workflows/soft-gates.yml           # 新软门禁系统

# 旧工作流暂时保留
.github/workflows/security.yml             # 旧安全检查
.github/workflows/security-e2e.yml         # 旧E2E安全测试
```

#### 1.2 更新分支保护 - 添加新检查
在GitHub设置中**添加**以下状态检查（不删除旧的）：
- `Security Gate (Unified) / security-gate`
- `Observability Gate (Unified) / observability-checks`  
- `Soft Gates Quality Check` (设为可选)

#### 1.3 监控期验证
- **CI运行时间对比** - 新系统应比旧系统快50%
- **误报率对比** - 新系统误报不应高于旧系统
- **安全检测效果** - 确保安全检测无遗漏
- **开发者反馈** - 收集团队使用体验

### 阶段 2: 过渡期 (3天)
**目标**: 新系统作为主要门禁，旧系统作为备用

#### 2.1 优先级调整
调整分支保护规则中的状态检查优先级：
- **必需**: 新统一门禁 (主要)
- **可选**: 旧分离门禁 (备用)

#### 2.2 问题处理流程
- **新系统故障**: 临时启用旧系统作为主要门禁
- **误报处理**: 优先修复新系统，必要时回退
- **性能问题**: 监控并优化新系统执行时间

### 阶段 3: 完全切换期 (1天)
**目标**: 完全切换到新系统，移除旧检查

#### 3.1 移除旧状态检查
从分支保护规则中移除：
- `Security Checks / security-scan` (旧)
- `🔒 安全E2E测试 / security-tests` (旧)  
- `📊 可观测性检查-开发环境 / observability-dev` (旧)
- `📊 可观测性检查-预发环境 / observability-staging` (旧)
- `📊 可观测性检查-生产环境 / observability-prod` (旧)

#### 3.2 保留必需状态检查
确保以下检查保持必需状态：
- `Security Gate (Unified) / security-gate`
- `Observability Gate (Unified) / observability-checks`
- `Quality Gates / quality-checks`

#### 3.3 软门禁设置
将以下设为可选（非阻塞）：
- `Soft Gates Quality Check`

---

## 🔧 详细迁移步骤

### 步骤 1: GitHub 分支保护规则更新

#### 访问分支保护设置
1. 进入 GitHub 仓库
2. Settings → Branches  
3. 编辑 `main` 分支规则

#### 更新状态检查列表
```diff
# 阶段1 - 添加新检查 (保留旧检查)
✅ Security Checks / security-scan                    # 旧 - 暂时保留
✅ 🔒 安全E2E测试 / security-tests                    # 旧 - 暂时保留
+ Security Gate (Unified) / security-gate             # 新 - 添加
✅ 📊 可观测性检查-开发环境 / observability-dev        # 旧 - 暂时保留  
✅ 📊 可观测性检查-预发环境 / observability-staging   # 旧 - 暂时保留
✅ 📊 可观测性检查-生产环境 / observability-prod      # 旧 - 暂时保留
+ Observability Gate (Unified) / observability-checks # 新 - 添加
✅ Quality Gates / quality-checks                     # 保持
+ Soft Gates Quality Check                            # 新 - 可选
```

```diff
# 阶段3 - 移除旧检查 (仅保留新检查)
- Security Checks / security-scan                     # 移除
- 🔒 安全E2E测试 / security-tests                     # 移除
✅ Security Gate (Unified) / security-gate            # 必需
- 📊 可观测性检查-开发环境 / observability-dev         # 移除
- 📊 可观测性检查-预发环境 / observability-staging    # 移除  
- 📊 可观测性检查-生产环境 / observability-prod       # 移除
✅ Observability Gate (Unified) / observability-checks # 必需
✅ Quality Gates / quality-checks                     # 必需
○ Soft Gates Quality Check                           # 可选 (中性状态)
```

### 步骤 2: 工作流文件管理

#### 阶段1 - 并行运行
```bash
# 保持所有工作流文件
ls .github/workflows/
# security.yml                 # 旧 - 保留
# security-e2e.yml            # 旧 - 保留  
# security-unified.yml         # 新 - 启用
# observability-gate.yml       # 新 - 启用 (统一)
# soft-gates.yml              # 新 - 启用
```

#### 阶段3 - 清理旧文件
```bash
# 移动旧文件到备份目录
mkdir -p .github/workflows/backup
mv .github/workflows/security.yml .github/workflows/backup/
mv .github/workflows/security-e2e.yml .github/workflows/backup/

# 或重命名为禁用状态
mv .github/workflows/security.yml .github/workflows/security.yml.disabled
```

---

## 📊 迁移验证检查清单

### ✅ 功能验证
- [ ] 新安全门禁正确检测Critical级别安全问题
- [ ] 新可观测性门禁正确验证配置一致性  
- [ ] 软门禁提供质量反馈但不阻塞合并
- [ ] 所有现有安全检查项目都被新系统覆盖
- [ ] CI执行时间明显降低 (目标: 50%)

### ✅ 安全验证  
- [ ] 安全扫描覆盖范围未减少
- [ ] Critical级别安全问题依然被阻塞
- [ ] E2E安全测试正常执行
- [ ] 无安全检测盲区或遗漏

### ✅ 流程验证
- [ ] PR创建触发所有必需检查
- [ ] 失败的检查正确阻塞合并
- [ ] 软门禁失败不阻塞合并
- [ ] 状态检查状态显示正确

### ✅ 性能验证
- [ ] CI总执行时间 < 旧系统的60%  
- [ ] 并发检查减少资源争用
- [ ] 重复检查完全消除
- [ ] 开发者等待时间明显缩短

---

## 🚨 应急回滚计划

### 触发回滚条件
- 新系统关键故障超过30分钟
- 安全检测出现遗漏或误报
- CI执行时间超过旧系统
- 团队强烈反对新系统

### 快速回滚步骤 (5分钟内)

#### 1. 立即恢复分支保护规则
```diff
# 紧急恢复旧状态检查为必需
✅ Security Checks / security-scan
✅ 🔒 安全E2E测试 / security-tests  
○ Security Gate (Unified) / security-gate        # 设为可选
✅ 📊 可观测性检查-开发环境 / observability-dev
✅ 📊 可观测性检查-预发环境 / observability-staging
✅ 📊 可观测性检查-生产环境 / observability-prod  
○ Observability Gate (Unified) / observability-checks # 设为可选
```

#### 2. 恢复旧工作流文件
```bash
# 从备份恢复
cp .github/workflows/backup/security.yml .github/workflows/
cp .github/workflows/backup/security-e2e.yml .github/workflows/

# 或重命名回来
mv .github/workflows/security.yml.disabled .github/workflows/security.yml
```

#### 3. 禁用新工作流
```bash
# 临时禁用新工作流
mv .github/workflows/security-unified.yml .github/workflows/security-unified.yml.disabled
mv .github/workflows/observability-gate.yml .github/workflows/observability-gate.yml.disabled
mv .github/workflows/soft-gates.yml .github/workflows/soft-gates.yml.disabled
```

### 回滚后处理
- **通知团队** - 回滚原因和预期修复时间
- **问题分析** - 分析故障根因，制定修复计划
- **重新部署** - 修复问题后重新开始迁移流程

---

## 📞 迁移支持

### 迁移期间联系方式
- **技术支持**: 系统管理员
- **紧急情况**: 值班工程师
- **业务咨询**: 项目经理

### 常见问题处理
- **新检查失败**: 查看工作流日志，分析具体错误
- **性能不达预期**: 检查并行配置和资源分配
- **团队适应问题**: 提供培训和文档支持

---

*迁移完成后，请删除备份的旧工作流文件并更新相关文档*