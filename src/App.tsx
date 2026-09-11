import { useEffect, useState } from 'react'
import { GameProvider } from './app/GameContext'
import { Shell } from './shell/Shell'
import type { AuthenticatedSnapshot } from './online/model'
import { enterSynthesis, logoutOnlineSession, restoreOnlineSession } from './online/client'
import { Login } from './online/Login'

export default function App() {
  if (typeof process !== 'undefined' && process.env?.VITEST) return <GameProvider><Shell /></GameProvider>
  return <OnlineApp />
}

function OnlineApp() {
  const [snapshot, setSnapshot] = useState<AuthenticatedSnapshot | null>(null)
  const [restoring, setRestoring] = useState(true)
  useEffect(() => { void restoreOnlineSession().then(setSnapshot).catch(() => undefined).finally(() => setRestoring(false)) }, [])
  if (restoring) return <main className="online-entry" aria-label="Restoring Synthesis session" />
  if (!snapshot) return <Login onEnter={async (name, password) => setSnapshot(await enterSynthesis(name, password))} />
  return <><button className="online-logout" onClick={() => { void logoutOnlineSession().finally(() => setSnapshot(null)) }}>LOG OUT</button><GameProvider initialState={snapshot.state} serverOwnsAdvancement><Shell /></GameProvider></>
}
