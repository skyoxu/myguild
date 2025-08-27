import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'
import fs from 'fs'

function resolveElectronBinary() {
  const envBin = process.env.E2E_ELECTRON_BINARY
  if (envBin && fs.existsSync(envBin)) return envBin
  const fallback = path.resolve('node_modules', '.bin', 'electron')
  return fallback
}

test('PRD-GM-PRD-GUILD-MANAGER_CHUNK_017 · 战术中心模块 · 首屏可用性', async () => {
  const electronApp = await electron.launch({
    executablePath: resolveElectronBinary(),
    args: ['.'],
  })
  const window = await electronApp.firstWindow()
  const el = await window.waitForSelector('[data-testid="app-ready"]', { timeout: 2000 })
  await expect(await el.innerText()).not.toBeNull()
  await electronApp.close()
})
