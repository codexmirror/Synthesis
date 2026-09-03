import { advanceProcesses } from './processes'
import { resolveCompletedServiceAnalyses } from './serviceAnalysis'
import { resolveCompletedCredentialAccessAttempts } from './credentialAccess'
import { advanceFileTransfer } from './fileTransfer'
import { advanceRackUpdatePackageSubmission, resolveCompletedRackUpdateExploits } from './rackUpdate'
import { advanceDeviceConnectivityRecovery } from './deviceConnectivityRecovery'
import { advanceRemoteSessionReachability } from './remoteSession'
import { resolveNodeMinerProduction } from './nodeMiner'
import { isRemoteSoftwareInstallationCompletion, releaseRemoteSoftwareInstallationCompletions, resolveCompletedSoftwareInstallations } from './softwareInstallation'
import { resolveCompletedSoftwareRemovals } from './softwareRemoval'
import { resolveCompletedFlipperModuleIntegrations } from './flipper'
import type { GameState } from './types'
import { archiveProcess } from './recentActivity'
import { advanceRattlerPinSearches } from './rattler'
import { resolveCompletedDeauthAttempts } from './deauth'
import { advanceTechnicianReaction } from './technician'

/**
 * Canonical advancement boundary: finished concrete work is resolved exactly
 * once against current world truth. Process (compute/RAM) runtime and
 * FileTransfer (network) runtime are independent domains that must each
 * advance on every call; a transfer must progress even while no Process is
 * running or changing.
 *
 * Each concrete mechanic owns what its own completion means — this boundary
 * only decides which mechanics participate and in what order. Credential
 * Access, RackUpdate exploit and Service Analysis completions never share
 * observable state (Credential Access's World writes are append-only
 * history/evidence; RackUpdate exploit and Service Analysis never read that
 * history), so resolving them as three explicit sequential passes over
 * `nextState.process.processes` is equivalent to resolving them positionally
 * in one pass, and is exactly what happens here.
 */
export function advanceGameState(state: GameState, elapsedMs: number, credentialAccessRandom: () => number = Math.random): GameState {
  let nextState = advanceRattlerPinSearches(state, elapsedMs)

  const executors = [nextState.player.localDevice, ...nextState.world.network.hosts.filter((host) => host.hardware && host.runtime).map((host) => ({ id: host.id, hardware: host.hardware!, runtime: host.runtime! }))]
  const processState = advanceProcesses(nextState.process, executors, elapsedMs)
  if (processState !== nextState.process) {
    nextState = { ...nextState, process: processState }
    nextState = resolveCompletedCredentialAccessAttempts(nextState, credentialAccessRandom)
    nextState = resolveCompletedRackUpdateExploits(nextState)
    nextState = resolveCompletedDeauthAttempts(nextState)
    nextState = resolveCompletedServiceAnalyses(nextState)
    // Continuous NODE Miner production, payout routing, and the Miner's own payout artifact are resolved every advancement step, not only at completion.
    nextState = resolveNodeMinerProduction(nextState)
    nextState = resolveCompletedSoftwareInstallations(nextState)
    nextState = resolveCompletedSoftwareRemovals(nextState)
    nextState = resolveCompletedFlipperModuleIntegrations(nextState)
    const previouslyRunning = new Set(state.process.processes.filter((process) => process.status === 'running').map(({ id }) => id))
    const localDeviceId = nextState.player.localDevice.id
    for (const process of nextState.process.processes) {
      if (process.status === 'completed' && previouslyRunning.has(process.id) && process.kind !== 'rattler_pin_search' && !isRemoteSoftwareInstallationCompletion(process, localDeviceId)) nextState = archiveProcess(nextState, process)
    }
    nextState = releaseRemoteSoftwareInstallationCompletions(nextState)
  }

  nextState = advanceFileTransfer(nextState, elapsedMs)
  nextState = advanceRackUpdatePackageSubmission(nextState, elapsedMs)
  // Remote Session reachability must observe this tick's *starting* Device
  // operational truth — before Device connectivity recovery has a chance to
  // restore it within this same call. Otherwise a Session could survive an
  // interruption that fully resolved (e.g. Petra's Phone reconnecting) inside
  // one large advancement step, because the step that would have invalidated
  // it never saw the intervening disconnected state.
  nextState = advanceRemoteSessionReachability(nextState)
  nextState = advanceDeviceConnectivityRecovery(nextState, elapsedMs)
  return advanceTechnicianReaction(nextState, elapsedMs)
}
