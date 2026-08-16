import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { advanceProcesses, startProcess, type StartProcessInput, type StartProcessResult } from '../core/game/processes'

const GameContext = createContext<GameState | null>(null)
interface GameActions { startProcess(input: StartProcessInput): StartProcessResult }
const GameActionsContext = createContext<GameActions | null>(null)

export function GameProvider({ children, initialState }: { children: ReactNode; initialState?: GameState }) {
  const [gameState, setGameState] = useState(() => initialState ?? createInitialGameState())
  const lastTick = useRef(performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = now - lastTick.current; lastTick.current = now
      setGameState((state) => ({ ...state, process: advanceProcesses(state.process, state.player.localDevice.hardware, state.player.localDevice.runtime, elapsed) }))
    }, 250)
    return () => window.clearInterval(timer)
  }, [])
  const actions: GameActions = { startProcess(input) {
    const result = startProcess(gameState.process, gameState.player.localDevice.hardware, gameState.player.localDevice.runtime, input)
    if (result.status === 'started') setGameState((state) => ({ ...state, process: result.state }))
    return result
  } }
  return <GameActionsContext.Provider value={actions}><GameContext.Provider value={gameState}>{children}</GameContext.Provider></GameActionsContext.Provider>
}

export function useGameActions() { const actions = useContext(GameActionsContext); if (!actions) throw new Error('useGameActions must be used inside GameProvider'); return actions }

export function useGameState() {
  const state = useContext(GameContext)
  if (!state) throw new Error('useGameState must be used inside GameProvider')
  return state
}
