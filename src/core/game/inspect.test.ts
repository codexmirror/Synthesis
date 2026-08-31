import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget, inspectNetworkTarget, type InspectTargets } from './inspect'
import { rememberScan } from './discovery'
import { scanNetworkTarget } from './scan'

const state = createInitialGameState()
const targets: InspectTargets = { localDevice: state.player.localDevice, network: state.world.network }

describe('inspectNetworkTarget inward inspection', () => {
  it('returns structured network properties without enumerating members', () => {
    const result = inspectNetworkTarget(targets, 'home-net')
    expect(result).toEqual({ status: 'network', networkId: 'network-local-001', networkName: 'home-net', connected: true })
    expect(result).not.toHaveProperty('devices')
    expect(result).not.toHaveProperty('memberDeviceIds')
  })

  it('derives renamed presentation while retaining stable network identity', () => {
    const network = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], name: 'renamed-net' }] }
    expect(inspectNetworkTarget({ ...targets, network }, 'renamed-net')).toEqual({
      status: 'network', networkId: 'network-local-001', networkName: 'renamed-net', connected: true,
    })
    expect(inspectNetworkTarget({ ...targets, network }, 'home-net')).toEqual({ status: 'unknown_target', input: 'home-net' })
  })

  it('derives network connection from canonical SELF membership', () => {
    const network = { ...targets.network, localNetworks: [{ ...targets.network.localNetworks[0], memberDeviceIds: ['host-lan-001'] }] }
    expect(inspectNetworkTarget({ ...targets, network }, 'home-net')).toMatchObject({ status: 'network', connected: false })
  })

  it('reports only actual device properties', () => {
    const localDevice = { ...targets.localDevice, hardware: { cpu: { name: 'Changed CPU', computeCapacity: 999 }, ram: { name: '12 GB', capacityMiB: 12288 } } }
    expect(inspectNetworkTarget({ ...targets, localDevice }, '198.51.100.23')).toEqual({
      status: 'device', targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self', networkStatus: 'ONLINE',
      hardware: { cpu: 'Changed CPU', ram: '12 GB' },
    })
    // The represented display name is one of those actual properties: Inspect
    // observes it, which is exactly why Scan and PING never report it.
    expect(inspectNetworkTarget(targets, '198.51.100.47')).toEqual({
      status: 'device', targetId: 'host-lan-001', address: '198.51.100.47', scope: 'lan', networkStatus: 'ONLINE',
      deviceKind: 'server', displayName: 'srv-01',
    })
    expect(inspectNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'device', targetId: 'host-lan-002', address: '203.0.113.42', scope: 'remote', networkStatus: 'ONLINE',
      deviceKind: 'server', displayName: 'srv-02',
    })
  })

  it('identifies a server from state without exposing services or invented hardware', () => {
    const result = inspectNetworkTarget(targets, '198.51.100.47')
    expect(result).toMatchObject({ status: 'device', deviceKind: 'server' })
    expect(result).not.toHaveProperty('services')
    expect(result).not.toHaveProperty('hardware')

    const hosts = targets.network.hosts.map((host) => host.id === 'host-lan-001'
      ? { ...host, role: undefined, services: undefined }
      : host)
    expect(inspectNetworkTarget({ ...targets, network: { ...targets.network, hosts } }, '198.51.100.47')).toMatchObject({
      status: 'device', deviceKind: 'device',
    })
  })

  it('resolves SELF from its current address while retaining stable device identity', () => {
    const previousAddress = targets.localDevice.network.ip
    const localDevice = { ...targets.localDevice, network: { ip: '192.0.2.44', transferCapacity: targets.localDevice.network.transferCapacity } }

    expect(inspectNetworkTarget({ ...targets, localDevice }, localDevice.network.ip)).toMatchObject({
      status: 'device', targetId: targets.localDevice.id, address: '192.0.2.44', scope: 'self',
    })
    expect(inspectNetworkTarget({ ...targets, localDevice }, previousAddress)).toEqual({
      status: 'no_response', address: previousAddress,
    })
  })

  it('returns no response when the current SELF device is offline', () => {
    const localDevice = {
      ...targets.localDevice,
      operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const },
    }

    expect(inspectNetworkTarget({ ...targets, localDevice }, localDevice.network.ip)).toEqual({
      status: 'no_response', address: localDevice.network.ip,
    })
  })

  it('preserves no-response behavior and rejects unsupported forms', () => {
    expect(inspectNetworkTarget(targets, '203.0.113.99')).toEqual({ status: 'no_response', address: '203.0.113.99' })
    expect(inspectNetworkTarget(targets, '192.0.2.10')).toEqual({ status: 'no_response', address: '192.0.2.10' })
    for (const input of ['garbage', 'unknown-net', '999.999.999.999', '1.2.3', '01.2.3.4']) {
      expect(inspectNetworkTarget(targets, input)).toEqual({ status: 'unknown_target', input })
    }
  })

  it('does not mutate supplied state', () => {
    const snapshot = structuredClone(targets)
    inspectNetworkTarget(targets, '198.51.100.23')
    inspectNetworkTarget(targets, 'home-net')
    expect(targets).toEqual(snapshot)
  })
})

describe('enhanced Inspect depth', () => {
  it('omits enhanced evidence at shallow depth, the default', () => {
    const result = inspectNetworkTarget(targets, '198.51.100.47')
    expect(result).not.toHaveProperty('enhanced')
    expect(inspectNetworkTarget(targets, '198.51.100.47', 'shallow')).not.toHaveProperty('enhanced')
  })

  it('derives a firmware fingerprint and compute classification from represented state at enhanced depth', () => {
    const result = inspectNetworkTarget(targets, '198.51.100.47', 'enhanced')
    expect(result).toMatchObject({
      status: 'device', deviceKind: 'server',
      enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' },
    })

    const weaker = inspectNetworkTarget(targets, '203.0.113.42', 'enhanced')
    expect(weaker).toMatchObject({ enhanced: { computeClass: 'STANDARD' } })
  })

  it('derives the compute classification from represented compute capacity rather than a hardcoded value', () => {
    const hosts = targets.network.hosts.map((host) => host.id === 'host-lan-001'
      ? { ...host, hardware: { ...host.hardware!, cpu: { name: host.hardware!.cpu.name, computeCapacity: 40 } } }
      : host)
    const result = inspectNetworkTarget({ ...targets, network: { ...targets.network, hosts } }, '198.51.100.47', 'enhanced')
    expect(result).toMatchObject({ enhanced: { computeClass: 'LOW' } })
  })

  it('reports enhanced evidence for the represented remote server', () => {
    const result = inspectNetworkTarget(targets, '203.0.113.42', 'enhanced')
    expect(result).toMatchObject({ status: 'device', deviceKind: 'server', enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'STANDARD' } })
  })

  it('does not expose enhanced evidence for SELF, which already reports exact hardware', () => {
    const result = inspectNetworkTarget(targets, '198.51.100.23', 'enhanced')
    expect(result).not.toHaveProperty('enhanced')
  })
})

describe('inspectKnownTarget selector validation', () => {
  const discovery = rememberScan(state.discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)

  it('inspects unchanged remembered selectors normally', () => {
    expect(inspectKnownTarget(targets, discovery, '198.51.100.47')).toMatchObject({
      status: 'device', targetId: 'host-lan-001', address: '198.51.100.47', deviceKind: 'server',
    })
    expect(inspectKnownTarget(targets, discovery, 'home-net')).toEqual({
      status: 'network', networkId: 'network-local-001', networkName: 'home-net', connected: true,
    })
  })

  it('does not follow a remembered Device identity to its hidden changed address', () => {
    const hosts = targets.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, ip: '198.51.100.88' } : host)
    expect(inspectKnownTarget({ ...targets, network: { ...targets.network, hosts } }, discovery, '198.51.100.47')).toEqual({
      status: 'no_response', address: '198.51.100.47',
    })
  })

  it('does not retarget when another Device occupies a remembered address', () => {
    const hosts = targets.network.hosts.map((host) => host.id === 'host-lan-001'
      ? { ...host, ip: '198.51.100.88' }
      : host.id === 'host-lan-002' ? { ...host, ip: '198.51.100.47' } : host)
    const result = inspectKnownTarget({ ...targets, network: { ...targets.network, hosts } }, discovery, '198.51.100.47')
    expect(result).toEqual({ status: 'no_response', address: '198.51.100.47' })
    expect(JSON.stringify(result)).not.toContain('host-lan-002')
  })

  it('does not follow a remembered network identity to its hidden changed name', () => {
    const localNetworks = [{ ...targets.network.localNetworks[0], name: 'renamed-net' }]
    expect(inspectKnownTarget({ ...targets, network: { ...targets.network, localNetworks } }, discovery, 'home-net')).toEqual({
      status: 'no_response', address: 'home-net',
    })
  })

  it('keeps hidden selectors unknown and preserves SELF inspection', () => {
    expect(inspectKnownTarget(targets, discovery, '203.0.113.42')).toEqual({ status: 'unknown_target', input: '203.0.113.42' })
    expect(inspectKnownTarget(targets, discovery, state.player.localDevice.network.ip)).toMatchObject({ status: 'device', scope: 'self' })
  })

  it('threads Inspect depth through remembered-selector resolution', () => {
    expect(inspectKnownTarget(targets, discovery, '198.51.100.47')).not.toHaveProperty('enhanced')
    expect(inspectKnownTarget(targets, discovery, '198.51.100.47', 'enhanced')).toMatchObject({
      enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' },
    })
  })
})
