import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget, type ScanTargets } from './scan'

const state = createInitialGameState()
const targets: ScanTargets = { localDevice: state.player.localDevice, network: state.world.network }

describe('scanNetworkTarget outward discovery', () => {
  it('discovers real network relationships with stable identity from canonical membership, never the Network\'s own mutable name', () => {
    expect(scanNetworkTarget(targets, '198.51.100.23')).toEqual({
      status: 'device', targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self',
      networks: [{ id: 'network-local-001', cidr: '198.51.100.0/24', gateway: { targetId: 'router-home-001', address: '198.51.100.1', scope: 'lan' } }],
      services: [],
    })
    // A Host Scan's own relation is keyed by stable identity and routing identity, never by the Network's mutable name.
    const renamed = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], name: 'my-lan' }] }
    expect(scanNetworkTarget({ ...targets, network: renamed }, '198.51.100.23')).toMatchObject({
      networks: [{ id: 'network-local-001', cidr: '198.51.100.0/24' }],
    })
    const removed = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], memberDeviceIds: ['host-lan-001'] }] }
    expect(scanNetworkTarget({ ...targets, network: removed }, '198.51.100.23')).toMatchObject({ networks: [] })
  })

  it('fails closed when a scanned Host cannot be unambiguously placed on exactly one represented Network', () => {
    const ambiguous = { ...targets.network, localNetworks: [
      targets.network.localNetworks[0],
      { ...targets.network.localNetworks[0], id: 'network-second', name: 'second-net', cidr: '192.0.2.0/24' },
    ] }
    expect(scanNetworkTarget({ ...targets, network: ambiguous }, '198.51.100.23')).toMatchObject({ networks: [] })
  })

  it('fails closed when the gateway relationship is missing, non-member, ambiguous, or points to a non-Router', () => {
    const base = targets.network.localNetworks[0]
    const scanWith = (network: typeof base, hosts = targets.network.hosts) => scanNetworkTarget({ ...targets, network: { ...targets.network, localNetworks: [network], hosts } }, '198.51.100.47')
    for (const result of [
      scanWith({ ...base, gatewayDeviceId: undefined }),
      scanWith({ ...base, memberDeviceIds: base.memberDeviceIds.filter((id) => id !== base.gatewayDeviceId) }),
      scanWith(base, [...targets.network.hosts, { ...targets.network.hosts.find(({ id }) => id === 'router-home-001')! }]),
      scanWith({ ...base, gatewayDeviceId: 'host-lan-001' }),
    ]) expect(result.status === 'device' ? result.networks[0] : {}).not.toHaveProperty('gateway')
  })

  it('discovers only responding represented network members and retains network identity', () => {
    expect(scanNetworkTarget(targets, 'home-net')).toEqual({
      status: 'network', networkId: 'network-local-001', networkName: 'home-net', cidr: '198.51.100.0/24', devices: [
        { targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' },
        { targetId: 'host-lan-001', address: '198.51.100.47', scope: 'lan' },
        { targetId: 'router-home-001', address: '198.51.100.1', scope: 'lan' },
      ],
    })
    const offlineHosts = targets.network.hosts.map((host) => host.id === 'device-local-v0' ? host : { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } })
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
      operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const },
    }
    expect(scanNetworkTarget({ ...targets, localDevice: offlineDevice }, '192.0.2.44')).toEqual({
      status: 'no_response', address: '192.0.2.44',
    })
  })

  it('classifies LAN only when the target shares represented membership with SELF', () => {
    const hostOnlyNetwork = { id: 'network-other', name: 'other-net', memberDeviceIds: ['host-lan-001'], transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 }, activityHistory: { nextId: 1, records: [] } }
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, localNetworks: [hostOnlyNetwork] } }, '198.51.100.47')).toMatchObject({
      status: 'device', targetId: 'host-lan-001', scope: 'remote',
    })

    const sharedNetwork = { ...hostOnlyNetwork, memberDeviceIds: [targets.localDevice.id, 'host-lan-001'] }
    expect(scanNetworkTarget({ ...targets, network: { ...targets.network, localNetworks: [sharedNetwork] } }, '198.51.100.47')).toMatchObject({
      status: 'device', targetId: 'host-lan-001', scope: 'lan',
    })
  })

  it('excludes represented online hosts that are not network members', () => {
    const unrelatedHost = { id: 'host-unrelated', ip: '192.0.2.77', operational: { lifecycle: 'RUNNING' as const, connectivity: 'CONNECTED' as const } }
    const network = { ...targets.network, hosts: [...targets.network.hosts, unrelatedHost] }
    const result = scanNetworkTarget({ ...targets, network }, 'home-net')

    expect(result).toMatchObject({ status: 'network' })
    if (result.status === 'network') {
      expect(result.devices).not.toContainEqual(expect.objectContaining({ targetId: unrelatedHost.id }))
      expect(result.devices).not.toContainEqual(expect.objectContaining({ address: unrelatedHost.ip }))
    }
  })

  it('reveals Network/Gateway context without peer enumeration or implementation details', () => {
    expect(scanNetworkTarget(targets, '198.51.100.47')).toMatchObject({
      status: 'device', scope: 'lan', networks: [{ id: 'network-local-001', cidr: '198.51.100.0/24', gateway: { targetId: 'router-home-001', address: '198.51.100.1', scope: 'lan' } }],
    })
    expect(scanNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'device', targetId: 'host-lan-002', address: '203.0.113.42', scope: 'remote',
      networks: [{ id: 'network-foreign-001', cidr: '203.0.113.0/24', gateway: { targetId: 'router-foreign-001', address: '203.0.113.1', scope: 'remote' } }],
      services: [
        { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP' },
        { id: 'service-rack-update-002', name: 'RackUpdate', port: 8443, protocol: 'TCP' },
        { id: 'service-bookstore-backend-002', name: 'Bookstore Backend', port: 8090, protocol: 'TCP' },
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
