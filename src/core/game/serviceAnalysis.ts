import { startProcess } from './processes'
import type { GameState, NetworkService, ServiceAnalysisProcess } from './types'
import { isValidIpv4 } from './networkTarget'
import { vulnerabilitiesForService } from './serviceImplementations'

export const SERVICE_ANALYSIS_WORK_REQUIRED = 1000
export const SERVICE_ANALYSIS_RAM_REQUIRED_MIB = 768

export type StartServiceAnalysisResult =
  | { status: 'started'; state: GameState; processId: string }
  | { status: 'unavailable' | 'already_running'; state: GameState }
  | { status: 'insufficient_memory'; state: GameState; requiredMiB: number; availableMiB: number }

export type EndpointAnalysisResult = StartServiceAnalysisResult | { status: 'invalid_endpoint' | 'endpoint_not_found'; state: GameState }

export function resolveServiceEndpoint(state: GameState, endpoint: string): { targetDeviceId: string; serviceId: string } | 'invalid' | undefined {
  const separator = endpoint.lastIndexOf(':')
  if (separator < 1 || endpoint.indexOf(':') !== separator) return 'invalid'
  const ip = endpoint.slice(0, separator); const portText = endpoint.slice(separator + 1)
  if (!isValidIpv4(ip) || !/^\d+$/.test(portText)) return 'invalid'
  const port = Number(portText)
  if (port < 1 || port > 65535) return 'invalid'
  const host = state.world.network.hosts.find((candidate) => candidate.ip === ip)
  const service = host?.services?.find((candidate) => candidate.port === port)
  return host && service ? { targetDeviceId: host.id, serviceId: service.id } : undefined
}

function currentService(state: GameState, targetDeviceId: string, serviceId: string): { online: boolean; hostIp?: string; service?: NetworkService } {
  const host = state.world.network.hosts.find(({ id }) => id === targetDeviceId)
  return { online: host?.online ?? false, hostIp: host?.ip, service: host?.services?.find(({ id }) => id === serviceId) }
}

export function startServiceAnalysis(state: GameState, targetDeviceId: string, serviceId: string): StartServiceAnalysisResult {
  const current = currentService(state, targetDeviceId, serviceId)
  if (!current.online || !current.hostIp || !current.service?.open) return { status: 'unavailable', state }
  const startedEndpoint = `${current.hostIp}:${current.service.port}`
  if (state.process.processes.some((process) => process.kind === 'service_analysis' && process.status === 'running' && process.targetDeviceId === targetDeviceId && process.serviceId === serviceId)) return { status: 'already_running', state }
  const started = startProcess(state.process, state.player.localDevice, {
    label: 'SERVICE ANALYSIS',
    workRequired: SERVICE_ANALYSIS_WORK_REQUIRED, ramRequiredMiB: SERVICE_ANALYSIS_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic'
    ? { ...process, kind: 'service_analysis' as const, targetDeviceId, serviceId, startedEndpoint }
    : process)
  return { status: 'started', processId: started.processId, state: { ...state, process: { ...started.state, processes } } }
}

export function startServiceAnalysisAtEndpoint(state: GameState, endpoint: string): EndpointAnalysisResult {
  const resolved = resolveServiceEndpoint(state, endpoint)
  if (resolved === 'invalid') return { status: 'invalid_endpoint', state }
  if (!resolved) return { status: 'endpoint_not_found', state }
  return startServiceAnalysis(state, resolved.targetDeviceId, resolved.serviceId)
}

export interface ObservedServiceTarget {
  readonly endpoint: string
  readonly targetDeviceId: string
  readonly serviceId: string
}

/** Start only while a player-visible observation still identifies the same service. */
export function startServiceAnalysisFromObservation(state: GameState, observed: ObservedServiceTarget): EndpointAnalysisResult {
  const resolved = resolveServiceEndpoint(state, observed.endpoint)
  if (resolved === 'invalid') return { status: 'invalid_endpoint', state }
  if (!resolved || resolved.targetDeviceId !== observed.targetDeviceId || resolved.serviceId !== observed.serviceId) {
    return { status: 'endpoint_not_found', state }
  }
  return startServiceAnalysis(state, resolved.targetDeviceId, resolved.serviceId)
}

/** Owned by Service Analysis: resolves finished work against current world truth exactly once. */
export function resolveCompletedServiceAnalysis(state: GameState, process: ServiceAnalysisProcess): { process: ServiceAnalysisProcess; discoveries: GameState['knowledge']['discoveredVulnerabilities'] } {
  const current = currentService(state, process.targetDeviceId, process.serviceId)
  if (!current.online || !current.service?.open) return { process: { ...process, result: { status: 'service_unavailable' } }, discoveries: [] }
  const rememberedImplementation = state.discovery.devices.find(({ id }) => id === process.targetDeviceId)
    ?.services.find(({ id }) => id === process.serviceId)?.inspect?.implementation
  const analyzedImplementation = rememberedImplementation
    && rememberedImplementation.name === current.service.implementation.name
    && rememberedImplementation.version === current.service.implementation.version
    ? rememberedImplementation
    : undefined
  const vulnerabilities = vulnerabilitiesForService(current.service)
  if (!vulnerabilities.length) return { process: { ...process, ...(analyzedImplementation ? { analyzedImplementation } : {}), result: { status: 'no_weakness_detected' } }, discoveries: [] }
  const found = vulnerabilities.map(({ id, label }) => ({ vulnerabilityId: id, observedLabel: label }))
  return {
    process: { ...process, ...(analyzedImplementation ? { analyzedImplementation } : {}), result: { status: 'weaknesses_detected', vulnerabilities: found } },
    discoveries: found.map(({ vulnerabilityId, observedLabel }) => ({ vulnerabilityId, observedLabel, targetDeviceId: process.targetDeviceId, serviceId: process.serviceId })),
  }
}
