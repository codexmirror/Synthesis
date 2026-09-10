import { scanNetworkTarget, type ScanResult } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { rememberScan } from '../core/game/discovery'
import { findInstalledNodeScan } from '../core/game/software'

export type ScanTargetOperation = (input: string) => Promise<ScanResult | { status: 'software_unavailable' }>

/** Local application adapter for Scan. The state reader deliberately runs per request. */
export function createLocalScanTarget(readState: () => GameState, writeState: (state: GameState) => void): ScanTargetOperation {
  return async (input) => {
    const state = readState()
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
    const applicableNetworks = state.world.network.localNetworks.filter(({ memberDeviceIds }) => memberDeviceIds.includes(state.player.localDevice.id))
    const knownLocalNetwork = applicableNetworks.filter(({ name, cidr }) => name === input || cidr === input)
    const known = input === state.player.localDevice.network.ip
      || state.discovery.devices.some(({ address }) => address === input)
      // A Host Scan may remember a Network only by CIDR, never by name — that
      // remembered CIDR must remain a legitimate Scan input (Refresh depends
      // on it), exactly like an already-earned name.
      || state.discovery.networks.some(({ name, cidr }) => name === input || cidr === input)
      || knownLocalNetwork.length === 1
    if (!known) return { status: 'unknown_target', input }
    const result = scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, input)
    const latest = readState()
    const discovery = rememberScan(latest.discovery, result, latest.player.localDevice.id)
    if (discovery !== latest.discovery) writeState({ ...latest, discovery })
    return result
  }
}
