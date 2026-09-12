import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonWorldPersistence } from '../dist-server/online/persistence.js'
import { OnlineWorldStore } from '../dist-server/online/worldStore.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))

/**
 * `SYNTHESIS_ONLINE_ENV=production` is the one explicit flag for real Online
 * hosting (set by `npm run start:online`); everything else — local `npm run
 * server` / `npm run dev:online` — stays the convenient development default.
 * This is deliberately independent of `NODE_ENV`, which a host may or may not
 * set, so persistence admission and cookie semantics never rely on guesswork.
 */
const productionRuntime = process.env.SYNTHESIS_ONLINE_ENV === 'production'

const port = Number(process.env.PORT ?? process.env.SYNTHESIS_PORT ?? 4174)
const host = process.env.SYNTHESIS_HOST ?? '0.0.0.0'

const databasePathEnv = process.env.SYNTHESIS_DATABASE
if (productionRuntime && !databasePathEnv) {
  console.error(
    'Synthesis Online production runtime requires SYNTHESIS_DATABASE to point at an explicit, durable persistence file path (for example a persistent mounted volume). Refusing to start against an implicit, ephemeral default.',
  )
  process.exit(1)
}
const database = resolve(databasePathEnv ?? '.synthesis/world-v0.json')

/** Built Online frontend the production process serves alongside `/api/*`. */
const staticRoot = resolve(moduleDirectory, '../dist')
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/** Resolves a request path under `staticRoot`, refusing any path-traversal escape. */
function resolveStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname)
  const resolved = resolve(staticRoot, `.${decoded}`)
  if (resolved !== staticRoot && !resolved.startsWith(staticRoot + sep)) return null
  return resolved
}

async function sendFile(response, path) {
  const stats = await stat(path)
  if (!stats.isFile()) throw new Error('Not a file.')
  response.writeHead(200, { 'content-type': MIME_TYPES[extname(path)] ?? 'application/octet-stream' })
  await new Promise((resolveSent, rejectSent) => {
    const stream = createReadStream(path)
    stream.on('error', rejectSent)
    stream.on('end', resolveSent)
    stream.pipe(response)
  })
}

/** Serves the built Online frontend for non-API GET/HEAD requests, falling back to the SPA entry point for application routes. */
async function serveStatic(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const requested = resolveStaticPath(url.pathname)
  if (requested) {
    try {
      await sendFile(response, requested)
      return
    } catch {
      // Fall through to the SPA entry point below.
    }
  }
  try {
    await sendFile(response, resolve(staticRoot, 'index.html'))
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found.')
  }
}

const store = await new OnlineWorldStore(new JsonWorldPersistence(database)).open()
store.startAdvancement()
const cookieName = 'synthesis_session'
const parseCookie = (header = '') => Object.fromEntries(header.split(';').map((value) => value.trim().split('=')).filter(([key, value]) => key && value))
const body = async (request) => { let text = ''; for await (const chunk of request) { text += chunk; if (text.length > 4096) throw new Error('Request too large.') } return text ? JSON.parse(text) : {} }
const send = (response, status, value, headers = {}) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); response.end(JSON.stringify(value)) }
const token = (request) => parseCookie(request.headers.cookie)[cookieName] ?? ''
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict${productionRuntime ? '; Secure' : ''}; Max-Age=${maxAge}`

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/api/enter' && request.method === 'POST') {
      const input = await body(request); const result = await store.enter(input.name ?? '', input.password ?? '')
      return send(response, 200, result.snapshot, { 'set-cookie': cookie(result.token, 60 * 60 * 24 * 30) })
    }
    if (request.url === '/api/session' && request.method === 'GET') {
      const snapshot = store.restore(token(request)); return snapshot ? send(response, 200, snapshot) : send(response, 401, { error: 'Authentication required.' })
    }
    if (request.url === '/api/logout' && request.method === 'POST') {
      await store.logout(token(request)); return send(response, 200, { ok: true }, { 'set-cookie': cookie('', 0) })
    }
    if (request.url === '/api/observe' && request.method === 'POST') {
      const input = await body(request)
      if (input.kind !== 'ping' && input.kind !== 'scan') return send(response, 400, { error: 'Unsupported gameplay intent.' })
      return send(response, 200, await store.observe(token(request), input.kind, String(input.input ?? '')))
    }
    if (request.url?.startsWith('/api/')) return send(response, 404, { error: 'Not found.' })
    if (request.method === 'GET' || request.method === 'HEAD') return await serveStatic(request, response)
    return send(response, 404, { error: 'Not found.' })
  } catch (error) { return send(response, error instanceof SyntaxError ? 400 : 401, { error: error instanceof Error ? error.message : 'Request failed.' }) }
})
server.listen(port, host, () => console.log(`Synthesis online runtime listening on http://${host}:${server.address().port}`))
let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  try {
    const closed = new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
    store.stopAdvancementScheduling()
    await closed
    await store.drainAndFlush()
  } catch (error) {
    console.error('Synthesis shutdown failed before the canonical world was flushed.', error)
    process.exitCode = 1
  }
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
