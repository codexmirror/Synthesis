import './network.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { BASIC_CREDENTIAL_TOOLKIT_ID } from '../../core/game/credentialAccess'
import {
  resolveNodeScanRelease,
  selectTarget,
  selectTargets,
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
 * TARGETS lists what the player legitimately knows about. A target card is
 * one target's whole line of action: SCAN to find out about it, HACK to use
 * what was found, CONNECT once access exists. The card states one thing at a
 * time, because at any moment there is one thing the player is waiting on or
 * deciding.
 *
 * The technical world underneath is unchanged and stays reachable: Services,
 * observed implementations, weakness identities, the tool a route uses and
 * RackUpdate's rollback avenue all live under TECHNICAL DETAILS. Opening that
 * disclosure browses remembered information; it never observes.
 *
 * Every rendered fact comes from the view models in `targetProjection.ts`,
 * which read player information only.
 */
type Focus = { readonly kind: 'targets' } | { readonly kind: 'target'; readonly deviceId: string }

type CopyState = { value: string; status: 'copied' | 'failed' } | null

const STAGE_MARK: Record<TargetStage, string> = {
  unscanned: 'NOT SCANNED',
  scanning: 'SCANNING',
  no_route: 'NO WAY IN',
  route: 'WAY IN FOUND',
  hacking: 'HACKING',
  access: 'ACCESS',
  connected: 'CONNECTED',
}

function locationOf(target: Pick<TargetSummary, 'networkNames' | 'scope'>): string {
  return target.networkNames.length ? target.networkNames.join(' · ') : target.scope === 'lan' ? 'Local network' : 'Remote'
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

  async function scan(target: Target) {
    const generation = beginRequest(target.id)
    if (generation === null) return
    try {
      const result = await actions.sweepTarget({ targetDeviceId: target.id, address: target.address })
      if (!finishRequest(target.id, generation)) return
      if (result.status !== 'observed') {
        setNotice(result.status === 'software_unavailable' ? 'NODESCAN NOT INSTALLED' : result.status === 'no_response' ? 'NO RESPONSE' : 'UNKNOWN TARGET')
      } else if (result.insufficientMemory && result.analysesStarted === 0) setNotice('NOT ENOUGH MEMORY')
    } catch { finishRequest(target.id, generation) }
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
        onHack={(route) => hack(route, target.id)}
        onConnect={() => connect(target)}
        onDisconnect={() => { actions.disconnectRemoteSession(); setNotice(null) }}
        onAnalyze={(service) => analyze(target, service)}
        onCopy={copy}
        onSelectPackage={setSelectedPackageId}
        onSubmitPackage={() => submitPackage(target)}
      />
    </section>
  }

  return <section className="app-content scan-app" aria-label="NodeScan">
    <TargetList
      targets={selectTargets(information)}
      release={release}
      pending={pending === 'targets'}
      notice={notice}
      onFind={findTargets}
      onOpen={(deviceId) => open({ kind: 'target', deviceId })}
    />
  </section>
}

function TargetList({ targets, release, pending, notice, onFind, onOpen }: {
  targets: readonly TargetSummary[]
  release: NodeScanRelease
  pending: boolean
  notice: string | null
  onFind(): void
  onOpen(deviceId: string): void
}) {
  return <div className="ns-view">
    <header className="ns-masthead">
      <div><span className="ns-eyebrow">{release.name.toUpperCase()}</span><h2>TARGETS</h2></div>
      <span className="ns-release">{release.version}{release.channel ? ` ${release.channel.toUpperCase()}` : ''}</span>
    </header>

    {targets.length > 0
      ? <div className="ns-targets">{targets.map((target) => <button
        type="button"
        className="ns-target"
        key={target.id}
        aria-label={`Open target ${target.address}`}
        onClick={() => onOpen(target.id)}
      >
        <span className="ns-target-copy">
          <strong>{target.address}</strong>
          <span className="ns-target-note">{locationOf(target)}</span>
        </span>
        <span className={`ns-target-mark ns-target-mark--${target.stage}`}>{STAGE_MARK[target.stage]}</span>
        <span className="ns-arrow" aria-hidden="true">›</span>
      </button>)}</div>
      : <div className="node-empty"><strong>NO TARGETS YET</strong><span>Nothing has been found around this Device yet.</span></div>}

    <div className="ns-primary-slot">
      <button type="button" className="ns-primary" disabled={pending} onClick={onFind}>{targets.length ? 'SCAN AGAIN' : 'SCAN'}</button>
      <p className="ns-primary-note">Look for devices around you.</p>
    </div>
    {notice && <p className="node-note node-note--caution" role="status">{notice}</p>}
  </div>
}

/**
 * One target, one decision. The stage panel states where this target's line of
 * action currently is and offers the single action that continues it.
 */
function TargetCard({ target, release, pending, notice, copyState, selectedPackageId, onBack, onScan, onHack, onConnect, onDisconnect, onAnalyze, onCopy, onSelectPackage, onSubmitPackage }: {
  target: Target
  release: NodeScanRelease
  pending: boolean
  notice: string | null
  copyState: CopyState
  selectedPackageId: string
  onBack(): void
  onScan(): void
  onHack(route: TargetRoute): void
  onConnect(): void
  onDisconnect(): void
  onAnalyze(service: TargetService): void
  onCopy(value: string): void
  onSelectPackage(fileId: string): void
  onSubmitPackage(): void
}) {
  const routes = target.routes.length
  return <div className="ns-view">
    <nav className="scan-crumbs" aria-label="NodeScan navigation">
      <button type="button" onClick={onBack}>← Targets</button>
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

      {target.stage === 'scanning' && <>
        <strong className="ns-stage-headline">SCANNING</strong>
        <Progress percent={target.percent} label="Scan progress" />
      </>}

      {target.stage === 'no_route' && <>
        <strong className="ns-stage-headline">NO WAY IN FOUND</strong>
        <span className="ns-stage-note">Nothing you currently know opens this target.</span>
        <Primary label="SCAN AGAIN" disabled={pending} onClick={onScan} />
      </>}

      {target.stage === 'route' && <>
        <strong className="ns-stage-headline">{routes} WAY{routes === 1 ? '' : 'S'} IN FOUND</strong>
        {target.lastAttemptFailed && <span className="ns-stage-note">The last attempt failed.</span>}
        <Primary label={target.lastAttemptFailed ? 'HACK AGAIN' : 'HACK'} onClick={() => onHack(target.routes[0])} />
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
      <summary>TECHNICAL DETAILS</summary>
      <TechnicalDetails
        target={target}
        release={release}
        copyState={copyState}
        selectedPackageId={selectedPackageId}
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
function TechnicalDetails({ target, release, copyState, selectedPackageId, onAnalyze, onCopy, onSelectPackage, onSubmitPackage }: {
  target: Target
  release: NodeScanRelease
  copyState: CopyState
  selectedPackageId: string
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
          {service.weaknesses.map((weakness) => <p className="ns-weakness" key={weakness.id}><strong>{weakness.label}</strong><span>{weakness.id}</span></p>)}
          {service.accessPrivilege && <p className="ns-quiet-note">{service.accessPrivilege} access was established through this service.</p>}
          {service.analysisPercent !== undefined
            ? <Progress percent={service.analysisPercent} label={`${service.name} analysis progress`} />
            : <button type="button" className="node-action" aria-label={`Analyze ${service.name}`} onClick={() => onAnalyze(service)}>ANALYZE</button>}
          {service.analysisPercent === undefined && service.analysisOutcome === 'no_weakness_detected' && <p className="ns-quiet-note">Last analysis found no weakness.</p>}
          {service.analysisPercent === undefined && service.analysisOutcome === 'service_unavailable' && <p className="ns-quiet-note">Last analysis did not complete against the service.</p>}
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
