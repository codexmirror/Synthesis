import './shell.css'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { appRegistry, type AppId } from './appRegistry'
import { Home } from './Home'
import { StatusBar } from './StatusBar'
import { SystemBar } from './SystemBar'
import { useEditingViewport } from './useEditingViewport'
import { ViewportDebug } from './ViewportDebug'
import { useGameActions, useGameState } from '../app/GameContext'
import { resolveActiveRemoteTarget } from '../core/game/remoteSession'
import { RackOS } from '../apps/rackos/RackOS'
import { RemoteSessionHandoff } from './RemoteSessionHandoff'

type ShellStyle = CSSProperties & {
  '--node-host-height': string
  '--node-edit-top': string
  '--node-edit-height': string
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

function isStandalonePresentation(): boolean {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  )
}

export function Shell() {
  const [activeAppId, setActiveAppId] = useState<AppId | null>(null)
  const [enteredRemoteSessionId, setEnteredRemoteSessionId] = useState<string | null>(null)
  const remoteTarget = resolveActiveRemoteTarget(useGameState())
  const remoteSessionId = remoteTarget?.session.id
  const { disconnectRemoteSession } = useGameActions()
  const activeApp = activeAppId ? appRegistry[activeAppId] : null
  const ActiveComponent = activeApp?.component
  const standalonePresentation = isStandalonePresentation()
  const shellRef = useRef<HTMLDivElement>(null)
  const viewport = useEditingViewport({ shellRef, standalone: standalonePresentation })
  const shellStyle: ShellStyle = {
    '--node-host-height': `${viewport.hostHeight}px`,
    '--node-edit-top': `${viewport.editTop}px`,
    '--node-edit-height': `${viewport.editHeight}px`,
  }

  useEffect(() => {
    if (!remoteSessionId) return
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
  }, [remoteSessionId])

  function finishEditing() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
  }

  return (
    <div
      className="os-shell"
      ref={shellRef}
      data-testid="os-shell"
      data-editing-geometry={viewport.editing ? 'true' : 'false'}
      data-editing-presentation={viewport.editingPresentation ? 'true' : 'false'}
      data-editing-phase={viewport.presentationPhase}
      data-recovery-ready={viewport.recoveryReady ? 'true' : 'false'}
      data-viewport-lifecycle={viewport.viewportLifecycle}
      data-standalone={standalonePresentation ? 'true' : 'false'}
      style={shellStyle}
    >
      <div className="node-workspace" hidden={Boolean(remoteTarget)}>
      <StatusBar />
      {ActiveComponent && activeApp && activeAppId ? (
        <main className="app-view">
          <div className="app-header">
            <button
              className="back"
              onClick={() => setActiveAppId(null)}
              aria-label="Back to home"
            >
              ← <span>HOME</span>
            </button>
            <div className="app-title">
              {viewport.editingPresentation && <span className="app-mode">EDITING</span>}
              <h1>{activeApp.label}</h1>
            </div>
            {viewport.editingPresentation ? (
              <button
                className="done"
                type="button"
                onClick={finishEditing}
                aria-label="Finish editing"
              >
                DONE
              </button>
            ) : <span aria-hidden="true" />}
          </div>
          <ActiveComponent />
        </main>
      ) : (
        <Home openApp={setActiveAppId} />
      )}
      <SystemBar />
      </div>
      {remoteTarget && enteredRemoteSessionId !== remoteTarget.session.id && (
        <RemoteSessionHandoff
          context={remoteTarget}
          ready={viewport.recoveryReady}
          onEnter={() => setEnteredRemoteSessionId(remoteTarget.session.id)}
          onDisconnect={disconnectRemoteSession}
        />
      )}
      {remoteTarget && enteredRemoteSessionId === remoteTarget.session.id && (
        <RackOS key={remoteTarget.session.id} context={remoteTarget} />
      )}
      <ViewportDebug viewport={viewport} />
    </div>
  )
}
