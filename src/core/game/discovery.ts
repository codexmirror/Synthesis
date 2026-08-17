import type { ScanResult } from './scan'
import type { DiscoveryState } from './types'

function upsert<T>(items: readonly T[], matches: (item: T) => boolean, value: T): readonly T[] {
  const index = items.findIndex(matches)
  if (index < 0) return [...items, value]
  if (JSON.stringify(items[index]) === JSON.stringify(value)) return items
  return items.map((item, itemIndex) => itemIndex === index ? value : item)
}

/** Applies only positive facts within the successful Scan result's semantic scope. */
export function applyScanObservation(discovery: DiscoveryState, result: ScanResult): DiscoveryState {
  if (result.status === 'no_response' || result.status === 'unknown_target') return discovery
  let networks = discovery.networks
  let devices = discovery.devices
  let relationships = discovery.networkDeviceRelationships
  let services = discovery.services
  const relate = (networkId: string, deviceId: string) => {
    if (!relationships.some((item) => item.networkId === networkId && item.deviceId === deviceId)) relationships = [...relationships, { networkId, deviceId }]
  }

  if (result.status === 'network') {
    networks = upsert(networks, (item) => item.id === result.networkId, { id: result.networkId, name: result.networkName, hasObservedMembers: true })
    for (const observed of result.devices) {
      relate(result.networkId, observed.targetId)
      if (observed.scope === 'self') continue
      const remembered = devices.find((item) => item.id === observed.targetId)
      devices = upsert(devices, (item) => item.id === observed.targetId, { id: observed.targetId, address: observed.address, scope: observed.scope, hasObservedServices: remembered?.hasObservedServices ?? false })
    }
  } else {
    for (const network of result.networks) {
      const remembered = networks.find((item) => item.id === network.id)
      networks = upsert(networks, (item) => item.id === network.id, { id: network.id, name: network.name, hasObservedMembers: remembered?.hasObservedMembers ?? false })
      relate(network.id, result.targetId)
    }
    if (result.scope !== 'self') {
      devices = upsert(devices, (item) => item.id === result.targetId, { id: result.targetId, address: result.address, scope: result.scope, hasObservedServices: true })
      for (const service of result.services) services = upsert(services, (item) => item.deviceId === result.targetId && item.serviceId === service.id, {
        deviceId: result.targetId, serviceId: service.id, name: service.name, port: service.port, protocol: service.protocol,
        observedEndpoint: `${result.address}:${service.port}`,
      })
    }
  }
  if (networks === discovery.networks && devices === discovery.devices && relationships === discovery.networkDeviceRelationships && services === discovery.services) return discovery
  return { networks, devices, networkDeviceRelationships: relationships, services }
}
