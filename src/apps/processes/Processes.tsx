import './processes.css'
import { useGameState } from '../../app/GameContext'
import { deriveResourceUsage } from '../../core/game/processes'

export function Processes() {
  const state = useGameState(); const { hardware, runtime } = state.player.localDevice
  const usage = deriveResourceUsage(hardware, runtime, state.process)
  const running = state.process.processes.filter((process) => process.status === 'running')
  return <section className="app-content processes"><p className="eyebrow">PROCESS MONITOR</p>
    <div className="process-summary"><div><span>CPU</span><strong>{Math.round(usage.totalCpuLoad)}%</strong></div><div><span>RAM</span><strong>{(usage.baselineRamMiB + usage.processRamMiB).toFixed(0)} / {usage.ramCapacityMiB} MiB</strong></div></div>
    <h2>Active</h2>{running.length === 0 && <p className="muted">No active processes</p>}
    {state.process.processes.map((process) => <article className="process-card" key={process.id}>
      <header><strong>{process.label}</strong><span>{process.status}</span></header>
      <progress value={process.workCompleted} max={process.workRequired} />
      <div><span>{Math.round(process.workCompleted / process.workRequired * 100)}% complete</span><span>CPU {Math.round(usage.cpuAllocationByProcess[process.id] ?? 0)}%</span><span>RAM {process.status === 'running' ? process.ramRequiredMiB : 0} MiB</span></div>
    </article>)}
  </section>
}
