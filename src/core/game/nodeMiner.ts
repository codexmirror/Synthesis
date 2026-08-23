import { getFilesystemFile } from './filesystem'
import { creditNodeAddress, type NodeRecipients } from './nodeEconomy'
import { recordNodeMinerPayout } from './nodeMinerPayoutLog'
import { deriveResourceUsage } from './processes'
import { findInstalledNodeMiner } from './software'
import type { ExecutableFile, FilesystemState, GameState, LocalDeviceState, NodeMinerProcess } from './types'

export const NODE_MINER_PROGRAM_ID = 'node-miner' as const
export const NODE_MINER_RELEASE_ID = 'node-miner-1.0' as const
export const NODE_MINER_RAM_REQUIRED_MIB = 512
/** V1 tuning constant: 1 compute-second of actual allocated compute produces 1 atomic NODE unit. */
export const NODE_MINER_COMPUTE_SECONDS_PER_UNIT = 1
/** `1 NODE = 1,000,000 atomic NODE units`. Canonical economic truth is always the integer atomic unit. */
export const NODE_UNITS_PER_NODE = 1_000_000
/** Deterministic Device-local installed-program path created by installing the NODE Miner package. */
export const NODE_MINER_INSTALLED_EXECUTABLE_PATH = '/usr/local/bin/node-miner'
export const NODE_MINER_EXECUTABLE_SIZE_BYTES = 2_100_000

/**
 * NODE Miner 1.0 is a concrete unofficial third-party release, and these
 * are properties of that one release rather than rules of NODE mining: it
 * quietly diverts a fixed share of everything it produces to a NODE address
 * embedded in the build, and routes the rest to the payout address its
 * operator configured. A future official release may divert nothing at all,
 * so this behavior is applied only to the release that actually has it (see
 * `developerFeeForRelease`) and is deliberately not a fee engine, payout
 * policy registry, or configurable mining framework.
 */
export const NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS = 'node-addr-9f31c7a4d2'
export const NODE_MINER_1_0_DEVELOPER_SHARE_PERCENT = 33
export const NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS = 1_000
export const NODE_MINER_1_0_CHANNEL = 'unofficial'
export const NODE_MINER_1_0_PUBLISHER = 'nm-dev'

export type StartNodeMinerResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: 'invalid_path' | 'source_not_found' | 'source_not_file' | 'not_executable' | 'unsupported_program' | 'invalid_payout_address' | 'already_running'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * RUN admission for a locally installed NODE Miner executable copy. The
 * executable artifact must exist and be a supported program at admission
 * time; once the Process is created it retains its own stable
 * program/release provenance and no longer depends on that source file, so
 * moving or deleting it afterward never affects the already-running Miner.
 *
 * V1 always executes on the player's local Device: this operation resolves
 * the source artifact from, and admits the Process onto, `state.player.localDevice`.
 * Downstream mining math never reads this call site; it resolves the
 * executor solely through `Process.executorDeviceId` (see `processes.ts`
 * and `resolveNodeMinerProduction`), so a future remote-execution slice can
 * point a Miner at a different executor without changing that math.
 */
export function startNodeMiner(state: GameState, sourceFilePath: string, payoutAddress: string): StartNodeMinerResult {
  const executor = state.player.localDevice
  const resolved = getFilesystemFile(executor.filesystem, sourceFilePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path', state }
  if (resolved.status === 'not_found') return { status: 'source_not_found', state }
  if (resolved.status === 'not_file') return { status: 'source_not_file', state }
  if (resolved.file.kind !== 'executable') return { status: 'not_executable', state }
  if (resolved.file.programId !== NODE_MINER_PROGRAM_ID || resolved.file.releaseId !== NODE_MINER_RELEASE_ID) return { status: 'unsupported_program', state }

  if (!payoutAddress.trim()) return { status: 'invalid_payout_address', state }

  const duplicateRunning = state.process.processes.some((process) => process.kind === 'node_miner' && process.status === 'running' && process.executorDeviceId === executor.id)
  if (duplicateRunning) return { status: 'already_running', state }

  const availableMiB = deriveResourceUsage(executor, state.process).availableRamMiB
  if (NODE_MINER_RAM_REQUIRED_MIB > availableMiB) return { status: 'insufficient_memory', state, requiredMiB: NODE_MINER_RAM_REQUIRED_MIB, availableMiB }

  const processId = `process-${String(state.process.nextId).padStart(4, '0')}`
  const process: NodeMinerProcess = {
    kind: 'node_miner',
    id: processId,
    label: 'NODE MINER',
    executorDeviceId: executor.id,
    status: 'running',
    ramRequiredMiB: NODE_MINER_RAM_REQUIRED_MIB,
    programId: NODE_MINER_PROGRAM_ID,
    releaseId: NODE_MINER_RELEASE_ID,
    payoutAddress,
    producedNodeUnits: 0,
    payoutNodeUnits: 0,
    developerFeeNodeUnits: 0,
    workRemainder: 0,
  }
  return {
    status: 'started',
    processId,
    state: { ...state, process: { nextId: state.process.nextId + 1, processes: [...state.process.processes, process] } },
  }
}

export type StopNodeMinerResult = { readonly status: 'stopped' | 'not_found'; readonly state: GameState }

/**
 * STOP removes the running Miner immediately: zero elapsed simulation time,
 * zero additional mining work, no hidden final reward, and immediate
 * release of its RAM/CPU allocation. It does not transition through a
 * generic completed/stopped history state; global Process ID progression is
 * untouched, so a later RUN receives a new Process identity. This local
 * operation only stops a Miner executing on the player's local Device.
 */
export function stopNodeMiner(state: GameState, processId: string): StopNodeMinerResult {
  const process = state.process.processes.find(({ id }) => id === processId)
  if (!process || process.kind !== 'node_miner' || process.status !== 'running' || process.executorDeviceId !== state.player.localDevice.id) return { status: 'not_found', state }
  return {
    status: 'stopped',
    state: { ...state, process: { ...state.process, processes: state.process.processes.filter(({ id }) => id !== processId) } },
  }
}

/**
 * Cumulative deterministic integer allocation of gross production.
 *
 * Only completed fixed-size gross batches are allocated, so totals and
 * economic events depend only on cumulative production and never on how
 * advancement was chunked. Canonical currency stays integer throughout.
 *
 * Only the unofficial NODE Miner 1.0 release diverts anything, and only it
 * carries an embedded developer address; any other release routes its full
 * gross production to its configured payout address.
 */
export function releaseDeveloperPayout(releaseId: string, grossNodeUnits: number): { readonly address: string; readonly feeNodeUnits: number } | undefined {
  if (releaseId !== NODE_MINER_RELEASE_ID) return undefined
  return { address: NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, feeNodeUnits: Math.floor(grossNodeUnits * NODE_MINER_1_0_DEVELOPER_SHARE_PERCENT / 100) }
}

/**
 * Converts each running Miner's newly accumulated fractional compute-work
 * (`workRemainder`, produced by the shared executor advancement in
 * `processes.ts`) into whole atomic NODE units of gross production, then
 * routes that gross production according to the behavior of the release
 * that Process is actually running.
 *
 * Production and payout are deliberately distinct events. A Miner always
 * accumulates gross `producedNodeUnits` from its own compute; the running
 * release then decides how that gross total is split between the Process's
 * own configured `payoutAddress` and, for the unofficial 1.0 release, its
 * embedded developer address. Each allocation reaches a represented
 * economic recipient only when one currently holds that exact address:
 * there is no fallback that credits the local Wallet for an address it does
 * not hold, and NODE routed to an address nobody holds simply never
 * arrives. Unrouted production is never retroactively credited later.
 *
 * The same real payouts also maintain the Miner's own Device-owned payout
 * artifact on the executor it runs on.
 */
export function resolveNodeMinerProduction(state: GameState): GameState {
  let recipients: NodeRecipients = { nodeWallet: state.nodeWallet, nodeEconomy: state.nodeEconomy }
  let filesystem = state.player.localDevice.filesystem
  let changed = false

  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'node_miner' || process.workRemainder < NODE_MINER_COMPUTE_SECONDS_PER_UNIT) return process
    const wholeUnits = Math.floor(process.workRemainder / NODE_MINER_COMPUTE_SECONDS_PER_UNIT)
    changed = true
    const workRemainder = process.workRemainder - wholeUnits * NODE_MINER_COMPUTE_SECONDS_PER_UNIT
    const producedNodeUnits = process.producedNodeUnits + wholeUnits
    const previouslyPaidGross = process.payoutNodeUnits + process.developerFeeNodeUnits
    const completedGross = Math.floor(producedNodeUnits / NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS) * NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS
    const completedBatches = (completedGross - previouslyPaidGross) / NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS
    const developer = releaseDeveloperPayout(process.releaseId, NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS)
    const developerPerBatch = developer?.feeNodeUnits ?? 0
    const payoutPerBatch = NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS - developerPerBatch

    // Route batches individually so Wallet activity represents payout events,
    // independent of how elapsed simulation time was chunked.
    for (let batch = 0; batch < completedBatches; batch += 1) {
      recipients = creditNodeAddress(recipients, process.payoutAddress, payoutPerBatch)
      if (developer) recipients = creditNodeAddress(recipients, developer.address, developerPerBatch)
    }
    const payoutNodeUnits = process.payoutNodeUnits + completedBatches * payoutPerBatch
    const developerFeeNodeUnits = process.developerFeeNodeUnits + completedBatches * developerPerBatch
    // V1 admits Miners only onto the local Device; a remote-execution slice must extend this to the executing Device's own filesystem.
    if (completedBatches > 0 && process.executorDeviceId === state.player.localDevice.id) {
      filesystem = recordNodeMinerPayout(filesystem, {
        processId: process.id,
        grossNodeUnits: payoutNodeUnits + developerFeeNodeUnits,
        payoutAddress: process.payoutAddress,
        payoutNodeUnits,
        ...(developer ? { developerAddress: developer.address, developerFeeNodeUnits } : {}),
      })
    }

    return { ...process, workRemainder, producedNodeUnits, payoutNodeUnits, developerFeeNodeUnits }
  })

  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    nodeWallet: recipients.nodeWallet,
    nodeEconomy: recipients.nodeEconomy,
    player: filesystem === state.player.localDevice.filesystem
      ? state.player
      : { ...state.player, localDevice: { ...state.player.localDevice, filesystem } },
  }
}

/** The real, currently present local NODE Miner 1.0 executable artifact, if any. Not tied to a specific path: a future move remains discoverable by program/release identity. */
export function findNodeMinerExecutable(filesystem: FilesystemState): ExecutableFile | undefined {
  return filesystem.files.find((file): file is ExecutableFile => file.kind === 'executable' && file.programId === NODE_MINER_PROGRAM_ID && file.releaseId === NODE_MINER_RELEASE_ID)
}

/**
 * Strongest truthful V1 rule for exposing the `node-miner` CLI: NODE Miner
 * must be installed on this Device AND a real supported executable artifact
 * must currently exist on it. Installed metadata alone can never make the
 * command available once its executable is gone.
 */
export function isNodeMinerAvailable(device: LocalDeviceState): boolean {
  return findInstalledNodeMiner(device) !== undefined && findNodeMinerExecutable(device.filesystem) !== undefined
}

/** The local NODE Miner Process currently running on the player's own Device, if any. */
export function findRunningLocalNodeMiner(state: GameState): NodeMinerProcess | undefined {
  return state.process.processes.find((process): process is NodeMinerProcess => process.kind === 'node_miner' && process.status === 'running' && process.executorDeviceId === state.player.localDevice.id)
}
