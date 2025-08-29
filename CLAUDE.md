# CLAUDE.md
> Single source of truth for how AI tools work **together** in this repo. Keep this file short, prescriptive, and executable.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
- ***直言不讳+止损机制***请用中文回答我的所有问题，每次都用审视的目光，仔细看我输入的潜在问题，你要指出我的问题，并给出明显在我思考框架之外的建议。
- **操作系统限定**：默认环境为 **Windows**。所有脚本/命令/依赖安装步骤必须提供 Windows 兼容指引（如 PowerShell、py/python 选择、Playwright 驱动安装等）
- 编写 .md文档时，正文也要用中文，但是**文件名**，**名词解释**可以使用英文
- **日志输出目录**：运行时与构建日志统一写入 logs/ 目录（按日期/模块分子目录），便于排障与归档
- **安全合规**：仅防御安全；拒绝进攻性/潜在滥用代码请求
- **代码与改动**：遵循项目现有约定；先看周边文件/依赖
- **任务管理**：强制频繁使用 TodoWrite 规划/跟踪；逐项标记进行/完成，不要堆到最后

## 设计原则：
- AI 优先 + arc42 思维：按 不可回退 → 跨切面 → 运行时骨干 → 功能纵切 顺序

## 0 Scope & Intent
- **Base 文档**：`docs/architecture/base/**` —— 跨切面与系统骨干（01–07、09、10 章），**无 PRD 痕迹**（以占位 `${DOMAIN_*}` `${PRODUCT_*}` 表达）。
- **ADR**：Architecture Decision Record；**Accepted** 的 ADR 代表当前有效口径。
- **SSoT**：Single Source of Truth；01/02/03 章统一口径（NFR/SLO、安全、可观测性）。
- **Upstream**: BMAD v4 produces PRD + Architecture (arc42 overlays; CH01/CH03 at minimum; ADR-0001…0005 adopted, more as needed).
- **Planning**: Taskmaster converts **PRD → Tasks** with back-links to ADR/CH/Overlay.
- **Implementation & Quality**: Claude Code is primary; **SuperClaude** automates commits/changelogs/reviews; **Serena** handles symbol-level refactors and cross-file test-driven edits.
- **Acceptance**: Official **Subagents** perform checklists/reviews; **Zen MCP** augments analysis with multi‑model reasoning.

## Electron × Vite 脚手架（替换原“vanilla”）

- **推荐**：Vite + Electron标准集成，获得清晰的目录分离与热更新、调试与打包集成。
- 目录约定（当前项目结构）：
  ├─ src/          # React 19 + Tailwind v4 + Phaser 3 渲染进程
  ├─ electron/     # Electron 主进程与预加载脚本（ESM）
  │  ├─ main.ts    # 主进程入口
  │  └─ preload.ts # contextBridge 白名单 API
  ├─ tests/        # Vitest单元测试 + Playwright E2E测试
  └─ index.html    # 严格 CSP
- 初始化命令（当前项目使用）：
  1. 标准Vite + Electron集成
  npm install
  npm run dev      # Vite开发服务器
  npm run dev:electron  # Electron应用

  2. 质量门禁检查
  npm run guard:ci  # 完整CI检查链


## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Project Structure

After initialization, the project will have:
- `index.html` - Main HTML entry point
- `src/` - Source code directory
  - `main.js` or `main.ts` - Application entry point
  - `style.css` - Global styles
- `public/` - Static assets
- `package.json` - Dependencies and scripts
- `docs/adr/` - ADR文件目录
- `docs/architecture/base/` - 综合技术文档清洁版本
- `docs/architecture/overlays/<PRD-ID>/` - 综合技术文档对应<PRD-ID>版本
- `docs/prd/prd_chunks/ + prd_chunks.index`- prd分片及索引
- `architecture_base.index` - 综合技术文档清洁版本的索引

## Base / Overlay 目录约定
```
docs/
  architecture/
    base/                 # SSoT：跨切面与系统骨干（01–07、09、10）
      01-introduction-and-goals-v2.md
      02-security-baseline-electron-v2.md
      03-observability-sentry-logging-v2.md
      04-system-context-c4-event-flows-v2.md
      05-data-models-and-storage-ports-v2.md
      06-runtime-view-loops-state-machines-error-paths-v2.md
      07-dev-build-and-gates-v2.md
      08-crosscutting-and-feature-slices.base.md            # 仅模板/约束/占位示例
      09-performance-and-capacity-v2.md
      10-i18n-ops-release-v2.md
      11-risks-and-technical-debt-v2.md
      12-glossary-v2.md
    overlays/
      PRD-<PRODUCT>/
        08/
          08-功能纵切-<模块A>.md
          08-功能纵切-<模块B>.md
          _index.md
```

## Game Development Guidelines

- Use ES modules for code organization
- Leverage Vite's HMR for rapid development
- Consider using Canvas API or WebGL for rendering
- Structure game logic into modular components (scenes, entities, systems)
- Use TypeScript for better type safety and tooling
- Comments should concisely describe the function's purpose. Use a /* */ block comment above each exported function to specify its parameters and return value.

## Common Patterns

- Game loop in `main.js` using `requestAnimationFrame`
- Component-based architecture for game objects
- Asset loading and caching strategies
- Input handling abstraction (keyboard, mouse, touch)
- State management for game scenes

## 技术栈选型
| 层次         | 选型               | 核心作用                     |
|--------------|--------------------|-----------------------------|
| 桌面容器     | **Electron**       | 跨平台打包 & Node API 集成   |
| 游戏引擎     | **Phaser 3**       | WebGL渲染 & 场景管理         |
| UI框架       | **React 19**       | 复杂界面组件开发             |
| 构建工具     | **Vite**           | Dev服务器 & 生产打包         |
| 开发语言     | **TypeScript**     | 全栈强类型支持               |
| 数据服务     | **SQLite**         | 高性能本地数据库             |
| 样式方案     | **Tailwind CSS**   | 原子化CSS开发               |
| 演示部署     | Vercel             | CDN & Edge函数支持          |
| aiComputing | **Web Worker**     | AI计算线程分离               |
| configStorage | **Local JSON**   | 配置文件存储                 |
| communication | **EventBus**     | Phaser ↔ React通信          |

1. **React：强制 v19**（禁止 v18 及以下），若使用第三方库需确认兼容性
2. **Tailwind CSS：强制 v4**（禁止 v3 及以下），按 v4 配置方式执行
3. **模块系统：禁止 CommonJS**；前端/预加载/渲染一律使用 **ESM**
4. **TypeScript 优先**：默认以 TypeScript 实现；如因工具链限制必须使用 JS，需在 PR 说明中**写明原因与计划回迁**
5. **强类型约束**：数据结构应提供类型定义；如因探索性开发临时使用 any / 非结构化 JSON，需在代码处标注 TODO 与回迁计划，并在 PR 中说明

**除非计划中特别指明，否则不要引入其他库**

## 核心行为规则
1. 你会在对话输出完毕后选择适当的时机向用户提出询问，例如是否需要添加后端能力，是否打开预览，是否需要部署等
2. 交互式反馈规则：在需求不明确时主动与用户对话澄清，优先使用自动化工具 interactiveDialog 完成配置。执行高风险操作前必须使用 interactiveDialog 获得用户确认。保持消息简洁并用ASCII标记状态。
3. **Test-driven development must** - Never disable tests, fix them

## 1 Context Discipline (RAG Rules)
1. **凡会落地为代码/测试的改动，必须引用 ≥ 1 条 *Accepted* ADR。**  
   若改动改变阈值/契约/安全口径：**新增 ADR** 或 **以 `Superseded(ADR-xxxx)` 替代旧 ADR**。
- Local sessions: prefer `claude --add-dir shards` to reference `@shards/*` paths directly.
2. **08 章（功能纵切）只放在 overlays**：
   - base 仅保留 `08-功能纵切-template.md` 模板与写作约束；**禁止**在 base 写任何具体模块内容。
   - 08 章**引用** 01/02/03 的口径，**禁止复制阈值/策略**到 08 章正文。事件命名规则：
     `\${DOMAIN_PREFIX}.<entity>.<action>`；接口/DTO 统一落盘到 `src/shared/contracts/**`。
3. **TS 强化约定**：
   - **类型定义位置**：公共 DTO/事件/端口类型一律放在 src/shared/contracts/**，其他章节引用不复制。
   - **any 使用门槛**：出现 any 时，必须同时提供：// TODO: remove any | owner | due 注释 + Issue 链接 + 回迁计划。
   - **公共命名**：事件命名统一为 \${DOMAIN_PREFIX}.<entity>.<action>；模块展示标注 data-testid="<模块>-root" 以便 Playwright 选择器稳定。
4. Use **only**: `@architecture_base.index`, `@prd_chunks.index`, `@shards/flattened-prd.xml`, `@shards/flattened-adr.xml` for overlay‑related work. Do **not** rescan `docs/` or rebuild flattened XML.
5. Overlays: write to `docs/architecture/overlays/<PRD-ID>/08/`. 08章只写**功能纵切**（实体/事件/SLI/门禁/验收/测试占位）；跨切面规则仍在 Base/ADR。

---

## 2 Tool Roles & Allowed Usage

### 2.1 Claude Code (primary)
- Use project **slash commands** in `.claude/commands/**` when available (`/architect`, `/taskmaster`, etc.).
- Keep edits minimal, test-driven, and tied to ADR/CH.
- Never broad‑read entire repo; always cite exact files with `@path`.

### 2.2 Taskmaster — PRD → Tasks
- Input: single‑file PRD at `.taskmaster/docs/prd.txt` (merged from `docs/prd_chunks/*`, FM removed).
- Generate initial tasks: `npx task-master parse-prd .taskmaster/docs/prd.txt -n 30` (tune `-n`).  
- Persist to `tasks/tasks.json` with required fields:
  - `adrRefs: ["ADR-0002", …]` (≥1), `archRefs: ["CH01","CH03", …]` (≥1), optional `overlay: "docs/architecture/overlays/<PRD-ID>/08/..."`.
- Run `node scripts/validate-task-links.mjs` (Ajv) to enforce ADR/CH back‑links & file existence. Failing PRs **cannot merge**.

### 2.3 SuperClaude — Git automation
- Use for: **commit messages**, **changelogs**, **automated code reviews**.
- Commands (examples; adapt to local scripts):
  - `superclaude commit` → generate conventional commit w/ ADR/CH refs.
  - `superclaude changelog` → update `CHANGELOG.md` from history.
  - `superclaude review --staged` → summarize diffs + risks; produce review notes.
- Guardrails: never auto‑commit failing builds; never bypass hooks (`--no-verify` forbidden).

### 2.4 Serena — symbol‑level refactors & TDD edits
- Use when you need **semantic (LSP‑aware)** changes: cross‑file rename, API migration, test‑driven fixes in large repos.
- Typical prompts:
  - “Rename `GuildService` → `GuildManagerService` across repo, update imports/usages/tests; keep changes atomic.”
  - “Change interface contract `GuildId` → `GuildUID` and update affected DTOs + TS types; regenerate failing tests.”
- Guardrails: propose a diff; run unit/E2E locally; large refactors go through PR with full review & CI.

### 2.5 Official Subagents — acceptance & audits
- Use to run **acceptance checklists** and doc‑out final overlays:  
  _“Use the acceptance subagent to verify Overlay CH01/CH03/SLOs, security baseline, and CloudEvents builder; report failures with file+line links.”_
- Subagents run with a **separate context**; keep them **read‑mostly** unless an edit is explicitly approved.

### 2.6 Zen MCP — multi‑model validation
- Use for: cross‑model code analysis, property‑based test suggestions, tricky bug triage, standards checks.
- Keep it **stateless** for safety; paste back results as comments or PR reviews. Do not grant destructive tools by default.

---

## 3 Planning & Staging with Taskmaster
> `IMPLEMENTATION_PLAN.md` is **optional** — create only for multi‑day, cross‑module, or migration/rollback‑risky work.
- Template:
  ```markdown
  ## Stage N: [Name]
  **Goal**: [Specific deliverable]
  **Success Criteria**: [Testable outcomes]
  **Tests**: [Specific test cases]
  **Risks/Mitigations**: [Known risks + rollback]
  **Status**: [Not Started|In Progress|Complete]
  ```
- Tasks spawned from the plan **must** include `adrRefs` + `archRefs` and copy acceptance criteria from Overlay/PRD.

---

## 4 Engineering Workstyle
- Small, green steps; learn from existing code; pragmatic choices; clarity over cleverness.
- TDD‑leaning flow: Understand → Test (red) → Implement (green) → Refactor → Commit (explain **why**, link ADR/CH/Issue/Task).
- When stuck (max 3 attempts): log failures; list 2–3 alternatives; question abstraction/scope; try the simpler path.

---

## 5 Technical Standards
### Architecture
- Composition over inheritance (DI), interfaces over singletons, explicit over implicit.

### Code Quality
- Every commit compiles, passes tests, and follows format/lint; new code adds tests; no `--no-verify`.

### Error Handling
- Fail fast with context; handle at the right layer; no silent catches.

---

## 6 Security & Privacy Baseline (Electron)
- `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`.
- Strict CSP: dev via response headers; packaged via `<meta http-equiv="Content-Security-Policy">`; no `'unsafe-inline'/'unsafe-eval'`; `connect-src` allow‑list (Sentry/API/etc.).
- Main‑process guards: window open/navigation/permission handlers; preload exports are **whitelist‑only** with parameter validation.

---

## 7 Observability & Release Health
- Sentry Releases + Sessions **must** be enabled to compute **Crash‑Free Sessions/Users**. Thresholds are env‑configurable; CI blocks below threshold.
- Logs are structured and sampled; scrub PII at SDK (preferred) and/or server policy.

---

## 8 输出格式与附带物（让“规范可执行”）
- 任何“可执行规范”（章节/Story/task）**必须附带**：
  1) **接口/类型/事件**的 TypeScript 片段（放入 `src/shared/contracts/**`）；  
  2) **就地验收**测试片段（Vitest/Playwright Electron）。
- 08 章文档产出**必须**同步/创建 `Test-Refs` 对应的测试文件（可先放占位）。
- 事件/端口的类型与契约**统一引用**于 `src/shared/contracts/**`，避免口径漂移。
- 生成/审阅内容时，**先质疑再生成**：对潜在误解与边界条件优先提示，必要时提出替代方案或降级路线。

---

## 9 Quality Gates (CI/CD)
- Required checks (branch protection):
  - `playwright-e2e` (Electron smoke/security/perf)
  - `vitest-unit` (contracts & units)
  - `task-links-ajv` (ADR/CH back‑links)
  - `release-health` (Crash‑Free threshold)
  - (optional) `superclaude-review` (AI review notes exist)
- Pipeline: typecheck → lint → unit → e2e → task link validation → release‑health → package.
- Merges require **green** pipeline; “Require status checks” must be enabled on protected branches.

---

## 10 Definition of Done (DoD)
- [ ] Unit/E2E tests written and passing  
- [ ] Code follows conventions; no lint/format warnings  
- [ ] Commit messages clear; link ADR/CH/Issue/Task  
- [ ] Matches Overlay acceptance checklist  
- [ ] No stray TODOs (or reference issues)

---

## 11 Housekeeping
- Prefer Node scripts over bash for cross‑platform tasks.
- Keep slash commands project‑scoped; avoid broad reads.
- Use `--add-dir shards` to reference flattened XML/indexes when needed.
- Keep ADR log current; tasks/commits/PRs **must** back‑link ADR/CH/Overlay.

## 12 质量门禁（本地/CI 一致）
> 最小门禁以脚本方式固化，均可在本地与 CI 运行；阈值可通过环境变量覆盖。
- **脚本**（建议存在）：
  - `scripts/scan_electron_safety.mjs` —— 检查 BrowserWindow/Preload/CSP 是否符合基线
  - `scripts/quality_gates.mjs` —— 覆盖率（lines ≥90% branches ≥85%）
  - `scripts/verify_base_clean.mjs` —— Base 文档“清洁检查”（不得含 `PRD-ID:` 与真实域前缀）
- **统一入口**：在 `package.json` 中配置 `guard:ci`：
  ```json
  {
    "scripts": {
      "typecheck": "tsc - p tsconfig.json --noEmit",
      "lint": "eslint . --ext .ts,.tsx",
      "test:unit": "vitest run --coverage",
      "test:e2e": "playwright test",
      "guard:electron": ,
      "guard:quality": ,
      "guard:base": ,
      "guard:ci": 
    }
  }
  ```
**Python**：如需 Python，请同时支持 py -3 -m pip 与 python -m pip；并在文档中标注最低版本。
**Playwright**：在 Windows 上提供 npx playwright install --with-deps 的替代说明（某些依赖可省略 --with-deps）
**Shell 脚本**：为关键脚本提供 PowerShell 版本（如 scripts/*.ps1），或在 package.json 用 Node 脚本替代纯 Bash

---

## 13 默认 ADR 映射（可扩展）
- **ADR-0001-tech-stack**：
- **ADR-0002-electron-security**：
- **ADR-0003-observability-release-health**：
- **ADR-0004-event-bus-and-contracts**：
- **ADR-0005-quality-gates**：
- **ADR-0006-data-storage**：
- **ADR-0007-ports-adapters**：
- **ADR-0008-deployment-release**：
- **ADR-0009-cross-platform**：
- **ADR-0010-internationalization**：

> 任何章节/Story 若改变上述口径，**必须**新增或 Supersede 对应 ADR。

---

## 14 Claude 写作前自检（内置检查清单）
- 目标文件属于 **base** 还是 **overlay**？（base 禁 PRD-ID，overlay 必带 PRD-ID 与 ADRs）  
- 是否涉及 **Electron 安全、事件契约、质量门禁、Release Health**？若是，请**引用** ADR‑0002/0004/0005/0003。  
- 08 章是否只**引用** 01/02/03 的口径（不复制阈值）？  
- 是否附带 **TypeScript 契约片段** 与 **就地验收**（Vitest/Playwright）？  
- PRD Front‑Matter 的 `Test-Refs` 是否已更新到新用例或占位用例？

---

## 15 PR 模板要求（最少需要在 `.github/PULL_REQUEST_TEMPLATE.md` 勾选）
- [ ] 更新/新增 `src/shared/contracts/**` 的接口/类型/事件。  
- [ ] 更新/新增 `tests/unit/**`（Vitest）与 `tests/e2e/**`（Playwright Electron）。  
- [ ] 涉及 PRD：Front‑Matter 的 `Test-Refs` 指向相应用例。  
- [ ] 变更口径/阈值/契约：已新增或 *Supersede* 对应 ADR 并在 PR 描述中引用。

---

## 16 版本约束与脚手架建议
- **Electron 集成**：优先使用 `electron-vite` 或 `vite-plugin-electron` 提供的主/渲染/预加载目录与热更；统一目录约定便于脚本扫描。

---

## 17 违例处理
- 缺失 `ADRs`、复制阈值进 08 章、Base 出现 PRD-ID、遗漏 `Test-Refs` 等：Claude/BMAD 应**拒绝写入**并返回“拒绝原因 + 自动修复建议 + 需要引用/新增的 ADR 清单”。
- 需要新增 ADR 时，自动生成 `docs/adr/ADR-xxxx-<slug>.md` 的 *Proposed* 草案并提示审阅。

> **备注**：本 Rulebook 与项目中的脚本/模板、Base/Overlay 结构**强关联**。请保持这些文件存在且更新：  
> `scripts/scan_electron_safety.mjs` · `scripts/quality_gates.mjs` · `scripts/verify_base_clean.mjs` · `.github/PULL_REQUEST_TEMPLATE.md` · `docs/architecture/base/08-功能纵切-template.md`。

---

## 18 附录：最小 ADR 模板（Accepted）
```md
# ADR-000X: <title>
- Status: Accepted
- Context: <背景与动机；关联的 PRD-ID/章/Issue>
- Decision: <你做了什么决定；口径与阈值；适用范围>
- Consequences: <权衡与影响；与既有口径的关系；迁移注意>
- Supersedes: <可选：被替代的 ADR 列表>
- References: <链接/规范/实验数据>
```

**代码“坏味道”审查清单（代码评审必读）**
在编写/评审代码时，若发现以下“坏味道”，**必须**给出重构建议或请求改动：

- **僵化（Rigidity）**：小改动引发大量联动修改，说明耦合过高/抽象不当。
- **冗余（Redundancy）**：相同逻辑重复出现，建议抽取函数/组件或上移到共享模块。
- **循环依赖（Circular Dependency）**：模块相互依赖，影响重用与测试。
- **脆弱性（Fragility）**：改动 A 把看似无关的 B 弄坏，说明边界不清或隐藏依赖。
- **晦涩性（Obscurity）**：意图不明/命名混乱/结构杂糅，阅读成本高。
- **数据泥团（Data Clump）**：参数总是成团出现，应抽象为对象或类型。
- **不必要的复杂性（Needless Complexity）**：为简单问题引入过度抽象/通用框架。

**请在所有代码生成中严格遵循这些原则**

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
> Use the taskmaster MCP to parse .taskmaster/docs/prd.txt and generate tasks; prefer @resource 引用（如 @docs:file://…）
