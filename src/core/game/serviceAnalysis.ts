import { startProcess } from './processes'
import type { GameState, NetworkService, ServiceAnalysisProcess } from './types'
import { isValidIpv4 } from './networkTarget'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { resolvePlayerNetworkPath } from './networkPath'

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
  const path = resolvePlayerNetworkPath(state, ip, port)
  return path.kind !== 'NO_ROUTE' && path.target && path.targetService ? { targetDeviceId: path.target.id, serviceId: path.targetService.id } : undefined
}

function currentService(state: GameState, targetDeviceId: string, serviceId: string): { usable: boolean; hostIp?: string; service?: NetworkService } {
  const host = state.world.network.hosts.find(({ id }) => id === targetDeviceId)
  return { usable: Boolean(host && isDeviceNetworkUsable(host.operational)), hostIp: host?.ip, service: host?.services?.find(({ id }) => id === serviceId) }
}

export function startServiceAnalysis(state: GameState, targetDeviceId: string, serviceId: string, dialedEndpoint?: string): StartServiceAnalysisResult {
  const current = currentService(state, targetDeviceId, serviceId)
  if (!current.usable || !current.hostIp || !current.service?.open) return { status: 'unavailable', state }
  // The player-visible endpoint they actually dialed — a Gateway's own public edge for an EXPOSED_EDGE
  // path — rather than the private backend address a caller resolving by Device+Service alone never named.
  const startedEndpoint = dialedEndpoint ?? `${current.hostIp}:${current.service.port}`
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
  return startServiceAnalysis(state, resolved.targetDeviceId, resolved.serviceId, endpoint)
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
  return startServiceAnalysis(state, resolved.targetDeviceId, resolved.serviceId, observed.endpoint)
}

/**
 * Owned by Service Analysis: resolves every completed, unresolved Service
 * Analysis Process against current world truth exactly once. Recon analysis
 * remembers endpoint evidence in Discovery; it never manufactures
 * Vulnerability Knowledge.
 */
export function resolveCompletedServiceAnalyses(state: GameState): GameState {
  let changed = false
  let discovery = state.discovery
  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'service_analysis' || process.status !== 'completed' || process.result) return process
    changed = true
    const resolved = resolveCompletedServiceAnalysis(state, process)
    if (resolved.process.analyzedImplementation) {
      const current = currentService(state, process.targetDeviceId, process.serviceId)
      const inspect = {
        implementation: resolved.process.analyzedImplementation,
        ...(current.service?.credentialAccess ? { authentication: 'Credential' as const } : {}),
        ...(current.service?.implementation.productId === 'rack-update' && current.service.implementation.releaseId === 'rack-update-1.0' ? { interface: 'Package submission' as const } : {}),
      }
      const deviceIndex = discovery.devices.findIndex(({ id }) => id === process.targetDeviceId)
      const device = discovery.devices[deviceIndex]
      if (device) {
        const serviceIndex = device.services.findIndex(({ id }) => id === process.serviceId)
        const services = [...device.services]
        if (serviceIndex >= 0) {
          const { implementationAnalysisStale: _stale, ...freshService } = services[serviceIndex]
          services[serviceIndex] = { ...freshService, inspect }
        } else if (current.service) {
          services.push({ id: current.service.id, name: current.service.name, port: current.service.port, protocol: current.service.protocol, endpoint: process.startedEndpoint, inspect })
        }
        const devices = [...discovery.devices]
        devices[deviceIndex] = { ...device, services }
        discovery = { ...discovery, devices }
      } else if (current.service) {
        // Directed Endpoint Analysis of a Device reached only through a Gateway's own exposed
        // edge — never itself revealed by a portless Scan of that edge — legitimately teaches the
        // Service evidence it exposed, keyed by the backend's own stable identity so later Access
        // and Session truth remain causally correct. It is never represented at the backend's own
        // private address: the player only ever observed the public endpoint they actually dialed,
        // and that dialed endpoint — never World Truth's own private `ip` — is what Discovery states.
        const dialedAddress = process.startedEndpoint.slice(0, process.startedEndpoint.lastIndexOf(':'))
        discovery = { ...discovery, devices: [...discovery.devices, {
          id: process.targetDeviceId, address: dialedAddress, scope: 'remote', servicesObserved: true,
          services: [{ id: current.service.id, name: current.service.name, port: current.service.port, protocol: current.service.protocol, endpoint: process.startedEndpoint, inspect }],
        }] }
      }
    }
    return resolved.process
  })
  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    discovery,
  }
}

/** Owned by Service Analysis: resolves finished work against current world truth exactly once. */
export function resolveCompletedServiceAnalysis(state: GameState, process: ServiceAnalysisProcess): { process: ServiceAnalysisProcess } {
  const current = currentService(state, process.targetDeviceId, process.serviceId)
  if (!current.usable || !current.service?.open) return { process: { ...process, result: { status: 'service_unavailable' } } }
  const analyzedImplementation = { name: current.service.implementation.name, version: current.service.implementation.version }
  return { process: { ...process, analyzedImplementation, result: { status: 'analysis_complete' } } }
}
