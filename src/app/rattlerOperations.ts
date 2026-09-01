import { createRattlerPayload, deployRattler, type CreateRattlerPayloadResult, type DeployRattlerResult } from '../core/game/rattler'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createRattlerActions(accessor: GameStateAccessor) {
  return {
    createRattlerPayload(targetAddress: string): CreateRattlerPayloadResult {
      return commitResult(accessor, createRattlerPayload(accessor.read(), targetAddress))
    },
    deployRattler(): DeployRattlerResult {
      return commitResult(accessor, deployRattler(accessor.read()))
    },
  }
}
