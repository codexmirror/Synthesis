import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ServiceAnalysisProcess, CredentialAccessProcess, DiscoveredDeviceSnapshot, DiscoveredNetworkSnapshot, DiscoveredServiceSnapshot } from '../../core/game/types'
import { BASIC_CREDENTIAL_TOOLKIT_ID } from '../../core/game/credentialAccess'

type CopyState = { value: string; status: 'copied' | 'failed' } | null
type StartFeedback = { serviceId: string; message: string } | null
type ConnectionFeedback = 'TARGET NOT AVAILABLE' | 'ANOTHER REMOTE SESSION IS ACTIVE' | 'ACCESS REQUIRED' | null
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
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionFeedback>(null)
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
  function attempt(endpoint: string, targetDeviceId: string, serviceId: string, vulnerabilityId: string) {
    const result = actions.startCredentialAccessAttemptFromObservation({ endpoint, targetDeviceId, serviceId, vulnerabilityId, toolId: BASIC_CREDENTIAL_TOOLKIT_ID })
    if (result.status === 'started') setFeedback(null)
    else if (result.status === 'insufficient_memory') setFeedback({ serviceId, message: `INSUFFICIENT MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available` })
    else setFeedback({ serviceId, message: result.status === 'already_running' ? 'ATTEMPT ALREADY RUNNING' : result.status === 'access_established' ? 'ACCESS ALREADY ESTABLISHED' : result.status === 'endpoint_not_found' ? 'ENDPOINT NOT AVAILABLE' : 'ATTEMPT NOT AVAILABLE' })
  }
  function connect(targetDeviceId: string, address: string) {
    const result = actions.connectRemoteFromObservation({ targetDeviceId, address })
    setConnectionFeedback(result.status === 'target_not_available' ? 'TARGET NOT AVAILABLE'
      : result.status === 'session_active' ? 'ANOTHER REMOTE SESSION IS ACTIVE'
      : result.status === 'access_required' ? 'ACCESS REQUIRED'
      : null)
  }
  function disconnect() {
    actions.disconnectRemoteSession()
    setConnectionFeedback(null)
  }

  return <section className="app-content scan-app" aria-label="NodeScan workspace">
    {serviceObservation && deviceObservation ? <ServiceView observation={serviceObservation} deviceAddress={deviceObservation.address} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} credentialProcesses={gameState.process.processes.filter((p): p is CredentialAccessProcess => p.kind === 'credential_access')} knowledge={gameState.knowledge.discoveredVulnerabilities} ownsToolkit={gameState.player.localDevice.tools.some(({ id }) => id === BASIC_CREDENTIAL_TOOLKIT_ID)} access={gameState.deviceAccess.established.find((item) => item.sourceDeviceId === gameState.player.localDevice.id && item.targetDeviceId === serviceObservation.targetDeviceId && item.viaServiceId === serviceObservation.id)} copyState={copyState} feedback={feedback} onCopy={copy} onAnalyze={analyze} onAttempt={attempt} onBack={() => { setServiceObservation(null); setFeedback(null) }} />
      : deviceObservation ? <DeviceView observation={deviceObservation} network={networkObservation} networks={deviceNetworks} pending={pendingTarget === deviceObservation.address} processes={gameState.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={gameState.knowledge.discoveredVulnerabilities} access={gameState.deviceAccess.established.filter((item) => item.sourceDeviceId === gameState.player.localDevice.id && item.targetDeviceId === deviceObservation.id)} activeAccessId={gameState.remoteSession.active?.accessId} connectionFeedback={connectionFeedback} copyState={copyState} onCopy={copy} onScan={() => scanDevice(deviceObservation.address)} onConnect={() => connect(deviceObservation.id, deviceObservation.address)} onDisconnect={disconnect} onService={(service) => { setServiceObservation({ ...service, targetDeviceId: deviceObservation.id }); setFeedback(null) }} onBack={() => { invalidateRequests(); setDeviceId(null); setFeedback(null); setConnectionFeedback(null) }} />
      : networkObservation ? <NetworkView observation={networkObservation} devices={gameState.discovery.networkDeviceRelations.filter((relation) => relation.networkId === networkObservation.id).map((relation) => relation.deviceId === gameState.player.localDevice.id ? { id: relation.deviceId, address: gameState.player.localDevice.network.ip, scope: 'self' as const } : gameState.discovery.devices.find((device) => device.id === relation.deviceId)).filter((device): device is DiscoveredDeviceSnapshot | { id: string; address: string; scope: 'self' } => Boolean(device))} copyState={copyState} pending={pendingTarget === networkObservation.name} onCopy={copy} onDevice={(id) => setDeviceId(id)} onBack={() => { invalidateRequests(); setNetworkId(null) }} onScan={() => scanNetwork(networkObservation.name)} />
        : <div className="known-space"><header className="scan-atlas-heading"><span className="scan-type">NODESCAN</span><h1>KNOWN SPACE</h1><p>Known and observed network space</p></header><article className="atlas-row device-object"><span className="atlas-marker atlas-marker-local" /><div className="device-identity"><span className="scan-type">SELF</span><CopyReference value={gameState.player.localDevice.network.ip} copyState={copyState} onCopy={copy} /></div></article><div className="scan-list">{gameState.discovery.networks.map((network) => <button className="atlas-row network-object" type="button" key={network.id} aria-label={`Open known area ${network.name}`} onClick={() => setNetworkId(network.id)}><span className="atlas-marker atlas-marker-local" aria-hidden="true" /><span className="known-space-identity"><strong className="scan-area-label">HOME</strong><span className="atlas-object-name">{network.name}</span><span className="scan-type">LOCAL NETWORK</span></span><span className="atlas-arrow" aria-hidden="true">→</span></button>)}</div></div>}
  </section>
}

function NetworkView({ observation, devices, copyState, pending, onCopy, onDevice, onBack, onScan }: { observation: DiscoveredNetworkSnapshot; devices: readonly (DiscoveredDeviceSnapshot | { id: string; address: string; scope: 'self' })[]; copyState: CopyState; pending: boolean; onCopy(value: string): void; onDevice(id: string): void; onBack(): void; onScan(): void }) {
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← Known Space</button><span>/</span><strong>{observation.name}</strong></nav><div className="scan-detail-title network-focus"><div><span className="scan-type">NETWORK</span><h2>{observation.name}</h2></div><button className="scan-quiet" disabled={pending} onClick={onScan} aria-label={`Scan network ${observation.name}`}>⌁ <span>Scan Network</span></button></div><div className="scan-section-heading"><span>DEVICES</span><span>{observation.membersObserved ? `${devices.length} known devices` : 'Members not observed yet'}</span></div><div className="scan-list">{devices.map((device) => <article className="atlas-row device-object" key={device.id}><span className={`atlas-marker ${device.scope === 'self' ? 'atlas-marker-local' : ''}`} aria-hidden="true" /><div className="device-identity"><span className="scan-type">{device.scope === 'self' ? 'SELF' : `${device.scope.toUpperCase()} DEVICE`}</span><CopyReference value={device.address} copyState={copyState} onCopy={onCopy} /></div>{device.scope !== 'self' && <button className="atlas-open" onClick={() => onDevice(device.id)} aria-label={`Open device ${device.address}`}><span aria-hidden="true">→</span></button>}</article>)}</div></div>
}

function matchingProcesses(processes: readonly ServiceAnalysisProcess[], observation: ServiceObservation) {
  return processes.filter((process) => process.targetDeviceId === observation.targetDeviceId && process.serviceId === observation.id && process.startedEndpoint === observation.endpoint)
}

function DeviceView({ observation, network, networks, pending, processes, knowledge, access, activeAccessId, connectionFeedback, copyState, onCopy, onScan, onConnect, onDisconnect, onService, onBack }: { observation: DiscoveredDeviceSnapshot; network: DiscoveredNetworkSnapshot | null; networks: readonly DiscoveredNetworkSnapshot[]; pending: boolean; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { targetDeviceId: string; serviceId: string; observedLabel: string }[]; access: readonly { id: string; viaServiceId: string; privilege: 'USER' }[]; activeAccessId?: string; connectionFeedback: ConnectionFeedback; copyState: CopyState; onCopy(value: string): void; onScan(): void; onConnect(): void; onDisconnect(): void; onService(service: DiscoveredServiceSnapshot): void; onBack(): void }) {
  const activeAccess = access.find(({ id }) => id === activeAccessId)
  return <div><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {network?.name ?? 'Devices'}</button><span>/</span><strong>{observation.address}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">{observation.scope.toUpperCase()} DEVICE</span><CopyReference value={observation.address} copyState={copyState} onCopy={onCopy} /></div></div>{access.length > 0 && <><div className="scan-section-heading"><span>STATE</span></div><section className={`device-state interaction${activeAccess ? ' interaction-active' : ''}`} aria-label={activeAccess ? 'Remote session active' : 'Device access available'}>{activeAccess ? <><div className="interaction-copy"><strong>REMOTE SESSION</strong><span>{activeAccess.privilege} · ACTIVE</span></div><button className="interaction-action" onClick={onDisconnect}><span className="interaction-copy"><strong>DISCONNECT</strong></span><span className="atlas-arrow" aria-hidden="true">→</span></button></> : <button className="interaction-action" onClick={onConnect}><span className="interaction-copy"><strong>{access[0].privilege} ACCESS</strong><span>CONNECT</span></span><span className="atlas-arrow" aria-hidden="true">→</span></button>}</section>{connectionFeedback && <p className="scan-feedback" role="status">{connectionFeedback}</p>}</>}<div className="scan-section-heading"><span>NETWORKS</span><span>{networks.length} known</span></div>{networks.map((knownNetwork) => <div className="relationship" key={knownNetwork.id}><span>NETWORK</span><strong>{knownNetwork.name}</strong></div>)}<div className="scan-section-heading"><span>SERVICES</span><span>{observation.servicesObserved ? `${observation.services.length} known services` : 'Services not observed yet'}</span></div><div className="service-list">{observation.services.map((service) => {
    const serviceObservation = { ...service, targetDeviceId: observation.id }
    const related = matchingProcesses(processes, serviceObservation)
    const running = related.find((p) => p.status === 'running')
    const completed = [...related].reverse().find((p) => p.status === 'completed' && p.result)
    const known = knowledge.filter((k) => k.targetDeviceId === observation.id && k.serviceId === service.id)
    const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
    const established = access.find((item) => item.viaServiceId === service.id)
    const summary = established ? `${established.privilege} ACCESS` : running ? `ANALYSIS RUNNING · ${progress}%` : known.length > 0 ? 'Weakness known' : completed ? 'Analysis complete' : 'Not analyzed'
    return <button type="button" className="service-row" key={service.id} onClick={() => onService(service)} aria-label={`Open ${service.name} service`}><span className="service-row-main"><strong>{service.name}</strong><span>{service.port} / {service.protocol}</span><span className="open-chip">KNOWN</span></span><span className="service-row-secondary"><span>{summary}</span><span className="service-row-arrow" aria-hidden="true">→</span></span></button>
  })}</div><div className="scan-section-heading"><span>ACTIONS</span></div><button className="scan-device-action" disabled={pending} onClick={onScan} aria-label={`Scan device ${observation.address}`}><strong>SCAN DEVICE</strong><span className="atlas-arrow" aria-hidden="true">→</span></button></div>
}

function ServiceView({ observation, deviceAddress, processes, credentialProcesses, knowledge, ownsToolkit, access, copyState, feedback, onCopy, onAnalyze, onAttempt, onBack }: { observation: ServiceObservation; deviceAddress: string; processes: readonly ServiceAnalysisProcess[]; credentialProcesses: readonly CredentialAccessProcess[]; knowledge: readonly { vulnerabilityId: string; targetDeviceId: string; serviceId: string; observedLabel: string }[]; ownsToolkit: boolean; access?: { privilege: 'USER' }; copyState: CopyState; feedback: StartFeedback; onCopy(value: string): void; onAnalyze(endpoint: string, targetDeviceId: string, serviceId: string): void; onAttempt(endpoint: string, targetDeviceId: string, serviceId: string, vulnerabilityId: string): void; onBack(): void }) {
  const related = matchingProcesses(processes, observation)
  const running = related.find((process) => process.status === 'running')
  const completed = [...related].reverse().find((process) => process.status === 'completed' && process.result)
  const known = knowledge.filter((item) => item.targetDeviceId === observation.targetDeviceId && item.serviceId === observation.id)
  const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
  const lastResult = completed?.result?.status === 'no_weakness_detected' ? 'No weakness detected' : completed?.result?.status === 'service_unavailable' ? 'Service unavailable during analysis' : completed?.result?.status === 'weaknesses_detected' ? 'Weakness detected' : null
  const credentialRunning = credentialProcesses.find((process) => process.status === 'running' && process.targetDeviceId === observation.targetDeviceId && process.serviceId === observation.id && process.startedEndpoint === observation.endpoint)
  const credentialProgress = credentialRunning ? Math.floor(credentialRunning.workCompleted / credentialRunning.workRequired * 100) : 0
  return <div className="service-detail"><nav className="scan-crumbs" aria-label="Scan navigation"><button onClick={onBack}>← {deviceAddress}</button><span>/</span><strong>{observation.name}</strong></nav><div className="scan-detail-title"><div><h2>{observation.name}</h2><CopyReference value={observation.endpoint} copyState={copyState} onCopy={onCopy} /></div><span className="open-chip">KNOWN</span></div><div className="scan-section-heading"><span>FACTS</span></div><dl className="service-facts"><div><dt>PROTOCOL</dt><dd>{observation.protocol}</dd></div><div><dt>PORT</dt><dd>{observation.port}</dd></div></dl><div className="scan-section-heading"><span>FINDINGS</span></div>{known.length > 0 ? <div className="knowledge-block">{known.map((item, index) => <strong key={index}>{item.observedLabel}</strong>)}</div> : completed?.result?.status !== 'no_weakness_detected' && <p className="empty-knowledge">No known weakness recorded</p>}{lastResult && (known.length === 0 || completed?.result?.status !== 'weaknesses_detected') && <p className="analysis-note">{lastResult}</p>}{access && <><div className="scan-section-heading"><span>ACCESS PATH</span></div><p className="access-path"><strong>{access.privilege}</strong> · ESTABLISHED VIA THIS SERVICE</p></>}<div className="scan-section-heading"><span>ACTIONS</span></div>{access && <button className="scan-device-action" onClick={onBack}><strong>VIEW DEVICE</strong><span className="atlas-arrow" aria-hidden="true">→</span></button>}{running ? <section className="interaction interaction-active" aria-label="Analyze service running"><div className="interaction-copy"><strong>ANALYSIS RUNNING</strong><span>Investigating this service surface.</span></div><span className="interaction-progress-value">{progress}%</span><progress max="100" value={progress}>{progress}%</progress></section> : <section className="interaction"><button className="interaction-action" aria-label={completed ? 'Analyze again' : 'Analyze'} onClick={() => onAnalyze(observation.endpoint, observation.targetDeviceId, observation.id)}><span className="interaction-copy"><strong>{completed ? 'ANALYZE AGAIN' : 'ANALYZE SERVICE'}</strong><span>Investigate this service surface.</span></span><span className="atlas-arrow" aria-hidden="true">→</span></button></section>}{known.length > 0 && ownsToolkit && !access && (credentialRunning ? <section className="interaction interaction-active" aria-label="Credential access running"><div className="interaction-copy"><strong>CREDENTIAL ACCESS RUNNING</strong><span>Basic Credential Toolkit</span></div><span className="interaction-progress-value">{credentialProgress}%</span><progress max="100" value={credentialProgress}>{credentialProgress}%</progress></section> : <section className="interaction"><button className="interaction-action" aria-label="Start credential access attempt" onClick={() => onAttempt(observation.endpoint, observation.targetDeviceId, observation.id, known[0].vulnerabilityId)}><span className="interaction-copy"><strong>CREDENTIAL ACCESS</strong><span>Basic Credential Toolkit · Outcome unknown</span></span><span className="atlas-arrow" aria-hidden="true">→</span></button></section>)}{!running && feedback?.serviceId === observation.id && <p className="scan-feedback" role="status">{feedback.message}</p>}</div>
}
