import { useGame } from '../core/game/GameContext'
import { appRegistry } from './appRegistry'

export function Home() {
  const { openApp } = useGame()
  return <main className="home"><div className="home-heading"><p className="eyebrow">LOCAL WORKSPACE</p><h1>Select a module</h1></div><div className="app-grid">{appRegistry.map((app) => <button className="app-launcher" key={app.id} onClick={() => openApp(app.id)}><span className="app-glyph">{app.glyph}</span><span>{app.label}</span><small>OPEN /</small></button>)}</div></main>
}
