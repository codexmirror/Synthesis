import type { LocalDeviceState, NetworkState } from './types'

export interface ScanTargets {
  readonly localDevice: Readonly<LocalDeviceState>
  readonly network: Readonly<NetworkState>
}

export type ScanResult =
  | { readonly status: 'reachable'; readonly targetId: string; readonly address: string; readonly scope: 'local' | 'remote' }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'invalid_target'; readonly input: string }

function isValidIpv4(input: string): boolean {
  const octets = input.split('.')
  return octets.length === 4 && octets.every((octet) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(octet)) return false
    return Number(octet) <= 255
  })
}

/** Observe one IPv4 target without mutating the network or player state. */
export function scanNetworkTarget(targets: Readonly<ScanTargets>, input: string): ScanResult {
  if (!isValidIpv4(input)) return { status: 'invalid_target', input }

  const { localDevice, network } = targets
  if (localDevice.network.ip === input) {
    return localDevice.runtime.networkStatus === 'ONLINE'
      ? { status: 'reachable', targetId: localDevice.id, address: input, scope: 'local' }
      : { status: 'no_response', address: input }
  }

  const host = network.hosts.find(({ ip }) => ip === input)
  return host?.online
    ? { status: 'reachable', targetId: host.id, address: input, scope: 'remote' }
    : { status: 'no_response', address: input }
}
