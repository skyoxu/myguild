#!/usr/bin/env node
import fs from 'node:fs/promises'

const owner = process.argv[2] || 'skyoxu'
const repo = process.argv[3] || 'myguild'
const runsPerWf = Number(process.argv[4] || 10)
const base = `https://api.github.com/repos/${owner}/${repo}`
const headers = {
  'User-Agent': 'gha-remote-audit',
  'Accept': 'application/vnd.github+json'
}

async function jget(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`)
  return res.json()
}

async function main() {
  const outDir = 'github_gpt'
  try { await fs.mkdir(outDir, { recursive: true }) } catch {}

  const wfList = await jget(`${base}/actions/workflows?per_page=100`)
  const report = []
  for (const wf of (wfList.workflows || [])) {
    let runs
    try {
      runs = await jget(`${base}/actions/workflows/${wf.id}/runs?per_page=${runsPerWf}`)
    } catch { continue }
    const failingRuns = (runs.workflow_runs || []).filter(r => r.status === 'completed' && ['failure','timed_out','cancelled','action_required'].includes(r.conclusion || ''))
    for (const run of failingRuns.slice(0, 5)) {
      let jobs
      try {
        jobs = await jget(`${base}/actions/runs/${run.id}/jobs?per_page=100`)
      } catch { continue }
      for (const job of (jobs.jobs || [])) {
        if (job.conclusion && job.conclusion !== 'success' && job.conclusion !== 'skipped') {
          const failedSteps = (job.steps || []).filter(s => s.conclusion && s.conclusion !== 'success' && s.conclusion !== 'skipped').map(s => ({ name: s.name, conclusion: s.conclusion }))
          report.push({
            workflow: wf.name,
            workflow_id: wf.id,
            run_id: run.id,
            run_number: run.run_number,
            run_attempt: run.run_attempt || 1,
            run_html_url: run.html_url,
            head_branch: run.head_branch,
            event: run.event,
            created_at: run.created_at,
            status: run.status,
            conclusion: run.conclusion,
            job_name: job.name,
            job_id: job.id,
            job_started_at: job.started_at,
            job_conclusion: job.conclusion,
            failed_steps: failedSteps,
          })
        }
      }
    }
  }

  const jsonPath = `${outDir}/remote_actions_failures.json`
  const mdPath = `${outDir}/remote_actions_failures.md`
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2))

  let md = `# GitHub Actions 失败运行审计（最近）\n\n`
  if (report.length === 0) {
    md += `未发现失败的运行（最近 ${runsPerWf} 次/工作流）。\n`
  } else {
    const byWf = new Map()
    for (const r of report) {
      if (!byWf.has(r.workflow)) byWf.set(r.workflow, [])
      byWf.get(r.workflow).push(r)
    }
    for (const [wfName, items] of byWf) {
      md += `## ${wfName}\n`
      const byRun = new Map()
      for (const it of items) {
        if (!byRun.has(it.run_id)) byRun.set(it.run_id, [])
        byRun.get(it.run_id).push(it)
      }
      for (const [_runId, arr] of byRun) {
        const first = arr[0]
        md += `- Run #${first.run_number} (attempt ${first.run_attempt}) [${first.run_html_url}] - ${first.status}/${first.conclusion}\n`
        for (const job of arr) {
          md += `  - Job: ${job.job_name} - ${job.job_conclusion}\n`
          for (const fsj of (job.failed_steps || [])) {
            md += `    - Step: ${fsj.name} - ${fsj.conclusion}\n`
          }
        }
        md += `\n`
      }
    }
  }
  await fs.writeFile(mdPath, md, 'utf8')
  console.log(`JSON: ${jsonPath}`)
  console.log(`Markdown: ${mdPath}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
