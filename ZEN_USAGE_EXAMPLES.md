# Zen工具具体使用示例

## 🎯 方式一：对话式使用（最常用）

### 1. 项目规划

```
你：Use planner to help me create a development roadmap for adding multiplayer functionality to my game

我：我将使用planner工具来帮你制定多人游戏功能的开发路线图...
```

### 2. 代码分析

```
你：Use analyze to examine the current game architecture and identify potential performance bottlenecks

我：我将使用analyze工具来分析你当前的游戏架构...
```

### 3. 代码审查

```
你：Use codereview to audit the game loop implementation in src/main.tsx

我：我将使用codereview工具来审查你的游戏循环实现...
```

### 4. 调试帮助

```
你：Use debug to help me figure out why the collision detection isn't working properly

我：我将使用debug工具来帮你诊断碰撞检测问题...
```

## 🔧 方式二：命令行使用

### 启动zen服务器

```bash
# 检查环境
npm run zen:check

# 启动服务器
npm run zen:start

# 或使用脚本
./start-zen.sh
```

### 直接调用工具（高级用法）

```bash
cd zen-mcp-server
source ./Usersweiruan.zen-mcp-servervenv/Scripts/activate

# 使用chat工具
python -c "
from tools.chat import ChatTool
tool = ChatTool()
# 这里需要更复杂的调用逻辑
"
```

## 🚀 实际使用场景

### 场景一：新功能开发

```
流程：
1. "Use planner to plan adding a boss battle system"
2. "Use analyze to review current enemy system architecture"
3. 开始编码
4. "Use codereview to check the new boss AI code"
5. "Use debug to solve any issues"
```

### 场景二：代码重构

```
流程：
1. "Use analyze to identify code smells in the game engine"
2. "Use planner to create a refactoring strategy"
3. 执行重构
4. "Use codereview to validate the refactored code"
```

### 场景三：性能优化

```
流程：
1. "Use analyze to find performance bottlenecks"
2. "Use planner to prioritize optimization tasks"
3. 优化实现
4. "Use debug if performance issues persist"
```

## 💡 关键提示

### ✅ 正确的使用方式

- 直接在对话中提及工具名称
- 描述清楚你想要完成的任务
- 让Claude自动选择和调用合适的工具

### ❌ 错误的使用方式

- 寻找`/zen`命令（不存在）
- 期望工具菜单或GUI界面
- 试图手动配置每个工具调用

### 🎯 最佳实践

1. **明确目标**：清楚说明你想要什么结果
2. **提供上下文**：告诉Claude相关的文件路径或代码位置
3. **迭代改进**：基于工具输出继续对话和改进

## 🔄 工作流示例

让我演示一个完整的开发工作流：

```
你：I want to add a power-up system to my game. Use planner to break this down, then analyze the current codebase to see how to integrate it.

我：我会先使用planner工具来分解这个任务...
[planner工具规划任务]

然后我会使用analyze工具来分析你的代码结构...
[analyze工具分析代码]

基于这些分析，我建议...
[提供具体的实现建议]
```

现在你知道如何使用zen工具了！关键是**自然对话**，不需要特殊命令。
