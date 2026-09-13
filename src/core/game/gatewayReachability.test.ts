import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { resolveNetworkPath } from './networkPath'
import { scanFromDevice } from './scan'
import { pingFromDevice } from './ping'
import { scanTargetFromSource } from '../../app/localScanOperation'
import { resolveDeviceNetworkContext } from './networkPath'
import { NODESCAN_1_0_STANDARD } from './softwareReleaseContent'
import type { GameState } from './types'

/** Installs NodeScan on srv-02 as a pure test-local fixture for this file's own remote-Scan-source
 * coverage — never a default game assumption. It exercises the same accepted explicit-source Scan an
 * operated Device can already run, exactly like RackOS Terminal's own `scan` command. */
function withSrv02NodeScan(state: GameState): GameState {
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002'
    ? { ...host, installedSoftware: [...(host.installedSoftware ?? []), { id: NODESCAN_1_0_STANDARD.productId, releaseId: NODESCAN_1_0_STANDARD.releaseId, buildId: NODESCAN_1_0_STANDARD.buildId, name: NODESCAN_1_0_STANDARD.name, version: NODESCAN_1_0_STANDARD.version, channel: NODESCAN_1_0_STANDARD.channel }] }
    : host) } } }
}

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

  it('external scan of the public edge observes its own Service plus every exposure it currently forwards, without naming a backend Device, while a remote source scans its own LAN directly', () => {
    const state = createInitialGameState()
    const publicScan = scanFromDevice(state, state.player.localDevice.id, '203.0.113.42')
    // The Gateway's own hosted Service is genuinely its own; the forwarded GateSSH and RackUpdate
    // exposures are reported separately, keyed by the backend's own stable (never player-visible) identity.
    expect(publicScan).toMatchObject({ status: 'device', targetId: 'router-foreign-001', services: [{ id: 'service-http-router-001', port: 80 }], networks: [] })
    expect(publicScan.status === 'device' ? publicScan.exposedBackends : undefined).toEqual([
      { targetDeviceId: 'host-lan-002', service: { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP' } },
      { targetDeviceId: 'host-lan-002', service: { id: 'service-rack-update-002', name: 'RackUpdate', port: 8443, protocol: 'TCP' } },
      { targetDeviceId: 'host-phone-001', service: { id: 'service-ssh-003', name: 'SSH', port: 2222, protocol: 'TCP' } },
      { targetDeviceId: 'host-lan-003', service: { id: 'service-ssh-004', name: 'SSH', port: 2223, protocol: 'TCP' } },
    ])
    expect(scanFromDevice(withSrv02NodeScan(state), 'host-lan-002', '10.42.0.0/24')).toMatchObject({ status: 'network', networkId: 'network-foreign-001', devices: expect.arrayContaining([expect.objectContaining({ targetId: 'host-phone-001' })]) })
  })

  it('keeps public-edge reconnaissance responsive with multiple exposures without choosing a private backend', () => {
    const state = createInitialGameState()
    const gateway = state.world.network.hosts.find(({ id }) => id === 'router-foreign-001')!
    expect(gateway.exposures).toHaveLength(4)
    // A fifth, hypothetical exposure — Bookstore's own backend, still private by default — proves resolution
    // scales to several forwards without ever guessing a private backend for an address:port it does not name.
    const multiExposure = { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === gateway.id ? { ...host, exposures: [...gateway.exposures!, { protocol: 'TCP' as const, externalPort: 8090, targetDeviceId: 'host-lan-002', targetServiceId: 'service-bookstore-backend-002' }] } : host) } } }
    expect(pingFromDevice(multiExposure, multiExposure.player.localDevice.id, gateway.publicAddress!)).toEqual({ status: 'device', targetId: gateway.id, address: gateway.publicAddress })
    const multiScan = scanFromDevice(multiExposure, multiExposure.player.localDevice.id, gateway.publicAddress!)
    expect(multiScan).toMatchObject({ status: 'device', targetId: gateway.id, services: [{ id: 'service-http-router-001', port: 80 }], networks: [] })
    expect(multiScan.status === 'device' ? multiScan.exposedBackends?.length : undefined).toBe(5)
    expect(resolveNetworkPath(multiExposure, multiExposure.player.localDevice.id, gateway.publicAddress!, 8090)).toMatchObject({ kind: 'EXPOSED_EDGE', target: { id: 'host-lan-002' }, targetService: { id: 'service-bookstore-backend-002' } })
    expect(resolveNetworkPath(multiExposure, multiExposure.player.localDevice.id, gateway.publicAddress!, 9999)).toEqual({ kind: 'NO_ROUTE' })
    expect(resolveNetworkPath(multiExposure, 'host-lan-002', '10.42.0.61')).toMatchObject({ kind: 'DIRECT_LOCAL', target: { id: 'host-phone-001' } })
  })

  it('admits remote Scan from player information plus the remote Device intrinsic network identity', () => {
    const state = withSrv02NodeScan(createInitialGameState())
    expect(scanTargetFromSource(state, 'host-lan-002', '10.42.0.0/24')).toMatchObject({ status: 'network', networkId: 'network-foreign-001' })
    expect(scanTargetFromSource(state, 'host-lan-002', '10.42.0.43')).toEqual({ status: 'unknown_target', input: '10.42.0.43' })
    // The Gateway's own internal LAN position — as its member Devices see their default Gateway —
    // distinct from its externally reconnaissable public edge.
    expect(resolveDeviceNetworkContext(state, 'host-lan-002')).toEqual({ address: '10.42.0.42', cidr: '10.42.0.0/24', gateway: '10.42.0.1' })
  })
})
