import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

export type AppId = 'terminal' | 'network' | 'wallet' | 'notes' | 'files' | 'system'

export interface PlayerState {
  ip: string
  money: number
  hardware: { cpu: number; ram: number }
  status: 'ONLINE' | 'OFFLINE'
  currentApp: AppId | null
}

const initialPlayer: PlayerState = {
  ip: '198.51.100.23',
  money: 1250,
  hardware: { cpu: 18, ram: 23 },
  status: 'ONLINE',
  currentApp: null,
}

interface GameContextValue {
  player: PlayerState
  openApp: (app: AppId) => void
  goHome: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState(initialPlayer)
  const value = useMemo(() => ({
    player,
    openApp: (currentApp: AppId) => setPlayer((state) => ({ ...state, currentApp })),
    goHome: () => setPlayer((state) => ({ ...state, currentApp: null })),
  }), [player])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) throw new Error('useGame must be used inside GameProvider')
  return context
}
