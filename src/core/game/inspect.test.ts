import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectNetworkTarget, type InspectTargets } from './inspect'

const state = createInitialGameState()
const targets: InspectTargets = { localDevice: state.player.localDevice, network: state.world.network }

describe('inspectNetworkTarget', () => {
  it('derives local identity, address, scope, and hardware from current device state', () => {
    const localDevice = {
      ...state.player.localDevice,
      network: { ip: '192.0.2.44' },
      hardware: { cpu: 'Changed CPU', ram: '12 GB' },
    }
    const movedTargets = { ...targets, localDevice }
    expect(inspectNetworkTarget(movedTargets, '192.0.2.44')).toEqual({
      status: 'reachable', targetId: localDevice.id, address: '192.0.2.44', scope: 'local', networkStatus: 'ONLINE',
      hardware: { cpu: 'Changed CPU', ram: '12 GB' },
      network: { id: 'network-local-001', name: 'home-net' },
    })
    expect(inspectNetworkTarget(movedTargets, '198.51.100.23')).toEqual({
      status: 'no_response', address: '198.51.100.23',
    })
  })

  it('derives an optional narrow network reference from canonical membership and current network state', () => {
    const renamedNetwork = {
      ...state.world.network,
      localNetworks: state.world.network.localNetworks.map((network) => ({ ...network, name: 'renamed-net' })),
    }
    expect(inspectNetworkTarget({ ...targets, network: renamedNetwork }, state.player.localDevice.network.ip)).toMatchObject({
      status: 'reachable', scope: 'local', network: { id: 'network-local-001', name: 'renamed-net' },
    })

    const withoutMembership = {
      ...state.world.network,
      localNetworks: state.world.network.localNetworks.map((network) => ({ ...network, memberDeviceIds: ['different-device'] })),
    }
    const result = inspectNetworkTarget({ ...targets, network: withoutMembership }, state.player.localDevice.network.ip)
    expect(result).toMatchObject({ status: 'reachable', scope: 'local' })
    expect(result).not.toHaveProperty('network')
  })

  it('does not derive local membership from unrelated remote host changes', () => {
    const network = { ...state.world.network, hosts: [{ id: 'changed-remote', ip: '192.0.2.88', online: true }] }
    expect(inspectNetworkTarget({ ...targets, network }, state.player.localDevice.network.ip)).toMatchObject({
      network: { id: 'network-local-001', name: 'home-net' },
    })
  })

  it('derives local response from current runtime state', () => {
    const localDevice = {
      ...state.player.localDevice,
      runtime: { ...state.player.localDevice.runtime, networkStatus: 'OFFLINE' as const },
    }
    expect(inspectNetworkTarget({ ...targets, localDevice }, localDevice.network.ip)).toEqual({
      status: 'no_response', address: localDevice.network.ip,
    })
  })

  it('returns only supported current truth for an online remote host', () => {
    expect(inspectNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'reachable', targetId: 'host-training-001', address: '203.0.113.42', scope: 'remote', networkStatus: 'ONLINE',
    })
  })

  it('derives remote response from current host state', () => {
    const network = { ...state.world.network, hosts: state.world.network.hosts.map((host) => ({ ...host, online: false })) }
    expect(inspectNetworkTarget({ ...targets, network }, '203.0.113.42')).toEqual({
      status: 'no_response', address: '203.0.113.42',
    })
  })

  it('makes represented offline and valid unknown targets observationally identical', () => {
    expect(inspectNetworkTarget(targets, '203.0.113.99')).toEqual({ status: 'no_response', address: '203.0.113.99' })
    expect(inspectNetworkTarget(targets, '192.0.2.10')).toEqual({ status: 'no_response', address: '192.0.2.10' })
  })

  it('does not mutate supplied entity state', () => {
    const snapshot = structuredClone(targets)
    inspectNetworkTarget(targets, state.player.localDevice.network.ip)
    inspectNetworkTarget(targets, '203.0.113.42')
    expect(targets).toEqual(snapshot)
  })

  it.each(['garbage', '999.999.999.999', '1.2.3', '01.2.3.4'])(
    'rejects invalid IPv4 target %s',
    (input) => expect(inspectNetworkTarget(targets, input)).toEqual({ status: 'invalid_target', input }),
  )
})
