import { classifyHostScope, isValidIpv4, resolveDeviceNetwork, resolveLocalNetwork, resolveNetworkTarget, type NetworkTargets } from './networkTarget'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { classifyDeviceKind } from './deviceClassification'
import { findInstalledNodeScan, nodeScanSupportsDeviceClassification } from './software'
import type { DeviceClassification } from './types'

export type ScanTargets = NetworkTargets

/** Another represented Host sharing a scanned Host's Network, revealed only as a shallow, unscanned observation. */
export interface DiscoveredPeer {
  readonly targetId: string
  readonly address: string
  readonly scope: 'lan' | 'remote'
}

/**
 * The Network context a Host Scan may legitimately reveal: stable identity
 * and routing identity (never the Network's own mutable display name — that
 * is earned only by a genuine Network Scan), plus the other represented
 * Hosts sharing it as shallow peers. A Host Scan never deep-scans a peer.
 */
export interface DiscoveredNetworkRelation {
  readonly id: string
  readonly cidr?: string
  readonly peers: readonly DiscoveredPeer[]
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
  const installation = findInstalledNodeScan(targets.localDevice)
  const classifying = Boolean(installation && nodeScanSupportsDeviceClassification(installation))

  if (!isValidIpv4(input)) {
    const network = resolveLocalNetwork(targets.network, input)
    if (!network) return { status: 'unknown_target', input }
    const devices: { targetId: string; address: string; scope: 'self' | 'lan' | 'remote'; classification?: DeviceClassification }[] = []
    if (network.memberDeviceIds.includes(targets.localDevice.id) && isDeviceNetworkUsable(targets.localDevice.operational)) {
      devices.push({ targetId: targets.localDevice.id, address: targets.localDevice.network.ip, scope: 'self' })
    }
    for (const host of targets.network.hosts) {
      if (network.memberDeviceIds.includes(host.id) && isDeviceNetworkUsable(host.operational)) {
        const classification = classifying ? classifyDeviceKind(host.deviceType) : undefined
        devices.push({ targetId: host.id, address: host.ip, scope: classifyHostScope(targets, host.id), ...(classification ? { classification } : {}) })
      }
    }
    return { status: 'network', networkId: network.id, networkName: network.name, ...(network.cidr ? { cidr: network.cidr } : {}), devices }
  }

  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  if (!isDeviceNetworkUsable(resolved.entity.operational)) return { status: 'no_response', address: input }

  // A Host Scan reveals only the Network relationship it legitimately owns: stable identity and routing
  // identity, plus the other Hosts sharing it as shallow peers — never the Network's own display name, and
  // never a deep observation of any peer. FAIL_CLOSED when membership cannot be resolved to exactly one Network.
  const hostNetwork = resolveDeviceNetwork(targets, resolved.entity.id)
  const networks: DiscoveredNetworkRelation[] = hostNetwork ? [{
    id: hostNetwork.id,
    ...(hostNetwork.cidr ? { cidr: hostNetwork.cidr } : {}),
    peers: targets.network.hosts
      .filter((host) => hostNetwork.memberDeviceIds.includes(host.id) && host.id !== resolved.entity.id && isDeviceNetworkUsable(host.operational))
      .map((host) => ({ targetId: host.id, address: host.ip, scope: classifyHostScope(targets, host.id) })),
  }] : []
  const classification = classifying ? classifyDeviceKind(resolved.entity.deviceType) : undefined
  const services = ('services' in resolved.entity ? resolved.entity.services ?? [] : [])
      .filter(({ open }) => open)
      .map(({ id, name, port, protocol }) => ({ id, name, port, protocol }))
  return { status: 'device', targetId: resolved.entity.id, address: input, scope: resolved.scope, networks, services, ...(classification ? { classification } : {}) }
}
