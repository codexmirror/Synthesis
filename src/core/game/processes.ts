import { archiveProcess } from './recentActivity'
import type { GameProcess, GameState, HardwareState, NodeMinerProcess, ProcessState, RuntimeState } from './types'

/** Finite work: reaches `completed` from accumulated work. Excludes the continuous NodeMinerProcess kind. */
type FiniteProcess = Exclude<GameProcess, NodeMinerProcess>

function isFiniteWork(process: GameProcess): process is FiniteProcess {
  return process.kind !== 'node_miner'
}

export interface ProcessExecutor {
  readonly id: string
  readonly hardware: HardwareState
  readonly runtime: Pick<RuntimeState, 'baselineCpuLoad' | 'baselineRamUsage'>
}

export interface ResourceUsage {
  baselineCpuLoad: number
  processCpuLoad: number
  totalCpuLoad: number
  cpuAllocationByProcess: Readonly<Record<string, number>>
  ramCapacityMiB: number
  baselineRamMiB: number
  processRamMiB: number
  availableRamMiB: number
  totalRamUsage: number
}

export function deriveResourceUsage(executor: ProcessExecutor, state: ProcessState): ResourceUsage {
  const { hardware, runtime } = executor
  const running = state.processes.filter((process) => process.status === 'running' && process.executorDeviceId === executor.id)
  const headroom = Math.max(0, 100 - runtime.baselineCpuLoad)
  const allocation = running.length ? headroom / running.length : 0
  const baselineRamMiB = hardware.ram.capacityMiB * runtime.baselineRamUsage / 100
  const processRamMiB = running.reduce((sum, process) => sum + process.ramRequiredMiB, 0)
  const usedRamMiB = Math.min(hardware.ram.capacityMiB, baselineRamMiB + processRamMiB)
  return {
    baselineCpuLoad: runtime.baselineCpuLoad,
    processCpuLoad: running.length ? headroom : 0,
    totalCpuLoad: Math.min(100, runtime.baselineCpuLoad + (running.length ? headroom : 0)),
    cpuAllocationByProcess: Object.fromEntries(running.map((process) => [process.id, allocation])),
    ramCapacityMiB: hardware.ram.capacityMiB,
    baselineRamMiB,
    processRamMiB,
    availableRamMiB: Math.max(0, hardware.ram.capacityMiB - baselineRamMiB - processRamMiB),
    totalRamUsage: hardware.ram.capacityMiB ? usedRamMiB / hardware.ram.capacityMiB * 100 : 0,
  }
}

export interface StartProcessInput { label: string; workRequired: number; ramRequiredMiB: number }
export type StartProcessResult =
  | { status: 'started'; state: ProcessState; processId: string }
  | { status: 'insufficient_memory'; state: ProcessState; requiredMiB: number; availableMiB: number }

export type CancelLocalProcessResult =
  | { status: 'cancelled'; state: GameState }
  | { status: 'not_cancellable'; state: GameState }

/** Immediately removes unfinished finite work owned by the player's local Device. */
export function cancelLocalProcess(state: GameState, processId: string): CancelLocalProcessResult {
  const process = state.process.processes.find(({ id }) => id === processId)
  if (!process || process.status !== 'running' || process.executorDeviceId !== state.player.localDevice.id || !isFiniteWork(process)) {
    return { status: 'not_cancellable', state }
  }
  const withoutRuntime = { ...state, process: { ...state.process, processes: state.process.processes.filter(({ id }) => id !== processId) } }
  return { status: 'cancelled', state: archiveProcess(withoutRuntime, process, 'cancelled') }
}

/** Removes disposable completion history without affecting running work or ID progression. */
export function clearCompletedProcesses(state: ProcessState, executorDeviceId: string): ProcessState {
  if (!state.processes.some((process) => process.status === 'completed' && process.executorDeviceId === executorDeviceId)) return state
  return { ...state, processes: state.processes.filter((process) => process.status === 'running' || process.executorDeviceId !== executorDeviceId) }
}

/** Removes one disposable completion record without affecting running work or ID progression. */
export function removeCompletedProcess(state: ProcessState, processId: string, executorDeviceId: string): ProcessState {
  const process = state.processes.find(({ id }) => id === processId)
  if (!process || process.status !== 'completed' || process.executorDeviceId !== executorDeviceId) return state
  return { ...state, processes: state.processes.filter(({ id }) => id !== processId) }
}

export function startProcess(state: ProcessState, executor: ProcessExecutor, input: StartProcessInput): StartProcessResult {
  const availableMiB = deriveResourceUsage(executor, state).availableRamMiB
  if (input.ramRequiredMiB > availableMiB) return { status: 'insufficient_memory', state, requiredMiB: input.ramRequiredMiB, availableMiB }
  const processId = `process-${String(state.nextId).padStart(4, '0')}`
  return { status: 'started', processId, state: { nextId: state.nextId + 1, processes: [...state.processes, { ...input, executorDeviceId: executor.id, kind: 'generic', id: processId, status: 'running', workCompleted: 0 }] } }
}

export function advanceProcesses(state: ProcessState, executors: readonly ProcessExecutor[], elapsedMs: number): ProcessState {
  if (elapsedMs <= 0) return state
  let processes: readonly GameProcess[] = [...state.processes]
  let changed = false
  for (const executor of executors) {
    const result = advanceExecutorProcesses(processes, executor, elapsedMs)
    if (result !== processes) { processes = result; changed = true }
  }
  return changed ? { ...state, processes } : state
}

/**
 * Advances every process an executor owns through one shared segmented CPU
 * allocation. A segment ends the moment a finite process would complete,
 * since completion changes how many processes share the executor's compute
 * from that instant onward; a continuous process (NodeMinerProcess) never
 * ends a segment on its own; it simply accumulates its exact fractional
 * share of allocated compute into `workRemainder` for every segment it
 * participates in, never rounded. This is the same loop and the same
 * per-segment rate for finite and continuous work, so both observe
 * identical contention: there is no second scheduler for continuous work.
 */
function advanceExecutorProcesses(processes: readonly GameProcess[], executor: ProcessExecutor, elapsedMs: number): readonly GameProcess[] {
  if (!processes.some((process) => process.status === 'running' && process.executorDeviceId === executor.id)) return processes
  const availableCompute = executor.hardware.cpu.computeCapacity * Math.max(0, 1 - executor.runtime.baselineCpuLoad / 100)
  if (availableCompute <= 0) return processes
  let remainingSeconds = Math.max(0, elapsedMs) / 1000
  let next = [...processes]
  while (remainingSeconds > 1e-10) {
    const running = next.filter((process) => process.status === 'running' && process.executorDeviceId === executor.id)
    if (!running.length) break
    const rate = availableCompute / running.length
    const finiteRunning = running.filter(isFiniteWork)
    const toCompletion = finiteRunning.length ? Math.min(...finiteRunning.map((process) => (process.workRequired - process.workCompleted) / rate)) : Infinity
    const step = Math.min(remainingSeconds, toCompletion)
    next = next.map((process) => {
      if (process.status !== 'running' || process.executorDeviceId !== executor.id) return process
      if (!isFiniteWork(process)) return { ...process, workRemainder: process.workRemainder + rate * step }
      const workCompleted = Math.min(process.workRequired, process.workCompleted + rate * step)
      return { ...process, workCompleted, status: workCompleted >= process.workRequired - 1e-9 ? 'completed' : 'running' }
    })
    remainingSeconds -= step
    if (step <= 1e-10) break
  }
  return next
}
