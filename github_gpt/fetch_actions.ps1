Param(
  [string]$Owner = "skyoxu",
  [string]$Repo = "myguild",
  [int]$RunsPerWorkflow = 10
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'github_gpt')) { New-Item -ItemType Directory -Path 'github_gpt' | Out-Null }

$baseUri = "https://api.github.com/repos/$Owner/$Repo"
$headers = @{ 'User-Agent' = 'gha-remote-audit'; 'Accept' = 'application/vnd.github+json' }

function Get-Json($uri) {
  try { return Invoke-RestMethod -Uri $uri -Headers $headers -Method GET -TimeoutSec 60 }
  catch {
    Write-Warning ("Fetch failed: {0} -> {1}" -f $uri, $_.Exception.Message)
    return $null
  }
}

$wfList = Get-Json "$baseUri/actions/workflows?per_page=100"
if (-not $wfList) { Write-Error "Unable to fetch workflows"; exit 1 }

$report = @()
foreach ($wf in $wfList.workflows) {
  $runs = Get-Json "$baseUri/actions/workflows/$($wf.id)/runs?per_page=$RunsPerWorkflow"
  if (-not $runs) { continue }
  $failingRuns = @($runs.workflow_runs | Where-Object { $_.status -eq 'completed' -and $_.conclusion -in @('failure','timed_out','cancelled','action_required') })
  foreach ($run in ($failingRuns | Select-Object -First 5)) {
    $jobs = Get-Json "$baseUri/actions/runs/$($run.id)/jobs?per_page=100"
    if (-not $jobs) { continue }
    foreach ($job in $jobs.jobs) {
      if ($job.conclusion -and $job.conclusion -ne 'success' -and $job.conclusion -ne 'skipped') {
        $failedSteps = @()
        foreach ($st in $job.steps) {
          if ($st.conclusion -and $st.conclusion -ne 'success' -and $st.conclusion -ne 'skipped') {
            $failedSteps += [PSCustomObject]@{ name=$st.name; conclusion=$st.conclusion }
          }
        }
        $report += [PSCustomObject]@{
          workflow      = $wf.name
          workflow_id   = $wf.id
          run_id        = $run.id
          run_number    = $run.run_number
          run_attempt   = $run.run_attempt
          run_html_url  = $run.html_url
          head_branch   = $run.head_branch
          event         = $run.event
          created_at    = $run.created_at
          status        = $run.status
          conclusion    = $run.conclusion
          job_name      = $job.name
          job_id        = $job.id
          job_started_at= $job.started_at
          job_conclusion= $job.conclusion
          failed_steps  = $failedSteps
        }
      }
    }
  }
}

$jsonPath = Join-Path 'github_gpt' 'remote_actions_failures.json'
$mdPath   = Join-Path 'github_gpt' 'remote_actions_failures.md'

$report | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8

# Build markdown
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# GitHub Actions 失败运行审计（最近）")
[void]$sb.AppendLine("")
if ($report.Count -eq 0) {
  [void]$sb.AppendLine(("未发现失败的运行（最近 {0} 次/工作流）。" -f $RunsPerWorkflow))
} else {
  $byWf = $report | Group-Object workflow
  foreach ($grp in $byWf) {
    [void]$sb.AppendLine(("## {0}" -f $grp.Name))
    $runs = $grp.Group | Group-Object run_id
    foreach ($r in $runs) {
      $first = $r.Group | Select-Object -First 1
      $attempt = if ($first.run_attempt) { $first.run_attempt } else { 1 }
      [void]$sb.AppendLine(("- Run #{0} (attempt {1}) [{2}] - {3}/{4}" -f $first.run_number, $attempt, $first.run_html_url, $first.status, $first.conclusion))
      foreach ($job in ($r.Group)) {
        [void]$sb.AppendLine(("  - Job: {0} - {1}" -f $job.job_name, $job.job_conclusion))
        if ($job.failed_steps -and $job.failed_steps.Count -gt 0) {
          foreach ($fs in $job.failed_steps) { [void]$sb.AppendLine(("    - Step: {0} - {1}" -f $fs.name, $fs.conclusion)) }
        }
      }
      [void]$sb.AppendLine("")
    }
  }
}
$sb.ToString() | Set-Content -Path $mdPath -Encoding UTF8

Write-Output ("JSON: {0}" -f $jsonPath)
Write-Output ("Markdown: {0}" -f $mdPath)
