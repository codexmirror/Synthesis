import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ServiceAnalysisProcess, DiscoveredDeviceSnapshot, DiscoveredNetworkSnapshot, DiscoveredServiceSnapshot } from '../../core/game/types'

type CopyState = { value: string; status: 'copied' | 'failed' } | null
type StartFeedback = { serviceId: string; message: string } | null
type ServiceObservation = DiscoveredServiceSnapshot & { readonly targetDeviceId: string }

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
  const [networkId, setNetworkId] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [serviceObservation, setServiceObservation] = useState<ServiceObservation | null>(null)
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [feedback, setFeedback] = useState<StartFeedback>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const pendingTargetRef = useRef<string | null>(null)
  const requestGeneration = useRef(0)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { requestGeneration.current++; clearTimeout(copyTimer.current) }, [])
  const networkObservation = gameState.discovery.networks.find((network) => network.id === networkId) ?? null
  const deviceObservation = gameState.discovery.devices.find((device) => device.id === deviceId) ?? null
  const deviceNetworks = deviceObservation ? gameState.discovery.networkDeviceRelations
    .filter((relation) => relation.deviceId === deviceObservation.id)
    .map((relation) => gameState.discovery.networks.find((network) => network.id === relation.networkId))
    .filter((network): network is DiscoveredNetworkSnapshot => Boolean(network)) : []

  function beginRequest(target: string) {
    if (pendingTargetRef.current === target) return null
    pendingTargetRef.current = target
    setPendingTarget(target)
    return ++requestGeneration.current
  }
  function finishRequest(target: string, generation: number) {
    if (requestGeneration.current !== generation) return false
    if (pendingTargetRef.current === target) pendingTargetRef.current = null
    setPendingTarget(null)
    return true
  }
  function invalidateRequests() {
    requestGeneration.current++
    pendingTargetRef.current = null
    setPendingTarget(null)
  }
  async function scanNetwork(name: string) {
    const generation = beginRequest(name)
    if (generation === null) return
    try {
      const result = await actions.scanTarget(name)
      finishRequest(name, generation)
    } catch { finishRequest(name, generation) }
  }
  async function scanDevice(address: string) {
    const generation = beginRequest(address)
    if (generation === null) return
    try {
      const result = await actions.scanTarget(address)
      finishRequest(address, generation)
    } catch { finishRequest(address, generation) }
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
    {serviceObservation && deviceObservation ? <ServiceView observation={serviceObservation} deviceAddress={deviceObservation.address} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={gameState.knowledge.discoveredVulnerabilities} copyState={copyState} feedback={feedback} onCopy={copy} onAnalyze={analyze} onBack={() => { setServiceObservation(null); setFeedback(null) }} />
      : deviceObservation ? <DeviceView observation={deviceObservation} network={networkObservation} networks={deviceNetworks} pending={pendingTarget === deviceObservation.address} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={gameState.knowledge.discoveredVulnerabilities} copyState={copyState} onCopy={copy} onScan={() => scanDevice(deviceObservation.address)} onService={(service) => { setServiceObservation({ ...service, targetDeviceId: deviceObservation.id }); setFeedback(null) }} onBack={() => { invalidateRequests(); setDeviceId(null); setFeedback(null) }} />
      : networkObservation ? <NetworkView observation={networkObservation} devices={gameState.discovery.networkDeviceRelations.filter((relation) => relation.networkId === networkObservation.id).map((relation) => relation.deviceId === gameState.player.localDevice.id ? { id: relation.deviceId, address: gameState.player.localDevice.network.ip, scope: 'self' as const } : gameState.discovery.devices.find((device) => device.id === relation.deviceId)).filter((device): device is DiscoveredDeviceSnapshot | { id: string; address: string; scope: 'self' } => Boolean(device))} copyState={copyState} pending={pendingTarget === networkObservation.name} onCopy={copy} onDevice={(id) => setDeviceId(id)} onBack={() => { invalidateRequests(); setNetworkId(null) }} onScan={() => scanNetwork(networkObservation.name)} />
        : <div className="known-space"><header className="scan-atlas-heading"><h1>KNOWN SPACE</h1><p>Known and observed network space</p></header><article className="atlas-row device-object"><span className="atlas-marker atlas-marker-local" /><div className="device-identity"><span className="scan-type">SELF</span><CopyReference value={gameState.player.localDevice.network.ip} copyState={copyState} onCopy={copy} /></div></article><div className="scan-list">{gameState.discovery.networks.map((network) => <button className="atlas-row network-object" type="button" key={network.id} aria-label={`Open known area ${network.name}`} onClick={() => setNetworkId(network.id)}><span className="atlas-marker atlas-marker-local" aria-hidden="true" /><span className="known-space-identity"><strong className="scan-area-label">HOME</strong><span className="atlas-object-name">{network.name}</span><span className="scan-type">LOCAL NETWORK</span></span><span className="atlas-arrow" aria-hidden="true">→</span></button>)}</div></div>}
  </section>
}

function NetworkView({ observation, devices, copyState, pending, onCopy, onDevice, onBack, onScan }: { observation: DiscoveredNetworkSnapshot; devices: readonly (DiscoveredDeviceSnapshot | { id: string; address: string; scope: 'self' })[]; copyState: CopyState; pending: boolean; onCopy(value: string): void; onDevice(id: string): void; onBack(): void; onScan(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← Known Space</button><span>/</span><strong>{observation.name}</strong></nav><div className="scan-detail-title network-focus"><div><span className="scan-type">NETWORK</span><h2>{observation.name}</h2></div><button className="scan-quiet" disabled={pending} onClick={onScan} aria-label={`Scan network ${observation.name}`}>⌁ <span>Scan Network</span></button></div><div className="scan-section-heading"><span>DEVICES</span><span>{observation.membersObserved ? `${devices.length} known devices` : 'Members not observed yet'}</span></div><div className="scan-list">{devices.map((device) => <article className="atlas-row device-object" key={device.id}><span className={`atlas-marker ${device.scope === 'self' ? 'atlas-marker-local' : ''}`} aria-hidden="true" /><div className="device-identity"><span className="scan-type">{device.scope === 'self' ? 'SELF' : `${device.scope.toUpperCase()} DEVICE`}</span><CopyReference value={device.address} copyState={copyState} onCopy={onCopy} /></div>{device.scope !== 'self' && <button className="atlas-open" onClick={() => onDevice(device.id)} aria-label={`Open device ${device.address}`}><span aria-hidden="true">→</span></button>}</article>)}</div></div>
}

function matchingProcesses(processes: readonly ServiceAnalysisProcess[], observation: ServiceObservation) {
  return processes.filter((process) => process.targetDeviceId === observation.targetDeviceId && process.serviceId === observation.id && process.startedEndpoint === observation.endpoint)
}

function DeviceView({ observation, network, networks, pending, processes, knowledge, copyState, onCopy, onScan, onService, onBack }: { observation: DiscoveredDeviceSnapshot; network: DiscoveredNetworkSnapshot | null; networks: readonly DiscoveredNetworkSnapshot[]; pending: boolean; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { targetDeviceId: string; serviceId: string; observedLabel: string }[]; copyState: CopyState; onCopy(value: string): void; onScan(): void; onService(service: DiscoveredServiceSnapshot): void; onBack(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {network?.name ?? 'Devices'}</button><span>/</span><strong>{observation.address}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">{observation.scope.toUpperCase()} DEVICE</span><CopyReference value={observation.address} copyState={copyState} onCopy={onCopy} /></div><button className="scan-quiet" disabled={pending} onClick={onScan} aria-label={`Scan device ${observation.address}`}>⌁ <span>Scan Device</span></button></div><div className="scan-section-heading"><span>NETWORKS</span><span>{networks.length} known</span></div>{networks.map((knownNetwork) => <div className="relationship" key={knownNetwork.id}><span>NETWORK</span><strong>{knownNetwork.name}</strong></div>)}<div className="scan-section-heading"><span>SERVICES</span><span>{observation.servicesObserved ? `${observation.services.length} known services` : 'Services not observed yet'}</span></div><div className="service-list">{observation.services.map((service) => {
    const serviceObservation = { ...service, targetDeviceId: observation.id }
    const related = matchingProcesses(processes, serviceObservation)
    const running = related.find((p) => p.status === 'running')
    const completed = [...related].reverse().find((p) => p.status === 'completed' && p.result)
    const known = knowledge.filter((k) => k.targetDeviceId === observation.id && k.serviceId === service.id)
    const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
    const summary = running ? `ANALYSIS RUNNING · ${progress}%` : known.length > 0 ? 'Weakness known' : completed ? 'Analysis complete' : 'Not analyzed'
    return <button type="button" className="service-row" key={service.id} onClick={() => onService(service)} aria-label={`Open ${service.name} service`}><span className="service-row-main"><strong>{service.name}</strong><span>{service.port} / {service.protocol}</span><span className="open-chip">KNOWN</span></span><span className="service-row-secondary"><span>{summary}</span><span className="service-row-arrow" aria-hidden="true">→</span></span></button>
  })}</div></div>
}

function ServiceView({ observation, deviceAddress, processes, knowledge, copyState, feedback, onCopy, onAnalyze, onBack }: { observation: ServiceObservation; deviceAddress: string; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { targetDeviceId: string; serviceId: string; observedLabel: string }[]; copyState: CopyState; feedback: StartFeedback; onCopy(value: string): void; onAnalyze(endpoint: string, targetDeviceId: string, serviceId: string): void; onBack(): void }) {
  const related = matchingProcesses(processes, observation)
  const running = related.find((process) => process.status === 'running')
  const completed = [...related].reverse().find((process) => process.status === 'completed' && process.result)
  const known = knowledge.filter((item) => item.targetDeviceId === observation.targetDeviceId && item.serviceId === observation.id)
  const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
  const lastResult = completed?.result?.status === 'no_weakness_detected' ? 'No weakness detected' : completed?.result?.status === 'service_unavailable' ? 'Service unavailable during analysis' : completed?.result?.status === 'weaknesses_detected' ? 'Weakness detected' : null
  return <div className="service-detail"><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {deviceAddress}</button><span>/</span><strong>{observation.name}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">SERVICE</span><h2>{observation.name}</h2></div><span className="open-chip">KNOWN</span></div><dl className="service-facts"><div><dt>ENDPOINT</dt><dd><CopyReference value={observation.endpoint} copyState={copyState} onCopy={onCopy} /></dd></div><div><dt>PROTOCOL</dt><dd>{observation.protocol}</dd></div><div><dt>PORT</dt><dd>{observation.port}</dd></div></dl><div className="scan-section-heading"><span>KNOWLEDGE</span></div>{known.length > 0 ? <div className="knowledge-block"><span>KNOWN WEAKNESS</span>{known.map((item, index) => <strong key={index}>{item.observedLabel}</strong>)}</div> : <p className="empty-knowledge">No known weakness recorded</p>}{lastResult && <><div className="scan-section-heading"><span>LAST ANALYSIS</span></div><div className="analysis-result"><strong>{lastResult}</strong></div></>}<div className="scan-section-heading"><span>INTERACTIONS</span></div>{running ? <section className="interaction interaction-active" aria-label="Analyze service running"><div className="interaction-copy"><strong>ANALYSIS RUNNING</strong><span>Investigating this service surface.</span></div><span className="interaction-progress-value">{progress}%</span><progress max="100" value={progress}>{progress}%</progress></section> : <section className="interaction"><button className="interaction-action" aria-label={completed ? 'Analyze again' : 'Analyze'} onClick={() => onAnalyze(observation.endpoint, observation.targetDeviceId, observation.id)}><span className="interaction-copy"><strong>{completed ? 'ANALYZE AGAIN' : 'ANALYZE SERVICE'}</strong><span>Investigate this service surface.</span></span><span className="atlas-arrow" aria-hidden="true">→</span></button>{feedback?.serviceId === observation.id && <p className="scan-feedback" role="status">{feedback.message}</p>}</section>}</div>
}
