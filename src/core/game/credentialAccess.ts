import { startProcess } from './processes'
import { resolveServiceEndpoint } from './serviceAnalysis'
import type { CredentialAccessProcess, GameState } from './types'
import { FLIPPER_PRODUCT_ID, findInstalledFlipper, findLocalFlipperModuleArtifacts, findLocalTechniqueTool, flipperSupportsTechnique, isSupportedFlipperModuleArtifact } from './flipper'
import { vulnerabilitiesForService } from './serviceImplementations'
import { appendAuthenticationHistoryForHost } from './authenticationHistory'
import { appendNetworkConnectionAttemptEvidence } from './networkActivityHistory'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { authGuard10SupportsGateSshAuthentication } from './authGuard'

/** The one Flipper module that supplies this technique. It is domain truth, never supplied by an interface. */
const CREDENTIAL_ACCESS_MODULE_ID = 'credential-access' as const
export const STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID = 'keyprobe' as const
export type CredentialAccessProviderId = CredentialAccessProcess['toolId']
export const CREDENTIAL_ACCESS_WORK_REQUIRED = 1200
export const CREDENTIAL_ACCESS_RAM_REQUIRED_MIB = 896

export interface CredentialAccessObservation {
  readonly endpoint: string
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly vulnerabilityId: string
  readonly providerId?: CredentialAccessProviderId
}

function ownsStandardProvider(state: Pick<GameState, 'player'>): boolean {
  return state.player.localDevice.installedSoftware.some(({ id, releaseId, buildId }) => id === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID && releaseId === 'keyprobe-1.0' && buildId === 'build-keyprobe-1.0-v0')
}

export function ownedCredentialAccessProviders(state: Pick<GameState, 'player'>, vulnerabilityId: string): readonly { readonly id: CredentialAccessProviderId; readonly name: string }[] {
  if (vulnerabilityId !== 'AUTH-017' && vulnerabilityId !== 'AUTH-031') return []
  const providers: { id: CredentialAccessProviderId; name: string }[] = []
  if (ownsStandardProvider(state)) providers.push({ id: STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID, name: 'KeyProbe' })
  const tool = vulnerabilityId === 'AUTH-017' ? findLocalTechniqueTool(state.player.localDevice, vulnerabilityId) : undefined
  const flipper = findInstalledFlipper(state.player.localDevice)
  if (tool) {
    const integrated = Boolean(flipper && flipperSupportsTechnique(flipper, vulnerabilityId))
    const standalone = findLocalFlipperModuleArtifacts(state.player.localDevice).find((file) => file.moduleId === CREDENTIAL_ACCESS_MODULE_ID && isSupportedFlipperModuleArtifact(file))
    providers.push({ id: integrated ? FLIPPER_PRODUCT_ID : 'credential-access-module', name: integrated ? `${tool.toolName} · ${tool.moduleName}` : standalone?.path ?? tool.moduleName })
  }
  return providers
}

export function canFormCredentialAccessAttempt(state: Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'deviceAccess'>, observed: CredentialAccessObservation): boolean {
  const device = state.discovery.devices.find(({ id }) => id === observed.targetDeviceId)
  const service = device?.services.find(({ id, endpoint }) => id === observed.serviceId && endpoint === observed.endpoint)
  const known = state.knowledge.discoveredVulnerabilities.some((item) => item.targetDeviceId === observed.targetDeviceId && item.serviceId === observed.serviceId && item.vulnerabilityId === observed.vulnerabilityId)
  const requestedProvider = observed.providerId ?? 'credential-access-module'
  const tool = ownedCredentialAccessProviders(state, observed.vulnerabilityId).some(({ id }) => id === requestedProvider)
  const accessed = state.deviceAccess.established.some((access) => access.sourceDeviceId === state.player.localDevice.id && access.targetDeviceId === observed.targetDeviceId && access.viaServiceId === observed.serviceId)
  return Boolean(service && known && tool && !accessed)
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
  if (executionToolId === FLIPPER_PRODUCT_ID && !(installedHost && flipperSupportsTechnique(installedHost, observed.vulnerabilityId))) return { status: 'not_available', state }
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic' ? {
    ...process, kind: 'credential_access' as const, targetDeviceId: observed.targetDeviceId, serviceId: observed.serviceId,
    startedEndpoint: observed.endpoint, vulnerabilityId: observed.vulnerabilityId, toolId: executionToolId,
    ...(executionToolId === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID ? {} : { moduleId: CREDENTIAL_ACCESS_MODULE_ID }),
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

  const validSurface = Boolean(vulnerabilitiesForService(service).some(({ id }) => id === process.vulnerabilityId) && service.credentialAccess)
  // An unresolvable executor identity is an impossible/stale state for currently supported Credential Access
  // (only the local Device forms these attempts); rather than fabricate provenance, no history record is appended.
  const sourceAddress = resolveExecutorAddress(state, process.executorDeviceId)
  // KeyProbe makes this one decision only after the current represented surface
  // is valid. The specialized module remains deterministic for AUTH-017.
  let succeeds = validSurface
  if (validSurface && process.toolId === STANDARD_CREDENTIAL_ACCESS_PROVIDER_ID) {
    const chance = process.vulnerabilityId === 'AUTH-017' ? 0.75
      : process.vulnerabilityId === 'AUTH-031' && authGuard10SupportsGateSshAuthentication(host?.installedSoftware, service) ? 0.05
        : process.vulnerabilityId === 'AUTH-031' ? 0.5 : 0
    succeeds = random() < chance
  }
  const result = succeeds ? 'SUCCESS' as const : 'FAILURE' as const
  const world = sourceAddress
    ? appendNetworkConnectionAttemptEvidence(
        appendAuthenticationHistoryForHost(state.world, process.targetDeviceId, { serviceId: service.id, serviceName: service.name, sourceAddress, result }),
        { sourceDeviceId: process.executorDeviceId, targetDeviceId: process.targetDeviceId, sourceAddress, targetAddress: host!.ip, serviceId: service.id, serviceName: service.name, result },
      )
    : state.world
  if (!succeeds) return {
    ...failedResult,
    process: {
      ...failedResult.process,
      ...(process.vulnerabilityId === 'AUTH-031' && authGuard10SupportsGateSshAuthentication(host!.installedSoftware, service)
        ? { authGuardProtectionObserved: true as const }
        : {}),
    },
    world,
  }

  const existing = state.deviceAccess.established.find((access) => access.sourceDeviceId === process.executorDeviceId && access.targetDeviceId === process.targetDeviceId && access.viaServiceId === process.serviceId)
  if (existing) return { process: { ...process, result: { status: 'access_established', accessId: existing.id } }, deviceAccess: state.deviceAccess, world }
  const id = `access-${String(state.deviceAccess.nextId).padStart(4, '0')}`
  return { process: { ...process, result: { status: 'access_established', accessId: id } }, deviceAccess: { nextId: state.deviceAccess.nextId + 1, established: [...state.deviceAccess.established, { id, sourceDeviceId: process.executorDeviceId, targetDeviceId: process.targetDeviceId, viaServiceId: process.serviceId, privilege: service.credentialAccess!.privilege }] }, world }
}
