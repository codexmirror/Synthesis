import { changeWalletProtectionForOperatedRemoteDevice, verifyDevicePinForOperatedRemoteDevice, type ChangeWalletProtectionForOperatedRemoteDeviceResult, type VerifyDevicePinForOperatedRemoteDeviceResult } from '../core/game/deviceSecurity'
import { startVeyraFirmwareUpdateForOperatedRemoteDevice, type StartVeyraFirmwareUpdateResult } from '../core/game/veyraFirmwareUpdate'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createDeviceSecurityActions(accessor: GameStateAccessor) {
  return {
    /** Deliberately no Device argument: the acting Device is resolved from the active Remote Session inside the domain operation, exactly as the remote Dollar transfer already does. */
    changeWalletProtectionForOperatedRemoteDevice(pin: string, enabled: boolean): ChangeWalletProtectionForOperatedRemoteDeviceResult {
      return commitResult(accessor, changeWalletProtectionForOperatedRemoteDevice(accessor.read(), pin, enabled))
    },
    /** Also deliberately no Device argument: the phone whose firmware is updated is the one the active Remote Session already operates. */
    startVeyraFirmwareUpdateForOperatedRemoteDevice(pin: string): StartVeyraFirmwareUpdateResult {
      return commitResult(accessor, startVeyraFirmwareUpdateForOperatedRemoteDevice(accessor.read(), pin))
    },
    /** A query only: it commits nothing, so there is no canonical state to advance. */
    verifyDevicePinForOperatedRemoteDevice(pin: string): VerifyDevicePinForOperatedRemoteDeviceResult {
      return verifyDevicePinForOperatedRemoteDevice(accessor.read(), pin)
    },
  }
}
