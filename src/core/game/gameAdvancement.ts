import { advanceProcesses } from './processes'
import { resolveCompletedServiceAnalysis } from './serviceAnalysis'
import { resolveCompletedCredentialAccess } from './credentialAccess'
import type { GameState } from './types'

/** Canonical advancement boundary: finished concrete work is resolved exactly once against current world truth. */
export function advanceGameState(state: GameState, elapsedMs: number): GameState {
  const processState = advanceProcesses(state.process, state.player.localDevice.hardware, state.player.localDevice.runtime, elapsedMs)
  if (processState === state.process) return state
  let discoveries = state.knowledge.discoveredVulnerabilities
  let deviceAccess = state.deviceAccess
  const processes = processState.processes.map((process) => {
    if (process.kind === 'credential_access' && process.status === 'completed' && !process.result) {
      const resolved = resolveCompletedCredentialAccess({ ...state, deviceAccess }, process)
      deviceAccess = resolved.deviceAccess
      return resolved.process
    }
    if (process.kind !== 'service_analysis' || process.status !== 'completed' || process.result) return process
    const resolved = resolveCompletedServiceAnalysis(state, process)
    for (const discovery of resolved.discoveries) {
      if (!discoveries.some((known) => known.vulnerabilityId === discovery.vulnerabilityId && known.targetDeviceId === discovery.targetDeviceId && known.serviceId === discovery.serviceId)) discoveries = [...discoveries, discovery]
    }
    return resolved.process
  })
  return { ...state, process: { ...processState, processes }, knowledge: discoveries === state.knowledge.discoveredVulnerabilities ? state.knowledge : { discoveredVulnerabilities: discoveries }, deviceAccess }
}
