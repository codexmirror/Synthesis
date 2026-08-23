import { isValidIpv4, resolveLocalNetwork, resolveNetworkTarget, type NetworkTargets } from './networkTarget'
import type { DiscoveryState } from './types'

export type InspectTargets = NetworkTargets

export type InspectResult =
  | {
    readonly status: 'device'
    readonly targetId: string
    readonly address: string
    readonly scope: 'self'
    readonly networkStatus: 'ONLINE'
    readonly hardware: { readonly cpu: string; readonly ram: string }
  }
  | {
    readonly status: 'device'
    readonly targetId: string
    readonly address: string
    readonly scope: 'lan' | 'remote'
    readonly networkStatus: 'ONLINE'
    readonly deviceKind: 'device' | 'server'
  }
  | {
    readonly status: 'network'
    readonly networkId: string
    readonly networkName: string
    readonly connected: boolean
  }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'unknown_target'; readonly input: string }

/** Look inward at one supported device or local network and report its properties without mutation. */
export function inspectNetworkTarget(targets: Readonly<InspectTargets>, input: string): InspectResult {
  if (!isValidIpv4(input)) {
    const network = resolveLocalNetwork(targets.network, input)
    return network
      ? {
        status: 'network',
        networkId: network.id,
        networkName: network.name,
        connected: network.memberDeviceIds.includes(targets.localDevice.id),
      }
      : { status: 'unknown_target', input }
  }

  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  if (resolved.scope === 'self') {
    const device = resolved.entity
    return device.runtime.networkStatus === 'ONLINE'
      ? {
        status: 'device', targetId: device.id, address: input, scope: 'self', networkStatus: 'ONLINE',
        hardware: { cpu: device.hardware.cpu.name, ram: device.hardware.ram.name },
      }
      : { status: 'no_response', address: input }
  }
  return resolved.entity.online
    ? {
      status: 'device', targetId: resolved.entity.id, address: input, scope: resolved.scope, networkStatus: 'ONLINE',
      deviceKind: resolved.entity.role === 'server' ? 'server' : 'device',
    }
    : { status: 'no_response', address: input }
}

/** Inspect only SELF or an identity already justified by canonical player memory. */
export function inspectKnownTarget(targets: Readonly<InspectTargets>, discovery: DiscoveryState, input: string): InspectResult {
  if (input === targets.localDevice.network.ip) return inspectNetworkTarget(targets, input)
  if (!isValidIpv4(input)) {
    const remembered = discovery.networks.find(({ name }) => name === input)
    if (!remembered) return { status: 'unknown_target', input }
    const current = resolveLocalNetwork(targets.network, input)
    return current?.id === remembered.id
      ? { status: 'network', networkId: current.id, networkName: current.name, connected: current.memberDeviceIds.includes(targets.localDevice.id) }
      : { status: 'no_response', address: input }
  }
  const remembered = discovery.devices.find(({ address }) => address === input)
  if (!remembered) return { status: 'unknown_target', input }
  const current = resolveNetworkTarget(targets, input)
  if (!current || current.scope === 'self' || current.entity.id !== remembered.id || !current.entity.online) {
    return { status: 'no_response', address: input }
  }
  return { status: 'device', targetId: current.entity.id, address: input, scope: current.scope, networkStatus: 'ONLINE', deviceKind: current.entity.role === 'server' ? 'server' : 'device' }
}
