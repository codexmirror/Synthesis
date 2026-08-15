import { createContext, type ReactNode, useContext, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'

const GameContext = createContext<GameState | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState] = useState(createInitialGameState)
  return <GameContext.Provider value={gameState}>{children}</GameContext.Provider>
}

export function useGameState() {
  const state = useContext(GameContext)
  if (!state) throw new Error('useGameState must be used inside GameProvider')
  return state
}
