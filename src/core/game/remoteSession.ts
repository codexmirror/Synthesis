import type { GameState } from './types'

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
