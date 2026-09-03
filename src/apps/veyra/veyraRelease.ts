import { VEYRA_OS_4_2_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
import type { FirmwareState } from '../../core/game/types'

/**
 * Which VEYRA OS release's presentation this Device actually gets.
 *
 * Both represented releases are the same operating system and mount the same
 * surface; 4.2 is a newer, more refined edition of it. The choice is resolved
 * from the Device's own stable Firmware identity on every render — never from
 * the mutable display version, and never from stored presentation state — so
 * a phone looks like the release it really runs the moment it runs it.
 */
export type VeyraReleasePresentation = 'v4-1' | 'v4-2'

export function selectVeyraReleasePresentation(firmware: FirmwareState | undefined): VeyraReleasePresentation {
  return firmware?.id === VEYRA_OS_4_2_FIRMWARE_ID ? 'v4-2' : 'v4-1'
}
