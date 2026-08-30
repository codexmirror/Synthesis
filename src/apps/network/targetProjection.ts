import { findInstalledNodeScan, nodeScanSupportsInspect } from '../../core/game/software'
import { FLIPPER_MODULE_NAME, FLIPPER_MODULE_TECHNIQUE, findInstalledFlipper, findLocalTechniqueTool, flipperSupportsTechnique } from '../../core/game/flipper'
import type {
  CredentialAccessProcess,
  GameState,
  GameProcess,
  LocalDeviceState,
  RackUpdateExploitProcess,
  ServiceAnalysisProcess,
} from '../../core/game/types'

/**
 * NodeScan presents one target at a time as a single decision, not as a
 * dashboard of the subsystems that decision touches. Everything the interface
 * renders is derived here, from this deliberately narrow slice of canonical
 * state: remembered Discovery, earned Knowledge, the player's own Processes,
 * the player's own installed software and the player's current relationships.
 * `world` is intentionally absent from the slice, so hidden Device names,
 * unobserved Service implementations, unobserved authentication conditions,
 * vulnerability presence and attack feasibility cannot reach the interface
 * even by accident.
 */
export type PlayerInformation = Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'process' | 'deviceAccess' | 'remoteSession' | 'rackUpdate'>

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
}

export function resolveNodeScanRelease(device: LocalDeviceState): NodeScanRelease | undefined {
  const installation = findInstalledNodeScan(device)
  if (!installation) return undefined
  return {
    name: installation.name,
    version: installation.version,
    channel: installation.channel,
    canInspect: nodeScanSupportsInspect(installation),
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
  | 'inspect'
  | 'analysis_ready'
  | 'analyzing'
  | 'no_route'
  | 'route'
  | 'hacking'
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

export type AnalysisOutcome = 'weaknesses_detected' | 'no_weakness_detected' | 'service_unavailable'

export interface TargetService {
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly endpoint: string
  readonly observed?: { readonly implementation: string; readonly authentication?: string; readonly interface?: string }
  readonly weaknesses: readonly KnownWeakness[]
  readonly analysisPercent?: number
  /** Retained, disposable Process history — never permanent Knowledge. */
  readonly analysisOutcome?: AnalysisOutcome
  /** Whether the latest remembered evidence still justifies a canonical Analyze attempt. */
  readonly analysisRequired: boolean
  readonly accessPrivilege?: 'USER'
}

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
}

/**
 * One remembered Network as relationship context for the targets inside it.
 * It is presentation grouping over `networkDeviceRelations`, not a level of
 * navigation: the Network itself is not openable and carries no action.
 */
export interface KnownNetwork {
  readonly id: string
  readonly name: string
  readonly membersObserved: boolean
  /** Whether the player legitimately remembers SELF as a member of this Network. */
  readonly includesSelf: boolean
  readonly targets: readonly TargetSummary[]
}

export interface KnownSpace {
  readonly self: { readonly address: string }
  readonly networks: readonly KnownNetwork[]
  /** Remembered Devices with no remembered relationship to a known Network. */
  readonly elsewhere: readonly TargetSummary[]
}

export interface TargetSummary {
  readonly id: string
  readonly address: string
  readonly scope: 'unknown' | 'lan' | 'remote'
  readonly networkNames: readonly string[]
  readonly stage: TargetStage
}

export interface Target extends TargetSummary {
  /** Canonical progress of the work the current stage is waiting on, 0 when nothing runs. */
  readonly percent: number
  readonly routes: readonly TargetRoute[]
  readonly lastAttemptFailed: boolean
  readonly observed?: {
    readonly deviceKind: 'device' | 'server'
    readonly networkStatus: 'ONLINE'
    readonly firmware?: string
    readonly computeClass?: string
  }
  readonly servicesObserved: boolean
  readonly services: readonly TargetService[]
  readonly access?: { readonly privilege: 'USER'; readonly viaServiceName?: string }
  readonly session?: { readonly privilege: 'USER'; readonly connectedAddress: string; readonly viaServiceName?: string }
  /**
   * RackUpdate's package-submission lifecycle, named only where remembered
   * Player Information justifies it. It remains distinct from Device access.
   */
  readonly packageSubmission?: PackageSubmission
}

function percentOf(process: { workCompleted: number; workRequired: number }): number {
  return Math.floor(process.workCompleted / process.workRequired * 100)
}

function isServiceAnalysis(process: GameProcess): process is ServiceAnalysisProcess { return process.kind === 'service_analysis' }
function isCredentialAccess(process: GameProcess): process is CredentialAccessProcess { return process.kind === 'credential_access' }
function isRackUpdateExploit(process: GameProcess): process is RackUpdateExploitProcess { return process.kind === 'rack_update_exploit' }

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
 * Nothing here consults hidden World Truth, and `no_route` is a statement
 * about the player's own information, not about the target.
 */
function stageOf(input: {
  connected: boolean
  hasAccess: boolean
  hacking: boolean
  analyzing: boolean
  routes: number
  servicesObserved: boolean
  services: readonly TargetService[]
  inspectAvailable: boolean
  inspected: boolean
  packageSubmission?: PackageSubmission
}): TargetStage {
  if (input.connected) return 'connected'
  if (input.hacking) return 'hacking'
  if (input.analyzing) return 'analyzing'
  if (input.packageSubmission?.attacking) return 'attacking'
  if (input.packageSubmission?.submitting) return 'submitting'
  if (!input.servicesObserved) return 'unscanned'
  if (input.inspectAvailable && !input.inspected) return 'inspect'
  if (input.hasAccess) return 'access'
  if (input.packageSubmission?.enabled) return 'submission_ready'
  if (input.packageSubmission?.route) return 'attack'
  if (input.routes > 0) return 'route'
  if (input.services.some((service) => service.analysisRequired)) return 'analysis_ready'
  return 'no_route'
}

/**
 * Every target the player legitimately remembers, in discovery order. Known
 * Networks are the target's stated location rather than a level of navigation
 * the player has to descend through.
 */
/**
 * Known Space: the remembered relationship shape around the player, derived
 * entirely from remembered Discovery. SELF appears only where the player has
 * legitimately observed its own membership of a Network; a Device appears
 * under every Network it is remembered in, and one it is remembered in none of
 * stays visibly separate rather than being filed under a Network it was never
 * observed on.
 */
export function selectKnownSpace(information: PlayerInformation): KnownSpace {
  const { discovery } = information
  const localDeviceId = information.player.localDevice.id
  const targets = new Map(selectTargets(information).map((target) => [target.id, target]))
  const knownNetworkIds = new Set(discovery.networks.map(({ id }) => id))
  const related = new Set(discovery.networkDeviceRelations
    .filter(({ networkId }) => knownNetworkIds.has(networkId))
    .map(({ deviceId }) => deviceId))
  const membersOf = (networkId: string) => discovery.networkDeviceRelations.filter((relation) => relation.networkId === networkId)
  return {
    self: { address: information.player.localDevice.network.ip },
    networks: discovery.networks.map((network) => ({
      id: network.id,
      name: network.name,
      membersObserved: network.membersObserved,
      includesSelf: membersOf(network.id).some(({ deviceId }) => deviceId === localDeviceId),
      targets: membersOf(network.id).flatMap(({ deviceId }) => {
        const target = deviceId === localDeviceId ? undefined : targets.get(deviceId)
        return target ? [target] : []
      }),
    })),
    elsewhere: [...targets.values()].filter(({ id }) => !related.has(id)),
  }
}

export function selectTargets(information: PlayerInformation): readonly TargetSummary[] {
  return information.discovery.devices.map((device) => {
    const target = selectTarget(information, device.id)
    return {
      id: device.id,
      address: device.address,
      scope: device.scope,
      networkNames: networkNamesOf(information, device.id),
      stage: target?.stage ?? 'unscanned',
    }
  })
}

/** The concrete module name for a technique, where one of Flipper's represented modules supplies it. */
function moduleNameFor(vulnerabilityId: string): string | undefined {
  const moduleId = (Object.keys(FLIPPER_MODULE_TECHNIQUE) as (keyof typeof FLIPPER_MODULE_TECHNIQUE)[]).find((id) => FLIPPER_MODULE_TECHNIQUE[id] === vulnerabilityId)
  return moduleId ? FLIPPER_MODULE_NAME[moduleId] : undefined
}

export function selectTarget(information: PlayerInformation, deviceId: string): Target | undefined {
  const device = information.discovery.devices.find(({ id }) => id === deviceId)
  if (!device) return undefined

  const analyses = information.process.processes.filter(isServiceAnalysis)
  const attempts = information.process.processes.filter(isCredentialAccess)
  const exploits = information.process.processes.filter(isRackUpdateExploit)
  const established = accessFor(information, device.id)
  const activeAccess = established.find(({ id }) => id === information.remoteSession.active?.accessId)
  const serviceName = (serviceId: string) => device.services.find(({ id }) => id === serviceId)?.name
  const flipper = findInstalledFlipper(information.player.localDevice)
  const nodeScan = findInstalledNodeScan(information.player.localDevice)

  const routes: TargetRoute[] = []
  const services = device.services.map((service): TargetService => {
    const observed = describeImplementation(service.inspect)
    const weaknesses = knowledgeFor(information, device.id, service.id)
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
    // Canonical local capability resolution chooses an integrated Flipper when
    // available or the exact standalone module otherwise. Presentation does
    // not choose a tool, and Knowledge remains independently required.
    const supported = weaknesses.find(({ id }) => findLocalTechniqueTool(information.player.localDevice, id))
    const techniqueTool = supported ? findLocalTechniqueTool(information.player.localDevice, supported.id) : undefined
    if (techniqueTool && supported && !viaAccess) {
      routes.push({
        serviceId: service.id,
        serviceName: service.name,
        endpoint: service.endpoint,
        vulnerabilityId: supported.id,
        vulnerabilityLabel: supported.label,
        toolName: techniqueTool.toolName,
        ...(moduleNameFor(supported.id) ? { moduleName: moduleNameFor(supported.id)! } : {}),
        ...(observed ? { implementation: observed.implementation } : {}),
      })
    }
    return {
      id: service.id,
      name: service.name,
      port: service.port,
      protocol: service.protocol,
      endpoint: service.endpoint,
      ...(observed ? { observed } : {}),
      weaknesses,
      analysisRequired: weaknesses.length === 0 && outcome !== 'no_weakness_detected' && outcome !== 'weaknesses_detected',
      ...(running ? { analysisPercent: percentOf(running) } : {}),
      ...(outcome ? { analysisOutcome: outcome } : {}),
      ...(viaAccess ? { accessPrivilege: viaAccess.privilege } : {}),
    }
  })

  const analyzing = analyses.filter((process) => process.targetDeviceId === device.id && process.status === 'running')
  const hacking = attempts.filter((process) => process.targetDeviceId === device.id && process.status === 'running')
  const passive = established[0]
  const lastAttempt = [...attempts]
    .reverse()
    .find((process) => process.targetDeviceId === device.id && process.status === 'completed' && process.result)?.result
  const packageSubmission = selectPackageSubmission(information, device.id, exploits, services)?.packageSubmission
  const stage = stageOf({
    connected: Boolean(activeAccess && information.remoteSession.active),
    hasAccess: Boolean(passive),
    hacking: hacking.length > 0,
    analyzing: analyzing.length > 0,
    routes: routes.length,
    servicesObserved: device.servicesObserved,
    services,
    inspectAvailable: Boolean(nodeScan && nodeScanSupportsInspect(nodeScan)),
    inspected: Boolean(device.inspect?.enhanced),
    packageSubmission,
  })

  return {
    id: device.id,
    address: device.address,
    scope: device.scope,
    networkNames: networkNamesOf(information, device.id),
    stage,
    percent: stage === 'hacking' ? runningPercent(hacking) : stage === 'analyzing' ? runningPercent(analyzing) : stage === 'attacking' ? packageSubmission?.attackPercent ?? 0 : stage === 'submitting' ? packageSubmission?.submitPercent ?? 0 : 0,
    routes,
    lastAttemptFailed: lastAttempt?.status === 'attempt_failed',
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
      ...(submitting && submission ? { submitPercent: Math.floor(submission.bytesTransferred / submission.bytesTotal * 100) } : {}),
    },
  }
}
