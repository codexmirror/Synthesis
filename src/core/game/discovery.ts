import type { ScanResult } from './scan'
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
    const next = { id, name, membersObserved: membersObserved || previous?.membersObserved === true }
    if (index < 0) networks.push(next); else networks[index] = next
  }
  if (result.status === 'network') {
    rememberNetwork(result.networkId, result.networkName, true)
    for (const observed of result.devices) {
      rememberRelation(result.networkId, observed.targetId)
      if (observed.targetId === selfDeviceId) continue
      const index = devices.findIndex((item) => item.id === observed.targetId)
      const previous = devices[index]
      const next = { id: observed.targetId, address: observed.address, scope: observed.scope === 'self' ? 'lan' as const : observed.scope, servicesObserved: previous?.servicesObserved ?? false, services: previous?.services ?? [] }
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
        const observed = { ...service, endpoint: `${result.address}:${service.port}` }
        const serviceIndex = services.findIndex((item) => item.id === service.id)
        if (serviceIndex < 0) services.push(observed); else services[serviceIndex] = observed
      }
      const next = { id: result.targetId, address: result.address, scope: result.scope === 'self' ? 'lan' as const : result.scope, servicesObserved: true, services }
      if (index < 0) devices.push(next); else devices[index] = next
    }
  }
  return { networks, devices, networkDeviceRelations: relations }
}
