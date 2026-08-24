import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { BASIC_CREDENTIAL_TOOLKIT_ID } from '../../core/game/credentialAccess'
import {
  resolveNodeScanRelease,
  selectDeviceWorkspace,
  selectKnownSpace,
  selectNetworkWorkspace,
  selectServiceWorkspace,
  type DeviceWorkspace,
  type KnownSpace,
  type NetworkWorkspace,
  type NodeScanRelease,
  type RunningOperation,
  type ServiceSummary,
  type PlayerInformation,
  type ServiceWorkspace,
} from './nodeScanWorkspace'

/**
 * NodeScan is one investigation workspace over four levels of the same
 * subject: Known Space -> Network -> Device -> Service. Navigation is local
 * presentation state; every rendered fact comes from the view models in
 * `nodeScanWorkspace.ts`, which are derived from remembered Discovery, earned
 * Knowledge, the player's own Processes and the player's current
 * relationships. Browsing never observes.
 */
type Focus =
  | { readonly kind: 'known-space' }
  | { readonly kind: 'network'; readonly networkId: string }
  | { readonly kind: 'device'; readonly deviceId: string; readonly networkId?: string }
  | { readonly kind: 'service'; readonly deviceId: string; readonly serviceId: string; readonly networkId?: string }

type CopyState = { value: string; status: 'copied' | 'failed' } | null
type StartFeedback = { serviceId: string; message: string } | null
type ConnectionFeedback = 'TARGET NOT AVAILABLE' | 'ANOTHER REMOTE SESSION IS ACTIVE' | 'ACCESS REQUIRED' | null
type ObservationFeedback = { target: string; message: string } | null

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

export function Network() {
  const gameState = useGameState()
  const actions = useGameActions()
  const release = resolveNodeScanRelease(gameState.player.localDevice)
  const [focus, setFocus] = useState<Focus>({ kind: 'known-space' })
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [feedback, setFeedback] = useState<StartFeedback>(null)
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionFeedback>(null)
  const [observationFeedback, setObservationFeedback] = useState<ObservationFeedback>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const pendingTargetRef = useRef<string | null>(null)
  const requestGeneration = useRef(0)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { requestGeneration.current++; clearTimeout(copyTimer.current) }, [])

  function beginRequest(target: string) {
    if (pendingTargetRef.current === target) return null
    pendingTargetRef.current = target
    setPendingTarget(target)
    setObservationFeedback(null)
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
    setObservationFeedback(null)
  }
  /** Scan is the observation; reporting its own outcome reveals nothing the player did not just look at. */
  async function scan(target: string) {
    const generation = beginRequest(target)
    if (generation === null) return
    try {
      const result = await actions.scanTarget(target)
      if (!finishRequest(target, generation)) return
      if (result.status === 'no_response') setObservationFeedback({ target, message: 'NO RESPONSE' })
      else if (result.status === 'unknown_target') setObservationFeedback({ target, message: 'UNKNOWN TARGET' })
      else if (result.status === 'software_unavailable') setObservationFeedback({ target, message: 'NODESCAN NOT INSTALLED' })
    } catch { finishRequest(target, generation) }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyState({ value, status: 'copied' }) }
    catch { setCopyState({ value, status: 'failed' }) }
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopyState(null), 1600)
  }
  function analyze(service: ServiceWorkspace) {
    const result = actions.startServiceAnalysisFromObservation({ endpoint: service.endpoint, targetDeviceId: service.deviceId, serviceId: service.id })
    if (result.status === 'started') setFeedback(null)
    else if (result.status === 'insufficient_memory') setFeedback({ serviceId: service.id, message: `INSUFFICIENT MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available` })
    else setFeedback({ serviceId: service.id, message: result.status === 'already_running' ? 'ANALYSIS ALREADY RUNNING' : result.status === 'endpoint_not_found' || result.status === 'invalid_endpoint' ? 'ENDPOINT NOT AVAILABLE' : 'SERVICE UNAVAILABLE' })
  }
  function attempt(service: ServiceWorkspace, vulnerabilityId: string) {
    const result = actions.startCredentialAccessAttemptFromObservation({ endpoint: service.endpoint, targetDeviceId: service.deviceId, serviceId: service.id, vulnerabilityId, toolId: BASIC_CREDENTIAL_TOOLKIT_ID })
    if (result.status === 'started') setFeedback(null)
    else if (result.status === 'insufficient_memory') setFeedback({ serviceId: service.id, message: `INSUFFICIENT MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available` })
    else setFeedback({ serviceId: service.id, message: result.status === 'already_running' ? 'ATTEMPT ALREADY RUNNING' : result.status === 'access_established' ? 'ACCESS ALREADY ESTABLISHED' : result.status === 'endpoint_not_found' ? 'ENDPOINT NOT AVAILABLE' : 'ATTEMPT NOT AVAILABLE' })
  }
  function connect(targetDeviceId: string, address: string) {
    const result = actions.connectRemoteFromObservation({ targetDeviceId, address })
    setConnectionFeedback(result.status === 'target_not_available' ? 'TARGET NOT AVAILABLE'
      : result.status === 'session_active' ? 'ANOTHER REMOTE SESSION IS ACTIVE'
      : result.status === 'access_required' ? 'ACCESS REQUIRED'
      : null)
  }
  function open(next: Focus) {
    invalidateRequests()
    setFeedback(null)
    setConnectionFeedback(null)
    setFocus(next)
  }

  if (!release) return <section className="app-content scan-app" aria-label="NodeScan workspace">
    <div className="ns-view">
      <header className="ns-masthead"><div><span className="ns-eyebrow">NODESCAN</span><h2>NOT INSTALLED</h2></div></header>
      <div className="node-empty"><strong>NO RECONNAISSANCE SOFTWARE</strong><span>This Device carries no installed NodeScan release, so no network space can be observed.</span></div>
    </div>
  </section>

  // Narrowed at the boundary: the workspace is built from player information only.
  const information: PlayerInformation = gameState
  const parentNetworkName = 'networkId' in focus && focus.networkId
    ? selectNetworkWorkspace(information, focus.networkId)?.name
    : undefined

  if (focus.kind === 'service') {
    const service = selectServiceWorkspace(information, focus.deviceId, focus.serviceId)
    if (service) return <section className="app-content scan-app" aria-label="NodeScan workspace">
      <ServiceView
        service={service}
        copyState={copyState}
        feedback={feedback}
        onCopy={copy}
        onAnalyze={() => analyze(service)}
        onAttempt={(vulnerabilityId) => attempt(service, vulnerabilityId)}
        onBack={() => open({ kind: 'device', deviceId: focus.deviceId, ...(focus.networkId ? { networkId: focus.networkId } : {}) })}
      />
    </section>
  }

  if (focus.kind === 'device') {
    const device = selectDeviceWorkspace(information, focus.deviceId)
    if (device) return <section className="app-content scan-app" aria-label="NodeScan workspace">
      <DeviceView
        device={device}
        release={release}
        parentName={parentNetworkName}
        pending={pendingTarget === device.address}
        observationFeedback={observationFeedback?.target === device.address ? observationFeedback.message : null}
        connectionFeedback={connectionFeedback}
        copyState={copyState}
        onCopy={copy}
        onScan={() => scan(device.address)}
        onInspect={() => actions.inspectTarget(device.address)}
        onConnect={() => connect(device.id, device.address)}
        onDisconnect={() => { actions.disconnectRemoteSession(); setConnectionFeedback(null) }}
        onOpenNetwork={(networkId) => open({ kind: 'network', networkId })}
        onOpenService={(serviceId) => open({ kind: 'service', deviceId: device.id, serviceId, ...(focus.networkId ? { networkId: focus.networkId } : {}) })}
        onBack={() => open(focus.networkId ? { kind: 'network', networkId: focus.networkId } : { kind: 'known-space' })}
      />
    </section>
  }

  if (focus.kind === 'network') {
    const network = selectNetworkWorkspace(information, focus.networkId)
    if (network) return <section className="app-content scan-app" aria-label="NodeScan workspace">
      <NetworkView
        network={network}
        release={release}
        pending={pendingTarget === network.name}
        observationFeedback={observationFeedback?.target === network.name ? observationFeedback.message : null}
        onScan={() => scan(network.name)}
        onInspect={() => actions.inspectTarget(network.name)}
        onOpenDevice={(deviceId) => open({ kind: 'device', deviceId, networkId: network.id })}
        onOpenService={(deviceId, serviceId) => open({ kind: 'service', deviceId, serviceId, networkId: network.id })}
        onBack={() => open({ kind: 'known-space' })}
      />
    </section>
  }

  const space = selectKnownSpace(information)
  const networks = space.networks.flatMap(({ id }) => {
    const network = selectNetworkWorkspace(information, id)
    return network ? [network] : []
  })
  return <section className="app-content scan-app" aria-label="NodeScan workspace">
    <KnownSpaceView
      space={space}
      networks={networks}
      release={release}
      pendingTarget={pendingTarget}
      observationFeedback={observationFeedback}
      onScanSelf={() => scan(space.self.address)}
      onScanNetwork={(network) => scan(network.name)}
      onInspectNetwork={(network) => actions.inspectTarget(network.name)}
      onOpenDevice={(deviceId, networkId) => open({ kind: 'device', deviceId, networkId })}
      onOpenService={(deviceId, serviceId, networkId) => open({ kind: 'service', deviceId, serviceId, networkId })}
    />
  </section>
}

function CopyReference({ value, copyState, onCopy }: { value: string; copyState: CopyState; onCopy(value: string): void }) {
  const status = copyState?.value === value ? copyState.status : null
  return <button type="button" className="ns-copy" onClick={() => onCopy(value)} aria-label={`Copy ${value}`}>
    <span>{value}</span>
    <span className="ns-copy-icon" aria-hidden="true">{status === 'copied' ? '✓' : status === 'failed' ? '!' : '⧉'}</span>
    <span className="sr-only" aria-live="polite">{status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : ''}</span>
  </button>
}

function Crumbs({ parent, subject, onBack }: { parent: string; subject: string; onBack(): void }) {
  return <nav className="scan-crumbs" aria-label="Scan navigation">
    <button type="button" onClick={onBack}>← {parent}</button>
    <span aria-hidden="true">/</span>
    <strong>{subject}</strong>
  </nav>
}

function Action({ label, note, ariaLabel, disabled, onClick }: { label: string; note?: string; ariaLabel?: string; disabled?: boolean; onClick(): void }) {
  // The note describes the action; it must not become part of its name.
  return <button type="button" className="ns-action" disabled={disabled} aria-label={ariaLabel ?? label} onClick={onClick}>
    <span className="ns-action-copy"><strong>{label}</strong>{note && <span>{note}</span>}</span>
    <span className="ns-arrow" aria-hidden="true">→</span>
  </button>
}

function Operation({ label, note, percent, ariaLabel }: { label: string; note: string; percent: number; ariaLabel: string }) {
  return <section className="ns-operation" aria-label={ariaLabel}>
    <div className="ns-operation-copy"><strong>{label}</strong><span>{note}</span></div>
    <span className="ns-operation-value">{percent}%</span>
    <progress className="node-progress" max="100" value={percent}>{percent}%</progress>
  </section>
}

type Mark = { readonly tone: 'live' | 'known' | 'access'; readonly text: string }

function Marks({ marks }: { marks: readonly Mark[] }) {
  if (!marks.length) return null
  return <span className="ns-marks">{marks.map((mark) => <span className={`ns-mark ns-mark--${mark.tone}`} key={mark.text}>{mark.text}</span>)}</span>
}

function runningMarks(running: readonly RunningOperation[]): Mark[] {
  return running.map((operation) => ({
    tone: 'live' as const,
    text: `${operation.kind === 'analysis' ? 'ANALYSIS RUNNING' : 'CREDENTIAL ACCESS RUNNING'} · ${operation.percent}%`,
  }))
}

/**
 * Remembered evidence never depends on the currently installed release, so
 * this states only why the matching action is absent. Nothing is said when
 * nothing was observed: a release the player does not have is not their
 * business.
 */
function CapabilityNote({ observed, canInspect }: { observed: boolean; canInspect: boolean }) {
  if (!observed || canInspect) return null
  return <p className="node-note">Remembered from an earlier observation. The installed NodeScan release does not supply Inspect.</p>
}

function KnownSpaceView({ space, networks, release, pendingTarget, observationFeedback, onScanSelf, onScanNetwork, onInspectNetwork, onOpenDevice, onOpenService }: {
  space: KnownSpace
  networks: readonly NetworkWorkspace[]
  release: NodeScanRelease
  pendingTarget: string | null
  observationFeedback: ObservationFeedback
  onScanSelf(): void
  onScanNetwork(network: NetworkWorkspace): void
  onInspectNetwork(network: NetworkWorkspace): void
  onOpenDevice(deviceId: string, networkId: string): void
  onOpenService(deviceId: string, serviceId: string, networkId: string): void
}) {
  const [expandedNetworkId, setExpandedNetworkId] = useState<string | null>(null)
  return <div className="ns-view">
    <header className="ns-masthead">
      <div>
        <span className="ns-eyebrow">{release.name.toUpperCase()}</span>
        <h2>KNOWN SPACE</h2>
        <p>Known and observed network space</p>
      </div>
      <span className="ns-release">{release.version} {release.channel.toUpperCase()}</span>
    </header>

    {networks.length > 0
      ? <section aria-labelledby="ns-known-networks">
        <div className="node-section"><span id="ns-known-networks">NETWORKS</span><span>{networks.length} known</span></div>
        <div className="ns-network-list">{networks.map((network) => <KnownNetworkBranch
          key={network.id}
          network={network}
          release={release}
          expanded={expandedNetworkId === network.id}
          pending={pendingTarget === network.name}
          observationFeedback={observationFeedback?.target === network.name ? observationFeedback.message : null}
          onToggle={() => setExpandedNetworkId(expandedNetworkId === network.id ? null : network.id)}
          onScan={() => onScanNetwork(network)}
          onInspect={() => onInspectNetwork(network)}
          onOpenDevice={(deviceId) => onOpenDevice(deviceId, network.id)}
          onOpenService={(deviceId, serviceId) => onOpenService(deviceId, serviceId, network.id)}
        />)}</div></section>
      : <><div className="node-section"><span>NETWORKS</span></div><div className="node-empty"><strong>NO NETWORKS KNOWN</strong><span>Scan SELF to observe the Networks this Device belongs to.</span></div></>}
    <div className="node-section"><span>ACTIONS</span></div>
    <div className="ns-actions">
      <Action label="SCAN SELF" note="Observe the Networks this Device belongs to." ariaLabel={`Scan self ${space.self.address}`} disabled={pendingTarget === space.self.address} onClick={onScanSelf} />
    </div>
    {observationFeedback?.target === space.self.address && <p className="node-note node-note--caution" role="status">{observationFeedback.message}</p>}
  </div>
}

function KnownNetworkBranch({ network, release, expanded, pending, observationFeedback, onToggle, onScan, onInspect, onOpenDevice, onOpenService }: {
  network: NetworkWorkspace; release: NodeScanRelease; expanded: boolean; pending: boolean; observationFeedback: string | null
  onToggle(): void; onScan(): void; onInspect(): void; onOpenDevice(deviceId: string): void; onOpenService(deviceId: string, serviceId: string): void
}) {
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)
  return <article className={`ns-network-branch${expanded ? ' is-expanded' : ''}`}>
    <button type="button" className="ns-row ns-network-toggle" aria-label={`Open known area ${network.name}`} aria-expanded={expanded} onClick={onToggle}>
      <span className="ns-dot" aria-hidden="true" />
      <span className="ns-row-copy"><span className="ns-eyebrow">NETWORK</span><strong>{network.name}</strong><span className="ns-row-note">{network.membersObserved ? countLabel(network.members.length, 'known device') : 'Members not observed'}</span></span>
      <span className="ns-chevron" aria-hidden="true">⌄</span>
    </button>
    {expanded && <div className="ns-network-contents" role="region" aria-label={`Known members of ${network.name}`}>
      {!network.membersObserved && <div className="node-section"><span>DEVICES</span><span>{countLabel(network.members.length, 'known device')}</span></div>}
      {!network.membersObserved && <p className="ns-quiet-note"><strong>MEMBERSHIP NOT FULLY OBSERVED</strong><br />Scan this Network to observe its responding member Devices.</p>}
      {network.members.length === 0
        ? network.membersObserved && <div className="node-empty"><strong>NO RESPONDING DEVICES</strong><span>The last Scan of this Network observed no responding Devices.</span></div>
        : <div className="ns-tree ns-tree--network">{network.members.map((member) => member.scope === 'self'
          ? <article className="ns-row ns-row--static ns-tree-node" key={member.id}><span className="ns-dot ns-dot--self" aria-hidden="true" /><span className="ns-row-copy"><span className="ns-eyebrow">SELF</span><strong>{member.address}</strong></span></article>
          : <div className={`ns-device-branch${expandedDeviceId === member.id ? ' is-expanded' : ''}`} key={member.id}>
            <div className="ns-row ns-tree-node ns-device-node">
              <button type="button" className="ns-branch-toggle" aria-label={`${expandedDeviceId === member.id ? 'Collapse' : 'Expand'} device ${member.address}`} aria-expanded={expandedDeviceId === member.id} onClick={() => setExpandedDeviceId(expandedDeviceId === member.id ? null : member.id)}><span className="ns-dot" aria-hidden="true" /><span className="ns-row-copy"><span className="ns-eyebrow">{member.scope.toUpperCase()} DEVICE</span><strong>{member.address}</strong><span className="ns-row-note">{member.servicesObserved ? countLabel(member.serviceCount, 'known service') : 'Services not observed'}</span>{member.accessPrivilege && <Marks marks={[{ tone: 'access', text: 'ACCESS ESTABLISHED' }]} />}</span><span className="ns-chevron" aria-hidden="true">⌄</span></button>
              <button type="button" className="ns-detail-link" aria-label={`Open device ${member.address}`} onClick={() => onOpenDevice(member.id)}>DETAIL <span aria-hidden="true">→</span><span className="sr-only">{member.servicesObserved ? countLabel(member.serviceCount, 'known service') : 'Services not observed'}</span></button>
            </div>
            {expandedDeviceId === member.id && <div className="ns-service-branch" role="region" aria-label={`Known services for ${member.address}`}>{!member.servicesObserved ? <p className="ns-tree-empty">Services not observed</p> : member.services.length === 0 ? <p className="ns-tree-empty"><strong>NO OPEN SERVICES</strong></p> : member.services.map((service) => <ServiceRow key={service.id} service={service} onOpen={() => onOpenService(member.id, service.id)} treeChild />)}</div>}
          </div>)}</div>}
      {network.observed && <><div className="node-section"><span>OBSERVED</span></div><dl className="node-facts"><div><dt>SELF CONNECTED</dt><dd>{network.observed.connected ? 'YES' : 'NO'}</dd></div></dl></>}
      <div className="node-section"><span>ACTIONS</span></div><div className="ns-actions"><Action label="SCAN NETWORK" note="Observe responding member Devices." ariaLabel={`Scan network ${network.name}`} disabled={pending} onClick={onScan} />{release.canInspect && <Action label={network.observed ? 'INSPECT AGAIN' : 'INSPECT NETWORK'} note="Observe this Network's own properties." onClick={onInspect} />}</div>
      <CapabilityNote observed={Boolean(network.observed)} canInspect={release.canInspect} />
      {observationFeedback && <p className="node-note node-note--caution" role="status">{observationFeedback}</p>}
    </div>}
  </article>
}

function NetworkView({ network, release, pending, observationFeedback, onScan, onInspect, onOpenDevice, onOpenService, onBack }: {
  network: NetworkWorkspace
  release: NodeScanRelease
  pending: boolean
  observationFeedback: string | null
  onScan(): void
  onInspect(): void
  onOpenDevice(deviceId: string): void
  onOpenService(deviceId: string, serviceId: string): void
  onBack(): void
}) {
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)
  return <div className="ns-view">
    <Crumbs parent="Known Space" subject={network.name} onBack={onBack} />
    <div className="node-section"><span>DEVICES</span><span>{network.members.length > 0 ? countLabel(network.members.length, 'known device') : network.membersObserved ? '0 known devices' : 'Not observed'}</span></div>
    {!network.membersObserved && <p className="ns-quiet-note"><strong>MEMBERSHIP NOT FULLY OBSERVED</strong><br />Scan this Network to observe its responding member Devices.</p>}
    <header className="ns-subject ns-network-parent">
      <span className="ns-dot" aria-hidden="true" />
      <span className="ns-row-copy"><span className="ns-eyebrow">NETWORK</span><h2>{network.name}</h2></span>
    </header>
    {network.members.length === 0
      ? network.membersObserved
        ? <div className="node-empty"><strong>NO RESPONDING DEVICES</strong><span>The last Scan of this Network observed no responding Devices.</span></div>
        : null
      : <div className="ns-tree ns-tree--network">{network.members.map((member) => member.scope === 'self'
          ? <article className="ns-row ns-row--static ns-tree-node" key={member.id}>
            <span className="ns-dot ns-dot--self" aria-hidden="true" />
            <span className="ns-row-copy"><span className="ns-eyebrow">SELF</span><strong>{member.address}</strong></span>
          </article>
          : <div className={`ns-device-branch${expandedDeviceId === member.id ? ' is-expanded' : ''}`} key={member.id}>
            <div className="ns-row ns-tree-node ns-device-node">
              <button type="button" className="ns-branch-toggle" aria-label={`${expandedDeviceId === member.id ? 'Collapse' : 'Expand'} device ${member.address}`} aria-expanded={expandedDeviceId === member.id} onClick={() => setExpandedDeviceId(expandedDeviceId === member.id ? null : member.id)}>
                <span className="ns-dot" aria-hidden="true" />
                <span className="ns-row-copy">
                  <span className="ns-eyebrow">{member.scope.toUpperCase()} DEVICE</span>
                  <strong>{member.address}</strong>
                  <span className="ns-row-note">{member.servicesObserved ? countLabel(member.serviceCount, 'known service') : 'Services not observed'}</span>
                  {member.accessPrivilege && <Marks marks={[{ tone: 'access', text: 'ACCESS ESTABLISHED' }]} />}
                </span>
                <span className="ns-chevron" aria-hidden="true">⌄</span>
              </button>
              <button type="button" className="ns-detail-link" aria-label={`Open device ${member.address}`} onClick={() => onOpenDevice(member.id)}>DETAIL <span aria-hidden="true">→</span><span className="sr-only">{member.servicesObserved ? countLabel(member.serviceCount, 'known service') : 'Services not observed'}</span></button>
            </div>
            {expandedDeviceId === member.id && <div className="ns-service-branch" role="region" aria-label={`Known services for ${member.address}`}>
              {!member.servicesObserved
                ? <p className="ns-tree-empty">Services not observed</p>
                : member.services.length === 0
                  ? <p className="ns-tree-empty"><strong>NO OPEN SERVICES</strong></p>
                  : member.services.map((service) => <ServiceRow key={service.id} service={service} onOpen={() => onOpenService(member.id, service.id)} treeChild />)}
            </div>}
          </div>)}</div>}

    {network.observed && <>
      <div className="node-section"><span>OBSERVED</span></div>
      <dl className="node-facts"><div><dt>SELF CONNECTED</dt><dd>{network.observed.connected ? 'YES' : 'NO'}</dd></div></dl>
    </>}

    <div className="node-section"><span>ACTIONS</span></div>
    <div className="ns-actions">
      <Action label="SCAN NETWORK" note="Observe responding member Devices." ariaLabel={`Scan network ${network.name}`} disabled={pending} onClick={onScan} />
      {release.canInspect && <Action label={network.observed ? 'INSPECT AGAIN' : 'INSPECT NETWORK'} note="Observe this Network's own properties." onClick={onInspect} />}
    </div>
    <CapabilityNote observed={Boolean(network.observed)} canInspect={release.canInspect} />
    {observationFeedback && <p className="node-note node-note--caution" role="status">{observationFeedback}</p>}
  </div>
}

function ServiceRow({ service, onOpen, treeChild = false }: { service: ServiceSummary; onOpen(): void; treeChild?: boolean }) {
  return <button type="button" className={`ns-service${treeChild ? ' ns-service--tree' : ''}`} aria-label={`Open ${service.name} service`} onClick={onOpen}>
    <span className="ns-service-head">
      <strong>{service.name}</strong>
      <span className="ns-arrow" aria-hidden="true">→</span>
    </span>
    <span className="ns-service-endpoint">
      <span>{service.port} / {service.protocol}</span>
      <span>{service.endpoint}</span>
    </span>
    {service.observed && <span className="ns-service-observed">
      <span>{service.observed.implementation}</span>
      {service.observed.authentication && <span>Authentication: {service.observed.authentication}</span>}
    </span>}
    <Marks marks={[
      ...runningMarks(service.running),
      ...(service.accessPrivilege ? [{ tone: 'access' as const, text: `${service.accessPrivilege} ACCESS` }] : []),
      ...service.knowledge.map((weakness) => ({ tone: 'known' as const, text: `KNOWN WEAKNESS · ${weakness.id}` })),
    ]} />
  </button>
}

function DeviceView({ device, release, parentName, pending, observationFeedback, connectionFeedback, copyState, onCopy, onScan, onInspect, onConnect, onDisconnect, onOpenNetwork, onOpenService, onBack }: {
  device: DeviceWorkspace
  release: NodeScanRelease
  parentName?: string
  pending: boolean
  observationFeedback: string | null
  connectionFeedback: ConnectionFeedback
  copyState: CopyState
  onCopy(value: string): void
  onScan(): void
  onInspect(): void
  onConnect(): void
  onDisconnect(): void
  onOpenNetwork(networkId: string): void
  onOpenService(serviceId: string): void
  onBack(): void
}) {
  return <div className="ns-view">
    <Crumbs parent={parentName ?? 'Known Space'} subject={device.address} onBack={onBack} />
    <header className="ns-subject">
      <span className="ns-eyebrow">{device.scope.toUpperCase()} DEVICE</span>
      <CopyReference value={device.address} copyState={copyState} onCopy={onCopy} />
    </header>

    <div className="node-section"><span>OBSERVED</span></div>
    {device.observed
      ? <dl className="node-facts">
        <div><dt>TYPE</dt><dd>{device.observed.deviceKind.toUpperCase()}</dd></div>
        <div><dt>STATUS</dt><dd>{device.observed.networkStatus}</dd></div>
        {device.observed.firmware && <div><dt>FIRMWARE</dt><dd>{device.observed.firmware}</dd></div>}
        {device.observed.computeClass && <div><dt>COMPUTE</dt><dd>{device.observed.computeClass}</dd></div>}
      </dl>
      : <div className="node-empty"><strong>NOT OBSERVED</strong><span>No properties of this Device have been observed.</span></div>}
    <CapabilityNote observed={Boolean(device.observed)} canInspect={release.canInspect} />

    <div className="node-section"><span>NETWORKS</span><span>{device.networks.length} known</span></div>
    {device.networks.length > 0
      ? <div className="ns-list">{device.networks.map((network) => <button
        type="button"
        className="ns-row ns-row--relation"
        key={network.id}
        aria-label={`Open known area ${network.name}`}
        onClick={() => onOpenNetwork(network.id)}
      >
        <span className="ns-row-copy"><span className="ns-eyebrow">NETWORK</span><strong>{network.name}</strong></span>
        <span className="ns-arrow" aria-hidden="true">→</span>
      </button>)}</div>
      : <div className="node-empty"><strong>NO KNOWN NETWORKS</strong><span>No Network is known to contain this Device.</span></div>}

    <div className="node-section"><span>SERVICES</span><span>{device.servicesObserved ? countLabel(device.services.length, 'known service') : 'Not observed'}</span></div>
    {!device.servicesObserved
      ? <div className="node-empty"><strong>SERVICES NOT OBSERVED</strong><span>Scan this Device to observe its currently open Services.</span></div>
      : device.services.length === 0
        ? <div className="node-empty"><strong>NO OPEN SERVICES</strong><span>The last Scan of this Device observed no open Services.</span></div>
        : <div className="ns-list">{device.services.map((service) => <ServiceRow key={service.id} service={service} onOpen={() => onOpenService(service.id)} />)}</div>}

    {(device.session || device.access) && <>
      <div className="node-section"><span>ACCESS</span></div>
      {device.session
        ? <section className="ns-state ns-state--live" aria-label="Remote session active">
          <div className="ns-state-copy">
            <strong>REMOTE SESSION</strong>
            <span>ACTIVE · {device.session.connectedAddress}</span>
            <small>{device.session.privilege} ACCESS{device.session.viaServiceName ? ` · VIA ${device.session.viaServiceName}` : ''}</small>
          </div>
          <button type="button" className="ns-state-action" onClick={onDisconnect}>DISCONNECT</button>
        </section>
        : device.access && <section className="ns-state" aria-label="Device access available">
          <div className="ns-state-copy">
            <strong>{device.access.privilege} ACCESS</strong>
            <span>{device.access.viaServiceName ? `ESTABLISHED VIA ${device.access.viaServiceName}` : 'ESTABLISHED'}</span>
          </div>
          <button type="button" className="ns-state-action" onClick={onConnect}>CONNECT</button>
        </section>}
      {connectionFeedback && <p className="node-note node-note--caution" role="status">{connectionFeedback}</p>}
    </>}

    <div className="node-section"><span>ACTIONS</span></div>
    <div className="ns-actions">
      <Action label="SCAN DEVICE" note="Observe currently open Services." ariaLabel={`Scan device ${device.address}`} disabled={pending} onClick={onScan} />
      {release.canInspect && <Action label={device.observed ? 'INSPECT AGAIN' : 'INSPECT DEVICE'} note="Observe this Device's own properties." onClick={onInspect} />}
    </div>
    {observationFeedback && <p className="node-note node-note--caution" role="status">{observationFeedback}</p>}
  </div>
}

function ServiceView({ service, copyState, feedback, onCopy, onAnalyze, onAttempt, onBack }: {
  service: ServiceWorkspace
  copyState: CopyState
  feedback: StartFeedback
  onCopy(value: string): void
  onAnalyze(): void
  onAttempt(vulnerabilityId: string): void
  onBack(): void
}) {
  const outcomeNote = service.analysisOutcome === 'no_weakness_detected' ? 'No weakness detected'
    : service.analysisOutcome === 'service_unavailable' ? 'Service unavailable during analysis'
      : service.analysisOutcome === 'weaknesses_detected' ? 'Weakness detected'
        : null
  // Retained Process history is disposable, so it is shown only where it adds
  // something the durable Knowledge above does not already state.
  const showOutcome = outcomeNote && (service.knowledge.length === 0 || service.analysisOutcome !== 'weaknesses_detected')

  return <div className="ns-view ns-service-detail">
    <Crumbs parent={service.deviceAddress} subject={service.name} onBack={onBack} />
    <header className="ns-subject">
      <span className="ns-eyebrow">SERVICE</span>
      <h2>{service.name}</h2>
      <CopyReference value={service.endpoint} copyState={copyState} onCopy={onCopy} />
    </header>

    <div className="node-section"><span>ENDPOINT</span></div>
    <dl className="node-facts">
      <div><dt>ADDRESS</dt><dd>{service.deviceAddress}</dd></div>
      <div><dt>PORT</dt><dd>{service.port}</dd></div>
      <div><dt>PROTOCOL</dt><dd>{service.protocol}</dd></div>
    </dl>

    <div className="node-section"><span>OBSERVED</span></div>
    {service.observed
      ? <dl className="node-facts">
        <div><dt>IMPLEMENTATION</dt><dd>{service.observed.implementation}</dd></div>
        {service.observed.authentication && <div><dt>AUTHENTICATION</dt><dd>{service.observed.authentication}</dd></div>}
      </dl>
      : <div className="node-empty"><strong>NOT OBSERVED</strong><span>No implementation fingerprint has been observed for this Service.</span></div>}

    <div className="node-section"><span>KNOWLEDGE</span></div>
    {service.knowledge.length > 0
      ? <ul className="ns-knowledge">{service.knowledge.map((weakness) => <li key={weakness.id}><strong>{weakness.id}</strong><span>{weakness.label}</span></li>)}</ul>
      : service.analysisOutcome !== 'no_weakness_detected' && <p className="ns-quiet-note">No known weakness recorded</p>}
    {showOutcome && <p className="node-note">{outcomeNote}</p>}

    {service.access && <>
      <div className="node-section"><span>ACCESS PATH</span></div>
      <p className="ns-access-path"><strong>{service.access.privilege}</strong> · ESTABLISHED VIA THIS SERVICE</p>
    </>}

    <div className="node-section"><span>ACTIONS</span></div>
    <div className="ns-actions">
      {service.access && <Action label="VIEW DEVICE" onClick={onBack} />}
      {service.analysisRunning
        ? <Operation label="ANALYSIS RUNNING" note="Investigating this Service surface." percent={service.analysisRunning.percent} ariaLabel="Analyze service running" />
        : <Action
          label={service.analysisOutcome ? 'ANALYZE AGAIN' : 'ANALYZE SERVICE'}
          note="Investigate this Service surface."
          ariaLabel={service.analysisOutcome ? 'Analyze again' : 'Analyze'}
          onClick={onAnalyze}
        />}
      {service.attempt && !service.access && (service.credentialRunning
        ? <Operation label="CREDENTIAL ACCESS RUNNING" note={service.attempt.toolName} percent={service.credentialRunning.percent} ariaLabel="Credential access running" />
        : <Action
          label="CREDENTIAL ACCESS"
          note={`${service.attempt.toolName} · Outcome unknown`}
          ariaLabel="Start credential access attempt"
          onClick={() => onAttempt(service.attempt!.vulnerabilityId)}
        />)}
    </div>
    {!service.credentialRunning && !service.access && service.credentialFailed && <p className="node-note">Authentication attempt failed.</p>}
    {!service.analysisRunning && feedback?.serviceId === service.id && <p className="node-note node-note--caution" role="status">{feedback.message}</p>}
  </div>
}
