import { createLocalScanTarget } from './localScanOperation'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameState } from '../core/game/types'

/**
 * Legacy non-UI SELF observation. Network and Host observations are always
 * invoked explicitly against one represented object.
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
 * Retained as a compatibility adapter for callers outside NodeScan, narrowed
 * to exactly one canonical Host Scan of SELF. It never scans Networks.
 */
export function createFindTargets(readState: () => GameState, writeState: (state: GameState) => void): FindTargetsOperation {
  const scan = createLocalScanTarget(readState, writeState)
  return async () => {
    const state = readState()
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
    const self = await scan(state.player.localDevice.network.ip)
    if (self.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (self.status === 'no_response' || self.status === 'unknown_target') return { status: 'no_response' }
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
    const remembered = before.discovery.networks.find(({ id }) => id === networkId)
    const managedIds = before.networkManagement.established
      .filter(({ deviceId }) => deviceId === before.player.localDevice.id)
      .map(({ networkId: id }) => id)
    const managed = managedIds.includes(networkId) ? before.world.network.localNetworks.find(({ id }) => id === networkId) : undefined
    const network = remembered ?? managed
    if (!network) return { status: 'unknown_network' }
    const input = network.name ?? network.cidr
    if (!input) return { status: 'no_response' }
    const scanResult = await scan(input)
    if (scanResult.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (scanResult.status !== 'network') return { status: 'no_response' }
    return { status: 'refreshed' }
  }
}
