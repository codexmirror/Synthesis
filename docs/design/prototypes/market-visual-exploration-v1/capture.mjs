/*
 * Screenshot capture for the NODE-OS Market visual exploration prototypes.
 *
 * THIS IS NOT PRODUCTION SYNTHESIS CODE. It is design tooling: it renders the
 * standalone static prototypes in this directory with Playwright and writes the
 * reference images under docs/assets/market-visual-exploration-v1/.
 *
 * It is deliberately not wired into package.json, because the repository's
 * runtime and test dependencies must not grow for a design pass. Run it with a
 * Playwright that is available on the machine, e.g.
 *
 *   NODE_PATH=$(npm root -g) node docs/design/prototypes/market-visual-exploration-v1/capture.mjs
 *
 * Two images are written per screen where it matters:
 *   <screen>.png        exactly what fits the Shell viewport, which is what a
 *                       human actually sees before scrolling
 *   <screen>-full.png   the whole scroll extent of the same screen
 */

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')
const outDir = resolve(repoRoot, 'docs/assets/market-visual-exploration-v1')
mkdirSync(outDir, { recursive: true })

const directions = [
  {
    key: 'a',
    file: 'direction-a.html',
    title: 'DIRECTION A · EXCHANGE COUNTER',
    blurb: 'The catalog is the product. Identity, one comparable price column, state and the action itself on every row; the release opens in place.',
    screens: ['catalog', 'detail', 'acquisition', 'mobile', 'mobiledetail'],
    full: ['detail', 'acquisition', 'mobile', 'mobiledetail'],
    rootPhone: 'mobile',
    releasePhone: 'mobiledetail',
  },
  {
    key: 'b',
    file: 'direction-b.html',
    title: 'DIRECTION B · RELEASE DOSSIER',
    blurb: 'Evaluation leads. A thin index for choosing what to read, and a dossier whose subject is the release’s own stated words, with one acquisition band as the single decision moment.',
    screens: ['catalog', 'detail', 'acquisition', 'mobile', 'mobileindex'],
    full: ['detail', 'acquisition', 'mobile', 'mobileindex'],
    rootPhone: 'mobileindex',
    releasePhone: 'mobile',
  },
  {
    key: 'c',
    file: 'direction-c.html',
    title: 'DIRECTION C · ACQUISITION LEDGER',
    blurb: 'Acquisition position leads. The root is grouped by derived state so the next action is visible before anything is opened; the offering surface is a focused panel over the four represented states.',
    screens: ['catalog', 'detail', 'acquisition', 'mobile', 'mobilepanel'],
    full: ['catalog', 'detail', 'acquisition', 'mobile', 'mobilepanel'],
    rootPhone: 'mobile',
    releasePhone: 'mobilepanel',
  },
]

/* Playwright is machine tooling here, not a repository dependency: resolve it
   from a local install if there is one, otherwise from the global root. */
async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    const loaded = await import(pathToFileURL(resolve(globalRoot, 'playwright/index.js')).href)
    return loaded.chromium ? loaded : loaded.default
  }
}

/* Grow the fixed review frame to the screen's own scroll extent, so a long
   surface can be reviewed whole without pretending the Shell is that tall. */
const EXPAND = `
  .screen { height: auto !important; }
  .os-shell { height: auto !important; }
  .app-content { overflow: visible !important; }
`

const { chromium } = await loadPlaywright()
const browser = await chromium.launch()

/* Phone screens are captured at 2x because a 390px surface has to be readable
   in review; the 1120px Shell screens and the assembled boards are captured at
   1x, because they are already large and doubling them only makes the
   repository heavier. */
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 1 })
const retina = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 })

const isPhone = (screen) => screen.startsWith('mobile')

for (const direction of directions) {
  const url = pathToFileURL(resolve(here, direction.file)).href
  for (const surface of [page, retina]) {
    await surface.goto(url)
    await surface.waitForTimeout(150)
  }

  for (const screen of direction.screens) {
    await (isPhone(screen) ? retina : page).locator(`#${direction.key}-${screen}`)
      .screenshot({ path: resolve(outDir, `direction-${direction.key}-${screen}.png`) })
  }

  for (const surface of [page, retina]) {
    await surface.addStyleTag({ content: EXPAND })
  }
  await page.waitForTimeout(120)
  for (const screen of direction.full) {
    await (isPhone(screen) ? retina : page).locator(`#${direction.key}-${screen}`)
      .screenshot({ path: resolve(outDir, `direction-${direction.key}-${screen}-full.png`) })
  }
  console.log(`captured direction ${direction.key.toUpperCase()}`)
}

await retina.close()

const scratch = mkdtempSync(join(tmpdir(), 'market-board-'))

/*
 * A / B / C comparison board.
 *
 * It compares like with like: the Market root of each direction at the phone
 * width that decides most of this product, beside the same root in the desktop
 * Shell. The cells are the direction pages' own renders, so the board cannot
 * drift from the markup it is comparing.
 */
const boardRows = directions.map((direction) => `
  <section class="row">
    <h2>${direction.title}</h2>
    <p>${direction.blurb}</p>
    <div class="cells">
      <figure><figcaption>MARKET ROOT · 390</figcaption><img src="${pathToFileURL(resolve(outDir, `direction-${direction.key}-${direction.rootPhone}.png`)).href}" width="390" height="800"></figure>
      <figure><figcaption>RELEASE SURFACE · 390</figcaption><img src="${pathToFileURL(resolve(outDir, `direction-${direction.key}-${direction.releasePhone}.png`)).href}" width="390" height="800"></figure>
      <figure><figcaption>MARKET ROOT · SHELL 1120</figcaption><img src="${pathToFileURL(resolve(outDir, `direction-${direction.key}-catalog.png`)).href}" width="1120" height="780"></figure>
    </div>
  </section>`).join('')

const boardFile = resolve(scratch, 'board.html')
writeFileSync(boardFile, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(resolve(here, 'harness.css')).href}">
<style>
  .board { display: block; width: max-content; max-width: none; margin: 0; }
  .row { margin: 0 0 40px; }
  .row h2 { margin: 0 0 5px; font-size: 16px; font-weight: 700; letter-spacing: .06em; }
  .row p { margin: 0 0 14px; max-width: 150ch; color: #9d9a95; font-size: 13px; }
  .cells { display: flex; align-items: flex-start; gap: 24px; }
  .cells figure { margin: 0; }
  .cells figcaption { margin: 0 0 8px; color: #8e8b86; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
  .cells img { display: block; }
</style>
<header class="harness-head">
  <h1>NODE-OS Market — Visual Exploration V1 · A / B / C comparison</h1>
  <p>Three Market product shapes inside one NODE-OS Firmware family. Each row is that direction's own Market root at the primary phone review width, its release surface at the same width, and its root in the desktop Shell.</p>
  <p class="harness-flag">MOCK STATE SNAPSHOTS — NOT INITIAL GAMESTATE. Release identities, versions, channels, publishers, filenames, sizes, prices, destinations and documentation are current repository truth.</p>
</header>
<div class="board">${boardRows}</div>`)

await page.setViewportSize({ width: 1700, height: 1200 })
await page.goto(pathToFileURL(boardFile).href)
await page.waitForTimeout(400)
await page.locator('.board').screenshot({ path: resolve(outDir, 'comparison-board.png') })
console.log('captured comparison board')

/*
 * Width plausibility: every direction's Market root at 320 / 390 / 430 / 834,
 * rendered by the direction pages themselves through `?only=catalog&w=`.
 */
const widths = [320, 390, 430, 834]
const cells = []
for (const direction of directions) {
  for (const width of widths) {
    const file = resolve(scratch, `${direction.key}-${width}.png`)
    await page.setViewportSize({ width: width + 80, height: 1000 })
    await page.goto(`${pathToFileURL(resolve(here, direction.file)).href}?only=catalog&w=${width}`)
    await page.waitForTimeout(140)
    await page.locator('.screen').screenshot({ path: file })
    cells.push({ key: direction.key, width, file })
  }
}

const widthRows = directions.map((direction) => {
  const frames = cells
    .filter((cell) => cell.key === direction.key)
    .map((cell) => `<figure><figcaption>${cell.width}</figcaption>` +
      `<img src="${pathToFileURL(cell.file).href}" width="${cell.width}" height="820"></figure>`)
    .join('')
  return `<section class="row"><h2>${direction.title}</h2><div class="cells">${frames}</div></section>`
}).join('')

const widthFile = resolve(scratch, 'widths.html')
writeFileSync(widthFile, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(resolve(here, 'harness.css')).href}">
<style>
  .board { display: block; width: max-content; max-width: none; margin: 0; }
  .row { margin: 0 0 36px; }
  .row h2 { margin: 0 0 13px; font-size: 15px; font-weight: 700; letter-spacing: .05em; }
  .cells { display: flex; align-items: flex-start; gap: 22px; }
  .cells figure { margin: 0; }
  .cells figcaption { margin: 0 0 8px; color: #8e8b86; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
  .cells img { display: block; }
</style>
<header class="harness-head">
  <h1>NODE-OS Market — Visual Exploration V1 · width plausibility</h1>
  <p>Every direction's Market root at 320, 390, 430 and 834 CSS px, rendered by the direction pages themselves.</p>
</header>
<div class="board">${widthRows}</div>`)

await page.setViewportSize({ width: 2400, height: 1200 })
await page.goto(pathToFileURL(widthFile).href)
await page.waitForTimeout(400)
await page.locator('.board').screenshot({ path: resolve(outDir, 'width-plausibility.png') })
rmSync(scratch, { recursive: true, force: true })
console.log('captured width plausibility board')

await browser.close()
