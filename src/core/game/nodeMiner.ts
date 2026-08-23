import { getFilesystemFile } from './filesystem'
import { deriveResourceUsage } from './processes'
import { findInstalledNodeMiner } from './software'
import type { ExecutableFile, FilesystemState, GameState, LocalDeviceState, NodeMinerProcess, NodeWalletState, ProcessState } from './types'

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
    creditedNodeUnits: 0,
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
 * Converts each running Miner's newly accumulated fractional compute-work
 * (`workRemainder`, produced by the shared executor advancement in
 * `processes.ts`) into whole atomic NODE units, then separately resolves
 * that Miner's own configured `payoutAddress` against the current
 * represented NODE Wallet address. Production and credit are deliberately
 * distinct events: a Miner always accumulates `producedNodeUnits` from its
 * own compute regardless of payout match, and only the newly produced
 * amount is ever checked against the Wallet address at the moment it is
 * produced. Unmatched production is never retroactively credited later, and
 * there is no fallback that credits this Wallet when the configured address
 * does not currently match — an unmatched Miner still runs and still
 * produces NODE.
 */
export function resolveNodeMinerProduction(processState: ProcessState, nodeWallet: NodeWalletState): { processState: ProcessState; nodeWallet: NodeWalletState } {
  let changed = false
  let balanceNodeUnits = nodeWallet.balanceNodeUnits
  const processes = processState.processes.map((process) => {
    if (process.kind !== 'node_miner' || process.workRemainder < NODE_MINER_COMPUTE_SECONDS_PER_UNIT) return process
    const wholeUnits = Math.floor(process.workRemainder / NODE_MINER_COMPUTE_SECONDS_PER_UNIT)
    changed = true
    const workRemainder = process.workRemainder - wholeUnits * NODE_MINER_COMPUTE_SECONDS_PER_UNIT
    const matches = process.payoutAddress === nodeWallet.address
    if (matches) balanceNodeUnits += wholeUnits
    return { ...process, workRemainder, producedNodeUnits: process.producedNodeUnits + wholeUnits, creditedNodeUnits: matches ? process.creditedNodeUnits + wholeUnits : process.creditedNodeUnits }
  })
  return {
    processState: changed ? { ...processState, processes } : processState,
    nodeWallet: balanceNodeUnits !== nodeWallet.balanceNodeUnits ? { ...nodeWallet, balanceNodeUnits } : nodeWallet,
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
