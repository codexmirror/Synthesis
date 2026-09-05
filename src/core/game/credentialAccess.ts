import { startProcess } from './processes'
import { resolveServiceEndpoint } from './serviceAnalysis'
import type { CredentialAccessProcess, GameState } from './types'
import { FLIPPER_PRODUCT_ID, findInstalledFlipper, findLocalFlipperModuleArtifacts, findLocalTechniqueTool, flipperSupportsTechnique, isSupportedFlipperModuleArtifact } from './flipper'
import { GATE_SSH_1_3_2_BUILD_ID, GATE_SSH_1_3_2_RELEASE_ID, GATE_SSH_1_3_3_BUILD_ID, GATE_SSH_1_3_3_RELEASE_ID, GATE_SSH_PRODUCT_ID, vulnerabilitiesForService } from './serviceImplementations'
import { appendAuthenticationHistoryForHost } from './authenticationHistory'
import { appendNetworkConnectionAttemptEvidence } from './networkActivityHistory'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { authGuard10SupportsGateSshAuthentication } from './authGuard'

/** The one Flipper module that supplies the specialized Vulnerability-specific technique. It is domain truth, never supplied by an interface. */
const CREDENTIAL_ACCESS_MODULE_ID = 'credential-access' as const
export const STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID = 'keyprobe' as const
export type CredentialAccessProviderId = CredentialAccessProcess['toolId']
export const CREDENTIAL_ACCESS_WORK_REQUIRED = 1200
export const CREDENTIAL_ACCESS_RAM_REQUIRED_MIB = 896

/** Stable identity of a concrete Service implementation, independent of any named Vulnerability. */
export interface ServiceImplementationIdentity {
  readonly productId: string
  readonly releaseId: string
  readonly buildId: string
}

/**
 * KeyProbe is a broad, noisy Credential Access tool: it attacks a supported
 * GateSSH authentication surface directly, and is keyed by that concrete
 * Service implementation rather than by any named Vulnerability. A future
 * GateSSH release may carry no Vulnerability at all and still be a valid
 * KeyProbe target, exactly like these two.
 */
interface KeyProbeAttackProfile {
  readonly serviceProductId: typeof GATE_SSH_PRODUCT_ID
  readonly serviceReleaseId: string
  readonly serviceBuildId: string
  /** The display name/version a legitimate Inspect observation names for this exact profile — Player Information, never a stable ID. */
  readonly observedImplementationName: string
  readonly observedImplementationVersion: string
  readonly workRequired: number
  readonly chanceAtCompute100: number
  readonly minimumChance: number
  readonly maximumChance: number
}

/** Authored KeyProbe 1.0 profiles for the concrete GateSSH authentication surfaces represented in V1, keyed by release identity. */
export const KEYPROBE_ATTACK_PROFILES: Readonly<Record<string, KeyProbeAttackProfile>> = {
  [GATE_SSH_1_3_2_RELEASE_ID]: {
    serviceProductId: GATE_SSH_PRODUCT_ID, serviceReleaseId: GATE_SSH_1_3_2_RELEASE_ID, serviceBuildId: GATE_SSH_1_3_2_BUILD_ID,
    observedImplementationName: 'GateSSH', observedImplementationVersion: '1.3.2',
    workRequired: 1200, chanceAtCompute100: 0.48, minimumChance: 0.15, maximumChance: 0.78,
  },
  [GATE_SSH_1_3_3_RELEASE_ID]: {
    serviceProductId: GATE_SSH_PRODUCT_ID, serviceReleaseId: GATE_SSH_1_3_3_RELEASE_ID, serviceBuildId: GATE_SSH_1_3_3_BUILD_ID,
    observedImplementationName: 'GateSSH', observedImplementationVersion: '1.3.3',
    workRequired: 1800, chanceAtCompute100: 0.30, minimumChance: 0.08, maximumChance: 0.65,
  },
}

const KEYPROBE_CHANCE_PER_COMPUTE = 0.0025
const AUTH_GUARD_KEYPROBE_CHANCE_MULTIPLIER = 1 / 6

/** Deterministic KeyProbe-specific threshold; the caller owns the one random decision. */
export function keyProbeSuccessChance(profile: KeyProbeAttackProfile, computeCapacity: number, authGuardProtected = false): number {
  const computeChance = profile.chanceAtCompute100 + (computeCapacity - 100) * KEYPROBE_CHANCE_PER_COMPUTE
  const boundedChance = Math.min(profile.maximumChance, Math.max(profile.minimumChance, computeChance))
  return authGuardProtected ? boundedChance * AUTH_GUARD_KEYPROBE_CHANCE_MULTIPLIER : boundedChance
}

/** Resolution-side lookup: does this current (or remembered) World-Truth-native Service implementation identity match an authored KeyProbe profile? */
export function keyProbeProfileForImplementation(implementation: ServiceImplementationIdentity): KeyProbeAttackProfile | undefined {
  const profile = KEYPROBE_ATTACK_PROFILES[implementation.releaseId]
  return profile && profile.serviceProductId === implementation.productId && profile.serviceBuildId === implementation.buildId ? profile : undefined
}

/**
 * Formation-side lookup: the one legitimate Player-Information route into a
 * KeyProbe profile. `observed` is exactly the display name/version a real
 * Inspect stored in Discovery — never a stable World Truth ID — so this can
 * never consult hidden current Service truth to decide what KeyProbe may
 * attempt.
 */
export function keyProbeProfileForObservedImplementation(observed: { readonly name: string; readonly version: string }): KeyProbeAttackProfile | undefined {
  return Object.values(KEYPROBE_ATTACK_PROFILES).find((profile) => profile.observedImplementationName === observed.name && profile.observedImplementationVersion === observed.version)
}

export interface CredentialAccessObservation {
  readonly endpoint: string
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly providerId?: CredentialAccessProviderId
  /** The specialized module's own required Vulnerability. Required when starting through the module; irrelevant to KeyProbe. */
  readonly vulnerabilityId?: string
  /** KeyProbe's own attacked authentication surface. Required when starting through KeyProbe; irrelevant to the specialized module. */
  readonly serviceImplementation?: ServiceImplementationIdentity
}

/** Whether SELF owns the standalone KeyProbe 1.0 installation. Vulnerability-agnostic by design: KeyProbe's own concrete profile governs which authentication surfaces are attackable, never a named weakness. */
export function ownsKeyProbe(state: Pick<GameState, 'player'>): boolean {
  return state.player.localDevice.installedSoftware.some(({ id, releaseId, buildId }) => id === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID && releaseId === 'keyprobe-1.0' && buildId === 'build-keyprobe-1.0-v0')
}

/** Concrete providers of the specialized Vulnerability-specific technique (standalone module or Flipper-integrated) for one named Vulnerability. AUTH-017 only; KeyProbe is never among these. */
export function ownedCredentialAccessModuleProviders(state: Pick<GameState, 'player'>, vulnerabilityId: string): readonly { readonly id: CredentialAccessProviderId; readonly name: string }[] {
  if (vulnerabilityId !== 'AUTH-017') return []
  const tool = findLocalTechniqueTool(state.player.localDevice, vulnerabilityId)
  if (!tool) return []
  const flipper = findInstalledFlipper(state.player.localDevice)
  const integrated = Boolean(flipper && flipperSupportsTechnique(flipper, vulnerabilityId))
  const standalone = findLocalFlipperModuleArtifacts(state.player.localDevice).find((file) => file.moduleId === CREDENTIAL_ACCESS_MODULE_ID && isSupportedFlipperModuleArtifact(file))
  return [{ id: integrated ? FLIPPER_PRODUCT_ID : 'credential-access-module', name: integrated ? `${tool.toolName} · ${tool.moduleName}` : standalone?.path ?? tool.moduleName }]
}

export function canFormCredentialAccessAttempt(state: Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'deviceAccess'>, observed: CredentialAccessObservation): boolean {
  const device = state.discovery.devices.find(({ id }) => id === observed.targetDeviceId)
  const service = device?.services.find(({ id, endpoint }) => id === observed.serviceId && endpoint === observed.endpoint)
  const accessed = state.deviceAccess.established.some((access) => access.sourceDeviceId === state.player.localDevice.id && access.targetDeviceId === observed.targetDeviceId && access.viaServiceId === observed.serviceId)
  if (!service || accessed) return false
  const requestedProvider = observed.providerId ?? 'credential-access-module'
  if (requestedProvider === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID) {
    // KeyProbe forms from the player's own legitimately identified authentication surface alone — no Vulnerability Knowledge required.
    return Boolean(ownsKeyProbe(state) && observed.serviceImplementation && keyProbeProfileForImplementation(observed.serviceImplementation))
  }
  const known = observed.vulnerabilityId !== undefined && state.knowledge.discoveredVulnerabilities.some((item) => item.targetDeviceId === observed.targetDeviceId && item.serviceId === observed.serviceId && item.vulnerabilityId === observed.vulnerabilityId)
  const tool = observed.vulnerabilityId !== undefined && ownedCredentialAccessModuleProviders(state, observed.vulnerabilityId).some(({ id }) => id === requestedProvider)
  return Boolean(known && tool)
}

export type StartCredentialAccessResult =
  | { status: 'started'; state: GameState; processId: string }
  | { status: 'not_available' | 'already_running' | 'access_established' | 'endpoint_not_found'; state: GameState }
  | { status: 'insufficient_memory'; state: GameState; requiredMiB: number; availableMiB: number }

export function startCredentialAccessAttemptFromObservation(state: GameState, observed: CredentialAccessObservation): StartCredentialAccessResult {
  const hasAccess = state.deviceAccess.established.some((access) => access.sourceDeviceId === state.player.localDevice.id && access.targetDeviceId === observed.targetDeviceId && access.viaServiceId === observed.serviceId)
  if (hasAccess) return { status: 'access_established', state }
  if (!canFormCredentialAccessAttempt(state, observed)) return { status: 'not_available', state }
  if (state.process.processes.some((process) => process.kind === 'credential_access' && process.status === 'running' && process.targetDeviceId === observed.targetDeviceId && process.serviceId === observed.serviceId)) return { status: 'already_running', state }
  const endpoint = resolveServiceEndpoint(state, observed.endpoint)
  if (!endpoint || endpoint === 'invalid' || endpoint.targetDeviceId !== observed.targetDeviceId || endpoint.serviceId !== observed.serviceId) return { status: 'endpoint_not_found', state }
  const started = startProcess(state.process, state.player.localDevice, {
    label: 'CREDENTIAL ACCESS',
    workRequired: CREDENTIAL_ACCESS_WORK_REQUIRED, ramRequiredMiB: CREDENTIAL_ACCESS_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }
  const installedHost = findInstalledFlipper(state.player.localDevice)
  const executionToolId = observed.providerId ?? 'credential-access-module'
  if (executionToolId === FLIPPER_PRODUCT_ID && !(installedHost && observed.vulnerabilityId !== undefined && flipperSupportsTechnique(installedHost, observed.vulnerabilityId))) return { status: 'not_available', state }
  const isKeyProbe = executionToolId === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID
  const keyProbe = isKeyProbe && observed.serviceImplementation ? keyProbeProfileForImplementation(observed.serviceImplementation) : undefined
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic' ? {
    ...process, kind: 'credential_access' as const, targetDeviceId: observed.targetDeviceId, serviceId: observed.serviceId,
    workRequired: keyProbe?.workRequired ?? CREDENTIAL_ACCESS_WORK_REQUIRED,
    startedEndpoint: observed.endpoint, toolId: executionToolId,
    ...(isKeyProbe ? { serviceImplementation: observed.serviceImplementation! } : { vulnerabilityId: observed.vulnerabilityId!, moduleId: CREDENTIAL_ACCESS_MODULE_ID }),
  } : process)
  return { status: 'started', processId: started.processId, state: { ...state, process: { ...started.state, processes } } }
}

/**
 * Current network address of the Process executor Device that actually owns
 * `executorDeviceId`, for the authentication history source-address
 * snapshot. Returns `undefined` when that identity does not legitimately
 * resolve to a represented Device; callers must never substitute another
 * Device's address in that case, as doing so would fabricate provenance.
 */
function resolveExecutorAddress(state: GameState, executorDeviceId: string): string | undefined {
  if (executorDeviceId === state.player.localDevice.id) return state.player.localDevice.network.ip
  return state.world.network.hosts.find(({ id }) => id === executorDeviceId)?.ip
}

/**
 * Owned by Credential Access: resolves every completed, unresolved
 * Credential Access Process against current world truth exactly once,
 * aggregating the resulting DeviceAccess and World mutations itself so the
 * canonical advancement boundary never has to thread them by hand.
 */
export function resolveCompletedCredentialAccessAttempts(state: GameState, random: () => number = Math.random): GameState {
  let deviceAccess = state.deviceAccess
  let world = state.world
  let changed = false
  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'credential_access' || process.status !== 'completed' || process.result) return process
    changed = true
    const resolved = resolveCompletedCredentialAccess({ ...state, deviceAccess, world }, process, random)
    deviceAccess = resolved.deviceAccess
    world = resolved.world
    return resolved.process
  })
  if (!changed) return state
  return { ...state, process: { ...state.process, processes }, deviceAccess, world }
}

export function resolveCompletedCredentialAccess(state: GameState, process: CredentialAccessProcess, random: () => number = Math.random): { process: CredentialAccessProcess; deviceAccess: GameState['deviceAccess']; world: GameState['world'] } {
  const resolved = resolveServiceEndpoint(state, process.startedEndpoint)
  const host = state.world.network.hosts.find(({ id }) => id === process.targetDeviceId)
  const service = host?.services?.find(({ id }) => id === process.serviceId)
  const validEndpoint = resolved !== 'invalid' && resolved?.targetDeviceId === process.targetDeviceId && resolved.serviceId === process.serviceId
  // The simulated target only "received" the attempt while the originally selected endpoint still resolves to the same network-usable Device and open Service.
  const reached = Boolean(host && isDeviceNetworkUsable(host.operational) && service?.open && validEndpoint)
  const failedResult = { process: { ...process, result: { status: 'attempt_failed' as const, message: 'Authentication attempt failed.' as const } }, deviceAccess: state.deviceAccess, world: state.world }
  if (!reached || !service) return failedResult

  const isKeyProbe = process.toolId === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID
  // KeyProbe's own current profile for whatever GateSSH release the Service actually runs right now —
  // consulted only to run the roll once the surface below is confirmed unchanged since the attempt started.
  const currentKeyProbeProfile = isKeyProbe ? keyProbeProfileForImplementation(service.implementation) : undefined
  // The attempted surface is still current only when the represented implementation exactly matches what
  // KeyProbe actually remembered attempting — a hidden GateSSH change to any other release, KeyProbe-supported
  // or not, is a surface mismatch, never a silent re-target.
  const validKeyProbeSurface = Boolean(currentKeyProbeProfile
    && process.serviceImplementation
    && service.implementation.productId === process.serviceImplementation.productId
    && service.implementation.releaseId === process.serviceImplementation.releaseId
    && service.implementation.buildId === process.serviceImplementation.buildId)
  const validSurface = Boolean(service.credentialAccess && (isKeyProbe
    ? validKeyProbeSurface
    : process.vulnerabilityId !== undefined && vulnerabilitiesForService(service).some(({ id }) => id === process.vulnerabilityId)))
  // An unresolvable executor identity is an impossible/stale state for currently supported Credential Access
  // (only the local Device forms these attempts); rather than fabricate provenance, no history record is appended.
  const sourceAddress = resolveExecutorAddress(state, process.executorDeviceId)
  // KeyProbe makes this one decision only after the current represented surface
  // is valid. The specialized module remains deterministic for AUTH-017.
  let succeeds = validSurface
  let rolled = false
  let protectedByAuthGuard = false
  if (validSurface && isKeyProbe) {
    const executor = process.executorDeviceId === state.player.localDevice.id
      ? state.player.localDevice
      : state.world.network.hosts.find(({ id }) => id === process.executorDeviceId)
    if (!executor?.hardware || !currentKeyProbeProfile) succeeds = false
    else {
      // AuthGuard's own protection role is GateSSH-release-scoped, never Vulnerability-scoped, so it applies
      // to any KeyProbe attempt against a release it protects.
      protectedByAuthGuard = authGuard10SupportsGateSshAuthentication(host?.installedSoftware, service)
      succeeds = random() < keyProbeSuccessChance(currentKeyProbeProfile, executor.hardware.cpu.computeCapacity, protectedByAuthGuard)
      rolled = true
    }
  }
  const result = succeeds ? 'SUCCESS' as const : 'FAILURE' as const
  const world = sourceAddress
    ? appendNetworkConnectionAttemptEvidence(
        appendAuthenticationHistoryForHost(state.world, process.targetDeviceId, { serviceId: service.id, serviceName: service.name, sourceAddress, result }),
        { sourceDeviceId: process.executorDeviceId, targetDeviceId: process.targetDeviceId, sourceAddress, targetAddress: host!.ip, serviceId: service.id, serviceName: service.name, result },
      )
    : state.world
  if (!succeeds) {
    // A narrow, mechanic-owned reason NodeScan can project safely: the
    // surface itself was no longer valid (KeyProbe's remembered GateSSH
    // attack surface, or the module's required Vulnerability, no longer
    // matches current World Truth), a rolled decision was rejected, or that
    // rolled decision was blunted by legitimately-resolvable AuthGuard
    // protection. Left absent only for the defensive missing-executor case,
    // where no decision was actually made.
    const reason = !validSurface ? 'surface_mismatch' as const : rolled ? (protectedByAuthGuard ? 'protection_observed' as const : 'authentication_rejected' as const) : undefined
    return {
      ...failedResult,
      process: {
        ...failedResult.process,
        result: { ...failedResult.process.result, ...(reason ? { reason } : {}) },
        ...(protectedByAuthGuard ? { authGuardProtectionObserved: true as const } : {}),
      },
      world,
    }
  }

  const existing = state.deviceAccess.established.find((access) => access.sourceDeviceId === process.executorDeviceId && access.targetDeviceId === process.targetDeviceId && access.viaServiceId === process.serviceId)
  if (existing) return { process: { ...process, result: { status: 'access_established', accessId: existing.id } }, deviceAccess: state.deviceAccess, world }
  const id = `access-${String(state.deviceAccess.nextId).padStart(4, '0')}`
  return { process: { ...process, result: { status: 'access_established', accessId: id } }, deviceAccess: { nextId: state.deviceAccess.nextId + 1, established: [...state.deviceAccess.established, {
    id, sourceDeviceId: process.executorDeviceId, targetDeviceId: process.targetDeviceId,
    viaServiceId: process.serviceId, viaServiceBuildId: service.implementation.buildId,
    ...(process.vulnerabilityId !== undefined ? { viaVulnerabilityId: process.vulnerabilityId } : {}),
    privilege: service.credentialAccess!.privilege,
  }] }, world }
}
