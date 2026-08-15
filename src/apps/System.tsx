import { useGame } from '../core/game/GameContext'

export function System() {
  const { player } = useGame()
  const rows = [['CPU load', `${player.hardware.cpu}%`], ['RAM used', `${player.hardware.ram}%`], ['Network', player.status], ['Local address', player.ip]]
  return <section className="app-content"><p className="eyebrow">SYSTEM DIAGNOSTICS</p><div className="system-list">{rows.map(([label, value]) => <div className="system-row" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div></section>
}
