import './shell.css'
import { type CSSProperties, useState } from 'react'
import { appEntries, appRegistry, type AppId } from './appRegistry'
import { Home } from './Home'
import { StatusBar } from './StatusBar'
import { SystemBar } from './SystemBar'
import { useMobileViewport } from './useMobileViewport'

type ShellStyle = CSSProperties & {
  '--node-app-height': string
  '--node-keyboard-inset': string
  '--node-vv-top': string
}

export function Shell() {
  const [activeAppId, setActiveAppId] = useState<AppId | null>(null)
  const activeApp = activeAppId ? appRegistry[activeAppId] : null
  const ActiveComponent = activeApp?.component
  const viewport = useMobileViewport()
  const shellStyle: ShellStyle = {
    '--node-app-height': `${viewport.stableHeight}px`,
    '--node-keyboard-inset': `${viewport.keyboardOpen ? viewport.keyboardInset : 0}px`,
    '--node-vv-top': `${viewport.keyboardOpen ? viewport.offsetTop : 0}px`,
  }

  return <div className="os-shell" data-testid="os-shell" data-keyboard-open={viewport.keyboardOpen ? 'true' : 'false'} style={shellStyle}>
    <StatusBar />
    {ActiveComponent && activeApp && activeAppId
      ? <main className="app-view">
          <div className="app-header">
            <button className="back" onClick={() => setActiveAppId(null)} aria-label="Back to home">← <span>HOME</span></button>
            <h1>{activeApp.label}</h1>
            <span className="app-index">{String(appEntries.findIndex(([id]) => id === activeAppId) + 1).padStart(2, '0')} / {String(appEntries.length).padStart(2, '0')}</span>
          </div>
          <ActiveComponent />
        </main>
      : <Home openApp={setActiveAppId} />}
    <SystemBar />
  </div>
}
