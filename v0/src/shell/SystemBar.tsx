import { useGameState } from '../app/GameContext'
import { deriveResourceUsage } from '../core/game/processes'
import { deriveNetworkStatusLabel } from '../core/game/deviceOperationalState'
import type { ActiveRemoteTarget } from '../core/game/remoteSession'

export function SystemBar({ remoteContext, onReturnRemote }: { remoteContext?: ActiveRemoteTarget; onReturnRemote?(): void }) {
  const state = useGameState(); const { hardware, operational } = state.player.localDevice
  const usage = deriveResourceUsage(state.player.localDevice, state.process)
  // The Session is already active; this control returns to it rather than
  // establishing anything, and names the address it will return to.
  const connectedAddress = remoteContext?.session.connectedAddress
  return <footer className={`system-bar${remoteContext ? ' system-bar--remote' : ''}`}><span>CPU <strong>{Math.round(usage.totalCpuLoad)}%</strong></span><span>RAM <strong>{Math.round(usage.totalRamUsage)}%</strong></span><span className="online">NET <strong>{deriveNetworkStatusLabel(operational)}</strong></span>{connectedAddress && <button type="button" className="remote-context" aria-label={`RETURN REMOTE · ${connectedAddress}`} onClick={onReturnRemote}><span className="remote-context__label">RETURN REMOTE</span><span className="remote-context__address">{connectedAddress}</span></button>}</footer>
}
