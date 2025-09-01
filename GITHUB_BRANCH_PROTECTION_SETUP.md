# GitHub 分支保护规则配置指南

> 配置GitHub分支保护规则，强制执行P0安全质量门禁，确保所有合并到主分支的代码都通过安全验证

## 🎯 配置目标

- **强制P0安全门禁**：禁止任何包含Critical/High级别安全问题的代码合并
- **自动化质量保障**：通过CI状态检查确保代码质量
- **防护主分支**：保护 `main` 分支不受直接推送影响
- **审查流程**：要求PR审查通过才能合并

## 🔧 必需的状态检查

基于当前CI工作流配置，以下状态检查**必须通过**才能合并到主分支：

### 1. 质量门禁检查 (ci.yml)
```
质量门禁检查 / quality-gates
```
- ESLint代码规范检查
- TypeScript编译验证
- 可观测性门禁检查

### 2. 安全扫描 (security.yml)  
```
Security Checks / security-scan
```
- Electronegativity Electron安全扫描 
- npm audit 依赖安全检查
- Snyk 第三方漏洞扫描
- **P0安全门禁** - 任何Critical级别问题直接拒绝合并

### 3. 构建验证 (ci.yml)
```
CI/CD Pipeline / build-and-test
```
- 多版本Node.js构建测试
- 单元测试 + 覆盖率检查
- 生产构建验证

### 4. E2E测试 (ci.yml)
```
CI/CD Pipeline / e2e-tests  
```
- Electron应用启动测试
- Playwright端到端测试
- 安全配置验证

## 📋 分支保护配置步骤

### 步骤 1: 访问分支保护设置

1. 在GitHub仓库页面，进入 **Settings** → **Branches**
2. 点击 **Add rule** 或编辑现有的 `main` 分支规则

### 步骤 2: 基础保护配置

✅ **勾选以下基础保护选项**：

```
☑️ Restrict pushes that create files larger than 100 MB
☑️ Require a pull request before merging
   ☑️ Require approvals (设置为 1)
   ☑️ Dismiss stale pull request approvals when new commits are pushed
   ☑️ Require review from code owners (如果有CODEOWNERS文件)
☑️ Require status checks to pass before merging
   ☑️ Require branches to be up to date before merging
☑️ Require conversation resolution before merging
☑️ Require signed commits
☑️ Restrict pushes to matching branches
```

### 步骤 3: 配置必需状态检查

在 **"Require status checks to pass before merging"** 部分，添加以下状态检查：

#### 核心状态检查 (必须全部通过)
```
质量门禁检查
Security Checks / security-scan
CI/CD Pipeline / build-and-test
CI/CD Pipeline / e2e-tests
```

#### 可选状态检查 (建议启用)
```
Observability Gate
Performance Check
Config Management Validation
```

### 步骤 4: 高级安全配置

✅ **额外安全选项**：

```
☑️ Require deployments to succeed before merging
☑️ Do not allow bypassing the above settings
☑️ Allow force pushes (❌ 不要勾选)
☑️ Allow deletions (❌ 不要勾选)
```

## 🚨 P0安全门禁说明

### 自动拦截条件

当PR包含以下任一情况时，**自动拒绝合并**：

1. **Critical级别安全问题** (任何数量) 
2. **Electronegativity HIGH级别** Electron安全问题
3. **npm audit Critical漏洞** 
4. **Snyk Critical安全漏洞**
5. **TruffleHog检测到secrets泄露**

### 警告条件

以下情况会显示警告但**不阻止合并**：
- High级别问题 ≤ 5个 
- Medium/Low级别安全问题
- 性能影响在可接受范围内

### 门禁通过标准

```bash
✅ Critical级别安全问题: 0
✅ Electronegativity扫描: 无HIGH级别问题  
✅ npm audit: 无Critical漏洞
✅ Snyk扫描: 无Critical漏洞
✅ 代码泄露检查: 通过
✅ 构建&测试: 全部通过
```

## 🔄 紧急流程

### 生产紧急修复

在紧急情况下，**仓库管理员**可以：

1. 临时禁用特定状态检查
2. 创建临时分支保护规则  
3. 合并紧急修复后**立即恢复**所有保护规则
4. 在下一个版本中补齐所有安全检查

⚠️ **警告**: 紧急绕过必须在24小时内补齐安全验证

### 跳过流程记录

所有绕过分支保护的操作必须记录：
- 操作人员和时间
- 跳过原因  
- 风险评估
- 补救计划和完成时间

## 📊 监控和报告

### CI状态监控

在PR页面查看所有状态检查：
```
✅ 质量门禁检查 — 通过
✅ Security Checks / security-scan — 通过  
✅ CI/CD Pipeline / build-and-test — 通过
✅ CI/CD Pipeline / e2e-tests — 通过
```

### 安全报告下载

每次CI运行后，可在Actions页面下载：
- `security-reports` - 详细安全扫描结果
- `security-gate-report` - P0门禁HTML报告

### 团队通知配置

建议配置以下通知：
1. **Slack/Teams集成** - 安全门禁失败时通知
2. **邮件通知** - Critical安全问题发现时通知
3. **GitHub通知** - 所有PR状态检查结果

## 🎯 验证配置

### 配置完成检查清单

- [ ] 分支保护规则已创建并启用
- [ ] 所有必需状态检查已添加
- [ ] PR审查要求已配置
- [ ] 签名提交要求已启用
- [ ] 直接推送已禁止
- [ ] 删除和强制推送已禁止

### 功能测试

创建一个测试PR验证：
1. 能否绕过状态检查合并 (应该被阻止)
2. 单独审查是否能绕过CI检查 (应该被阻止) 
3. 所有检查通过时是否能正常合并 (应该成功)

## 🔗 相关文档

- [安全修复完成报告](./SECURITY-CI-FIX-REPORT.md)
- [CSP安全违规修复报告](./CSP-SECURITY-FIX-REPORT.md)  
- [GitHub工作流配置](./.github/workflows/)
- [Electron安全配置](./electron/security/)

---

## 📞 支持联系

**配置支持**: Claude Code AI Assistant  
**紧急联系**: 项目维护团队  
**文档更新**: 随CI工作流变更同步更新

---

**🔒 安全提醒**: 分支保护是代码质量和安全的最后一道防线。配置完成后，请定期检查和更新保护规则，确保与项目安全要求保持一致。