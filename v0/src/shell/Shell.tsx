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
import { VeyraOS } from '../apps/veyra/VeyraOS'
import { RemoteSessionHandoff } from './RemoteSessionHandoff'
import { selectRemoteOperatingSurface } from './remoteOperatingSurface'
import { createViewportDiagnostics } from './viewportDiagnostics'

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
  const [operatingContext, setOperatingContext] = useState<'local' | 'remote'>('local')
  const [pendingOperatingContext, setPendingOperatingContext] = useState<'local' | 'remote' | null>(null)
  const remoteTarget = resolveActiveRemoteTarget(useGameState())
  const remoteSessionId = remoteTarget?.session.id
  /* Which foreign environment this target actually runs, decided from its own
     represented Firmware identity. Firmware this Shell cannot present resolves
     to nothing and is refused at the handoff rather than being shown somebody
     else's operating surface. */
  const remoteSurface = selectRemoteOperatingSurface(remoteTarget?.target.firmware)
  const { disconnectRemoteSession } = useGameActions()
  const activeApp = activeAppId ? appRegistry[activeAppId] : null
  const ActiveComponent = activeApp?.component
  const standalonePresentation = isStandalonePresentation()
  const shellRef = useRef<HTMLDivElement>(null)
  const [viewportDiagnostics] = useState(createViewportDiagnostics)
  const viewport = useEditingViewport({
    shellRef,
    standalone: standalonePresentation,
    onDiagnostic: viewportDiagnostics
      ? (name, detail) => viewportDiagnostics.record('CONTROLLER', name, detail)
      : undefined,
  })
  const shellStyle: ShellStyle = {
    '--node-host-height': `${viewport.hostHeight}px`,
    '--node-edit-top': `${viewport.editTop}px`,
    '--node-edit-height': `${viewport.editHeight}px`,
  }

  useEffect(() => {
    if (!remoteSessionId) {
      setEnteredRemoteSessionId(null)
      setOperatingContext('local')
      setPendingOperatingContext(null)
      return
    }
    endEditing()
  }, [remoteSessionId])

  useEffect(() => {
    if (!pendingOperatingContext || !viewport.recoveryReady) return
    setOperatingContext(pendingOperatingContext)
    setPendingOperatingContext(null)
  }, [pendingOperatingContext, viewport.recoveryReady])

  /**
   * The Shell owns leaving editing. Releasing whatever currently holds focus
   * is one half of that; the other half is telling the editing controller that
   * the interaction has ended, because Mobile Safari does not reliably report
   * the release as a focusout the controller can attribute. Recovery still
   * waits for the controller's own recovered viewport evidence.
   */
  function endEditing() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
    viewport.endEditing()
  }

  function switchOperatingContext(destination: 'local' | 'remote') {
    endEditing()
    setPendingOperatingContext(destination)
  }

  /* Entry requires a presentable surface, and staying entered requires one
     too: if the target's Firmware ever stopped resolving to an implemented
     environment, the Session falls back to the handoff that says so rather
     than to an empty operating context. */
  const remoteEntered = Boolean(remoteTarget && enteredRemoteSessionId === remoteTarget.session.id && remoteSurface)
  const presentingRemote = remoteEntered && operatingContext === 'remote'
  const presentingHandoff = Boolean(remoteTarget && !remoteEntered)

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
      <div className="node-workspace" hidden={presentingHandoff || presentingRemote}>
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
                onClick={endEditing}
                aria-label="Finish editing"
              >
                DONE
              </button>
            ) : <span aria-hidden="true" />}
          </div>
          <ActiveComponent openApp={setActiveAppId} />
        </main>
      ) : (
        <Home openApp={setActiveAppId} />
      )}
      <SystemBar remoteContext={remoteEntered && !presentingRemote ? remoteTarget : undefined} onReturnRemote={() => switchOperatingContext('remote')} />
      </div>
      {remoteTarget && enteredRemoteSessionId !== remoteTarget.session.id && (
        <RemoteSessionHandoff
          context={remoteTarget}
          ready={viewport.recoveryReady}
          supported={remoteSurface !== undefined}
          onEnter={() => {
            setEnteredRemoteSessionId(remoteTarget.session.id)
            setOperatingContext('remote')
          }}
          onDisconnect={disconnectRemoteSession}
        />
      )}
      {remoteTarget && remoteEntered && remoteSurface === 'rack-os' && (
        <RackOS
          key={remoteTarget.session.id}
          context={remoteTarget}
          hidden={!presentingRemote}
          onReturnLocal={() => switchOperatingContext('local')}
          editingRecoveryReady={viewport.recoveryReady}
          onEndEditing={endEditing}
        />
      )}
      {remoteTarget && remoteEntered && remoteSurface === 'veyra-os' && (
        <VeyraOS
          key={remoteTarget.session.id}
          context={remoteTarget}
          hidden={!presentingRemote}
          onReturnLocal={() => switchOperatingContext('local')}
          editingRecoveryReady={viewport.recoveryReady}
          onEndEditing={endEditing}
        />
      )}
      <ViewportDebug viewport={viewport} diagnostics={viewportDiagnostics} standalone={standalonePresentation} />
    </div>
  )
}
