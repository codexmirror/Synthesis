import { useGameState } from '../app/GameContext'

export function SystemBar() {
  const { runtime } = useGameState().player.localDevice
  return <footer className="system-bar"><div><span>CPU <strong>{runtime.cpuLoad}%</strong></span><span>RAM <strong>{runtime.ramUsage}%</strong></span></div><span className="online"><i />{runtime.networkStatus}</span></footer>
}
