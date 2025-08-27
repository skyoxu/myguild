# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
- 目标：让 **Claude Code CLI + BMAD（可选 Zen MCP）** 在本仓库中按“**法规中心（base）→ 执行分散（overlays）**”协作，输出**可执行**的文档与代码，并通过**自动门禁**保证质量。
- ***直言不讳+止损机制***请用中文回答我的所有问题，每次都用审视的目光，仔细看我输入的潜在问题，你要指出我的问题，并给出明显在我思考框架之外的建议。
- **操作系统限定**：默认环境为 **Windows**。所有脚本/命令/依赖安装步骤必须提供 Windows 兼容指引（如 PowerShell、py/python 选择、Playwright 驱动安装等）
- 编写 .md文档时，正文也要用中文，但是**文件名**，**名词解释**可以使用英文
- **日志输出目录**：运行时与构建日志统一写入 logs/ 目录（按日期/模块分子目录），便于排障与归档
- **安全合规**：仅防御安全；拒绝进攻性/潜在滥用代码请求
- **代码与改动**：遵循项目现有约定；先看周边文件/依赖
- **任务管理**：强制频繁使用 TodoWrite 规划/跟踪；逐项标记进行/完成，不要堆到最后

## 设计原则：
- AI 优先 + arc42 思维：按 不可回退 → 跨切面 → 运行时骨干 → 功能纵切 顺序

## 0 范围与术语
- **Base 文档**：`docs/architecture/base/**` —— 跨切面与系统骨干（01–07、09、10 章），**无 PRD 痕迹**（以占位 `${DOMAIN_*}` `${PRODUCT_*}` 表达）。
- **Overlay 文档**：`docs/architecture/overlays/<PRD-ID>/**` —— 主要承载 **08 章功能纵切**（每个纵切=UI→事件→域模型→持久化→验收）。
- **双索引**：`architecture_base.index`（base）与 `prd_chunks.index`（PRD 分片）。
- **ADR**：Architecture Decision Record；**Accepted** 的 ADR 代表当前有效口径。
- **SSoT**：Single Source of Truth；01/02/03 章统一口径（NFR/SLO、安全、可观测性）。
- 语言与平台约束（项目级）

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
- 关联门禁：主窗口必须 contextIsolation=true、nodeIntegration=false、sandbox=true；preload 使用 contextBridge.exposeInMainWorld 暴露白名单 API；HTML 必带 CSP 元标记


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
      01-约束与目标-增强版.md
      02-安全基线(Electron).md
      03-可观测性(Sentry+日志)增强版.md
      04-系统上下文与C4+事件流.md
      05-数据模型与存储端口.md
      06-运行时视图(循环+状态机+错误路径).md
      07-开发与构建+质量门禁.md
      08-功能纵切-template.md            # 仅模板/约束/占位示例
      09-性能与容量规划.md
      10-国际化·运维·发布.md
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

## BMAD 系统集成与使用

### BMAD 安装状态
- **核心系统**: bmad-method v4.37.0（已安装并可升级到v4.39.2）
- **游戏开发扩展**: Phaser 2D (bmad-2d-phaser-game-dev) + Unity 2D (bmad-2d-unity-game-dev)
- **其他扩展**: Infrastructure DevOps 扩展包
- **Claude Code集成**: 通过自定义slash命令系统完全集成

### BMAD 工作机制
BMAD在Claude Code中通过**自定义slash命令**系统工作，而非MCP服务器。每个代理对应一个slash命令：

#### 可用的BMAD Slash命令

**核心代理命令：**
- `/bmad-master` - 主控代理，万能任务执行器
- `/analyst` - 业务分析师代理
- `/architect` - 软件架构师代理  
- `/dev` - 开发工程师代理
- `/pm` - 产品经理代理
- `/qa` - 质量保证代理
- `/sm` - 故事管理员代理
- `/ux-expert` - UX专家代理

**游戏开发代理命令：**
- `/game-designer` - 游戏设计师代理（Phaser专用）
- `/game-developer` - 游戏开发者代理（支持Phaser和Unity）
- `/game-architect` - 游戏架构师代理（Unity专用）

#### BMAD 代理使用方法

1. **启动代理**: 输入slash命令（如`/bmad-master`）
2. **代理会激活并问候用户，提及`*help`命令**
3. **使用内部命令**: 代理激活后可使用以下内部命令：
   - `*help` - 显示可用命令列表
   - `*task` - 执行任务（无参数显示可用任务）
   - `*create-doc` - 创建文档（无参数显示可用模板）
   - `*execute-checklist` - 执行检查清单
   - `*shard-doc` - 文档分片处理
   - `*kb` - 切换知识库模式
   - `*exit` - 退出代理模式

#### 典型工作流程

**游戏开发工作流：**
```bash
/game-designer     # 启动游戏设计师
*help              # 查看可用命令
*create-doc        # 查看可用模板
*task              # 查看可用任务
```

**架构设计工作流：**
```bash
/architect         # 启动架构师代理
*help              # 查看可用命令  
*create-doc architecture-tmpl.yaml  # 创建架构文档
*execute-checklist architect-checklist.md  # 执行架构检查清单
```

**项目管理工作流：**
```bash
/pm                # 启动产品经理代理
*create-doc prd-tmpl.yaml  # 创建PRD文档
/sm                # 切换到故事管理员
*task create-next-story    # 创建下一个故事
```

### BMAD 文件结构
- **命令定义**: `.claude/commands/BMad/`, `.claude/commands/bmad2dp/`, `.claude/commands/bmad2du/`
- **代理配置**: 每个代理都有完整的YAML配置，包含角色定义、命令和依赖
- **任务库**: 15+个预定义任务（create-doc, execute-checklist, shard-doc等）
- **模板库**: 8+个文档模板（prd-tmpl, architecture-tmpl等）
- **检查清单**: 5+个质量检查清单（architect-checklist, pm-checklist等）

### BMAD 维护命令
```bash
# 检查BMAD状态
bmad status

# 升级BMAD到最新版本  
bmad update --full --ide claude-code

# 安装新的扩展包
bmad install --expansion-packs <pack-name>

# 列出可用扩展包
bmad list:expansions
```

### 重要提醒
- BMAD代理在被激活时会**完全接管对话**，按照其角色定义工作
- 每个代理有**独立的工作流程**和**专门的任务集**
- 使用`*exit`命令退出代理模式返回正常Claude Code对话
- 代理配置文件位于`.claude/commands/`，可以自定义和扩展

## 核心行为规则
0. 你擅长调用合适的工具来完成完成各项任务
1. 你会在对话输出完毕后选择适当的时机向用户提出询问，例如是否需要添加后端能力，是否打开预览，是否需要部署等
2. 你首先会阅读当前项目的 README.md，遵照当前项目的说明进行开发，如果不存在则会在生成项目后生成一个 README.md 文件
3. 开发预览的时候，如果本身项目有依赖后端数据库集合和云函数，可以优先部署后端然后再预览前端
4. 交互式反馈规则：在需求不明确时主动与用户对话澄清，优先使用自动化工具 interactiveDialog 完成配置。执行高风险操作前必须使用 interactiveDialog 获得用户确认。保持消息简洁并用ASCII标记状态。
5. **开发必须遵循 TDD（测试驱动开发）方法论**

## 代码开发原则

## 1 硬规则（必须遵守）
1. **凡会落地为代码/测试的改动，必须引用 ≥ 1 条 *Accepted* ADR。**  
   若改动改变阈值/契约/安全口径：**新增 ADR** 或 **以 `Superseded(ADR-xxxx)` 替代旧 ADR**。
2. **PRD Front‑Matter 必含字段**（生成/修改时校验）：
   ```yaml
   PRD-ID: <必填>              # 例如 PRD-GM-GUILD-MGMT
   Arch-Refs: [<章名…>]       # 至少包含 01/02/03 与对应章
   ADRs: [ADR-xxxx…]          # ≥1 条 Accepted
   Test-Refs: [<测试用例路径>]
   Monitors: [<监控指标>]
   SLO-Refs: [<门禁/SLO代号>]
   ```
3. **08 章（功能纵切）只放在 overlays**：
   - base 仅保留 `08-功能纵切-template.md` 模板与写作约束；**禁止**在 base 写任何具体模块内容。
   - 08 章**引用** 01/02/03 的口径，**禁止复制阈值/策略**到 08 章正文。事件命名规则：
     `\${DOMAIN_PREFIX}.<entity>.<action>`；接口/DTO 统一落盘到 `src/shared/contracts/**`。
4. **RAG 写作纪律**：
   - **Base 扩写**：仅加载 `architecture_base.index`；**不得**加载 `prd_chunks.index`；不得出现 `PRD-ID:` 与真实域名。
   - **Overlay 扩写**：**同时**加载 `architecture_base.index` + `prd_chunks.index`；`--rag-query` 中**必须**包含 `PRD-ID:<…>`。
5. **默认基线（无新 ADR 覆盖则默认生效）**：
   - Electron 安全：`nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`、严格 CSP；预加载脚本使用 `contextBridge.exposeInMainWorld` **白名单 API**。
   - 发布健康：启用 **Sentry Release Health**；以 *Crash‑Free Sessions/Users* 作为放量/发布门禁指标。
6. **TS 强化约定**：
   - **类型定义位置**：公共 DTO/事件/端口类型一律放在 src/shared/contracts/**，其他章节引用不复制。
   - **any 使用门槛**：出现 any 时，必须同时提供：// TODO: remove any | owner | due 注释 + Issue 链接 + 回迁计划。
   - **公共命名**：事件命名统一为 \${DOMAIN_PREFIX}.<entity>.<action>；模块展示标注 data-testid="<模块>-root" 以便 Playwright 选择器稳定。

---

## 2 输出格式与附带物（让“规范可执行”）
- 任何“可执行规范”（章节/Story/任务）**必须附带**：
  1) **接口/类型/事件**的 TypeScript 片段（放入 `src/shared/contracts/**`）；  
  2) **就地验收**测试片段（Vitest/Playwright Electron）。
- 08 章文档产出**必须**同步/创建 `Test-Refs` 对应的测试文件（可先放占位）。
- 事件/端口的类型与契约**统一引用**于 `src/shared/contracts/**`，避免口径漂移。
- 生成/审阅内容时，**先质疑再生成**：对潜在误解与边界条件优先提示，必要时提出替代方案或降级路线。
- 若连续**3 次生成失败/不达标，立即停止**并建议“拆解任务 / 改写约束 / 降级实现”，避免无效迭代。

---

## 3 质量门禁（本地/CI 一致）
> 最小门禁以脚本方式固化，均可在本地与 CI 运行；阈值可通过环境变量覆盖。
- **脚本**（建议存在）：
  - `scripts/scan_electron_safety.mjs` —— 检查 BrowserWindow/Preload/CSP 是否符合基线。
  - `scripts/quality_gates.mjs` —— 覆盖率（lines ≥90% branches ≥85%）+ `.release-health.json` 的 Crash‑Free/adoption 阈值。
  - `scripts/verify_base_clean.mjs` —— Base 文档“清洁检查”（不得含 `PRD-ID:` 与真实域前缀）。
- **统一入口**：在 `package.json` 中配置 `guard:ci`：
  ```json
  {
    "scripts": {
      "typecheck": "tsc - p tsconfig.json --noEmit",
      "lint": "eslint . --ext .ts,.tsx",
      "test:unit": "vitest run --coverage",
      "test:e2e": "playwright test",
      "guard:electron": "node scripts/scan_electron_safety.mjs",
      "guard:quality": "node scripts/quality_gates.mjs",
      "guard:base": "node scripts/verify_base_clean.mjs",
      "guard:ci": "pnpm typecheck && pnpm lint && pnpm test:unit && pnpm guard:electron && pnpm test:e2e && pnpm guard:quality && pnpm guard:base"
    }
  }
  ```
**Python**：如需 Python，请同时支持 py -3 -m pip 与 python -m pip；并在文档中标注最低版本。
**Playwright**：在 Windows 上提供 npx playwright install --with-deps 的替代说明（某些依赖可省略 --with-deps）
**Shell 脚本**：为关键脚本提供 PowerShell 版本（如 scripts/*.ps1），或在 package.json 用 Node 脚本替代纯 Bash

---

## 4 默认 ADR 映射（可扩展）
- **ADR‑0001 技术栈**：Electron + React + Vite + TS + Tailwind + Phaser。
- **ADR‑0002 Electron 安全基线**：`nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`、严格 CSP；预加载脚本以白名单方式暴露 API。
- **ADR‑0003 可观测性与 Release Health**：启用 Sentry Releases/Health，Crash‑Free Sessions/Users 作为发布门禁参考；日志结构化与采样策略。
- **ADR‑0004 事件总线与契约**：IPC/域事件命名、DTO 版本化策略、事件兼容性。
- **ADR‑0005 质量门禁**：Playwright×Electron 冒烟、Vitest 契约/单元、覆盖率阈值、发布健康阈值。

> 任何章节/Story 若改变上述口径，**必须**新增或 Supersede 对应 ADR。

---

## 5 Claude 写作前自检（内置检查清单）
- 目标文件属于 **base** 还是 **overlay**？（base 禁 PRD-ID，overlay 必带 PRD-ID 与 ADRs）  
- 是否涉及 **Electron 安全、事件契约、质量门禁、Release Health**？若是，请**引用** ADR‑0002/0004/0005/0003。  
- 08 章是否只**引用** 01/02/03 的口径（不复制阈值）？  
- 是否附带 **TypeScript 契约片段** 与 **就地验收**（Vitest/Playwright）？  
- PRD Front‑Matter 的 `Test-Refs` 是否已更新到新用例或占位用例？

---

## 6 PR 模板要求（最少需要在 `.github/PULL_REQUEST_TEMPLATE.md` 勾选）
- [ ] 更新/新增 `src/shared/contracts/**` 的接口/类型/事件。  
- [ ] 更新/新增 `tests/unit/**`（Vitest）与 `tests/e2e/**`（Playwright Electron）。  
- [ ] 涉及 PRD：Front‑Matter 的 `Test-Refs` 指向相应用例。  
- [ ] 变更口径/阈值/契约：已新增或 *Supersede* 对应 ADR 并在 PR 描述中引用。

---

## 7 版本约束与脚手架建议
- **React 19**：按官方升级指南执行；注意第三方库兼容性。  
- **Tailwind v4**：采用 v4 配置方式（与 v3 不同），建议在 base 文档中记录最小配置片段。  
- **Electron 集成**：优先使用 `electron-vite` 或 `vite-plugin-electron` 提供的主/渲染/预加载目录与热更；统一目录约定便于脚本扫描。

---

## 8 违例处理
- 缺失 `ADRs`、复制阈值进 08 章、Base 出现 PRD-ID、遗漏 `Test-Refs` 等：Claude/BMAD 应**拒绝写入**并返回“拒绝原因 + 自动修复建议 + 需要引用/新增的 ADR 清单”。
- 需要新增 ADR 时，自动生成 `docs/adr/ADR-xxxx-<slug>.md` 的 *Proposed* 草案并提示审阅。

> **备注**：本 Rulebook 与项目中的脚本/模板、Base/Overlay 结构**强关联**。请保持这些文件存在且更新：  
> `scripts/scan_electron_safety.mjs` · `scripts/quality_gates.mjs` · `scripts/verify_base_clean.mjs` · `.github/PULL_REQUEST_TEMPLATE.md` · `docs/architecture/base/08-功能纵切-template.md`。

---

## 9 附录：最小 ADR 模板（Accepted）
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
