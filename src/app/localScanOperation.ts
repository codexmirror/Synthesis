import { scanNetworkTarget, type ScanResult } from '../core/game/scan'
import type { GameState } from '../core/game/types'

export type ScanTargetOperation = (input: string) => ScanResult

/** Local application adapter for Scan. The state reader deliberately runs per request. */
export function createLocalScanTarget(readState: () => GameState): ScanTargetOperation {
  return (input) => {
    const state = readState()
    return scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, input)
  }
}
