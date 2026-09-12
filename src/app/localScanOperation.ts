import { scanFromDevice, type ScanResult } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { rememberScan } from '../core/game/discovery'
import { findInstalledNodeScan } from '../core/game/software'
import { resolveKnownScanTarget } from '../core/game/scanEligibility'

export type ScanTargetOperation = (input: string) => Promise<ScanResult | { status: 'software_unavailable' }>

/** One source-aware application operation shared by local and remote command
 * surfaces. Admission remains Player Information; source affects only path. */
export function scanTargetFromSource(state: GameState, sourceDeviceId: string, input: string): ScanResult | { status: 'software_unavailable' } {
  const source = sourceDeviceId === state.player.localDevice.id ? state.player.localDevice : state.world.network.hosts.find(({ id }) => id === sourceDeviceId)
  if (!source || !findInstalledNodeScan(source as GameState['player']['localDevice'])) return { status: 'software_unavailable' }
  const admittedInput = resolveKnownScanTarget(state, input, sourceDeviceId)
  if (!admittedInput) return { status: 'unknown_target', input }
  return scanFromDevice(state, sourceDeviceId, admittedInput)
}

/** Local application adapter for Scan. The state reader deliberately runs per request. */
export function createLocalScanTarget(readState: () => GameState, writeState: (state: GameState) => void): ScanTargetOperation {
  return async (input) => {
    const state = readState()
    const result = scanTargetFromSource(state, state.player.localDevice.id, input)
    const latest = readState()
    if (result.status !== 'software_unavailable') {
      const discovery = rememberScan(latest.discovery, result, latest.player.localDevice.id)
      if (discovery !== latest.discovery) writeState({ ...latest, discovery })
    }
    return result
  }
}
