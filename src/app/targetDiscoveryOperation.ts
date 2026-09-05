import { createLocalScanTarget } from './localScanOperation'
import { createLocalInspectTarget } from './localInspectOperation'
import { findInstalledNodeScan, nodeScanSupportsNetworkRefresh } from '../core/game/software'
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

export type RefreshNetworkResult =
  | { readonly status: 'refreshed'; readonly inspected: number; readonly unavailable: number }
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
    for (const network of readState().discovery.networks) await scan(network.name)
    const latest = readState()
    return { status: 'observed', networksKnown: latest.discovery.networks.length, targetsKnown: latest.discovery.devices.length }
  }
}

/**
 * Refresh one remembered Network through the existing operations. Every
 * release can repeat the Network Scan; only NodeScan 1.2's authored refresh
 * capability follows it with Inspect over the membership that Discovery
 * legitimately remembers after that Scan. Individual Inspect failures are
 * deliberately local to that Device.
 */
export function createRefreshNetwork(readState: () => GameState, writeState: (state: GameState) => void): RefreshNetworkOperation {
  const scan = createLocalScanTarget(readState, writeState)
  const inspect = createLocalInspectTarget(readState, writeState)
  return async (networkId) => {
    const before = readState()
    const installation = findInstalledNodeScan(before.player.localDevice)
    if (!installation) return { status: 'software_unavailable' }
    const network = before.discovery.networks.find(({ id }) => id === networkId)
    if (!network) return { status: 'unknown_network' }
    const scanResult = await scan(network.name)
    if (scanResult.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (scanResult.status !== 'network') return { status: 'no_response' }

    if (!nodeScanSupportsNetworkRefresh(installation)) return { status: 'refreshed', inspected: 0, unavailable: 0 }

    const latest = readState()
    const memberIds = new Set(latest.discovery.networkDeviceRelations
      .filter(({ networkId: rememberedNetworkId }) => rememberedNetworkId === networkId)
      .map(({ deviceId }) => deviceId))
    const members = latest.discovery.devices.filter(({ id }) => memberIds.has(id))
    let inspected = 0
    let unavailable = 0
    for (const member of members) {
      const result = inspect(member.address)
      if (result.status === 'device') inspected++
      else unavailable++
    }
    return { status: 'refreshed', inspected, unavailable }
  }
}
