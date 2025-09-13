Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host '=== Electron/Playwright Dependency Probe (Windows) ==='

$summary = @{
  node = $null
  npm = $null
  electronPkg = $false
  electronVersion = ''
  playwrightPkg = $false
  playwrightVersion = ''
  distElectronMain = Test-Path -LiteralPath 'dist-electron/main.js'
}

try {
  $summary.node = (node -v)
  $summary.npm = (npm -v)
} catch {
  Write-Error 'Node.js / npm 不可用'; exit 1
}

try {
  $ev = node -e "process.stdout.write(require('electron/package.json').version)"
  if ($LASTEXITCODE -eq 0 -and $ev) { $summary.electronPkg = $true; $summary.electronVersion = $ev }
} catch {
  $summary.electronPkg = $false
}

try {
  $pv = node -e "process.stdout.write(require('@playwright/test/package.json').version)"
  if ($LASTEXITCODE -eq 0 -and $pv) { $summary.playwrightPkg = $true; $summary.playwrightVersion = $pv }
} catch {
  $summary.playwrightPkg = $false
}

Write-Host ('Node: {0}, npm: {1}' -f $summary.node, $summary.npm)
Write-Host ('electron package: {0} (v{1})' -f $summary.electronPkg, $summary.electronVersion)
Write-Host ('@playwright/test package: {0} (v{1})' -f $summary.playwrightPkg, $summary.playwrightVersion)
Write-Host ('dist-electron/main.js exists: {0}' -f $summary.distElectronMain)

# 强约束：必须安装 electron 与 @playwright/test
if (-not $summary.electronPkg) {
  Write-Error '未检测到 electron 依赖（devDependencies）。请确认 npm ci 成功执行。'
}
if (-not $summary.playwrightPkg) {
  Write-Error '未检测到 @playwright/test 依赖。请确认 npm ci 成功执行。'
}

# 可选提示：首次运行 E2E 前 dist-electron/main.js 可能不存在，由测试中的构建步骤生成
if (-not $summary.distElectronMain) {
  Write-Host '提示: dist-electron/main.js 暂不存在，测试阶段会触发构建。' -ForegroundColor Yellow
}

Write-Host '依赖探测通过。' -ForegroundColor Green
exit 0

