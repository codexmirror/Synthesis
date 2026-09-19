import { connectRemoteFromObservation, disconnectRemoteSession, type ConnectRemoteResult, type DisconnectRemoteResult, type RemoteDeviceObservation } from '../core/game/remoteSession'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createRemoteSessionActions(accessor: GameStateAccessor) {
  return {
    connectRemoteFromObservation(observed: RemoteDeviceObservation): ConnectRemoteResult {
      return commitResult(accessor, connectRemoteFromObservation(accessor.read(), observed))
    },
    disconnectRemoteSession(): DisconnectRemoteResult {
      return commitResult(accessor, disconnectRemoteSession(accessor.read()))
    },
  }
}
