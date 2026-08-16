import { isValidIpv4, resolveNetworkTarget, type NetworkTargets } from './networkTarget'

export type ScanTargets = NetworkTargets

export type ScanResult =
  | { readonly status: 'reachable'; readonly targetId: string; readonly address: string; readonly scope: 'local' | 'remote' }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'invalid_target'; readonly input: string }

/** Observe one IPv4 target without mutating the network or player state. */
export function scanNetworkTarget(targets: Readonly<ScanTargets>, input: string): ScanResult {
  if (!isValidIpv4(input)) return { status: 'invalid_target', input }

  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  if (resolved.scope === 'local') {
    return resolved.entity.runtime.networkStatus === 'ONLINE'
      ? { status: 'reachable', targetId: resolved.entity.id, address: input, scope: 'local' }
      : { status: 'no_response', address: input }
  }
  return resolved.entity.online
    ? { status: 'reachable', targetId: resolved.entity.id, address: input, scope: 'remote' }
    : { status: 'no_response', address: input }
}
