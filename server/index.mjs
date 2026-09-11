import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { JsonWorldPersistence } from '../dist-server/online/persistence.js'
import { OnlineWorldStore } from '../dist-server/online/worldStore.js'

const port = Number(process.env.SYNTHESIS_PORT ?? 4174)
const database = resolve(process.env.SYNTHESIS_DATABASE ?? '.synthesis/world-v0.json')
const store = await new OnlineWorldStore(new JsonWorldPersistence(database)).open()
store.startAdvancement()
const cookieName = 'synthesis_session'
const parseCookie = (header = '') => Object.fromEntries(header.split(';').map((value) => value.trim().split('=')).filter(([key, value]) => key && value))
const body = async (request) => { let text = ''; for await (const chunk of request) { text += chunk; if (text.length > 4096) throw new Error('Request too large.') } return text ? JSON.parse(text) : {} }
const send = (response, status, value, headers = {}) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); response.end(JSON.stringify(value)) }
const token = (request) => parseCookie(request.headers.cookie)[cookieName] ?? ''
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`

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
    return send(response, 404, { error: 'Not found.' })
  } catch (error) { return send(response, error instanceof SyntaxError ? 400 : 401, { error: error instanceof Error ? error.message : 'Request failed.' }) }
})
server.listen(port, '127.0.0.1', () => console.log(`Synthesis online runtime listening on http://127.0.0.1:${port}`))
const shutdown = async () => { server.close(); await store.stopAdvancement(); process.exit(0) }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
