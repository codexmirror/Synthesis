import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { advanceGameState, startServiceAnalysis, type StartServiceAnalysisResult } from '../core/game/serviceAnalysis'
import { clearCompletedProcesses as clearCompletedProcessState } from '../core/game/processes'

const GameContext = createContext<GameState | null>(null)
interface GameActions {
  startServiceAnalysis(targetDeviceId: string, serviceId: string): StartServiceAnalysisResult
  clearCompletedProcesses(): void
}
const GameActionsContext = createContext<GameActions | null>(null)

export function GameProvider({ children, initialState }: { children: ReactNode; initialState?: GameState }) {
  const [gameState, setGameState] = useState(() => initialState ?? createInitialGameState())
  const currentState = useRef(gameState)
  const lastTick = useRef(performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = now - lastTick.current; lastTick.current = now
      const state = currentState.current
      const nextState = advanceGameState(state, elapsed)
      if (nextState === state) return
      currentState.current = nextState
      setGameState(nextState)
    }, 250)
    return () => window.clearInterval(timer)
  }, [])
  const actions: GameActions = { startServiceAnalysis(targetDeviceId, serviceId) {
    const state = currentState.current
    const result = startServiceAnalysis(state, targetDeviceId, serviceId)
    if (result.status === 'started') {
      const nextState = result.state
      currentState.current = nextState
      setGameState(nextState)
    }
    return result
  }, clearCompletedProcesses() {
    const state = currentState.current
    const process = clearCompletedProcessState(state.process)
    if (process === state.process) return
    const nextState = { ...state, process }
    currentState.current = nextState
    setGameState(nextState)
  } }
  return <GameActionsContext.Provider value={actions}><GameContext.Provider value={gameState}>{children}</GameContext.Provider></GameActionsContext.Provider>
}

export function useGameActions() { const actions = useContext(GameActionsContext); if (!actions) throw new Error('useGameActions must be used inside GameProvider'); return actions }

export function useGameState() {
  const state = useContext(GameContext)
  if (!state) throw new Error('useGameState must be used inside GameProvider')
  return state
}
