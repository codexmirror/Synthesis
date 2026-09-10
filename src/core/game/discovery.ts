import type { ScanResult } from './scan'
import type { PingResult } from './ping'
import type { DiscoveryState } from './types'

export const createEmptyDiscovery = (): DiscoveryState => ({ networks: [], devices: [], networkDeviceRelations: [] })

/** Remember the deliberately minimal positive result of a reachability observation. */
export function rememberPing(discovery: DiscoveryState, result: PingResult, selfDeviceId: string): DiscoveryState {
  if (result.status !== 'device' || result.targetId === selfDeviceId) return discovery
  const index = discovery.devices.findIndex(({ id }) => id === result.targetId)
  const previous = discovery.devices[index]
  const device = { id: result.targetId, address: result.address, scope: previous?.scope ?? 'unknown' as const,
    servicesObserved: previous?.servicesObserved ?? false, services: previous?.services ?? [], ...(previous?.inspect ? { inspect: previous.inspect } : {}) }
  const devices = [...discovery.devices]
  if (index < 0) devices.push(device); else devices[index] = device
  return { ...discovery, devices }
}

/** Add the positive facts in one successful observation to canonical player memory. */
export function rememberScan(discovery: DiscoveryState, result: ScanResult, selfDeviceId: string): DiscoveryState {
  if (result.status === 'no_response' || result.status === 'unknown_target') return discovery
  const networks = [...discovery.networks]
  const devices = [...discovery.devices]
  const relations = [...discovery.networkDeviceRelations]
  const rememberRelation = (networkId: string, deviceId: string) => {
    if (!relations.some((item) => item.networkId === networkId && item.deviceId === deviceId)) relations.push({ networkId, deviceId })
  }
  /**
   * `name` is supplied only by a genuine Network Scan (the 'network' status
   * branch below). A Host Scan's incidental relation never supplies one, so
   * it never downgrades or overwrites an already-earned name; once earned,
   * a name stays remembered even through later Host-Scan-only observations.
   */
  const rememberNetwork = (id: string, cidr: string | undefined, membersObserved: boolean, name?: string) => {
    const index = networks.findIndex((item) => item.id === id)
    const previous = networks[index]
    const resolvedName = name ?? previous?.name
    const resolvedCidr = cidr ?? previous?.cidr
    const next = {
      id,
      ...(resolvedName ? { name: resolvedName } : {}),
      ...(resolvedCidr ? { cidr: resolvedCidr } : {}),
      membersObserved: membersObserved || previous?.membersObserved === true,
      ...(previous?.inspect ? { inspect: previous.inspect } : {}),
    }
    if (index < 0) networks.push(next); else networks[index] = next
  }
  /** Merge one shallow peer sighting: refreshes address, preserves any deeper evidence already remembered. */
  const rememberShallowPeer = (peer: { readonly targetId: string; readonly address: string; readonly scope: 'lan' | 'remote' }) => {
    const index = devices.findIndex((item) => item.id === peer.targetId)
    const previous = devices[index]
    const next = {
      id: peer.targetId,
      address: peer.address,
      scope: previous?.scope ?? peer.scope,
      servicesObserved: previous?.servicesObserved ?? false,
      services: previous?.services ?? [],
      ...(previous?.classification ? { classification: previous.classification } : {}),
      ...(previous?.inspect ? { inspect: previous.inspect } : {}),
    }
    if (index < 0) devices.push(next); else devices[index] = next
  }
  if (result.status === 'network') {
    rememberNetwork(result.networkId, result.cidr, true, result.networkName)
    for (const observed of result.devices) {
      rememberRelation(result.networkId, observed.targetId)
      if (observed.targetId === selfDeviceId) continue
      const index = devices.findIndex((item) => item.id === observed.targetId)
      const previous = devices[index]
      const next = {
        id: observed.targetId, address: observed.address,
        scope: observed.scope === 'self' ? 'lan' as const : observed.scope,
        servicesObserved: previous?.servicesObserved ?? false, services: previous?.services ?? [],
        ...(observed.classification ? { classification: observed.classification } : previous?.classification ? { classification: previous.classification } : {}),
        ...(previous?.inspect ? { inspect: previous.inspect } : {}),
      }
      if (index < 0) devices.push(next); else devices[index] = next
    }
  } else {
    // A Host Scan may expand represented Network topology while deep-scanning
    // only the Host actually scanned: it remembers the relationship and the
    // Network's other Hosts, but every peer stays a shallow observation.
    for (const network of result.networks) {
      rememberNetwork(network.id, network.cidr, true)
      rememberRelation(network.id, result.targetId)
      for (const peer of network.peers) {
        rememberRelation(network.id, peer.targetId)
        rememberShallowPeer(peer)
      }
    }
    if (result.targetId !== selfDeviceId) {
      const index = devices.findIndex((item) => item.id === result.targetId)
      const previous = devices[index]
      // A successful Device Scan refreshes the whole exposed-Service snapshot.
      // Inspect evidence survives only for Services that remain exposed by
      // stable identity; removed/closed Services no longer appear as current.
      const services = result.services.map((service) => {
        const previousService = previous?.services.find((item) => item.id === service.id)
        return { ...service, endpoint: `${result.address}:${service.port}`, ...(previousService?.inspect ? { inspect: previousService.inspect } : {}) }
      })
      const next = {
        id: result.targetId, address: result.address,
        scope: previous?.scope ?? (result.scope === 'self' ? 'lan' as const : 'remote' as const),
        servicesObserved: true, services,
        ...(result.classification ? { classification: result.classification } : previous?.classification ? { classification: previous.classification } : {}),
        ...(previous?.inspect ? { inspect: previous.inspect } : {}),
      }
      if (index < 0) devices.push(next); else devices[index] = next
    }
  }
  return { networks, devices, networkDeviceRelations: relations }
}

/**
 * A successful RackUpdate package submission is itself legitimate observation
 * of what the player just applied: they chose the package and watched the
 * upload complete, so refreshing the remembered implementation fingerprint of
 * exactly that Service is not the same as a UI silently correcting a stale
 * belief from hidden World Truth. It updates only an already-remembered
 * Enhanced Inspect snapshot's `implementation` field for that one Service —
 * it never fabricates a snapshot for a Service the player never Inspected,
 * and it never touches any other remembered evidence (authentication,
 * interface, firmware, compute class, or any other Service).
 */
export function refreshSubmittedServiceImplementation(discovery: DiscoveryState, deviceId: string, serviceId: string, implementation: { readonly name: string; readonly version: string }): DiscoveryState {
  const deviceIndex = discovery.devices.findIndex(({ id }) => id === deviceId)
  if (deviceIndex < 0) return discovery
  const device = discovery.devices[deviceIndex]
  const serviceIndex = device.services.findIndex(({ id }) => id === serviceId)
  const service = device.services[serviceIndex]
  if (!service?.inspect) return discovery
  const services = device.services.map((candidate, index) => index === serviceIndex ? { ...candidate, inspect: { ...candidate.inspect!, implementation } } : candidate)
  const devices = discovery.devices.map((candidate, index) => index === deviceIndex ? { ...candidate, services } : candidate)
  return { ...discovery, devices }
}
