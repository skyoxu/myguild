#!/bin/bash
echo "Starting Zen MCP Server..."
cd "$(dirname "$0")/zen-mcp-server"
source ./Usersweiruan.zen-mcp-servervenv/Scripts/activate
python run.py