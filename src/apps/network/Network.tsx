import './network.css'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { isValidIpv4 } from '../../core/game/networkTarget'
import { formatBytes, formatTransferRate } from '../byteFormat'
import { selectManagedNetworks, type ManagedNetworkActivityRecordView, type ManagedNetworkView } from '../networkManagement/networkProjection'
import { operationPhases, reachedPhases } from './executionTrace'
import {
  resolveNodeScanRelease,
  selectKnownSpace,
  selectTarget,
  type KnownNetwork,
  type KnownSpace,
  type NodeScanRelease,
  type PlayerInformation,
  type Target,
  type TargetOffensiveAction,
  type TargetOperation,
  type TargetRoute,
  type TargetService,
  type TargetStage,
  type TargetSummary,
} from './targetProjection'

/**
 * NodeScan is the one player-facing home for network space: the Networks the
 * player legitimately administers and the ones reconnaissance remembers, in
 * one restrained technical map.
 *
 * KNOWN SPACE is a compact expandable relationship tree — Network → Device —
 * carried by indentation, type weight and thin connectors rather than nested
 * cards. Only the Network level expands: a Device is a leaf whose whole row
 * is the route into its existing target card, where Service identity and
 * every other technical fact already live under TECHNICAL INTELLIGENCE.
 * Expanding a Network is presentation state only: browsing the tree never
 * observes anything.
 *
 * Two routes hang off it, and they are deliberately different kinds of thing:
 *
 * - A managed Network opens its administration detail, drawn from the local
 *   Device's explicit `NetworkManagementAuthority`. That authority states the
 *   Network's own canonical facts and never its members' identities.
 * - A target opens its card. Reconnaissance and connection state stay concise,
 *   while ACTIONS lets the player choose among concrete owned Techniques.
 *
 * INSPECT is not a stage in that line. It is optional depth under TECHNICAL
 * INTELLIGENCE, where it also pays off visibly: a target the player has only
 * Scanned is an UNKNOWN DEVICE at an address until a legitimate Inspect
 * observes and remembers the represented Device name.
 *
 * Every reconnaissance fact comes from the view models in
 * `targetProjection.ts`, which read player information only; the managed
 * Network's own facts come from the separate management projection, which
 * reads authority.
 */
type Focus =
  | { readonly kind: 'targets' }
  | { readonly kind: 'target'; readonly deviceId: string }
  | { readonly kind: 'network'; readonly networkId: string }

type CopyState = { value: string; status: 'copied' | 'failed' } | null

/**
 * What NodeScan is currently issuing, while it is issuing it.
 *
 * Scan, Ping and Inspect resolve immediately in canon, so this is the whole
 * of their temporal presentation: the request is stated, held for one short
 * beat, and then actually issued. The steps are the operation's own intent —
 * never an observation, and never a result.
 */
type Acquisition = { readonly subject: string; readonly label: string; readonly steps: readonly string[] } | null

/**
 * Long enough for an observation to read as an act rather than a redraw,
 * short enough that scanning a row of targets in sequence never feels like
 * waiting. Nothing canonical is deferred behind it except the observation
 * this beat is announcing.
 */
const ACQUISITION_HOLD_MS = 620

/** How long a completed operation's arrival is marked before the card settles. */
const STAGE_RESOLVE_MS = 900

/**
 * The stages that describe work currently running: the word this interface
 * marks each one with, and the canonical-progress label it has always
 * carried. Known Space and the target card read the same table, so a running
 * target never reads as one thing in the tree and another on its card.
 */
const RUNNING_STAGE = {
  analyzing: { status: 'ANALYZING', progressLabel: 'Analysis progress' },
  hacking: { status: 'HACKING', progressLabel: 'Hack progress' },
  attacking: { status: 'ATTACKING RACKUPDATE', progressLabel: 'Attack progress' },
  submitting: { status: 'SUBMITTING PACKAGE', progressLabel: 'Submission progress' },
} as const satisfies Partial<Record<TargetStage, { status: string; progressLabel: string }>>

function isRunning(stage: TargetStage): boolean { return stage in RUNNING_STAGE }

const STAGE_MARK: Record<TargetStage, string> = {
  unscanned: 'NOT SCANNED',
  analysis_ready: 'SERVICES FOUND',
  analyzing: 'ANALYZING',
  no_route: 'OBSERVED',
  route: 'ACTIONS AVAILABLE',
  hacking: 'HACKING',
  attack: 'ACTIONS AVAILABLE',
  attacking: 'ATTACKING',
  submission_ready: 'SUBMISSION READY',
  submitting: 'SUBMITTING',
  access: 'ACCESS',
  connected: 'CONNECTED',
}

const ACTIVITY_KIND_LABEL: Record<ManagedNetworkActivityRecordView['kind'], string> = {
  connection_attempt: 'CONNECTION ATTEMPT',
  file_transfer: 'FILE TRANSFER',
  package_submission: 'PACKAGE SUBMISSION',
}

const POSITIVE_RESULT = new Set<ManagedNetworkActivityRecordView['result']>(['SUCCESS', 'COMPLETED'])

function locationOf(target: Pick<TargetSummary, 'networkNames' | 'scope'>): string {
  return target.networkNames.length ? target.networkNames.join(' · ') : target.scope === 'unknown' ? 'Membership not observed' : target.scope === 'lan' ? 'Local network' : 'Remote'
}

/**
 * What the player may legitimately call this target. Its address is always
 * theirs; its kind and its represented display name are theirs only once a
 * legitimate Inspect observed them.
 */
function kindOf(target: Target): string {
  return target.observed ? target.observed.deviceKind.toUpperCase() : 'UNKNOWN DEVICE'
}

export function Network() {
  const gameState = useGameState()
  const actions = useGameActions()
  const release = resolveNodeScanRelease(gameState.player.localDevice)
  const [focus, setFocus] = useState<Focus>({ kind: 'targets' })
  /*
   * Tree shape is local presentation state and nothing else: it starts and
   * ends in this component, and no expansion ever reaches a gameplay
   * operation. Network roots read open, because a root the player already
   * knows about has nothing to hide. Devices are leaves and never expand;
   * their row is the route straight into the target card.
   */
  const [closedNetworkIds, setClosedNetworkIds] = useState<readonly string[]>([])
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [directAddress, setDirectAddress] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [acquisition, setAcquisition] = useState<Acquisition>(null)
  const pendingRef = useRef<string | null>(null)
  const requestGeneration = useRef(0)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  const holdTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { requestGeneration.current++; clearTimeout(copyTimer.current); clearTimeout(holdTimer.current) }, [])

  function beginRequest(subject: string) {
    if (pendingRef.current === subject) return null
    pendingRef.current = subject
    setPending(subject)
    setNotice(null)
    return ++requestGeneration.current
  }
  function finishRequest(subject: string, generation: number) {
    if (requestGeneration.current !== generation) return false
    if (pendingRef.current === subject) pendingRef.current = null
    setPending(null)
    setAcquisition(null)
    return true
  }
  /** A result that arrives after the player moved on is no longer their answer. */
  function invalidateRequests() {
    requestGeneration.current++
    clearTimeout(holdTimer.current)
    pendingRef.current = null
    setPending(null)
    setAcquisition(null)
    setNotice(null)
  }
  /**
   * Issue one immediate observation with a beat in front of it.
   *
   * The canonical operation is deliberately invoked *after* the hold rather
   * than presented behind it, so remembered information and what NodeScan is
   * saying can never disagree: until the beat ends, the observation genuinely
   * has not happened yet. Leaving the surface abandons the request before it
   * is issued, exactly as it already abandoned a result the player moved on
   * from.
   */
  async function observe(subject: string, label: string, steps: readonly string[], run: (current: () => boolean) => void | Promise<void>) {
    const generation = beginRequest(subject)
    if (generation === null) return
    const current = () => requestGeneration.current === generation
    setAcquisition({ subject, label, steps })
    await new Promise<void>((resolve) => { holdTimer.current = setTimeout(resolve, ACQUISITION_HOLD_MS) })
    if (!current()) return
    try { await run(current) } catch { /* an abandoned request simply reports nothing */ }
    finishRequest(subject, generation)
  }
  function open(next: Focus) {
    invalidateRequests()
    setFocus(next)
  }
  function toggleNetwork(networkId: string) {
    setClosedNetworkIds((closed) => closed.includes(networkId) ? closed.filter((id) => id !== networkId) : [...closed, networkId])
  }

  async function findTargets() {
    await observe('targets', 'SWEEPING KNOWN SPACE', ['REFRESHING SELF RELATIONSHIPS', 'QUERYING KNOWN NETWORKS'], async (current) => {
      const result = await actions.findTargets()
      if (!current()) return
      if (result.status !== 'observed') setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : 'NO RESPONSE')
      else if (result.targetsKnown === 0) setNotice('NOTHING FOUND')
    })
  }

  async function scanSelf() {
    const address = gameState.player.localDevice.network.ip
    await observe('self', 'SCANNING SELF', [`CONTACTING ${address}`, 'READING NETWORK RELATIONSHIPS'], async (current) => {
      const result = await actions.scanTarget(address)
      if (!current()) return
      if (result.status !== 'device') setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : 'NO RESPONSE')
    })
  }

  async function pingDirectAddress() {
    const address = directAddress.trim()
    if (!isValidIpv4(address)) {
      setNotice('INVALID ADDRESS')
      return
    }
    await observe('direct-address', 'PINGING', [`CONTACTING ${address}`, 'AWAITING RESPONSE'], (current) => {
      const result = actions.pingTarget(address)
      if (!current()) return
      setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED'
        : result.status === 'no_response' ? 'NO RESPONSE'
          : result.status === 'device' ? null
            : 'INVALID ADDRESS')
    })
  }

  async function scan(target: Target) {
    await observe(target.id, target.servicesObserved ? 'RESCANNING' : 'SCANNING', [`CONTACTING ${target.address}`, 'READING OPEN SERVICES'], async (current) => {
      const result = await actions.scanTarget(target.address)
      if (!current()) return
      if (result.status !== 'device' || result.targetId !== target.id) setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : result.status === 'no_response' ? 'NO RESPONSE' : 'UNKNOWN TARGET')
    })
  }

  async function inspect(target: Target) {
    await observe(`inspect:${target.id}`, 'INSPECTING', [`CONTACTING ${target.address}`, 'READING DEVICE EVIDENCE'], (current) => {
      const result = actions.inspectTarget(target.address)
      if (!current()) return
      setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED'
        : result.status === 'capability_unavailable' ? 'INSPECT UNAVAILABLE'
          : result.status === 'no_response' ? 'NO RESPONSE'
            : result.status === 'unknown_target' ? 'UNKNOWN TARGET' : null)
    })
  }

  function hack(route: TargetRoute, targetDeviceId: string) {
    const result = actions.startCredentialAccessAttemptFromObservation({
      endpoint: route.endpoint, targetDeviceId, serviceId: route.serviceId,
      vulnerabilityId: route.vulnerabilityId,
    })
    if (result.status === 'started') setNotice(null)
    else if (result.status === 'insufficient_memory') setNotice(`NOT ENOUGH MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available`)
    else setNotice(result.status === 'already_running' ? 'ALREADY RUNNING'
      : result.status === 'access_established' ? 'ACCESS ALREADY ESTABLISHED'
      : result.status === 'endpoint_not_found' ? 'TARGET NOT AVAILABLE'
      : 'NOT AVAILABLE')
  }

  function connect(target: Target) {
    const result = actions.connectRemoteFromObservation({ targetDeviceId: target.id, address: target.address })
    setNotice(result.status === 'target_not_available' ? 'TARGET NOT AVAILABLE'
      : result.status === 'session_active' ? 'ANOTHER CONNECTION IS OPEN'
      : result.status === 'access_required' ? 'ACCESS REQUIRED'
      : null)
  }

  function analyze(target: Target, service: TargetService) {
    const result = actions.startServiceAnalysisFromObservation({ endpoint: service.endpoint, targetDeviceId: target.id, serviceId: service.id })
    if (result.status === 'started') setNotice(null)
    else if (result.status === 'insufficient_memory') setNotice(`NOT ENOUGH MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available`)
    else setNotice(result.status === 'already_running' ? 'ALREADY RUNNING'
      : result.status === 'endpoint_not_found' || result.status === 'invalid_endpoint' ? 'TARGET NOT AVAILABLE'
      : 'SERVICE UNAVAILABLE')
  }

  function analyzeAll(target: Target) {
    const relevant = target.services.filter((service) => service.analysisRequired && service.analysisPercent === undefined)
    const result = actions.startObservedServiceAnalyses(relevant.map((service) => ({ endpoint: service.endpoint, targetDeviceId: target.id, serviceId: service.id })))
    if (result.insufficientMemory) setNotice(`${result.started ? `${result.started} ANALYSIS${result.started === 1 ? '' : 'ES'} STARTED · ` : ''}NOT ENOUGH MEMORY FOR ALL SERVICES · ${result.insufficientMemory.requiredMiB} MiB required · ${Math.floor(result.insufficientMemory.availableMiB)} MiB available`)
    else setNotice(result.started ? null : 'NO ANALYSIS AVAILABLE')
  }

  function attackPackageSubmission(target: Target) {
    const packageSubmission = target.packageSubmission
    if (!packageSubmission?.route) return
    const result = actions.startRackUpdateExploitAttemptFromObservation({
      endpoint: packageSubmission.endpoint, targetDeviceId: target.id, serviceId: packageSubmission.serviceId,
      vulnerabilityId: packageSubmission.route.vulnerabilityId,
    })
    if (result.status === 'started') setNotice(null)
    else if (result.status === 'insufficient_memory') setNotice(`NOT ENOUGH MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available`)
    else setNotice(result.status === 'already_running' ? 'ALREADY RUNNING'
      : result.status === 'submission_enabled' ? 'SUBMISSION ALREADY ENABLED'
      : result.status === 'endpoint_not_found' ? 'TARGET NOT AVAILABLE'
      : 'NOT AVAILABLE')
  }

  function submitPackage(target: Target) {
    const packageSubmission = target.packageSubmission
    if (!packageSubmission) return
    const result = actions.startRackUpdatePackageSubmission({ targetDeviceId: target.id, serviceId: packageSubmission.serviceId, endpoint: packageSubmission.endpoint, localFileId: selectedPackageId })
    setNotice(result.status === 'started' ? null
      : result.status === 'observation_required' ? 'OBSERVATION REQUIRED'
        : result.status === 'access_required' ? 'ATTACK RACKUPDATE FIRST'
          : result.status === 'package_unavailable' ? 'PACKAGE UNAVAILABLE'
            : result.status === 'package_incompatible' ? 'PACKAGE REJECTED'
              : result.status === 'activation_pending' ? 'REBOOT REQUIRED'
              : result.status === 'submission_in_progress' ? 'SUBMISSION ALREADY IN PROGRESS'
                : result.status === 'capacity_unavailable' ? 'NETWORK UNAVAILABLE'
                  : 'PACKAGE NOT SUBMITTED')
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyState({ value, status: 'copied' }) }
    catch { setCopyState({ value, status: 'failed' }) }
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopyState(null), 1600)
  }

  if (!release) return <section className="app-content scan-app" aria-label="NodeScan">
    <div className="ns-view">
      <header className="ns-masthead"><div><span className="ns-eyebrow">NODESCAN</span><h2>NOT INSTALLED</h2></div></header>
      <div className="node-empty"><strong>NO RECONNAISSANCE SOFTWARE</strong><span>This Device carries no installed NodeScan release, so no target can be observed.</span></div>
    </div>
  </section>

  /*
   * Narrowed at the boundary: every reconnaissance view is built from player
   * information only. Managed-Network truth is composed separately and
   * explicitly, from the authority relationship that legitimately supplies it.
   */
  const information: PlayerInformation = gameState
  const managedNetworks = selectManagedNetworks(gameState)

  if (focus.kind === 'network') {
    const network = managedNetworks.find(({ id }) => id === focus.networkId)
    if (network) return <section className="app-content scan-app" aria-label="NodeScan">
      <ManagedNetworkDetail network={network} onBack={() => open({ kind: 'targets' })} />
    </section>
  }

  if (focus.kind === 'target') {
    const target = selectTarget(information, focus.deviceId)
    if (target) return <section className="app-content scan-app" aria-label="NodeScan">
      <TargetCard
        target={target}
        release={release}
        pending={pending === target.id}
        inspecting={pending === `inspect:${target.id}`}
        acquisition={acquisition?.subject === target.id ? acquisition : null}
        inspectAcquisition={acquisition?.subject === `inspect:${target.id}` ? acquisition : null}
        notice={notice}
        copyState={copyState}
        selectedPackageId={selectedPackageId}
        onBack={() => open({ kind: 'targets' })}
        onScan={() => scan(target)}
        onInspect={() => inspect(target)}
        onExecuteAction={(action) => action.technique === 'Credential Access'
          ? action.route && hack(action.route as TargetRoute, target.id)
          : action.route && attackPackageSubmission(target)}
        onConnect={() => connect(target)}
        onDisconnect={() => { actions.disconnectRemoteSession(); setNotice(null) }}
        onAnalyze={(service) => analyze(target, service)}
        onAnalyzeAll={() => analyzeAll(target)}
        onCopy={copy}
        onSelectPackage={setSelectedPackageId}
        onSubmitPackage={() => submitPackage(target)}
      />
    </section>
  }

  return <section className="app-content scan-app" aria-label="NodeScan">
    <KnownSpaceView
      space={selectKnownSpace(information, managedNetworks)}
      release={release}
      pending={pending === 'targets'}
      selfPending={pending === 'self'}
      directPending={pending === 'direct-address'}
      acquisition={acquisition}
      directAddress={directAddress}
      notice={notice}
      closedNetworkIds={closedNetworkIds}
      onToggleNetwork={toggleNetwork}
      onFind={findTargets}
      onScanSelf={scanSelf}
      onDirectAddressChange={setDirectAddress}
      onDirectScan={pingDirectAddress}
      onOpen={(deviceId) => open({ kind: 'target', deviceId })}
      onOpenNetwork={(networkId) => open({ kind: 'network', networkId })}
    />
  </section>
}

function KnownSpaceView({ space, release, pending, selfPending, directPending, acquisition, directAddress, notice, closedNetworkIds, onToggleNetwork, onFind, onScanSelf, onDirectAddressChange, onDirectScan, onOpen, onOpenNetwork }: {
  space: KnownSpace
  release: NodeScanRelease
  pending: boolean
  selfPending: boolean
  directPending: boolean
  acquisition: Acquisition
  directAddress: string
  notice: string | null
  closedNetworkIds: readonly string[]
  onToggleNetwork(networkId: string): void
  onFind(): void
  onScanSelf(): void
  onDirectAddressChange(value: string): void
  onDirectScan(): void
  onOpen(deviceId: string): void
  onOpenNetwork(networkId: string): void
}) {
  const selfPlaced = space.networks.some(({ includesSelf }) => includesSelf)
  const settled = useSettled()
  return <div className="ns-view">
    <header className="ns-masthead">
      <div><span className="ns-eyebrow">{release.name.toUpperCase()}</span><h2>KNOWN SPACE</h2></div>
      <span className="ns-release">{release.version}{release.channel ? ` ${release.channel.toUpperCase()}` : ''}</span>
    </header>

    <form className="ns-direct-scan" onSubmit={(event) => { event.preventDefault(); onDirectScan() }} noValidate>
      <label htmlFor="nodescan-target-address">TARGET ADDRESS</label>
      <div className="ns-direct-row">
        <input
          id="nodescan-target-address"
          className="node-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="IPv4 address"
          value={directAddress}
          onChange={(event) => onDirectAddressChange(event.target.value)}
        />
        <button type="submit" aria-label="Ping target address" disabled={directPending}>{directPending ? 'PINGING' : 'PING'}</button>
      </div>
      {acquisition?.subject === 'direct-address' && <Acquisition acquisition={acquisition} compact />}
    </form>

    <div className="ns-space">
      {!selfPlaced && <section className="ns-group" aria-label="Self">
        <button type="button" className="ns-node ns-node--self ns-self-scan" aria-label="SCAN SELF" onClick={onScanSelf} disabled={pending || selfPending}>
          <span className="ns-glyph ns-glyph--self" aria-hidden="true" />
          <span className="ns-target-copy"><strong>SELF</strong><span className="ns-target-note">{space.self.address}</span></span>
          {!selfPending && <span className="ns-target-mark">NOT SCANNED</span>}
          <span className="ns-self-action">{selfPending ? 'SCANNING' : 'SCAN'}</span>
        </button>
        {acquisition?.subject === 'self' && <Acquisition acquisition={acquisition} compact />}
      </section>}

      {space.networks.map((network) => <NetworkBranch
        key={network.id}
        network={network}
        settled={settled}
        selfAddress={space.self.address}
        expanded={!closedNetworkIds.includes(network.id)}
        onToggle={() => onToggleNetwork(network.id)}
        onOpen={onOpen}
        onOpenNetwork={onOpenNetwork}
      />)}

      {space.elsewhere.length > 0 && <section className="ns-group" aria-label="Elsewhere">
        <header className="ns-group-head"><span className="ns-eyebrow">ELSEWHERE</span></header>
        <div className="ns-loose">{space.elsewhere.map((target) => <DeviceRow
          key={target.id}
          target={target}
          settled={settled}
          showLocation
          onOpen={onOpen}
        />)}</div>
      </section>}
    </div>

    {space.remembersNetwork && <div className="ns-primary-slot">
      <button type="button" className="ns-primary" disabled={pending} onClick={onFind}>{pending ? 'SCANNING' : 'SCAN AGAIN'}</button>
      {acquisition?.subject === 'targets'
        ? <Acquisition acquisition={acquisition} compact />
        : <p className="ns-primary-note">Look for devices on known Networks.</p>}
    </div>}
    {notice && <p className="node-note node-note--caution" role="status">{notice}</p>}
  </div>
}

/**
 * One Network root and everything the player legitimately knows under it.
 *
 * The root itself is the strongest identity in the tree. Where the local
 * Device actually manages this Network, the root also carries the route to
 * its administration; a Network merely observed carries no such control,
 * because observing a Network is not authority over it.
 */
function NetworkBranch({ network, settled, selfAddress, expanded, onToggle, onOpen, onOpenNetwork }: {
  network: KnownNetwork
  settled(): boolean
  selfAddress: string
  expanded: boolean
  onToggle(): void
  onOpen(deviceId: string): void
  onOpenNetwork(networkId: string): void
}) {
  const populated = network.includesSelf || network.targets.length > 0
  return <section className={`ns-group${expanded ? ' is-expanded' : ''}${populated ? ' is-populated' : ''}`} aria-label={`Network ${network.name}`}>
    <div className="ns-node ns-node--network">
      <button
        type="button"
        className="ns-node-main"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} network ${network.name}`}
        onClick={onToggle}
      >
        <span className="ns-twist" aria-hidden="true">▸</span>
        <span className="ns-target-copy">
          <span className="ns-eyebrow">NETWORK</span>
          <strong>{network.name}</strong>
        </span>
      </button>
      {network.managed
        ? <button type="button" className="ns-node-route" aria-label={`Manage network ${network.name}`} onClick={() => onOpenNetwork(network.id)}>MANAGED<span aria-hidden="true">›</span></button>
        : <span className="ns-node-mark">OBSERVED</span>}
    </div>

    {expanded && <div className="ns-branch">
      {populated && <div className="ns-limbs">
        {/* SELF is the player's own position in the topology, never a target. */}
        {network.includesSelf && <div className="ns-limb">
          <div className="ns-node ns-node--self ns-node--static">
            <span className="ns-glyph ns-glyph--self" aria-hidden="true" />
            <span className="ns-target-copy"><strong>SELF</strong><span className="ns-target-note">{selfAddress}</span></span>
          </div>
        </div>}
        {network.targets.map((target) => <div className="ns-limb" key={target.id}>
          <DeviceRow target={target} settled={settled} onOpen={onOpen} />
        </div>)}
      </div>}
      {!network.membersObserved
        ? <p className="ns-branch-note">Members not observed</p>
        : network.targets.length === 0 && <p className="ns-branch-note">{network.includesSelf ? 'No other devices responded' : 'No devices responded'}</p>}
    </div>}
  </section>
}

/**
 * One remembered Device: a leaf in the tree whose whole row is the route
 * straight into its existing target card. Its identity line is exactly what
 * the player has legitimately learned — an address until an Inspect observed
 * the represented name, and the name over the address afterwards. Service
 * identity, fingerprints, and every other technical fact live on that card
 * under TECHNICAL INTELLIGENCE; Known Space states only where a Device is and
 * what its current stage is.
 */
function DeviceRow({ target, settled, showLocation, onOpen }: {
  target: TargetSummary
  /** Whether Known Space was already on screen when this row mounted. */
  settled(): boolean
  showLocation?: boolean
  onOpen(deviceId: string): void
}) {
  const [revealed] = useState(settled)
  const note = [target.displayName ? target.address : undefined, showLocation ? locationOf(target) : undefined].filter(Boolean).join(' · ')
  return <button type="button" className={`ns-node ns-node--device${revealed ? ' ns-node--revealed' : ''}`} aria-label={`Open target ${target.address}`} onClick={() => onOpen(target.id)}>
    <span className="ns-glyph" aria-hidden="true" />
    <span className="ns-target-copy">
      <strong>{target.displayName ?? target.address}</strong>
      {!target.displayName && <span className="ns-target-note">UNKNOWN DEVICE</span>}
      {note && <span className="ns-target-note">{note}</span>}
    </span>
    <span className={`ns-target-mark ns-target-mark--${target.stage}`}>
      {isRunning(target.stage) && <i className="ns-live-dot" aria-hidden="true" />}
      {STAGE_MARK[target.stage]}
    </span>
    <span className="ns-arrow" aria-hidden="true">›</span>
  </button>
}

/**
 * Whether Known Space has finished arriving.
 *
 * A target row that mounts afterwards is one the player just observed, and it
 * should read as an arrival rather than as a list that is silently longer
 * than before. Rows already remembered when the surface opened are simply
 * there. Nothing here observes or remembers anything of its own.
 */
function useSettled(): () => boolean {
  const settled = useRef(false)
  useEffect(() => { settled.current = true }, [])
  return () => settled.current
}

/**
 * The administration detail for a Network the local Device actually manages.
 *
 * Everything here is canonical truth the management authority legitimately
 * supplies about the Network itself — its represented name, its own external
 * capacity, how many Devices it carries, and its own activity evidence. It
 * deliberately stops there: authority over a Network is not observation of
 * what is on it, so no member identity, address, Firmware or Service appears,
 * and nothing here is written back into Discovery.
 */
function ManagedNetworkDetail({ network, onBack }: { network: ManagedNetworkView; onBack(): void }) {
  return <div className="ns-view">
    <nav className="scan-crumbs" aria-label="NodeScan navigation">
      <button type="button" onClick={onBack}>← Known Space</button>
      <span aria-hidden="true">/</span>
      <strong>{network.name}</strong>
    </nav>

    <header className="ns-subject">
      <span className="ns-eyebrow">MANAGED NETWORK</span>
      <h2>{network.name}</h2>
      <p className="ns-subject-note">This Device holds management authority over this Network.</p>
    </header>

    <div className="node-section"><span>CONNECTIVITY</span></div>
    <dl className="node-facts">
      <div><dt>UPLOAD</dt><dd>{formatTransferRate(network.connectivity.uploadBytesPerSecond)}</dd></div>
      <div><dt>DOWNLOAD</dt><dd>{formatTransferRate(network.connectivity.downloadBytesPerSecond)}</dd></div>
    </dl>

    <div className="node-section"><span>MEMBERSHIP</span></div>
    <dl className="node-facts">
      <div><dt>MEMBERS</dt><dd>{network.memberCount}</dd></div>
    </dl>
    <p className="ns-quiet-note">Management authority counts members. It does not identify them: Devices appear in Known Space only where reconnaissance observed them.</p>

    <div className="node-section"><span>ACTIVITY</span><span>{network.activity.length}</span></div>
    {network.activity.length === 0
      ? <div className="node-empty"><strong>NO ACTIVITY</strong><span>No activity has been observed on this Network yet.</span></div>
      : <div className="node-list">{network.activity.map((record) => <ActivityRow key={record.id} record={record} />)}</div>}
  </div>
}

function ActivityRow({ record }: { record: ManagedNetworkActivityRecordView }) {
  const detail = [
    `${record.sourceAddress} → ${record.destinationAddress}`,
    record.serviceName,
    record.bytesTransferred !== undefined ? formatBytes(record.bytesTransferred) : undefined,
  ].filter(Boolean).join(' · ')
  return <div className="node-row">
    <span className="node-row-copy">
      <strong>{ACTIVITY_KIND_LABEL[record.kind]}</strong>
      <small>{detail}</small>
    </span>
    <span className={POSITIVE_RESULT.has(record.result) ? 'node-chip' : 'node-chip node-chip--quiet'}>{record.result}</span>
  </div>
}

/** One target context, with status, player-chosen offensive ACTIONS, and depth. */
function TargetCard({ target, release, pending, inspecting, acquisition, inspectAcquisition, notice, copyState, selectedPackageId, onBack, onScan, onInspect, onExecuteAction, onConnect, onDisconnect, onAnalyze, onAnalyzeAll, onCopy, onSelectPackage, onSubmitPackage }: {
  target: Target
  release: NodeScanRelease
  pending: boolean
  inspecting: boolean
  /** The target's own Scan, which is its whole status while it is being issued. */
  acquisition: Acquisition
  /** Inspect's own beat, which belongs to the disclosure that offers it. */
  inspectAcquisition: Acquisition
  notice: string | null
  copyState: CopyState
  selectedPackageId: string
  onBack(): void
  onScan(): void
  onInspect(): void
  onExecuteAction(action: TargetOffensiveAction): void
  onConnect(): void
  onDisconnect(): void
  onAnalyze(service: TargetService): void
  onAnalyzeAll(): void
  onCopy(value: string): void
  onSelectPackage(fileId: string): void
  onSubmitPackage(): void
}) {
  const resolved = useStageResolution(target)
  return <div className="ns-view">
    <nav className="scan-crumbs" aria-label="NodeScan navigation">
      <button type="button" onClick={onBack}>← Known Space</button>
      <span aria-hidden="true">/</span>
      <strong>{target.address}</strong>
    </nav>

    <header className="ns-subject">
      <span className="ns-eyebrow">{kindOf(target)}</span>
      <h2>{target.displayName ?? target.address}</h2>
      <p className="ns-subject-note">{[target.displayName ? target.address : undefined, locationOf(target)].filter(Boolean).join(' · ')}</p>
    </header>

    <section className="ns-stage" aria-label="Target status" data-running={isRunning(target.stage) || undefined} data-resolved={resolved || undefined}>
      {/*
        * While an observation is being issued, that request is the whole of
        * this target's status: the state it is about to be in has not been
        * observed yet, so the card states what it is doing rather than a
        * stage it cannot yet claim.
        */}
      {acquisition
        ? <div className="ns-stage-body"><Acquisition acquisition={acquisition} /></div>
        : <div className="ns-stage-body" key={target.stage}>
          {target.stage === 'unscanned' && <>
            <strong className="ns-stage-headline">NOT SCANNED</strong>
            <span className="ns-stage-note">Nothing is known about this target yet.</span>
            <Primary label="SCAN" disabled={pending} onClick={onScan} />
          </>}

          {target.stage === 'analysis_ready' && <>
            <strong className="ns-stage-headline">SERVICES FOUND</strong>
            {/* What the Scan actually observed, named where the decision is made. */}
            <span className="ns-stage-observed">{target.services.map(({ name }) => name).join(' · ')}</span>
            <span className="ns-stage-note">The observed attack surface is ready to investigate.</span>
            <Primary label="ANALYZE" onClick={onAnalyzeAll} />
          </>}

          {target.stage === 'analyzing' && <Operation target={target} {...RUNNING_STAGE.analyzing} />}

          {target.stage === 'no_route' && <>
            <strong className="ns-stage-headline">OBSERVATION COMPLETE</strong>
            <span className="ns-stage-note">Review technical intelligence or attempt an available Technique.</span>
            <Primary label="SCAN AGAIN" disabled={pending} onClick={onScan} />
          </>}

          {target.stage === 'route' && <>
            <strong className="ns-stage-headline">TARGET OBSERVED</strong>
            <span className="ns-stage-note">Choose an available Technique below.</span>
          </>}

          {target.stage === 'hacking' && <Operation target={target} {...RUNNING_STAGE.hacking} />}

          {target.stage === 'attack' && <>
            <strong className="ns-stage-headline">TARGET OBSERVED</strong>
            <span className="ns-stage-note">Choose an available Technique below.</span>
          </>}

          {target.stage === 'attacking' && <Operation target={target} {...RUNNING_STAGE.attacking} />}

          {target.stage === 'submission_ready' && <>
            <strong className="ns-stage-headline">PACKAGE SUBMISSION READY</strong>
            <span className="ns-stage-note">RackUpdate accepts a compatible GateSSH package through the established submission authority.</span>
          </>}

          {target.stage === 'submitting' && <Operation target={target} {...RUNNING_STAGE.submitting} />}

          {target.stage === 'access' && <>
            <strong className="ns-stage-headline">ACCESS GRANTED</strong>
            <span className="ns-stage-note">You can connect to this target now.</span>
            <Primary label="CONNECT" onClick={onConnect} />
          </>}

          {target.stage === 'connected' && <>
            <strong className="ns-stage-headline">CONNECTED</strong>
            <span className="ns-stage-note">{target.session?.connectedAddress} is open.</span>
            <Primary label="DISCONNECT" onClick={onDisconnect} />
          </>}
        </div>}
    </section>
    {notice && <p className="node-note node-note--caution" role="status">{notice}</p>}

    <section className="ns-actions" aria-labelledby="nodescan-actions-heading">
      <div className="node-section"><span id="nodescan-actions-heading">ACTIONS</span><span>{target.offensiveActions.length || undefined}</span></div>
      {target.offensiveActions.length === 0
        ? <div className="node-empty"><strong>NO OFFENSIVE TECHNIQUES AVAILABLE</strong><span>This Device owns no supported provider.</span></div>
        : <div className="ns-action-list">{target.offensiveActions.map((action) => <article className="ns-action" key={action.technique}>
          <div className="ns-action-copy"><strong>{action.technique.toUpperCase()}</strong><span>{action.provider}</span></div>
          {/*
            * A Technique whose own attempt is already running says so where
            * the control was, rather than offering an EXECUTE that can only
            * report that it is already running.
            */}
          {action.running
            ? <span className="node-chip" aria-label={`${action.technique} running`}><i className="ns-live-dot" aria-hidden="true" />RUNNING</span>
            : action.route
              ? <button type="button" className="node-action" aria-label={`Execute ${action.technique}`} onClick={() => onExecuteAction(action)}>EXECUTE</button>
              : <span className="node-chip node-chip--quiet" aria-label={`${action.technique} unavailable`}>UNAVAILABLE</span>}
        </article>)}</div>}
    </section>

    <details className="ns-details">
      <summary>
        <span>TECHNICAL INTELLIGENCE</span>
        {/*
          * Inspect is optional depth, so its availability is announced where
          * it lives rather than pushed into the target's line of action.
          */}
        {release.canInspect && !target.observed && <span className="ns-details-hint">INSPECT AVAILABLE</span>}
      </summary>
      <TechnicalDetails
        target={target}
        release={release}
        inspecting={inspecting}
        inspectAcquisition={inspectAcquisition}
        stageOwnsAnalysis={target.stage === 'analyzing'}
        copyState={copyState}
        selectedPackageId={selectedPackageId}
        onInspect={onInspect}
        onAnalyze={onAnalyze}
        onCopy={onCopy}
        onSelectPackage={onSelectPackage}
        onSubmitPackage={onSubmitPackage}
      />
    </details>
  </div>
}

/**
 * What NodeScan is currently doing, while a synchronous observation is being
 * issued. Presentation only: the steps state the request NodeScan is about to
 * make, in the order it makes it, and never a result.
 */
function Acquisition({ acquisition, compact }: { acquisition: NonNullable<Acquisition>; compact?: boolean }) {
  return <div className={`ns-acquire${compact ? ' ns-acquire--compact' : ''}`} role="status">
    {/* Beside a control that already says what it is doing, the steps are the whole statement. */}
    {!compact && <span className="ns-acquire-label">{acquisition.label}</span>}
    <ol className="ns-trace">
      {acquisition.steps.map((step, index) => <li className="ns-trace-line" key={step} style={{ animationDelay: `${index * 190}ms` }}>
        <span className="ns-trace-mark" aria-hidden="true">›</span>
        <span className="ns-trace-label">{step}</span>
        {index === acquisition.steps.length - 1 && <i className="ns-caret" aria-hidden="true" />}
      </li>)}
    </ol>
  </div>
}

/**
 * The execution surface for work actually running against this target.
 *
 * It answers three separate questions the old headline-and-bar could not: what
 * is running, what it is operating on, and how far through itself it is. The
 * facts come from the running work's own canonical state
 * (`targetProjection.ts`); the phase marks are procedural choreography over
 * canonical progress (`executionTrace.ts`) and are deliberately not findings.
 * A target whose stage is running but whose operation could not be described
 * still states the stage rather than an empty surface.
 */
function Operation({ target, status, progressLabel }: { target: Target; status: string; progressLabel: string }) {
  const { operation } = target
  if (!operation) return <>
    <strong className="ns-stage-headline">{status}</strong>
    <Progress percent={target.percent} label={progressLabel} />
  </>
  const phases = reachedPhases(operation)
  return <div className="ns-op">
    <header className="ns-op-head">
      <strong className="ns-op-title">{operation.title}</strong>
      <span className="ns-op-live"><i className="ns-live-dot" aria-hidden="true" />{status}</span>
    </header>
    <dl className="ns-op-facts">
      {operation.facts.map(({ label: factLabel, value }) => <div key={factLabel}><dt>{factLabel}</dt><dd>{value}</dd></div>)}
    </dl>
    {/* Every mark this operation will pass is reserved, so appending one shifts nothing below it. */}
    <ol className="ns-trace ns-op-trace" style={{ '--ns-trace-lines': operationPhases(operation.kind).length } as CSSProperties}>
      {phases.map((phase, index) => <li className="ns-trace-line" key={phase.label} data-active={index === phases.length - 1 || undefined}>
        <span className="ns-trace-at">{phase.at}%</span>
        <span className="ns-trace-label">{phase.label}</span>
        {index === phases.length - 1 && <i className="ns-caret" aria-hidden="true" />}
      </li>)}
    </ol>
    <Progress percent={operation.percent} label={progressLabel} />
  </div>
}

/**
 * Whether this target's stage has just resolved out of running work while the
 * player was watching it.
 *
 * Completion is the moment the whole loop is played for, so it gets its own
 * arrival rather than the ordinary one. It is remembered per target: opening
 * a different target is a new subject, not a resolution.
 */
function useStageResolution(target: Target): boolean {
  const previous = useRef<{ deviceId: string; stage: TargetStage } | null>(null)
  const [resolved, setResolved] = useState(false)
  useEffect(() => {
    const before = previous.current
    previous.current = { deviceId: target.id, stage: target.stage }
    const justResolved = Boolean(before && before.deviceId === target.id && before.stage !== target.stage && isRunning(before.stage))
    setResolved(justResolved)
    if (!justResolved) return
    const timer = setTimeout(() => setResolved(false), STAGE_RESOLVE_MS)
    return () => clearTimeout(timer)
  }, [target.id, target.stage])
  return resolved
}

function Primary({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick(): void }) {
  return <button type="button" className="ns-primary" disabled={disabled} onClick={onClick}>{label}</button>
}

function Progress({ percent, label }: { percent: number; label: string }) {
  return <div className="ns-progress" role="group" aria-label={label}>
    <progress className="node-progress" max="100" value={percent}>{percent}%</progress>
    <span className="ns-progress-value">{percent}%</span>
  </div>
}

function CopyReference({ value, copyState, onCopy }: { value: string; copyState: CopyState; onCopy(value: string): void }) {
  const status = copyState?.value === value ? copyState.status : null
  return <button type="button" className="ns-copy" onClick={() => onCopy(value)} aria-label={`Copy ${value}`}>
    <span>{value}</span>
    <span className="ns-copy-icon" aria-hidden="true">{status === 'copied' ? '✓' : status === 'failed' ? '!' : '⧉'}</span>
    <span className="sr-only" aria-live="polite">{status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : ''}</span>
  </button>
}

/**
 * Optional depth. Everything here is an explanation of the player's own
 * information and their own represented resources; none of it is a new
 * observation, and none of it reads current target truth.
 */
function TechnicalDetails({ target, release, inspecting, inspectAcquisition, stageOwnsAnalysis, copyState, selectedPackageId, onInspect, onAnalyze, onCopy, onSelectPackage, onSubmitPackage }: {
  target: Target
  release: NodeScanRelease
  inspecting: boolean
  inspectAcquisition: Acquisition
  /**
   * Whether the target's own execution surface is already carrying this
   * analysis progress. When it is, a Service states that it is analyzing
   * rather than drawing the same rail a second time on the same screen.
   */
  stageOwnsAnalysis: boolean
  copyState: CopyState
  selectedPackageId: string
  onInspect(): void
  onAnalyze(service: TargetService): void
  onCopy(value: string): void
  onSelectPackage(fileId: string): void
  onSubmitPackage(): void
}) {
  return <div className="ns-detail-panel">
    <div className="node-section"><span>ADDRESS</span></div>
    <CopyReference value={target.address} copyState={copyState} onCopy={onCopy} />

    <div className="node-section"><span>OBSERVED</span></div>
    {target.observed
      ? <dl className="node-facts">
        {/* Present only where an Inspect actually observed the represented name. */}
        {target.displayName && <div><dt>NAME</dt><dd>{target.displayName}</dd></div>}
        <div><dt>TYPE</dt><dd>{target.observed.deviceKind.toUpperCase()}</dd></div>
        <div><dt>STATUS</dt><dd>{target.observed.networkStatus}</dd></div>
        {target.observed.firmware && <div><dt>FIRMWARE</dt><dd>{target.observed.firmware}</dd></div>}
        {target.observed.computeClass && <div><dt>COMPUTE</dt><dd>{target.observed.computeClass}</dd></div>}
      </dl>
      : <div className="node-empty"><strong>NOT OBSERVED</strong><span>No properties of this target have been observed.</span></div>}
    {target.observed && !release.canInspect && <p className="node-note">Remembered from an earlier observation. The installed NodeScan release does not supply Inspect.</p>}
    {/*
      * Inspect explains itself where it is offered: Scan found the attack
      * surface, Inspect looks deeper at what the target actually is. Saying so
      * beside the control is what makes it understandable on first use.
      */}
    {release.canInspect && <div className="ns-inspect">
      <p className="ns-quiet-note">{target.observed
        ? 'Inspect again to refresh this target’s identity and service fingerprints.'
        : 'Inspect looks deeper than Scan: it resolves this target’s device identity, firmware and service fingerprints.'}</p>
      <button type="button" className="node-action" disabled={inspecting} onClick={onInspect}>{inspecting ? 'INSPECTING' : 'INSPECT'}</button>
      {inspectAcquisition && <Acquisition acquisition={inspectAcquisition} compact />}
    </div>}

    {(target.access || target.session) && <>
      <div className="node-section"><span>ACCESS</span></div>
      <dl className="node-facts">
        <div><dt>PRIVILEGE</dt><dd>{(target.session ?? target.access)!.privilege}</dd></div>
        {(target.session ?? target.access)!.viaServiceName && <div><dt>VIA</dt><dd>{(target.session ?? target.access)!.viaServiceName}</dd></div>}
        {target.session && <div><dt>SESSION</dt><dd>ACTIVE</dd></div>}
      </dl>
    </>}

    <div className="node-section"><span>SERVICES</span><span>{target.servicesObserved ? `${target.services.length} known` : 'Not observed'}</span></div>
    {!target.servicesObserved
      ? <div className="node-empty"><strong>SERVICES NOT OBSERVED</strong><span>This target has never been scanned.</span></div>
      : target.services.length === 0
        ? <div className="node-empty"><strong>NO OPEN SERVICES</strong><span>The last scan of this target observed no open services.</span></div>
        : <div className="ns-services">{target.services.map((service) => <article className="ns-service" key={service.id}>
          <header className="ns-service-head">
            <strong>{service.name}</strong>
            <span>{service.port} / {service.protocol}</span>
          </header>
          <CopyReference value={service.endpoint} copyState={copyState} onCopy={onCopy} />
          {service.observed && <dl className="node-facts">
            <div><dt>SOFTWARE</dt><dd>{service.observed.implementation}</dd></div>
            {service.observed.authentication && <div><dt>AUTHENTICATION</dt><dd>{service.observed.authentication}</dd></div>}
            {service.observed.interface && <div><dt>INTERFACE</dt><dd>{service.observed.interface}</dd></div>}
          </dl>}
          {/*
            * Everything already known about this Service is stated before the
            * control that would observe it again, so what the last Analyze
            * found reads as a result rather than as a description of what
            * ANALYZE is about to do.
            */}
          {service.weaknesses.map((weakness) => <p className="ns-weakness" key={weakness.id}><strong>{weakness.label}</strong><span>{weakness.id}</span></p>)}
          {service.analysisPercent === undefined && service.analysisOutcome === 'no_weakness_detected' && <p className="ns-quiet-note">Last analysis found no weakness.</p>}
          {service.analysisPercent === undefined && service.analysisOutcome === 'service_unavailable' && <p className="ns-quiet-note">Last analysis did not complete against the service.</p>}
          {service.accessPrivilege && <p className="ns-quiet-note">{service.accessPrivilege} access was established through this service.</p>}
          {service.analysisPercent === undefined
            ? <button type="button" className="node-action" aria-label={`Analyze ${service.name}`} onClick={() => onAnalyze(service)}>ANALYZE</button>
            : stageOwnsAnalysis
              ? <p className="ns-service-running"><i className="ns-live-dot" aria-hidden="true" />ANALYZING</p>
              : <Progress percent={service.analysisPercent} label={`${service.name} analysis progress`} />}
        </article>)}</div>}

    {target.packageSubmission && <>
      <div className="node-section"><span>PACKAGE SUBMISSION</span></div>
      <div className="ns-package-submission">
        <p className="ns-quiet-note">{target.packageSubmission.serviceName} accepts submitted packages and does not enforce rollback protection.</p>

        {!target.packageSubmission.enabled && target.packageSubmission.lastAttackFailed && <p className="ns-quiet-note">The last Rollback attempt failed.</p>}

        {target.packageSubmission.attacking && target.stage !== 'attacking' && <Progress percent={target.packageSubmission.attackPercent ?? 0} label="Attack progress" />}

        {!target.packageSubmission.enabled && !target.packageSubmission.route && !target.packageSubmission.attacking && <p className="ns-quiet-note">No installed tool currently supports this weakness.</p>}

        {target.packageSubmission.enabled && !target.packageSubmission.submitting && !target.packageSubmission.completed && <>
          <p className="ns-quiet-note">Submission enabled. Requires a compatible GateSSH package that differs from the currently deployed release.</p>
          <label className="node-field">
            <span>AVAILABLE</span>
            <select className="node-input" aria-label="Rollback package" value={selectedPackageId} onChange={(event) => onSelectPackage(event.target.value)}>
              <option value="">{target.packageSubmission.candidates.length ? 'Select local package' : 'None'}</option>
              {target.packageSubmission.candidates.map((file) => <option key={file.id} value={file.id}>{file.label} · {file.path}</option>)}
            </select>
          </label>
          {target.packageSubmission.candidates.length > 0 && <button type="button" className="node-action" onClick={onSubmitPackage}>SUBMIT PACKAGE</button>}
        </>}

        {target.packageSubmission.submitting && target.stage !== 'submitting' && <Progress percent={target.packageSubmission.submitPercent ?? 0} label="Submission progress" />}
        {target.packageSubmission.completed && <p className="ns-package-outcome">
          <span className="node-chip">ACCEPTED</span>
          <span>REBOOT REQUIRED</span>
        </p>}
      </div>
    </>}
  </div>
}
