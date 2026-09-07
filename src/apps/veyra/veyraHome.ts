import { findInstalledBusinessSoftware } from '../../core/game/businessSoftware'
import { resolveDollarAccountForDevice } from '../../core/game/dollarFinance'
import type { GameState, NetworkHost } from '../../core/game/types'
import type { VeyraIconName } from './VeyraIcon'

/** The applications and system surfaces this VEYRA release can actually present. */
export type VeyraAppId = 'communication' | 'wallet' | 'business' | 'settings'

export interface VeyraHomeEntry {
  readonly id: VeyraAppId
  readonly label: string
  readonly icon: VeyraIconName
}

/**
 * What is actually on this phone's Home.
 *
 * Home presence is derived here on every render from concrete Firmware
 * presentation and represented facts; it is never stored. There is no
 * `homeApps[]`, no launcher inventory, no per-app
 * presentation flag and no app registry. This concrete VEYRA release bundles
 * Communication as a Firmware client over Petra's represented Company Chat, while the remaining
 * entries follow their represented bases:
 *
 * ```text
 * Communication -> this represented VEYRA OS Firmware -> Petra's Company Chat
 * Wallet        -> this Device -> its Civic Dollar Financial Session -> Account
 * Business      -> this Device -> its represented Business InstalledSoftware
 * Settings      -> this Device's represented VEYRA OS Firmware (a Firmware-owned system surface)
 * ```
 *
 * Communication's presence represents the built-in client surface, not an
 * account, capability, or installed Software. Business is the opposite case
 * and the reason the distinction matters: it is ordinary Device-owned
 * software, so it is on Home exactly while the Device holds that installation
 * — with no Company to manage, with no Financial Session, and equally absent
 * from a Device that holds Company authority but not the software.
 *
 * An entry is a way to open a surface. It is not authority: opening Wallet
 * still resolves the Account through the Session, and every action still goes
 * through the canonical domain operation that owns it.
 */
export function deriveVeyraHomeEntries(state: GameState, device: NetworkHost): readonly VeyraHomeEntry[] {
  const entries: VeyraHomeEntry[] = []

  // Communication is bundled into this VEYRA Firmware; the client owns none
  // of the Company Chat truth it presents.
  if (device.firmware) {
    entries.push({ id: 'communication', label: 'Communication', icon: 'communication' })
  }

  // Wallet is the phone's client for a real Civic Dollar Account. Without a
  // Financial Session on this Device there is no Account to present, so there
  // is no Wallet on this phone.
  if (resolveDollarAccountForDevice(state, device.id)) {
    entries.push({ id: 'wallet', label: 'Wallet', icon: 'wallet' })
  }

  // Business is ordinary Device-owned software, not a VEYRA Firmware feature
  // and not an authority: the installation alone puts it on Home, and what it
  // can then actually manage is resolved separately when it is opened.
  if (findInstalledBusinessSoftware(device)) {
    entries.push({ id: 'business', label: 'Business', icon: 'business' })
  }

  // Settings presents this Device's own Firmware-owned facts, so its basis is
  // that Firmware being represented at all.
  if (device.firmware) {
    entries.push({ id: 'settings', label: 'Settings', icon: 'settings' })
  }

  return entries
}
