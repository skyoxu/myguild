# PowerShell script to upgrade actions/setup-node from v4 to v5.0.0
# This fixes the deprecated actions/cache@v4.0.2 dependency issue

Write-Host "🔄 开始批量升级 actions/setup-node@v4 到 @v5.0.0..." -ForegroundColor Yellow

$workflowFiles = Get-ChildItem -Path ".github/workflows" -Filter "*.yml" -File
$totalFiles = 0
$modifiedFiles = 0

foreach ($file in $workflowFiles) {
    $content = Get-Content -Path $file.FullName -Raw

    if ($content -match "actions/setup-node@v4") {
        Write-Host "📝 修改文件: $($file.Name)" -ForegroundColor Green

        # 替换 actions/setup-node@v4 为 actions/setup-node@v5.0.0
        $newContent = $content -replace "actions/setup-node@v4", "actions/setup-node@v5.0.0"

        # 写回文件
        Set-Content -Path $file.FullName -Value $newContent -NoNewline

        $modifiedFiles++
        $totalFiles++

        Write-Host "  ✅ 已升级: actions/setup-node@v4 → @v5.0.0" -ForegroundColor Cyan
    } else {
        $totalFiles++
    }
}

Write-Host "`n📊 升级完成统计:" -ForegroundColor Yellow
Write-Host "  总计工作流文件: $totalFiles" -ForegroundColor White
Write-Host "  修改的文件数量: $modifiedFiles" -ForegroundColor Green
Write-Host "  ✅ 所有 actions/setup-node@v4 已升级到 @v5.0.0" -ForegroundColor Green

Write-Host "`n🔍 验证升级结果..." -ForegroundColor Yellow
$remainingV4 = Select-String -Path ".github/workflows/*.yml" -Pattern "actions/setup-node@v4" -AllMatches

if ($remainingV4.Count -eq 0) {
    Write-Host "  ✅ 验证通过：没有遗留的 @v4 版本" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  发现遗留的 @v4 版本:" -ForegroundColor Red
    $remainingV4 | ForEach-Object {
        Write-Host "    $($_.Filename):$($_.LineNumber)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 下一步建议:" -ForegroundColor Yellow
Write-Host "  1. 提交更改到 git" -ForegroundColor White
Write-Host "  2. 推送到 GitHub 触发 CI 测试" -ForegroundColor White
Write-Host "  3. 监控 GitHub Actions 确认警告消失" -ForegroundColor White