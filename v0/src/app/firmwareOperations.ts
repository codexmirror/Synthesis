import { startRackOsFirmwareUpdateForOperatedRemoteDevice, type StartRackOsFirmwareUpdateResult } from '../core/game/rackOsFirmwareUpdate'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createFirmwareActions(accessor: GameStateAccessor) {
  return {
    /**
     * Deliberately no Device argument: the Device whose firmware is installed
     * is the one the active Remote Session already operates, and the installer
     * artifact is resolved from that same Device's own filesystem by path.
     */
    startRackOsFirmwareUpdateForOperatedRemoteDevice(artifactPath: string): StartRackOsFirmwareUpdateResult {
      return commitResult(accessor, startRackOsFirmwareUpdateForOperatedRemoteDevice(accessor.read(), artifactPath))
    },
  }
}
