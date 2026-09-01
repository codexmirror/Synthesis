import { startFlipperModuleIntegration, type StartFlipperModuleIntegrationResult } from '../core/game/flipper'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createFlipperActions(accessor: GameStateAccessor) {
  return {
    startFlipperModuleIntegration(moduleFileId: string): StartFlipperModuleIntegrationResult {
      return commitResult(accessor, startFlipperModuleIntegration(accessor.read(), moduleFileId))
    },
  }
}
