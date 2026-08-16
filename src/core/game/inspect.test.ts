import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectNetworkTarget, type InspectTargets } from './inspect'

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
    const localDevice = { ...targets.localDevice, hardware: { cpu: 'Changed CPU', ram: '12 GB' } }
    expect(inspectNetworkTarget({ ...targets, localDevice }, '198.51.100.23')).toEqual({
      status: 'device', targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self', networkStatus: 'ONLINE',
      hardware: { cpu: 'Changed CPU', ram: '12 GB' },
    })
    expect(inspectNetworkTarget(targets, '198.51.100.47')).toEqual({
      status: 'device', targetId: 'host-lan-001', address: '198.51.100.47', scope: 'lan', networkStatus: 'ONLINE',
    })
    expect(inspectNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'device', targetId: 'host-training-001', address: '203.0.113.42', scope: 'remote', networkStatus: 'ONLINE',
    })
  })

  it('resolves SELF from its current address while retaining stable device identity', () => {
    const previousAddress = targets.localDevice.network.ip
    const localDevice = { ...targets.localDevice, network: { ip: '192.0.2.44' } }

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
      runtime: { ...targets.localDevice.runtime, networkStatus: 'OFFLINE' as const },
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
