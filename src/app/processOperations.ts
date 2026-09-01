import { cancelLocalProcess, type CancelLocalProcessResult } from '../core/game/processes'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createProcessActions(accessor: GameStateAccessor) {
  return {
    cancelLocalProcess(processId: string): CancelLocalProcessResult {
      return commitResult(accessor, cancelLocalProcess(accessor.read(), processId))
    },
  }
}
