import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceProcesses, clearCompletedProcesses, deriveResourceUsage, startProcess } from './processes'

const game = createInitialGameState(); const hardware = game.player.localDevice.hardware; const runtime = game.player.localDevice.runtime
const input = (label = 'Analysis', ramRequiredMiB = 512, workRequired = 1000) => ({ label, ramRequiredMiB, workRequired, executorDeviceId: game.player.localDevice.id })
function started(...jobs: ReturnType<typeof input>[]) { let state = game.process; for (const job of jobs) { const result = startProcess(state, hardware, runtime, job); if (result.status !== 'started') throw Error('fixture rejected'); state = result.state } return state }

describe('process resource domain', () => {
  it('preserves identity for empty and running-only process states', () => {
    expect(clearCompletedProcesses(game.process)).toBe(game.process)
    const running = started(input())
    expect(clearCompletedProcesses(running)).toBe(running)
    expect(running.processes).toHaveLength(1)
  })
  it('clears completed-only history without mutation and preserves nextId', () => {
    const completed = advanceProcesses(started(input('Done', 100, 1)), hardware, runtime, 1000)
    const snapshot = structuredClone(completed)
    const cleared = clearCompletedProcesses(completed)
    expect(cleared).not.toBe(completed)
    expect(cleared).toEqual({ nextId: 2, processes: [] })
    expect(completed).toEqual(snapshot)
  })
  it('removes only completed jobs while preserving running order and nextId', () => {
    const base = started(input('First'), input('Done', 100, 1), input('Last'))
    const mixed = { ...base, processes: base.processes.map((process) => process.id === 'process-0002' ? { ...process, status: 'completed' as const, workCompleted: process.workRequired } : process) }
    const snapshot = structuredClone(mixed)
    const cleared = clearCompletedProcesses(mixed)
    expect(cleared.nextId).toBe(4)
    expect(cleared.processes.map(({ id }) => id)).toEqual(['process-0001', 'process-0003'])
    expect(cleared.processes.every(({ status }) => status === 'running')).toBe(true)
    expect(mixed).toEqual(snapshot)
  })
  it('creates stable IDs with explicit executors and admits without mutation', () => {
    const original = structuredClone(game.process); const first = startProcess(game.process, hardware, runtime, input())
    expect(first).toMatchObject({ status: 'started', processId: 'process-0001' }); if (first.status !== 'started') return
    expect(first.state.processes[0]).toMatchObject({ id: 'process-0001', executorDeviceId: 'device-local-v0', status: 'running' })
    expect(startProcess(first.state, hardware, runtime, input()).status).toBe('started'); expect(game.process).toEqual(original)
  })
  it('rejects insufficient RAM structurally and leaves state unchanged', () => {
    const result = startProcess(game.process, hardware, runtime, input('Huge', 4000)); expect(result.status).toBe('insufficient_memory'); expect(result.state).toBe(game.process)
  })
  it('derives idle baseline and numeric hardware truth', () => {
    const usage = deriveResourceUsage(hardware, runtime, game.process); expect(usage.totalCpuLoad).toBe(18); expect(usage.totalRamUsage).toBe(23); expect(hardware.ram.capacityMiB).toBe(4096); expect(hardware.cpu.computeCapacity).toBe(100)
  })
  it('shares CPU headroom and accumulates RAM reservations', () => {
    const one = started(input()); const two = started(input('A'), input('B'))
    expect(deriveResourceUsage(hardware, runtime, one).cpuAllocationByProcess['process-0001']).toBe(82)
    expect(deriveResourceUsage(hardware, runtime, two)).toMatchObject({ totalCpuLoad: 100, processRamMiB: 1024 })
    expect(deriveResourceUsage(hardware, runtime, two).cpuAllocationByProcess['process-0001']).toBe(41)
    expect(advanceProcesses(one, hardware, runtime, 1000).processes[0].workCompleted).toBe(82)
    expect(advanceProcesses(two, hardware, runtime, 1000).processes[0].workCompleted).toBe(41)
  })
  it('CPU buys speed while RAM buys admission but not speed', () => {
    const state = started(input()); const fast = { ...hardware, cpu: { ...hardware.cpu, computeCapacity: 200 } }; const moreRam = { ...hardware, ram: { ...hardware.ram, capacityMiB: 8192 } }
    expect(advanceProcesses(state, fast, runtime, 1000).processes[0].workCompleted).toBeGreaterThan(advanceProcesses(state, hardware, runtime, 1000).processes[0].workCompleted)
    expect(advanceProcesses(state, moreRam, runtime, 1000).processes[0].workCompleted).toBe(advanceProcesses(state, hardware, runtime, 1000).processes[0].workCompleted)
    expect(startProcess(game.process, hardware, runtime, input('Large', 4000)).status).toBe('insufficient_memory'); expect(startProcess(game.process, moreRam, runtime, input('Large', 4000)).status).toBe('started')
  })
  it('clamps completion, releases resources, and does no further work', () => {
    const state = started(input('Short', 512, 10)); const done = advanceProcesses(state, hardware, runtime, 1000); expect(done.processes[0]).toMatchObject({ status: 'completed', workCompleted: 10 }); expect(deriveResourceUsage(hardware, runtime, done).processRamMiB).toBe(0); expect(advanceProcesses(done, hardware, runtime, 1000)).toEqual(done)
  })
  it('is tick-equivalent and redistributes CPU after a mid-tick completion', () => {
    const state = started(input('Short', 100, 20.5), input('Long', 100, 1000)); const once = advanceProcesses(state, hardware, runtime, 1000); const chunked = advanceProcesses(advanceProcesses(state, hardware, runtime, 500), hardware, runtime, 500)
    expect(once.processes[1].workCompleted).toBeCloseTo(61.5); expect(once).toEqual(chunked)
  })
  it('does not mutate inputs', () => { const state = started(input()); const snapshot = structuredClone(state); deriveResourceUsage(hardware, runtime, state); advanceProcesses(state, hardware, runtime, 500); expect(state).toEqual(snapshot) })
  it('preserves identity when advancement cannot change work', () => {
    const completed = advanceProcesses(started(input('Done', 100, 1)), hardware, runtime, 1000)
    const noCpu = { ...hardware, cpu: { ...hardware.cpu, computeCapacity: 0 } }
    expect(advanceProcesses(game.process, hardware, runtime, 1000)).toBe(game.process)
    expect(advanceProcesses(completed, hardware, runtime, 1000)).toBe(completed)
    const running = started(input())
    expect(advanceProcesses(running, hardware, runtime, 0)).toBe(running)
    expect(advanceProcesses(running, noCpu, runtime, 1000)).toBe(running)
  })
})
