# Task Master AI MCP 配置修复总结

## 🚨 问题分析

### 主要问题
1. **依赖冲突**: task-master-ai 包存在 ESM 模块解析问题
2. **配置格式**: 原配置缺少 Windows 兼容的 `cmd /c` 包装
3. **环境变量**: 缺少必需的 API keys 配置

### 错误症状
```
Error: Cannot find package 'rxjs/index.js' imported from inquirer
ERR_MODULE_NOT_FOUND
```

## ✅ 已修复的配置

### 1. 更新了 `.mcp.json` 配置
```json
{
  "task-master-ai": {
    "type": "stdio", 
    "command": "cmd",
    "args": [
      "/c", 
      "npx", 
      "-y", 
      "--package=task-master-ai", 
      "task-master-ai"
    ],
    "env": {
      "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
      "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
      "OPENAI_API_KEY": "${OPENAI_API_KEY}",
      "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
      "XAI_API_KEY": "${XAI_API_KEY}",
      "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
      "MISTRAL_API_KEY": "${MISTRAL_API_KEY}",
      "AZURE_OPENAI_API_KEY": "${AZURE_OPENAI_API_KEY}",
      "OLLAMA_API_KEY": "${OLLAMA_API_KEY}"
    }
  }
}
```

### 2. 统一了所有 MCP 配置格式
- 所有 MCP 服务器现在使用 `"command": "cmd", "args": ["/c", ...]` 格式
- 确保 Windows 环境兼容性

### 3. 添加了环境变量模板
在 `.env.example` 中添加了所有需要的 API keys

## 🔧 用户需要的操作

### 必需步骤
1. **配置 API Keys**: 复制 `.env.example` 为 `.env` 并填入真实的 API keys
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，添加至少一个 API key
   ```

2. **重启 Claude Code**: 配置更改后需要重启 Claude Code 才能生效

### 可选步骤
如果 task-master-ai 仍有问题，可以考虑：

1. **使用 CLI 模式**: 直接使用 task-master CLI 命令
   ```bash
   npm install -g task-master-ai
   task-master --help
   ```

2. **清理 npx 缓存**:
   ```bash
   npx clear-npx-cache
   # 或者删除 C:\Users\weiruan\AppData\Local\npm-cache\_npx\
   ```

## 📋 验证步骤

重启 Claude Code 后运行：
```
/mcp
```

应该能看到：
- ✅ zen-mcp-server (已工作)
- ✅ sequential-thinking  
- ✅ context7
- ✅ filesystem
- 🔄 task-master-ai (如果 API keys 正确配置)

## ⚠️ 注意事项

1. **API Keys 安全**: 不要将 `.env` 文件提交到版本控制
2. **Windows 路径**: 所有路径使用双反斜杠 `\\` 转义
3. **依赖问题**: 如果 task-master-ai 仍有问题，是包本身的 bug，不是配置问题

## 🔄 替代方案

如果 MCP 方式仍有问题，推荐使用：
1. **CLI 命令**: 直接使用 `task-master` 命令行工具
2. **BMAD 系统**: 项目中已集成完整的 BMAD 系统作为替代

## 📊 配置对比

### 修复前（有问题）
```json
"command": "npx",
"args": ["-y", "--package=task-master-ai", "task-master-ai"],
"env": {}
```

### 修复后（Windows 兼容）
```json
"command": "cmd", 
"args": ["/c", "npx", "-y", "--package=task-master-ai", "task-master-ai"],
"env": {"ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}", ...}
```

重启 Claude Code 后测试 `/mcp` 命令查看结果！