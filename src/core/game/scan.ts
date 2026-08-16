import { classifyHostScope, isValidIpv4, resolveLocalNetwork, resolveNetworkTarget, type NetworkTargets } from './networkTarget'

export type ScanTargets = NetworkTargets

export interface DiscoveredNetwork {
  readonly id: string
  readonly name: string
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
    readonly networks: readonly DiscoveredNetwork[]
    readonly services: readonly DiscoveredService[]
  }
  | {
    readonly status: 'network'
    readonly networkId: string
    readonly networkName: string
    readonly devices: readonly { readonly targetId: string; readonly address: string; readonly scope: 'self' | 'lan' | 'remote' }[]
  }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'unknown_target'; readonly input: string }

/** Explore outward from one supported IPv4 or local-network-name target without mutation. */
export function scanNetworkTarget(targets: Readonly<ScanTargets>, input: string): ScanResult {
  if (!isValidIpv4(input)) {
    const network = resolveLocalNetwork(targets.network, input)
    if (!network) return { status: 'unknown_target', input }
    const devices: { targetId: string; address: string; scope: 'self' | 'lan' | 'remote' }[] = []
    if (network.memberDeviceIds.includes(targets.localDevice.id) && targets.localDevice.runtime.networkStatus === 'ONLINE') {
      devices.push({ targetId: targets.localDevice.id, address: targets.localDevice.network.ip, scope: 'self' })
    }
    for (const host of targets.network.hosts) {
      if (network.memberDeviceIds.includes(host.id) && host.online) {
        devices.push({ targetId: host.id, address: host.ip, scope: classifyHostScope(targets, host.id) })
      }
    }
    return { status: 'network', networkId: network.id, networkName: network.name, devices }
  }

  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  const online = resolved.scope === 'self'
    ? resolved.entity.runtime.networkStatus === 'ONLINE'
    : resolved.entity.online
  if (!online) return { status: 'no_response', address: input }

  const networks = targets.network.localNetworks
    .filter(({ memberDeviceIds }) => memberDeviceIds.includes(resolved.entity.id))
    .map(({ id, name }) => ({ id, name }))
  const services = resolved.scope === 'self'
    ? []
    : (resolved.entity.services ?? [])
      .filter(({ open }) => open)
      .map(({ id, name, port, protocol }) => ({ id, name, port, protocol }))
  return { status: 'device', targetId: resolved.entity.id, address: input, scope: resolved.scope, networks, services }
}
