import { useGameState } from '../app/GameContext'
import { deriveResourceUsage } from '../core/game/processes'

export function SystemBar() {
  const state = useGameState(); const { hardware, runtime } = state.player.localDevice
  const usage = deriveResourceUsage(hardware, runtime, state.process)
  return <footer className="system-bar"><span>CPU <strong>{Math.round(usage.totalCpuLoad)}%</strong></span><span>RAM <strong>{Math.round(usage.totalRamUsage)}%</strong></span><span className="online">NET <strong>{runtime.networkStatus}</strong></span></footer>
}
