import { createLocalScanTarget } from './localScanOperation'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameState } from '../core/game/types'

/**
 * Known-Space refresh composes only Scan observations over SELF and Networks
 * the player already knows. Target Scan and Endpoint Analysis remain distinct
 * player-facing operations, and the retired generic Inspect operation is
 * never composed here.
 */

export type FindTargetsResult =
  | { readonly status: 'observed'; readonly networksKnown: number; readonly targetsKnown: number }
  | { readonly status: 'no_response' | 'software_unavailable' }

export type FindTargetsOperation = () => Promise<FindTargetsResult>

export type RefreshNetworkResult =
  | { readonly status: 'refreshed' }
  | { readonly status: 'no_response' | 'unknown_network' | 'software_unavailable' }

export type RefreshNetworkOperation = (networkId: string) => Promise<RefreshNetworkResult>

/**
 * Look around: observe SELF's own Network relationships, then observe the
 * responding members of every Network the player now legitimately knows.
 * Both steps are the same canonical Scan operation the Terminal exposes; the
 * only thing added here is that the player does not have to issue them one at
 * a time. Nothing outside remembered Discovery is ever scanned.
 */
export function createFindTargets(readState: () => GameState, writeState: (state: GameState) => void): FindTargetsOperation {
  const scan = createLocalScanTarget(readState, writeState)
  return async () => {
    const state = readState()
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
    const self = await scan(state.player.localDevice.network.ip)
    if (self.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (self.status === 'no_response' || self.status === 'unknown_target') return { status: 'no_response' }
    // Scan by whatever the player already legitimately identifies this Network with: its earned name where one
    // is remembered, otherwise its CIDR — itself a genuine Network Scan input, and the exact route by which an
    // only-incidentally-known Network earns its real name.
    for (const network of readState().discovery.networks) {
      const input = network.name ?? network.cidr
      if (input) await scan(input)
    }
    const latest = readState()
    return { status: 'observed', networksKnown: latest.discovery.networks.length, targetsKnown: latest.discovery.devices.length }
  }
}

/**
 * Refresh one remembered Network by repeating the canonical Network Scan
 * against it. This only ever refreshes evidence Network Scan itself owns
 * (which Hosts currently respond); it never deepens a remembered Host with
 * implementation, Firmware, or other Endpoint Analysis-owned evidence.
 */
export function createRefreshNetwork(readState: () => GameState, writeState: (state: GameState) => void): RefreshNetworkOperation {
  const scan = createLocalScanTarget(readState, writeState)
  return async (networkId) => {
    const before = readState()
    if (!findInstalledNodeScan(before.player.localDevice)) return { status: 'software_unavailable' }
    const network = before.discovery.networks.find(({ id }) => id === networkId)
    if (!network) return { status: 'unknown_network' }
    const input = network.name ?? network.cidr
    if (!input) return { status: 'no_response' }
    const scanResult = await scan(input)
    if (scanResult.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (scanResult.status !== 'network') return { status: 'no_response' }
    return { status: 'refreshed' }
  }
}
