# Windows-friendly wrapper for scaffolding a new project from this repo
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/windows/new-project.ps1 -Target "C:\\work\\MyGame" -Name "mygame" -ProductName "My Game" -PrdId "PRD-MyGame" -DomainPrefix "mygame"

param(
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$false)][string]$Name,
  [Parameter(Mandatory=$false)][string]$ProductName,
  [Parameter(Mandatory=$false)][string]$PrdId,
  [Parameter(Mandatory=$false)][string]$DomainPrefix
)

$ErrorActionPreference = 'Stop'

function Ensure-LogsDir {
  $date = Get-Date -Format 'yyyy-MM-dd'
  $logs = Join-Path -Path (Get-Location) -ChildPath ("logs/" + $date + "/scaffold")
  New-Item -ItemType Directory -Force -Path $logs | Out-Null
  return $logs
}

$logsDir = Ensure-LogsDir
$logFile = Join-Path $logsDir ("scaffold-" + (Get-Date -Format 'HHmmss') + ".ps1.log")

function Log($msg) {
  $ts = (Get-Date).ToString('s')
  $line = "[$ts] $msg"
  $line | Tee-Object -FilePath $logFile -Append
}

try {
  Log "[+] 启动脚手架：Target=$Target Name=$Name ProductName=$ProductName PrdId=$PrdId DomainPrefix=$DomainPrefix"

  $node = (Get-Command node -ErrorAction SilentlyContinue)
  if (-not $node) {
    throw "未检测到 Node.js，请安装 Node.js 20.x 及以上版本后重试"
  }

  $argsList = @('--target', $Target)
  if ($Name) { $argsList += @('--name', $Name) }
  if ($ProductName) { $argsList += @('--productName', $ProductName) }
  if ($PrdId) { $argsList += @('--prdId', $PrdId) }
  if ($DomainPrefix) { $argsList += @('--domainPrefix', $DomainPrefix) }

  node scripts/scaffold/new-project.mjs @argsList

  Log "[✓] 脚手架完成"
  Log "后续：进入目标目录，执行 npm install && npx playwright install && npm run guard:ci"
}
catch {
  Log "[x] 失败：$($_.Exception.Message)"
  exit 1
}

