import { useGameState } from '../../app/GameContext'
import { deriveResourceUsage } from '../../core/game/processes'

export function System() {
  const state = useGameState(); const { localDevice } = state.player
  const usage = deriveResourceUsage(localDevice.hardware, localDevice.runtime, state.process)
  const rows = [
    ['Device', localDevice.displayName],
    ['Firmware', localDevice.firmware.name],
    ['Version', localDevice.firmware.version],
    ['CPU', localDevice.hardware.cpu.name],
    ['RAM', localDevice.hardware.ram.name],
    ['CPU load', `${Math.round(usage.totalCpuLoad)}%`],
    ['RAM usage', `${Math.round(usage.totalRamUsage)}%`],
    ['Network', localDevice.runtime.networkStatus],
    ['Local address', localDevice.network.ip],
  ]
  return <section className="app-content"><p className="eyebrow">SYSTEM DIAGNOSTICS</p><div className="system-list">{rows.map(([label, value]) => <div className="system-row" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div></section>
}
