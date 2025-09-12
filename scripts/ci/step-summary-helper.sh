#!/bin/bash
# Step Summary UTF-8/ASCII 标准化助手脚本
# P2优化：统一所有工作流的Step Summary输出格式

set -euo pipefail

# 确保UTF-8编码输出（Windows兼容）
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# 函数：输出标准化标题
output_summary_header() {
    local title="$1"
    local icon="${2:-🔍}"
    
    cat >> "$GITHUB_STEP_SUMMARY" << EOF
## ${icon} ${title}

### 📊 执行摘要
EOF
}

# 函数：输出标准化表格头
output_table_header() {
    cat >> "$GITHUB_STEP_SUMMARY" << 'EOF'
| 检查项目 | 状态 | 结果 |
|---------|------|------|
EOF
}

# 函数：输出标准化状态行
output_status_row() {
    local item="$1"
    local status="$2"  # ✅ ❌ ⚠️ 🔄
    local result="$3"
    
    echo "| $item | $status | $result |" >> "$GITHUB_STEP_SUMMARY"
}

# 函数：输出标准化结尾
output_summary_footer() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
    
    cat >> "$GITHUB_STEP_SUMMARY" << EOF

---
**执行时间**: ${timestamp}  
**工作流**: \${GITHUB_WORKFLOW}  
**运行ID**: [\${GITHUB_RUN_ID}](\${GITHUB_SERVER_URL}/\${GITHUB_REPOSITORY}/actions/runs/\${GITHUB_RUN_ID})
EOF
}

# 如果直接调用此脚本，显示使用方法
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Step Summary 标准化助手脚本"
    echo "使用方法："
    echo "  source $0"
    echo "  output_summary_header 'Build Results' '🏗️'"
    echo "  output_table_header"
    echo "  output_status_row 'ESLint' '✅' '0 errors, 45 warnings'"
    echo "  output_summary_footer"
fi