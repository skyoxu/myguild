# Zen MCP Server 完整设置指南

## 🚨 为什么 /zen 命令不工作？

zen工具不是通过`/zen`命令使用的！它需要通过**MCP（Model Context Protocol）**连接到Claude。

## 📋 正确的使用方法

### 方法一：使用 claude_config.json（推荐）

1. **复制配置文件到Claude配置目录**

```bash
# Windows
copy claude_config.json %USERPROFILE%\.claude\settings.json

# Linux/macOS
cp claude_config.json ~/.claude/settings.json
```

2. **启动zen服务器**

```bash
npm run zen:start
# 或
./start-zen.sh
```

3. **重启Claude Code**
   - 完全关闭Claude Code
   - 重新启动Claude Code
   - 现在你可以直接说："Use the planner tool to help me plan..."

### 方法二：手动配置Claude设置

编辑 `~/.claude/settings.json` 文件，添加：

```json
{
  "model": "opus",
  "mcpServers": {
    "zen-mcp-server": {
      "command": "python",
      "args": ["run.py"],
      "cwd": "C:\\buildgame\\vitegame\\zen-mcp-server",
      "env": {
        "UV_PYTHON": "./Usersweiruan.zen-mcp-servervenv/Scripts/python.exe"
      }
    }
  }
}
```

## 🎯 如何使用zen工具

**不需要特殊命令！**直接在对话中提及工具名称：

### 示例对话：

```
你：Use the planner tool to help me create a development plan for a 2D game

Claude：I'll help you create a development plan using the planner tool...
[然后Claude会自动调用zen的planner工具]
```

```
你：Use the analyze tool to review the code structure in src/

Claude：I'll analyze your code structure using the analyze tool...
[然后Claude会自动调用zen的analyze工具]
```

## 🛠️ 可用的zen工具

- **planner** - "Use planner to break down this complex task"
- **analyze** - "Use analyze to examine the codebase structure"
- **codereview** - "Use codereview to audit this code"
- **debug** - "Use debug to help find the root cause"
- **chat** - "Use chat to brainstorm ideas with AI"

## 🔧 故障排除

### 问题1：工具不可用

- 确保zen服务器正在运行：`npm run zen:check`
- 重启Claude Code
- 检查配置文件路径

### 问题2：连接失败

- 检查虚拟环境路径是否正确
- 确保API密钥已配置（检查zen-mcp-server/.env）

### 问题3：权限错误

- 确保Claude有权限访问项目目录
- 检查python环境是否可执行

## 🎉 成功标志

当配置正确时，你会看到：

- Claude自动识别并调用zen工具
- 工具返回详细的分析结果
- 支持多轮对话和上下文保持

现在你可以享受强大的AI辅助开发体验了！
