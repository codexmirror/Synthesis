import { getFilesystemFile } from './filesystem'
import { creditNodeAddress, type NodeRecipients } from './nodeEconomy'
import { recordNodeMinerPayout } from './nodeMinerPayoutLog'
import { deriveResourceUsage } from './processes'
import { resolveActiveRemoteTarget } from './remoteSession'
import { findInstalledNodeMiner } from './software'
import type { ExecutableFile, FilesystemState, GameState, HardwareState, LocalDeviceState, NetworkHost, NodeMinerProcess, ProcessState, RuntimeState } from './types'
import { archiveProcess } from './recentActivity'
import { NODE_MINER_1_0_RELEASE_ID } from './softwareReleaseContent'

export const NODE_MINER_PROGRAM_ID = 'node-miner' as const
export const NODE_MINER_RELEASE_ID = NODE_MINER_1_0_RELEASE_ID
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

/**
 * Exactly what NODE Miner execution needs from the Device it runs on:
 * stable identity, the filesystem the executable artifact is resolved from
 * at admission, and the hardware/runtime that will own its CPU throughput
 * and RAM reservation for as long as it runs.
 *
 * `LocalDeviceState` structurally satisfies this already, and a concretely
 * represented `NetworkHost` is narrowed into it by
 * `resolveRemoteNodeMinerExecutor`. It is deliberately private to this
 * mechanic rather than a repository-wide Device abstraction.
 */
interface NodeMinerExecutor {
  readonly id: string
  readonly filesystem: FilesystemState
  readonly hardware: HardwareState
  readonly runtime: Pick<RuntimeState, 'baselineCpuLoad' | 'baselineRamUsage'>
}

/** Admission failures that depend only on the artifact and the executor, so they mean the same thing locally and remotely. */
type NodeMinerAdmissionFailure =
  | 'invalid_path' | 'source_not_found' | 'source_not_file' | 'not_executable'
  | 'unsupported_program' | 'invalid_payout_address' | 'already_running'

/** Failures that only exist when the executor is the Device currently operated through RACK-OS. */
type OperatedDeviceFailure = 'session_unavailable' | 'target_offline'

export type StartNodeMinerResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: NodeMinerAdmissionFailure; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

export type StartRemoteNodeMinerResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: NodeMinerAdmissionFailure | OperatedDeviceFailure | 'target_not_executable'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

type AdmitNodeMinerResult =
  | { readonly status: 'started'; readonly processId: string; readonly process: ProcessState }
  | { readonly status: NodeMinerAdmissionFailure }
  | { readonly status: 'insufficient_memory'; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * The one shared admission path from a concrete executable artifact to
 * continuous Device-owned mining work.
 *
 * Every requirement is resolved against `executor` alone: the artifact is
 * read from that Device's filesystem, the one-Miner-per-executor rule is
 * scoped to that Device's own running Processes, and RAM admission uses that
 * Device's own hardware. Direct RUN stays artifact-authoritative — matching
 * InstalledSoftware is deliberately never consulted, so a supported
 * executable that was copied or uploaded remains a valid execution source.
 *
 * The artifact is required only at this instant: once the Process exists it
 * retains its own stable program/release provenance and configured payout
 * address, so moving or deleting the source afterward never affects the
 * running Miner. Downstream mining math never reads this call site; it
 * resolves the executor solely through `Process.executorDeviceId`.
 */
function admitNodeMiner(process: ProcessState, executor: NodeMinerExecutor, sourceFilePath: string, payoutAddress: string): AdmitNodeMinerResult {
  const resolved = getFilesystemFile(executor.filesystem, sourceFilePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path' }
  if (resolved.status === 'not_found') return { status: 'source_not_found' }
  if (resolved.status === 'not_file') return { status: 'source_not_file' }
  if (resolved.file.kind !== 'executable') return { status: 'not_executable' }
  if (resolved.file.programId !== NODE_MINER_PROGRAM_ID || resolved.file.releaseId !== NODE_MINER_RELEASE_ID) return { status: 'unsupported_program' }

  if (!payoutAddress.trim()) return { status: 'invalid_payout_address' }

  const duplicateRunning = process.processes.some((candidate) => candidate.kind === 'node_miner' && candidate.status === 'running' && candidate.executorDeviceId === executor.id)
  if (duplicateRunning) return { status: 'already_running' }

  const availableMiB = deriveResourceUsage(executor, process).availableRamMiB
  if (NODE_MINER_RAM_REQUIRED_MIB > availableMiB) return { status: 'insufficient_memory', requiredMiB: NODE_MINER_RAM_REQUIRED_MIB, availableMiB }

  const processId = `process-${String(process.nextId).padStart(4, '0')}`
  const miner: NodeMinerProcess = {
    kind: 'node_miner',
    id: processId,
    label: 'NODE MINER',
    executorDeviceId: executor.id,
    status: 'running',
    ramRequiredMiB: NODE_MINER_RAM_REQUIRED_MIB,
    programId: NODE_MINER_PROGRAM_ID,
    releaseId: NODE_MINER_RELEASE_ID,
    payoutAddress,
    payoutSegment: 1,
    producedNodeUnits: 0,
    payoutNodeUnits: 0,
    developerFeeNodeUnits: 0,
    segmentPayoutNodeUnits: 0,
    segmentDeveloperFeeNodeUnits: 0,
    workRemainder: 0,
  }
  return { status: 'started', processId, process: { nextId: process.nextId + 1, processes: [...process.processes, miner] } }
}

/**
 * RUN admission for a NODE Miner executable copy that exists on the player's
 * own Device, admitted onto that same Device.
 */
export function startNodeMiner(state: GameState, sourceFilePath: string, payoutAddress: string): StartNodeMinerResult {
  const admitted = admitNodeMiner(state.process, state.player.localDevice, sourceFilePath, payoutAddress)
  if (admitted.status !== 'started') return { ...admitted, state }
  return { status: 'started', processId: admitted.processId, state: { ...state, process: admitted.process } }
}

/**
 * RUN admission for a NODE Miner executable that already exists on the
 * Device the player is currently operating through RACK-OS, admitted onto
 * *that* Device.
 *
 * The executor is never supplied by presentation: it is resolved only
 * through the canonical operating context — RemoteSession -> DeviceAccess ->
 * target Device — and then narrowed to a Device that actually represents the
 * filesystem and compute resources execution needs. The currently
 * represented `USER` privilege of that access relationship is sufficient
 * authority in V1 because no finer permission state exists.
 *
 * The Session is admission authority and operating context only. Nothing
 * about the resulting Process references it: after admission the Miner
 * consumes the target Device's own CPU and RAM and nothing else, so leaving
 * RACK-OS, returning to NODE-OS, and DISCONNECT all end the player's
 * observation without touching the work.
 */
export function startRemoteNodeMiner(state: GameState, sourceFilePath: string, payoutAddress: string): StartRemoteNodeMinerResult {
  const operated = resolveOperatedDevice(state)
  if (operated.status !== 'ok') return { status: operated.status, state }
  const executor = resolveRemoteNodeMinerExecutor(operated.target)
  if (!executor) return { status: 'target_not_executable', state }
  const admitted = admitNodeMiner(state.process, executor, sourceFilePath, payoutAddress)
  if (admitted.status !== 'started') return { ...admitted, state }
  return { status: 'started', processId: admitted.processId, state: { ...state, process: admitted.process } }
}

/**
 * The Device the player is currently operating, resolved exclusively through
 * the canonical operating context. Every remote NODE Miner operation shares
 * this one resolution so no surface can name its own executor, and a target
 * that went offline while the Session was live is reported truthfully rather
 * than commanded.
 */
function resolveOperatedDevice(state: GameState): { readonly status: 'ok'; readonly target: NetworkHost } | { readonly status: OperatedDeviceFailure } {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable' }
  if (!remote.target.online) return { status: 'target_offline' }
  return { status: 'ok', target: remote.target }
}

/**
 * Narrow a represented host into a NODE Miner executor. A host that
 * represents no filesystem or compute resources cannot execute a program and
 * is not given fabricated ones to make the shapes match. Installed software
 * is deliberately not part of this: direct RUN is artifact-authoritative.
 */
function resolveRemoteNodeMinerExecutor(host: NetworkHost): NodeMinerExecutor | undefined {
  if (!host.filesystem || !host.hardware || !host.runtime) return undefined
  return { id: host.id, filesystem: host.filesystem, hardware: host.hardware, runtime: host.runtime }
}

export type StopNodeMinerResult = { readonly status: 'stopped' | 'not_found'; readonly state: GameState }
export type StopRemoteNodeMinerResult = { readonly status: 'stopped' | 'not_found' | OperatedDeviceFailure; readonly state: GameState }

/**
 * STOP removes the running Miner immediately: zero elapsed simulation time,
 * zero additional mining work, no hidden final reward, and immediate
 * release of its RAM/CPU allocation. A final observation is archived without
 * keeping it in the scheduler; global Process ID progression is
 * untouched, so a later RUN receives a new Process identity. This local
 * operation only stops a Miner executing on the player's local Device.
 */
export function stopNodeMiner(state: GameState, processId: string): StopNodeMinerResult {
  const process = state.process.processes.find(({ id }) => id === processId)
  if (!process || process.kind !== 'node_miner' || process.status !== 'running' || process.executorDeviceId !== state.player.localDevice.id) return { status: 'not_found', state }
  const withoutRuntime = { ...state, process: { ...state.process, processes: state.process.processes.filter(({ id }) => id !== processId) } }
  return { status: 'stopped', state: archiveProcess(withoutRuntime, process) }
}

/**
 * STOP for a Miner running on the Device currently operated through RACK-OS.
 * It removes exactly that Device's Miner — never the player's own — with the
 * same immediate release and absence of any final reward as local STOP.
 *
 * It archives nothing. Recent Activity is the local Device's own runtime
 * observation (the Activity Monitor filters both its history and its CLEAR
 * and REMOVE controls to `player.localDevice`), so a foreign Miner archived
 * there would be history no interface could present or clear while silently
 * consuming one of the bounded local slots. That is this mechanic's own
 * end-of-life rule, deliberately scoped to it.
 */
export function stopRemoteNodeMiner(state: GameState, processId: string): StopRemoteNodeMinerResult {
  const operated = resolveOperatedDevice(state)
  if (operated.status !== 'ok') return { status: operated.status, state }
  const process = state.process.processes.find(({ id }) => id === processId)
  if (!process || process.kind !== 'node_miner' || process.status !== 'running' || process.executorDeviceId !== operated.target.id) return { status: 'not_found', state }
  return { status: 'stopped', state: { ...state, process: { ...state.process, processes: state.process.processes.filter(({ id }) => id !== processId) } } }
}

export type RetargetNodeMinerPayoutResult =
  | { readonly status: 'retargeted'; readonly state: GameState; readonly processId: string; readonly payoutAddress: string }
  | { readonly status: 'not_running' | 'invalid_payout_address' | OperatedDeviceFailure; readonly state: GameState }
export type RetargetLocalNodeMinerPayoutResult =
  | { readonly status: 'retargeted'; readonly state: GameState; readonly processId: string; readonly payoutAddress: string }
  | { readonly status: 'not_running' | 'invalid_payout_address'; readonly state: GameState }

function retargetNodeMinerOnExecutor(state: GameState, executorDeviceId: string, payoutAddress: string): RetargetLocalNodeMinerPayoutResult {
  const process = findRunningNodeMiner(state, executorDeviceId)
  if (!process) return { status: 'not_running', state }
  if (!payoutAddress.trim()) return { status: 'invalid_payout_address', state }
  if (payoutAddress === process.payoutAddress) return { status: 'retargeted', state, processId: process.id, payoutAddress }
  const retargeted: NodeMinerProcess = { ...process, payoutAddress, payoutSegment: process.payoutSegment + 1, segmentPayoutNodeUnits: 0, segmentDeveloperFeeNodeUnits: 0 }
  return { status: 'retargeted', processId: process.id, payoutAddress, state: { ...state, process: { ...state.process, processes: state.process.processes.map((candidate) => candidate.id === process.id ? retargeted : candidate) } } }
}

export function retargetLocalNodeMinerPayout(state: GameState, payoutAddress: string): RetargetLocalNodeMinerPayoutResult {
  return retargetNodeMinerOnExecutor(state, state.player.localDevice.id, payoutAddress)
}

/**
 * Change the payout address of the Miner already running on the Device
 * currently operated through RACK-OS, without stopping it.
 *
 * This is a configuration change to one running Process, not a lifecycle
 * event: the Process ID, executor, program/release provenance, RAM
 * ownership, every accumulated economic counter and the pending fractional
 * work all survive it untouched. It consumes no simulation time, performs no
 * final payout, creates no second Process, and creates no STOP or RUN.
 * Production already routed stays exactly where it went; only payout batches
 * that complete after this instant follow the new address — pending
 * production is deliberately not reset merely because configuration changed.
 *
 * It is lower-noise than STOP followed by RUN, not invisible: the Process
 * keeps reporting its current address to anything legitimately observing it,
 * and the Miner's Device-owned payout artifact starts a new routing segment
 * so what the previous address was actually paid stays truthful.
 */
export function retargetNodeMinerPayout(state: GameState, payoutAddress: string): RetargetNodeMinerPayoutResult {
  const operated = resolveOperatedDevice(state)
  if (operated.status !== 'ok') return { status: operated.status, state }
  return retargetNodeMinerOnExecutor(state, operated.target.id, payoutAddress)
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
 * The same real payouts also maintain the Miner's own payout artifact on the
 * filesystem of the Device that actually executed the work, resolved through
 * `executorDeviceId` alone.
 */
export function resolveNodeMinerProduction(state: GameState): GameState {
  let recipients: NodeRecipients = { nodeWallet: state.nodeWallet, nodeEconomy: state.nodeEconomy }
  let localDevice = state.player.localDevice
  let hosts = state.world.network.hosts
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
    /* The artifact records the current payout routing segment rather than the
       whole run, so a Process that retargeted its payout address never
       presents earlier payouts as having gone to the address configured now. */
    const segmentPayoutNodeUnits = process.segmentPayoutNodeUnits + completedBatches * payoutPerBatch
    const segmentDeveloperFeeNodeUnits = process.segmentDeveloperFeeNodeUnits + completedBatches * developerPerBatch
    if (completedBatches > 0) {
      const record = {
        processId: process.id,
        payoutSegment: process.payoutSegment,
        grossNodeUnits: segmentPayoutNodeUnits + segmentDeveloperFeeNodeUnits,
        payoutAddress: process.payoutAddress,
        payoutNodeUnits: segmentPayoutNodeUnits,
        ...(developer ? { developerAddress: developer.address, developerFeeNodeUnits: segmentDeveloperFeeNodeUnits } : {}),
      }
      // The payout artifact belongs to the Device that ran the work, never implicitly to node-01.
      if (process.executorDeviceId === localDevice.id) {
        localDevice = { ...localDevice, filesystem: recordNodeMinerPayout(localDevice.filesystem, record) }
      } else {
        const host = hosts.find(({ id }) => id === process.executorDeviceId)
        if (host?.filesystem) {
          const filesystem = recordNodeMinerPayout(host.filesystem, record)
          if (filesystem !== host.filesystem) hosts = hosts.map((candidate) => candidate.id === host.id ? { ...candidate, filesystem } : candidate)
        }
      }
    }

    return { ...process, workRemainder, producedNodeUnits, payoutNodeUnits, developerFeeNodeUnits, segmentPayoutNodeUnits, segmentDeveloperFeeNodeUnits }
  })

  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    nodeWallet: recipients.nodeWallet,
    nodeEconomy: recipients.nodeEconomy,
    player: localDevice === state.player.localDevice ? state.player : { ...state.player, localDevice },
    world: hosts === state.world.network.hosts ? state.world : { ...state.world, network: { ...state.world.network, hosts } },
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
export function isNodeMinerAvailable(device: Pick<LocalDeviceState, 'installedSoftware' | 'filesystem'> | Pick<NetworkHost, 'installedSoftware' | 'filesystem'>): boolean {
  return findInstalledNodeMiner(device) !== undefined && device.filesystem !== undefined && findNodeMinerExecutable(device.filesystem) !== undefined
}

/**
 * The NODE Miner Process currently running on one concrete executor Device,
 * if any. Executor identity is the only authority: a Miner on node-01 and a
 * Miner on srv-01 are independent runtimes that must never be confused for
 * one another.
 */
export function findRunningNodeMiner(state: GameState, executorDeviceId: string): NodeMinerProcess | undefined {
  return state.process.processes.find((process): process is NodeMinerProcess => process.kind === 'node_miner' && process.status === 'running' && process.executorDeviceId === executorDeviceId)
}

/** The local NODE Miner Process currently running on the player's own Device, if any. */
export function findRunningLocalNodeMiner(state: GameState): NodeMinerProcess | undefined {
  return findRunningNodeMiner(state, state.player.localDevice.id)
}

/** Concrete derived runtime facts used by the NODE Miner product integration. */
export function deriveNodeMinerRuntimeStatus(state: GameState, executor: Pick<NodeMinerExecutor, 'id' | 'hardware' | 'runtime'>) {
  const process = findRunningNodeMiner(state, executor.id)
  if (!process) return undefined
  const usage = deriveResourceUsage(executor, state.process)
  const cpuPercent = usage.cpuAllocationByProcess[process.id] ?? 0
  return {
    processId: process.id, cpuPercent, ramMiB: process.ramRequiredMiB, payoutAddress: process.payoutAddress,
    producedUnits: process.producedNodeUnits,
    pendingUnits: process.producedNodeUnits % NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS,
    payoutBatchGrossUnits: NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS,
    ratePerSecondUnits: executor.hardware.cpu.computeCapacity * cpuPercent / 100 / NODE_MINER_COMPUTE_SECONDS_PER_UNIT,
  }
}
