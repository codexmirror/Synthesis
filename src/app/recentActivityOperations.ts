import { clearRecentActivity, removeRecentActivity } from '../core/game/recentActivity'
import { commitState, type GameStateAccessor } from './gameStateAccess'

export function createRecentActivityActions(accessor: GameStateAccessor) {
  return {
    clearRecentActivity(): void {
      const state = accessor.read()
      commitState(accessor, clearRecentActivity(state, state.player.localDevice.id))
    },
    removeRecentActivity(activityId: string): void {
      const state = accessor.read()
      commitState(accessor, removeRecentActivity(state, activityId, state.player.localDevice.id))
    },
  }
}
