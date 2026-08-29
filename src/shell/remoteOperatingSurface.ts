import { RACK_OS_FIRMWARE_ID, VEYRA_OS_FIRMWARE_ID } from '../core/game/firmwareIdentity'
import type { FirmwareState } from '../core/game/types'

/**
 * The operating surfaces this Shell can actually present for an entered remote
 * target. One value per concretely implemented foreign environment.
 */
export type RemoteOperatingSurface = 'rack-os' | 'veyra-os'

/**
 * Which operating environment an entered remote Device actually presents.
 *
 * The decision is made from the target's own represented Firmware identity, not
 * from its display name: `name` and `version` are mutable attributes (A01), so
 * a renamed release must still mount the environment it really runs.
 *
 * It is deliberately a small concrete dispatch over the two represented
 * Firmware families a Shell can currently present, not a Firmware plugin
 * system, capability negotiation, or foreign-OS registry (A16). Firmware the
 * Shell has no implementation for resolves to `undefined` — an unsupported
 * environment must fail visibly rather than silently receiving somebody else's
 * operating surface.
 */
export function selectRemoteOperatingSurface(firmware: FirmwareState | undefined): RemoteOperatingSurface | undefined {
  if (firmware?.id === RACK_OS_FIRMWARE_ID) return 'rack-os'
  if (firmware?.id === VEYRA_OS_FIRMWARE_ID) return 'veyra-os'
  return undefined
}
