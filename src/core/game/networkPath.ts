import type { GameState, LocalDeviceState, LocalNetwork, NetworkHost, NetworkService } from './types'

export type NetworkPath =
  | { readonly kind: 'DIRECT_LOCAL'; readonly source: LocalDeviceState | NetworkHost; readonly target: LocalDeviceState | NetworkHost; readonly targetService?: NetworkService }
  | { readonly kind: 'EXPOSED_EDGE'; readonly source: LocalDeviceState | NetworkHost; readonly gateway: NetworkHost; readonly target?: NetworkHost; readonly targetService?: NetworkService }
  | { readonly kind: 'NO_ROUTE' }

export function resolveDevice(state: Readonly<GameState>, id: string): LocalDeviceState | NetworkHost | undefined {
  return state.player.localDevice.id === id ? state.player.localDevice : state.world.network.hosts.find((host) => host.id === id)
}

function uniqueNetwork(state: Readonly<GameState>, deviceId: string): LocalNetwork | undefined {
  const matches = state.world.network.localNetworks.filter((network) => network.memberDeviceIds.includes(deviceId))
  return matches.length === 1 ? matches[0] : undefined
}

function validGateway(state: Readonly<GameState>, network: LocalNetwork): NetworkHost | undefined {
  if (!network.gatewayDeviceId || !network.memberDeviceIds.includes(network.gatewayDeviceId)) return undefined
  const matches = state.world.network.hosts.filter((host) => host.id === network.gatewayDeviceId && host.deviceType === 'ROUTER')
  return matches.length === 1 ? matches[0] : undefined
}

/** Intrinsic configuration of one represented Device. It never creates
 * Discovery: `ip` observes SELF in the current operating context. */
export function resolveDeviceNetworkContext(state: Readonly<GameState>, deviceId: string): { readonly address: string; readonly cidr: string; readonly gateway: string } | undefined {
  const device = resolveDevice(state, deviceId)
  const network = uniqueNetwork(state, deviceId)
  if (!device || !network?.cidr) return undefined
  const gateway = validGateway(state, network)
  if (!gateway) return undefined
  return { address: 'network' in device ? device.network.ip : device.ip, cidr: network.cidr, gateway: gateway.ip }
}

/** The sole V1 route owner. It derives paths from represented membership and
 * gateway exposure; an address existing in World Truth is never itself a route. */
export function resolveNetworkPath(state: Readonly<GameState>, sourceDeviceId: string, address: string, port?: number, protocol: 'TCP' | 'UDP' = 'TCP'): NetworkPath {
  const source = resolveDevice(state, sourceDeviceId)
  if (!source) return { kind: 'NO_ROUTE' }
  const directCandidates = [state.player.localDevice, ...state.world.network.hosts].filter((device) => ('network' in device && device.network.ip === address) || ('ip' in device && device.ip === address))
  if (directCandidates.length === 1) {
    const target = directCandidates[0]
    const sourceNetwork = uniqueNetwork(state, source.id)
    const targetNetwork = uniqueNetwork(state, target.id)
    if (sourceNetwork && targetNetwork && sourceNetwork.id === targetNetwork.id) {
      const targetService = port === undefined ? undefined : ('services' in target ? target.services?.find((service) => service.port === port && service.protocol === protocol) : undefined)
      return { kind: 'DIRECT_LOCAL', source, target, ...(targetService ? { targetService } : {}) }
    }
  }
  const edgeNetworks = state.world.network.localNetworks.filter((network) => {
    const gateway = validGateway(state, network)
    return gateway?.ip === address && uniqueNetwork(state, source.id)?.id !== network.id
  })
  if (edgeNetworks.length !== 1) return { kind: 'NO_ROUTE' }
  const network = edgeNetworks[0]; const gateway = validGateway(state, network)
  if (!gateway) return { kind: 'NO_ROUTE' }
  // A public address is the Gateway's own edge. Portless reconnaissance may
  // reach it regardless of how many forwards exist, and must not pretend one
  // backend is the public endpoint.
  if (port === undefined) return { kind: 'EXPOSED_EDGE', source, gateway }
  const matches = (gateway.exposures ?? []).filter((exposure) => exposure.protocol === protocol && exposure.externalPort === port)
  if (matches.length !== 1) return { kind: 'NO_ROUTE' }
  const exposure = matches[0]
  if (!network.memberDeviceIds.includes(exposure.targetDeviceId)) return { kind: 'NO_ROUTE' }
  const targets = state.world.network.hosts.filter((host) => host.id === exposure.targetDeviceId)
  if (targets.length !== 1) return { kind: 'NO_ROUTE' }
  const serviceMatches = (targets[0].services ?? []).filter((service) => service.id === exposure.targetServiceId && service.protocol === exposure.protocol)
  if (serviceMatches.length !== 1) return { kind: 'NO_ROUTE' }
  return { kind: 'EXPOSED_EDGE', source, target: targets[0], targetService: serviceMatches[0], gateway }
}
