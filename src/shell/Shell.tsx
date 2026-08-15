import './shell.css'
import { useState } from 'react'
import { appEntries, appRegistry, type AppId } from './appRegistry'
import { Home } from './Home'
import { StatusBar } from './StatusBar'
import { SystemBar } from './SystemBar'

export function Shell() {
  const [activeAppId, setActiveAppId] = useState<AppId | null>(null)
  const activeApp = activeAppId ? appRegistry[activeAppId] : null
  const ActiveComponent = activeApp?.component
  return <div className="os-shell" data-testid="os-shell"><StatusBar />{ActiveComponent && activeApp && activeAppId ? <main className="app-view"><div className="app-header"><button className="back" onClick={() => setActiveAppId(null)} aria-label="Back to home">← <span>HOME</span></button><h1>{activeApp.label}</h1><span className="app-index">{String(appEntries.findIndex(([id]) => id === activeAppId) + 1).padStart(2, '0')} / {String(appEntries.length).padStart(2, '0')}</span></div><ActiveComponent /></main> : <Home openApp={setActiveAppId} />}<SystemBar /></div>
}
