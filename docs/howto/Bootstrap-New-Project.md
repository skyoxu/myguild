# Bootstrap-New-Project（Windows）

本文描述如何快速从本仓库迁移/创建一个全新的项目骨架（技术栈、CI 工作流、质量门禁一并复用）。

## 前置要求

- Windows 10/11，PowerShell 7 建议
- Node.js 20.x+（验证：`node -v`）
- Git（用于初始化新仓库）
- 可选：Python 3.11+（如需 `py -3 -m pip`/`python -m pip` 扩展脚本）

Playwright（Windows）安装说明：

- 运行 `npx playwright install` 即可；Windows 环境无需 `--with-deps`。

## 一键脚手架

方式 A（推荐，PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/new-project.ps1 `
  -Target "C:\\work\\MyGame" `
  -Name "mygame" `
  -ProductName "My Game" `
  -PrdId "PRD-MyGame" `
  -DomainPrefix "mygame"
```

方式 B（Node CLI）：

```powershell
npm run scaffold:new -- --target C:\\work\\MyGame --name mygame --productName "My Game" --prdId PRD-MyGame --domainPrefix mygame
```

脚手架会：

- 复制核心目录：`src/`、`electron/`、`tests/`、`public/`、`scripts/`、`.github/`、`.husky/`、`.taskmaster/`、`docs/architecture/base/**`、`docs/adr/ADR-0001…0015`
- 过滤：`.git`、`node_modules`、`dist*`、`logs/`、`artifacts/`、`backups/`、`github_gpt/` 等
- 更新目标 `package.json` 的 `name`、`productName`、`version=0.1.0`
- 创建覆盖层索引：`docs/architecture/overlays/<PRD-ID>/08/_index.md`
- 生成 `BOOTSTRAP_SUMMARY.md` 与日志：`logs/<date>/scaffold/*.log`

## 初始化与验证

```powershell
cd C:\\work\\MyGame
npm install
npx playwright install
npm run dev          # Vite 开发服务器
npm run dev:electron # Electron 应用（含主进程构建）

# 质量门禁（Windows 友好，必要脚本已在 scripts/ 下提供）：
npm run guard:ci
```

## CI 工作流（GitHub Actions）

- 已复制 `.github/workflows/**`，默认包含：
  - `ci.yml`（主 CI：`npm ci` + `npm run guard:ci`）
  - 安全、发布健康、性能等门禁工作流
- 建议：仓库 Settings → Branch protection 使能必需检查（与 `docs/ci/required-checks.md` 对齐）

## 目录与日志

- 日志统一写入 `logs/`，脚手架日志位于：`logs/<YYYY-MM-DD>/scaffold/`
- 运行/构建脚本默认也按日期/模块划分日志子目录（可参考 `scripts/**` 实现）

## 注意与建议（质疑优先）

- 如新项目不需要完整 CI 套件，可逐步精简 `.github/workflows/**` 与 `package.json` 中非必要脚本，但务必保留：
  - `typecheck`、`lint`、`test:unit`、`test:e2e`、`guard:ci`
- Electron 安全基线（ADR-0002）与 Release Health（ADR-0003）是“不可回退”能力，建议保留；
- 若调整契约/阈值/安全口径：
  - 新增或 Supersede 对应 ADR（`docs/adr/**`），并在 PR 描述中引用；
  - 08 章仅引用 01/02/03 的口径（禁止复制阈值），实体/事件/SLI/门禁/测试写在 overlays 对应 PRD 目录。
- Windows 平台优先（ADR-0011）：如需跨平台 runner，先在本地验证，并在 ADR 中记录差异和策略。

## 常见问题（FAQ）

- Playwright 在 Windows 失败？
  - 请执行 `npx playwright install`，无需 `--with-deps`；若代理网络请设置 `HTTP_PROXY/HTTPS_PROXY`。
- Electron 构建失败？
  - 运行 `npm run build` 前先清缓存：`node scripts/ci/clean-file-caches.cjs`，并检查 `electron-builder` 日志。
- 质量门禁太严格？
  - 可通过环境变量在 CI 降低阈值，但需在 PR 中说明，并新增 ADR 或临时豁免说明。
