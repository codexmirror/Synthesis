import type { LocalDeviceState, LocalNetwork, NetworkHost, NetworkState } from './types'

export interface NetworkTargets {
  readonly localDevice: Readonly<LocalDeviceState>
  readonly network: Readonly<NetworkState>
}

export type ResolvedNetworkTarget =
  | { readonly scope: 'self'; readonly entity: Readonly<LocalDeviceState> }
  | { readonly scope: 'lan' | 'remote'; readonly entity: Readonly<NetworkHost> }

export function isValidIpv4(input: string): boolean {
  const octets = input.split('.')
  return octets.length === 4 && octets.every((octet) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(octet)) return false
    return Number(octet) <= 255
  })
}

/** Resolve represented network entities without deciding whether they respond. */
export function resolveNetworkTarget(targets: Readonly<NetworkTargets>, address: string): ResolvedNetworkTarget | undefined {
  if (targets.localDevice.network.ip === address) {
    return { scope: 'self', entity: targets.localDevice }
  }

  const host = targets.network.hosts.find(({ ip }) => ip === address)
  if (!host) return undefined
  const isLan = targets.network.localNetworks.some(({ memberDeviceIds }) => memberDeviceIds.includes(host.id))
  return { scope: isLan ? 'lan' : 'remote', entity: host }
}

/** Resolve only the currently supported player-visible local-network name target. */
export function resolveLocalNetwork(network: Readonly<NetworkState>, name: string): Readonly<LocalNetwork> | undefined {
  return network.localNetworks.find((candidate) => candidate.name === name)
}
