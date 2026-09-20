import { describe, expect, it } from 'vitest'
import { createSandboxGameState } from '../core/game/fieldwork'
import { advanceGameState } from '../core/game/gameAdvancement'
import { backupSandbox, loadSandboxSave, saveSandbox, SANDBOX_SAVE_KEY, SANDBOX_BACKUP_KEY } from './sandboxSave'
function memory() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } }
describe('Sandbox checkpoint boundary', () => {
  it('round-trips canonical progress without advancing a closed world', () => {
    const storage = memory(), state = advanceGameState(createSandboxGameState(), 20_000)
    expect(loadSandboxSave(storage)).toEqual({ status: 'empty' })
    expect(saveSandbox(storage, state)).toBe(true)
    expect(loadSandboxSave(storage)).toEqual({ status: 'ready', state })
  })
  it('preserves unknown and corrupt saves before a fresh start', () => {
    const storage = memory(); storage.setItem(SANDBOX_SAVE_KEY, '{broken')
    expect(loadSandboxSave(storage).status).toBe('unavailable')
    expect(backupSandbox(storage)).toBe(true)
    expect(saveSandbox(storage, createSandboxGameState())).toBe(true)
    expect(storage.getItem(SANDBOX_BACKUP_KEY)).toBe('{broken')
  })
  it('rejects incompatible versions and reports storage errors instead of claiming progress was saved', () => {
    const storage = memory(); saveSandbox(storage, { ...createSandboxGameState(), version: -1 })
    expect(loadSandboxSave(storage).status).toBe('unavailable')
    expect(saveSandbox({ ...storage, setItem: () => { throw Error('full') } }, createSandboxGameState())).toBe(false)
  })
})
