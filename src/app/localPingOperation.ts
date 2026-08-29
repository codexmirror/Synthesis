import { pingNetworkTarget, type PingResult } from '../core/game/ping'
import { rememberPing } from '../core/game/discovery'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameState } from '../core/game/types'

export type PingTargetOperation = (input: string) => PingResult | { status: 'software_unavailable' }

/** Shared immediate PING adapter used by NodeScan and Terminal. */
export function createLocalPingTarget(readState: () => GameState, writeState: (state: GameState) => void): PingTargetOperation {
  return (input) => {
    const state = readState()
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
    const result = pingNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, input)
    const latest = readState()
    const discovery = rememberPing(latest.discovery, result, latest.player.localDevice.id)
    if (discovery !== latest.discovery) writeState({ ...latest, discovery })
    return result
  }
}
