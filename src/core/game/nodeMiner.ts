import { getFilesystemFile } from './filesystem'
import { deriveResourceUsage } from './processes'
import type { GameState, NodeMinerProcess, NodeWalletState, ProcessState } from './types'

export const NODE_MINER_PROGRAM_ID = 'node-miner' as const
export const NODE_MINER_RAM_REQUIRED_MIB = 512
/** V1 tuning constant: 100 compute-seconds of actual allocated compute produce 1 whole NODE. */
export const NODE_MINER_COMPUTE_SECONDS_PER_NODE = 100

export type StartNodeMinerResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: 'invalid_path' | 'source_not_found' | 'source_not_file' | 'not_executable' | 'unsupported_program' | 'invalid_payout_address' | 'already_running'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * RUN admission for a locally downloaded NODE Miner executable copy. The
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
  if (resolved.file.programId !== NODE_MINER_PROGRAM_ID) return { status: 'unsupported_program', state }

  const trimmedAddress = payoutAddress.trim()
  if (!trimmedAddress) return { status: 'invalid_payout_address', state }

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
    releaseId: resolved.file.releaseId,
    payoutAddress: trimmedAddress,
    producedNode: 0,
    creditedNode: 0,
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
 * untouched, so a later RUN receives a new Process identity.
 */
export function stopNodeMiner(state: GameState, processId: string): StopNodeMinerResult {
  const process = state.process.processes.find(({ id }) => id === processId)
  if (!process || process.kind !== 'node_miner' || process.status !== 'running') return { status: 'not_found', state }
  return {
    status: 'stopped',
    state: { ...state, process: { ...state.process, processes: state.process.processes.filter(({ id }) => id !== processId) } },
  }
}

/**
 * Converts each running Miner's newly accumulated fractional compute-work
 * (`workRemainder`, produced by the shared executor advancement in
 * `processes.ts`) into whole NODE, then separately resolves that Miner's
 * own configured `payoutAddress` against the current represented NODE
 * Wallet address. Production and credit are deliberately distinct events:
 * a Miner always accumulates `producedNode` from its own compute regardless
 * of payout match, and only the newly produced amount is ever checked
 * against the Wallet address at the moment it is produced. Unmatched
 * production is never retroactively credited later, and there is no
 * fallback that credits this Wallet when the configured address does not
 * currently match — an unmatched Miner still runs and still produces NODE.
 */
export function resolveNodeMinerProduction(processState: ProcessState, nodeWallet: NodeWalletState): { processState: ProcessState; nodeWallet: NodeWalletState } {
  let changed = false
  let balanceNode = nodeWallet.balanceNode
  const processes = processState.processes.map((process) => {
    if (process.kind !== 'node_miner' || process.workRemainder < NODE_MINER_COMPUTE_SECONDS_PER_NODE) return process
    const wholeNode = Math.floor(process.workRemainder / NODE_MINER_COMPUTE_SECONDS_PER_NODE)
    changed = true
    const workRemainder = process.workRemainder - wholeNode * NODE_MINER_COMPUTE_SECONDS_PER_NODE
    const matches = process.payoutAddress === nodeWallet.address
    if (matches) balanceNode += wholeNode
    return { ...process, workRemainder, producedNode: process.producedNode + wholeNode, creditedNode: matches ? process.creditedNode + wholeNode : process.creditedNode }
  })
  return {
    processState: changed ? { ...processState, processes } : processState,
    nodeWallet: balanceNode !== nodeWallet.balanceNode ? { ...nodeWallet, balanceNode } : nodeWallet,
  }
}
