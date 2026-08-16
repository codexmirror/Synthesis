import { classifyHostScope, findSharedLocalNetwork, isValidIpv4, resolveLocalNetwork, resolveNetworkTarget, type NetworkTargets } from './networkTarget'

export type ScanTargets = NetworkTargets

export type ScanResult =
  | { readonly status: 'device'; readonly targetId: string; readonly address: string; readonly scope: 'self' | 'lan' | 'remote'; readonly networkName?: string }
  | { readonly status: 'network'; readonly networkName: string; readonly devices: readonly { readonly targetId: string; readonly address: string; readonly scope: 'self' | 'lan' | 'remote' }[] }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'unknown_target'; readonly input: string }

/** Discover observations from one supported IPv4 or local-network-name target without mutation. */
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
    return { status: 'network', networkName: network.name, devices }
  }

  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  const network = resolved.scope === 'self'
    ? targets.network.localNetworks.find(({ memberDeviceIds }) => memberDeviceIds.includes(resolved.entity.id))
    : findSharedLocalNetwork(targets, resolved.entity.id)
  if (resolved.scope === 'self') {
    return resolved.entity.runtime.networkStatus === 'ONLINE'
      ? { status: 'device', targetId: resolved.entity.id, address: input, scope: 'self', ...(network ? { networkName: network.name } : {}) }
      : { status: 'no_response', address: input }
  }
  return resolved.entity.online
    ? { status: 'device', targetId: resolved.entity.id, address: input, scope: resolved.scope, ...(network ? { networkName: network.name } : {}) }
    : { status: 'no_response', address: input }
}
