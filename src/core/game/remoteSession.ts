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
  if (!access) return undefined
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
  if (state.player.localDevice.runtime.networkStatus !== 'ONLINE' || !target?.online || target.ip !== observation.address || !service?.open) {
    return { status: 'target_not_available', state }
  }

  const active = { id: `session-${String(state.remoteSession.nextId).padStart(4, '0')}`, accessId: access.id, connectedAddress: observation.address }
  return { status: 'connected', state: { ...state, remoteSession: { nextId: state.remoteSession.nextId + 1, active } } }
}

export type DisconnectRemoteResult = { readonly status: 'disconnected' | 'not_connected'; readonly state: GameState }

export function disconnectRemoteSession(state: GameState): DisconnectRemoteResult {
  if (!state.remoteSession.active) return { status: 'not_connected', state }
  return { status: 'disconnected', state: { ...state, remoteSession: { ...state.remoteSession, active: null } } }
}
