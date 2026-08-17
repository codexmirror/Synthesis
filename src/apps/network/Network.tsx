import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { scanNetworkTarget, type ScanResult } from '../../core/game/scan'
import type { ServiceAnalysisProcess } from '../../core/game/types'

type DeviceObservation = Extract<ScanResult, { status: 'device' }>
type NetworkObservation = Extract<ScanResult, { status: 'network' }>
type CopyState = { value: string; status: 'copied' | 'failed' } | null
type StartFeedback = { serviceId: string; message: string } | null

function CopyReference({ value, copyState, onCopy }: { value: string; copyState: CopyState; onCopy(value: string): void }) {
  const status = copyState?.value === value ? copyState.status : null
  return <button type="button" className="scan-copy" onClick={() => onCopy(value)} aria-label={`Copy ${value}`}>
    <span>{value}</span><span className="scan-copy-icon" aria-hidden="true">{status === 'copied' ? '✓' : status === 'failed' ? '!' : '⧉'}</span>
    <span className="sr-only" aria-live="polite">{status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : ''}</span>
  </button>
}

export function Network() {
  const gameState = useGameState()
  const actions = useGameActions()
  const targets = { localDevice: gameState.player.localDevice, network: gameState.world.network }
  const [selfObservation] = useState(() => scanNetworkTarget(targets, gameState.player.localDevice.network.ip))
  const [networkObservation, setNetworkObservation] = useState<NetworkObservation | null>(null)
  const [deviceObservation, setDeviceObservation] = useState<DeviceObservation | null>(null)
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [feedback, setFeedback] = useState<StartFeedback>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const observedNetworks = selfObservation.status === 'device' ? selfObservation.networks : []

  function scanNetwork(name: string) {
    const result = scanNetworkTarget(targets, name)
    if (result.status === 'network') { setNetworkObservation(result); setDeviceObservation(null); setFeedback(null) }
  }
  function scanDevice(address: string) {
    const result = scanNetworkTarget(targets, address)
    if (result.status === 'device') { setDeviceObservation(result); setFeedback(null) }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyState({ value, status: 'copied' }) }
    catch { setCopyState({ value, status: 'failed' }) }
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopyState(null), 1600)
  }
  function analyze(endpoint: string, targetDeviceId: string, serviceId: string) {
    const result = actions.startServiceAnalysisFromObservation({ endpoint, targetDeviceId, serviceId })
    if (result.status === 'started') setFeedback(null)
    else if (result.status === 'insufficient_memory') setFeedback({ serviceId, message: `INSUFFICIENT MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available` })
    else setFeedback({ serviceId, message: result.status === 'already_running' ? 'ANALYSIS ALREADY RUNNING' : result.status === 'endpoint_not_found' || result.status === 'invalid_endpoint' ? 'ENDPOINT NOT AVAILABLE' : 'SERVICE UNAVAILABLE' })
  }

  return <section className="app-content scan-app" aria-label="Scan workspace">
    <header className="scan-intro"><p className="eyebrow">SCAN</p><p>Local environment</p></header>
    {deviceObservation ? <DeviceView observation={deviceObservation} networkObservation={networkObservation} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={gameState.knowledge.discoveredVulnerabilities} copyState={copyState} feedback={feedback} onCopy={copy} onAnalyze={analyze} onBack={() => { setDeviceObservation(null); setFeedback(null) }} />
      : networkObservation ? <NetworkView observation={networkObservation} copyState={copyState} onCopy={copy} onDevice={scanDevice} onBack={() => setNetworkObservation(null)} onRescan={() => scanNetwork(networkObservation.networkName)} />
        : <div><div className="scan-section-heading"><span>NETWORKS</span><span>{observedNetworks.length} connected</span></div><div className="scan-list">{observedNetworks.map((network) => <article className="scan-object network-object" key={network.id}><div><span className="scan-type">LOCAL NETWORK</span><h2>{network.name}</h2></div><button className="scan-action" type="button" onClick={() => scanNetwork(network.name)}>Scan network</button></article>)}</div></div>}
  </section>
}

function NetworkView({ observation, copyState, onCopy, onDevice, onBack, onRescan }: { observation: NetworkObservation; copyState: CopyState; onCopy(value: string): void; onDevice(address: string): void; onBack(): void; onRescan(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← Networks</button><span>/</span><strong>{observation.networkName}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">NETWORK</span><h2>{observation.networkName}</h2></div><button className="scan-quiet" onClick={onRescan}>Rescan</button></div><div className="scan-section-heading"><span>DEVICES</span><span>{observation.devices.length} responding</span></div><div className="scan-list">{observation.devices.map((device) => <article className="scan-object device-object" key={device.targetId}><div><span className="scan-type">{device.scope === 'self' ? 'SELF' : `${device.scope.toUpperCase()} DEVICE`}</span><CopyReference value={device.address} copyState={copyState} onCopy={onCopy} /></div><button className="scan-open" onClick={() => onDevice(device.address)} aria-label={`Scan device ${device.address}`}>→</button></article>)}</div></div>
}

function DeviceView({ observation, networkObservation, processes, knowledge, copyState, feedback, onCopy, onAnalyze, onBack }: { observation: DeviceObservation; networkObservation: NetworkObservation | null; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { targetDeviceId: string; serviceId: string; observedLabel: string }[]; copyState: CopyState; feedback: StartFeedback; onCopy(value: string): void; onAnalyze(endpoint: string, targetDeviceId: string, serviceId: string): void; onBack(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {networkObservation?.networkName ?? 'Devices'}</button><span>/</span><strong>{observation.address}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">{observation.scope === 'self' ? 'SELF' : `${observation.scope.toUpperCase()} DEVICE`}</span><CopyReference value={observation.address} copyState={copyState} onCopy={onCopy} /></div></div><div className="scan-section-heading"><span>NETWORKS</span><span>{observation.networks.length} discovered</span></div>{observation.networks.map((network) => <div className="relationship" key={network.id}><span>NETWORK</span><strong>{network.name}</strong></div>)}<div className="scan-section-heading"><span>SERVICES</span><span>{observation.services.length} open</span></div><div className="service-list">{observation.services.map((service) => {
    const endpoint = `${observation.address}:${service.port}`
    const related = processes.filter((p) => p.targetDeviceId === observation.targetId && p.serviceId === service.id && p.startedEndpoint === endpoint)
    const running = related.find((p) => p.status === 'running')
    const completed = [...related].reverse().find((p) => p.status === 'completed' && p.result)
    const known = knowledge.filter((k) => k.targetDeviceId === observation.targetId && k.serviceId === service.id)
    const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
    const lastResult = completed?.result?.status === 'no_weakness_detected' ? 'No weakness detected' : completed?.result?.status === 'service_unavailable' ? 'Service unavailable during analysis' : completed?.result?.status === 'weaknesses_detected' ? 'Weakness detected' : null
    return <article className="service-card" key={service.id}><header><div><span className="scan-type">SERVICE</span><h3>{service.name}</h3></div><span className="open-chip">OPEN</span></header><div className="service-meta"><span>{service.port} / {service.protocol}</span><div className="endpoint-reference"><span>ENDPOINT</span><CopyReference value={endpoint} copyState={copyState} onCopy={onCopy} /></div></div>{known.length > 0 && <div className="knowledge-block"><span>KNOWN WEAKNESS</span>{known.map((item, i) => <strong key={i}>{item.observedLabel}</strong>)}</div>}{lastResult && <div className="analysis-result"><span>LAST ANALYSIS</span><strong>{lastResult}</strong></div>}{running ? <div className="analysis-running"><div><span>ANALYSIS RUNNING</span><strong>{progress}%</strong></div><progress max="100" value={progress}>{progress}%</progress></div> : <button className="scan-action analyze" onClick={() => onAnalyze(endpoint, observation.targetId, service.id)}>{completed ? 'Analyze again' : 'Analyze'}</button>}{!running && feedback?.serviceId === service.id && <p className="scan-feedback" role="status">{feedback.message}</p>}</article>
  })}</div></div>
}
