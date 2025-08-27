@echo off
echo Starting Zen MCP Server...
cd "%~dp0zen-mcp-server"
call ".zen_venv\Scripts\activate.bat"
python run.py