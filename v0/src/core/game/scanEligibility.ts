import type { GameState } from './types'

/**
 * Resolve Scan admission from Player Information and the acting Device's own
 * represented Network membership. Network labels are converted to a unique
 * canonical selector before World resolution, so repeated presentation names
 * cannot retarget or invalidate an admitted operation.
 */
export function resolveKnownScanTarget(state: Readonly<GameState>, input: string, sourceDeviceId = state.player.localDevice.id): string | undefined {
  const source = sourceDeviceId === state.player.localDevice.id
    ? state.player.localDevice
    : state.world.network.hosts.find(({ id }) => id === sourceDeviceId)
  if (source && ('network' in source ? source.network.ip : source.ip) === input) return input
  if (state.discovery.devices.some(({ address }) => address === input)) return input

  const rememberedNetworks = state.discovery.networks.filter(({ name, cidr }) => name === input || cidr === input)
  if (rememberedNetworks.length > 1) return undefined
  if (rememberedNetworks.length === 1) {
    const remembered = rememberedNetworks[0]
    if (remembered.cidr) return remembered.cidr
    const represented = state.world.network.localNetworks.filter(({ id }) => id === remembered.id)
    return represented.length === 1 ? represented[0].cidr : undefined
  }

  const matchingLocalNetworks = state.world.network.localNetworks.filter(({ name, cidr, memberDeviceIds }) =>
    memberDeviceIds.includes(sourceDeviceId) && (name === input || cidr === input))
  return matchingLocalNetworks.length === 1 ? matchingLocalNetworks[0].cidr : undefined
}
