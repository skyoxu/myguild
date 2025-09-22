#!/usr/bin/env python3
"""
简单的OpenMemory MCP服务启动脚本
使用已安装的mem0ai包创建SSE服务
"""

import os
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from mem0 import Memory
import uvicorn
from datetime import datetime

# Check if API key is available from environment
if not os.environ.get("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY environment variable is required")

app = FastAPI()

# 初始化Memory实例
memory = Memory()

@app.get("/mcp/claude/sse/claude-user")
async def mcp_sse():
    """提供MCP SSE服务"""

    def generate_mcp_response():
        # 基本的MCP工具响应
        tools = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "tools": [
                    {
                        "name": "add_memories",
                        "description": "Add memories to the memory store",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "memories": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "content": {"type": "string"},
                                            "metadata": {"type": "object"}
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        "name": "search_memory",
                        "description": "Search memories",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"}
                            }
                        }
                    }
                ]
            }
        }
        yield f"data: {json.dumps(tools)}\n\n"

    return StreamingResponse(
        generate_mcp_response(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@app.post("/add_memory")
async def add_memory(content: str, metadata: dict = None):
    """添加记忆"""
    try:
        result = memory.add(content, metadata=metadata)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/search_memory")
async def search_memory(query: str):
    """搜索记忆"""
    try:
        results = memory.search(query)
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    print("Starting OpenMemory service on http://localhost:8765")
    print("MCP SSE endpoint: http://localhost:8765/mcp/claude/sse/claude-user")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info"
    )