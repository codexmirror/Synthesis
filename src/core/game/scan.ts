import { classifyHostScope, isValidIpv4, resolveDeviceNetwork, resolveLocalNetwork, resolveNetworkGateway, resolveNetworkTarget, type NetworkTargets } from './networkTarget'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { classifyDeviceKind } from './deviceClassification'
import { findInstalledNodeScan, nodeScanSupportsDeviceClassification } from './software'
import type { DeviceClassification } from './types'
import type { GameState, LocalDeviceState, NetworkHost } from './types'
import { resolveNetworkPath, resolveDevice } from './networkPath'

export type ScanTargets = NetworkTargets

/**
 * The Network context a Host Scan may legitimately reveal: stable identity
 * and routing/default-gateway identity. It never enumerates member Devices.
 */
export interface DiscoveredNetworkRelation {
  readonly id: string
  readonly cidr?: string
  readonly gateway?: { readonly targetId: string; readonly address: string; readonly scope: 'lan' | 'remote' }
}

export interface DiscoveredService {
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
}

export type ScanResult =
  | {
    readonly status: 'device'
    readonly targetId: string
    readonly address: string
    readonly scope: 'self' | 'lan' | 'remote'
    readonly networks: readonly DiscoveredNetworkRelation[]
    readonly services: readonly DiscoveredService[]
    /**
     * A Gateway's own currently forwarded exposures, observed at this same public address: the public
     * edge's own real observable surface. Present only for a portless Scan of a Gateway's public edge
     * itself, never for any other target. It reveals that a Service is reachable here and what it is,
     * exactly like a banner would — never the backend Device's identity, private address, or LocalNetwork.
     */
    readonly exposedBackends?: readonly { readonly targetDeviceId: string; readonly service: DiscoveredService }[]
    /** NodeScan 1.2's own passive classification of exactly this scanned Host, present only while 1.2 is installed. */
    readonly classification?: DeviceClassification
  }
  | {
    readonly status: 'network'
    readonly networkId: string
    readonly networkName: string
    readonly cidr?: string
    readonly devices: readonly { readonly targetId: string; readonly address: string; readonly scope: 'self' | 'lan' | 'remote'; readonly classification?: DeviceClassification }[]
  }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'unknown_target'; readonly input: string }

/**
 * Every one of a Gateway's own configured exposures that currently resolves to a real, open, usable
 * backend Service — the public edge's own real observable surface, independent of any particular dialed
 * port. Membership is re-verified against the Gateway's own Network so a dangling or foreign exposure
 * target never surfaces.
 */
function resolveGatewayExposures(state: Readonly<GameState>, gateway: NetworkHost): readonly { readonly targetDeviceId: string; readonly service: DiscoveredService }[] {
  const network = state.world.network.localNetworks.find((candidate) => candidate.gatewayDeviceId === gateway.id)
  if (!network) return []
  const resolved: { targetDeviceId: string; service: DiscoveredService }[] = []
  for (const exposure of gateway.exposures ?? []) {
    if (!network.memberDeviceIds.includes(exposure.targetDeviceId)) continue
    const target = state.world.network.hosts.find((host) => host.id === exposure.targetDeviceId)
    if (!target || !isDeviceNetworkUsable(target.operational)) continue
    const service = target.services?.find((candidate) => candidate.id === exposure.targetServiceId && candidate.protocol === exposure.protocol && candidate.open)
    // The externally dialed port is the exposure's own — never assumed equal to the backend's internal
    // Service port, even though this world's own authored exposures currently happen to match.
    if (service) resolved.push({ targetDeviceId: target.id, service: { id: service.id, name: service.name, port: exposure.externalPort, protocol: exposure.protocol } })
  }
  return resolved
}

/** Explore outward from one supported IPv4 or local-network-name target without mutation. */
export function scanNetworkTarget(targets: Readonly<ScanTargets>, input: string): ScanResult {
  // Compatibility entry point for pure callers. It deliberately delegates to
  // the same source-aware resolver rather than retaining a global-IP route.
  const state = { player: { localDevice: targets.localDevice }, world: { network: targets.network } } as GameState
  return scanFromDevice(state, targets.localDevice.id, input)
}

/** Source-aware Scan used by all live operations. Discovery admission remains
 * outside this owner; this only resolves the represented path and observation. */
export function scanFromDevice(state: Readonly<GameState>, sourceDeviceId: string, input: string): ScanResult {
  const source = resolveDevice(state, sourceDeviceId)
  if (!source || !findInstalledNodeScan(source as LocalDeviceState)) return { status: 'unknown_target', input }
  const classifying = Boolean(findInstalledNodeScan(source as LocalDeviceState) && nodeScanSupportsDeviceClassification(findInstalledNodeScan(source as LocalDeviceState)!))
  if (!isValidIpv4(input)) {
    const network = resolveLocalNetwork(state.world.network, input)
    if (!network) return { status: 'unknown_target', input }
    // A genuine Network Scan requires the acting Device's own represented membership: different
    // LocalNetworks are never automatically reachable from one another, regardless of Gateway truth.
    if (!network.memberDeviceIds.includes(sourceDeviceId)) return { status: 'no_response', address: input }
    const devices = [state.player.localDevice, ...state.world.network.hosts]
      .filter((device) => network.memberDeviceIds.includes(device.id) && isDeviceNetworkUsable(device.operational))
      .map((device) => ({ targetId: device.id, address: 'network' in device ? device.network.ip : device.ip, scope: device.id === sourceDeviceId ? 'self' as const : 'lan' as const, ...(device.id !== sourceDeviceId && classifying ? { classification: classifyDeviceKind(device.deviceType) } : {}) }))
    return { status: 'network', networkId: network.id, networkName: network.name, ...(network.cidr ? { cidr: network.cidr } : {}), devices }
  }
  const path = resolveNetworkPath(state, sourceDeviceId, input)
  if (path.kind === 'NO_ROUTE') return { status: 'no_response', address: input }
  const target = path.kind === 'EXPOSED_EDGE' ? (path.target ?? path.gateway) : path.target
  if (!isDeviceNetworkUsable(target.operational)) return { status: 'no_response', address: input }
  const network = resolveDeviceNetwork({ localDevice: state.player.localDevice, network: state.world.network }, target.id)
  const gateway = path.kind === 'DIRECT_LOCAL' && network ? resolveNetworkGateway({ localDevice: state.player.localDevice, network: state.world.network }, network) : undefined
  // DIRECT_LOCAL now only ever resolves for SELF or a Device sharing the source's own represented
  // Network membership (`resolveNetworkPath`), so path kind alone determines scope.
  const scope = target.id === sourceDeviceId ? 'self' as const : path.kind === 'DIRECT_LOCAL' ? 'lan' as const : 'remote' as const
  const services = path.kind === 'EXPOSED_EDGE' && path.targetService ? [path.targetService] : ((target as NetworkHost).services ?? []).filter(({ open }) => open)
  // A portless Scan of a Gateway's own public edge additionally observes each of its currently forwarded
  // exposures as a Service reachable at this same address — its own real observable surface — without
  // ever revealing which backend Device it forwards to.
  const exposedBackends = path.kind === 'EXPOSED_EDGE' && !path.target ? resolveGatewayExposures(state, path.gateway) : []
  return {
    status: 'device', targetId: target.id, address: input, scope,
    networks: path.kind === 'DIRECT_LOCAL' && network ? [{ id: network.id, ...(network.cidr ? { cidr: network.cidr } : {}), ...(gateway ? { gateway: { targetId: gateway.deviceId, address: gateway.address, scope: 'lan' as const } } : {}) }] : [],
    services: services.filter(({ open }) => open).map(({ id, name, port, protocol }) => ({ id, name, port, protocol })),
    ...(exposedBackends.length ? { exposedBackends } : {}),
    ...(classifying ? { classification: classifyDeviceKind(target.deviceType) } : {}),
  }
}
