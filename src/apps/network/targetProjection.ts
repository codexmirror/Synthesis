import { formatByteProgress } from '../byteFormat'
import { findInstalledNodeScan, nodeScanSupportsInspect, nodeScanSupportsIntegratedIntelligence, nodeScanSupportsLiveTopology } from '../../core/game/software'
import { isDeviceNetworkUsable } from '../../core/game/deviceOperationalState'
import { FLIPPER_MODULE_NAME, FLIPPER_MODULE_TECHNIQUE, ROLLBACK_MODULE_1_0, findInstalledFlipper, findLocalFlipperModuleArtifacts, findLocalTechniqueTool, flipperSupportsTechnique, isSupportedFlipperModuleArtifact } from '../../core/game/flipper'
import type {
  CredentialAccessFailureReason,
  CredentialAccessProcess,
  GameState,
  GameProcess,
  LocalDeviceState,
  RackUpdateExploitProcess,
  RackUpdatePackageSubmission,
  ServiceAnalysisProcess,
} from '../../core/game/types'
import {
  STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID,
  keyProbeProfileForImplementation,
  keyProbeProfileForObservedImplementation,
  keyProbeSuccessChance,
  ownedCredentialAccessModuleProviders,
  ownsKeyProbe,
  type CredentialAccessProviderId,
  type ServiceImplementationIdentity,
} from '../../core/game/credentialAccess'
import { DEAUTH_EXTENSION, findCompatibleDeauthExtension } from '../../core/game/deauth'
import type { DeauthProcess } from '../../core/game/types'

/**
 * NodeScan presents one target at a time as a single decision, not as a
 * dashboard of the subsystems that decision touches. Every reconnaissance
 * historical fact the interface renders is derived here, from this deliberately narrow
 * player-information slice: remembered Discovery, earned Knowledge, the
 * player's own Processes, the player's own installed software and the
 * player's current relationships. Hidden Device names, unobserved Service implementations,
 * unobserved authentication conditions, vulnerability presence and attack
 * feasibility cannot reach the interface even by accident. The separate
 * `LiveTopologyTruth` input admits only operational state and Service openness,
 * and only while NodeScan monitoring or usable exact-Service access supplies
 * current observation authority. A remembered
 * Device's display name is here only because a legitimate Inspect stored it
 * in Discovery, never because presentation resolved it.
 *
 * The one thing NodeScan renders that is *not* derived from this slice is a
 * managed Network's own canonical facts, which come from the separate
 * management-authority projection and are composed beside this one by the
 * application. That composition is deliberate and explicit: authority is not
 * allowed to fill in observation, so nothing here consults it.
 */
export type PlayerInformation = Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'process' | 'deviceAccess' | 'remoteSession' | 'rackUpdate'>
export type LiveTopologyTruth = Pick<GameState, 'world'>

/** Currently installed NodeScan release and the capability it actually supplies. */
export interface NodeScanRelease {
  readonly name: string
  readonly version: string
  readonly channel?: string
  /**
   * Derived from canonical installed-software capability logic, never from a
   * version-number comparison. It stays true while a removal Process is still
   * running, because the override release remains installed until completion.
   */
  readonly canInspect: boolean
  readonly canMonitorLiveTopology: boolean
  readonly canIntegrateIntelligence: boolean
}

export function resolveNodeScanRelease(device: LocalDeviceState): NodeScanRelease | undefined {
  const installation = findInstalledNodeScan(device)
  if (!installation) return undefined
  return {
    name: installation.name,
    version: installation.version,
    channel: installation.channel,
    canInspect: nodeScanSupportsInspect(installation),
    canMonitorLiveTopology: nodeScanSupportsLiveTopology(installation),
    canIntegrateIntelligence: nodeScanSupportsIntegratedIntelligence(installation),
  }
}

export interface KnownWeakness {
  /** Player-facing technique identity, e.g. `AUTH-017`. */
  readonly id: string
  readonly label: string
}

/**
 * The one player-facing state of a target's current line of action. It is a
 * presentation ordering over independent canonical concerns — Discovery,
 * Knowledge, Process, DeviceAccess, RemoteSession — and never a canonical
 * "hacked" flag. Each stage is derived fresh; none of them is stored.
 */
export type TargetStage =
  | 'unscanned'
  | 'analysis_ready'
  | 'analyzing'
  | 'no_route'
  | 'route'
  | 'hacking'
  | 'disrupting'
  | 'attack'
  | 'attacking'
  | 'submission_ready'
  | 'submitting'
  | 'access'
  | 'connected'

/**
 * A way in the player can legitimately attempt right now: something they have
 * learned about this target, that a tool they actually have installed
 * supports. It states what the player knows and owns. It never predicts
 * whether the attempt will succeed, and it is never derived from hidden
 * current World Truth.
 */
export interface TargetRoute {
  readonly serviceId: string
  readonly serviceName: string
  readonly endpoint: string
  readonly vulnerabilityId: string
  readonly vulnerabilityLabel: string
  readonly toolName: string
  /** The concrete integrated Flipper module that supports this technique, where one is represented. */
  readonly moduleName?: string
  /** Remembered implementation fingerprint, where a legitimate Inspect stored one. */
  readonly implementation?: string
}

/**
 * KeyProbe's own way in: a legitimately known, supported GateSSH
 * authentication surface, formed entirely independently of any named
 * Vulnerability or Knowledge. It states what the player has observed and
 * owns, exactly like `TargetRoute`, and never predicts success.
 */
export interface KeyProbeRoute {
  readonly serviceId: string
  readonly serviceName: string
  readonly endpoint: string
  /** The concrete implementation identity a legitimate Inspect observed, matched against an authored KeyProbe profile. */
  readonly serviceImplementation: ServiceImplementationIdentity
  /** Remembered display fingerprint, e.g. "GateSSH 1.3.3". */
  readonly implementation: string
}

export type AnalysisOutcome = 'weaknesses_detected' | 'no_weakness_detected' | 'service_unavailable'

export interface TargetService {
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly endpoint: string
  /** Concrete Service-relevant software from remembered observation only. */
  readonly software: readonly string[]
  readonly observed?: { readonly implementation: string; readonly authentication?: string; readonly interface?: string }
  readonly weaknesses: readonly KnownWeakness[]
  readonly analysisPercent?: number
  /** Retained, disposable Process history — never permanent Knowledge. */
  readonly analysisOutcome?: AnalysisOutcome
  /** Whether the latest remembered evidence still justifies a canonical Analyze attempt. */
  readonly analysisRequired: boolean
  readonly accessPrivilege?: 'USER'
  readonly liveStatus?: TopologyStatus
  readonly intelligence: readonly SoftwareIntelligence[]
}

export interface TopologyStatus { readonly label: 'ONLINE' | 'OFFLINE' | 'SHUTTING DOWN' | 'BOOTING' | 'RECONNECTING' | 'CLOSED'; readonly tone: 'available' | 'transition' | 'down' }
export interface SoftwareIntelligence { readonly software: string; readonly details: readonly string[] }

export interface LocalPackage {
  readonly id: string
  readonly path: string
  readonly label: string
}

/**
 * A legitimate ATTACK opportunity against RackUpdate's own package-submission
 * interface: earned `UPD-001` Knowledge, plus an installed tool that actually
 * supports it. Exactly like a Credential `TargetRoute`, this never predicts
 * success and is never derived from hidden current World Truth.
 */
export interface PackageSubmissionRoute {
  readonly vulnerabilityId: string
  readonly vulnerabilityLabel: string
  readonly toolName: string
  /** The concrete integrated Flipper module that supports this technique, where one is represented. */
  readonly moduleName?: string
}

/**
 * RackUpdate's package-submission lifecycle: an ATTACK opportunity while
 * `enabled` is false, finite ATTACK progress while `attacking`, the narrow
 * submission capability plus candidate packages once `enabled`, and finite
 * upload progress while `submitting`. Successful ATTACK never implies
 * DeviceAccess or a RemoteSession — only this one Service's own submission
 * interface.
 */
export interface PackageSubmission {
  readonly serviceId: string
  readonly serviceName: string
  readonly endpoint: string
  readonly enabled: boolean
  readonly route?: PackageSubmissionRoute
  readonly attacking: boolean
  readonly attackPercent?: number
  readonly lastAttackFailed: boolean
  readonly candidates: readonly LocalPackage[]
  readonly submitting: boolean
  readonly submitPercent?: number
  readonly completed: boolean
}

/**
 * One Network root of Known Space: the player's own managed Networks and the
 * Networks reconnaissance remembers, in one tree.
 *
 * `managed` says only that the local Device holds explicit
 * `NetworkManagementAuthority` over it, which is what makes its
 * administration route legitimate. It never enlarges what the tree may show:
 * the Device children below always come from remembered Discovery alone, so
 * a managed Network the player has never Scanned states that its members are
 * unobserved instead of listing them.
 */
export interface KnownNetwork {
  readonly id: string
  readonly name: string
  readonly membersObserved: boolean
  /** Whether the local Device currently holds explicit management authority over this Network. */
  readonly managed: boolean
  /** Whether the player legitimately remembers SELF as a member of this Network. */
  readonly includesSelf: boolean
  readonly targets: readonly TargetSummary[]
}

/**
 * The identity a managed Network's own authority legitimately supplies.
 * Passed in by the caller rather than resolved here, so the reconnaissance
 * projection below keeps reading player information only.
 */
export interface ManagedNetworkIdentity {
  readonly id: string
  readonly name: string
}

export interface KnownSpace {
  readonly self: { readonly address: string }
  readonly networks: readonly KnownNetwork[]
  /** Remembered Devices with no remembered relationship to a known Network. */
  readonly elsewhere: readonly TargetSummary[]
  /**
   * Whether reconnaissance actually remembers a Network. A managed Network
   * root is authority, not memory, so it never by itself makes the
   * observation shortcut over remembered Networks meaningful.
   */
  readonly remembersNetwork: boolean
}

export interface TargetSummary {
  readonly id: string
  readonly address: string
  readonly scope: 'unknown' | 'lan' | 'remote'
  readonly networkNames: readonly string[]
  readonly stage: TargetStage
  /**
   * The Device's represented display identity, present only once a legitimate
   * Inspect observed and remembered it. Until then a remote Device is an
   * address, never its hidden canonical name.
   */
  readonly displayName?: string
  readonly servicesObserved: boolean
}

export interface Target extends TargetSummary {
  /** Canonical progress of the work the current stage is waiting on, 0 when nothing runs. */
  readonly percent: number
  /** The work currently running against this target, present exactly while the stage is a running stage. */
  readonly operation?: TargetOperation
  readonly routes: readonly TargetRoute[]
  /** Concrete owned providers, projected independently of target weaknesses. Credential Access's own recent-attempt feedback lives on its own entry. */
  readonly offensiveActions: readonly TargetOffensiveAction[]
  readonly observed?: {
    readonly deviceKind: 'device' | 'server'
    readonly networkStatus: 'ONLINE'
    readonly firmware?: string
    readonly computeClass?: string
  }
  readonly services: readonly TargetService[]
  readonly liveStatus?: TopologyStatus
  readonly access?: { readonly privilege: 'USER'; readonly viaServiceName?: string }
  readonly session?: { readonly privilege: 'USER'; readonly connectedAddress: string; readonly viaServiceName?: string }
  /**
   * RackUpdate's package-submission lifecycle, named only where remembered
   * Player Information justifies it. It remains distinct from Device access.
   */
  readonly packageSubmission?: PackageSubmission
}

/**
 * Credential Access's own player-facing read of a formed route — never World
 * Truth, and never a value for Rollback or DEAUTH.
 *
 * `estimate` is KeyProbe's own best guess from current Player Information: it
 * reuses the canonical profile/chance calculation over only the local
 * Device's current compute and a legitimately observed protection match, so
 * it can never be higher-fidelity than what the player actually knows.
 * `compatibility` is the specialized module's own deterministic technique
 * read instead of a fabricated percentage: `MATCHED` only when the currently
 * remembered implementation still names the exact surface the module
 * targets, `UNCONFIRMED` when a later legitimate observation named a
 * different one, and `EXPECTED` — the technique's ordinary default — when no
 * observation contradicts it either way.
 */
export type CredentialAccessAssessment =
  | { readonly kind: 'estimate'; readonly percent: number }
  | { readonly kind: 'compatibility'; readonly status: 'EXPECTED' | 'MATCHED' | 'UNCONFIRMED' }

export interface TargetOffensiveAction {
  readonly technique: 'Credential Access' | 'Rollback' | 'DEAUTH'
  readonly provider: string
  readonly providerId?: CredentialAccessProviderId
  readonly route?: TargetRoute | KeyProbeRoute | PackageSubmissionRoute | { readonly networkId: string; readonly networkName: string; readonly contextDeviceId: string }
  /** This Technique's own attempt is currently running against this target. */
  readonly running: boolean
  /** Credential Access only: this provider's own current read of the formed route. */
  readonly assessment?: CredentialAccessAssessment
  /**
   * Credential Access only: the outcome Credential Access itself recorded for
   * the most recent completed attempt this exact provider ran here, while
   * canonical Process history still remembers it. `undefined` reason means
   * the endpoint was never reached at all, so no more specific category
   * applies; this is presentation-level only and is never guessed from
   * hidden World Truth.
   */
  readonly lastFailureReason?: CredentialAccessFailureReason | 'unspecified'
}

/** One canonical or already-remembered fact the running operation itself supplies. */
export interface TargetOperationFact { readonly label: string; readonly value: string }

/**
 * The work currently running against this target, described from that work
 * itself rather than from what the player could start next.
 *
 * Every value here is either the running Process's or submission's own
 * canonical state — the endpoint it was actually started against, the
 * provider the canonical resolver actually selected, the bytes the
 * submission runtime has actually carried — or a label the player already
 * legitimately holds (a remembered weakness, a remembered fingerprint).
 * Nothing is read from World Truth, and nothing is invented to fill an
 * execution surface: this projects real state, it does not narrate it.
 */
export interface TargetOperation {
  readonly kind: 'service_analysis' | 'credential_access' | 'rack_update_exploit' | 'package_submission' | 'deauth'
  readonly title: string
  readonly percent: number
  readonly facts: readonly TargetOperationFact[]
}

function percentOf(process: { workCompleted: number; workRequired: number }): number {
  return Math.floor(process.workCompleted / process.workRequired * 100)
}

function isServiceAnalysis(process: GameProcess): process is ServiceAnalysisProcess { return process.kind === 'service_analysis' }
function isCredentialAccess(process: GameProcess): process is CredentialAccessProcess { return process.kind === 'credential_access' }
function isRackUpdateExploit(process: GameProcess): process is RackUpdateExploitProcess { return process.kind === 'rack_update_exploit' }
function isDeauth(process: GameProcess): process is DeauthProcess { return process.kind === 'deauth' }

/** Aggregate canonical progress of one kind of work currently running against one target. */
function runningPercent(processes: readonly { workCompleted: number; workRequired: number }[]): number {
  if (!processes.length) return 0
  const required = processes.reduce((sum, process) => sum + process.workRequired, 0)
  const completed = processes.reduce((sum, process) => sum + process.workCompleted, 0)
  return required ? Math.floor(completed / required * 100) : 0
}

/**
 * Service-scoped work is bound to the endpoint it was started against, so a
 * remembered Service row never adopts work aimed at a different endpoint of
 * the same stable Service identity.
 */
function serviceProcesses<T extends ServiceAnalysisProcess | CredentialAccessProcess | RackUpdateExploitProcess>(
  processes: readonly T[], targetDeviceId: string, serviceId: string, endpoint: string,
): readonly T[] {
  return processes.filter((process) => process.targetDeviceId === targetDeviceId && process.serviceId === serviceId && process.startedEndpoint === endpoint)
}

function accessFor(information: PlayerInformation, targetDeviceId: string) {
  return information.deviceAccess.established.filter((access) =>
    access.sourceDeviceId === information.player.localDevice.id && access.targetDeviceId === targetDeviceId)
}

function knowledgeFor(information: PlayerInformation, targetDeviceId: string, serviceId: string): readonly KnownWeakness[] {
  return information.knowledge.discoveredVulnerabilities
    .filter((item) => item.targetDeviceId === targetDeviceId && item.serviceId === serviceId)
    .map((item) => ({ id: item.vulnerabilityId, label: item.observedLabel }))
}

function networkNamesOf(information: PlayerInformation, deviceId: string): readonly string[] {
  return information.discovery.networkDeviceRelations
    .filter((relation) => relation.deviceId === deviceId)
    .flatMap((relation) => information.discovery.networks.filter((network) => network.id === relation.networkId).map(({ name }) => name))
}

function describeImplementation(observed?: { implementation: { name: string; version: string }; authentication?: string; interface?: string }) {
  return observed ? { implementation: `${observed.implementation.name} ${observed.implementation.version}`, ...(observed.authentication ? { authentication: observed.authentication } : {}), ...(observed.interface ? { interface: observed.interface } : {}) } : undefined
}

/**
 * The single stage the target's primary decision is currently in.
 *
 * Order is deliberate: a relationship the player already holds outranks work
 * in flight, which outranks what they could start, because the primary
 * surface answers "what can I do now" rather than "what is happening". Work
 * running against a target the player has already reached therefore does not
 * become the headline; the Activity Monitor remains its canonical home, and
 * per-Service investigation progress stays visible under technical depth.
 *
 * Inspect is deliberately not a stage. It is optional technical depth the
 * player chooses, not a step the ordinary SCAN → HACK → CONNECT line has to
 * pass through, so it never displaces the decision in front of them.
 *
 * Nothing here consults hidden World Truth, and `no_route` is a statement
 * about the player's own information, not about the target.
 */
function stageOf(input: {
  connected: boolean
  hasAccess: boolean
  hacking: boolean
  disrupting: boolean
  analyzing: boolean
  routes: number
  servicesObserved: boolean
  services: readonly TargetService[]
  packageSubmission?: PackageSubmission
}): TargetStage {
  if (input.connected) return 'connected'
  if (input.hacking) return 'hacking'
  if (input.disrupting) return 'disrupting'
  if (input.analyzing) return 'analyzing'
  if (input.packageSubmission?.attacking) return 'attacking'
  if (input.packageSubmission?.submitting) return 'submitting'
  if (!input.servicesObserved) return 'unscanned'
  if (input.hasAccess) return 'access'
  // Once a package is accepted, this Device-wide headline has nothing further
  // to say about the submission itself: the accepted/reboot-required outcome
  // is RackUpdate's own technical-context truth (see `PackageSubmission`),
  // not a new Target-wide stage. The player either still has another route or
  // has reached the end of what NodeScan currently forms for this target.
  if (input.packageSubmission?.enabled && !input.packageSubmission.completed) return 'submission_ready'
  if (input.packageSubmission?.route) return 'attack'
  if (input.routes > 0) return 'route'
  if (input.services.some((service) => service.analysisRequired)) return 'analysis_ready'
  return 'no_route'
}

/**
 * Known Space: one restrained relationship tree — Network → Device — over two
 * legitimately different sources composed side by side. A Device is a leaf:
 * it carries no Service children here, and opens straight into the existing
 * target card, where Service identity and every other technical fact already
 * live under TECHNICAL INTELLIGENCE.
 *
 * The Network roots are the Networks the local Device manages (supplied by
 * the caller from `NetworkManagementAuthority`) plus the Networks
 * reconnaissance remembers. Everything below a root comes from remembered
 * Discovery alone: SELF appears only where the player has legitimately
 * observed its own membership, a Device appears under every Network it is
 * remembered in, and one remembered in none of them stays visibly separate
 * rather than being filed under a Network it was never observed on.
 *
 * Authority is never allowed to fill in reconnaissance. A managed Network the
 * player has not Scanned states that its members are unobserved; it does not
 * enumerate them from World Truth.
 */
export function selectKnownSpace(information: PlayerInformation, managed: readonly ManagedNetworkIdentity[] = []): KnownSpace {
  const { discovery } = information
  const localDeviceId = information.player.localDevice.id
  const targets = new Map(selectTargets(information).map((target) => [target.id, target]))
  const managedIds = new Set(managed.map(({ id }) => id))
  const remembered = new Map(discovery.networks.map((network) => [network.id, network]))
  const knownNetworkIds = new Set([...remembered.keys(), ...managedIds])
  const related = new Set(discovery.networkDeviceRelations
    .filter(({ networkId }) => knownNetworkIds.has(networkId))
    .map(({ deviceId }) => deviceId))
  const membersOf = (networkId: string) => discovery.networkDeviceRelations.filter((relation) => relation.networkId === networkId)
  const root = (id: string, name: string, isManaged: boolean): KnownNetwork => ({
    id,
    name,
    membersObserved: remembered.get(id)?.membersObserved ?? false,
    managed: isManaged,
    includesSelf: membersOf(id).some(({ deviceId }) => deviceId === localDeviceId),
    targets: membersOf(id).flatMap(({ deviceId }) => {
      const target = deviceId === localDeviceId ? undefined : targets.get(deviceId)
      return target ? [target] : []
    }),
  })
  return {
    self: { address: information.player.localDevice.network.ip },
    networks: [
      // A managed Network's name is supplied by the authority that administers
      // it, which is why it can be stated before reconnaissance remembers it.
      ...managed.map(({ id, name }) => root(id, name, true)),
      ...discovery.networks.filter(({ id }) => !managedIds.has(id)).map(({ id, name }) => root(id, name, false)),
    ],
    elsewhere: [...targets.values()].filter(({ id }) => !related.has(id)),
    remembersNetwork: discovery.networks.length > 0,
  }
}

/** Every target the player legitimately remembers, in discovery order. */
export function selectTargets(information: PlayerInformation): readonly TargetSummary[] {
  return information.discovery.devices.flatMap((device) => {
    const target = selectTarget(information, device.id)
    return target ? [target] : []
  })
}

/** The concrete module name for a technique, where one of Flipper's represented modules supplies it. */
function moduleNameFor(vulnerabilityId: string): string | undefined {
  const moduleId = (Object.keys(FLIPPER_MODULE_TECHNIQUE) as (keyof typeof FLIPPER_MODULE_TECHNIQUE)[]).find((id) => FLIPPER_MODULE_TECHNIQUE[id] === vulnerabilityId)
  return moduleId ? FLIPPER_MODULE_NAME[moduleId] : undefined
}

/**
 * KeyProbe's own player-facing estimate for a formed route: the same
 * canonical profile and chance calculation Credential Access resolution
 * itself uses, given only the local Device's current compute and whether the
 * player has legitimately observed compatible AuthGuard protection on this
 * exact remembered implementation. Keyed by the concrete Service
 * implementation identity, never by a named Vulnerability, so a future
 * GateSSH release with no Vulnerability at all can still earn an estimate. It
 * never reads hidden World Truth, so a later hidden change to Hardware,
 * GateSSH, or AuthGuard the player has not legitimately observed cannot move
 * this number.
 */
function keyProbeEstimate(serviceImplementation: ServiceImplementationIdentity, computeCapacity: number, authGuardProtected: boolean): CredentialAccessAssessment | undefined {
  const profile = keyProbeProfileForImplementation(serviceImplementation)
  if (!profile) return undefined
  return { kind: 'estimate', percent: Math.round(keyProbeSuccessChance(profile, computeCapacity, authGuardProtected) * 100) }
}

/**
 * The specialized Credential Access Module targets exactly one authored
 * surface (`AUTH-017` / GateSSH 1.3.2) and is deterministic there, so it
 * never earns a probability of its own. This states only what the player's
 * own currently remembered implementation evidence supports, never a
 * prediction: `MATCHED` when it still names that exact surface, `UNCONFIRMED`
 * when a later legitimate observation named a different one instead — which
 * a stale route may still justify attempting — and `EXPECTED` when nothing
 * observed contradicts the module's ordinary target.
 */
function moduleCompatibility(targetImplementation: string | undefined): CredentialAccessAssessment {
  if (targetImplementation === undefined) return { kind: 'compatibility', status: 'EXPECTED' }
  return { kind: 'compatibility', status: targetImplementation === 'GateSSH 1.3.2' ? 'MATCHED' : 'UNCONFIRMED' }
}

function deviceLiveStatus(operational: import('../../core/game/types').DeviceOperationalState): TopologyStatus {
  if (operational.lifecycle === 'SHUTTING_DOWN') return { label: 'SHUTTING DOWN', tone: 'transition' }
  if (operational.lifecycle === 'BOOTING') return { label: 'BOOTING', tone: 'transition' }
  if (operational.connectivity === 'RECONNECTING') return { label: 'RECONNECTING', tone: 'transition' }
  return isDeviceNetworkUsable(operational) ? { label: 'ONLINE', tone: 'available' } : { label: 'OFFLINE', tone: 'down' }
}

function credentialAccessProviderName(process: CredentialAccessProcess): string {
  if (process.toolId === 'keyprobe') return 'KeyProbe'
  if (process.toolId === 'flipper') return 'Flipper · Credential Access Module'
  return 'Credential Access Module'
}

/**
 * Projects only evidence already represented by observation and completed
 * security work. The two GateSSH release facts are deliberately authored
 * here; version strings are never treated as a generic release lineage.
 */
function knownSoftwareIntelligence(
  software: readonly string[],
  analyses: readonly ServiceAnalysisProcess[],
  attempts: readonly CredentialAccessProcess[],
  authGuard: import('../../core/game/types').EnhancedInspectEvidence['authGuard'],
): readonly SoftwareIntelligence[] {
  const learnedFor = (implementation: string, vulnerabilityId: string) => analyses.some((process) =>
    process.status === 'completed'
    && process.result?.status === 'weaknesses_detected'
    && `${process.analyzedImplementation?.name} ${process.analyzedImplementation?.version}` === implementation
    && process.result.vulnerabilities.some(({ vulnerabilityId: id }) => id === vulnerabilityId))
  const successfulModuleAttempts = (vulnerabilityId: string) => attempts.filter((process) =>
    process.status === 'completed'
    && process.vulnerabilityId === vulnerabilityId
    && process.result?.status === 'access_established')
  // KeyProbe's own successes are matched by the concrete implementation it actually attacked, never by a Vulnerability ID it does not carry.
  const successfulKeyProbeAttempt = (implementation: string) => attempts.some((process) => {
    if (process.status !== 'completed' || process.toolId !== 'keyprobe' || process.result?.status !== 'access_established' || !process.serviceImplementation) return false
    const profile = keyProbeProfileForImplementation(process.serviceImplementation)
    return Boolean(profile && `${profile.observedImplementationName} ${profile.observedImplementationVersion}` === implementation)
  })

  return software.flatMap((name) => {
    if (name === 'GateSSH 1.3.2' && learnedFor(name, 'AUTH-017')) return [{ software: name, details: [
      'AUTH-017 is a known pre-authentication Credential Access weakness.',
      ...successfulModuleAttempts('AUTH-017').map((process) => `${credentialAccessProviderName(process)} successfully exploited AUTH-017.`),
      ...(successfulKeyProbeAttempt(name) ? ['KeyProbe successfully accessed this authentication surface.'] : []),
    ] }]
    if (name === 'GateSSH 1.3.3') {
      const details = [
        ...(learnedFor('GateSSH 1.3.2', 'AUTH-017') ? ['This release patched the previously known AUTH-017 weakness from GateSSH 1.3.2.'] : []),
        ...(learnedFor(name, 'AUTH-031') ? ['Analysis identified AUTH-031, a separate pre-authentication Credential Access weakness.'] : []),
        ...(successfulKeyProbeAttempt(name) ? ['KeyProbe successfully accessed this authentication surface.'] : []),
      ]
      return details.length ? [{ software: name, details }] : []
    }
    if (name.startsWith('AuthGuard ') && authGuard) {
      // AuthGuard's protection role is GateSSH-release-scoped, never Vulnerability-scoped: it applies to any KeyProbe attempt it actually blunted.
      const protectedFailure = authGuard.compatibility === 'SUPPORTED' && attempts.some((process) =>
        process.status === 'completed'
        && process.result?.status === 'attempt_failed'
        && process.toolId === 'keyprobe'
        && process.authGuardProtectionObserved)
      return [{ software: name, details: [
        `Inspect observed ${authGuard.compatibility.toLowerCase()} compatibility with ${authGuard.protectedImplementation}.`,
        ...(protectedFailure ? ['Protects SSH authentication traffic against Credential Access attempts.'] : []),
      ] }]
    }
    return []
  })
}

export function selectTarget(information: PlayerInformation, deviceId: string, liveTruth?: LiveTopologyTruth): Target | undefined {
  const device = information.discovery.devices.find(({ id }) => id === deviceId)
  if (!device) return undefined

  const analyses = information.process.processes.filter(isServiceAnalysis)
  const attempts = information.process.processes.filter(isCredentialAccess)
  const exploits = information.process.processes.filter(isRackUpdateExploit)
  const deauth = information.process.processes.filter(isDeauth)
  const established = accessFor(information, device.id)
  const activeAccess = established.find(({ id }) => id === information.remoteSession.active?.accessId)
  const serviceName = (serviceId: string) => device.services.find(({ id }) => id === serviceId)?.name
  const flipper = findInstalledFlipper(information.player.localDevice)
  const nodeScan = findInstalledNodeScan(information.player.localDevice)
  const monitorAll = Boolean(nodeScan && nodeScanSupportsLiveTopology(nodeScan))
  const currentHost = liveTruth?.world.network.hosts.find(({ id }) => id === device.id)
  const sourceUsable = isDeviceNetworkUsable(information.player.localDevice.operational)
  const usableAccessServiceIds = new Set(established.filter((access) => {
    const service = currentHost?.services?.find(({ id }) => id === access.viaServiceId)
    return sourceUsable && Boolean(currentHost && isDeviceNetworkUsable(currentHost.operational) && service?.open)
  }).map(({ viaServiceId }) => viaServiceId))
  const deviceHasLiveAuthority = Boolean(currentHost && (monitorAll || usableAccessServiceIds.size > 0))

  const routes: TargetRoute[] = []
  /** KeyProbe's own formed route, entirely independent of the Vulnerability-based `routes` above. At most one is ever formed in V1. */
  let keyProbeRoute: KeyProbeRoute | undefined
  const services = device.services.map((service): TargetService => {
    const observed = describeImplementation(service.inspect)
    const observedAuthGuard = device.inspect?.enhanced?.authGuard
    const software = [
      ...(observed ? [observed.implementation] : []),
      ...(observed && observedAuthGuard?.protectedImplementation === observed.implementation ? [`${observedAuthGuard.name} ${observedAuthGuard.version}`] : []),
    ]
    const weaknesses = knowledgeFor(information, device.id, service.id)
    const serviceAnalyses = analyses.filter((process) => process.targetDeviceId === device.id && process.serviceId === service.id)
    const serviceAttempts = attempts.filter((process) => process.targetDeviceId === device.id && process.serviceId === service.id)
    const intelligence = nodeScan && nodeScanSupportsIntegratedIntelligence(nodeScan)
      ? knownSoftwareIntelligence(software, serviceAnalyses, serviceAttempts, observedAuthGuard)
      : []
    const analysis = serviceProcesses(analyses, device.id, service.id, service.endpoint)
    const running = analysis.find(({ status }) => status === 'running')
    const currentFingerprint = service.inspect?.implementation
    const outcome = [...analysis].reverse().find((process) => {
      if (process.status !== 'completed' || !process.result) return false
      // Fingerprint-free analyses remain usable for the NodeScan 1.0 flow.
      // Once a concrete fingerprint is remembered, only a matching completion
      // association can describe that implementation as analyzed.
      return !currentFingerprint || Boolean(process.analyzedImplementation && (
        process.analyzedImplementation.name === currentFingerprint.name
        && process.analyzedImplementation.version === currentFingerprint.version
      ))
    })?.result?.status
    const viaAccess = established.find((access) => access.viaServiceId === service.id)
    // KeyProbe forms from the player's own legitimately observed authentication surface alone — no
    // Vulnerability Knowledge required, and never derived from hidden current World Truth.
    if (!viaAccess && service.inspect?.implementation) {
      const profile = keyProbeProfileForObservedImplementation(service.inspect.implementation)
      if (profile) {
        keyProbeRoute = {
          serviceId: service.id,
          serviceName: service.name,
          endpoint: service.endpoint,
          serviceImplementation: { productId: profile.serviceProductId, releaseId: profile.serviceReleaseId, buildId: profile.serviceBuildId },
          implementation: `${service.inspect.implementation.name} ${service.inspect.implementation.version}`,
        }
      }
    }
    const supported = weaknesses.find(({ id }) => ownedCredentialAccessModuleProviders(information, id).length > 0)
    const supportedProviders = supported ? ownedCredentialAccessModuleProviders(information, supported.id) : []
    const techniqueTool = supported ? findLocalTechniqueTool(information.player.localDevice, supported.id) : undefined
    if (supported && supportedProviders.length > 0 && !viaAccess) {
      routes.push({
        serviceId: service.id,
        serviceName: service.name,
        endpoint: service.endpoint,
        vulnerabilityId: supported.id,
        vulnerabilityLabel: supported.label,
        toolName: techniqueTool?.toolName ?? supportedProviders[0].name,
        ...(techniqueTool && moduleNameFor(supported.id) ? { moduleName: moduleNameFor(supported.id)! } : {}),
        ...(observed ? { implementation: observed.implementation } : {}),
      })
    }
    return {
      id: service.id,
      name: service.name,
      port: service.port,
      protocol: service.protocol,
      endpoint: service.endpoint,
      software,
      ...(observed ? { observed } : {}),
      weaknesses,
      analysisRequired: weaknesses.length === 0 && outcome !== 'no_weakness_detected' && outcome !== 'weaknesses_detected',
      ...(running ? { analysisPercent: percentOf(running) } : {}),
      ...(outcome ? { analysisOutcome: outcome } : {}),
      ...(viaAccess ? { accessPrivilege: viaAccess.privilege } : {}),
      intelligence,
      ...(currentHost && (monitorAll || usableAccessServiceIds.has(service.id))
        ? { liveStatus: !isDeviceNetworkUsable(currentHost.operational) ? { label: 'OFFLINE', tone: 'down' } : currentHost.services?.find(({ id }) => id === service.id)?.open ? { label: 'ONLINE', tone: 'available' } : { label: 'CLOSED', tone: 'down' } }
        : {}),
    }
  })

  const analyzing = analyses.filter((process) => process.targetDeviceId === device.id && process.status === 'running')
  const hacking = attempts.filter((process) => process.targetDeviceId === device.id && process.status === 'running')
  const passive = established[0]
  /** The outcome Credential Access itself recorded for this provider's own most recent completed attempt here, while Process history still remembers it. */
  const lastCredentialFailure = (providerId: CredentialAccessProviderId): CredentialAccessFailureReason | 'unspecified' | undefined => {
    const last = [...attempts].reverse().find((process) => process.targetDeviceId === device.id && process.toolId === providerId && process.status === 'completed' && process.result)?.result
    return last?.status === 'attempt_failed' ? (last.reason ?? 'unspecified') : undefined
  }
  const packageSubmission = selectPackageSubmission(information, device.id, exploits, services)?.packageSubmission
  const localArtifacts = findLocalFlipperModuleArtifacts(information.player.localDevice).filter(isSupportedFlipperModuleArtifact)
  const providerFor = (moduleId: 'credential-access' | 'rollback', artifactName: string) => {
    if (flipper?.integratedModules.includes(moduleId)) return `${flipper.name} · ${artifactName}`
    const artifact = localArtifacts.find((file) => file.moduleId === moduleId)
    return artifact?.path
  }
  const rollbackProvider = providerFor('rollback', ROLLBACK_MODULE_1_0.name)
  // The specialized module's route names exactly one Vulnerability (AUTH-017); at most one is ever formed.
  const moduleRoute = routes[0] as TargetRoute | undefined
  const moduleProviders = ownedCredentialAccessModuleProviders(information, moduleRoute?.vulnerabilityId ?? 'AUTH-017')
  const deviceAuthGuard = device.inspect?.enhanced?.authGuard
  // Only a legitimately observed AuthGuard match may affect the player's own estimate; a hidden or
  // unobserved installation, or one that names a different remembered implementation, never does. AuthGuard's
  // protection is GateSSH-release-scoped, never Vulnerability-scoped, so no Vulnerability check applies here.
  const legitimatelyObservedAuthGuardMatch = Boolean(keyProbeRoute
    && deviceAuthGuard?.compatibility === 'SUPPORTED'
    && deviceAuthGuard.protectedImplementation === keyProbeRoute.implementation)
  const localComputeCapacity = information.player.localDevice.hardware.cpu.computeCapacity
  const keyProbeOwned = ownsKeyProbe(information)
  const keyProbeAction: TargetOffensiveAction | undefined = keyProbeOwned ? {
    technique: 'Credential Access' as const,
    provider: 'KeyProbe',
    providerId: STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID,
    running: hacking.length > 0,
    ...(keyProbeRoute ? { route: keyProbeRoute, assessment: keyProbeEstimate(keyProbeRoute.serviceImplementation, localComputeCapacity, legitimatelyObservedAuthGuardMatch) } : {}),
    ...(lastCredentialFailure(STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID) ? { lastFailureReason: lastCredentialFailure(STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID) } : {}),
  } : undefined
  const moduleAction = (provider: { readonly id: CredentialAccessProviderId; readonly name: string }): TargetOffensiveAction => {
    const lastFailureReason = lastCredentialFailure(provider.id)
    return {
      technique: 'Credential Access' as const,
      provider: provider.name,
      providerId: provider.id,
      running: hacking.length > 0,
      ...(moduleRoute ? { route: moduleRoute, assessment: moduleCompatibility(moduleRoute.implementation) } : {}),
      ...(lastFailureReason ? { lastFailureReason } : {}),
    }
  }
  const offensiveActions: TargetOffensiveAction[] = [
    ...(keyProbeAction ? [keyProbeAction] : []),
    ...moduleProviders.map(moduleAction),
    ...(rollbackProvider ? [{ technique: 'Rollback' as const, provider: rollbackProvider, running: Boolean(packageSubmission?.attacking), ...(packageSubmission?.route ? { route: packageSubmission.route } : {}) }] : []),
    ...(findCompatibleDeauthExtension(information.player.localDevice) ? information.discovery.networkDeviceRelations
      .filter(({ deviceId }) => deviceId === device.id)
      .flatMap(({ networkId }) => information.discovery.networks.filter(({ id }) => id === networkId).map((network) => ({ technique: 'DEAUTH' as const, provider: DEAUTH_EXTENSION.name, route: { networkId: network.id, networkName: network.name, contextDeviceId: device.id }, running: deauth.some((process) => process.status === 'running' && process.targetNetworkId === network.id) }))) : []),
  ]
  const stage = stageOf({
    connected: Boolean(activeAccess && information.remoteSession.active),
    hasAccess: Boolean(passive),
    hacking: hacking.length > 0,
    disrupting: deauth.some((process) => process.status === 'running' && process.contextDeviceId === device.id),
    analyzing: analyzing.length > 0,
    routes: routes.length + (keyProbeRoute ? 1 : 0),
    servicesObserved: device.servicesObserved,
    services,
    packageSubmission,
  })
  const contextualDeauth = deauth.filter((process) => process.contextDeviceId === device.id && process.status === 'running')
  const percent = stage === 'hacking' ? runningPercent(hacking)
    : stage === 'disrupting' ? runningPercent(contextualDeauth)
    : stage === 'analyzing' ? runningPercent(analyzing)
      : stage === 'attacking' ? packageSubmission?.attackPercent ?? 0
        : stage === 'submitting' ? packageSubmission?.submitPercent ?? 0 : 0
  const operation = selectOperation({
    stage,
    percent,
    analyzing,
    hacking,
    exploiting: exploits.filter((process) => process.targetDeviceId === device.id && process.status === 'running'),
    submission: information.rackUpdate.submission.active,
    localFiles: information.player.localDevice.filesystem.files,
    services,
    weaknessLabel: (serviceId, vulnerabilityId) => knowledgeFor(information, device.id, serviceId).find(({ id }) => id === vulnerabilityId)?.label,
    flipperName: flipper?.name,
    deauth: contextualDeauth,
  })

  return {
    id: device.id,
    address: device.address,
    scope: device.scope,
    networkNames: networkNamesOf(information, device.id),
    stage,
    // Only an Inspect that actually observed it; never resolved from World Truth.
    ...(device.inspect?.displayName ? { displayName: device.inspect.displayName } : {}),
    percent,
    ...(operation ? { operation } : {}),
    routes,
    offensiveActions,
    ...(device.inspect
      ? {
        observed: {
          deviceKind: device.inspect.deviceKind,
          networkStatus: device.inspect.networkStatus,
          ...(device.inspect.enhanced ? { firmware: `${device.inspect.enhanced.firmware.name} ${device.inspect.enhanced.firmware.version}`, computeClass: device.inspect.enhanced.computeClass } : {}),
        },
      }
      : {}),
    servicesObserved: device.servicesObserved,
    services,
    ...(deviceHasLiveAuthority ? { liveStatus: deviceLiveStatus(currentHost!.operational) } : {}),
    ...(passive ? { access: { privilege: passive.privilege, ...(serviceName(passive.viaServiceId) ? { viaServiceName: serviceName(passive.viaServiceId) } : {}) } } : {}),
    ...(activeAccess && information.remoteSession.active
      ? {
        session: {
          privilege: activeAccess.privilege,
          connectedAddress: information.remoteSession.active.connectedAddress,
          ...(serviceName(activeAccess.viaServiceId) ? { viaServiceName: serviceName(activeAccess.viaServiceId) } : {}),
        },
      }
      : {}),
    ...(packageSubmission ? { packageSubmission } : {}),
  }
}

/**
 * Describe the work actually running against this target.
 *
 * The stage already says *which* kind of work that is; this says what that
 * work is operating on, using only the running Process's or submission's own
 * canonical fields and labels the player already holds. It deliberately does
 * not restate CPU or RAM: the Activity Monitor owns the executor's runtime,
 * and this is the target's own line of action.
 */
function selectOperation(input: {
  stage: TargetStage
  /** The target's own canonical progress, so the surface and the stage can never disagree. */
  percent: number
  analyzing: readonly ServiceAnalysisProcess[]
  hacking: readonly CredentialAccessProcess[]
  exploiting: readonly RackUpdateExploitProcess[]
  submission: RackUpdatePackageSubmission | null
  localFiles: LocalDeviceState['filesystem']['files']
  services: readonly TargetService[]
  weaknessLabel(serviceId: string, vulnerabilityId: string): string | undefined
  flipperName?: string
  deauth: readonly DeauthProcess[]
}): TargetOperation | undefined {
  const serviceOf = (serviceId: string) => input.services.find(({ id }) => id === serviceId)
  // The provider the canonical resolver actually selected when the attempt started, not whatever is currently owned.
  const providerOf = (process: { toolId: string; moduleId?: 'credential-access' | 'rollback' }) =>
    process.toolId === 'keyprobe' ? 'KeyProbe'
      : process.toolId === 'flipper' && process.moduleId ? `${input.flipperName ?? 'Flipper'} · ${FLIPPER_MODULE_NAME[process.moduleId]}`
        : process.moduleId ? FLIPPER_MODULE_NAME[process.moduleId] : process.toolId
  const attemptFacts = (process: CredentialAccessProcess | RackUpdateExploitProcess): TargetOperationFact[] => {
    const base = [
      { label: 'PROVIDER', value: providerOf(process) },
      { label: 'ENDPOINT', value: process.startedEndpoint },
    ]
    // KeyProbe attacks a Service surface directly, never a named Vulnerability: its running fact states the
    // legitimately remembered implementation the attempt started against, not a WEAKNESS line.
    if (process.kind === 'credential_access' && process.toolId === 'keyprobe') {
      return [...base, { label: 'TARGET', value: serviceOf(process.serviceId)?.observed?.implementation ?? '' }]
    }
    const label = process.vulnerabilityId !== undefined ? input.weaknessLabel(process.serviceId, process.vulnerabilityId) : undefined
    return [...base, { label: 'WEAKNESS', value: process.vulnerabilityId !== undefined ? (label ? `${process.vulnerabilityId} · ${label}` : process.vulnerabilityId) : '' }]
  }

  if (input.stage === 'analyzing' && input.analyzing.length) {
    const single = input.analyzing.length === 1 ? input.analyzing[0] : undefined
    const observed = single ? serviceOf(single.serviceId)?.observed?.implementation : undefined
    return {
      kind: 'service_analysis',
      title: 'SERVICE ANALYSIS',
      percent: input.percent,
      facts: single
        ? [
          { label: 'SERVICE', value: serviceOf(single.serviceId)?.name ?? single.serviceId },
          { label: 'ENDPOINT', value: single.startedEndpoint },
          ...(observed ? [{ label: 'SOFTWARE', value: observed }] : []),
        ]
        // One line per running analysis: which Service, and the endpoint it was started against.
        : input.analyzing.map((process) => ({ label: serviceOf(process.serviceId)?.name ?? process.serviceId, value: process.startedEndpoint })),
    }
  }
  if (input.stage === 'hacking' && input.hacking.length) {
    return { kind: 'credential_access', title: 'CREDENTIAL ACCESS', percent: input.percent, facts: attemptFacts(input.hacking[0]) }
  }
  if (input.stage === 'disrupting' && input.deauth.length) {
    const process = input.deauth[0]
    return { kind: 'deauth', title: 'DEAUTH', percent: input.percent, facts: [{ label: 'SCOPE', value: 'NETWORK' }, { label: 'NETWORK', value: process.targetNetworkName }, { label: 'PROVIDER', value: DEAUTH_EXTENSION.name }] }
  }
  if (input.stage === 'attacking' && input.exploiting.length) {
    return { kind: 'rack_update_exploit', title: 'ROLLBACK', percent: input.percent, facts: attemptFacts(input.exploiting[0]) }
  }
  if (input.stage === 'submitting' && input.submission) {
    const { submission } = input
    const source = input.localFiles.find((file) => file.id === submission.sourceFileId)
    const endpoint = serviceOf(submission.serviceId)?.endpoint
    return {
      kind: 'package_submission',
      title: 'PACKAGE SUBMISSION',
      percent: input.percent,
      facts: [
        ...(source && source.kind === 'software_package' ? [{ label: 'PACKAGE', value: `${source.name} ${source.version}` }] : []),
        ...(endpoint ? [{ label: 'ENDPOINT', value: endpoint }] : []),
        { label: 'UPLOADED', value: formatByteProgress(submission.bytesTransferred, submission.bytesTotal) },
      ],
    }
  }
  return undefined
}

/**
 * RackUpdate's package submission stays exactly as demanding as the earlier
 * rollback avenue was: it is offered only where a remembered package-
 * submission interface and earned `UPD-001` Knowledge both exist. It reads no
 * hidden target World Truth: candidate packages are compared only against
 * what Enhanced Inspect actually remembered, ATTACK availability is derived
 * only from the player's own Knowledge and installed tool, and progress comes
 * only from the player's own Process and submission runtime. It is
 * participates in the target's primary decision without being mislabeled as
 * credential access.
 *
 * RackUpdate's submission protocol itself is a general package-submission
 * mechanism, not an older-release-only one: candidates are any remembered
 * GateSSH product package whose version differs from the remembered current
 * release, older or newer alike. `UPD-001` ("Rollback protection not
 * enforced") remains the specific explanation for why a rollback to an
 * *older* release is accepted; it is not restated as a general submission
 * requirement.
 */
function selectPackageSubmission(information: PlayerInformation, deviceId: string, exploits: readonly RackUpdateExploitProcess[], services: readonly TargetService[]): Pick<Target, 'packageSubmission'> | undefined {
  const rackUpdate = services.find((service) =>
    service.observed?.interface === 'Package submission' && service.weaknesses.some(({ id }) => id === 'UPD-001'))
  const managed = services.find((service) => service.observed?.implementation.startsWith('GateSSH '))
  const remembered = managed?.observed?.implementation.slice('GateSSH '.length)
  if (!rackUpdate || !remembered) return undefined

  const localDeviceId = information.player.localDevice.id
  const enabled = information.rackUpdate.access.established.some((access) =>
    access.sourceDeviceId === localDeviceId && access.targetDeviceId === deviceId && access.viaServiceId === rackUpdate.id)

  const attack = serviceProcesses(exploits, deviceId, rackUpdate.id, rackUpdate.endpoint)
  const running = attack.find(({ status }) => status === 'running')
  const lastAttack = [...attack].reverse().find((process) => process.status === 'completed' && process.result)?.result

  const weakness = rackUpdate.weaknesses.find(({ id }) => id === 'UPD-001')
  // The tool stays a real requirement: without a Flipper build that actually
  // integrates the Rollback Module, the opportunity is never formed at all.
  const techniqueTool = weakness ? findLocalTechniqueTool(information.player.localDevice, weakness.id) : undefined
  const route: PackageSubmissionRoute | undefined = !enabled && techniqueTool && weakness
    ? { vulnerabilityId: weakness.id, vulnerabilityLabel: weakness.label, toolName: techniqueTool.toolName, moduleName: techniqueTool.moduleName }
    : undefined

  const submission = information.rackUpdate.submission.active
  const submitting = Boolean(submission && submission.sourceDeviceId === localDeviceId && submission.targetDeviceId === deviceId && submission.serviceId === rackUpdate.id)
  const completed = information.rackUpdate.submission.outcome?.targetDeviceId === deviceId
    && information.rackUpdate.submission.outcome.serviceId === rackUpdate.id
    && information.rackUpdate.submission.outcome.result === 'package_accepted_reboot_required'

  return {
    packageSubmission: {
      serviceId: rackUpdate.id,
      serviceName: rackUpdate.name,
      endpoint: rackUpdate.endpoint,
      enabled,
      ...(route ? { route } : {}),
      attacking: Boolean(running),
      ...(running ? { attackPercent: percentOf(running) } : {}),
      lastAttackFailed: lastAttack?.status === 'attempt_failed',
      candidates: enabled ? information.player.localDevice.filesystem.files.flatMap((file) =>
        file.kind === 'software_package' && file.productId === 'gate-ssh' && file.version !== remembered
          ? [{ id: file.id, path: file.path, label: `${file.name} ${file.version}` }]
          : []) : [],
      submitting,
      completed,
      ...(submitting && submission ? { submitPercent: Math.floor(submission.bytesTransferred / submission.bytesTotal * 100) } : {}),
    },
  }
}
