## Claude Code — CI 常用规则（避免重复踩坑）

1. YAML / GitHub Actions 基础

run 里多行命令用 |（逐行保留）或 >（折叠成空格），避免行尾反斜杠与插值把 YAML 搞坏；向 Job Summary 输出统一用 $GITHUB_STEP_SUMMARY。
GitHub Docs
Stack Overflow
The GitHub Blog

在 CI 加 actionlint 并优先修正 YAML 语法 类报错（“did not find expected …”大多是缩进与冒号的锅）。
Stack Overflow
Reddit

2. Shell 步骤（Bash/Pwsh）规范

一次重定向：把多次 >> "$file" 改成 { …; } >> "$file"（消 SC2129）。所有变量一律双引号（消 SC2086）。
shellcheck.net
+1
Ask Ubuntu
Stack Overflow

Windows job 里如写了 Bash 语法（[[…]] 等），显式 shell: bash；否则默认 PowerShell 会报语法错。
GitHub Docs

3. Node / npm 安装策略

构建/测试/校验：用 npm ci（包含 dev）。若设置了 NODE_ENV=production 或加了 --omit=dev 会跳过 devDependencies，ESLint 等会缺失。
docs.npmjs.com
Stack Overflow

npm 新版警告里建议把 --production 换成 --omit=dev（部署用）；构建/测试禁止省 dev。
Stack Overflow

4. Sentry CLI（Release → Deploy 流程）

顺序固定：releases new → set-commits --auto →（可选 sourcemaps upload）→ releases finalize → deploys new。确保 SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN 已设。
docs.sentry.io
+1

deploys new 的时间参数不是 ISO 字符串：用 --started/--finished <unix秒> 或 -t <耗时秒>。
GitHub

5. Electron 安全（冒烟/红线测试必过的主进程要点）

外部导航双闸：webRequest.onBeforeRequest({urls:[http/https]}) → cancel + will-navigate → event.preventDefault()（避免真实导航导致 chrome-error:// 和上下文销毁）；新窗用 setWindowOpenHandler({ action:'deny' })。
Electron

CSP：生产用响应头（推荐）；测试/file:// 场景可用 <meta http-equiv="Content-Security-Policy"> 作为兜底。
Electron
MDN Web Docs
Stack Overflow

自定义协议：注册 app:// 为 standard + secure，加载 app://index.html，利于 CSP/存储/权限一致。
Electron

Playwright 启动与首窗：electron.launch() / firstWindow() 后用 document.readyState 判就绪，不要卡在错误页。
Playwright
+1

6. 测试环境（Vitest / ESM）

await import()/Node 专用用例 → Node 环境：文件头加 // @vitest-environment node；需要 DOM 的用例再用 jsdom。也可在 vitest.config 用 environmentMatchGlobs 分流。
Vitest
+1
GitHub

7. 生成工件（overlay-map 等）可复现输出

计算内容哈希用确定性序列化（如 json-stable-stringify / JCS 思路），只在真实语义变更时更新 generatedAt。
npm
RFC编辑器
IETF Datatracker

统一行尾：.gitattributes 设 \*.json text eol=lf；编辑器侧 .editorconfig 设 end_of_line=lf、insert_final_newline=true。
GitHub Docs
Git
EditorConfig

如需紧凑但稳定的排版，再对输出做一次“固定 formatter”，并把该文件加入 .prettierignore，以免来回改样式。

8. ESLint 门禁策略（避免“0 容忍”误伤）

分目录阈值：业务 src/** 保持 --max-warnings 0；tests/** 设宽松阈值（如 50）或在配置里把测试的 no-explicit-any / max-lines-per-function 调成 warn。
GitHub Docs
shellcheck.net

在 Playwright 代码里：给 page.evaluate<T>() 标注返回泛型、用 unknown/Record<string,unknown> 代替 any，长测试拆成 test.step() 或多个 test()。
Electron

9. Windows 细节

需要 Bash 语法就 shell: bash；否则默认 PowerShell。Job Summary 统一写入 $GITHUB_STEP_SUMMARY。
GitHub Docs
The GitHub Blog

为避免 CRLF 造成 diff，在 Windows runner 里可加：git config --global core.autocrlf input（配合 .gitattributes 更稳）。
GitHub Docs

推荐给 Claude Code 的“修复模板句式”（放到提示词/Auto-fix 里）

YAML/here-doc：
“把多行命令改为 run: | 或 run: >，并统一把 Markdown/大块文本放 heredoc；修掉 actionlint 的 YAML 级错误后再看 ShellCheck。”
GitHub Docs
Stack Overflow

Bash 重定向：
“把多次 >> "$GITHUB_STEP_SUMMARY" 合并为 { …; } >> "$GITHUB_STEP_SUMMARY"；所有变量加双引号。”
shellcheck.net
+1

npm 安装：
“构建/测试阶段使用 npm ci（包含 dev）；不要设置 NODE_ENV=production 或 --omit=dev。”
docs.npmjs.com

Sentry deploy：
“若出现 ‘Release not found’ 或 --time 格式错误：先 releases new/finalize，deploys new 用 --started/--finished 或 -t <秒>。”
docs.sentry.io
GitHub

Electron 导航与 CSP：
“在主进程同时加 onBeforeRequest(cancel) 与 will-navigate.preventDefault()；生产用响应头 CSP，测试加 <meta> 兜底；自定义协议注册为 standard + secure。”
Electron
+2
Electron
+2

Vitest 环境：
“含 await import() 的 Node 测试加 // @vitest-environment node；需要 DOM 的文件改 // @vitest-environment jsdom。”
Vitest

生成 JSON 工件：
“用 json-stable-stringify/JCS 计算哈希，文件落盘统一 LF 和末尾换行；不要让 Prettier再改。”
npm
RFC编辑器
GitHub Docs

ESLint 分层：
“src/** 严格 0 容忍；tests/** 放宽到 warn 或设 --max-warnings N；优先替换 any 为 unknown/泛型。”

## 给 Claude Code 的：Sentry × CI 常规注意项清单

0. 基础配置（必须）

三件套：SENTRY_AUTH_TOKEN（组织级 token）、SENTRY_ORG、SENTRY_PROJECT；自托管再加 SENTRY_URL。都放进 GitHub Secrets。
Sentry 文档

变量可通过环境变量、.sentryclirc、或 -o/-p 显式传入；sentry-cli info 用于快速校验配置有效性。
Sentry 文档

token 需要对应的权限/范围；创建时选择合适的 scopes。
Sentry 文档

1. Release 命名与一致性

Release 在组织级全局，建议加项目前缀并采用 package@version(+build) 命名，避免不同项目冲突。
Sentry 文档

Electron SDK 会自动设置 release（appName@version），也可以手动覆盖；务必与 CLI 里的 VERSION 一字不差。
Sentry 文档

如用多变体（平台/构建号），请在 SDK 设置 dist 并在 CLI sourcemaps 上传时用 --dist 同名。
Sentry 文档

2. 标准流水顺序（必要时可用官方 Action 简化）

顺序：releases new → set-commits →（可选 sourcemaps upload）→ releases finalize → deploys new。其中 deploys new 必须在 release 存在之后。
Sentry 文档

GitHub Actions 可以直接用官方 getsentry/action-release 一步创建 release / 上传 sourcemaps（运行前要先完成构建，并配置三件套）。
Sentry 文档

deploys new 的时间参数：传秒（-t），或传 --started/--finished（Unix 秒），不要传 ISO 字符串。
Sentry 文档

3. Source Maps（前端/渲染进程）

构建后执行 sentry-cli sourcemaps upload；可加 --url-prefix / --strip-common-prefix 做路径对齐。
Sentry 文档

多变体用 --dist；并在 SDK 里设置相同 dist 才能正确匹配。
Sentry 文档

Sentry 文档

4. 诊断与自检

在关键步骤前后运行：sentry-cli info、sentry-cli releases list -p "$SENTRY_PROJECT"、sentry-cli deploys list --release "$VERSION" 做健康检查。

调试时设置：SENTRY_LOG_LEVEL=info（或 debug）以打印更多 CLI 日志。
Sentry 文档

无仓库集成时，set-commits 可用 --local 或手动 --commit repo@sha。
Sentry 文档

5. Monorepo / 多项目

因为 Release 是组织级全局命名空间，要确保唯一（如 projectA@1.0.0 / projectB@1.0.0）。
Sentry 文档

也可为不同项目分别跑 -p "$SENTRY_PROJECT" 的子命令，让 CLI 操作落到正确项目。
Sentry 文档

6. 自托管 Sentry

需要设置 SENTRY_URL 指向你的实例，或在 .sentryclirc 的 defaults 里配置。

## GitHub Actions 基础规则（给 Claude Code 用）

1. 选用与引用 Action

只用官方或“Verified creator”来源；禁止 @main/浮动 tag，一律固定到完整 commit SHA，必要时再定期 bump（Dependabot 维护）
GitHub Docs
。

actions/checkout@v4：默认只取 1 个提交；需要全历史（例如计算版本、变更集）时显式 fetch-depth: 0
GitHub
。

2. 权限最小化（GITHUB_TOKEN）

仓库级默认权限设为只读；在 workflow/job 内通过 permissions: 按需升权（如仅某 job 需要 contents: write / pull-requests: write）
GitHub Docs
+2
GitHub Docs
+2
。

记住：Action 即使未显式传入，也能通过 github.token 访问 GITHUB_TOKEN，所以最小权限尤其重要
GitHub Docs
。

如需“一键”策略：permissions: read-all / write-all 可用，但更推荐精确声明各 scope
GitHub Docs
。

3. Shell/OS 约定（Windows 重点）

Windows 运行器默认 shell = PowerShell Core (pwsh)；如需 Bash/cmd 必须显式声明或在 defaults.run.shell 里统一设置
The GitHub Blog
GitHub Docs
。

PowerShell 5.1写环境文件需显式 -Encoding utf8；**PowerShell 7 (pwsh)**默认 UTF-8（避免乱码/命令格式错误）
GitHub Docs
。

脚本注入/单词分割：把上下文值先放到 env: 再用；变量一律双引号（Bash）——GitHub 安全文档有专门示例说明
GitHub Docs
。

4. 输出与摘要（告别在 YAML 里写 Markdown 表格）

不要把 Markdown 表格/说明直接塞进 YAML（会触发解析错误）；把报告写进 $GITHUB_STEP_SUMMARY（job summary），支持 GFM，多步可逐步 >> 追加
GitHub Docs
The GitHub Blog
。

set-output 已弃用：一律改用 $GITHUB_OUTPUT（环境文件）写 step/job output
The GitHub Blog
GitHub Docs
。

5. 并发与重复运行

使用 concurrency 并配 cancel-in-progress: true，防止同一分支/环境并行/交错部署导致竞态或资源冲突
GitHub Docs
。

6. 依赖与缓存（Node 常用）

actions/setup-node@v4 内置包管理器缓存，可基于 packageManager 字段自动启用或用 cache/cache-dependency-path 精确控制（monorepo 友好）
GitHub
。

7. 复用与治理

把通用 Job 收敛到 reusable workflow（on: workflow_call）；通过 inputs/secrets 传参，在各仓/分支统一策略与升级路径
GitHub Docs
。

8. 语法与静态检查门禁

在 CI 里固定跑 actionlint 检 YAML/表达式/嵌入脚本，并启用其问题匹配器（Problem Matcher）
GitHub
+1
。

与之配套继续跑 ShellCheck/ESLint（你已有），并落到 $GITHUB_STEP_SUMMARY 输出简表（而不是 YAML 内联 Markdown）
GitHub Docs
。

Claude Code 生成模板（最小可用骨架）
name: ci
on:
push:
branches: [main]
pull_request:

permissions: read-all # 默认最小化；具体 job 再按需升权（见下）

concurrency:
group: ${{ github.workflow }}-${{ github.ref }}
cancel-in-progress: true # 防重复跑

defaults:
run:
shell: pwsh # Windows 优先；Linux/macOS 可在该 job 覆盖为 bash

jobs:
build:
runs-on: windows-latest
permissions:
contents: read
steps: - uses: actions/checkout@v4
with:
fetch-depth: 0 # 需要全历史时再开 - uses: actions/setup-node@v4
with:
node-version: '20'
package-manager-cache: true - name: Install
run: npm ci - name: Test
run: npm test --silent

summary:
runs-on: windows-latest
needs: build
steps: - name: Write job summary
run: |
"### CI Summary" >> $env:GITHUB_STEP_SUMMARY
"" >> $env:GITHUB_STEP_SUMMARY
"- Build/Test: ✅" >> $env:GITHUB_STEP_SUMMARY

快速复盘你常遇到的坑 → 对应规则

YAML 里直接写表格/强调 → 统一改用 Job Summary（第 4 条）。
GitHub Docs

Windows 步骤里混用 Bash 语法 → 在 defaults.run.shell 指定 pwsh 或对个别 step 显式 shell: bash（第 3 条）。
The GitHub Blog
GitHub Docs

第三方 Action 漂移/不存在 → 使用官方源并固定 SHA，不要 @main（第 1 条）。
GitHub Docs

输出/跨 Job 传值失败 → 全量切到 GITHUB_OUTPUT/GITHUB_ENV（第 4 条）。
The GitHub Blog
GitHub Docs

权限过大或过小 → 仓库默认只读 + Job 局部精确升权（第 2 条）。

## CI 中“检查密钥泄露”的常规注意项（给 Claude Code）

1. 先防后扫：开启 GitHub Push Protection
   组织/仓库级开启 Secret Scanning Push Protection，在开发者 git push 时就拦截敏感串；必要时允许带注释绕过并生成告警。
   GitHub Docs
   +2
   GitHub Docs
   +2

2. 扫描策略：分层 & 有效

PR 增量扫描（快）：只扫改动，配合合适的 fetch-depth 与 extra_args。
trufflesecurity.com

主分支全量/定时扫描（深）：每天或每周全量扫一次，防“先泄后删”的历史遗留。Gitleaks 的 Marketplace 说明也特别强调“删除后历史仍在，务必轮转”。
GitHub

Linux 运行容器化 Action；Windows 需要时走原生二进制。
GitHub

3. 工具多样化（互补）

TruffleHog（验证型探测，覆盖 800+ 秘钥类型、支持活性校验）。可 Action 或 CLI。
GitHub

Gitleaks（规则可控，支持 Action/二进制/预提交），官方 Action 示例默认跑在 Ubuntu。
GitHub

GitHub Advanced Security 自带 secret scanning & push protection（如已授权）。
GitHub Docs

4. 发现泄露后的标准处置（Playbook）

立刻吊销/轮转相关凭据（第一要务），GH 文档与多家厂商最佳实践都把“旋转/撤销”作为首要动作。
GitHub Docs
+1
HashiCorp | An IBM Company

更新受影响服务的配置（环境变量/密钥库），并检查是否出现未授权访问。
GitHub Docs

（可选）清理历史：必要时用 git filter-repo 等移除历史中的秘钥引用；若已彻底撤销，大多场景可不重写历史。
GitHub Docs

记录与复盘：在 CI 的 $GITHUB_STEP_SUMMARY 输出处置纪要，沉淀误报白名单/规则。

5. 预防工程化

在本地加 pre-commit 钩子（TruffleHog/Gitleaks 官方都提供）把问题挡在提交前。
GitHub

所有密钥改用密钥管理服务/仓库 Secrets，并定期轮转（云厂商/Key Vault/Secrets Manager 支持自动轮转的尽量启用）。
Microsoft Learn

CI 中绝不打印敏感变量，必要时使用 GitHub 的 masking 与权限最小化策略。

TL;DR 你现在最简单的改法

把 TruffleHog 扫描 job 切到 ubuntu-latest（方案 A）。

或者 在 Windows 上用二进制/Chocolatey 执行 CLI（方案 B）。

同时 在组织/仓库启用 Push Protection，做到“先防后扫”。
