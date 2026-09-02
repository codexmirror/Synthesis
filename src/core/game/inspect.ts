import { isValidIpv4, resolveLocalNetwork, resolveNetworkTarget, type NetworkTargets } from './networkTarget'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import type { DiscoveryState, EnhancedInspectEvidence, InspectedNetworkRelationship, NetworkHost, ServiceInspectSnapshot } from './types'
import { AUTH_GUARD_1_0_BUILD_ID, AUTH_GUARD_1_0_RELEASE_ID, AUTH_GUARD_PRODUCT_ID, authGuard10SupportsGateSshAuthentication } from './authGuard'

export type InspectTargets = NetworkTargets

/** Legitimate observation depth of the current player-facing Inspect operation, set by the installed NodeScan release. */
export type InspectDepth = 'shallow' | 'enhanced'

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
    /**
     * The target's own represented display identity, observed by this Inspect
     * where the Device actually has one. Scan and PING never observe it, so a
     * target stays an address until Inspect legitimately reaches it.
     */
    readonly displayName?: string
    readonly enhanced?: EnhancedInspectEvidence
    readonly networks?: readonly InspectedNetworkRelationship[]
    readonly serviceFingerprints?: readonly { readonly serviceId: string; readonly inspect: ServiceInspectSnapshot }[]
  }
  | {
    readonly status: 'network'
    readonly networkId: string
    readonly networkName: string
    readonly connected: boolean
  }
  | { readonly status: 'no_response'; readonly address: string }
  | { readonly status: 'unknown_target'; readonly input: string }

/**
 * NodeScan 1.1 Experimental compute tier, derived from represented CPU
 * compute capacity rather than exposing the raw simulation value.
 */
function classifyComputeCapacity(computeCapacity: number): 'LOW' | 'STANDARD' | 'HIGH' {
  if (computeCapacity > 150) return 'HIGH'
  if (computeCapacity > 100) return 'STANDARD'
  return 'LOW'
}

/** Enhanced evidence exists only when the target's own Firmware and hardware are concretely represented. */
function enhancedEvidenceFor(host: Readonly<NetworkHost>): EnhancedInspectEvidence | undefined {
  if (!host.firmware || !host.hardware) return undefined
  const authGuard = host.installedSoftware?.some(({ id, releaseId, buildId }) => id === AUTH_GUARD_PRODUCT_ID && releaseId === AUTH_GUARD_1_0_RELEASE_ID && buildId === AUTH_GUARD_1_0_BUILD_ID)
  const gateSsh = host.services?.find(({ implementation }) => implementation.productId === 'gate-ssh')
  return {
    firmware: { name: host.firmware.name, version: host.firmware.version },
    computeClass: classifyComputeCapacity(host.hardware.cpu.computeCapacity),
    ...(authGuard && gateSsh ? { authGuard: { name: 'AuthGuard' as const, version: '1.0' as const, protectedImplementation: `${gateSsh.implementation.name} ${gateSsh.implementation.version}`, compatibility: authGuard10SupportsGateSshAuthentication(host.installedSoftware, gateSsh) ? 'SUPPORTED' as const : 'UNSUPPORTED' as const } } : {}),
  }
}

/** Observe only Services whose stable identities are already present in this Device's Discovery snapshot. */
function serviceFingerprintsFor(host: Readonly<NetworkHost>, knownServiceIds: ReadonlySet<string>) {
  return (host.services ?? [])
    .filter(({ id }) => knownServiceIds.has(id))
    .map((service) => ({
      serviceId: service.id,
      inspect: {
        implementation: { name: service.implementation.name, version: service.implementation.version },
        ...(service.credentialAccess ? { authentication: 'Credential' as const } : {}),
        ...(service.implementation.productId === 'rack-update' && service.implementation.releaseId === 'rack-update-1.0'
          ? { interface: 'Package submission' as const }
          : {}),
      },
    }))
}

function networkRelationshipsFor(targets: Readonly<InspectTargets>, deviceId: string): readonly InspectedNetworkRelationship[] {
  return targets.network.localNetworks
    .filter(({ memberDeviceIds }) => memberDeviceIds.includes(deviceId))
    .map(({ id, name }) => ({ id, name }))
}

/** Look inward at one supported device or local network and report its properties without mutation. */
export function inspectNetworkTarget(targets: Readonly<InspectTargets>, input: string, depth: InspectDepth = 'shallow'): InspectResult {
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
    return isDeviceNetworkUsable(device.operational)
      ? {
        status: 'device', targetId: device.id, address: input, scope: 'self', networkStatus: 'ONLINE',
        hardware: { cpu: device.hardware.cpu.name, ram: device.hardware.ram.name },
      }
      : { status: 'no_response', address: input }
  }
  if (!isDeviceNetworkUsable(resolved.entity.operational)) return { status: 'no_response', address: input }
  const enhanced = depth === 'enhanced' ? enhancedEvidenceFor(resolved.entity) : undefined
  return {
    status: 'device', targetId: resolved.entity.id, address: input, scope: resolved.scope, networkStatus: 'ONLINE',
    deviceKind: resolved.entity.role === 'server' ? 'server' : 'device',
    ...(resolved.entity.displayName ? { displayName: resolved.entity.displayName } : {}),
    ...(enhanced ? { enhanced } : {}),
  }
}

/** Inspect only SELF or an identity already justified by canonical player memory. */
export function inspectKnownTarget(targets: Readonly<InspectTargets>, discovery: DiscoveryState, input: string, depth: InspectDepth = 'shallow'): InspectResult {
  if (input === targets.localDevice.network.ip) return inspectNetworkTarget(targets, input, depth)
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
  if (!current || current.scope === 'self' || current.entity.id !== remembered.id || !isDeviceNetworkUsable(current.entity.operational)) {
    return { status: 'no_response', address: input }
  }
  const enhanced = depth === 'enhanced' ? enhancedEvidenceFor(current.entity) : undefined
  const serviceFingerprints = depth === 'enhanced'
    ? serviceFingerprintsFor(current.entity, new Set(remembered.services.map(({ id }) => id)))
    : undefined
  const networks = depth === 'enhanced' ? networkRelationshipsFor(targets, current.entity.id) : undefined
  return {
    status: 'device', targetId: current.entity.id, address: input, scope: current.scope, networkStatus: 'ONLINE',
    deviceKind: current.entity.role === 'server' ? 'server' : 'device',
    ...(current.entity.displayName ? { displayName: current.entity.displayName } : {}),
    ...(enhanced ? { enhanced } : {}),
    ...(serviceFingerprints ? { serviceFingerprints } : {}),
    ...(networks ? { networks } : {}),
  }
}
