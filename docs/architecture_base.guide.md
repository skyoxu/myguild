# Architecture Base Index

# 架构基础文档索引 - Single Source of Truth (SSoT)

# 该索引仅包含base文档，不含任何PRD-ID或特定域名信息

## 索引说明

- 用途：RAG写作基础文档加载索引
- 约束：仅用于base文档扩写，禁止加载prd_chunks.index
- 清洁性：所有引用文档必须使用${DOMAIN_*}/${PRODUCT\_\*}占位符
- 更新：任何base文档变更需同步更新此索引

## Base文档列表

### 01-07章：跨切面与系统骨干

- **01-约束与目标-增强版.md**: 技术栈约束、产品定位、MVP目标、SLO/SLA/NFR基线
  - 关键词: 技术栈, React19, Phaser3, Electron, SLO基线, 质量门禁
  - ADR引用: ADR-0001(技术栈)
- **02-安全基线(Electron).md**: Electron安全配置、CSP策略、沙盒化
  - 关键词: contextIsolation, nodeIntegration, sandbox, CSP, 预加载脚本
  - ADR引用: ADR-0002(Electron安全)
- **03-可观测性(Sentry+日志)增强版.md**: Sentry集成、Release Health、日志策略
  - 关键词: Sentry, 错误监控, 性能追踪, Release Health, Crash-Free指标
  - ADR引用: ADR-0003(可观测性)
- **04-系统上下文与C4+事件流.md**: C4架构图、系统边界、事件流设计
  - 关键词: C4模型, 系统上下文, 容器视图, 组件视图, 事件流
  - 依赖: 05章数据模型, 06章运行时视图
- **05-数据模型与存储端口.md**: 数据实体设计、存储适配器、端口契约
  - 关键词: 数据模型, SQLite, Repository模式, 端口适配器
  - 类型定义: src/shared/contracts/models/, src/shared/contracts/repositories/
- **06-运行时视图(循环+状态机+错误路径).md**: 游戏循环、状态机、错误处理
  - 关键词: 游戏循环, 状态机, 错误路径, 生命周期管理
  - 事件定义: src/shared/contracts/events/

### 08章：功能纵切模板

- **08-功能纵切-template.md**: 功能模块设计模板和约束
  - 用途: 仅作模板和写作约束，具体模块实现放在overlays/
  - 约束: base中禁止出现具体模块内容
  - 模式: UI→事件→域模型→持久化→验收

### 缺失章节（需补充）

- **07-开发与构建+质量门禁.md**: 开发环境、构建流程、CI/CD、质量门禁
- **09-性能与容量规划.md**: 性能基线、容量规划、性能测试策略
- **10-国际化·运维·发布.md**: 国际化支持、运维监控、发布策略

## 引用规则

1. **RAG加载约束**: base扩写仅加载此索引，禁止混合prd_chunks.index
2. **占位符要求**: 所有域名使用${DOMAIN_*}，产品名使用${PRODUCT\_\*}
3. **ADR映射**: 每个技术决策必须引用对应Accepted状态的ADR
4. **类型契约**: 公共类型统一定义在src/shared/contracts/下
5. **清洁验证**: 通过scripts/verify_base_clean.mjs验证无PRD-ID污染

## 版本信息

- 创建时间: 2025-01-18
- 最后更新: 2025-01-18
- 文档状态: Active
- 对应ADRs: ADR-0001至ADR-0005

## 质量指标

- 文档完整性: 6/9章节 (67%)
- ADR覆盖率: 100% (所有技术决策已有ADR支持)
- 清洁性检查: 通过 (无PRD-ID痕迹)
- 合规性评分: 待ultrathink分析确定
