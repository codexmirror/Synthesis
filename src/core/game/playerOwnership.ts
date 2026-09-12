import type { GameState, LocalDeviceState, PlayerState } from './types'

/** Resolve SELF without guessing when ownership truth is malformed. */
export function resolvePrimaryDevice(player: PlayerState): LocalDeviceState | null {
  const unique = new Set(player.ownedDeviceIds)
  if (unique.size !== player.ownedDeviceIds.length) return null
  if (!unique.has(player.primaryDeviceId)) return null
  if (player.localDevice.id !== player.primaryDeviceId) return null
  return player.localDevice
}

export function requirePrimaryDevice(state: GameState): LocalDeviceState {
  const device = resolvePrimaryDevice(state.player)
  if (!device) throw new Error('Invalid Player Device ownership or Primary Device truth.')
  return device
}
