import { createContext, type ReactNode, useContext, useState } from 'react'
import { initialGameState } from './initialState'
import type { GameState } from './types'

const GameContext = createContext<GameState | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState] = useState<GameState>(initialGameState)
  return <GameContext.Provider value={gameState}>{children}</GameContext.Provider>
}

export function useGameState() {
  const state = useContext(GameContext)
  if (!state) throw new Error('useGameState must be used inside GameProvider')
  return state
}
