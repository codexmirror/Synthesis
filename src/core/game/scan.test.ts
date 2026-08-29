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
      services: [],
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
    const offlineHosts = targets.network.hosts.map((host) => host.id === 'device-local-v0' ? host : { ...host, online: false })
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, hosts: offlineHosts } }, 'home-net')).toMatchObject({
      devices: [{ targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' }],
    })
  })

  it('keeps LAN device identity and membership stable when its address changes', () => {
    const lanHost = targets.network.hosts.find(({ id }) => id === 'host-lan-001')!
    const hosts = targets.network.hosts.map((host) => host.id === lanHost.id ? { ...host, ip: '198.51.100.88' } : host)

    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, hosts } }, 'home-net')).toMatchObject({
      devices: expect.arrayContaining([{ targetId: lanHost.id, address: '198.51.100.88', scope: 'lan' }]),
    })
  })

  it('uses the current SELF address and returns no response when SELF is offline', () => {
    const movedDevice = { ...targets.localDevice, network: { ip: '192.0.2.44', transferCapacity: targets.localDevice.network.transferCapacity } }
    expect(scanNetworkTarget({ ...targets, localDevice: movedDevice }, '192.0.2.44')).toMatchObject({
      status: 'device', targetId: movedDevice.id, address: '192.0.2.44', scope: 'self',
    })

    const offlineDevice = {
      ...movedDevice,
      runtime: { ...movedDevice.runtime, networkStatus: 'OFFLINE' as const },
    }
    expect(scanNetworkTarget({ ...targets, localDevice: offlineDevice }, '192.0.2.44')).toEqual({
      status: 'no_response', address: '192.0.2.44',
    })
  })

  it('classifies LAN only when the target shares represented membership with SELF', () => {
    const hostOnlyNetwork = { id: 'network-other', name: 'other-net', memberDeviceIds: ['host-lan-001'], transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 } }
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, localNetworks: [hostOnlyNetwork] } }, '198.51.100.47')).toMatchObject({
      status: 'device', targetId: 'host-lan-001', scope: 'remote',
    })

    const sharedNetwork = { ...hostOnlyNetwork, memberDeviceIds: [targets.localDevice.id, 'host-lan-001'] }
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, localNetworks: [sharedNetwork] } }, '198.51.100.47')).toMatchObject({
      status: 'device', targetId: 'host-lan-001', scope: 'lan',
    })
  })

  it('excludes represented online hosts that are not network members', () => {
    const unrelatedHost = { id: 'host-unrelated', ip: '192.0.2.77', online: true }
    const network = { ...targets.network, hosts: [...targets.network.hosts, unrelatedHost] }
    const result = scanNetworkTarget({ ...targets, network }, 'home-net')

    expect(result).toMatchObject({ status: 'network' })
    if (result.status === 'network') {
      expect(result.devices).not.toContainEqual(expect.objectContaining({ targetId: unrelatedHost.id }))
      expect(result.devices).not.toContainEqual(expect.objectContaining({ address: unrelatedHost.ip }))
    }
  })

  it('returns no relationships without inventing details for a responding remote device', () => {
    expect(scanNetworkTarget(targets, '198.51.100.47')).toMatchObject({
      status: 'device', scope: 'lan', networks: [],
    })
    expect(scanNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'device', targetId: 'host-lan-002', address: '203.0.113.42', scope: 'remote', networks: [], services: [
        { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP' },
        { id: 'service-rack-update-002', name: 'RackUpdate', port: 8443, protocol: 'TCP' },
      ],
    })
  })

  it('derives open service discoveries from current server state while retaining identity', () => {
    expect(scanNetworkTarget(targets, '198.51.100.47')).toMatchObject({
      services: [{ id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP' }, { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP' }],
    })

    const hosts = targets.network.hosts.map((host) => host.id === 'host-lan-001'
      ? { ...host, services: [{ ...host.services![0], name: 'Secure Shell', port: 2222 }] }
      : host)
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, hosts } }, '198.51.100.47')).toMatchObject({
      services: [{ id: 'service-ssh-001', name: 'Secure Shell', port: 2222, protocol: 'TCP' }],
    })
  })

  it('does not discover closed or removed services', () => {
    const withServices = (services: typeof targets.network.hosts[number]['services']) => ({
      ...targets,
      network: {
        ...targets.network,
        hosts: targets.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, services } : host),
      },
    })
    expect(scanNetworkTarget(withServices([{ ...targets.network.hosts[0].services![0], open: false }]), '198.51.100.47'))
      .toMatchObject({ services: [] })
    expect(scanNetworkTarget(withServices([]), '198.51.100.47')).toMatchObject({ services: [] })
  })

  it('preserves valid IPv4 no-response and rejects unsupported forms', () => {
    expect(scanNetworkTarget(targets, '203.0.113.99')).toEqual({ status: 'no_response', address: '203.0.113.99' })
    expect(scanNetworkTarget(targets, '192.0.2.10')).toEqual({ status: 'no_response', address: '192.0.2.10' })
    for (const input of ['garbage', 'unknown-net', '999.999.999.999', '1.2.3', '01.2.3.4']) {
      expect(scanNetworkTarget(targets, input)).toEqual({ status: 'unknown_target', input })
    }
  })

  it('does not expose canonical World Truth network transfer capacity through Scan', () => {
    const selfResult = scanNetworkTarget(targets, '198.51.100.23')
    expect(selfResult).not.toHaveProperty('transferCapacity')
    expect(JSON.stringify(selfResult)).not.toContain('transferCapacity')

    const hostResult = scanNetworkTarget(targets, '198.51.100.47')
    expect(hostResult).not.toHaveProperty('transferCapacity')
    expect(JSON.stringify(hostResult)).not.toContain('transferCapacity')

    const networkResult = scanNetworkTarget(targets, 'home-net')
    expect(JSON.stringify(networkResult)).not.toContain('transferCapacity')
  })

  it('does not mutate supplied state', () => {
    const snapshot = structuredClone(targets)
    scanNetworkTarget(targets, '198.51.100.23')
    scanNetworkTarget(targets, 'home-net')
    expect(targets).toEqual(snapshot)
  })
})
