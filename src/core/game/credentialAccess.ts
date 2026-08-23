import { startProcess } from './processes'
import { resolveServiceEndpoint } from './serviceAnalysis'
import type { CredentialAccessProcess, GameState } from './types'
import { findInstalledBasicCredentialToolkit } from './software'

export const BASIC_CREDENTIAL_TOOLKIT_ID = 'basic-credential-toolkit' as const
export const CREDENTIAL_ACCESS_WORK_REQUIRED = 1200
export const CREDENTIAL_ACCESS_RAM_REQUIRED_MIB = 896

export interface CredentialAccessObservation {
  readonly endpoint: string
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly vulnerabilityId: string
  readonly toolId: typeof BASIC_CREDENTIAL_TOOLKIT_ID
}

export function canFormCredentialAccessAttempt(state: Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'deviceAccess'>, observed: CredentialAccessObservation): boolean {
  const device = state.discovery.devices.find(({ id }) => id === observed.targetDeviceId)
  const service = device?.services.find(({ id, endpoint }) => id === observed.serviceId && endpoint === observed.endpoint)
  const known = state.knowledge.discoveredVulnerabilities.some((item) => item.targetDeviceId === observed.targetDeviceId && item.serviceId === observed.serviceId && item.vulnerabilityId === observed.vulnerabilityId)
  const tool = Boolean(findInstalledBasicCredentialToolkit(state.player.localDevice))
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
  if (state.process.processes.some((process) => process.kind === 'credential_access' && process.status === 'running' && process.targetDeviceId === observed.targetDeviceId && process.serviceId === observed.serviceId && process.toolId === observed.toolId)) return { status: 'already_running', state }
  const endpoint = resolveServiceEndpoint(state, observed.endpoint)
  if (!endpoint || endpoint === 'invalid' || endpoint.targetDeviceId !== observed.targetDeviceId || endpoint.serviceId !== observed.serviceId) return { status: 'endpoint_not_found', state }
  const started = startProcess(state.process, state.player.localDevice, {
    label: 'CREDENTIAL ACCESS',
    workRequired: CREDENTIAL_ACCESS_WORK_REQUIRED, ramRequiredMiB: CREDENTIAL_ACCESS_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic' ? {
    ...process, kind: 'credential_access' as const, targetDeviceId: observed.targetDeviceId, serviceId: observed.serviceId,
    startedEndpoint: observed.endpoint, vulnerabilityId: observed.vulnerabilityId, toolId: observed.toolId,
  } : process)
  return { status: 'started', processId: started.processId, state: { ...state, process: { ...started.state, processes } } }
}

export function resolveCompletedCredentialAccess(state: GameState, process: CredentialAccessProcess): { process: CredentialAccessProcess; deviceAccess: GameState['deviceAccess'] } {
  const resolved = resolveServiceEndpoint(state, process.startedEndpoint)
  const host = state.world.network.hosts.find(({ id }) => id === process.targetDeviceId)
  const service = host?.services?.find(({ id }) => id === process.serviceId)
  const validEndpoint = resolved !== 'invalid' && resolved?.targetDeviceId === process.targetDeviceId && resolved.serviceId === process.serviceId
  const valid = host?.online && service?.open && validEndpoint && service.vulnerabilities?.some(({ id }) => id === process.vulnerabilityId) && service.credentialAccess
  if (!valid) return { process: { ...process, result: { status: 'attempt_failed', message: 'Target no longer responds as expected.' } }, deviceAccess: state.deviceAccess }
  const existing = state.deviceAccess.established.find((access) => access.sourceDeviceId === process.executorDeviceId && access.targetDeviceId === process.targetDeviceId && access.viaServiceId === process.serviceId)
  if (existing) return { process: { ...process, result: { status: 'access_established', accessId: existing.id } }, deviceAccess: state.deviceAccess }
  const id = `access-${String(state.deviceAccess.nextId).padStart(4, '0')}`
  return { process: { ...process, result: { status: 'access_established', accessId: id } }, deviceAccess: { nextId: state.deviceAccess.nextId + 1, established: [...state.deviceAccess.established, { id, sourceDeviceId: process.executorDeviceId, targetDeviceId: process.targetDeviceId, viaServiceId: process.serviceId, privilege: service.credentialAccess.privilege }] } }
}
