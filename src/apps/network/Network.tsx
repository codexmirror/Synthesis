import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { scanNetworkTarget, type DiscoveredService, type ScanResult } from '../../core/game/scan'
import type { ServiceAnalysisProcess } from '../../core/game/types'

type DeviceObservation = Extract<ScanResult, { status: 'device' }>
type NetworkObservation = Extract<ScanResult, { status: 'network' }>
type CopyState = { value: string; status: 'copied' | 'failed' } | null
type StartFeedback = { serviceId: string; message: string } | null
type ServiceObservation = DiscoveredService & { readonly endpoint: string; readonly targetDeviceId: string }

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
  const [serviceObservation, setServiceObservation] = useState<ServiceObservation | null>(null)
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [feedback, setFeedback] = useState<StartFeedback>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const observedNetworks = selfObservation.status === 'device' ? selfObservation.networks : []

  function scanNetwork(name: string) {
    const result = scanNetworkTarget(targets, name)
    if (result.status === 'network') { setNetworkObservation(result); setDeviceObservation(null); setServiceObservation(null); setFeedback(null) }
  }
  function scanDevice(address: string) {
    const result = scanNetworkTarget(targets, address)
    if (result.status === 'device') { setDeviceObservation(result); setServiceObservation(null); setFeedback(null) }
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
    <header className="scan-intro"><p className="eyebrow">SCAN</p><p>Known space</p></header>
    {serviceObservation && deviceObservation ? <ServiceView observation={serviceObservation} deviceAddress={deviceObservation.address} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={gameState.knowledge.discoveredVulnerabilities} copyState={copyState} feedback={feedback} onCopy={copy} onAnalyze={analyze} onBack={() => { setServiceObservation(null); setFeedback(null) }} />
      : deviceObservation ? <DeviceView observation={deviceObservation} networkObservation={networkObservation} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={gameState.knowledge.discoveredVulnerabilities} copyState={copyState} onCopy={copy} onService={(service) => { setServiceObservation({ ...service, endpoint: `${deviceObservation.address}:${service.port}`, targetDeviceId: deviceObservation.targetId }); setFeedback(null) }} onBack={() => { setDeviceObservation(null); setFeedback(null) }} />
      : networkObservation ? <NetworkView observation={networkObservation} copyState={copyState} onCopy={copy} onDevice={scanDevice} onBack={() => setNetworkObservation(null)} onRescan={() => scanNetwork(networkObservation.networkName)} />
        : <div className="known-space"><div className="scan-section-heading"><span>KNOWN SPACE</span></div><div className="scan-list">{observedNetworks.map((network) => <article className="scan-object network-object" key={network.id}><div className="known-space-identity"><span className="scan-area-label">HOME</span><h2>{network.name}</h2><span className="scan-type">LOCAL NETWORK</span></div><button className="scan-action" type="button" aria-label={`Open and scan ${network.name}`} onClick={() => scanNetwork(network.name)}>Open / Scan</button></article>)}</div></div>}
  </section>
}

function NetworkView({ observation, copyState, onCopy, onDevice, onBack, onRescan }: { observation: NetworkObservation; copyState: CopyState; onCopy(value: string): void; onDevice(address: string): void; onBack(): void; onRescan(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← Known Space</button><span>/</span><strong>{observation.networkName}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">NETWORK</span><h2>{observation.networkName}</h2></div><button className="scan-quiet" onClick={onRescan}>Rescan</button></div><div className="scan-section-heading"><span>DEVICES</span><span>{observation.devices.length} responding</span></div><div className="scan-list">{observation.devices.map((device) => <article className="scan-object device-object" key={device.targetId}><div><span className="scan-type">{device.scope === 'self' ? 'SELF' : `${device.scope.toUpperCase()} DEVICE`}</span><CopyReference value={device.address} copyState={copyState} onCopy={onCopy} /></div><button className="scan-open" onClick={() => onDevice(device.address)} aria-label={`Scan device ${device.address}`}>→</button></article>)}</div></div>
}

function matchingProcesses(processes: readonly ServiceAnalysisProcess[], observation: ServiceObservation) {
  return processes.filter((process) => process.targetDeviceId === observation.targetDeviceId && process.serviceId === observation.id && process.startedEndpoint === observation.endpoint)
}

function DeviceView({ observation, networkObservation, processes, knowledge, copyState, onCopy, onService, onBack }: { observation: DeviceObservation; networkObservation: NetworkObservation | null; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { targetDeviceId: string; serviceId: string; observedLabel: string }[]; copyState: CopyState; onCopy(value: string): void; onService(service: DiscoveredService): void; onBack(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {networkObservation?.networkName ?? 'Devices'}</button><span>/</span><strong>{observation.address}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">{observation.scope === 'self' ? 'SELF' : `${observation.scope.toUpperCase()} DEVICE`}</span><CopyReference value={observation.address} copyState={copyState} onCopy={onCopy} /></div></div><div className="scan-section-heading"><span>NETWORKS</span><span>{observation.networks.length} discovered</span></div>{observation.networks.map((network) => <div className="relationship" key={network.id}><span>NETWORK</span><strong>{network.name}</strong></div>)}<div className="scan-section-heading"><span>SERVICES</span><span>{observation.services.length} open</span></div><div className="service-list">{observation.services.map((service) => {
    const serviceObservation = { ...service, endpoint: `${observation.address}:${service.port}`, targetDeviceId: observation.targetId }
    const related = matchingProcesses(processes, serviceObservation)
    const running = related.find((p) => p.status === 'running')
    const completed = [...related].reverse().find((p) => p.status === 'completed' && p.result)
    const known = knowledge.filter((k) => k.targetDeviceId === observation.targetId && k.serviceId === service.id)
    const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
    const summary = running ? `ANALYSIS RUNNING · ${progress}%` : known.length > 0 ? 'Weakness known' : completed ? 'Analysis complete' : 'Not analyzed'
    return <button type="button" className="service-row" key={service.id} onClick={() => onService(service)} aria-label={`Open ${service.name} service`}><span className="service-row-main"><strong>{service.name}</strong><span>{service.port} / {service.protocol}</span><span className="open-chip">OPEN</span></span><span className="service-row-secondary"><span>{summary}</span><span className="service-row-arrow" aria-hidden="true">→</span></span></button>
  })}</div></div>
}

function ServiceView({ observation, deviceAddress, processes, knowledge, copyState, feedback, onCopy, onAnalyze, onBack }: { observation: ServiceObservation; deviceAddress: string; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { targetDeviceId: string; serviceId: string; observedLabel: string }[]; copyState: CopyState; feedback: StartFeedback; onCopy(value: string): void; onAnalyze(endpoint: string, targetDeviceId: string, serviceId: string): void; onBack(): void }) {
  const related = matchingProcesses(processes, observation)
  const running = related.find((process) => process.status === 'running')
  const completed = [...related].reverse().find((process) => process.status === 'completed' && process.result)
  const known = knowledge.filter((item) => item.targetDeviceId === observation.targetDeviceId && item.serviceId === observation.id)
  const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
  const lastResult = completed?.result?.status === 'no_weakness_detected' ? 'No weakness detected' : completed?.result?.status === 'service_unavailable' ? 'Service unavailable during analysis' : completed?.result?.status === 'weaknesses_detected' ? 'Weakness detected' : null
  return <div className="service-detail"><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {deviceAddress}</button><span>/</span><strong>{observation.name}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">SERVICE</span><h2>{observation.name}</h2></div><span className="open-chip">OPEN</span></div><div className="service-identity"><div><span>ENDPOINT</span><CopyReference value={observation.endpoint} copyState={copyState} onCopy={onCopy} /></div><dl><div><dt>PROTOCOL</dt><dd>{observation.protocol}</dd></div><div><dt>PORT</dt><dd>{observation.port}</dd></div></dl></div><div className="scan-section-heading"><span>KNOWLEDGE</span></div>{known.length > 0 ? <div className="knowledge-block"><span>KNOWN WEAKNESS</span>{known.map((item, index) => <strong key={index}>{item.observedLabel}</strong>)}</div> : <p className="empty-knowledge">No known weakness recorded</p>}{lastResult && <><div className="scan-section-heading"><span>LAST ANALYSIS</span></div><div className="analysis-result"><strong>{lastResult}</strong></div></>}{running && <div className="analysis-running"><div><span>ANALYSIS RUNNING</span><strong>{progress}%</strong></div><progress max="100" value={progress}>{progress}%</progress></div>}<div className="scan-section-heading"><span>INTERACTIONS</span></div><section className="interaction"><span className="scan-type">ANALYZE SERVICE</span><p>Investigate this service surface.</p>{running ? <p className="interaction-running">Analysis running · {progress}%</p> : <button className="scan-action analyze" onClick={() => onAnalyze(observation.endpoint, observation.targetDeviceId, observation.id)}>{completed ? 'Analyze again' : 'Analyze'}</button>}{!running && feedback?.serviceId === observation.id && <p className="scan-feedback" role="status">{feedback.message}</p>}</section></div>
}
