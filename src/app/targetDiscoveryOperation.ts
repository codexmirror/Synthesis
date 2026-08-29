import { createLocalScanTarget } from './localScanOperation'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameState } from '../core/game/types'

/**
 * Known-Space refresh composes only Scan observations over SELF and Networks
 * the player already knows. Target Scan, Inspect, and Analyze remain distinct
 * player-facing operations.
 */

export type FindTargetsResult =
  | { readonly status: 'observed'; readonly networksKnown: number; readonly targetsKnown: number }
  | { readonly status: 'no_response' | 'software_unavailable' }

export type FindTargetsOperation = () => Promise<FindTargetsResult>

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
    for (const network of readState().discovery.networks) await scan(network.name)
    const latest = readState()
    return { status: 'observed', networksKnown: latest.discovery.networks.length, targetsKnown: latest.discovery.devices.length }
  }
}
