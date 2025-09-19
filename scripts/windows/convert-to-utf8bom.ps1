Param(
  [string]$Root = ".",
  [string[]]$IncludeExt = @(
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".jsonc", ".md", ".html", ".css", ".scss", ".less",
    ".yml", ".yaml", ".xml", ".svg", ".txt"
  ),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Create log dir
$date = Get-Date -Format 'yyyy-MM-dd'
$logDir = Join-Path -Path (Resolve-Path "$Root") -ChildPath "logs/$date/encoding"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'convert-to-utf8bom.log'

function Write-Log($msg) {
  $line = "[" + (Get-Date -Format o) + "] " + $msg
  Add-Content -Encoding UTF8 -Path $logFile -Value $line
  Write-Output $msg
}

Write-Log "Start conversion Root=$Root DryRun=$($DryRun.IsPresent)"

$excludedDirs = @('.git','node_modules','dist','build','out','coverage','playwright-report','test-results','logs','github_gpt','zen-mcp-server','.venv','venv','.vscode','.github')

function Has-Bom($bytes) {
  if ($bytes.Length -ge 3) {
    return ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  }
  return $false
}

function Is-Directory-Excluded($path) {
  foreach ($ex in $excludedDirs) {
    if ($path -like "*\$ex\*") { return $true }
    if ($path -like "*\$ex") { return $true }
  }
  return $false
}

$rootPath = Resolve-Path $Root

$files = Get-ChildItem -Path $rootPath -Recurse -File |
  Where-Object { -not (Is-Directory-Excluded $_.FullName) } |
  Where-Object { $IncludeExt -contains ([IO.Path]::GetExtension($_.Name).ToLowerInvariant()) }

$converted = 0
$skippedBom = 0
$skippedErr = 0

foreach ($f in $files) {
  try {
    $bytes = [IO.File]::ReadAllBytes($f.FullName)
    if (Has-Bom $bytes) {
      $skippedBom++
      Write-Log "SKIP (has BOM): $($f.FullName)"
      continue
    }

    # prefer detect if already UTF-8 (no BOM) — keep bytes, just prepend BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false, $true)
    $isUtf8 = $true
    try { [void]$utf8NoBom.GetString($bytes) } catch { $isUtf8 = $false }

    if ($DryRun) {
      Write-Log "DRYRUN would convert: $($f.FullName) (isUtf8=$isUtf8)"
      continue
    }

    if ($isUtf8) {
      # Prepend BOM bytes and write back
      $bom = [byte[]](0xEF,0xBB,0xBF)
      $out = New-Object byte[] ($bom.Length + $bytes.Length)
      [Array]::Copy($bom, 0, $out, 0, $bom.Length)
      [Array]::Copy($bytes, 0, $out, $bom.Length, $bytes.Length)
      [IO.File]::WriteAllBytes($f.FullName, $out)
      $converted++
      Write-Log "CONVERT (prepend BOM): $($f.FullName)"
    } else {
      # Decode with system Default, re-encode as UTF-8 with BOM
      $defaultEnc = [System.Text.Encoding]::Default
      $text = $defaultEnc.GetString($bytes)
      $utf8Bom = New-Object System.Text.UTF8Encoding($true)
      $outBytes = $utf8Bom.GetBytes($text)
      [IO.File]::WriteAllBytes($f.FullName, $outBytes)
      $converted++
      Write-Log "CONVERT (default -> UTF8+BOM): $($f.FullName)"
    }
  } catch {
    $skippedErr++
    Write-Log "ERROR: $($f.FullName) :: $($_.Exception.Message)"
  }
}

Write-Log "Done. converted=$converted skipped(hasBOM)=$skippedBom errors=$skippedErr"
