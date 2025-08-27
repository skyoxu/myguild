📋 MCP安装配置冲突问题回顾

  🔍 问题现象

  - 工作的MCP: zen-mcp-server 正常显示在 /mcp 命令中
  - 不工作的MCP: filesystem、sequential-thinking、context7 三个MCP不可见
  - 困惑点: 明明已经安装且在全局配置中配置正确

  🚨 根本原因：配置文件层次冲突

  关键发现: Claude Code配置加载优先级
  项目级配置 > 全局配置
  .claude.json > claude_desktop_config.json

  🔧 排查过程

  1. 初步检查 - 验证MCP包安装状态
  npm list @anthropics/mcp-filesystem
  npm list @anthropics/mcp-sequential-thinking
  npm list @upstash/context7-mcp
  2. 配置文件检查 - 发现关键问题
  // C:/Users/weiruan/claude_desktop_config.json (全局) ✅ 有MCP配置
  // C:/Users/weiruan/.claude.json (项目级) ❌ 缺少MCP配置
  3. 配置覆盖原理
    - 项目目录存在 .claude.json 时，完全覆盖全局配置
    - 不是合并，是完全替换
    - zen-mcp-server工作是因为它配置在项目级文件中

  ✅ 解决方案

  在项目级配置文件中添加所有MCP：
  // C:/Users/weiruan/.claude.json
  {
    "mcp": {
      "servers": {
        "zen-mcp-server": {
          "command": "cmd",
          "args": ["/c", "npx zen-mcp-server"]
        },
        "filesystem": {
          "command": "cmd",
          "args": ["/c", "npx @anthropics/mcp-filesystem", "C:/buildgame/vitegame"]
        },
        "sequential-thinking": {
          "command": "cmd",
          "args": ["/c", "npx @anthropics/mcp-sequential-thinking"]
        },
        "context7": {
          "command": "cmd",
          "args": ["/c", "npx @upstash/context7-mcp"]
        }
      }
    }
  }

  📝 未来安装新MCP的标准流程

  1. 安装MCP包
  npm install <mcp-package-name>
  2. 检查当前目录是否有项目级配置
  ls .claude.json
  3. 配置决策:
    - 如果存在 .claude.json → 必须在项目级配置
    - 如果不存在 → 可在全局配置
  4. 添加配置 (Windows环境使用 cmd /c 模式)
  {
    "mcp": {
      "servers": {
        "new-mcp-name": {
          "command": "cmd",
          "args": ["/c", "npx <package-name>", "<args>"]
        }
      }
    }
  }
  5. 验证
  # 重启Claude Code后验证
  /mcp

  ⚠️ 关键注意事项

  - Windows环境: 必须使用 "command": "cmd", "args": ["/c", "npx ..."]
  - 配置不会合并: 项目级配置完全覆盖全局配置
  - 调试技巧: 先确认配置文件优先级，再排查具体MCP问题
  - 包名易错: 注意区分 @anthropics/mcp-filesystem vs mcp-filesystem

  这个经验避免了我们在配置新MCP时重复花费tokens在同样的配置层次问题上。