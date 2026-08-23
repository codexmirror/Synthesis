import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceProcesses, clearCompletedProcesses, deriveResourceUsage, removeCompletedProcess, startProcess } from './processes'

const game = createInitialGameState(); const executor = game.player.localDevice; const hardware = executor.hardware; const runtime = executor.runtime
const input = (label = 'Analysis', ramRequiredMiB = 512, workRequired = 1000) => ({ label, ramRequiredMiB, workRequired })
function started(...jobs: ReturnType<typeof input>[]) { let state = game.process; for (const job of jobs) { const result = startProcess(state, executor, job); if (result.status !== 'started') throw Error('fixture rejected'); state = result.state } return state }

describe('process resource domain', () => {
  it('preserves identity for empty and running-only process states', () => {
    expect(clearCompletedProcesses(game.process, executor.id)).toBe(game.process)
    const running = started(input())
    expect(clearCompletedProcesses(running, executor.id)).toBe(running)
    expect(running.processes).toHaveLength(1)
  })
  it('clears completed-only history without mutation and preserves nextId', () => {
    const completed = advanceProcesses(started(input('Done', 100, 1)), [executor], 1000)
    const snapshot = structuredClone(completed)
    const cleared = clearCompletedProcesses(completed, executor.id)
    expect(cleared).not.toBe(completed)
    expect(cleared).toEqual({ nextId: 2, processes: [] })
    expect(completed).toEqual(snapshot)
  })
  it('removes only completed jobs while preserving running order and nextId', () => {
    const base = started(input('First'), input('Done', 100, 1), input('Last'))
    const mixed = { ...base, processes: base.processes.map((process) => process.id === 'process-0002' ? { ...process, status: 'completed' as const, workCompleted: process.workRequired } : process) }
    const snapshot = structuredClone(mixed)
    const cleared = clearCompletedProcesses(mixed, executor.id)
    expect(cleared.nextId).toBe(4)
    expect(cleared.processes.map(({ id }) => id)).toEqual(['process-0001', 'process-0003'])
    expect(cleared.processes.every(({ status }) => status === 'running')).toBe(true)
    expect(mixed).toEqual(snapshot)
  })
  it('removes only the selected completion and refuses to remove running work', () => {
    const base = started(input('Running'), input('First done'), input('Second done'))
    const mixed = { ...base, processes: base.processes.map((process) => process.id === 'process-0001' ? process : { ...process, status: 'completed' as const, workCompleted: process.workRequired }) }
    const removed = removeCompletedProcess(mixed, 'process-0002', executor.id)
    expect(removed.nextId).toBe(4)
    expect(removed.processes.map(({ id }) => id)).toEqual(['process-0001', 'process-0003'])
    expect(removed.processes[0].status).toBe('running')
    expect(removed.processes[1].status).toBe('completed')
    expect(removeCompletedProcess(removed, 'process-0001', executor.id)).toBe(removed)
  })
  it('creates stable IDs with explicit executors and admits without mutation', () => {
    const original = structuredClone(game.process); const first = startProcess(game.process, executor, input())
    expect(first).toMatchObject({ status: 'started', processId: 'process-0001' }); if (first.status !== 'started') return
    expect(first.state.processes[0]).toMatchObject({ id: 'process-0001', executorDeviceId: 'device-local-v0', status: 'running' })
    expect(startProcess(first.state, executor, input()).status).toBe('started'); expect(game.process).toEqual(original)
  })
  it('rejects insufficient RAM structurally and leaves state unchanged', () => {
    const result = startProcess(game.process, executor, input('Huge', 4000)); expect(result.status).toBe('insufficient_memory'); expect(result.state).toBe(game.process)
  })
  it('derives idle baseline and numeric hardware truth', () => {
    const usage = deriveResourceUsage(executor, game.process); expect(usage.totalCpuLoad).toBe(18); expect(usage.totalRamUsage).toBe(23); expect(hardware.ram.capacityMiB).toBe(4096); expect(hardware.cpu.computeCapacity).toBe(100)
  })
  it('shares CPU headroom and accumulates RAM reservations', () => {
    const one = started(input()); const two = started(input('A'), input('B'))
    expect(deriveResourceUsage(executor, one).cpuAllocationByProcess['process-0001']).toBe(82)
    expect(deriveResourceUsage(executor, two)).toMatchObject({ totalCpuLoad: 100, processRamMiB: 1024 })
    expect(deriveResourceUsage(executor, two).cpuAllocationByProcess['process-0001']).toBe(41)
    expect(advanceProcesses(one, [executor], 1000).processes[0].workCompleted).toBe(82)
    expect(advanceProcesses(two, [executor], 1000).processes[0].workCompleted).toBe(41)
  })
  it('CPU buys speed while RAM buys admission but not speed', () => {
    const state = started(input()); const fast = { ...hardware, cpu: { ...hardware.cpu, computeCapacity: 200 } }; const moreRam = { ...hardware, ram: { ...hardware.ram, capacityMiB: 8192 } }
    expect(advanceProcesses(state, [{ ...executor, hardware: fast }], 1000).processes[0].workCompleted).toBeGreaterThan(advanceProcesses(state, [executor], 1000).processes[0].workCompleted)
    expect(advanceProcesses(state, [{ ...executor, hardware: moreRam }], 1000).processes[0].workCompleted).toBe(advanceProcesses(state, [executor], 1000).processes[0].workCompleted)
    expect(startProcess(game.process, executor, input('Large', 4000)).status).toBe('insufficient_memory'); expect(startProcess(game.process, { ...executor, hardware: moreRam }, input('Large', 4000)).status).toBe('started')
  })
  it('clamps completion, releases resources, and does no further work', () => {
    const state = started(input('Short', 512, 10)); const done = advanceProcesses(state, [executor], 1000); expect(done.processes[0]).toMatchObject({ status: 'completed', workCompleted: 10 }); expect(deriveResourceUsage(executor, done).processRamMiB).toBe(0); expect(advanceProcesses(done, [executor], 1000)).toEqual(done)
  })
  it('is tick-equivalent and redistributes CPU after a mid-tick completion', () => {
    const state = started(input('Short', 100, 20.5), input('Long', 100, 1000)); const once = advanceProcesses(state, [executor], 1000); const chunked = advanceProcesses(advanceProcesses(state, [executor], 500), [executor], 500)
    expect(once.processes[1].workCompleted).toBeCloseTo(61.5); expect(once).toEqual(chunked)
  })
  it('does not mutate inputs', () => { const state = started(input()); const snapshot = structuredClone(state); deriveResourceUsage(executor, state); advanceProcesses(state, [executor], 500); expect(state).toEqual(snapshot) })
  it('preserves identity when advancement cannot change work', () => {
    const completed = advanceProcesses(started(input('Done', 100, 1)), [executor], 1000)
    const noCpu = { ...hardware, cpu: { ...hardware.cpu, computeCapacity: 0 } }
    expect(advanceProcesses(game.process, [executor], 1000)).toBe(game.process)
    expect(advanceProcesses(completed, [executor], 1000)).toBe(completed)
    const running = started(input())
    expect(advanceProcesses(running, [executor], 0)).toBe(running)
    expect(advanceProcesses(running, [{ ...executor, hardware: noCpu }], 1000)).toBe(running)
  })

  it('isolates admission, usage, and advancement by executor Device', () => {
    const srv01 = { id: 'host-lan-001', hardware: { cpu: { name: 'A', computeCapacity: 200 }, ram: { name: '1 GB', capacityMiB: 1024 } }, runtime: { baselineCpuLoad: 0, baselineRamUsage: 0 } }
    const srv02 = { id: 'host-lan-002', hardware: { cpu: { name: 'B', computeCapacity: 50 }, ram: { name: '2 GB', capacityMiB: 2048 } }, runtime: { baselineCpuLoad: 0, baselineRamUsage: 0 } }
    let state = startProcess(game.process, executor, input('Local', 512)).state
    state = startProcess(state, srv01, input('Server A1', 512)).state
    state = startProcess(state, srv01, input('Server A2', 512)).state
    state = startProcess(state, srv02, input('Server B', 1024)).state

    expect(deriveResourceUsage(executor, state).processRamMiB).toBe(512)
    expect(deriveResourceUsage(srv01, state)).toMatchObject({ processRamMiB: 1024, availableRamMiB: 0 })
    expect(deriveResourceUsage(srv02, state).processRamMiB).toBe(1024)
    expect(startProcess(state, srv01, input('Rejected only by A', 1)).status).toBe('insufficient_memory')
    expect(startProcess(state, srv02, input('Fits B', 1)).status).toBe('started')

    const advanced = advanceProcesses(state, [executor, srv01, srv02], 1000)
    expect(advanced.processes.map(({ workCompleted }) => workCompleted)).toEqual([82, 100, 100, 50])
  })

  it('does not charge or advance unresolved and shallow executors', () => {
    const unresolved = { ...input('Unknown'), executorDeviceId: 'missing', kind: 'generic' as const, id: 'process-unknown', status: 'running' as const, workCompleted: 0 }
    const state = { nextId: 2, processes: [unresolved] }
    expect(deriveResourceUsage(executor, state)).toMatchObject({ processCpuLoad: 0, processRamMiB: 0 })
    expect(advanceProcesses(state, [executor], 1000)).toBe(state)
  })
})
