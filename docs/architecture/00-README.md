# 架构文档导航（AI 优先 · 法规中心 + 分章，可被 BMAD/Claude Code 扩充）

> 顺序：01 约束与目标 → 02 安全基线 → 03 可观测性 → 04 C4 上下文/事件流 → 05 数据端口 → 06 运行时 → 07 构建/质量门禁 → 08 功能纵切 → 09 性能容量 → 10 国际化/运维/发布

本目录是**唯一事实源**（Single Source of Truth），用于承载 PRD/架构/Stories 的可扩展骨架。

## 约定

- 文档格式：Markdown（UTF-8），章节前缀 `NN-` 仅用于排序。
- 纵切文件（08-\*）顶部统一 Front-Matter：`prd_refs / owners / non_functional / contracts / security / acceptance`。
- 任何实现/评审/测试均以本目录为准。

- **法规中心**：01/02/03 三章统一给出 NFR/SLO、Electron 安全清单、Sentry Releases & Health 与日志规范（硬门禁）。
- **执行分散**：其余各章各自携带“就地验收清单 + 类型/事件/片段”，Claude Code 按章生码即测。
- **写作约束**：
  - 禁止更改本页与 01~03 的标题与条款键名（CI 会校验）。

## 链接

- 01 约束与目标（NFR/SLO/ADR）
- 02 安全基线（Electron）
- 03 可观测性（Sentry/日志）
- 04 C4 上下文与事件流
- 05 数据模型与存储端口
- 06 运行时视图（主/渲染/Phaser）
- 07 开发与构建 + 质量门禁
- 08 功能纵切（对齐 PRD）
- 09 性能与容量规划
- 10 国际化 · 运维 · 发布
