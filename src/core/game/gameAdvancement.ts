import { advanceProcesses } from './processes'
import { resolveCompletedServiceAnalyses } from './serviceAnalysis'
import { resolveCompletedCredentialAccessAttempts } from './credentialAccess'
import { advanceFileTransfer } from './fileTransfer'
import { advanceRackUpdatePackageSubmission, resolveCompletedRackUpdateExploits } from './rackUpdate'
import { advanceDeviceConnectivityRecovery, advanceDeviceConnectivityRecoveryForDevice } from './deviceConnectivityRecovery'
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
import { advanceDeviceFirmwareUpdatesWithRemainder } from './deviceFirmwareUpdate'
import { advanceBookstoreSalesCadence } from './bookstoreSalesCadence'
import { advanceBookstoreRestockDeliveries } from './bookstoreRestock'
import { advanceBookstoreTrend } from './bookstoreTrend'

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
 *
 * `credentialAccessRandom`, `bookstoreDemandRandom`,
 * `bookstorePurchaseRandom`, `bookstoreGratuityRandom`, and `bookstoreCoffeeRandom` are five
 * semantically independent random
 * sources for unrelated mechanics that may all be consumed during the same
 * call: Credential Access probability, Bookstore demand sampling, and
 * Bookstore purchase composition never share or advance each other's
 * sequence merely because more than one happens to occur within one
 * `advanceGameState` call. Each defaults independently to `Math.random` in
 * production. Gratuity sampling therefore never advances purchase composition's
 * source. `bookstorePurchaseRandom` never selects an amount in cents or
 * any other monetary outcome directly — only which currently available
 * represented merchandise, and how many units, a due opportunity's
 * provisional purchase composes. Coffee mode uses only its dedicated source,
 * only for a due attempt at a Branch with an installed Coffee Machine.
 */
export function advanceGameState(
  state: GameState,
  elapsedMs: number,
  credentialAccessRandom: () => number = Math.random,
  bookstoreDemandRandom: () => number = Math.random,
  bookstorePurchaseRandom: () => number = Math.random,
  bookstoreGratuityRandom: () => number = Math.random,
  bookstoreCoffeeRandom: () => number = Math.random,
): GameState {
  return advanceBookstoreSalesCadence(
    state,
    elapsedMs,
    (segmentState, segmentElapsedMs) => advanceGameStateCore(segmentState, segmentElapsedMs, credentialAccessRandom),
    bookstoreDemandRandom,
    bookstorePurchaseRandom,
    bookstoreGratuityRandom,
    bookstoreCoffeeRandom,
  )
}

/**
 * The rest of canonical advancement, exactly as it existed before Bookstore
 * Sales Cadence: every other represented mechanic `advanceGameState` used to
 * compose directly. `advanceBookstoreSalesCadence` now calls this once per
 * chronological segment between Bookstore sale-opportunity boundaries so
 * that a due opportunity observes the World/Business truth that exists at
 * its own due time, never the truth from the start or end of a larger
 * `elapsedMs` alone. A caller that never has a due opportunity inside
 * `elapsedMs` still gets exactly one call here, identical to before this
 * mechanic existed.
 */
function advanceGameStateCore(state: GameState, elapsedMs: number, credentialAccessRandom: () => number): GameState {
  // Sales Cadence calls this for each chronological segment, so a sale at a
  // boundary observes the Trend consequence true at that represented instant.
  let nextState = advanceBookstoreTrend(state, elapsedMs)
  nextState = advanceRattlerPinSearches(nextState, elapsedMs)

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
  // A running firmware installation is canonical Device state, so it advances
  // here like every other represented Device transition — never from a timer
  // inside the operating surface presenting it.
  const firmwareAdvancement = advanceDeviceFirmwareUpdatesWithRemainder(nextState, elapsedMs)
  nextState = firmwareAdvancement.state
  // Firmware activation may itself make a Device unreachable after the first
  // reachability pass. Let the same canonical Session owner observe that new
  // operational truth; the update never disconnects a Session directly.
  nextState = advanceRemoteSessionReachability(nextState)
  // Only time left after a firmware activation belongs to the reboot it
  // created. Existing recovery cycles already consumed the full step above.
  for (const remainder of firmwareAdvancement.recoveryRemainders) {
    nextState = advanceDeviceConnectivityRecoveryForDevice(nextState, remainder.deviceId, remainder.elapsedMs)
  }
  nextState = advanceTechnicianReaction(nextState, elapsedMs)
  return advanceBookstoreRestockDeliveries(nextState, elapsedMs)
}

/**
 * Advances Player/Device-owned runtime without advancing Bookstore cadence.
 * The online orchestrator uses this once per Player after advancing shared
 * World cadence exactly once. Domain completion remains owned by this module.
 */
export function advancePlayerOwnedGameState(state: GameState, elapsedMs: number, credentialAccessRandom: () => number = Math.random): GameState {
  return advanceGameStateCore(state, elapsedMs, credentialAccessRandom)
}
