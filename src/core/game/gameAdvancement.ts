import { advanceProcesses } from './processes'
import { resolveCompletedServiceAnalysis } from './serviceAnalysis'
import { resolveCompletedCredentialAccess } from './credentialAccess'
import { advanceFileTransfer } from './fileTransfer'
import { resolveNodeMinerProduction } from './nodeMiner'
import { resolveCompletedSoftwareInstallations } from './softwareInstallation'
import { resolveCompletedSoftwareRemovals } from './softwareRemoval'
import type { GameState } from './types'
import { archiveProcess } from './recentActivity'

/**
 * Canonical advancement boundary: finished concrete work is resolved exactly
 * once against current world truth. Process (compute/RAM) runtime and
 * FileTransfer (network) runtime are independent domains that must each
 * advance on every call; a transfer must progress even while no Process is
 * running or changing.
 */
export function advanceGameState(state: GameState, elapsedMs: number): GameState {
  let nextState = state

  const executors = [nextState.player.localDevice, ...nextState.world.network.hosts.filter((host) => host.hardware && host.runtime).map((host) => ({ id: host.id, hardware: host.hardware!, runtime: host.runtime! }))]
  const processState = advanceProcesses(nextState.process, executors, elapsedMs)
  if (processState !== nextState.process) {
    let discoveries = nextState.knowledge.discoveredVulnerabilities
    let deviceAccess = nextState.deviceAccess
    let world = nextState.world
    const processes = processState.processes.map((process) => {
      if (process.kind === 'credential_access' && process.status === 'completed' && !process.result) {
        const resolved = resolveCompletedCredentialAccess({ ...nextState, deviceAccess, world }, process)
        deviceAccess = resolved.deviceAccess
        world = resolved.world
        return resolved.process
      }
      if (process.kind !== 'service_analysis' || process.status !== 'completed' || process.result) return process
      const resolved = resolveCompletedServiceAnalysis(nextState, process)
      for (const discovery of resolved.discoveries) {
        if (!discoveries.some((known) => known.vulnerabilityId === discovery.vulnerabilityId && known.targetDeviceId === discovery.targetDeviceId && known.serviceId === discovery.serviceId)) discoveries = [...discoveries, discovery]
      }
      return resolved.process
    })
    // Continuous NODE Miner production, payout routing, and the Miner's own payout artifact are resolved every advancement step, not only at completion.
    nextState = resolveNodeMinerProduction({
      ...nextState,
      process: { ...processState, processes },
      knowledge: discoveries === nextState.knowledge.discoveredVulnerabilities ? nextState.knowledge : { discoveredVulnerabilities: discoveries },
      deviceAccess,
      world,
    })
    nextState = resolveCompletedSoftwareInstallations(nextState)
    nextState = resolveCompletedSoftwareRemovals(nextState)
    const previouslyRunning = new Set(state.process.processes.filter((process) => process.status === 'running').map(({ id }) => id))
    for (const process of nextState.process.processes) {
      if (process.status === 'completed' && previouslyRunning.has(process.id)) nextState = archiveProcess(nextState, process)
    }
  }

  return advanceFileTransfer(nextState, elapsedMs)
}
