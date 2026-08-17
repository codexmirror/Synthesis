import { scanNetworkTarget, type ScanResult } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { rememberScan } from '../core/game/discovery'

export type ScanTargetOperation = (input: string) => Promise<ScanResult>

/** Local application adapter for Scan. The state reader deliberately runs per request. */
export function createLocalScanTarget(readState: () => GameState, writeState?: (state: GameState) => void): ScanTargetOperation {
  return async (input) => {
    const state = readState()
    const result = scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, input)
    if (writeState) {
      const latest = readState()
      const discovery = rememberScan(latest.discovery, result, latest.player.localDevice.id)
      if (discovery !== latest.discovery) writeState({ ...latest, discovery })
    }
    return result
  }
}
