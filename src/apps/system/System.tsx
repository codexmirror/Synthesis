import { useGameState } from '../../app/GameContext'

export function System() {
  const { localDevice } = useGameState().player
  const rows = [
    ['CPU', localDevice.hardware.cpu],
    ['RAM', localDevice.hardware.ram],
    ['CPU load', `${localDevice.runtime.cpuLoad}%`],
    ['RAM usage', `${localDevice.runtime.ramUsage}%`],
    ['Network', localDevice.runtime.networkStatus],
    ['Local address', localDevice.network.ip],
  ]
  return <section className="app-content"><p className="eyebrow">SYSTEM DIAGNOSTICS</p><div className="system-list">{rows.map(([label, value]) => <div className="system-row" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div></section>
}
