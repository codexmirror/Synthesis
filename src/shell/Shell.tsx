import { useGame } from '../core/game/GameContext'
import { appRegistry } from './appRegistry'
import { Home } from './Home'
import { StatusBar } from './StatusBar'
import { SystemBar } from './SystemBar'

export function Shell() {
  const { player, goHome } = useGame()
  const activeApp = appRegistry.find((app) => app.id === player.currentApp)
  const ActiveComponent = activeApp?.component
  return <div className="os-shell" data-testid="os-shell"><StatusBar />{ActiveComponent && activeApp ? <main className="app-view"><div className="app-header"><button className="back" onClick={goHome} aria-label="Back to home">← <span>HOME</span></button><h1>{activeApp.label}</h1><span className="app-index">{String(appRegistry.indexOf(activeApp) + 1).padStart(2, '0')} / {String(appRegistry.length).padStart(2, '0')}</span></div><ActiveComponent /></main> : <Home />}<SystemBar /></div>
}
