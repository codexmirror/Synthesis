import './network.css'
import { useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { DiscoveredServiceMemory, ServiceAnalysisProcess } from '../../core/game/types'

type Focus = { type: 'network'; id: string } | { type: 'device'; id: string; networkId?: string } | { type: 'service'; deviceId: string; serviceId: string; networkId?: string }
type CopyState = { value: string; status: 'copied' | 'failed' } | null

function CopyReference({ value, copyState, onCopy }: { value: string; copyState: CopyState; onCopy(value: string): void }) {
  const status = copyState?.value === value ? copyState.status : null
  return <button type="button" className="scan-copy" onClick={() => onCopy(value)} aria-label={`Copy ${value}`}><span>{value}</span><span className="scan-copy-icon" aria-hidden="true">{status === 'copied' ? '✓' : status === 'failed' ? '!' : '⧉'}</span></button>
}

export function Network() {
  const state = useGameState(); const actions = useGameActions(); const [focus, setFocus] = useState<Focus | null>(null)
  const [pending, setPending] = useState<string | null>(null); const pendingRef = useRef<string | null>(null); const generation = useRef(0)
  const [copyState, setCopyState] = useState<CopyState>(null); const [feedback, setFeedback] = useState<string | null>(null)
  const discovery = state.discovery; const selfId = state.player.localDevice.id
  async function observe(target: string, expected: 'network' | 'device', next: Focus) {
    if (pendingRef.current) return
    const request = ++generation.current; pendingRef.current = target; setPending(target)
    try { const result = await actions.scanTarget(target); if (generation.current === request && result.status === expected) setFocus(next) } catch { /* presentation remains on remembered data */ }
    finally { if (generation.current === request) { pendingRef.current = null; setPending(null) } }
  }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setCopyState({ value, status: 'copied' }) } catch { setCopyState({ value, status: 'failed' }) } }
  const back = (next: Focus | null) => { generation.current++; pendingRef.current = null; setPending(null); setFeedback(null); setFocus(next) }

  if (!focus) {
    const networks = discovery.networks.filter((network) => discovery.networkDeviceRelationships.some((r) => r.networkId === network.id && r.deviceId === selfId))
    return <section className="app-content scan-app" aria-label="Scan workspace"><div className="known-space"><header className="scan-atlas-heading"><h1>KNOWN SPACE</h1><p>Known and observed network space</p></header><article className="atlas-row device-object"><span className="atlas-marker atlas-marker-local"/><div className="device-identity"><span className="scan-type">SELF</span><strong>{state.player.localDevice.network.ip}</strong></div></article>{networks.length === 0 && <p className="empty-knowledge">No known relationships</p>}<div className="scan-list">{networks.map((network) => <button className="atlas-row network-object" key={network.id} aria-label={`Open known area ${network.name}`} onClick={() => setFocus({ type: 'network', id: network.id })}><span className="atlas-marker atlas-marker-local"/><span className="known-space-identity"><strong className="scan-area-label">HOME</strong><span className="atlas-object-name">{network.name}</span><span className="scan-type">LOCAL NETWORK</span></span><span className="atlas-arrow">→</span></button>)}</div></div></section>
  }
  if (focus.type === 'network') {
    const network = discovery.networks.find((item) => item.id === focus.id); if (!network) return null
    const relations = discovery.networkDeviceRelationships.filter((r) => r.networkId === network.id)
    return <section className="app-content scan-app" aria-label="Scan workspace"><nav className="scan-crumbs"><button onClick={() => back(null)}>← Known Space</button><span>/</span><strong>{network.name}</strong></nav><div className="scan-detail-title network-focus"><div><span className="scan-type">NETWORK</span><h2>{network.name}</h2></div><button className="scan-quiet" disabled={pending !== null} onClick={() => observe(network.name, 'network', focus)}>SCAN NETWORK</button></div><div className="scan-section-heading"><span>DEVICES</span><span>{network.hasObservedMembers ? `${relations.length} known` : 'Members not observed yet'}</span></div><div className="scan-list">{relations.map((relation) => {
      const isSelf = relation.deviceId === selfId; const device = discovery.devices.find((item) => item.id === relation.deviceId); if (!isSelf && !device) return null
      const address = isSelf ? state.player.localDevice.network.ip : device!.address
      return <article className="atlas-row device-object" key={relation.deviceId}><span className={`atlas-marker ${isSelf ? 'atlas-marker-local' : ''}`}/><div className="device-identity"><span className="scan-type">{isSelf ? 'SELF' : `${device!.scope.toUpperCase()} DEVICE`}</span><CopyReference value={address} copyState={copyState} onCopy={copy}/></div>{!isSelf && <button className="atlas-open" onClick={() => setFocus({ type: 'device', id: relation.deviceId, networkId: network.id })} aria-label={`Open device ${address}`}>→</button>}</article>
    })}</div></section>
  }
  const focusedDeviceId = focus.type === 'device' ? focus.id : focus.deviceId
  const device = discovery.devices.find((item) => item.id === focusedDeviceId); if (!device) return null
  if (focus.type === 'device') {
    const services = discovery.services.filter((item) => item.deviceId === device.id)
    return <section className="app-content scan-app" aria-label="Scan workspace"><nav className="scan-crumbs"><button onClick={() => back(focus.networkId ? { type: 'network', id: focus.networkId } : null)}>← Devices</button><span>/</span><strong>{device.address}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">{device.scope.toUpperCase()} DEVICE</span><CopyReference value={device.address} copyState={copyState} onCopy={copy}/></div><button className="scan-quiet" disabled={pending !== null} onClick={() => observe(device.address, 'device', focus)}>SCAN DEVICE</button></div><div className="scan-section-heading"><span>SERVICES</span><span>{device.hasObservedServices ? `${services.length} known services` : 'Services not observed yet'}</span></div><div className="service-list">{services.map((service) => <button className="service-row" key={service.serviceId} aria-label={`Open ${service.name} service`} onClick={() => setFocus({ type: 'service', deviceId: device.id, serviceId: service.serviceId, networkId: focus.networkId })}><span className="service-row-main"><strong>{service.name}</strong><span>{service.port} / {service.protocol}</span><span className="open-chip">OPEN</span></span><span className="service-row-arrow">→</span></button>)}</div></section>
  }
  const service = discovery.services.find((item) => item.deviceId === focus.deviceId && item.serviceId === focus.serviceId); if (!service) return null
  return <ServiceView service={service} deviceAddress={device.address} processes={state.process.processes.filter((p): p is ServiceAnalysisProcess => p.kind === 'service_analysis')} knowledge={state.knowledge.discoveredVulnerabilities} feedback={feedback} copyState={copyState} onCopy={copy} onBack={() => back({ type: 'device', id: device.id, networkId: focus.networkId })} onAnalyze={() => { const result = actions.startServiceAnalysisFromObservation({ endpoint: service.observedEndpoint, targetDeviceId: service.deviceId, serviceId: service.serviceId }); setFeedback(result.status === 'started' ? null : result.status.replaceAll('_', ' ').toUpperCase()) }}/>
}

function ServiceView({ service, deviceAddress, processes, knowledge, feedback, copyState, onCopy, onBack, onAnalyze }: { service: DiscoveredServiceMemory; deviceAddress: string; processes: readonly ServiceAnalysisProcess[]; knowledge: readonly { vulnerabilityId: string; targetDeviceId: string; serviceId: string; observedLabel: string }[]; feedback: string | null; copyState: CopyState; onCopy(value: string): void; onBack(): void; onAnalyze(): void }) {
  const related = processes.filter((p) => p.targetDeviceId === service.deviceId && p.serviceId === service.serviceId && p.startedEndpoint === service.observedEndpoint); const running = related.find((p) => p.status === 'running'); const completed = [...related].reverse().find((p) => p.status === 'completed'); const known = knowledge.filter((k) => k.targetDeviceId === service.deviceId && k.serviceId === service.serviceId); const progress = running ? Math.floor(running.workCompleted / running.workRequired * 100) : 0
  return <section className="app-content scan-app service-detail" aria-label="Scan workspace"><nav className="scan-crumbs"><button onClick={onBack}>← {deviceAddress}</button><span>/</span><strong>{service.name}</strong></nav><div className="scan-detail-title"><div><span className="scan-type">SERVICE</span><h2>{service.name}</h2></div><span className="open-chip">OPEN</span></div><dl className="service-facts"><div><dt>ENDPOINT</dt><dd><CopyReference value={service.observedEndpoint} copyState={copyState} onCopy={onCopy}/></dd></div><div><dt>PROTOCOL</dt><dd>{service.protocol}</dd></div><div><dt>PORT</dt><dd>{service.port}</dd></div></dl><div className="scan-section-heading"><span>KNOWLEDGE</span></div>{known.length ? <div className="knowledge-block">{known.map((k) => <strong key={k.vulnerabilityId}>{k.observedLabel}</strong>)}</div> : <p className="empty-knowledge">No known weakness recorded</p>}<div className="scan-section-heading"><span>INTERACTIONS</span></div>{running ? <section className="interaction interaction-active"><strong>ANALYSIS RUNNING</strong><span>{progress}%</span><progress max="100" value={progress}/></section> : <button className="interaction-action" aria-label={completed ? 'Analyze again' : 'Analyze'} onClick={onAnalyze}><strong>{completed ? 'ANALYZE AGAIN' : 'ANALYZE SERVICE'}</strong></button>}{feedback && <p role="status" className="scan-feedback">{feedback}</p>}</section>
}
