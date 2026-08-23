import { useGameState } from '../app/GameContext'
import { deriveResourceUsage } from '../core/game/processes'
import type { ActiveRemoteTarget } from '../core/game/remoteSession'

export function SystemBar({ remoteContext, onReturnRemote }: { remoteContext?: ActiveRemoteTarget; onReturnRemote?(): void }) {
  const state = useGameState(); const { hardware, runtime } = state.player.localDevice
  const usage = deriveResourceUsage(hardware, runtime, state.process)
  return <footer className="system-bar"><span>CPU <strong>{Math.round(usage.totalCpuLoad)}%</strong></span><span>RAM <strong>{Math.round(usage.totalRamUsage)}%</strong></span><span className="online">NET <strong>{runtime.networkStatus}</strong></span>{remoteContext && <button type="button" className="remote-context" onClick={onReturnRemote}>REMOTE · {remoteContext.target.displayName}</button>}</footer>
}
