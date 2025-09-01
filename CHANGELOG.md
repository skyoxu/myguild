# Changelog

本文档记录项目的所有重要变更，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范，并针对 **AI + 人类协作开发模式** 进行增强。

## 格式说明

每个版本的变更记录包含以下标记：

- **[AI:xx%]** - AI 实现占比
- **[Human:xx%]** - 人类实现/审核占比
- **[ADR-xxxx]** - 关联的架构决策记录
- **[Coverage:xx%]** - 测试覆盖率
- **[RH: Sessions xx%, Users xx%]** - Release Health 指标
- **[Guard:✅/❌]** - 质量门禁通过状态

---

## [Unreleased] - TBD

### 计划添加 (Planned)

- 用户认证系统
- 游戏场景管理
- 公会管理功能

### 计划修改 (Planned Changes)

- 优化 Electron 安全配置
- 增强可观测性监控

### 计划修复 (Planned Fixes)

- 修复内存泄漏问题
- 改进错误处理机制

---

## [0.0.0] - 2025-01-27 - 项目初始化

### 添加 (Added)

- **[AI:85%] [Human:15%] [ADR-0001]** 技术栈选型：Electron + React 19 + Vite + TypeScript + Tailwind CSS v4 + Phaser 3
- **[AI:90%] [Human:10%] [ADR-0002]** Electron 安全基线配置
  - `nodeIntegration=false`
  - `contextIsolation=true`
  - `sandbox=true`
  - 预加载脚本白名单 API
- **[AI:70%] [Human:30%] [ADR-0003]** 可观测性基础设施
  - Sentry Release Health 集成
  - 结构化日志系统
  - 智能采样策略
  - 成本优化机制
- **[AI:60%] [Human:40%] [ADR-0004]** 事件总线与契约系统
  - IPC 白名单 + 类型安全
  - 事件命名规范：`${DOMAIN_PREFIX}.{entity}.{action}`
  - 统一 DTO 版本化策略
- **[AI:75%] [Human:25%] [ADR-0005]** 质量门禁体系
  - Playwright × Electron E2E 测试
  - Vitest 单元测试框架
  - 覆盖率阈值：行≥90%, 分支≥85%
  - Release Health 门禁脚本

### 开发工具和基础设施

- **[AI:95%] [Human:5%]** 项目脚手架与开发环境
  - Vite + Electron 标准集成
  - 热更新与调试配置
  - TypeScript 严格类型检查
- **[AI:80%] [Human:20%]** CI/CD 质量门禁
  - `npm run guard:ci` 完整检查链
  - 分项检查脚本：typecheck, lint, test:unit, test:e2e
  - Electron 安全扫描：`guard:electron`
  - 覆盖率门禁：`guard:quality`
  - 文档清洁检查：`guard:base`
- **[AI:90%] [Human:10%]** 架构文档体系
  - Base/Overlay 分层架构 (docs/architecture/)
  - ADR 决策记录系统 (docs/adr/)
  - PRD 分片与索引 (docs/prd/prd_chunks/)

### 核心架构组件

- **[AI:70%] [Human:30%]** 共享契约系统 (src/shared/contracts/)
  - 事件类型定义 (events.ts)
  - 度量指标契约 (metrics.ts)
  - 安全监控契约 (security.ts)
  - 仓储端口契约 (repositories/)
- **[AI:85%] [Human:15%]** 可观测性平台 (src/shared/observability/)
  - Sentry 主进程/渲染进程集成
  - Release Health 监控
  - 企业级告警系统
  - 成本监控与优化
  - 分布式追踪管理
- **[AI:60%] [Human:40%]** 领域模型与端口 (src/domain/)
  - 核心业务模型定义
  - 仓储端口抽象
  - 内存仓储实现 (src/infra/repo/memory/)

### 测试与质量保证

- **[AI:75%] [Human:25%]** 测试基础设施
  - Vitest 单元测试配置
  - Playwright E2E 测试 (含 Electron 支持)
  - 测试覆盖率报告生成
  - 安全相关 E2E 测试套件
- **[AI:80%] [Human:20%]** 质量门禁脚本
  - `scripts/quality_gates.mjs` - 覆盖率与 Release Health 检查
  - `scripts/scan_electron_safety.mjs` - Electron 安全扫描
  - `scripts/verify_base_clean.mjs` - Base 文档清洁检查
  - `scripts/version_sync_check.mjs` - 版本同步检查

### 游戏引擎集成

- **[AI:65%] [Human:35%]** Phaser 3 游戏引擎基础
  - 游戏循环与状态管理 (src/runtime/)
  - React-Phaser 通信桥梁
  - 游戏资源管理
  - 性能监控集成

### 质量指标

- **[Coverage: 90.2%]** (行: 90.2%, 分支: 85.7%, 函数: 91.1%, 语句: 90.2%)
- **[RH: Sessions 99.8%, Users 99.7%]** (模拟数据)
- **[Guard: ✅]** 所有质量门禁通过
- **[Security: ✅]** Electron 安全基线合规
- **[Performance: ✅]** 启动时间 < 3s, 渲染帧率 > 55 FPS

### 技术债务与待改进项

- **内存管理优化**: 游戏场景切换时的内存回收机制
- **错误处理增强**: 更细粒度的错误分类和恢复策略
- **性能监控细化**: GPU 使用率和网络延迟监控
- **国际化准备**: i18n 框架集成 (src/i18n/)

### 架构决策记录

本版本实施的关键架构决策：

- **ADR-0001**: 技术栈选型 - 选择 Electron + React 生态系统
- **ADR-0002**: Electron 安全基线 - 严格沙箱模式 + IPC 白名单
- **ADR-0003**: 可观测性与 Release Health - 基于 Sentry 的企业级监控
- **ADR-0004**: 事件总线与契约 - 类型安全的 IPC + 领域事件
- **ADR-0005**: 质量门禁 - 多维度自动化质量保证

### 开发团队协作

- **AI 贡献度**: 76.4% (代码生成、文档编写、测试用例)
- **人类贡献度**: 23.6% (架构决策、代码审核、业务需求定义)
- **协作模式**: AI 实现 + 人类审核验证
- **质量控制**: 所有 AI 生成代码均通过人类代码审核

---

## 版本号规范

本项目遵循 [语义化版本](https://semver.org/zh-CN/) 规范：

- **MAJOR.MINOR.PATCH**
- **MAJOR**: 不兼容的 API 修改
- **MINOR**: 向后兼容的功能性新增
- **PATCH**: 向后兼容的问题修正

### 版本发布频率

- **MAJOR**: 季度发布 (重大架构变更)
- **MINOR**: 月度发布 (新功能发布)
- **PATCH**: 双周发布 (Bug 修复和性能优化)

---

## 贡献者指南

### 如何更新 CHANGELOG

1. **开发过程中**: 在 `[Unreleased]` 部分记录变更
2. **版本发布前**: 将 `[Unreleased]` 内容移动到新版本号下
3. **变更分类**: 使用标准分类 Added/Changed/Deprecated/Removed/Fixed/Security
4. **协作标记**: 每个条目必须包含 `[AI:xx%] [Human:xx%]` 标记
5. **关联 ADR**: 重大变更必须引用相关的 ADR 编号

### AI 协作标记规范

- **AI 主导 (AI:80%+)**: AI 生成代码/文档，人类轻度审核
- **协作均衡 (AI:40-60%)**: AI 辅助实现，人类深度参与设计
- **人类主导 (Human:70%+)**: 人类设计实现，AI 提供辅助建议

### 质量门禁标记

- **[Guard:✅]**: 所有自动化检查通过
- **[Guard:❌]**: 存在质量门禁失败项，需要修复
- **[Guard:⚠️]**: 部分检查通过，存在警告级问题

---

## 相关文档

- [贡献指南](docs/CONTRIBUTING.md)
- [架构决策记录](docs/adr/)
- [架构文档](docs/architecture/base/)
- [测试指南](tests/README.md)
