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
  type NetworkMember,
  type NetworkWorkspace,
  type NodeScanRelease,
  type RunningOperation,
  type ServiceSummary,
  type PlayerInformation,
  type ServiceWorkspace,
  type StandaloneDeviceSummary,
} from './nodeScanWorkspace'

/**
 * NodeScan is one investigation workspace over four levels of the same
 * subject: Known Space -> Network -> Device -> Service. Navigation is local
 * presentation state; every rendered fact comes from the view models in
 * `nodeScanWorkspace.ts`, which are derived from remembered Discovery, earned
 * Knowledge, the player's own Processes and the player's current
 * relationships. Browsing never observes.
 *
 * Known Space is the primary workspace: Networks are independent top-level
 * relationship branches whose members, and those members' remembered
 * Services, expand in place. The Device and Service detail views remain the
 * deeper dive, never the route the normal loop has to take.
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

/** A Device branch is only offered where expanding it reveals remembered children. */
function hasServiceChildren(member: NetworkMember): boolean {
  return member.servicesObserved && member.services.length > 0
}

/** The one line that states what is known about a Device's Services. */
function serviceNote(member: { servicesObserved: boolean; serviceCount: number }): string {
  if (!member.servicesObserved) return 'Services not observed'
  if (member.serviceCount === 0) return 'No open services'
  return countLabel(member.serviceCount, 'known service')
}

export function Network() {
  const gameState = useGameState()
  const actions = useGameActions()
  const release = resolveNodeScanRelease(gameState.player.localDevice)
  const [focus, setFocus] = useState<Focus>({ kind: 'known-space' })
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [feedback, setFeedback] = useState<StartFeedback>(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionFeedback>(null)
  const [observationFeedback, setObservationFeedback] = useState<ObservationFeedback>(null)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  // Expansion is presentation state for the whole workspace, so the tree keeps
  // its shape when the player dips into a detail view and comes back.
  const [expandedNetworkIds, setExpandedNetworkIds] = useState<readonly string[]>([])
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null)
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
  function submitPackage(service: ServiceWorkspace) {
    const result = actions.submitRackUpdatePackageFromObservation({ targetDeviceId: service.deviceId, serviceId: service.id, endpoint: service.endpoint, localFileId: selectedPackageId })
    setFeedback({ serviceId: service.id, message: result.status === 'applied' ? 'PACKAGE APPLIED' : result.status.replaceAll('_', ' ').toUpperCase() })
  }
  function connect(targetDeviceId: string, address: string) {
    const result = actions.connectRemoteFromObservation({ targetDeviceId, address })
    setConnectionFeedback(result.status === 'target_not_available' ? 'TARGET NOT AVAILABLE'
      : result.status === 'session_active' ? 'ANOTHER REMOTE SESSION IS ACTIVE'
      : result.status === 'access_required' ? 'ACCESS REQUIRED'
      : null)
  }
  function toggleNetwork(networkId: string) {
    setExpandedNetworkIds(expandedNetworkIds.includes(networkId)
      ? expandedNetworkIds.filter((id) => id !== networkId)
      : [...expandedNetworkIds, networkId])
  }
  function toggleDevice(deviceId: string) {
    setExpandedDeviceId(expandedDeviceId === deviceId ? null : deviceId)
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
        selectedPackageId={selectedPackageId}
        onSelectPackage={setSelectedPackageId}
        onSubmitPackage={() => submitPackage(service)}
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
        feedback={feedback}
        selectedPackageId={selectedPackageId}
        onCopy={copy}
        onScan={() => scan(device.address)}
        onInspect={() => actions.inspectTarget(device.address)}
        onConnect={() => connect(device.id, device.address)}
        onDisconnect={() => { actions.disconnectRemoteSession(); setConnectionFeedback(null) }}
        onAnalyze={analyze}
        onAttempt={attempt}
        onSelectPackage={setSelectedPackageId}
        onSubmitPackage={submitPackage}
        onOpenNetwork={(networkId) => open({ kind: 'network', networkId })}
        onOpenService={(serviceId) => open({ kind: 'service', deviceId: device.id, serviceId, ...(focus.networkId ? { networkId: focus.networkId } : {}) })}
        onBack={() => open(focus.networkId ? { kind: 'network', networkId: focus.networkId } : { kind: 'known-space' })}
      />
    </section>
  }

  if (focus.kind === 'network') {
    const network = selectNetworkWorkspace(information, focus.networkId)
    if (network) return <section className="app-content scan-app" aria-label="NodeScan workspace">
      <div className="ns-view">
        <Crumbs parent="Known Space" subject={network.name} onBack={() => open({ kind: 'known-space' })} />
        <div className="ns-network-list ns-network-list--pinned">
          <NetworkBranch
            network={network}
            release={release}
            pinned
            expanded
            expandedDeviceId={expandedDeviceId}
            pendingTarget={pendingTarget}
            observationFeedback={observationFeedback}
            onToggle={() => {}}
            onToggleDevice={toggleDevice}
            onScanNetwork={() => scan(network.name)}
            onInspectNetwork={() => actions.inspectTarget(network.name)}
            onScanDevice={(address) => scan(address)}
            onOpenDevice={(deviceId) => open({ kind: 'device', deviceId, networkId: network.id })}
            onOpenService={(deviceId, serviceId) => open({ kind: 'service', deviceId, serviceId, networkId: network.id })}
          />
        </div>
      </div>
    </section>
  }

  const space = selectKnownSpace(information)
  const networks = space.networks.flatMap(({ id }) => {
    const network = selectNetworkWorkspace(information, id)
    return network ? [network] : []
  })
  return <section className="app-content scan-app" aria-label="NodeScan workspace">
    <KnownSpaceView
      selfAddress={space.self.address}
      networks={networks}
      standaloneDevices={space.standaloneDevices}
      release={release}
      expandedNetworkIds={expandedNetworkIds}
      expandedDeviceId={expandedDeviceId}
      onToggleNetwork={toggleNetwork}
      onToggleDevice={toggleDevice}
      pendingTarget={pendingTarget}
      observationFeedback={observationFeedback}
      onScanSelf={() => scan(space.self.address)}
      onScanNetwork={(network) => scan(network.name)}
      onInspectNetwork={(network) => actions.inspectTarget(network.name)}
      onScanDevice={(address) => scan(address)}
      onOpenDevice={(deviceId, networkId) => open({ kind: 'device', deviceId, ...(networkId ? { networkId } : {}) })}
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

/** Compact branch-local control: an operation that belongs to the object it sits under. */
function BranchAction({ label, ariaLabel, disabled, onClick }: { label: string; ariaLabel?: string; disabled?: boolean; onClick(): void }) {
  return <button type="button" className="ns-branch-action" disabled={disabled} aria-label={ariaLabel ?? label} onClick={onClick}>{label}</button>
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

function KnownSpaceView({ selfAddress, networks, standaloneDevices, release, expandedNetworkIds, expandedDeviceId, onToggleNetwork, onToggleDevice, pendingTarget, observationFeedback, onScanSelf, onScanNetwork, onInspectNetwork, onScanDevice, onOpenDevice, onOpenService }: {
  selfAddress: string
  networks: readonly NetworkWorkspace[]
  standaloneDevices: readonly StandaloneDeviceSummary[]
  release: NodeScanRelease
  expandedNetworkIds: readonly string[]
  expandedDeviceId: string | null
  onToggleNetwork(networkId: string): void
  onToggleDevice(deviceId: string): void
  pendingTarget: string | null
  observationFeedback: ObservationFeedback
  onScanSelf(): void
  onScanNetwork(network: NetworkWorkspace): void
  onInspectNetwork(network: NetworkWorkspace): void
  onScanDevice(address: string): void
  onOpenDevice(deviceId: string, networkId: string): void
  onOpenService(deviceId: string, serviceId: string, networkId: string): void
}) {
  const selfFeedback = observationFeedback?.target === selfAddress ? observationFeedback.message : null
  return <div className="ns-view">
    <header className="ns-masthead">
      <div>
        <span className="ns-eyebrow">{release.name.toUpperCase()}</span>
        <h2>KNOWN SPACE</h2>
        <p>Known and observed network space</p>
      </div>
      <span className="ns-release">{release.version}{release.channel ? ` ${release.channel.toUpperCase()}` : ''}</span>
    </header>

    <div className="node-section"><span id="ns-known-networks">NETWORKS</span>{networks.length > 0 && <span>{networks.length} known</span>}</div>

    {networks.length > 0
      ? <section aria-labelledby="ns-known-networks">
        <div className="ns-network-list">{networks.map((network) => <NetworkBranch
          key={network.id}
          network={network}
          release={release}
          expanded={expandedNetworkIds.includes(network.id)}
          expandedDeviceId={expandedDeviceId}
          pendingTarget={pendingTarget}
          observationFeedback={observationFeedback}
          onToggle={() => onToggleNetwork(network.id)}
          onToggleDevice={onToggleDevice}
          onScanNetwork={() => onScanNetwork(network)}
          onInspectNetwork={() => onInspectNetwork(network)}
          onScanDevice={onScanDevice}
          onOpenDevice={(deviceId) => onOpenDevice(deviceId, network.id)}
          onOpenService={(deviceId, serviceId) => onOpenService(deviceId, serviceId, network.id)}
        />)}</div>
      </section>
      : <>
        <div className="node-empty"><strong>NO NETWORKS KNOWN</strong><span>Scan SELF to discover the Networks this Device belongs to.</span></div>
        {/* Nothing is known yet, so the one bootstrap observation is the one control. */}
        <div className="ns-bootstrap">
          <button type="button" className="ns-primary" aria-label={`Scan self ${selfAddress}`} disabled={pendingTarget === selfAddress} onClick={onScanSelf}>SCAN SELF</button>
        </div>
        {selfFeedback && <p className="node-note node-note--caution" role="status">{selfFeedback}</p>}
      </>}

    {standaloneDevices.length > 0 && <>
      <div className="node-section"><span id="ns-remote-devices">REMOTE DEVICES</span><span>{standaloneDevices.length} known</span></div>
      <section className="ns-standalone-list" aria-labelledby="ns-remote-devices">
        {standaloneDevices.map((device) => <button
          type="button"
          className="ns-node ns-node--device ns-node--standalone"
          aria-label={`Open device ${device.address}`}
          key={device.id}
          onClick={() => onOpenDevice(device.id, '')}
        >
          <span className="ns-glyph" aria-hidden="true" />
          <span className="ns-node-copy">
            <span className="ns-eyebrow">{device.scope.toUpperCase()} DEVICE</span>
            <strong>{device.address}</strong>
            <span className="ns-row-note">{serviceNote(device)}</span>
          </span>
          <span className="ns-arrow" aria-hidden="true">→</span>
        </button>)}
      </section>
    </>}
  </div>
}

/**
 * One top-level relationship branch. `pinned` is the same branch presented as
 * the subject of its own view: always open, and identified by a heading rather
 * than by a collapse control.
 */
function NetworkBranch({ network, release, expanded, pinned = false, expandedDeviceId, pendingTarget, observationFeedback, onToggle, onToggleDevice, onScanNetwork, onInspectNetwork, onScanDevice, onOpenDevice, onOpenService }: {
  network: NetworkWorkspace
  release: NodeScanRelease
  expanded: boolean
  pinned?: boolean
  expandedDeviceId: string | null
  pendingTarget: string | null
  observationFeedback: ObservationFeedback
  onToggle(): void
  onToggleDevice(deviceId: string): void
  onScanNetwork(): void
  onInspectNetwork(): void
  onScanDevice(address: string): void
  onOpenDevice(deviceId: string): void
  onOpenService(deviceId: string, serviceId: string): void
}) {
  const memberNote = network.membersObserved ? countLabel(network.members.length, 'known device') : 'Members not observed'
  const identity = <span className="ns-node-copy">
    <span className="ns-eyebrow">NETWORK</span>
    <strong>{network.name}</strong>
    <span className="ns-row-note">{memberNote}</span>
  </span>
  const networkFeedback = observationFeedback?.target === network.name ? observationFeedback.message : null

  // A trunk is only drawn where the branch actually carries members, so an
  // empty or unobserved Network terminates cleanly instead of dangling.
  const populated = network.members.length > 0
  return <article className={`ns-network-branch${expanded ? ' is-expanded' : ''}${populated ? ' is-populated' : ''}`}>
    {pinned
      ? <header className="ns-node ns-node--network ns-node--pinned">
        <span className="ns-glyph ns-glyph--network" aria-hidden="true" />
        {identity}
      </header>
      : <button type="button" className="ns-node ns-node--network" aria-label={`Open known area ${network.name}`} aria-expanded={expanded} onClick={onToggle}>
        <span className="ns-twist" aria-hidden="true">▸</span>
        {identity}
      </button>}

    {expanded && <div className="ns-branch" role="region" aria-label={`Known members of ${network.name}`}>
      {/* Evidence and state that belong to the Network itself, above its members. */}
      <div className="ns-branch-lead">
        {network.observed && <dl className="ns-branch-facts"><div><dt>SELF CONNECTED</dt><dd>{network.observed.connected ? 'YES' : 'NO'}</dd></div></dl>}
        {!network.membersObserved && <p className="ns-branch-note"><strong>MEMBERSHIP NOT FULLY OBSERVED</strong><span>Scan this Network to observe its responding member Devices.</span></p>}
        {!network.membersObserved && populated && <p className="ns-branch-count">{countLabel(network.members.length, 'known device')}</p>}
        {network.membersObserved && !populated && <p className="ns-branch-note"><strong>NO RESPONDING DEVICES</strong><span>The last Scan of this Network observed no responding Devices.</span></p>}
      </div>

      {populated && <div className="ns-limbs">
        {network.members.map((member) => <div className="ns-limb" key={member.id}>
          {member.scope === 'self'
            ? <div className="ns-node ns-node--device ns-node--static">
              <span className="ns-glyph ns-glyph--self" aria-hidden="true" />
              <span className="ns-node-copy"><span className="ns-eyebrow">SELF</span><strong>{member.address}</strong></span>
            </div>
            : <DeviceNode
              member={member}
              expanded={expandedDeviceId === member.id}
              pending={pendingTarget === member.address}
              onToggle={() => onToggleDevice(member.id)}
              onScan={() => onScanDevice(member.address)}
              onOpen={() => onOpenDevice(member.id)}
            />}
          {member.scope !== 'self' && expandedDeviceId === member.id && hasServiceChildren(member) && <div className="ns-limbs ns-limbs--service" role="region" aria-label={`Known services for ${member.address}`}>
            {member.services.map((service) => <div className="ns-limb ns-limb--service" key={service.id}>
              <ServiceNode service={service} onOpen={() => onOpenService(member.id, service.id)} />
            </div>)}
          </div>}
          {member.scope !== 'self' && observationFeedback?.target === member.address && <p className="ns-limb-feedback node-note node-note--caution" role="status">{observationFeedback.message}</p>}
        </div>)}
      </div>}

      <div className="ns-branch-actions">
        <BranchAction label="SCAN NETWORK" ariaLabel={`Scan network ${network.name}`} disabled={pendingTarget === network.name} onClick={onScanNetwork} />
        {release.canInspect && <BranchAction label={network.observed ? 'INSPECT AGAIN' : 'INSPECT NETWORK'} onClick={onInspectNetwork} />}
      </div>
      <CapabilityNote observed={Boolean(network.observed)} canInspect={release.canInspect} />
      {networkFeedback && <p className="node-note node-note--caution" role="status">{networkFeedback}</p>}
    </div>}
  </article>
}

/**
 * A Device inside its Network. It offers exactly one primary affordance: the
 * branch toggle where remembered Services exist to reveal, and otherwise the
 * Scan that would produce them. DETAIL is the constant secondary route.
 */
function DeviceNode({ member, expanded, pending, onToggle, onScan, onOpen }: {
  member: NetworkMember
  expanded: boolean
  pending: boolean
  onToggle(): void
  onScan(): void
  onOpen(): void
}) {
  const expandable = hasServiceChildren(member)
  const note = serviceNote(member)
  const scope = `${member.scope.toUpperCase()} DEVICE`
  const copy = <span className="ns-node-copy">
    <span className="ns-eyebrow">{scope}</span>
    <strong>{member.address}</strong>
    <span className="ns-row-note">{note}</span>
  </span>

  return <div className={`ns-node ns-node--device${expandable ? '' : ' ns-node--leaf'}${expanded ? ' is-expanded' : ''}`}>
    {expandable
      ? <button type="button" className="ns-node-main" aria-label={`${expanded ? 'Collapse' : 'Expand'} device ${member.address}`} aria-expanded={expanded} onClick={onToggle}>
        <span className="ns-twist" aria-hidden="true">▸</span>
        {copy}
      </button>
      : <div className="ns-node-main ns-node-main--static">
        <span className="ns-glyph" aria-hidden="true" />
        {copy}
      </div>}
    <span className="ns-node-controls">
      {!member.servicesObserved && <button type="button" className="ns-node-scan" aria-label={`Scan device ${member.address}`} disabled={pending} onClick={onScan}>SCAN</button>}
      <button type="button" className="ns-node-detail" aria-label={`Open device ${member.address}`} onClick={onOpen}>
        DETAIL <span aria-hidden="true">›</span><span className="sr-only"> · {note}</span>
      </button>
    </span>
  </div>
}

function ServiceNode({ service, onOpen }: { service: ServiceSummary; onOpen(): void }) {
  const access = service.accessPrivilege ? ` · ${service.accessPrivilege} ACCESS ESTABLISHED` : ''
  return <button type="button" className="ns-node ns-node--service" aria-label={`Open ${service.name} service${access}`} onClick={onOpen}>
    <span className={`ns-glyph${service.accessPrivilege ? ' ns-glyph--access' : ''}`} aria-hidden="true" />
    <span className="ns-node-copy">
      <span className="ns-service-head"><strong>{service.name}</strong></span>
      <span className="ns-service-endpoint">
        <span>{service.port} / {service.protocol}</span>
      </span>
    </span>
    <span className="ns-arrow" aria-hidden="true">→</span>
  </button>
}

/** The Service list on a Device detail view: the same children, without the tree geometry. */
function ServiceRow({ service, onOpen }: { service: ServiceSummary; onOpen(): void }) {
  return <button type="button" className="ns-service" aria-label={`Open ${service.name} service`} onClick={onOpen}>
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

function DeviceView({ device, release, parentName, pending, observationFeedback, connectionFeedback, copyState, feedback, selectedPackageId, onCopy, onScan, onInspect, onConnect, onDisconnect, onAnalyze, onAttempt, onSelectPackage, onSubmitPackage, onOpenNetwork, onOpenService, onBack }: {
  device: DeviceWorkspace
  release: NodeScanRelease
  parentName?: string
  pending: boolean
  observationFeedback: string | null
  connectionFeedback: ConnectionFeedback
  copyState: CopyState
  feedback: StartFeedback
  selectedPackageId: string
  onCopy(value: string): void
  onScan(): void
  onInspect(): void
  onConnect(): void
  onDisconnect(): void
  onAnalyze(service: ServiceWorkspace): void
  onAttempt(service: ServiceWorkspace, vulnerabilityId: string): void
  onSelectPackage(fileId: string): void
  onSubmitPackage(service: ServiceWorkspace): void
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

    <div className="node-section"><span>TARGET</span><span><span>OBSERVED</span> · Remembered state</span></div>
    {device.observed
      ? <dl className="node-facts">
        <div><dt>TYPE</dt><dd>{device.observed.deviceKind.toUpperCase()}</dd></div>
        <div><dt>STATUS</dt><dd>{device.observed.networkStatus}</dd></div>
        {device.observed.firmware && <div><dt>FIRMWARE</dt><dd>{device.observed.firmware}</dd></div>}
        {device.observed.computeClass && <div><dt>COMPUTE</dt><dd>{device.observed.computeClass}</dd></div>}
      </dl>
      : <div className="node-empty"><strong>NOT OBSERVED</strong><span>No properties of this Device have been observed.</span></div>}
    <CapabilityNote observed={Boolean(device.observed)} canInspect={release.canInspect} />

    <div className="node-section"><span>ACCESS</span></div>
    {(device.session || device.access) ? <>
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
    </> : <p className="ns-access-none"><strong>NO ACCESS</strong><span>No authority relationship established.</span></p>}

    {device.investigations.some((service) => service.knowledge.length > 0) && <>
      <div className="node-section"><span>FINDINGS</span></div>
      <ul className="ns-knowledge">{device.investigations.flatMap((service) => service.knowledge.map((weakness) => <li key={`${service.id}-${weakness.id}`} title={weakness.label}><strong>{weakness.id}</strong><span>{service.name} · KNOWN WEAKNESS</span></li>))}</ul>
    </>}

    {device.investigations.some((service) => service.analysisRunning || service.credentialRunning) && <>
      <div className="node-section"><span>ACTIVE ACTIVITY</span></div>
      <div className="ns-actions">{device.investigations.flatMap((service) => [
        service.analysisRunning && <Operation key={`${service.id}-analysis`} label={`ANALYZING ${service.observed?.implementation.split(' ')[0] ?? service.name}`} note={service.name} percent={service.analysisRunning.percent} ariaLabel={`${service.name} analysis running`} />,
        service.credentialRunning && <Operation key={`${service.id}-credential`} label="CREDENTIAL ACCESS" note={service.attempt?.toolName ?? service.name} percent={service.credentialRunning.percent} ariaLabel={`${service.name} credential access running`} />,
      ].filter(Boolean))}</div>
    </>}

    {device.services.length > 0 && <>
      <div className="node-section"><span>INVESTIGATION</span></div>
      <div className="ns-actions">{device.investigations.map((service) => service.analysisRunning
        ? null
        : <Action key={service.id} label={service.analysisOutcome ? `ANALYZE ${service.name} AGAIN` : `ANALYZE ${service.name}`} note={`Investigate remembered ${service.name} surface.`} onClick={() => onAnalyze(service)} />)}</div>
    </>}

    {(device.investigations.some((service) => service.attempt && !service.access) || device.rollback) && <>
      <div className="node-section"><span>AVAILABLE OPERATIONS</span></div>
      <div className="ns-actions">
        {device.investigations.map((service) => service.attempt && !service.access && !service.credentialRunning
          ? <Action key={service.id} label="CREDENTIAL ACCESS" note={`${service.attempt.toolName} · READY · Outcome unknown`} ariaLabel={`Attempt credential access through ${service.name}`} onClick={() => onAttempt(service, service.attempt!.vulnerabilityId)} />
          : null)}
        {device.rollback && <div className="ns-package-submit ns-workspace-operation">
          <strong>ROLLBACK GATESSH</strong>
          <span>Requires: Older compatible GateSSH package</span>
          <label>AVAILABLE<select aria-label="Rollback package" value={selectedPackageId} onChange={(event) => onSelectPackage(event.target.value)}>
            <option value="">{device.rollback.candidates.length ? 'Select local package' : 'None'}</option>
            {device.rollback.candidates.map((file) => <option key={file.id} value={file.id}>{file.label} · {file.path}</option>)}
          </select></label>
          {device.rollback.candidates.length > 0 && <Action label="APPLY PACKAGE" note="Submit the selected local artifact." onClick={() => onSubmitPackage(device.rollback!.service)} />}
        </div>}
      </div>
    </>}
    {!device.investigations.some((service) => service.credentialRunning) && feedback && device.investigations.some(({ id }) => id === feedback.serviceId) && <p className="node-note node-note--caution" role="status">{feedback.message}</p>}

    <div className="node-section"><span>ACTIONS</span></div>
    <div className="ns-actions">
      <Action label="SCAN DEVICE" note="Observe currently open Services." ariaLabel={`Scan device ${device.address}`} disabled={pending} onClick={onScan} />
      {release.canInspect && <Action label={device.observed ? 'INSPECT AGAIN' : 'INSPECT DEVICE'} note="Observe this Device's own properties." onClick={onInspect} />}
    </div>
    {observationFeedback && <p className="node-note node-note--caution" role="status">{observationFeedback}</p>}

    <details className="ns-details">
      <summary>DETAILS / SERVICES</summary>
      <div className="node-section"><span>NETWORKS</span><span>{device.networks.length} known</span></div>
      {device.networks.length > 0
        ? <div className="ns-list">{device.networks.map((network) => <button type="button" className="ns-row ns-row--relation" key={network.id} aria-label={`Open known area ${network.name}`} onClick={() => onOpenNetwork(network.id)}><span className="ns-row-copy"><span className="ns-eyebrow">NETWORK</span><strong>{network.name}</strong></span><span className="ns-arrow" aria-hidden="true">→</span></button>)}</div>
        : <div className="node-empty"><strong>NO KNOWN NETWORKS</strong><span>No Network is known to contain this Device.</span></div>}
      <div className="node-section"><span>SERVICES</span><span>{device.servicesObserved ? countLabel(device.services.length, 'known service') : 'Not observed'}</span></div>
      {!device.servicesObserved
        ? <div className="node-empty"><strong>SERVICES NOT OBSERVED</strong><span>Scan this Device to observe its currently open Services.</span></div>
        : device.services.length === 0
          ? <div className="node-empty"><strong>NO OPEN SERVICES</strong><span>The last Scan of this Device observed no open Services.</span></div>
          : <div className="ns-list">{device.services.map((service) => <ServiceRow key={service.id} service={service} onOpen={() => onOpenService(service.id)} />)}</div>}
    </details>
  </div>
}

function ServiceView({ service, copyState, feedback, selectedPackageId, onCopy, onAnalyze, onAttempt, onSelectPackage, onSubmitPackage, onBack }: {
  service: ServiceWorkspace
  copyState: CopyState
  feedback: StartFeedback
  onCopy(value: string): void
  onAnalyze(): void
  onAttempt(vulnerabilityId: string): void
  selectedPackageId: string
  onSelectPackage(fileId: string): void
  onSubmitPackage(): void
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
        {service.observed.interface && <div><dt>INTERFACE</dt><dd>{service.observed.interface}</dd></div>}
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
      {service.observed?.interface === 'Package submission' && <div className="ns-package-submit">
        <label>LOCAL PACKAGE<select aria-label="Local package" value={selectedPackageId} onChange={(event) => onSelectPackage(event.target.value)}>
          <option value="">Select package</option>
          {service.localPackages.map((file) => <option key={file.id} value={file.id}>{file.label} · {file.path}</option>)}
        </select></label>
        <Action label="SUBMIT PACKAGE" note="Send selected artifact to this public interface." onClick={onSubmitPackage} />
      </div>}
    </div>
    {!service.credentialRunning && !service.access && service.credentialFailed && <p className="node-note">Authentication attempt failed.</p>}
    {!service.analysisRunning && feedback?.serviceId === service.id && <p className="node-note node-note--caution" role="status">{feedback.message}</p>}
  </div>
}
