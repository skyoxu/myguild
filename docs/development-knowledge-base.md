# Vitegame 项目开发知识库

## MCP 配置与故障排除

### 1. MCP 配置层次优先级（来源：mcpsetup.md）

**关键发现**：项目级配置 > 全局配置
- `.claude.json` > `claude_desktop_config.json`
- 项目目录存在 `.claude.json` 时，完全覆盖全局配置（不是合并）

**Windows 环境配置格式**：
```json
{
  "mcp": {
    "servers": {
      "server-name": {
        "command": "cmd",
        "args": ["/c", "npx", "<package-name>", "<args>"]
      }
    }
  }
}
```

**故障排除流程**：
1. 检查配置文件优先级
2. 验证包安装状态：`npm list <package-name>`
3. 重启Claude Code验证
4. 使用 `/mcp` 命令检查可用工具

### 2. OpenMemory MCP 解决方案

**问题**：官方 `openmemory` npm包在Windows下SQLite3编译失败

**解决方案**：自定义Python服务（`start_openmemory.py`）
- 基于 `mem0ai` 库（v0.1.117）
- 提供SSE端点：`http://localhost:8765/mcp/claude/sse/claude-user`
- 完全兼容 `.mcp.json` 配置

**启动命令**：
```bash
py start_openmemory.py
```

## CI/CD 最佳实践（来源：citest/ciinfo.md）

### 1. GitHub Actions 基础规则

**YAML 语法**：
- 多行命令用 `|`（逐行保留）或 `>`（折叠成空格）
- 避免行尾反斜杠与插值搞坏YAML
- 向Job Summary输出统一用 `$GITHUB_STEP_SUMMARY`

**Shell 脚本规范**：
- 一次重定向：`{ …; } >> "$file"` 代替多次 `>> "$file"`
- 所有变量一律双引号（消除SC2086）
- Windows job中如写Bash语法需显式 `shell: bash`

### 2. npm 安装策略

**构建/测试/校验**：用 `npm ci`（包含dev依赖）
**部署**：`npm ci --omit=dev`
**注意**：设置 `NODE_ENV=production` 会跳过devDependencies

### 3. Electron 安全要点

**外部导航双闸**：
```javascript
// webRequest.onBeforeRequest
{ urls: ['http://*/*', 'https://*/*'] } → cancel: true

// will-navigate
event.preventDefault() + shell.openExternal(url)
```

**CSP设置**：
- 生产：响应头（推荐）
- 测试/file://：`<meta http-equiv="Content-Security-Policy">`

**自定义协议**：注册为 `standard + secure`，加载 `app://index.html`

### 4. 测试环境配置

**Vitest 环境分流**：
- Node专用：文件头加 `// @vitest-environment node`
- DOM需要：`// @vitest-environment jsdom`
- 批量配置：`vitest.config` 中 `environmentMatchGlobs`

**Playwright Electron**：
- 启动：`electron.launch() / firstWindow()`
- 等待：`document.readyState` 判断就绪
- 避免卡在错误页面

### 5. ESLint 门禁策略

**分目录阈值**：
- `src/**`：`--max-warnings 0`（严格）
- `tests/**`：设宽松阈值（如50）或改为warn

**常见修复**：
- 给 `page.evaluate<T>()` 标注返回泛型
- 用 `unknown/Record<string,unknown>` 代替 `any`
- 长测试拆成 `test.step()` 或多个 `test()`

### 6. Sentry 集成规范

**Release 流程**：
```bash
sentry-cli releases new → set-commits --auto →
(可选 sourcemaps upload) → releases finalize → deploys new
```

**必需环境变量**：
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

**Deploy 时间参数**：
- 使用 `--started/--finished <unix秒>` 或 `-t <耗时秒>`
- 不要传ISO字符串

### 7. 生成工件最佳实践

**确定性输出**：
- 用 `json-stable-stringify` 计算内容哈希
- 统一行尾：`.gitattributes` 设 `*.json text eol=lf`
- 编辑器：`.editorconfig` 设 `end_of_line=lf`

### 8. Windows 环境注意事项

**Shell 选择**：
- 需要Bash语法：`shell: bash`
- 否则默认PowerShell

**CRLF 处理**：
```bash
git config --global core.autocrlf input
```

**Job Summary 写入**：统一使用 `$GITHUB_STEP_SUMMARY`

## 项目技术栈决策

### 核心技术选型
- **桌面容器**：Electron（跨平台打包 & Node API集成）
- **游戏引擎**：Phaser 3（WebGL渲染 & 场景管理）
- **UI框架**：React 19（复杂界面组件开发）
- **构建工具**：Vite（Dev服务器 & 生产打包）
- **开发语言**：TypeScript（全栈强类型支持）
- **数据服务**：SQLite（高性能本地数据库）
- **样式方案**：Tailwind CSS v4（原子化CSS开发）

### 强制约束
1. **React：强制 v19**（禁止 v18 及以下）
2. **Tailwind CSS：强制 v4**（禁止 v3 及以下）
3. **模块系统：禁止 CommonJS**；一律使用 **ESM**
4. **TypeScript 优先**：默认以 TypeScript 实现

## 常用修复模板

### YAML/GitHub Actions
```
把多行命令改为 run: | 或 run: >，统一把 Markdown/大块文本放 heredoc；
修掉 actionlint 的 YAML 级错误后再看 ShellCheck。
```

### Bash 重定向
```
把多次 >> "$GITHUB_STEP_SUMMARY" 合并为 { …; } >> "$GITHUB_STEP_SUMMARY"；
所有变量加双引号。
```

### npm 安装
```
构建/测试阶段使用 npm ci（包含 dev）；
不要设置 NODE_ENV=production 或 --omit=dev。
```

### Electron 导航与 CSP
```
在主进程同时加 onBeforeRequest(cancel) 与 will-navigate.preventDefault()；
生产用响应头 CSP，测试加 <meta> 兜底；
自定义协议注册为 standard + secure。
```

## 开发工作流程

### 质量门禁
```bash
npm run guard:ci  # 完整CI检查链
```

包含：
- `typecheck`：TypeScript 类型检查
- `lint`：ESLint 代码质量
- `test:unit`：Vitest 单元测试
- `guard:dup`：重复代码检查（2%阈值）
- `guard:complexity`：复杂度检查（Cyclomatic ≤ 10）
- `guard:deps`：依赖关系检查（无循环依赖）
- `test:e2e`：Playwright E2E测试

### 代码质量原则
- **DRY**：抽象公共功能，消除重复
- **KISS**：简单胜过复杂
- **YAGNI**：只实现当前需求
- **SOLID**：单一职责、开闭原则等

### Git 工作流
- 始终在feature分支工作，不直接在main分支修改
- 小步提交，meaningful commit messages
- 提交前运行完整的质量门禁检查

## 故障排除清单

### MCP 问题
1. 检查配置文件优先级（项目级 > 全局级）
2. 验证包安装状态
3. 重启Claude Code
4. 使用 `/mcp` 命令验证

### CI 问题
1. YAML语法检查（actionlint）
2. Shell脚本规范检查（ShellCheck）
3. 环境变量设置检查
4. 权限配置检查

### 构建问题
1. 依赖安装：`npm ci`
2. 类型检查：`npm run typecheck`
3. 代码检查：`npm run lint`
4. 测试运行：`npm run test`

---
*最后更新：2025-09-21*
*来源：mcpsetup.md, citest/ciinfo.md, 项目实践经验*