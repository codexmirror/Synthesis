import { advanceProcesses } from './processes'
import { resolveCompletedServiceAnalysis } from './serviceAnalysis'
import { resolveCompletedCredentialAccess } from './credentialAccess'
import { advanceFileTransfer } from './fileTransfer'
import { advanceRackUpdatePackageSubmission, resolveCompletedRackUpdateExploit } from './rackUpdate'
import { advanceDeviceConnectivityRecovery } from './deviceConnectivityRecovery'
import { advanceRemoteSessionReachability } from './remoteSession'
import { resolveNodeMinerProduction } from './nodeMiner'
import { resolveCompletedSoftwareInstallations } from './softwareInstallation'
import { resolveCompletedSoftwareRemovals } from './softwareRemoval'
import { resolveCompletedFlipperModuleIntegrations } from './flipper'
import type { GameProcess, GameState } from './types'
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
    let rackUpdateAccess = nextState.rackUpdate.access
    const processes = processState.processes.map((process) => {
      if (process.kind === 'credential_access' && process.status === 'completed' && !process.result) {
        const resolved = resolveCompletedCredentialAccess({ ...nextState, deviceAccess, world }, process)
        deviceAccess = resolved.deviceAccess
        world = resolved.world
        return resolved.process
      }
      if (process.kind === 'rack_update_exploit' && process.status === 'completed' && !process.result) {
        const resolved = resolveCompletedRackUpdateExploit({ ...nextState, world, rackUpdate: { ...nextState.rackUpdate, access: rackUpdateAccess } }, process)
        rackUpdateAccess = resolved.rackUpdateAccess
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
      rackUpdate: { ...nextState.rackUpdate, access: rackUpdateAccess },
    })
    nextState = resolveCompletedSoftwareInstallations(nextState)
    nextState = resolveCompletedSoftwareRemovals(nextState)
    nextState = resolveCompletedFlipperModuleIntegrations(nextState)
    const previouslyRunning = new Set(state.process.processes.filter((process) => process.status === 'running').map(({ id }) => id))
    const localDeviceId = nextState.player.localDevice.id
    for (const process of nextState.process.processes) {
      if (process.status === 'completed' && previouslyRunning.has(process.id) && !isRemoteSoftwareInstallationCompletion(process, localDeviceId)) nextState = archiveProcess(nextState, process)
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
  return advanceDeviceConnectivityRecovery(nextState, elapsedMs)
}

/**
 * Remote Software Installation is the one concrete operation that currently
 * finishes on an executor Device other than the player's own, so this
 * lifecycle rule belongs to that mechanic and is deliberately scoped to it.
 * It is not a general policy for every future non-local Process kind: what a
 * hypothetical remote Service Analysis, Credential Access or generic Process
 * should do when it ends is that mechanic's decision to make, not this one's.
 */
function isRemoteSoftwareInstallationCompletion(process: GameProcess, localDeviceId: string): boolean {
  return process.kind === 'software_installation' && process.status === 'completed' && process.executorDeviceId !== localDeviceId
}

/**
 * A remote software installation has already applied its concrete consequence
 * to the Device that performed it (`resolveCompletedSoftwareInstallations`
 * runs earlier at this same boundary), and Recent Activity is deliberately the
 * local Device's own runtime observation: the NODE-OS Activity Monitor observes
 * only `player.localDevice`, and both its CLEAR and REMOVE controls are scoped
 * to that executor.
 *
 * Retaining that finished Process would therefore be canonical history no
 * interface can present or clear — and it would consume a bounded local Recent
 * Activity slot invisibly. It instead leaves the scheduler at the same boundary
 * local work is archived at. A running remote installation stays canonical for
 * exactly as long as it is actually running.
 */
function releaseRemoteSoftwareInstallationCompletions(state: GameState): GameState {
  const localDeviceId = state.player.localDevice.id
  const processes = state.process.processes.filter((process) => !isRemoteSoftwareInstallationCompletion(process, localDeviceId))
  if (processes.length === state.process.processes.length) return state
  return { ...state, process: { ...state.process, processes } }
}
