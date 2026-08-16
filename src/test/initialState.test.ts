import { describe, expect, it } from 'vitest'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'

describe('createInitialGameState', () => {
  it('creates an independent local-device and world graph for every session', () => {
    const first = createInitialGameState()
    const second = createInitialGameState()

    expect(first).not.toBe(second)
    expect(first.player).not.toBe(second.player)
    expect(first.player.localDevice).not.toBe(second.player.localDevice)
    expect(first.player.localDevice.network).not.toBe(second.player.localDevice.network)
    expect(first.player.localDevice.hardware).not.toBe(second.player.localDevice.hardware)
    expect(first.player.localDevice.runtime).not.toBe(second.player.localDevice.runtime)
    expect(first.wallet).not.toBe(second.wallet)
    expect(first.world).not.toBe(second.world)
    expect(first.world.network).not.toBe(second.world.network)
    expect(first.world.network.hosts).not.toBe(second.world.network.hosts)
    expect(first.world.network.hosts[0]).not.toBe(second.world.network.hosts[0])
    expect(first).toEqual(second)
  })

  it('separates stable player and device identities in schema version 3', () => {
    const state = createInitialGameState()
    expect(GAME_STATE_VERSION).toBe(3)
    expect(state.version).toBe(3)
    expect(state.player.id).toBe('player-local-v0')
    expect(state.player.localDevice.id).toBe('device-local-v0')
    expect(state.player.id).not.toBe(state.player.localDevice.id)
    expect(state.player.localDevice).toMatchObject({
      network: { ip: '198.51.100.23' },
      hardware: { cpu: 'Basic CPU', ram: '4 GB' },
      runtime: { cpuLoad: 18, ramUsage: 23, networkStatus: 'ONLINE' },
    })
    expect(state.world.network.hosts).toEqual([
      { id: 'host-training-001', ip: '203.0.113.42', online: true },
      { id: 'host-training-002', ip: '203.0.113.99', online: false },
    ])
    expect(state.world.network.hosts).not.toContainEqual(expect.objectContaining({ id: state.player.localDevice.id }))
  })
})
