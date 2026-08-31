import { isDeviceNetworkUsable } from './deviceOperationalState'
import type { DeviceAccess, GameState, NetworkHost, NetworkService, RemoteSession } from './types'

export interface ActiveRemoteTarget {
  readonly session: RemoteSession
  readonly access: DeviceAccess
  readonly target: NetworkHost
  readonly service: NetworkService
}

/** Resolve identity only through Session -> DeviceAccess -> target Device. */
export function resolveActiveRemoteTarget(state: GameState): ActiveRemoteTarget | undefined {
  const session = state.remoteSession.active
  if (!session) return undefined
  const access = state.deviceAccess.established.find(({ id }) => id === session.accessId)
  if (!access || access.sourceDeviceId !== state.player.localDevice.id) return undefined
  const target = state.world.network.hosts.find(({ id }) => id === access.targetDeviceId)
  const service = target?.services?.find(({ id }) => id === access.viaServiceId)
  if (!target?.displayName || !target.firmware || !target.filesystem || !service) return undefined
  return { session, access, target, service }
}

export interface RemoteDeviceObservation {
  readonly targetDeviceId: string
  readonly address: string
}

export type ConnectRemoteResult = {
  readonly status: 'connected' | 'already_connected' | 'session_active' | 'access_required' | 'target_not_available'
  readonly state: GameState
}

export function connectRemoteFromObservation(state: GameState, observation: RemoteDeviceObservation): ConnectRemoteResult {
  const activeAccess = state.remoteSession.active
    ? state.deviceAccess.established.find(({ id }) => id === state.remoteSession.active?.accessId)
    : undefined
  if (activeAccess?.targetDeviceId === observation.targetDeviceId) return { status: 'already_connected', state }
  if (state.remoteSession.active) return { status: 'session_active', state }

  const access = state.deviceAccess.established.find(({ sourceDeviceId, targetDeviceId }) =>
    sourceDeviceId === state.player.localDevice.id && targetDeviceId === observation.targetDeviceId)
  if (!access) return { status: 'access_required', state }

  const target = state.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
  const service = target?.services?.find(({ id }) => id === access.viaServiceId)
  if (!isDeviceNetworkUsable(state.player.localDevice.operational) || !target || !isDeviceNetworkUsable(target.operational) || target.ip !== observation.address || !service?.open) {
    return { status: 'target_not_available', state }
  }

  const active = { id: `session-${String(state.remoteSession.nextId).padStart(4, '0')}`, accessId: access.id, connectedAddress: observation.address }
  return { status: 'connected', state: { ...state, remoteSession: { nextId: state.remoteSession.nextId + 1, active } } }
}

export type DisconnectRemoteResult = { readonly status: 'disconnected' | 'not_connected'; readonly state: GameState }

/**
 * Disconnecting ends only this interactive Session's authority. Any
 * FileTransfer admitted through it stored its DeviceAccess identity (`accessId`)
 * as a stable authorization reference and now runs as an independent network
 * runtime that revalidates that relationship, so disconnect must not clear it.
 * DeviceAccess is left untouched.
 */
export function disconnectRemoteSession(state: GameState): DisconnectRemoteResult {
  const activeSession = state.remoteSession.active
  if (!activeSession) return { status: 'not_connected', state }
  return { status: 'disconnected', state: { ...state, remoteSession: { ...state.remoteSession, active: null } } }
}

/**
 * Canonical advancement for the active Remote Session's own reachability,
 * called from `advanceGameState` alongside FileTransfer and RackUpdate
 * submission's own per-tick revalidation. A target that is no longer
 * network-usable — mid reconnect, mid reboot, or otherwise disconnected —
 * ends the Session exactly like any other lost reachability, without
 * touching the `DeviceAccess` relationship the Session was built on: access
 * remains independent and persistent even though the interactive Session
 * built on it does not survive the target's own connectivity loss.
 */
export function advanceRemoteSessionReachability(state: GameState): GameState {
  const resolved = resolveActiveRemoteTarget(state)
  if (!resolved || isDeviceNetworkUsable(resolved.target.operational)) return state
  return { ...state, remoteSession: { ...state.remoteSession, active: null } }
}
