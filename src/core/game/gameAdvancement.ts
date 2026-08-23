import { advanceProcesses } from './processes'
import { resolveCompletedServiceAnalysis } from './serviceAnalysis'
import { resolveCompletedCredentialAccess } from './credentialAccess'
import { advanceFileTransfer } from './fileTransfer'
import type { GameState } from './types'

/**
 * Canonical advancement boundary: finished concrete work is resolved exactly
 * once against current world truth. Process (compute/RAM) runtime and
 * FileTransfer (network) runtime are independent domains that must each
 * advance on every call; a transfer must progress even while no Process is
 * running or changing.
 */
export function advanceGameState(state: GameState, elapsedMs: number): GameState {
  let nextState = state

  const processState = advanceProcesses(nextState.process, nextState.player.localDevice.hardware, nextState.player.localDevice.runtime, elapsedMs)
  if (processState !== nextState.process) {
    let discoveries = nextState.knowledge.discoveredVulnerabilities
    let deviceAccess = nextState.deviceAccess
    const processes = processState.processes.map((process) => {
      if (process.kind === 'credential_access' && process.status === 'completed' && !process.result) {
        const resolved = resolveCompletedCredentialAccess({ ...nextState, deviceAccess }, process)
        deviceAccess = resolved.deviceAccess
        return resolved.process
      }
      if (process.kind !== 'service_analysis' || process.status !== 'completed' || process.result) return process
      const resolved = resolveCompletedServiceAnalysis(nextState, process)
      for (const discovery of resolved.discoveries) {
        if (!discoveries.some((known) => known.vulnerabilityId === discovery.vulnerabilityId && known.targetDeviceId === discovery.targetDeviceId && known.serviceId === discovery.serviceId)) discoveries = [...discoveries, discovery]
      }
      return resolved.process
    })
    nextState = { ...nextState, process: { ...processState, processes }, knowledge: discoveries === nextState.knowledge.discoveredVulnerabilities ? nextState.knowledge : { discoveredVulnerabilities: discoveries }, deviceAccess }
  }

  return advanceFileTransfer(nextState, elapsedMs)
}
