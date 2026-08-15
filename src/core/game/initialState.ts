import type { GameState } from './types'

export const GAME_STATE_VERSION = 1

export function createInitialGameState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    player: {
      id: 'player-local-v0',
      ip: '198.51.100.23',
    },
    system: {
      hardware: {
        cpu: 'Basic CPU',
        ram: '4 GB',
      },
      runtime: {
        cpuLoad: 18,
        ramUsage: 23,
        networkStatus: 'ONLINE',
      },
    },
    wallet: {
      balance: 1250,
    },
  }
}
