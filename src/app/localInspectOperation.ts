import { inspectKnownTarget, type InspectResult } from '../core/game/inspect'
import { rememberInspect } from '../core/game/discovery'
import { findInstalledNodeScan, nodeScanSupportsInspect } from '../core/game/software'
import type { GameState } from '../core/game/types'

export type InspectTargetOperation = (input: string) => InspectResult | { status: 'software_unavailable' } | { status: 'capability_unavailable' }

/** Shared synchronous application boundary for player-facing Inspect. */
export function createLocalInspectTarget(readState: () => GameState, writeState: (state: GameState) => void): InspectTargetOperation {
  return (input) => {
    const state = readState()
    const nodeScan = findInstalledNodeScan(state.player.localDevice)
    if (!nodeScan) return { status: 'software_unavailable' }
    if (!nodeScanSupportsInspect(nodeScan)) return { status: 'capability_unavailable' }
    const result = inspectKnownTarget({ localDevice: state.player.localDevice, network: state.world.network }, state.discovery, input, 'enhanced')
    const latest = readState()
    const discovery = rememberInspect(latest.discovery, result, latest.player.localDevice.id)
    if (discovery !== latest.discovery) writeState({ ...latest, discovery })
    return result
  }
}
