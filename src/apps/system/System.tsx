import { useGameState } from '../../app/GameContext'

export function System() {
  const { player, system } = useGameState()
  const rows = [
    ['CPU', system.hardware.cpu],
    ['RAM', system.hardware.ram],
    ['CPU load', `${system.runtime.cpuLoad}%`],
    ['RAM usage', `${system.runtime.ramUsage}%`],
    ['Network', system.runtime.networkStatus],
    ['Local address', player.ip],
  ]
  return <section className="app-content"><p className="eyebrow">SYSTEM DIAGNOSTICS</p><div className="system-list">{rows.map(([label, value]) => <div className="system-row" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div></section>
}
