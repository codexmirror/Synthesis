import type { GameState } from './types'

/**
 * Decide Scan admission from Player Information and the acting Device's own
 * represented Network membership. Hidden World targets do not make an input
 * eligible; canonical World Truth is consulted only after admission.
 */
export function isScanTargetKnown(state: Readonly<GameState>, input: string): boolean {
  if (input === state.player.localDevice.network.ip) return true
  if (state.discovery.devices.some(({ address }) => address === input)) return true
  if (state.discovery.networks.some(({ name, cidr }) => name === input || cidr === input)) return true

  const matchingLocalNetworks = state.world.network.localNetworks.filter(({ name, cidr, memberDeviceIds }) =>
    memberDeviceIds.includes(state.player.localDevice.id) && (name === input || cidr === input))
  return matchingLocalNetworks.length === 1
}
