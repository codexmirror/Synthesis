import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { BASIC_CREDENTIAL_TOOLKIT_ID } from '../../core/game/credentialAccess'
import { isValidIpv4 } from '../../core/game/networkTarget'
import {
  resolveNodeScanRelease,
  selectKnownSpace,
  selectTarget,
  type KnownSpace,
  type NodeScanRelease,
  type PlayerInformation,
  type Target,
  type TargetRoute,
  type TargetService,
  type TargetStage,
  type TargetSummary,
} from './targetProjection'

/**
 * NodeScan has two screens and three player actions.
 *
 * KNOWN SPACE shows the remembered shape of the world around the player:
 * Networks they have observed, SELF's own place in them, and the targets that
 * belong to each. That relationship scaffold is presentation only — a Network
 * is not openable, nothing expands, and tapping a target opens its card
 * directly. It exists so the player can see where they are, not so they have
 * to navigate through it.
 *
 * A target card is one target's whole line of action: SCAN, optional INSPECT,
 * ANALYZE, BYPASS, then CONNECT. The card states
 * one thing at a time, because at any moment there is one thing the player is
 * waiting on or deciding.
 *
 * The technical world underneath is unchanged and stays reachable: Services,
 * observed implementations, weakness identities, the tool a route uses and
 * RackUpdate's rollback avenue all live under RECON INTELLIGENCE. Opening that
 * disclosure browses remembered information; it never observes.
 *
 * Every rendered fact comes from the view models in `targetProjection.ts`,
 * which read player information only.
 */
type Focus = { readonly kind: 'targets' } | { readonly kind: 'target'; readonly deviceId: string }

type CopyState = { value: string; status: 'copied' | 'failed' } | null

const STAGE_MARK: Record<TargetStage, string> = {
  unscanned: 'NOT SCANNED',
  inspect: 'INSPECT AVAILABLE',
  analysis_ready: 'SERVICES FOUND',
  analyzing: 'ANALYZING',
  no_route: 'NO WAY IN',
  route: 'WAY IN FOUND',
  hacking: 'HACKING',
  access: 'ACCESS',
  connected: 'CONNECTED',
}

function locationOf(target: Pick<TargetSummary, 'networkNames' | 'scope'>): string {
  return target.networkNames.length ? target.networkNames.join(' · ') : target.scope === 'unknown' ? 'Membership not observed' : target.scope === 'lan' ? 'Local network' : 'Remote'
}

function kindOf(target: Target): string {
  if (target.observed) return target.observed.deviceKind.toUpperCase()
  return target.servicesObserved ? 'TARGET' : 'UNKNOWN TARGET'
}

export function Network() {
  const gameState = useGameState()
  const actions = useGameActions()
  const release = resolveNodeScanRelease(gameState.player.localDevice)
  const [focus, setFocus] = useState<Focus>({ kind: 'targets' })
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [directAddress, setDirectAddress] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const pendingRef = useRef<string | null>(null)
  const requestGeneration = useRef(0)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { requestGeneration.current++; clearTimeout(copyTimer.current) }, [])

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
    return true
  }
  /** A result that arrives after the player moved on is no longer their answer. */
  function invalidateRequests() {
    requestGeneration.current++
    pendingRef.current = null
    setPending(null)
    setNotice(null)
  }
  function open(next: Focus) {
    invalidateRequests()
    setFocus(next)
  }

  async function findTargets() {
    const generation = beginRequest('targets')
    if (generation === null) return
    try {
      const result = await actions.findTargets()
      if (!finishRequest('targets', generation)) return
      if (result.status !== 'observed') setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : 'NO RESPONSE')
      else if (result.targetsKnown === 0) setNotice('NOTHING FOUND')
    } catch { finishRequest('targets', generation) }
  }

  async function scanSelf() {
    const generation = beginRequest('self')
    if (generation === null) return
    try {
      const result = await actions.scanTarget(gameState.player.localDevice.network.ip)
      if (!finishRequest('self', generation)) return
      if (result.status !== 'device') setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : 'NO RESPONSE')
    } catch { finishRequest('self', generation) }
  }

  async function pingDirectAddress() {
    const address = directAddress.trim()
    if (!isValidIpv4(address)) {
      setNotice('INVALID ADDRESS')
      return
    }
    const generation = beginRequest('direct-address')
    if (generation === null) return
    try {
      const result = actions.pingTarget(address)
      if (!finishRequest('direct-address', generation)) return
      setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED'
        : result.status === 'no_response' ? 'NO RESPONSE'
          : result.status === 'device' ? null
            : 'INVALID ADDRESS')
    } catch { finishRequest('direct-address', generation) }
  }

  async function scan(target: Target) {
    const generation = beginRequest(target.id)
    if (generation === null) return
    try {
      const result = await actions.scanTarget(target.address)
      if (!finishRequest(target.id, generation)) return
      if (result.status !== 'device' || result.targetId !== target.id) setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : result.status === 'no_response' ? 'NO RESPONSE' : 'UNKNOWN TARGET')
    } catch { finishRequest(target.id, generation) }
  }

  function inspect(target: Target) {
    const result = actions.inspectTarget(target.address)
    setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED'
      : result.status === 'capability_unavailable' ? 'INSPECT UNAVAILABLE'
        : result.status === 'no_response' ? 'NO RESPONSE'
          : result.status === 'unknown_target' ? 'UNKNOWN TARGET' : null)
  }

  function hack(route: TargetRoute, targetDeviceId: string) {
    const result = actions.startCredentialAccessAttemptFromObservation({
      endpoint: route.endpoint, targetDeviceId, serviceId: route.serviceId,
      vulnerabilityId: route.vulnerabilityId, toolId: BASIC_CREDENTIAL_TOOLKIT_ID,
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

  function submitPackage(target: Target) {
    const rollback = target.rollback
    if (!rollback) return
    const result = actions.submitRackUpdatePackageFromObservation({ targetDeviceId: target.id, serviceId: rollback.serviceId, endpoint: rollback.endpoint, localFileId: selectedPackageId })
    setNotice(result.status === 'applied' ? 'PACKAGE APPLIED'
      : result.status === 'observation_required' ? 'OBSERVATION REQUIRED'
        : result.status === 'package_unavailable' ? 'PACKAGE UNAVAILABLE'
          : result.status === 'package_rejected' ? 'PACKAGE REJECTED'
            : 'PACKAGE NOT APPLIED')
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

  // Narrowed at the boundary: every screen is built from player information only.
  const information: PlayerInformation = gameState

  if (focus.kind === 'target') {
    const target = selectTarget(information, focus.deviceId)
    if (target) return <section className="app-content scan-app" aria-label="NodeScan">
      <TargetCard
        target={target}
        release={release}
        pending={pending === target.id}
        notice={notice}
        copyState={copyState}
        selectedPackageId={selectedPackageId}
        onBack={() => open({ kind: 'targets' })}
        onScan={() => scan(target)}
        onInspect={() => inspect(target)}
        onHack={(route) => hack(route, target.id)}
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
      space={selectKnownSpace(information)}
      release={release}
      pending={pending === 'targets'}
      directPending={pending === 'direct-address'}
      directAddress={directAddress}
      notice={notice}
      onFind={findTargets}
      onScanSelf={scanSelf}
      onDirectAddressChange={setDirectAddress}
      onDirectScan={pingDirectAddress}
      onOpen={(deviceId) => open({ kind: 'target', deviceId })}
    />
  </section>
}

function KnownSpaceView({ space, release, pending, directPending, directAddress, notice, onFind, onScanSelf, onDirectAddressChange, onDirectScan, onOpen }: {
  space: KnownSpace
  release: NodeScanRelease
  pending: boolean
  directPending: boolean
  directAddress: string
  notice: string | null
  onFind(): void
  onScanSelf(): void
  onDirectAddressChange(value: string): void
  onDirectScan(): void
  onOpen(deviceId: string): void
}) {
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
        <button type="submit" aria-label="Ping target address" disabled={directPending}>PING</button>
      </div>
    </form>

    <div className="ns-space">
        {!space.networks.some(({ includesSelf }) => includesSelf) && <section className="ns-group" aria-label="Self">
          <button type="button" className="ns-node ns-node--self ns-self-scan" aria-label="SCAN SELF" onClick={onScanSelf} disabled={pending}><span className="ns-target-copy"><strong>SELF</strong><span className="ns-target-note">{space.self.address}</span></span><span className="ns-target-mark">NOT SCANNED</span><span className="ns-self-action">SCAN</span></button>
        </section>}
        {space.networks.map((network) => <section className="ns-group" key={network.id} aria-label={`Network ${network.name}`}>
          <header className="ns-group-head">
            <span className="ns-eyebrow">NETWORK</span>
            <strong>{network.name}</strong>
          </header>
          {(network.includesSelf || network.targets.length > 0) && <div className="ns-branch">
            {/* SELF is the player's own position in the topology, never a target. */}
            {network.includesSelf && <div className="ns-limb">
              <div className="ns-node ns-node--self">
                <span className="ns-target-copy"><strong>SELF</strong><span className="ns-target-note">{space.self.address}</span></span>
              </div>
            </div>}
            {network.targets.map((target) => <div className="ns-limb" key={target.id}>
              <TargetRow target={target} onOpen={onOpen} />
            </div>)}
          </div>}
          {!network.membersObserved
            ? <p className="ns-group-note">Members not observed</p>
            : network.targets.length === 0 && <p className="ns-group-note">{network.includesSelf ? 'No other devices responded' : 'No devices responded'}</p>}
        </section>)}

        {space.elsewhere.length > 0 && <section className="ns-group" aria-label="Elsewhere">
          <header className="ns-group-head"><span className="ns-eyebrow">ELSEWHERE</span></header>
          <div className="ns-loose">{space.elsewhere.map((target) => <TargetRow key={target.id} target={target} onOpen={onOpen} showLocation />)}</div>
        </section>}
      </div>

    {space.networks.length > 0 && <div className="ns-primary-slot">
      <button type="button" className="ns-primary" disabled={pending} onClick={onFind}>SCAN AGAIN</button>
      <p className="ns-primary-note">Look for devices on known Networks.</p>
    </div>}
    {notice && <p className="node-note node-note--caution" role="status">{notice}</p>}
  </div>
}

function TargetRow({ target, showLocation, onOpen }: { target: TargetSummary; showLocation?: boolean; onOpen(deviceId: string): void }) {
  return <button
    type="button"
    className="ns-node ns-target"
    aria-label={`Open target ${target.address}`}
    onClick={() => onOpen(target.id)}
  >
    <span className="ns-target-copy">
      <strong>{target.address}</strong>
      {showLocation && <span className="ns-target-note">{locationOf(target)}</span>}
    </span>
    <span className={`ns-target-mark ns-target-mark--${target.stage}`}>{STAGE_MARK[target.stage]}</span>
    <span className="ns-arrow" aria-hidden="true">›</span>
  </button>
}

/**
 * One target, one decision. The stage panel states where this target's line of
 * action currently is and offers the single action that continues it.
 */
function TargetCard({ target, release, pending, notice, copyState, selectedPackageId, onBack, onScan, onInspect, onHack, onConnect, onDisconnect, onAnalyze, onAnalyzeAll, onCopy, onSelectPackage, onSubmitPackage }: {
  target: Target
  release: NodeScanRelease
  pending: boolean
  notice: string | null
  copyState: CopyState
  selectedPackageId: string
  onBack(): void
  onScan(): void
  onInspect(): void
  onHack(route: TargetRoute): void
  onConnect(): void
  onDisconnect(): void
  onAnalyze(service: TargetService): void
  onAnalyzeAll(): void
  onCopy(value: string): void
  onSelectPackage(fileId: string): void
  onSubmitPackage(): void
}) {
  const routes = target.routes.length
  return <div className="ns-view">
    <nav className="scan-crumbs" aria-label="NodeScan navigation">
      <button type="button" onClick={onBack}>← Known Space</button>
      <span aria-hidden="true">/</span>
      <strong>{target.address}</strong>
    </nav>

    <header className="ns-subject">
      <span className="ns-eyebrow">{kindOf(target)}</span>
      <h2>{target.address}</h2>
      <p className="ns-subject-note">{locationOf(target)}</p>
    </header>

    <section className="ns-stage" aria-label="Target status">
      {target.stage === 'unscanned' && <>
        <strong className="ns-stage-headline">NOT SCANNED</strong>
        <span className="ns-stage-note">Nothing is known about this target yet.</span>
        <Primary label="SCAN" disabled={pending} onClick={onScan} />
      </>}

      {target.stage === 'inspect' && <>
        <strong className="ns-stage-headline">SERVICES FOUND</strong>
        <span className="ns-stage-note">Inspect can reveal deeper evidence about this target.</span>
        <Primary label="INSPECT" onClick={onInspect} />
      </>}

      {target.stage === 'analysis_ready' && <>
        <strong className="ns-stage-headline">SERVICES FOUND</strong>
        <span className="ns-stage-note">The observed attack surface is ready to investigate.</span>
        <Primary label="ANALYZE" onClick={onAnalyzeAll} />
      </>}

      {target.stage === 'analyzing' && <>
        <strong className="ns-stage-headline">ANALYZING</strong>
        <Progress percent={target.percent} label="Analysis progress" />
      </>}

      {target.stage === 'no_route' && <>
        <strong className="ns-stage-headline">NO WAY IN FOUND</strong>
        <span className="ns-stage-note">Nothing you currently know opens this target.</span>
        <Primary label="SCAN AGAIN" disabled={pending} onClick={onScan} />
      </>}

      {target.stage === 'route' && <>
        <strong className="ns-stage-headline">{routes} WAY{routes === 1 ? '' : 'S'} IN FOUND</strong>
        {target.lastAttemptFailed && <span className="ns-stage-note">The last attempt failed.</span>}
        <Primary label={target.lastAttemptFailed ? 'BYPASS AGAIN' : 'BYPASS'} onClick={() => onHack(target.routes[0])} />
      </>}

      {target.stage === 'hacking' && <>
        <strong className="ns-stage-headline">HACKING</strong>
        <Progress percent={target.percent} label="Hack progress" />
      </>}

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
    </section>
    {notice && <p className="node-note node-note--caution" role="status">{notice}</p>}

    <details className="ns-details">
      <summary>RECON INTELLIGENCE</summary>
      <TechnicalDetails
        target={target}
        release={release}
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
function TechnicalDetails({ target, release, copyState, selectedPackageId, onInspect, onAnalyze, onCopy, onSelectPackage, onSubmitPackage }: {
  target: Target
  release: NodeScanRelease
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
        <div><dt>TYPE</dt><dd>{target.observed.deviceKind.toUpperCase()}</dd></div>
        <div><dt>STATUS</dt><dd>{target.observed.networkStatus}</dd></div>
        {target.observed.firmware && <div><dt>FIRMWARE</dt><dd>{target.observed.firmware}</dd></div>}
        {target.observed.computeClass && <div><dt>COMPUTE</dt><dd>{target.observed.computeClass}</dd></div>}
      </dl>
      : <div className="node-empty"><strong>NOT OBSERVED</strong><span>No properties of this target have been observed.</span></div>}
    {target.observed && !release.canInspect && <p className="node-note">Remembered from an earlier observation. The installed NodeScan release does not supply Inspect.</p>}
    {release.canInspect && <button type="button" className="node-action" onClick={onInspect}>INSPECT</button>}

    {(target.access || target.session) && <>
      <div className="node-section"><span>ACCESS</span></div>
      <dl className="node-facts">
        <div><dt>PRIVILEGE</dt><dd>{(target.session ?? target.access)!.privilege}</dd></div>
        {(target.session ?? target.access)!.viaServiceName && <div><dt>VIA</dt><dd>{(target.session ?? target.access)!.viaServiceName}</dd></div>}
        {target.session && <div><dt>SESSION</dt><dd>ACTIVE</dd></div>}
      </dl>
    </>}

    {target.routes.length > 0 && <>
      <div className="node-section"><span>WAYS IN</span><span>{target.routes.length}</span></div>
      <div className="ns-routes">{target.routes.map((route) => <article className="ns-route" key={`${route.serviceId}-${route.vulnerabilityId}`}>
        <dl className="node-facts">
          <div><dt>METHOD</dt><dd>Credential attack</dd></div>
          <div><dt>TOOL</dt><dd>{route.toolName}</dd></div>
          <div><dt>SERVICE</dt><dd>{route.serviceName}</dd></div>
          {route.implementation && <div><dt>SOFTWARE</dt><dd>{route.implementation}</dd></div>}
          <div><dt>WEAKNESS</dt><dd>{route.vulnerabilityLabel} · {route.vulnerabilityId}</dd></div>
        </dl>
      </article>)}</div>
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
          {service.analysisPercent !== undefined
            ? <Progress percent={service.analysisPercent} label={`${service.name} analysis progress`} />
            : <button type="button" className="node-action" aria-label={`Analyze ${service.name}`} onClick={() => onAnalyze(service)}>ANALYZE</button>}
        </article>)}</div>}

    {target.rollback && <>
      <div className="node-section"><span>PACKAGE ROLLBACK</span></div>
      <div className="ns-rollback">
        <p className="ns-quiet-note">{target.rollback.serviceName} accepts submitted packages and does not enforce rollback protection. Requires an older compatible GateSSH package.</p>
        <label className="node-field">
          <span>AVAILABLE</span>
          <select className="node-input" aria-label="Rollback package" value={selectedPackageId} onChange={(event) => onSelectPackage(event.target.value)}>
            <option value="">{target.rollback.candidates.length ? 'Select local package' : 'None'}</option>
            {target.rollback.candidates.map((file) => <option key={file.id} value={file.id}>{file.label} · {file.path}</option>)}
          </select>
        </label>
        {target.rollback.candidates.length > 0 && <button type="button" className="node-action" onClick={onSubmitPackage}>APPLY PACKAGE</button>}
      </div>
    </>}
  </div>
}
