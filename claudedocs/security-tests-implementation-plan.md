# 3个跳过安全测试用例的实现计划

## 概述

基于代码审查发现的3个跳过的安全测试用例，本计划提供详细的实现路径和时间表。

## 测试用例清单

### 1. Sandbox模式验证测试

**文件**: `tests/e2e/security/enhanced/enhanced-electron-security.spec.ts:48`
**当前状态**: `test.skipIf(true, '测试用例需要实现')`
**优先级**: 高 (涉及ADR-0002 Electron安全基线)

#### 实现内容

- 验证Electron渲染进程确实运行在sandbox模式下
- 检查是否能访问被sandbox限制的Node.js API
- 验证文件系统访问限制
- 测试网络访问限制

#### 实现步骤

1. 移除 `test.skipIf(true)` 跳过逻辑
2. 实现sandbox环境检测：
   ```typescript
   const sandboxEnabled = await page.evaluate(() => {
     // 检查sandbox特征
     return {
       hasRequire: typeof window.require !== 'undefined',
       hasProcess: typeof window.process !== 'undefined',
       hasFilesystem: typeof window.fs !== 'undefined',
       // 尝试访问被sandbox限制的功能
     };
   });
   ```
3. 添加具体的sandbox限制验证
4. 更新测试预期结果

#### 时间估算：2-3小时

### 2. CSP违规报告功能测试

**文件**: `tests/e2e/security/enhanced/enhanced-csp-security.spec.ts:64`
**当前状态**: `test.skipIf(true, '测试用例需要实现')`
**优先级**: 中 (增强安全监控能力)

#### 实现内容

- 设置CSP违规报告端点
- 故意触发CSP违规
- 验证违规报告是否正确发送
- 检查报告内容的完整性

#### 实现步骤

1. 创建本地测试服务器接收CSP报告
2. 配置测试环境的CSP报告端点
3. 实现违规触发逻辑：
   ```typescript
   // 设置report-uri或report-to
   await page.addInitScript(() => {
     // 监听securitypolicyviolation事件
     document.addEventListener('securitypolicyviolation', e => {
       window.cspViolations = window.cspViolations || [];
       window.cspViolations.push({
         violatedDirective: e.violatedDirective,
         blockedURI: e.blockedURI,
         originalPolicy: e.originalPolicy,
       });
     });
   });
   ```
4. 验证报告机制工作正常

#### 时间估算：3-4小时

### 3. CSP策略完整性检查测试

**文件**: `tests/e2e/security/enhanced/enhanced-csp-security.spec.ts:70`
**当前状态**: `test.skipIf(true, '测试用例需要实现')`
**优先级**: 高 (确保CSP配置符合ADR-0002安全基线)

#### 实现内容

- 解析当前页面的CSP策略
- 验证关键安全指令的存在和正确性
- 检查是否存在不安全的配置
- 与ADR-0002定义的安全基线对比

#### 实现步骤

1. 实现CSP策略提取器：
   ```typescript
   const cspPolicy = await page.evaluate(() => {
     const metaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
     const headerPolicy = /* 从HTTP响应头获取 */;
     return {
       metaPolicy: metaTag?.getAttribute('content'),
       headerPolicy: headerPolicy,
       combined: /* 合并策略 */
     };
   });
   ```
2. 建立ADR-0002安全基线检查清单：
   - 必须有`default-src`限制
   - 禁止`unsafe-inline`和`unsafe-eval`
   - `script-src`必须限制
   - `connect-src`必须有allow-list
3. 实现策略解析和验证逻辑
4. 生成详细的合规性报告

#### 时间估算：2-3小时

## 实施时间表

### 第1阶段：基础实现 (1周内)

- **第1-2天**: 实现sandbox模式验证测试
- **第3-4天**: 实现CSP策略完整性检查测试
- **第5-7天**: 实现CSP违规报告功能测试

### 第2阶段：测试优化 (3天内)

- 测试用例稳定性优化
- 错误处理和边界条件覆盖
- 与现有测试套件集成验证

## 技术依赖

### 工具和库

- Playwright Test Framework (已有)
- Electron测试环境 (已配置)
- 本地HTTP服务器 (需要添加，用于CSP报告接收)

### 配置文件变更

- 可能需要更新`playwright.config.ts`
- 测试环境的CSP配置调整
- CI/CD管道中的测试执行配置

## 风险和缓解策略

### 主要风险

1. **Electron版本兼容性**: 不同Electron版本的sandbox行为差异
2. **CSP策略冲突**: 测试环境与生产环境的策略差异
3. **异步测试稳定性**: CSP违规报告的异步特性

### 缓解措施

1. 版本检查和适配逻辑
2. 环境隔离的测试配置
3. 适当的等待和重试机制

## 验收标准

### 功能验收

- [ ] 所有3个测试用例能够正常执行(非跳过状态)
- [ ] 测试覆盖率符合项目质量门禁要求(≥90%)
- [ ] 测试用例在CI环境中稳定通过

### 质量验收

- [ ] 测试代码通过ESLint检查
- [ ] 符合项目测试编码约定
- [ ] 包含必要的错误处理和日志记录

### 文档验收

- [ ] 更新测试用例文档
- [ ] 添加必要的代码注释
- [ ] 更新ADR-0002相关的测试覆盖说明

## 后续维护

### 定期维护任务

1. **月度**: 检查Electron版本更新对sandbox测试的影响
2. **季度**: 评估CSP策略是否需要根据安全最佳实践更新
3. **年度**: 全面审查安全测试覆盖范围和有效性

### 监控指标

- 测试执行成功率
- 测试执行时间
- 安全基线合规性得分

---

**创建时间**: 2025-09-05  
**负责人**: Claude Code  
**关联文档**: ADR-0002, CLAUDE.md 第6节安全基线  
**状态**: 待实施
