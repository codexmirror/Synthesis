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
    const targetMemberships = state.world.network.localNetworks.filter((network) => network.memberDeviceIds.includes(target.id))
    const sourceNetwork = uniqueNetwork(state, source.id)
    // DIRECT_LOCAL requires unambiguous membership in exactly the same represented LocalNetwork as the
    // source. A Device always resolves itself, regardless of any Network membership ambiguity: knowing
    // where you stand never depends on how many represented Networks claim you. Every other case —
    // including a Device with no represented Network placement at all, and a real but currently
    // unresolvable Gateway relationship — fails closed exactly like every other membership resolution
    // here. Missing or absent placement truth is never treated as an absence of gating.
    const reachableDirectly = target.id === source.id
      || (targetMemberships.length === 1 && Boolean(sourceNetwork && sourceNetwork.id === targetMemberships[0].id))
    if (reachableDirectly) {
      const targetService = port === undefined ? undefined : ('services' in target ? target.services?.find((service) => service.port === port && service.protocol === protocol) : undefined)
      return { kind: 'DIRECT_LOCAL', source, target, ...(targetService ? { targetService } : {}) }
    }
  }
  // EXPOSED_EDGE resolves only against a Gateway's own explicit `publicAddress` — its externally
  // reconnaissable edge, distinct from `ip`, its ordinary internal LAN position. A Gateway with no
  // `publicAddress` has no external edge at all and never becomes reachable merely because it is a
  // Gateway; the represented edge must be named explicitly, never inferred from absent truth.
  const edgeNetworks = state.world.network.localNetworks.filter((network) => {
    const gateway = validGateway(state, network)
    return Boolean(gateway?.publicAddress) && gateway!.publicAddress === address && uniqueNetwork(state, source.id)?.id !== network.id
  })
  if (edgeNetworks.length !== 1) return { kind: 'NO_ROUTE' }
  const network = edgeNetworks[0]; const gateway = validGateway(state, network)
  if (!gateway) return { kind: 'NO_ROUTE' }
  // A public address is the Gateway's own edge. Portless reconnaissance may
  // reach it regardless of how many forwards exist, and must not pretend one
  // backend is the public endpoint.
  if (port === undefined) return { kind: 'EXPOSED_EDGE', source, gateway }
  // The Gateway's own hosted Service is reachable directly at its own public address and needs no
  // forward: an exposure only ever names a distinct backend Device, never the Gateway itself.
  const ownService = (gateway.services ?? []).find((service) => service.protocol === protocol && service.port === port)
  if (ownService) return { kind: 'EXPOSED_EDGE', source, gateway, target: gateway, targetService: ownService }
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

/**
 * Whether one already-known target Device + Service — identity `Connect` and
 * RemoteSession revalidation already hold via `DeviceAccess`, never an
 * arbitrary dialed port — is currently reachable from `sourceDeviceId` at
 * `address`: DIRECT_LOCAL by shared LocalNetwork membership, or EXPOSED_EDGE
 * through a Gateway's own public edge and an exposure (or the Gateway's own
 * hosted Service) explicitly naming this exact Device/Service. This resolves
 * by stable identity rather than a numeric port match so distinct backend
 * Devices may share the same internal Service port while forwarded through
 * distinct external ports, without Connect ever needing to know which.
 */
export function resolveKnownServicePath(state: Readonly<GameState>, sourceDeviceId: string, address: string, targetDeviceId: string, serviceId: string): NetworkPath {
  const portless = resolveNetworkPath(state, sourceDeviceId, address)
  if (portless.kind === 'DIRECT_LOCAL') {
    if (portless.target.id !== targetDeviceId) return { kind: 'NO_ROUTE' }
    const targetService = 'services' in portless.target ? portless.target.services?.find((service) => service.id === serviceId) : undefined
    return targetService ? { ...portless, targetService } : { kind: 'NO_ROUTE' }
  }
  if (portless.kind === 'EXPOSED_EDGE') {
    if (portless.gateway.id === targetDeviceId) {
      const targetService = portless.gateway.services?.find((service) => service.id === serviceId)
      return targetService ? { ...portless, target: portless.gateway, targetService } : { kind: 'NO_ROUTE' }
    }
    const exposure = (portless.gateway.exposures ?? []).find((item) => item.targetDeviceId === targetDeviceId && item.targetServiceId === serviceId)
    if (!exposure) return { kind: 'NO_ROUTE' }
    const target = state.world.network.hosts.find((host) => host.id === exposure.targetDeviceId)
    const targetService = target?.services?.find((service) => service.id === exposure.targetServiceId && service.protocol === exposure.protocol)
    return target && targetService ? { kind: 'EXPOSED_EDGE', source: portless.source, gateway: portless.gateway, target, targetService } : { kind: 'NO_ROUTE' }
  }
  return { kind: 'NO_ROUTE' }
}

/**
 * The path an ordinary local Analysis / Credential Access / Connect operation
 * resolves through: always the player's own local Device. `DeviceAccess`
 * proves a represented access relationship to a target Device — it is never
 * network position, and it is never an implicit alternative source here. A
 * remote Device becomes the executing source only when an operation is
 * explicitly invoked from it through a represented remote execution surface,
 * exactly like Scan's own explicit-source pattern (`scanFromDevice`,
 * `pingFromDevice`); no current Analysis, Credential Access, or Connect
 * operation offers that surface yet, so this always resolves from SELF.
 */
export function resolvePlayerNetworkPath(state: Readonly<GameState>, address: string, port?: number, protocol: 'TCP' | 'UDP' = 'TCP'): NetworkPath {
  return resolveNetworkPath(state, state.player.localDevice.id, address, port, protocol)
}
