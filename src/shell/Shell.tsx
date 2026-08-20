import './shell.css'
import { type CSSProperties, useState } from 'react'
import { appRegistry, type AppId } from './appRegistry'
import { Home } from './Home'
import { StatusBar } from './StatusBar'
import { SystemBar } from './SystemBar'
import { useEditingViewport } from './useEditingViewport'
import { ViewportDebug } from './ViewportDebug'

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
  const activeApp = activeAppId ? appRegistry[activeAppId] : null
  const ActiveComponent = activeApp?.component
  const viewport = useEditingViewport()
  const standalonePresentation = isStandalonePresentation()
  const shellStyle: ShellStyle = {
    '--node-host-height': `${viewport.hostHeight}px`,
    '--node-edit-top': `${viewport.editTop}px`,
    '--node-edit-height': `${viewport.editHeight}px`,
  }

  function finishEditing() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
  }

  return (
    <div
      className="os-shell"
      data-testid="os-shell"
      data-editing={viewport.editing ? 'true' : 'false'}
      data-standalone={standalonePresentation ? 'true' : 'false'}
      style={shellStyle}
    >
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
              {viewport.editing && <span className="app-mode">EDITING</span>}
              <h1>{activeApp.label}</h1>
            </div>
            {viewport.editing ? (
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
      <ViewportDebug viewport={viewport} />
    </div>
  )
}
