import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { RECENT_ACTIVITY_LIMIT, archiveProcess, clearRecentActivity, removeRecentActivity } from './recentActivity'
import type { GameState, GenericProcess } from './types'

function completed(id: string): GenericProcess {
  return { kind: 'generic', id, label: id, executorDeviceId: 'device-local-v0', status: 'completed', workRequired: 1, workCompleted: 1, ramRequiredMiB: 1 }
}

function archive(state: GameState, id: string) {
  const process = completed(id)
  return archiveProcess({ ...state, process: { ...state.process, processes: [...state.process.processes, process] } }, process)
}

describe('Recent Activity retention', () => {
  it('retains the newest 20 observations deterministically without rewinding Process identity', () => {
    let state = createInitialGameState()
    for (let index = 1; index <= RECENT_ACTIVITY_LIMIT + 2; index += 1) state = archive(state, `process-${String(index).padStart(4, '0')}`)
    expect(state.recentActivity.entries.map(({ id }) => id)).toEqual(Array.from({ length: 20 }, (_, index) => `process-${String(index + 3).padStart(4, '0')}`))
    expect(state.process.processes.map(({ id }) => id)).toEqual(state.recentActivity.entries.map(({ id }) => id))
    expect(state.process.nextId).toBe(1)
  })

  it('removes one observation or clears history without touching unrelated canonical truth', () => {
    const initial = archive(archive(createInitialGameState(), 'process-0001'), 'process-0002')
    const removed = removeRecentActivity(initial, 'process-0001', initial.player.localDevice.id)
    expect(removed.recentActivity.entries.map(({ id }) => id)).toEqual(['process-0002'])
    expect(removed.wallet).toBe(initial.wallet)
    const cleared = clearRecentActivity(removed, removed.player.localDevice.id)
    expect(cleared.recentActivity.entries).toEqual([])
    expect(cleared.process.nextId).toBe(initial.process.nextId)
    expect(cleared.wallet).toBe(initial.wallet)
    expect(cleared.player.localDevice.filesystem).toBe(initial.player.localDevice.filesystem)
  })
})
