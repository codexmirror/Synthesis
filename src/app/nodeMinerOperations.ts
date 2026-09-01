import {
  payoutLocalNodeMiner,
  payoutNodeMiner,
  retargetLocalNodeMinerPayout,
  retargetNodeMinerPayout,
  startNodeMiner,
  startRemoteNodeMiner,
  stopNodeMiner,
  stopRemoteNodeMiner,
  type PayoutNodeMinerResult,
  type RetargetLocalNodeMinerPayoutResult,
  type RetargetNodeMinerPayoutResult,
  type StartNodeMinerResult,
  type StartRemoteNodeMinerResult,
  type StopNodeMinerResult,
  type StopRemoteNodeMinerResult,
} from '../core/game/nodeMiner'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createNodeMinerActions(accessor: GameStateAccessor) {
  return {
    runNodeMiner(sourceFilePath: string, payoutAddress: string): StartNodeMinerResult {
      return commitResult(accessor, startNodeMiner(accessor.read(), sourceFilePath, payoutAddress))
    },
    stopNodeMiner(processId: string): StopNodeMinerResult {
      return commitResult(accessor, stopNodeMiner(accessor.read(), processId))
    },
    runRemoteNodeMiner(sourceFilePath: string, payoutAddress: string): StartRemoteNodeMinerResult {
      return commitResult(accessor, startRemoteNodeMiner(accessor.read(), sourceFilePath, payoutAddress))
    },
    stopRemoteNodeMiner(processId: string): StopRemoteNodeMinerResult {
      return commitResult(accessor, stopRemoteNodeMiner(accessor.read(), processId))
    },
    retargetLocalNodeMinerPayout(payoutAddress: string): RetargetLocalNodeMinerPayoutResult {
      return commitResult(accessor, retargetLocalNodeMinerPayout(accessor.read(), payoutAddress))
    },
    retargetNodeMinerPayout(payoutAddress: string): RetargetNodeMinerPayoutResult {
      return commitResult(accessor, retargetNodeMinerPayout(accessor.read(), payoutAddress))
    },
    payoutLocalNodeMiner(): PayoutNodeMinerResult {
      return commitResult(accessor, payoutLocalNodeMiner(accessor.read()))
    },
    payoutNodeMiner(): PayoutNodeMinerResult {
      return commitResult(accessor, payoutNodeMiner(accessor.read()))
    },
  }
}
