import { isValidIpv4, resolveNetworkTarget, type NetworkTargets } from './networkTarget'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { resolveNetworkPath } from './networkPath'
import type { GameState } from './types'

export type PingTargets = NetworkTargets
export type PingResult =
  | { readonly status: 'device'; readonly targetId: string; readonly address: string }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'invalid_address'; readonly input: string }

/** Observe only whether a represented Device currently responds at an IPv4 address. */
export function pingNetworkTarget(targets: Readonly<PingTargets>, input: string): PingResult {
  const state = { player: { localDevice: targets.localDevice }, world: { network: targets.network } } as GameState
  return pingFromDevice(state, targets.localDevice.id, input)
}

export function pingFromDevice(state: Readonly<GameState>, sourceDeviceId: string, input: string): PingResult {
  if (!isValidIpv4(input)) return { status: 'invalid_address', input }
  const path = resolveNetworkPath(state, sourceDeviceId, input)
  if (path.kind === 'NO_ROUTE') return { status: 'no_response', address: input }
  const target = path.kind === 'EXPOSED_EDGE' ? (path.target ?? path.gateway) : path.target
  return isDeviceNetworkUsable(target.operational) ? { status: 'device', targetId: target.id, address: input } : { status: 'no_response', address: input }
}
