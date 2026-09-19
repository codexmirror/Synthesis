import type { AuthenticationHistoryRecord, AuthenticationHistoryState, WorldState } from './types'

/** Modest fixed V1 retention: oldest record is evicted first once exceeded. */
export const AUTHENTICATION_HISTORY_CAPACITY = 20

export interface AuthenticationHistoryObservation {
  readonly serviceId: string
  readonly serviceName: string
  readonly sourceAddress: string
  readonly result: 'SUCCESS' | 'FAILURE'
}

/**
 * Appends one record to a target Device's authentication history. Record
 * identity is a per-Device monotonic counter that never rewinds, even when
 * capacity eviction removes the oldest retained record.
 */
function appendAuthenticationHistoryRecord(history: AuthenticationHistoryState | undefined, observation: AuthenticationHistoryObservation): AuthenticationHistoryState {
  const current = history ?? { nextId: 1, records: [] }
  const record: AuthenticationHistoryRecord = { id: `auth-${String(current.nextId).padStart(4, '0')}`, ...observation }
  return { nextId: current.nextId + 1, records: [...current.records, record].slice(-AUTHENTICATION_HISTORY_CAPACITY) }
}

/** Owned by the target Device referenced by `targetDeviceId`; other hosts are left untouched. */
export function appendAuthenticationHistoryForHost(world: WorldState, targetDeviceId: string, observation: AuthenticationHistoryObservation): WorldState {
  const hosts = world.network.hosts.map((host) => host.id === targetDeviceId ? { ...host, authenticationHistory: appendAuthenticationHistoryRecord(host.authenticationHistory, observation) } : host)
  return { ...world, network: { ...world.network, hosts } }
}
