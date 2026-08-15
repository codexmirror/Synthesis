import { useGameState } from '../app/GameContext'

export function SystemBar() {
  const { system } = useGameState()
  const { runtime } = system
  return <footer className="system-bar"><div><span>CPU <strong>{runtime.cpuLoad}%</strong></span><span>RAM <strong>{runtime.ramUsage}%</strong></span></div><span className="online"><i />{runtime.networkStatus}</span></footer>
}
