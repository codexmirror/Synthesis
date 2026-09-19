import { useEffect, useState } from 'react'
import { GameProvider } from './app/GameContext'
import { Shell } from './shell/Shell'
import type { AuthenticatedSnapshot } from './online/model'
import { enterSynthesis, logoutOnlineSession, observeOnline, restoreOnlineSession } from './online/client'
import { Login } from './online/Login'

export default function App() {
  if (!onlineRuntimeEnabled(import.meta.env)) return <GameProvider><Shell /></GameProvider>
  return <OnlineApp />
}

/**
 * Runtime authority is an explicit selection, never a `DEV` side effect: the
 * Sandbox (browser-authoritative) and Online (server-authoritative) runtimes
 * share this one codebase, and `VITE_SYNTHESIS_ONLINE` is the only switch
 * between them. `npm run dev` and the default/Pages production build leave it
 * unset and stay Sandbox; `npm run dev:online` and `npm run build:online` set
 * it via `.env.online`.
 */
export function onlineRuntimeEnabled(environment: Pick<ImportMetaEnv, 'MODE' | 'VITE_SYNTHESIS_ONLINE'>): boolean {
  return environment.MODE !== 'test' && environment.VITE_SYNTHESIS_ONLINE === '1'
}

function OnlineApp() {
  const [snapshot, setSnapshot] = useState<AuthenticatedSnapshot | null>(null)
  const [restoring, setRestoring] = useState(true)
  useEffect(() => { void restoreOnlineSession().then(setSnapshot).catch(() => undefined).finally(() => setRestoring(false)) }, [])
  if (restoring) return <main className="online-entry" aria-label="Restoring Synthesis session" />
  if (!snapshot) return <Login onEnter={async (name, password) => setSnapshot(await enterSynthesis(name, password))} />
  return <><button className="online-logout" onClick={() => { void logoutOnlineSession().finally(() => setSnapshot(null)) }}>LOG OUT</button><GameProvider initialState={snapshot.state} serverOwnsAdvancement reconTransport={{ observe: async (kind, input) => { const response = await observeOnline(kind, input); setSnapshot(response.snapshot); return { result: response.result, state: response.snapshot.state } } }}><Shell /></GameProvider></>
}
