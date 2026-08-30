import type { GameState, LocalNetwork } from './types'

/** Whether the given Device currently holds explicit legitimate management authority over the given Network. */
export function hasNetworkManagementAuthority(state: Pick<GameState, 'networkManagement'>, deviceId: string, networkId: string): boolean {
  return state.networkManagement.established.some((authority) => authority.deviceId === deviceId && authority.networkId === networkId)
}

/**
 * Resolve the LocalNetwork(s) the given Device currently holds explicit
 * management authority over, from canonical relationship truth alone —
 * never from Network membership, DeviceAccess, or a RemoteSession. A Device
 * belonging to a Network is not resolved here unless a matching
 * `NetworkManagementAuthority` also exists.
 */
export function resolveManagedNetworks(state: Pick<GameState, 'networkManagement' | 'world'>, deviceId: string): readonly LocalNetwork[] {
  const networkIds = new Set(
    state.networkManagement.established
      .filter((authority) => authority.deviceId === deviceId)
      .map((authority) => authority.networkId),
  )
  if (networkIds.size === 0) return []
  return state.world.network.localNetworks.filter((localNetwork) => networkIds.has(localNetwork.id))
}
