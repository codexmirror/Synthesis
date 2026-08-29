/*
 * Screenshot capture for the VEYRA visual exploration prototypes.
 *
 * THIS IS NOT PRODUCTION SYNTHESIS CODE. It is design tooling: it renders the
 * standalone static prototypes in this directory with Playwright and writes the
 * reference images under docs/assets/veyra-first-ordinary-phone-v1/.
 *
 * It is deliberately not wired into package.json, because the repository's
 * runtime and test dependencies should not grow for a design pass. Run it with
 * a Playwright that is available on the machine, e.g.
 *
 *   NODE_PATH=$(npm root -g) node docs/design/prototypes/veyra-first-ordinary-phone-v1/capture.mjs
 */

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')
const outDir = resolve(repoRoot, 'docs/assets/veyra-first-ordinary-phone-v1')
mkdirSync(outDir, { recursive: true })

const screens = ['home', 'communication', 'conversation', 'money', 'settings', 'settings-device']
const directions = [
  { key: 'a', file: 'direction-a.html' },
  { key: 'b', file: 'direction-b.html' },
  { key: 'c', file: 'direction-c.html' },
]

/* Playwright is machine tooling here, not a repository dependency: resolve it
   from the local install if there is one, otherwise from the global root. */
async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    const loaded = await import(pathToFileURL(resolve(globalRoot, 'playwright/index.js')).href)
    return loaded.chromium ? loaded : loaded.default
  }
}

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 })

for (const direction of directions) {
  await page.goto(pathToFileURL(resolve(here, direction.file)).href)
  await page.waitForTimeout(150)

  for (const screen of screens) {
    const element = page.locator(`#${direction.key}-${screen}`)
    await element.screenshot({ path: resolve(outDir, `direction-${direction.key}-${screen}.png`) })
  }

  await page.locator('.board').screenshot({ path: resolve(outDir, `direction-${direction.key}-board.png`) })
  console.log(`captured direction ${direction.key.toUpperCase()}`)
}

/*
 * Width plausibility board: every direction's Home at 320 / 390 / 430 / 834.
 *
 * Each width is rendered by the direction page itself (via ?only=&w=), so this
 * board can never drift from the markup it is checking. The per-width frames are
 * scratch files; only the assembled board is kept.
 */
const widths = [320, 390, 430, 834]
const scratch = mkdtempSync(join(tmpdir(), 'veyra-widths-'))
const cells = []

for (const direction of directions) {
  for (const width of widths) {
    const file = resolve(scratch, `${direction.key}-${width}.png`)
    await page.setViewportSize({ width: width + 80, height: 900 })
    await page.goto(`${pathToFileURL(resolve(here, direction.file)).href}?only=home&w=${width}`)
    await page.waitForTimeout(120)
    await page.locator('.screen').screenshot({ path: file })
    cells.push({ key: direction.key, width, file })
  }
}

const rows = directions.map((direction) => {
  const label = { a: 'Direction A “Index”', b: 'Direction B “Held”', c: 'Direction C “Frame”' }[direction.key]
  const frames = cells
    .filter((cell) => cell.key === direction.key)
    .map((cell) => `<div class="cell"><span>${cell.width}</span>` +
      `<img src="${pathToFileURL(cell.file).href}" width="${cell.width}" height="800"></div>`)
    .join('')
  return `<section class="row"><h2>${label}</h2><div class="strip">${frames}</div></section>`
}).join('')

const boardFile = resolve(scratch, 'board.html')
writeFileSync(boardFile, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(resolve(here, 'harness.css')).href}">
<style>
  .board { display: block; width: max-content; max-width: none; }
  .row { margin: 0 0 34px; }
  .row h2 { margin: 0 0 14px; font-size: 15px; font-weight: 700; letter-spacing: .04em; }
  .strip { width: max-content; display: flex; align-items: flex-start; gap: 22px; }
  .cell { display: grid; gap: 8px; }
  .cell span { color: #8e8b86; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
  .cell img { display: block; }
</style>
<header class="harness-head">
  <h1>VEYRA First Ordinary Phone — Visual Exploration V1 · width plausibility</h1>
  <p>Every direction's Home at 320, 390, 430 and 834 CSS px, rendered by the direction pages themselves.</p>
  <p class="harness-flag">VISUAL MOCKUP CONTENT — NOT SELECTED CANONICAL WORLD TRUTH</p>
</header>
<div class="board">${rows}</div>`)

await page.setViewportSize({ width: 2200, height: 1200 })
await page.goto(pathToFileURL(boardFile).href)
await page.waitForTimeout(400)
await page.locator('.board').screenshot({ path: resolve(outDir, 'width-plausibility.png') })
rmSync(scratch, { recursive: true, force: true })
console.log('captured width plausibility board')

await browser.close()
