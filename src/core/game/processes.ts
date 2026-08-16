import type { HardwareState, ProcessState, RuntimeState } from './types'

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

export function deriveResourceUsage(hardware: HardwareState, runtime: RuntimeState, state: ProcessState): ResourceUsage {
  const running = state.processes.filter((process) => process.status === 'running')
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

export interface StartProcessInput { label: string; executorDeviceId: string; workRequired: number; ramRequiredMiB: number }
export type StartProcessResult =
  | { status: 'started'; state: ProcessState; processId: string }
  | { status: 'insufficient_memory'; state: ProcessState; requiredMiB: number; availableMiB: number }

export function startProcess(state: ProcessState, hardware: HardwareState, runtime: RuntimeState, input: StartProcessInput): StartProcessResult {
  const availableMiB = deriveResourceUsage(hardware, runtime, state).availableRamMiB
  if (input.ramRequiredMiB > availableMiB) return { status: 'insufficient_memory', state, requiredMiB: input.ramRequiredMiB, availableMiB }
  const processId = `process-${String(state.nextId).padStart(4, '0')}`
  return { status: 'started', processId, state: { nextId: state.nextId + 1, processes: [...state.processes, { ...input, kind: 'generic', id: processId, status: 'running', workCompleted: 0 }] } }
}

export function advanceProcesses(state: ProcessState, hardware: HardwareState, runtime: RuntimeState, elapsedMs: number): ProcessState {
  if (elapsedMs <= 0) return state
  const runningAtStart = state.processes.filter((process) => process.status === 'running')
  if (!runningAtStart.length) return state
  const availableCompute = hardware.cpu.computeCapacity * Math.max(0, 1 - runtime.baselineCpuLoad / 100)
  if (availableCompute <= 0) return state
  let remainingSeconds = Math.max(0, elapsedMs) / 1000
  let processes = [...state.processes]
  while (remainingSeconds > 1e-10) {
    const running = processes.filter((process) => process.status === 'running')
    if (!running.length) break
    const rate = availableCompute / running.length
    const toCompletion = Math.min(...running.map((process) => (process.workRequired - process.workCompleted) / rate))
    const step = Math.min(remainingSeconds, toCompletion)
    processes = processes.map((process) => process.status !== 'running' ? process : {
      ...process,
      workCompleted: Math.min(process.workRequired, process.workCompleted + rate * step),
      status: process.workCompleted + rate * step >= process.workRequired - 1e-9 ? 'completed' : 'running',
    })
    remainingSeconds -= step
    if (step <= 1e-10) break
  }
  return { ...state, processes }
}
