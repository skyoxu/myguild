# GitHub Actions 编码最佳实践 - P2优化指南

## 概述

确保Windows runner环境下Step Summary和工件输出的UTF-8编码一致性，避免乱码和显示问题。

## 核心原则

### 1. Shell选择优先级

```yaml
# ✅ 推荐：使用bash确保跨平台一致性
- name: 生成报告
  shell: bash
  run: |
    cat >> $GITHUB_STEP_SUMMARY << 'EOF'
    ## 📊 构建报告
    - 状态: ✅ 成功
    EOF

# ✅ 可选：需要Windows特定功能时使用pwsh
- name: Windows特定操作
  shell: pwsh
  run: |
    $content = "## 📊 Windows构建报告`n- 状态: ✅ 成功"
    $content | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8NoBom -Append
```

### 2. Step Summary编码模式

#### Bash模式（推荐）

```yaml
- name: 生成Step Summary
  shell: bash
  run: |
    cat >> $GITHUB_STEP_SUMMARY << 'EOF'
    ## 🛡️ 安全检查报告

    ### ✅ 检查结果
    - **漏洞扫描**: 通过
    - **依赖审计**: 通过
    - **代码质量**: 优秀

    ### 📊 统计数据
    - 检查文件: 156个
    - 发现问题: 0个
    - 修复建议: 3个
    EOF
```

#### PowerShell模式（特殊场景）

```yaml
- name: Windows特定Step Summary
  shell: pwsh
  run: |
    $summary = @"
    ## 🖥️ Windows构建报告

    ### ✅ 编译结果  
    - **主程序**: 编译成功
    - **依赖项**: 解析完成
    - **打包**: 生成完成

    ### 📁 输出文件
    - ViteGame.exe (52.4 MB)
    - 配置文件 (1.2 MB)
    "@

    # 关键：使用utf8NoBom编码
    $summary | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8NoBom -Append
```

### 3. 文件输出编码规范

#### JSON/XML配置文件

```yaml
- name: 生成配置文件
  shell: pwsh
  run: |
    $config = @{
      version = "${{ github.run_number }}"
      platform = "windows"
      timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    } | ConvertTo-Json -Depth 10

    $config | Out-File -FilePath "config/build-info.json" -Encoding utf8NoBom
```

#### 工件元数据

```yaml
- name: 创建工件清单
  shell: bash
  run: |
    cat > manifest.json << EOF
    {
      "build_id": "${{ github.run_number }}",
      "commit": "${{ github.sha }}",
      "branch": "${{ github.ref_name }}",
      "platform": "windows",
      "artifacts": [
        {
          "name": "vitegame.exe",
          "size": "$(stat -c%s dist/vitegame.exe)",
          "hash": "$(sha256sum dist/vitegame.exe | cut -d' ' -f1)"
        }
      ]
    }
    EOF
```

## 问题排查指南

### 常见编码问题

#### ❌ 问题：PowerShell重定向乱码

```yaml
# 错误示例
- shell: powershell
  run: echo "含中文内容" > $env:GITHUB_STEP_SUMMARY
```

#### ✅ 解决方案

```yaml
# 正确方法
- shell: pwsh
  run: |
    "含中文内容" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8NoBom -Append
```

#### ❌ 问题：mixed shell环境

```yaml
# 避免在同一作业中混用shell类型
jobs:
  build:
    runs-on: windows-latest
    steps:
      - shell: bash
        run: echo "bash content" >> $GITHUB_STEP_SUMMARY
      - shell: powershell # 可能导致编码不一致
        run: echo "ps content" >> $env:GITHUB_STEP_SUMMARY
```

#### ✅ 解决方案：统一shell类型

```yaml
jobs:
  build:
    runs-on: windows-latest
    steps:
      - shell: bash
        run: echo "bash content" >> $GITHUB_STEP_SUMMARY
      - shell: bash # 保持一致
        run: echo "more bash content" >> $GITHUB_STEP_SUMMARY
```

## 验证清单

- [ ] Step Summary使用bash或pwsh（避免powershell）
- [ ] PowerShell输出使用`-Encoding utf8NoBom`
- [ ] 同一作业内shell类型保持一致
- [ ] 中文内容在Step Summary中正确显示
- [ ] 工件文件使用UTF-8编码
- [ ] JSON/XML文件不包含BOM

## P2优化标准

| 场景             | 推荐Shell | 编码方式                       | 示例                                   |
| ---------------- | --------- | ------------------------------ | -------------------------------------- |
| 通用Step Summary | `bash`    | heredoc + 重定向               | `cat >> $GITHUB_STEP_SUMMARY << 'EOF'` |
| Windows特定功能  | `pwsh`    | `Out-File -Encoding utf8NoBom` | 上述PowerShell示例                     |
| JSON配置生成     | `pwsh`    | `ConvertTo-Json + Out-File`    | 配置文件示例                           |
| 工件清单创建     | `bash`    | heredoc                        | manifest.json示例                      |

---

_此文档作为P2优化阶段编码一致性标准，确保所有GitHub Actions输出在Windows环境下正确显示。_
