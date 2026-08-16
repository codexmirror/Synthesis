import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'

describe('createInitialGameState', () => {
  it('creates an independent object graph for every session', () => {
    const first = createInitialGameState()
    const second = createInitialGameState()

    expect(first).not.toBe(second)
    expect(first.player).not.toBe(second.player)
    expect(first.system).not.toBe(second.system)
    expect(first.system.hardware).not.toBe(second.system.hardware)
    expect(first.system.runtime).not.toBe(second.system.runtime)
    expect(first.wallet).not.toBe(second.wallet)
    expect(first.world).not.toBe(second.world)
    expect(first.world.network).not.toBe(second.world.network)
    expect(first.world.network.hosts).not.toBe(second.world.network.hosts)
    expect(first.world.network.hosts[0]).not.toBe(second.world.network.hosts[0])
    expect(first).toEqual(second)
  })

  it('seeds the deterministic minimal network in schema version 2', () => {
    const state = createInitialGameState()
    expect(state.version).toBe(2)
    expect(state.world.network.hosts).toEqual([
      { id: 'host-training-001', ip: '203.0.113.42', online: true },
      { id: 'host-training-002', ip: '203.0.113.99', online: false },
    ])
  })
})
