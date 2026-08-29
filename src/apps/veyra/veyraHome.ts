import { resolveDollarAccountForDevice } from '../../core/game/dollarFinance'
import type { GameState, NetworkHost } from '../../core/game/types'
import type { VeyraIconName } from './VeyraIcon'

/** The applications and system surfaces this VEYRA release can actually present. */
export type VeyraAppId = 'wallet' | 'settings'

export interface VeyraHomeEntry {
  readonly id: VeyraAppId
  readonly label: string
  readonly icon: VeyraIconName
}

/**
 * What is actually on this phone's Home.
 *
 * Home presence is derived here on every render from represented facts; it is
 * never stored. There is no `homeApps[]`, no launcher inventory, no per-app
 * presentation flag and no app registry — an entry exists exactly while the
 * truth behind it exists:
 *
 * ```text
 * Settings -> this Device's represented VEYRA OS Firmware (a Firmware-owned system surface)
 * Wallet   -> this Device -> its Civic Dollar Financial Session -> Account
 * ```
 *
 * Nothing else appears. Communication in particular is absent rather than
 * disabled or empty, because no foreign communication truth is represented for
 * any Device: an entry with no basis is not a slot to fill later, it simply is
 * not on the phone.
 *
 * An entry is a way to open a surface. It is not authority: opening Wallet
 * still resolves the Account through the Session, and every action still goes
 * through the canonical domain operation that owns it.
 */
export function deriveVeyraHomeEntries(state: GameState, device: NetworkHost): readonly VeyraHomeEntry[] {
  const entries: VeyraHomeEntry[] = []

  // Wallet is the phone's client for a real Civic Dollar Account. Without a
  // Financial Session on this Device there is no Account to present, so there
  // is no Wallet on this phone.
  if (resolveDollarAccountForDevice(state, device.id)) {
    entries.push({ id: 'wallet', label: 'Wallet', icon: 'wallet' })
  }

  // Settings presents this Device's own Firmware-owned facts, so its basis is
  // that Firmware being represented at all.
  if (device.firmware) {
    entries.push({ id: 'settings', label: 'Settings', icon: 'settings' })
  }

  return entries
}
