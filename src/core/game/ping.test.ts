import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { pingNetworkTarget } from './ping'
import { rememberPing } from './discovery'

describe('PING observation boundary', () => {
  it('returns only stable identity, observed address, and scope', () => {
    const state = createInitialGameState()
    expect(pingNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, '203.0.113.42')).toEqual({
      status: 'device', targetId: 'host-lan-002', address: '203.0.113.42', scope: 'remote',
    })
  })

  it('remembers no Services, Inspect evidence, or Network relationship and no false positive', () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const remembered = rememberPing(state.discovery, pingNetworkTarget(targets, '203.0.113.42'), state.player.localDevice.id)
    expect(remembered).toEqual({ networks: [], networkDeviceRelations: [], devices: [{
      id: 'host-lan-002', address: '203.0.113.42', scope: 'remote', servicesObserved: false, services: [],
    }] })
    expect(rememberPing(state.discovery, pingNetworkTarget(targets, '192.0.2.250'), state.player.localDevice.id)).toBe(state.discovery)
  })

  it('preserves a stale observed address until another PING refreshes it', () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const remembered = rememberPing(state.discovery, pingNetworkTarget(targets, '203.0.113.42'), state.player.localDevice.id)
    const movedNetwork = { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, ip: '203.0.113.99' } : host) }
    expect(remembered.devices[0].address).toBe('203.0.113.42')
    const refreshed = rememberPing(remembered, pingNetworkTarget({ localDevice: state.player.localDevice, network: movedNetwork }, '203.0.113.99'), state.player.localDevice.id)
    expect(refreshed.devices[0].address).toBe('203.0.113.99')
  })
})
