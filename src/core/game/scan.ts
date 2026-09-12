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
    if (!network.memberDeviceIds.includes(sourceDeviceId)) {
      // A transparent Gateway (its own `exposures` simply never configured, like an ordinary home Router)
      // passes a genuine Network Scan through exactly like the pre-NAT open internet; only a Gateway that
      // actually defines `exposures` does NAT-style gating, failing closed for a non-member source here.
      const gateway = resolveNetworkGateway({ localDevice: state.player.localDevice, network: state.world.network }, network)
      const gatewayHost = gateway && state.world.network.hosts.find(({ id }) => id === gateway.deviceId)
      if (!gatewayHost || gatewayHost.exposures !== undefined) return { status: 'no_response', address: input }
    }
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
  // A DIRECT_LOCAL path can now also reach a standalone Device or an ungated Network's member the source
  // does not itself belong to (see `resolveNetworkPath`); scope reflects actual shared membership, not path kind alone.
  const sharesTargetNetwork = Boolean(network && network.memberDeviceIds.includes(sourceDeviceId))
  const scope = target.id === sourceDeviceId ? 'self' as const : path.kind === 'DIRECT_LOCAL' ? (sharesTargetNetwork ? 'lan' as const : 'remote' as const) : 'remote' as const
  const services = path.kind === 'EXPOSED_EDGE' && path.targetService ? [path.targetService] : ((target as NetworkHost).services ?? []).filter(({ open }) => open)
  return { status: 'device', targetId: target.id, address: input, scope, networks: path.kind === 'DIRECT_LOCAL' && network ? [{ id: network.id, ...(network.cidr ? { cidr: network.cidr } : {}), ...(gateway ? { gateway: { targetId: gateway.deviceId, address: gateway.address, scope: 'lan' as const } } : {}) }] : [], services: services.filter(({ open }) => open).map(({ id, name, port, protocol }) => ({ id, name, port, protocol })), ...(classifying ? { classification: classifyDeviceKind(target.deviceType) } : {}) }
}
