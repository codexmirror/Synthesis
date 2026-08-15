import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'

describe('createInitialGameState', () => {
  it('creates an independent object graph for every session', () => {
    const first = createInitialGameState()
    const second = createInitialGameState()

    expect(first).not.toBe(second)
    expect(first.player).not.toBe(second.player)
    expect(first.system).not.toBe(second.system)
    expect(first.system.runtime).not.toBe(second.system.runtime)
    expect(first.wallet).not.toBe(second.wallet)
    expect(first).toEqual(second)
  })
})
