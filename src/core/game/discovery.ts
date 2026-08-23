import type { ScanResult } from './scan'
import type { InspectResult } from './inspect'
import type { DiscoveryState } from './types'

export const createEmptyDiscovery = (): DiscoveryState => ({ networks: [], devices: [], networkDeviceRelations: [] })

/** Add the positive facts in one successful observation to canonical player memory. */
export function rememberScan(discovery: DiscoveryState, result: ScanResult, selfDeviceId: string): DiscoveryState {
  if (result.status === 'no_response' || result.status === 'unknown_target') return discovery
  const networks = [...discovery.networks]
  const devices = [...discovery.devices]
  const relations = [...discovery.networkDeviceRelations]
  const rememberRelation = (networkId: string, deviceId: string) => {
    if (!relations.some((item) => item.networkId === networkId && item.deviceId === deviceId)) relations.push({ networkId, deviceId })
  }
  const rememberNetwork = (id: string, name: string, membersObserved: boolean) => {
    const index = networks.findIndex((item) => item.id === id)
    const previous = networks[index]
    const next = { id, name, membersObserved: membersObserved || previous?.membersObserved === true, ...(previous?.inspect ? { inspect: previous.inspect } : {}) }
    if (index < 0) networks.push(next); else networks[index] = next
  }
  if (result.status === 'network') {
    rememberNetwork(result.networkId, result.networkName, true)
    for (const observed of result.devices) {
      rememberRelation(result.networkId, observed.targetId)
      if (observed.targetId === selfDeviceId) continue
      const index = devices.findIndex((item) => item.id === observed.targetId)
      const previous = devices[index]
      const next = { id: observed.targetId, address: observed.address, scope: observed.scope === 'self' ? 'lan' as const : observed.scope, servicesObserved: previous?.servicesObserved ?? false, services: previous?.services ?? [], ...(previous?.inspect ? { inspect: previous.inspect } : {}) }
      if (index < 0) devices.push(next); else devices[index] = next
    }
  } else {
    for (const network of result.networks) {
      rememberNetwork(network.id, network.name, false)
      rememberRelation(network.id, result.targetId)
    }
    if (result.targetId !== selfDeviceId) {
      const index = devices.findIndex((item) => item.id === result.targetId)
      const previous = devices[index]
      const services = [...(previous?.services ?? [])]
      for (const service of result.services) {
        const previousService = services.find((item) => item.id === service.id)
        const observed = { ...service, endpoint: `${result.address}:${service.port}`, ...(previousService?.inspect ? { inspect: previousService.inspect } : {}) }
        const serviceIndex = services.findIndex((item) => item.id === service.id)
        if (serviceIndex < 0) services.push(observed); else services[serviceIndex] = observed
      }
      const next = { id: result.targetId, address: result.address, scope: result.scope === 'self' ? 'lan' as const : result.scope, servicesObserved: true, services, ...(previous?.inspect ? { inspect: previous.inspect } : {}) }
      if (index < 0) devices.push(next); else devices[index] = next
    }
  }
  return { networks, devices, networkDeviceRelations: relations }
}

/** Merge only a successful positive Inspect observation; failures never erase memory. */
export function rememberInspect(discovery: DiscoveryState, result: InspectResult, _selfDeviceId: string): DiscoveryState {
  if (result.status === 'no_response' || result.status === 'unknown_target' || (result.status === 'device' && result.scope === 'self')) return discovery
  if (result.status === 'network') {
    const index = discovery.networks.findIndex(({ id }) => id === result.networkId)
    if (index < 0) return discovery
    const networks = [...discovery.networks]
    networks[index] = { ...networks[index], name: result.networkName, inspect: { connected: result.connected } }
    return { ...discovery, networks }
  }
  const index = discovery.devices.findIndex(({ id }) => id === result.targetId)
  if (index < 0) return discovery
  const devices = [...discovery.devices]
  const previousEnhanced = devices[index].inspect?.enhanced
  const fingerprints = new Map(result.serviceFingerprints?.map(({ serviceId, inspect }) => [serviceId, inspect]))
  const services = devices[index].services.map((service) => {
    const inspect = fingerprints.get(service.id)
    return inspect ? { ...service, inspect } : service
  })
  devices[index] = { ...devices[index], address: result.address, scope: result.scope, services, inspect: { networkStatus: result.networkStatus, deviceKind: result.deviceKind, ...(result.enhanced ? { enhanced: result.enhanced } : previousEnhanced ? { enhanced: previousEnhanced } : {}) } }
  return { ...discovery, devices }
}
