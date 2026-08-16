import { isValidIpv4, resolveNetworkTarget, type NetworkTargets } from './networkTarget'

export type InspectTargets = NetworkTargets

export type InspectResult =
  | {
    readonly status: 'reachable'
    readonly targetId: string
    readonly address: string
    readonly scope: 'local'
    readonly networkStatus: 'ONLINE'
    readonly hardware: { readonly cpu: string; readonly ram: string }
  }
  | {
    readonly status: 'reachable'
    readonly targetId: string
    readonly address: string
    readonly scope: 'remote'
    readonly networkStatus: 'ONLINE'
  }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'invalid_target'; readonly input: string }

/** Inspect current state exposed by one responding simulated network entity. */
export function inspectNetworkTarget(targets: Readonly<InspectTargets>, input: string): InspectResult {
  if (!isValidIpv4(input)) return { status: 'invalid_target', input }

  const resolved = resolveNetworkTarget(targets, input)
  if (!resolved) return { status: 'no_response', address: input }
  if (resolved.scope === 'local') {
    const device = resolved.entity
    return device.runtime.networkStatus === 'ONLINE'
      ? {
        status: 'reachable', targetId: device.id, address: input, scope: 'local', networkStatus: 'ONLINE',
        hardware: { cpu: device.hardware.cpu, ram: device.hardware.ram },
      }
      : { status: 'no_response', address: input }
  }
  return resolved.entity.online
    ? { status: 'reachable', targetId: resolved.entity.id, address: input, scope: 'remote', networkStatus: 'ONLINE' }
    : { status: 'no_response', address: input }
}
