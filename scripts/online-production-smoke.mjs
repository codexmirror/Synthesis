#!/usr/bin/env node
/**
 * Executable proof for the Online production packaging: this runs the REAL
 * `server/index.mjs` against the REAL `npm run build:online` output — no
 * mocks, no Vite dev proxy, no second origin. Run after `npm run build:online`:
 *
 *   npm run smoke:online
 *
 * Local-only, deterministic, no external network, no permanent `.synthesis`
 * mutation: every persistence path and server working directory lives under
 * a throwaway temp directory that is removed when this exits.
 */

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverEntry = join(repoRoot, 'server/index.mjs')
const readyPattern = /listening on http:\/\/([^:\s]+):(\d+)/

let failures = 0

function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`)
  } else {
    failures += 1
    console.error(`FAIL  ${message}`)
  }
}

async function requireBuiltArtifacts() {
  const required = [
    [join(repoRoot, 'dist/index.html'), 'dist/index.html'],
    [join(repoRoot, 'dist-server/online/worldStore.js'), 'dist-server/online/worldStore.js'],
  ]
  for (const [path, label] of required) {
    try {
      await stat(path)
    } catch {
      console.error(`Missing built artifact: ${label}\nRun \`npm run build:online\` before \`npm run smoke:online\`.`)
      process.exit(1)
    }
  }
}

/** Builds a child-process env, allowing `undefined` overrides to explicitly unset an inherited variable. */
function buildEnv(overrides) {
  const env = { ...process.env, ...overrides }
  for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete env[key]
  return env
}

/**
 * Spawns the real `server/index.mjs` and resolves once it either logs its
 * bound address (ready) or exits (e.g. fail-closed), whichever comes first.
 * A bounded safety timeout guards against a hung process; it is not the
 * mechanism used to detect ordinary readiness or exit.
 */
function spawnServer(overrides, cwd, { maxWaitMs = 15_000 } = {}) {
  return new Promise((settlePromise) => {
    const child = spawn(process.execPath, ['--experimental-specifier-resolution=node', serverEntry], {
      cwd,
      env: buildEnv(overrides),
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => settle({ child, ready: false, timedOut: true }), maxWaitMs)
    function settle(outcome) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      settlePromise({ stdout, stderr, ...outcome })
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      const match = stdout.match(readyPattern)
      if (match) settle({ child, ready: true, host: match[1], port: Number(match[2]) })
    })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('exit', (exitCode, signal) => settle({ child, ready: false, exitCode, signal }))
  })
}

async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit))
  child.kill('SIGTERM')
  const forceKill = setTimeout(() => child.kill('SIGKILL'), 5_000)
  await exited
  clearTimeout(forceKill)
}

async function fetchText(origin, path) {
  const response = await fetch(`${origin}${path}`)
  return { status: response.status, contentType: response.headers.get('content-type') ?? '', text: await response.text() }
}

async function fetchJson(origin, path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = response.headers.get('set-cookie') ?? ''
  const text = await response.text()
  let json
  try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
  return { status: response.status, setCookie, json }
}

const sessionCookie = (setCookieHeader) => setCookieHeader.split(';')[0]

async function main() {
  await requireBuiltArtifacts()
  const tempRoot = await mkdtemp(join(tmpdir(), 'synthesis-online-smoke-'))
  const databasePath = join(tempRoot, 'world-v0.json')
  let serverChild

  try {
    // 1. Production fails closed without an explicit SYNTHESIS_DATABASE, and
    //    never falls back to creating the ordinary development default.
    const failClosedCwd = join(tempRoot, 'fail-closed-cwd')
    await mkdir(failClosedCwd, { recursive: true })
    const failClosed = await spawnServer(
      { SYNTHESIS_ONLINE_ENV: 'production', SYNTHESIS_DATABASE: undefined, SYNTHESIS_PORT: '0' },
      failClosedCwd,
    )
    check(failClosed.ready === false && failClosed.exitCode !== 0, 'production startup without SYNTHESIS_DATABASE exits non-zero')
    check(/SYNTHESIS_DATABASE/.test(failClosed.stderr), 'fail-closed startup error names the missing SYNTHESIS_DATABASE configuration')
    const implicitDefaultCreated = await stat(join(failClosedCwd, '.synthesis/world-v0.json')).then(() => true, () => false)
    check(!implicitDefaultCreated, 'fail-closed startup does not silently create the ephemeral .synthesis/world-v0.json default')

    // 2-4. The real production server: built frontend, same-origin /api, and
    //      production cookie attributes, against an isolated temp database
    //      and an OS-assigned free port (SYNTHESIS_PORT=0).
    const online = await spawnServer(
      { SYNTHESIS_ONLINE_ENV: 'production', SYNTHESIS_DATABASE: databasePath, SYNTHESIS_PORT: '0', SYNTHESIS_HOST: '127.0.0.1' },
      repoRoot,
    )
    if (!online.ready) throw new Error(`Production server did not become ready (exitCode=${online.exitCode}): ${online.stderr}`)
    serverChild = online.child
    const origin = `http://${online.host}:${online.port}`

    const root = await fetchText(origin, '/')
    check(root.status === 200, 'GET / on the production service returns 200')
    check(root.contentType.includes('text/html'), 'GET / returns HTML content')
    check(root.text.includes('<div id="root">'), 'GET / serves the real built Online frontend (not Vite dev)')

    const alice = await fetchJson(origin, '/api/enter', { method: 'POST', body: { name: 'alice-smoke', password: 'correct horse battery staple' } })
    check(alice.status === 200, 'POST /api/enter creates/authenticates Alice')
    check(Boolean(alice.setCookie), "Alice's /api/enter response sets a session cookie")
    check(typeof alice.json?.playerId === 'string' && alice.json.playerId.length > 0, "Alice's snapshot includes a Player id")
    check(/(^|;\s*)HttpOnly(;|$)/i.test(alice.setCookie), 'production Set-Cookie includes HttpOnly')
    check(/SameSite=Strict/i.test(alice.setCookie), 'production Set-Cookie includes SameSite=Strict')
    check(/(^|;\s*)Secure(;|$)/i.test(alice.setCookie), 'production Set-Cookie includes Secure')
    const aliceCookie = sessionCookie(alice.setCookie)
    const alicePlayerId = alice.json?.playerId

    const aliceSession = await fetchJson(origin, '/api/session', { cookie: aliceCookie })
    check(aliceSession.status === 200 && aliceSession.json?.playerId === alicePlayerId, "GET /api/session restores Alice's own authenticated session")

    const bob = await fetchJson(origin, '/api/enter', { method: 'POST', body: { name: 'bob-smoke', password: 'correct horse battery staple' } })
    check(bob.status === 200, 'POST /api/enter independently creates/authenticates Bob')
    const bobCookie = sessionCookie(bob.setCookie)
    const bobPlayerId = bob.json?.playerId
    check(typeof bobPlayerId === 'string' && bobPlayerId.length > 0 && bobPlayerId !== alicePlayerId, 'Bob is a distinct Player/account session from Alice')

    const bobSession = await fetchJson(origin, '/api/session', { cookie: bobCookie })
    check(bobSession.status === 200 && bobSession.json?.playerId === bobPlayerId, "GET /api/session restores Bob's own session, not Alice's")

    // 5. Clean shutdown, then restart against the SAME persistence file.
    await stopServer(serverChild)
    serverChild = undefined
    const restarted = await spawnServer(
      { SYNTHESIS_ONLINE_ENV: 'production', SYNTHESIS_DATABASE: databasePath, SYNTHESIS_PORT: '0', SYNTHESIS_HOST: '127.0.0.1' },
      repoRoot,
    )
    check(restarted.ready === true, 'production server restarts cleanly against the same configured database file')
    if (restarted.ready) {
      serverChild = restarted.child
      const restartOrigin = `http://${restarted.host}:${restarted.port}`
      const aliceAfterRestart = await fetchJson(restartOrigin, '/api/session', { cookie: aliceCookie })
      check(aliceAfterRestart.status === 200 && aliceAfterRestart.json?.playerId === alicePlayerId, "Alice's authenticated session still resolves after restart")
      const bobAfterRestart = await fetchJson(restartOrigin, '/api/session', { cookie: bobCookie })
      check(bobAfterRestart.status === 200 && bobAfterRestart.json?.playerId === bobPlayerId, "Bob's authenticated session still resolves after restart")
    }
  } finally {
    await stopServer(serverChild)
    await rm(tempRoot, { recursive: true, force: true })
  }

  if (failures > 0) {
    console.error(`\n${failures} online production smoke check(s) failed.`)
    process.exit(1)
  }
  console.log('\nAll online production smoke checks passed.')
}

await main()
