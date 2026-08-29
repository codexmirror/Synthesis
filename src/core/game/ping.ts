import { isValidIpv4, resolveNetworkTarget, type NetworkTargets } from './networkTarget'

export type PingTargets = NetworkTargets
export type PingResult =
  | { readonly status: 'device'; readonly targetId: string; readonly address: string }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'invalid_address'; readonly input: string }

/** Observe only whether a represented Device currently responds at an IPv4 address. */
export function pingNetworkTarget(targets: Readonly<PingTargets>, input: string): PingResult {
  if (!isValidIpv4(input)) return { status: 'invalid_address', input }
  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  const online = resolved.scope === 'self' ? resolved.entity.runtime.networkStatus === 'ONLINE' : resolved.entity.online
  return online
    ? { status: 'device', targetId: resolved.entity.id, address: input }
    : { status: 'no_response', address: input }
}
