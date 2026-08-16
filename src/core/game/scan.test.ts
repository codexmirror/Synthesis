import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget, type ScanTargets } from './scan'

const state = createInitialGameState()
const targets: ScanTargets = { localDevice: state.player.localDevice, network: state.world.network }

describe('scanNetworkTarget discovery', () => {
  it('derives device network observations from canonical membership', () => {
    expect(scanNetworkTarget(targets, '198.51.100.23')).toEqual({ status: 'device', targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self', networkName: 'home-net' })
    const renamed = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], name: 'my-lan' }] }
    expect(scanNetworkTarget({ ...targets, network: renamed }, '198.51.100.23')).toMatchObject({ networkName: 'my-lan' })
    const removed = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], memberDeviceIds: ['host-lan-001'] }] }
    expect(scanNetworkTarget({ ...targets, network: removed }, '198.51.100.23')).not.toHaveProperty('networkName')
  })

  it('resolves a real network name and discovers only online represented members', () => {
    expect(scanNetworkTarget(targets, 'home-net')).toEqual({ status: 'network', networkName: 'home-net', devices: [
      { targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' },
      { targetId: 'host-lan-001', address: '198.51.100.47', scope: 'lan' },
    ] })
    const host = targets.network.hosts.find(({ id }) => id === 'host-lan-001')!
    expect(host).toMatchObject({ id: 'host-lan-001', online: true })

    const movedHosts = targets.network.hosts.map((item) => item.id === host.id ? { ...item, ip: '198.51.100.88' } : item)
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, hosts: movedHosts } }, 'home-net')).toMatchObject({ devices: expect.arrayContaining([{ targetId: host.id, address: '198.51.100.88', scope: 'lan' }]) })

    const noLanMember = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], memberDeviceIds: ['device-local-v0'] }] }
    expect(scanNetworkTarget({ ...targets, network: noLanMember }, 'home-net')).toMatchObject({ devices: [{ targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' }] })

    const unrelated = { ...targets.network, hosts: [...targets.network.hosts, { id: 'unrelated', ip: '192.0.2.77', online: true }] }
    expect(scanNetworkTarget({ ...targets, network: unrelated }, 'home-net')).toEqual(scanNetworkTarget(targets, 'home-net'))

    const offlineHosts = targets.network.hosts.map((item) => item.id === host.id ? { ...item, online: false } : item)
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, hosts: offlineHosts } }, 'home-net')).toMatchObject({ devices: [{ targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' }] })
  })

  it('classifies LAN only through a network shared with SELF', () => {
    const otherNetwork = { id: 'network-other', name: 'other-net', memberDeviceIds: ['host-lan-001'] }
    const network = { ...targets.network, localNetworks: [otherNetwork] }
    expect(scanNetworkTarget({ ...targets, network }, '198.51.100.47')).toMatchObject({ scope: 'remote' })
    expect(scanNetworkTarget({ ...targets, network }, 'other-net')).toMatchObject({
      devices: [{ targetId: 'host-lan-001', address: '198.51.100.47', scope: 'remote' }],
    })

    const sharedNetwork = { ...otherNetwork, memberDeviceIds: [targets.localDevice.id, 'host-lan-001'] }
    expect(scanNetworkTarget({ ...targets, network: { ...network, localNetworks: [sharedNetwork] } }, '198.51.100.47')).toMatchObject({ scope: 'lan' })
  })

  it('keeps LAN and remote scopes coherent and preserves no-response behavior', () => {
    expect(scanNetworkTarget(targets, '198.51.100.47')).toMatchObject({ status: 'device', scope: 'lan', networkName: 'home-net' })
    expect(scanNetworkTarget(targets, '203.0.113.42')).toEqual({ status: 'device', targetId: 'host-training-001', address: '203.0.113.42', scope: 'remote' })
    expect(scanNetworkTarget(targets, '203.0.113.99')).toEqual({ status: 'no_response', address: '203.0.113.99' })
    expect(scanNetworkTarget(targets, '192.0.2.10')).toEqual({ status: 'no_response', address: '192.0.2.10' })
  })

  it('rejects unsupported target forms and never mutates supplied state', () => {
    const snapshot = structuredClone(targets)
    for (const input of ['garbage', 'unknown-net', '999.999.999.999', '1.2.3', '01.2.3.4']) expect(scanNetworkTarget(targets, input)).toEqual({ status: 'unknown_target', input })
    scanNetworkTarget(targets, 'home-net')
    expect(targets).toEqual(snapshot)
  })
})
