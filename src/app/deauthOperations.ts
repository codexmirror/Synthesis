import { startDeauthAttempt, type DeauthObservation, type StartDeauthResult } from '../core/game/deauth'
import type { GameStateAccessor } from './gameStateAccess'
import { commitResult } from './gameStateAccess'

export function createDeauthActions(accessor: GameStateAccessor) {
  return { startDeauthAttempt(observed: DeauthObservation): StartDeauthResult { return commitResult(accessor, startDeauthAttempt(accessor.read(), observed)) } }
}
