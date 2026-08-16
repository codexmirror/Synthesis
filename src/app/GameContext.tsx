import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { advanceProcesses, startProcess, type StartProcessInput, type StartProcessResult } from '../core/game/processes'

const GameContext = createContext<GameState | null>(null)
export type GameActionStartProcessInput = Omit<StartProcessInput, 'executorDeviceId'>
interface GameActions { startProcess(input: GameActionStartProcessInput): StartProcessResult }
const GameActionsContext = createContext<GameActions | null>(null)

export function GameProvider({ children, initialState }: { children: ReactNode; initialState?: GameState }) {
  const [gameState, setGameState] = useState(() => initialState ?? createInitialGameState())
  const currentState = useRef(gameState)
  const lastTick = useRef(performance.now())
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = now - lastTick.current; lastTick.current = now
      const state = currentState.current
      const process = advanceProcesses(state.process, state.player.localDevice.hardware, state.player.localDevice.runtime, elapsed)
      if (process === state.process) return
      const nextState = { ...state, process }
      currentState.current = nextState
      setGameState(nextState)
    }, 250)
    return () => window.clearInterval(timer)
  }, [])
  const actions: GameActions = { startProcess(input) {
    const state = currentState.current
    const result = startProcess(state.process, state.player.localDevice.hardware, state.player.localDevice.runtime, {
      ...input,
      executorDeviceId: state.player.localDevice.id,
    })
    if (result.status === 'started') {
      const nextState = { ...state, process: result.state }
      currentState.current = nextState
      setGameState(nextState)
    }
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
