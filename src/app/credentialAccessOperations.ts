import { startCredentialAccessAttemptFromObservation, type CredentialAccessObservation, type StartCredentialAccessResult } from '../core/game/credentialAccess'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createCredentialAccessActions(accessor: GameStateAccessor) {
  return {
    startCredentialAccessAttemptFromObservation(observed: CredentialAccessObservation): StartCredentialAccessResult {
      return commitResult(accessor, startCredentialAccessAttemptFromObservation(accessor.read(), observed))
    },
  }
}
