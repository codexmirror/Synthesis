import './processes.css'
import { useGameActions, useGameState } from '../../app/GameContext'
import { deriveResourceUsage } from '../../core/game/processes'

export function Processes() {
  const state = useGameState(); const { clearCompletedProcesses } = useGameActions(); const { hardware, runtime } = state.player.localDevice
  const usage = deriveResourceUsage(hardware, runtime, state.process)
  const running = state.process.processes.filter((process) => process.status === 'running')
  const completed = state.process.processes.filter((process) => process.status === 'completed')
  const cards = (processes: typeof state.process.processes) => processes.map((process) => <article className="process-card" key={process.id}>
    <header><strong>{process.label}</strong><span>{process.status}</span></header>
    {process.kind === 'service_analysis' && <p><span>Target</span><br /><strong className="process-value">{process.startedEndpoint}</strong></p>}
    <progress value={process.workCompleted} max={process.workRequired} />
    <div><span>{Math.round(process.workCompleted / process.workRequired * 100)}% complete</span><span>CPU {Math.round(usage.cpuAllocationByProcess[process.id] ?? 0)}%</span><span>RAM {process.status === 'running' ? process.ramRequiredMiB : 0} MiB</span></div>
    {process.kind === 'service_analysis' && process.result?.status === 'weaknesses_detected' && <p><strong>WEAKNESS DETECTED</strong><br />{process.result.vulnerabilities.map(({ vulnerabilityId, observedLabel }) => <span className="process-value" key={vulnerabilityId}>{observedLabel}</span>)}</p>}
    {process.kind === 'service_analysis' && process.result?.status === 'no_weakness_detected' && <p><strong>NO WEAKNESS DETECTED</strong></p>}
    {process.kind === 'service_analysis' && process.result?.status === 'service_unavailable' && <p><strong>SERVICE UNAVAILABLE</strong></p>}
  </article>)
  return <section className="app-content processes"><p className="eyebrow">PROCESS MONITOR</p>
    <div className="process-summary"><div><span>CPU</span><strong>{Math.round(usage.totalCpuLoad)}%</strong></div><div><span>RAM</span><strong>{(usage.baselineRamMiB + usage.processRamMiB).toFixed(0)} / {usage.ramCapacityMiB} MiB</strong></div></div>
    <h2>Active</h2>{running.length === 0 && <p className="muted">No active processes</p>}
    {cards(running)}
    {completed.length > 0 && <><div className="process-section-heading"><h2>Completed</h2><button type="button" aria-label="Clear completed processes" onClick={() => { if (window.confirm('Clear completed process history?')) clearCompletedProcesses() }}>Clear completed</button></div>{cards(completed)}</>}
  </section>
}
