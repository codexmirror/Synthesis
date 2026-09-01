import { resolveActiveRemoteTarget } from './remoteSession'
import type { GameState } from './types'

export type ChangeDeviceWalletProtectionResult =
  | { readonly status: 'changed'; readonly state: GameState }
  | { readonly status: 'invalid_pin' | 'device_not_found'; readonly state: GameState }

/**
 * Changes a Device's own persistent Wallet-protection setting, gated
 * exclusively on that Device's own secret PIN.
 *
 * This is Device-owner security authority, not Player identity, DeviceAccess,
 * or a Remote Session: verification is against the represented Device PIN
 * alone. A Device with no represented security state cannot be changed this
 * way at all, and a wrong PIN leaves the setting exactly as it was. The
 * canonical PIN is never returned, logged, or otherwise present in the
 * result.
 */
export function changeDeviceWalletProtection(state: GameState, deviceId: string, pin: string, enabled: boolean): ChangeDeviceWalletProtectionResult {
  const host = state.world.network.hosts.find((candidate) => candidate.id === deviceId)
  if (!host?.security) return { status: 'device_not_found', state }
  if (host.security.devicePin !== pin) return { status: 'invalid_pin', state }

  const hosts = state.world.network.hosts.map((candidate) =>
    candidate.id === deviceId ? { ...candidate, security: { ...candidate.security!, walletProtectionEnabled: enabled } } : candidate)
  return { status: 'changed', state: { ...state, world: { ...state.world, network: { ...state.world.network, hosts } } } }
}

export type ChangeWalletProtectionForOperatedRemoteDeviceResult =
  | ChangeDeviceWalletProtectionResult
  | { readonly status: 'session_unavailable'; readonly state: GameState }

/**
 * The same change, performed against whichever Device the player currently
 * operates through a Remote Session.
 *
 * The Session only decides *which* Device is acted upon, exactly as it does
 * for a remote Dollar transfer; it grants no security authority of its own.
 * Verification still happens solely against that Device's own PIN, so
 * holding DeviceAccess or an active Session never bypasses it.
 */
export function changeWalletProtectionForOperatedRemoteDevice(state: GameState, pin: string, enabled: boolean): ChangeWalletProtectionForOperatedRemoteDeviceResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  return changeDeviceWalletProtection(state, remote.target.id, pin, enabled)
}
