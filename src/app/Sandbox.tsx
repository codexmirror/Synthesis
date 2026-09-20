import { useEffect, useRef, useState } from 'react'
import { createSandboxGameState } from '../core/game/fieldwork'
import { GameProvider, useGameState } from './GameContext'
import { Shell } from '../shell/Shell'
import { backupSandbox, loadSandboxSave, saveSandbox, type SandboxSave } from './sandboxSave'

function readCheckpoint(): SandboxSave {
  try { return loadSandboxSave(window.localStorage) } catch { return { status: 'unavailable', reason: 'Local storage is unavailable.' } }
}
export function Sandbox() {
  const [loaded, setLoaded] = useState(readCheckpoint)
  const [generation, setGeneration] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [initial, setInitial] = useState(() => loaded.status === 'ready' ? loaded.state : createSandboxGameState())
  function fresh() {
    try {
      if (!backupSandbox(window.localStorage)) { setError('Could not preserve your previous checkpoint. It has not been replaced.'); return }
      const next = createSandboxGameState()
      if (!saveSandbox(window.localStorage, next)) { setError('Could not save the new Sandbox.'); return }
      setInitial(next); setLoaded({ status: 'ready', state: next }); setGeneration(g => g + 1); setConfirm(false); setError('')
    } catch { setError('Local storage is unavailable. Your checkpoint has not been replaced.') }
  }
  if (loaded.status === 'unavailable') return <main className="app-content"><h1>Sandbox checkpoint</h1><p>{loaded.reason}</p><p>Starting fresh preserves the previous checkpoint locally.</p><button className="node-action" onClick={fresh}>PRESERVE CHECKPOINT AND START FRESH</button>{error && <p role="alert">{error}</p>}</main>
  return <GameProvider key={generation} initialState={initial}><Checkpoint /><Shell /><details className="sandbox-controls"><summary>SANDBOX OPTIONS</summary><p>Progress saves on this browser. The world pauses while closed. Use one tab per Sandbox.</p>{confirm ? <><p>Start a new world? The current checkpoint will be kept as the previous checkpoint.</p><button className="node-action" onClick={fresh}>KEEP BACKUP AND START FRESH</button><button className="node-action" onClick={() => setConfirm(false)}>KEEP PLAYING</button></> : <button className="node-action" onClick={() => setConfirm(true)}>NEW SANDBOX</button>}{error && <p role="alert">{error}</p>}</details></GameProvider>
}
function Checkpoint() {
  const state = useGameState(), current = useRef(state)
  current.current = state
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const save = () => { try { setFailed(!saveSandbox(window.localStorage, current.current)) } catch { setFailed(true) } }
    const interval = window.setInterval(save, 2000)
    window.addEventListener('pagehide', save)
    return () => { window.clearInterval(interval); window.removeEventListener('pagehide', save) }
  }, [])
  return failed ? <p className="node-note node-note--caution" role="alert">Progress could not be saved in this browser. Keep this tab open.</p> : null
}
