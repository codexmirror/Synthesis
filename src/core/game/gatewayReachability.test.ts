import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { resolveNetworkPath } from './networkPath'
import { scanFromDevice } from './scan'
import { pingFromDevice } from './ping'
import { scanTargetFromSource } from '../../app/localScanOperation'
import { resolveDeviceNetworkContext } from './networkPath'

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
    expect(scanFromDevice(state, state.player.localDevice.id, '203.0.113.42')).toMatchObject({ status: 'device', targetId: 'router-foreign-001', services: [{ id: 'service-http-router-001', port: 80 }], networks: [] })
    expect(scanFromDevice(state, 'host-lan-002', '10.42.0.0/24')).toMatchObject({ status: 'network', networkId: 'network-foreign-001', devices: expect.arrayContaining([expect.objectContaining({ targetId: 'host-phone-001' })]) })
  })

  it('keeps public-edge reconnaissance responsive with multiple exposures without choosing a private backend', () => {
    const state = createInitialGameState()
    const gateway = state.world.network.hosts.find(({ id }) => id === 'router-foreign-001')!
    const multiExposure = { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === gateway.id ? { ...host, exposures: [...gateway.exposures!, { protocol: 'TCP' as const, externalPort: 8443, targetDeviceId: 'host-lan-002', targetServiceId: 'service-rack-update-002' }] } : host) } } }
    expect(pingFromDevice(multiExposure, multiExposure.player.localDevice.id, gateway.ip)).toEqual({ status: 'device', targetId: gateway.id, address: gateway.ip })
    expect(scanFromDevice(multiExposure, multiExposure.player.localDevice.id, gateway.ip)).toMatchObject({ status: 'device', targetId: gateway.id, services: [{ id: 'service-http-router-001', port: 80 }], networks: [] })
    expect(resolveNetworkPath(multiExposure, multiExposure.player.localDevice.id, gateway.ip, 8443)).toMatchObject({ kind: 'EXPOSED_EDGE', target: { id: 'host-lan-002' }, targetService: { id: 'service-rack-update-002' } })
    expect(resolveNetworkPath(multiExposure, multiExposure.player.localDevice.id, gateway.ip, 8090)).toEqual({ kind: 'NO_ROUTE' })
    expect(resolveNetworkPath(multiExposure, 'host-lan-002', '10.42.0.61')).toMatchObject({ kind: 'DIRECT_LOCAL', target: { id: 'host-phone-001' } })
  })

  it('admits remote Scan from player information plus the remote Device intrinsic network identity', () => {
    const state = createInitialGameState()
    expect(scanTargetFromSource(state, 'host-lan-002', '10.42.0.0/24')).toMatchObject({ status: 'network', networkId: 'network-foreign-001' })
    expect(scanTargetFromSource(state, 'host-lan-002', '10.42.0.43')).toEqual({ status: 'unknown_target', input: '10.42.0.43' })
    expect(resolveDeviceNetworkContext(state, 'host-lan-002')).toEqual({ address: '10.42.0.42', cidr: '10.42.0.0/24', gateway: '203.0.113.42' })
  })
})
