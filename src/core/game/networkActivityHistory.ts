import type {
  LocalNetwork,
  NetworkActivityHistoryState,
  NetworkActivityPerspective,
  NetworkActivityRecord,
  NetworkState,
  WorldState,
} from './types'

/** Modest fixed V1 retention, matching the existing AuthenticationHistory convention: oldest record is evicted first once exceeded. */
export const NETWORK_ACTIVITY_HISTORY_CAPACITY = 20

/**
 * A Device's current represented LocalNetwork membership has three distinct
 * meanings, not two: no represented Network at all, one unambiguous Network,
 * or more than one represented Network with no represented basis to choose
 * between them. Shared by FileTransfer transfer-capacity resolution and
 * Network activity evidence placement so both agree on one membership model
 * rather than risking contradictory routing rules.
 */
export type LocalNetworkMembership =
  | { readonly kind: 'none' }
  | { readonly kind: 'unique'; readonly network: Readonly<LocalNetwork> }
  | { readonly kind: 'ambiguous' }

/** Resolve the represented LocalNetwork membership(s) a Device currently belongs to, without picking one by array order. */
export function resolveDeviceLocalNetworkMembership(network: Readonly<NetworkState>, deviceId: string): LocalNetworkMembership {
  const memberships = network.localNetworks.filter(({ memberDeviceIds }) => memberDeviceIds.includes(deviceId))
  if (memberships.length === 0) return { kind: 'none' }
  if (memberships.length === 1) return { kind: 'unique', network: memberships[0] }
  return { kind: 'ambiguous' }
}

interface NetworkActivityPlacement {
  readonly networkId: string
  readonly perspective: NetworkActivityPerspective
}

/**
 * Resolve which represented LocalNetwork(s) legitimately observe one activity
 * between two Device endpoints, from World Truth membership alone. When both
 * endpoints uniquely resolve to the same Network, that Network gets exactly
 * one `internal` record. When they resolve to two distinct Networks, each
 * gets its own `outbound`/`inbound` record. When only one side resolves
 * uniquely, only that side's Network gets a record — the other side is never
 * fabricated. An ambiguous side is never guessed at and contributes nothing.
 */
export function resolveNetworkActivityPlacements(
  network: Readonly<NetworkState>,
  sourceDeviceId: string,
  destinationDeviceId: string,
): readonly NetworkActivityPlacement[] {
  const sourceMembership = resolveDeviceLocalNetworkMembership(network, sourceDeviceId)
  const destinationMembership = resolveDeviceLocalNetworkMembership(network, destinationDeviceId)
  if (sourceMembership.kind === 'unique' && destinationMembership.kind === 'unique' && sourceMembership.network.id === destinationMembership.network.id) {
    return [{ networkId: sourceMembership.network.id, perspective: 'internal' }]
  }
  const placements: NetworkActivityPlacement[] = []
  if (sourceMembership.kind === 'unique') placements.push({ networkId: sourceMembership.network.id, perspective: 'outbound' })
  if (destinationMembership.kind === 'unique') placements.push({ networkId: destinationMembership.network.id, perspective: 'inbound' })
  return placements
}

function appendNetworkActivityRecord(history: NetworkActivityHistoryState, record: Omit<NetworkActivityRecord, 'id'>): NetworkActivityHistoryState {
  const withId = { id: `net-activity-${String(history.nextId).padStart(4, '0')}`, ...record } as NetworkActivityRecord
  return { nextId: history.nextId + 1, records: [...history.records, withId].slice(-NETWORK_ACTIVITY_HISTORY_CAPACITY) }
}

function appendToPlacedNetworks(
  world: WorldState,
  placements: readonly NetworkActivityPlacement[],
  buildRecord: (perspective: NetworkActivityPerspective) => Omit<NetworkActivityRecord, 'id'>,
): WorldState {
  if (placements.length === 0) return world
  const localNetworks = world.network.localNetworks.map((localNetwork) => {
    const placement = placements.find(({ networkId }) => networkId === localNetwork.id)
    if (!placement) return localNetwork
    return { ...localNetwork, activityHistory: appendNetworkActivityRecord(localNetwork.activityHistory, buildRecord(placement.perspective)) }
  })
  return { ...world, network: { ...world.network, localNetworks } }
}

export interface NetworkConnectionAttemptObservation {
  readonly sourceDeviceId: string
  readonly targetDeviceId: string
  readonly sourceAddress: string
  readonly targetAddress: string
  readonly serviceId: string
  readonly serviceName: string
  readonly result: 'SUCCESS' | 'FAILURE'
}

/**
 * Append one Network-owned connection-attempt record per legitimately
 * resolved participating LocalNetwork. Callers must only invoke this for an
 * attempt that actually reached the represented target Device/service; this
 * function itself performs no such gating.
 */
export function appendNetworkConnectionAttemptEvidence(world: WorldState, observation: NetworkConnectionAttemptObservation): WorldState {
  const placements = resolveNetworkActivityPlacements(world.network, observation.sourceDeviceId, observation.targetDeviceId)
  return appendToPlacedNetworks(world, placements, (perspective) => ({
    kind: 'connection_attempt',
    perspective,
    sourceDeviceId: observation.sourceDeviceId,
    targetDeviceId: observation.targetDeviceId,
    sourceAddress: observation.sourceAddress,
    targetAddress: observation.targetAddress,
    serviceId: observation.serviceId,
    serviceName: observation.serviceName,
    result: observation.result,
  }))
}

export interface NetworkFileTransferObservation {
  readonly sourceDeviceId: string
  readonly destinationDeviceId: string
  readonly sourceAddress: string
  readonly destinationAddress: string
  readonly bytesTransferred: number
  readonly result: 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED'
}

/**
 * Append one Network-owned FileTransfer record per legitimately resolved
 * participating LocalNetwork. Callers must only invoke this once per
 * admitted FileTransfer's terminal outcome, never per advancement tick.
 */
export function appendNetworkFileTransferEvidence(world: WorldState, observation: NetworkFileTransferObservation): WorldState {
  const placements = resolveNetworkActivityPlacements(world.network, observation.sourceDeviceId, observation.destinationDeviceId)
  return appendToPlacedNetworks(world, placements, (perspective) => ({
    kind: 'file_transfer',
    perspective,
    sourceDeviceId: observation.sourceDeviceId,
    destinationDeviceId: observation.destinationDeviceId,
    sourceAddress: observation.sourceAddress,
    destinationAddress: observation.destinationAddress,
    bytesTransferred: observation.bytesTransferred,
    result: observation.result,
  }))
}

/**
 * Same observation shape as a FileTransfer's terminal evidence — bytes moved
 * between two Device addresses, ending in a terminal result — but recorded
 * under its own `package_submission` kind rather than `file_transfer`: a
 * RackUpdate package submission is not a FileTransfer, and Network World
 * Truth must not claim one occurred. Shares the exact same membership,
 * perspective, retention, and terminal-result semantics. Callers must only
 * invoke this once per admitted submission's terminal outcome, never per
 * advancement tick.
 */
export function appendNetworkPackageSubmissionEvidence(world: WorldState, observation: NetworkFileTransferObservation): WorldState {
  const placements = resolveNetworkActivityPlacements(world.network, observation.sourceDeviceId, observation.destinationDeviceId)
  return appendToPlacedNetworks(world, placements, (perspective) => ({
    kind: 'package_submission',
    perspective,
    sourceDeviceId: observation.sourceDeviceId,
    destinationDeviceId: observation.destinationDeviceId,
    sourceAddress: observation.sourceAddress,
    destinationAddress: observation.destinationAddress,
    bytesTransferred: observation.bytesTransferred,
    result: observation.result,
  }))
}
