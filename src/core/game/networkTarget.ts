import type { LocalDeviceState, NetworkHost, NetworkState } from './types'

export interface NetworkTargets {
  readonly localDevice: Readonly<LocalDeviceState>
  readonly network: Readonly<NetworkState>
}

export type ResolvedNetworkTarget =
  | { readonly scope: 'local'; readonly entity: Readonly<LocalDeviceState> }
  | { readonly scope: 'remote'; readonly entity: Readonly<NetworkHost> }

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
    return { scope: 'local', entity: targets.localDevice }
  }

  const host = targets.network.hosts.find(({ ip }) => ip === address)
  return host ? { scope: 'remote', entity: host } : undefined
}
