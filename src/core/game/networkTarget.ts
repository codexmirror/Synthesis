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

/** Resolve only the currently supported player-visible local-network name target. */
export function resolveLocalNetwork(network: Readonly<NetworkState>, name: string): Readonly<LocalNetwork> | undefined {
  return network.localNetworks.find((candidate) => candidate.name === name)
}
