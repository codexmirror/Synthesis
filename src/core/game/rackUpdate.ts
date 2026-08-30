import { startProcess } from './processes'
import { resolveServiceEndpoint } from './serviceAnalysis'
import { findInstalledRollbackExploitToolkit, rollbackExploitToolkitSupports } from './software'
import {
  GATE_SSH_1_3_2_RELEASE_ID,
  GATE_SSH_1_3_3_RELEASE_ID,
  GATE_SSH_1_4_0_RELEASE_ID,
  GATE_SSH_PRODUCT_ID,
  RACK_UPDATE_1_0_RELEASE_ID,
  RACK_UPDATE_PRODUCT_ID,
  vulnerabilitiesForService,
} from './serviceImplementations'
import { deriveCrossNetworkTransferRateBytesPerSecond, deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from './networkTransferCapacity'
import { appendNetworkPackageSubmissionEvidence, resolveDeviceLocalNetworkMembership } from './networkActivityHistory'
import { refreshSubmittedServiceImplementation } from './discovery'
import type { GameState, InstalledSoftware, NetworkHost, NetworkService, RackUpdateExploitProcess, RackUpdatePackageSubmission } from './types'

export const ROLLBACK_EXPLOIT_TOOLKIT_ID = 'rollback-exploit-toolkit' as const
export const RACK_UPDATE_EXPLOIT_WORK_REQUIRED = 1400
export const RACK_UPDATE_EXPLOIT_RAM_REQUIRED_MIB = 768

/** Concrete recognized GateSSH releases RackUpdate's submission protocol accepts, older or newer than whatever is currently managed. */
const GATE_SSH_KNOWN_RELEASE_IDS: ReadonlySet<string> = new Set([GATE_SSH_1_3_2_RELEASE_ID, GATE_SSH_1_3_3_RELEASE_ID, GATE_SSH_1_4_0_RELEASE_ID])

/* --------------------------------------------------------------------- */
/* ATTACK: RackUpdate exploit — finite work, narrow submission capability */
/* --------------------------------------------------------------------- */

export interface RackUpdateExploitObservation {
  readonly endpoint: string
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly vulnerabilityId: string
  readonly toolId: typeof ROLLBACK_EXPLOIT_TOOLKIT_ID
}

function hasSubmissionAccess(state: Pick<GameState, 'player' | 'rackUpdate'>, targetDeviceId: string, serviceId: string): boolean {
  return state.rackUpdate.access.established.some((access) =>
    access.sourceDeviceId === state.player.localDevice.id && access.targetDeviceId === targetDeviceId && access.viaServiceId === serviceId)
}

/**
 * A legitimate ATTACK opportunity: earned Knowledge of the observed weakness,
 * plus an installed tool that actually supports it, on a Service the player
 * still has not already exploited. This never consults current World Truth.
 */
export function canFormRackUpdateExploitAttempt(state: Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'rackUpdate'>, observed: RackUpdateExploitObservation): boolean {
  const device = state.discovery.devices.find(({ id }) => id === observed.targetDeviceId)
  const service = device?.services.find(({ id, endpoint }) => id === observed.serviceId && endpoint === observed.endpoint)
  const known = state.knowledge.discoveredVulnerabilities.some((item) => item.targetDeviceId === observed.targetDeviceId && item.serviceId === observed.serviceId && item.vulnerabilityId === observed.vulnerabilityId)
  const installation = findInstalledRollbackExploitToolkit(state.player.localDevice)
  const tool = Boolean(installation && rollbackExploitToolkitSupports(installation, observed.vulnerabilityId))
  return Boolean(service && known && tool && !hasSubmissionAccess(state, observed.targetDeviceId, observed.serviceId))
}

export type StartRackUpdateExploitResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: 'not_available' | 'already_running' | 'submission_enabled' | 'endpoint_not_found'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/** Start the finite ATTACK Process. Completion never resolves immediately — success only ever grants the narrow submission relationship, never DeviceAccess or a RemoteSession. */
export function startRackUpdateExploitAttemptFromObservation(state: GameState, observed: RackUpdateExploitObservation): StartRackUpdateExploitResult {
  if (hasSubmissionAccess(state, observed.targetDeviceId, observed.serviceId)) return { status: 'submission_enabled', state }
  if (!canFormRackUpdateExploitAttempt(state, observed)) return { status: 'not_available', state }
  if (state.process.processes.some((process) => process.kind === 'rack_update_exploit' && process.status === 'running' && process.targetDeviceId === observed.targetDeviceId && process.serviceId === observed.serviceId && process.toolId === observed.toolId)) {
    return { status: 'already_running', state }
  }
  const endpoint = resolveServiceEndpoint(state, observed.endpoint)
  if (!endpoint || endpoint === 'invalid' || endpoint.targetDeviceId !== observed.targetDeviceId || endpoint.serviceId !== observed.serviceId) return { status: 'endpoint_not_found', state }
  const started = startProcess(state.process, state.player.localDevice, {
    label: 'ROLLBACK EXPLOIT',
    workRequired: RACK_UPDATE_EXPLOIT_WORK_REQUIRED, ramRequiredMiB: RACK_UPDATE_EXPLOIT_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic' ? {
    ...process, kind: 'rack_update_exploit' as const, targetDeviceId: observed.targetDeviceId, serviceId: observed.serviceId,
    startedEndpoint: observed.endpoint, vulnerabilityId: observed.vulnerabilityId, toolId: observed.toolId,
  } : process)
  return { status: 'started', processId: started.processId, state: { ...state, process: { ...started.state, processes } } }
}

/** Owned by the RackUpdate exploit: resolves finished work against current world truth exactly once. */
export function resolveCompletedRackUpdateExploit(state: GameState, process: RackUpdateExploitProcess): { readonly process: RackUpdateExploitProcess; readonly rackUpdateAccess: GameState['rackUpdate']['access'] } {
  const resolved = resolveServiceEndpoint(state, process.startedEndpoint)
  const host = state.world.network.hosts.find(({ id }) => id === process.targetDeviceId)
  const service = host?.services?.find(({ id }) => id === process.serviceId)
  const validEndpoint = resolved !== 'invalid' && resolved?.targetDeviceId === process.targetDeviceId && resolved.serviceId === process.serviceId
  const reached = Boolean(host?.online && service?.open && validEndpoint)
  const failedResult = { process: { ...process, result: { status: 'attempt_failed' as const, message: 'Exploit attempt failed.' as const } }, rackUpdateAccess: state.rackUpdate.access }
  if (!reached || !service) return failedResult

  const succeeds = vulnerabilitiesForService(service).some(({ id }) => id === process.vulnerabilityId)
  if (!succeeds) return failedResult

  const existing = state.rackUpdate.access.established.find((access) => access.sourceDeviceId === process.executorDeviceId && access.targetDeviceId === process.targetDeviceId && access.viaServiceId === process.serviceId)
  if (existing) return { process: { ...process, result: { status: 'submission_enabled', accessId: existing.id } }, rackUpdateAccess: state.rackUpdate.access }
  const id = `rack-update-access-${String(state.rackUpdate.access.nextId).padStart(4, '0')}`
  return {
    process: { ...process, result: { status: 'submission_enabled', accessId: id } },
    rackUpdateAccess: {
      nextId: state.rackUpdate.access.nextId + 1,
      established: [...state.rackUpdate.access.established, { id, sourceDeviceId: process.executorDeviceId, targetDeviceId: process.targetDeviceId, viaServiceId: process.serviceId }],
    },
  }
}

/* ----------------------------------------------------------------------- */
/* Package submission: represented upload work, not an instant mutation    */
/* ----------------------------------------------------------------------- */

export interface RackUpdateSubmissionObservation {
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly endpoint: string
  readonly localFileId: string
}

export type StartRackUpdatePackageSubmissionResult =
  | { readonly status: 'started'; readonly state: GameState; readonly submissionId: string }
  | { readonly status: 'observation_required' | 'access_required' | 'service_unavailable' | 'package_unavailable' | 'package_incompatible' | 'submission_in_progress' | 'local_offline' | 'capacity_unavailable'; readonly state: GameState }

function resolveManagedGateSshService(target: NetworkHost): NetworkService | undefined {
  return target.services?.find(({ implementation }) => implementation.productId === GATE_SSH_PRODUCT_ID)
}

/**
 * Admit one represented local GateSSH package into finite network upload work
 * carrying its bytes to RackUpdate's own package-submission interface. This
 * requires the narrow `RackUpdateSubmissionAccess` a successful exploit
 * granted; it is never a filesystem Upload and creates no destination
 * artifact — it takes package bytes to a Service, and application happens
 * only once the upload actually completes (see `advanceRackUpdatePackageSubmission`).
 */
export function startRackUpdatePackageSubmission(state: GameState, input: RackUpdateSubmissionObservation): StartRackUpdatePackageSubmissionResult {
  const observedDevice = state.discovery.devices.find(({ id }) => id === input.targetDeviceId)
  const observedService = observedDevice?.services.find(({ id, endpoint, inspect }) =>
    id === input.serviceId && endpoint === input.endpoint && inspect?.interface === 'Package submission')
  if (!observedService) return { status: 'observation_required', state }

  const local = state.player.localDevice
  const grant = state.rackUpdate.access.established.find((access) =>
    access.sourceDeviceId === local.id && access.targetDeviceId === input.targetDeviceId && access.viaServiceId === input.serviceId)
  if (!grant) return { status: 'access_required', state }

  const localFile = local.filesystem.files.find(({ id }) => id === input.localFileId)
  if (!localFile) return { status: 'package_unavailable', state }
  if (localFile.kind !== 'software_package' || localFile.productId !== GATE_SSH_PRODUCT_ID || !GATE_SSH_KNOWN_RELEASE_IDS.has(localFile.releaseId)) {
    return { status: 'package_incompatible', state }
  }

  const targetIndex = state.world.network.hosts.findIndex(({ id }) => id === input.targetDeviceId)
  const target = state.world.network.hosts[targetIndex]
  const update = target?.services?.find(({ id }) => id === input.serviceId)
  if (!target || !target.online || !update || !update.open || `${target.ip}:${update.port}` !== input.endpoint
    || update.implementation.productId !== RACK_UPDATE_PRODUCT_ID || update.implementation.releaseId !== RACK_UPDATE_1_0_RELEASE_ID) {
    return { status: 'service_unavailable', state }
  }
  const managed = resolveManagedGateSshService(target)
  if (!managed || managed.implementation.releaseId === localFile.releaseId) return { status: 'package_incompatible', state }

  if (state.rackUpdate.submission.active) return { status: 'submission_in_progress', state }
  if (local.runtime.networkStatus !== 'ONLINE') return { status: 'local_offline', state }
  if (!isValidNetworkTransferCapacity(local.network.transferCapacity) || !target.transferCapacity || !isValidNetworkTransferCapacity(target.transferCapacity)) {
    return { status: 'capacity_unavailable', state }
  }

  const submissionId = `rack-update-submission-${String(state.rackUpdate.submission.nextId).padStart(4, '0')}`
  const submission: RackUpdatePackageSubmission = {
    id: submissionId, accessId: grant.id, sourceDeviceId: local.id, sourceFileId: localFile.id,
    targetDeviceId: target.id, serviceId: update.id, bytesTotal: localFile.sizeBytes, bytesTransferred: 0,
  }
  return {
    status: 'started', submissionId,
    state: { ...state, rackUpdate: { ...state.rackUpdate, submission: { nextId: state.rackUpdate.submission.nextId + 1, active: submission } } },
  }
}

interface SubmissionEndpoints {
  readonly target: NetworkHost
  readonly localFile: { readonly releaseId: string; readonly name: string; readonly version: string }
  readonly rateBytesPerSecond: number
}

/** Ongoing validity is derived fresh from current canonical state, exactly like FileTransfer, so a stale display attribute never kills or misroutes a running submission. */
function resolveSubmissionEndpoints(state: GameState, submission: RackUpdatePackageSubmission): SubmissionEndpoints | undefined {
  const local = state.player.localDevice
  if (local.runtime.networkStatus !== 'ONLINE' || local.id !== submission.sourceDeviceId) return undefined
  const grant = state.rackUpdate.access.established.find(({ id }) => id === submission.accessId)
  if (!grant || grant.targetDeviceId !== submission.targetDeviceId || grant.viaServiceId !== submission.serviceId) return undefined
  const target = state.world.network.hosts.find(({ id }) => id === submission.targetDeviceId)
  if (!target?.online || !target.transferCapacity) return undefined
  const update = target.services?.find(({ id }) => id === submission.serviceId)
  if (!update?.open || update.implementation.productId !== RACK_UPDATE_PRODUCT_ID || update.implementation.releaseId !== RACK_UPDATE_1_0_RELEASE_ID) return undefined
  const localFile = local.filesystem.files.find(({ id }) => id === submission.sourceFileId)
  if (!localFile || localFile.kind !== 'software_package') return undefined
  if (!isValidNetworkTransferCapacity(local.network.transferCapacity) || !isValidNetworkTransferCapacity(target.transferCapacity)) return undefined

  const sourceMembership = resolveDeviceLocalNetworkMembership(state.world.network, local.id)
  const destinationMembership = resolveDeviceLocalNetworkMembership(state.world.network, target.id)
  if (sourceMembership.kind === 'ambiguous' || destinationMembership.kind === 'ambiguous') return undefined
  const sourceNetwork = sourceMembership.kind === 'unique' ? sourceMembership.network : undefined
  const destinationNetwork = destinationMembership.kind === 'unique' ? destinationMembership.network : undefined
  const isCrossNetwork = !!sourceNetwork && !!destinationNetwork && sourceNetwork.id !== destinationNetwork.id
  let rateBytesPerSecond: number
  if (isCrossNetwork) {
    if (!isValidNetworkTransferCapacity(sourceNetwork.transferCapacity) || !isValidNetworkTransferCapacity(destinationNetwork.transferCapacity)) return undefined
    rateBytesPerSecond = deriveCrossNetworkTransferRateBytesPerSecond(local.network.transferCapacity, sourceNetwork.transferCapacity, destinationNetwork.transferCapacity, target.transferCapacity)
  } else {
    rateBytesPerSecond = deriveEffectiveTransferRateBytesPerSecond(local.network.transferCapacity, target.transferCapacity)
  }
  return { target, localFile, rateBytesPerSecond }
}

/** Current effective throughput for the active submission, derived fresh rather than stored. Zero when it cannot presently advance. */
export function deriveActiveRackUpdateSubmissionRateBytesPerSecond(state: GameState, submission: RackUpdatePackageSubmission): number {
  return resolveSubmissionEndpoints(state, submission)?.rateBytesPerSecond ?? 0
}

function resolveDeviceNetworkAddress(state: GameState, deviceId: string): string | undefined {
  if (deviceId === state.player.localDevice.id) return state.player.localDevice.network.ip
  return state.world.network.hosts.find(({ id }) => id === deviceId)?.ip
}

/**
 * Terminal Network-owned evidence for this upload's traffic, under its own
 * `package_submission` record kind — never `file_transfer`, because a
 * RackUpdate submission is not a FileTransfer and Network World Truth must
 * not claim one occurred. It reuses the exact same membership, perspective,
 * retention, and terminal-result semantics `FileTransfer` evidence uses.
 * Appended only once, at the terminal outcome — never once per advancement
 * tick.
 */
function appendSubmissionNetworkEvidence(state: GameState, submission: RackUpdatePackageSubmission, result: 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED', bytesTransferred: number): GameState {
  const sourceAddress = resolveDeviceNetworkAddress(state, submission.sourceDeviceId)
  const destinationAddress = resolveDeviceNetworkAddress(state, submission.targetDeviceId)
  if (!sourceAddress || !destinationAddress) return state
  const world = appendNetworkPackageSubmissionEvidence(state.world, {
    sourceDeviceId: submission.sourceDeviceId, destinationDeviceId: submission.targetDeviceId,
    sourceAddress, destinationAddress, bytesTransferred, result,
  })
  return world === state.world ? state : { ...state, world }
}

/**
 * Applies the submitted package's release to the target's canonical GateSSH
 * Service and installed-software inventory exactly once, at real upload
 * completion — never speculatively, and never partially. Also refreshes only the one already-remembered Enhanced
 * Inspect fingerprint this successful action legitimately establishes; it
 * never touches unrelated remembered evidence or hidden World Truth.
 */
function applyRackUpdateSubmission(state: GameState, submission: RackUpdatePackageSubmission): GameState {
  const targetIndex = state.world.network.hosts.findIndex(({ id }) => id === submission.targetDeviceId)
  const target = state.world.network.hosts[targetIndex]
  const localFile = state.player.localDevice.filesystem.files.find(({ id }) => id === submission.sourceFileId)
  const managed = target ? resolveManagedGateSshService(target) : undefined
  if (!target || !target.installedSoftware || !localFile || localFile.kind !== 'software_package' || !managed) return state

  const implementation = { productId: GATE_SSH_PRODUCT_ID, releaseId: localFile.releaseId, name: 'GateSSH', version: localFile.version }
  const services = target.services!.map((service) => service.id === managed.id ? { ...service, implementation } : service)
  const installation: InstalledSoftware = { id: GATE_SSH_PRODUCT_ID, releaseId: localFile.releaseId, name: localFile.name, version: localFile.version, ...(localFile.channel ? { channel: localFile.channel } : {}), ...(localFile.publisher ? { publisher: localFile.publisher } : {}) }
  const installedSoftware = target.installedSoftware.some(({ id }) => id === GATE_SSH_PRODUCT_ID)
    ? target.installedSoftware.map((software) => software.id === GATE_SSH_PRODUCT_ID ? installation : software)
    : [...target.installedSoftware, installation]
  const hosts = state.world.network.hosts.map((host, index) => index === targetIndex ? { ...host, services, installedSoftware } : host)
  const discovery = refreshSubmittedServiceImplementation(state.discovery, target.id, managed.id, { name: implementation.name, version: implementation.version })
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts } }, discovery }
}

/**
 * Canonical advancement for the RackUpdate submission network runtime,
 * called from `advanceGameState` alongside `advanceFileTransfer`. Cancelling,
 * interrupting, or failing this upload never applies any part of the package:
 * the release swap happens exactly once, only once `bytesTransferred` actually
 * reaches `bytesTotal`.
 */
export function advanceRackUpdatePackageSubmission(state: GameState, elapsedMs: number): GameState {
  const submission = state.rackUpdate.submission.active
  if (!submission) return state
  const endpoints = resolveSubmissionEndpoints(state, submission)
  if (!endpoints) {
    const interrupted = appendSubmissionNetworkEvidence(state, submission, 'INTERRUPTED', submission.bytesTransferred)
    return { ...interrupted, rackUpdate: { ...interrupted.rackUpdate, submission: { ...interrupted.rackUpdate.submission, active: null } } }
  }
  const bytesTransferred = Math.min(submission.bytesTotal, submission.bytesTransferred + endpoints.rateBytesPerSecond * (Math.max(0, elapsedMs) / 1000))
  if (bytesTransferred < submission.bytesTotal) {
    return { ...state, rackUpdate: { ...state.rackUpdate, submission: { ...state.rackUpdate.submission, active: { ...submission, bytesTransferred } } } }
  }

  const finalSubmission = { ...submission, bytesTransferred }
  const applied = applyRackUpdateSubmission(state, finalSubmission)
  const completed = appendSubmissionNetworkEvidence(applied, finalSubmission, 'COMPLETED', bytesTransferred)
  return { ...completed, rackUpdate: { ...completed.rackUpdate, submission: { ...completed.rackUpdate.submission, active: null } } }
}

export type CancelRackUpdatePackageSubmissionResult = { readonly status: 'cancelled' | 'not_found'; readonly state: GameState }

/** Cancellation never applies any part of the package: it only clears the active runtime and records the interruption's real progress as Network evidence. */
export function cancelRackUpdatePackageSubmission(state: GameState, submissionId: string): CancelRackUpdatePackageSubmissionResult {
  const submission = state.rackUpdate.submission.active
  if (submission?.id !== submissionId) return { status: 'not_found', state }
  const cancelled = appendSubmissionNetworkEvidence(state, submission, 'CANCELLED', submission.bytesTransferred)
  return { status: 'cancelled', state: { ...cancelled, rackUpdate: { ...cancelled.rackUpdate, submission: { ...cancelled.rackUpdate.submission, active: null } } } }
}
