import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget, type ScanTargets } from './scan'

const state = createInitialGameState()
const targets: ScanTargets = { localDevice: state.player.localDevice, network: state.world.network }

describe('scanNetworkTarget outward discovery', () => {
  it('discovers real network relationships with stable identity from canonical membership', () => {
    expect(scanNetworkTarget(targets, '198.51.100.23')).toEqual({
      status: 'device', targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self',
      networks: [{ id: 'network-local-001', name: 'home-net' }],
    })
    const renamed = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], name: 'my-lan' }] }
    expect(scanNetworkTarget({ ...targets, network: renamed }, '198.51.100.23')).toMatchObject({
      networks: [{ id: 'network-local-001', name: 'my-lan' }],
    })
    const removed = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], memberDeviceIds: ['host-lan-001'] }] }
    expect(scanNetworkTarget({ ...targets, network: removed }, '198.51.100.23')).toMatchObject({ networks: [] })
  })

  it('discovers only responding represented network members and retains network identity', () => {
    expect(scanNetworkTarget(targets, 'home-net')).toEqual({
      status: 'network', networkId: 'network-local-001', networkName: 'home-net', devices: [
        { targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' },
        { targetId: 'host-lan-001', address: '198.51.100.47', scope: 'lan' },
      ],
    })
    const offlineHosts = targets.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, online: false } : host)
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, hosts: offlineHosts } }, 'home-net')).toMatchObject({
      devices: [{ targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' }],
    })
  })

  it('returns no relationships without inventing details for a responding remote device', () => {
    expect(scanNetworkTarget(targets, '198.51.100.47')).toMatchObject({
      status: 'device', scope: 'lan', networks: [{ id: 'network-local-001', name: 'home-net' }],
    })
    expect(scanNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'device', targetId: 'host-training-001', address: '203.0.113.42', scope: 'remote', networks: [],
    })
  })

  it('preserves valid IPv4 no-response and rejects unsupported forms', () => {
    expect(scanNetworkTarget(targets, '203.0.113.99')).toEqual({ status: 'no_response', address: '203.0.113.99' })
    expect(scanNetworkTarget(targets, '192.0.2.10')).toEqual({ status: 'no_response', address: '192.0.2.10' })
    for (const input of ['garbage', 'unknown-net', '999.999.999.999', '1.2.3', '01.2.3.4']) {
      expect(scanNetworkTarget(targets, input)).toEqual({ status: 'unknown_target', input })
    }
  })

  it('does not mutate supplied state', () => {
    const snapshot = structuredClone(targets)
    scanNetworkTarget(targets, '198.51.100.23')
    scanNetworkTarget(targets, 'home-net')
    expect(targets).toEqual(snapshot)
  })
})
