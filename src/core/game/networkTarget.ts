import type { LocalDeviceState, LocalNetwork, NetworkHost, NetworkState } from './types'

export interface NetworkTargets {
  readonly localDevice: Readonly<LocalDeviceState>
  readonly network: Readonly<NetworkState>
}

export type ResolvedNetworkTarget =
  | { readonly scope: 'self'; readonly entity: Readonly<LocalDeviceState> }
  | { readonly scope: 'lan' | 'remote'; readonly entity: Readonly<NetworkHost> }

export function findSharedLocalNetwork(
  targets: Readonly<NetworkTargets>,
  targetId: string,
): Readonly<LocalNetwork> | undefined {
  return targets.network.localNetworks.find(({ memberDeviceIds }) =>
    memberDeviceIds.includes(targets.localDevice.id) && memberDeviceIds.includes(targetId),
  )
}

export function classifyHostScope(targets: Readonly<NetworkTargets>, targetId: string): 'lan' | 'remote' {
  return findSharedLocalNetwork(targets, targetId) ? 'lan' : 'remote'
}

export function isValidIpv4(input: string): boolean {
  const octets = input.split('.')
  return octets.length === 4 && octets.every((octet) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(octet)) return false
    return Number(octet) <= 255
  })
}

/** Recognize endpoint-shaped player input without resolving it against world truth. */
export function isIpv4EndpointSyntax(input: string): boolean {
  const separator = input.lastIndexOf(':')
  if (separator < 1 || input.indexOf(':') !== separator) return false
  const port = input.slice(separator + 1)
  return isValidIpv4(input.slice(0, separator)) && /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535
}

/** Resolve represented network entities without deciding whether they respond. */
export function resolveNetworkTarget(targets: Readonly<NetworkTargets>, address: string): ResolvedNetworkTarget | undefined {
  if (targets.localDevice.network.ip === address) {
    return { scope: 'self', entity: targets.localDevice }
  }

  const host = targets.network.hosts.find(({ ip }) => ip === address)
  if (!host) return undefined
  return { scope: classifyHostScope(targets, host.id), entity: host }
}

/** Resolve a player-visible Network attribute only when it identifies exactly one represented Network. */
export function resolveLocalNetwork(network: Readonly<NetworkState>, input: string): Readonly<LocalNetwork> | undefined {
  const matches = network.localNetworks.filter((candidate) => candidate.name === input || candidate.cidr === input)
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * Resolve the one represented Network a Device belongs to, so a Host Scan
 * may legitimately reveal that context. FAIL_CLOSED: a Device with no
 * represented membership yields nothing, and a Device the represented model
 * cannot unambiguously place on exactly one Network yields nothing rather
 * than arbitrarily picking one.
 */
export function resolveDeviceNetwork(targets: Readonly<NetworkTargets>, deviceId: string): Readonly<LocalNetwork> | undefined {
  const matches = targets.network.localNetworks.filter(({ memberDeviceIds }) => memberDeviceIds.includes(deviceId))
  return matches.length === 1 ? matches[0] : undefined
}

/** Resolve a Network's default gateway only from its explicit member-Device relationship. */
export function resolveNetworkGateway(targets: Readonly<NetworkTargets>, network: Readonly<LocalNetwork>): { readonly deviceId: string; readonly address: string } | undefined {
  if (!network.gatewayDeviceId || !network.memberDeviceIds.includes(network.gatewayDeviceId)) return undefined
  const matches = [
    ...(targets.localDevice.id === network.gatewayDeviceId ? [{ id: targets.localDevice.id, ip: targets.localDevice.network.ip }] : []),
    ...targets.network.hosts.filter(({ id }) => id === network.gatewayDeviceId),
  ]
  return matches.length === 1 ? { deviceId: matches[0].id, address: matches[0].ip } : undefined
}
