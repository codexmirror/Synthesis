import { pingFromDevice, type PingResult } from '../core/game/ping'
import { rememberPing } from '../core/game/discovery'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameState } from '../core/game/types'

export type PingTargetResult = PingResult | { status: 'software_unavailable' }
export type PingTargetOperation = (input: string) => PingTargetResult | Promise<PingTargetResult>

/** Shared immediate PING adapter used by NodeScan and Terminal. */
export function createLocalPingTarget(readState: () => GameState, writeState: (state: GameState) => void): PingTargetOperation {
  return (input) => {
    const state = readState()
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
    const result = pingFromDevice(state, state.player.localDevice.id, input)
    const latest = readState()
    const discovery = rememberPing(latest.discovery, result, latest.player.localDevice.id)
    if (discovery !== latest.discovery) writeState({ ...latest, discovery })
    return result
  }
}
