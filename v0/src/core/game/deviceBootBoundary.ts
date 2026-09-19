import { activatePendingGateSshAtDeviceBoot } from './deviceBootActivation'
import type { GameState } from './types'

/**
 * The one narrow composition boundary for an already-established real
 * Device boot. A reboot cause (currently only srv-02's own represented
 * `REBOOT_ON_DISCONNECT` recovery behavior; see `deviceConnectivityRecovery.ts`)
 * calls this exactly once it reaches a real boot; it never invokes an
 * individual boot consequence directly, and no boot consequence needs to
 * know why the Device booted.
 *
 * Every independent boot consequence is composed here, concretely and in
 * sequence — not through a generic hook/plugin/event system. Adding a future
 * boot consequence (software autostart, a runtime reset, another pending
 * software mechanism) means adding one more concrete call at this seam.
 */
export function runRealDeviceBootConsequences(state: GameState, deviceId: string): GameState {
  return activatePendingGateSshAtDeviceBoot(state, deviceId)
}
