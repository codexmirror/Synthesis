import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { deriveResourceUsage } from './processes'

describe('advanceGameState Device runtime ownership', () => {
  it('advances a real server-owned process with that server resources without charging the local Device', () => {
    const base = createInitialGameState()
    const remoteProcess = {
      kind: 'generic' as const,
      id: 'process-0001',
      label: 'SERVER WORK',
      executorDeviceId: 'host-lan-001',
      status: 'running' as const,
      workRequired: 1000,
      workCompleted: 0,
      ramRequiredMiB: 2048,
    }
    const state = { ...base, process: { nextId: 2, processes: [remoteProcess] } }

    expect(deriveResourceUsage(state.player.localDevice, state.process)).toMatchObject({ processCpuLoad: 0, processRamMiB: 0 })
    const advanced = advanceGameState(state, 1000)

    // srv-01 owns 160 compute with 12% baseline load: 160 * 0.88.
    expect(advanced.process.processes[0].workCompleted).toBeCloseTo(140.8)
    expect(deriveResourceUsage(advanced.player.localDevice, advanced.process)).toMatchObject({ processCpuLoad: 0, processRamMiB: 0 })
    expect(advanced.player.localDevice).toBe(state.player.localDevice)
  })
})
