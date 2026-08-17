import { scanNetworkTarget, type ScanResult } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { applyScanObservation } from '../core/game/discovery'

export type ScanTargetOperation = (input: string) => Promise<ScanResult>

/** Local application adapter for Scan. The state reader deliberately runs per request. */
export function createLocalScanTarget(readState: () => GameState, commitState?: (state: GameState) => void): ScanTargetOperation {
  return (input) => {
    const state = readState()
    const result = scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, input)
    const discovery = applyScanObservation(state.discovery, result)
    if (discovery !== state.discovery) commitState?.({ ...state, discovery })
    return Promise.resolve(result)
  }
}
