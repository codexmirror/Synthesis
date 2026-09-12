import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { resolveNetworkPath } from './networkPath'
import { scanFromDevice } from './scan'

describe('Gateway Reachability V1', () => {
  it('derives direct local, exposed edge, and no route without global IP fallback', () => {
    const state = createInitialGameState()
    expect(resolveNetworkPath(state, 'host-lan-002', '10.42.0.61')).toMatchObject({ kind: 'DIRECT_LOCAL', target: { id: 'host-phone-001' } })
    expect(resolveNetworkPath(state, state.player.localDevice.id, '203.0.113.42', 22)).toMatchObject({ kind: 'EXPOSED_EDGE', gateway: { id: 'router-foreign-001' }, target: { id: 'host-lan-002' }, targetService: { id: 'service-ssh-002', implementation: { name: 'GateSSH', version: '1.3.3' } } })
    expect(resolveNetworkPath(state, state.player.localDevice.id, '10.42.0.42', 22)).toEqual({ kind: 'NO_ROUTE' })
  })

  it('fails closed for missing or ambiguous gateway truth', () => {
    const state = createInitialGameState()
    const missing = { ...state, world: { ...state.world, network: { ...state.world.network, localNetworks: state.world.network.localNetworks.map((network) => network.id === 'network-foreign-001' ? { ...network, gatewayDeviceId: undefined } : network) } } }
    expect(resolveNetworkPath(missing, state.player.localDevice.id, '203.0.113.42', 22)).toEqual({ kind: 'NO_ROUTE' })
    const ambiguous = { ...state, world: { ...state.world, network: { ...state.world.network, localNetworks: [...state.world.network.localNetworks, { ...state.world.network.localNetworks[1], id: 'duplicate-bookstore' }] } } }
    expect(resolveNetworkPath(ambiguous, state.player.localDevice.id, '203.0.113.42', 22)).toEqual({ kind: 'NO_ROUTE' })
  })

  it('external scan observes only the exposed backend service while a remote source scans its own LAN', () => {
    const state = createInitialGameState()
    expect(scanFromDevice(state, state.player.localDevice.id, '203.0.113.42')).toMatchObject({ status: 'device', targetId: 'host-lan-002', services: [{ id: 'service-ssh-002', port: 22 }], networks: [] })
    expect(scanFromDevice(state, 'host-lan-002', '10.42.0.0/24')).toMatchObject({ status: 'network', networkId: 'network-foreign-001', devices: expect.arrayContaining([expect.objectContaining({ targetId: 'host-phone-001' })]) })
  })
})
