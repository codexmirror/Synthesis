import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget, type ScanTargets } from './scan'

const state = createInitialGameState()
const targets: ScanTargets = { localDevice: state.player.localDevice, network: state.world.network }

describe('scanNetworkTarget', () => {
  it('resolves the current local device with its stable identity and local scope', () => {
    expect(scanNetworkTarget(targets, state.player.localDevice.network.ip)).toEqual({
      status: 'reachable', targetId: 'device-local-v0', address: '198.51.100.23', scope: 'local',
    })
  })

  it('resolves an online world host with remote scope', () => {
    expect(scanNetworkTarget(targets, '203.0.113.42')).toEqual({
      status: 'reachable', targetId: 'host-training-001', address: '203.0.113.42', scope: 'remote',
    })
  })

  it('makes offline and valid unknown targets observationally identical', () => {
    expect(scanNetworkTarget(targets, '203.0.113.99')).toEqual({ status: 'no_response', address: '203.0.113.99' })
    expect(scanNetworkTarget(targets, '192.0.2.10')).toEqual({ status: 'no_response', address: '192.0.2.10' })
  })

  it('derives local resolution and response from current device state', () => {
    const movedDevice = { ...state.player.localDevice, network: { ip: '192.0.2.44' } }
    const movedTargets = { ...targets, localDevice: movedDevice }
    expect(scanNetworkTarget(movedTargets, '192.0.2.44')).toMatchObject({ status: 'reachable', targetId: movedDevice.id, scope: 'local' })
    expect(scanNetworkTarget(movedTargets, '198.51.100.23')).toEqual({ status: 'no_response', address: '198.51.100.23' })

    const offlineTargets = { ...movedTargets, localDevice: { ...movedDevice, runtime: { ...movedDevice.runtime, networkStatus: 'OFFLINE' as const } } }
    expect(scanNetworkTarget(offlineTargets, '192.0.2.44')).toEqual({ status: 'no_response', address: '192.0.2.44' })
  })

  it('derives remote response from current host state without mutation', () => {
    const offlineNetwork = { ...state.world.network, hosts: state.world.network.hosts.map((host) => ({ ...host, online: false })) }
    const snapshot = structuredClone(offlineNetwork)
    expect(scanNetworkTarget({ ...targets, network: offlineNetwork }, '203.0.113.42')).toEqual({ status: 'no_response', address: '203.0.113.42' })
    expect(offlineNetwork).toEqual(snapshot)
  })

  it.each(['garbage', '999.999.999.999', '1.2.3', '01.2.3.4'])(
    'rejects invalid IPv4 target %s',
    (input) => expect(scanNetworkTarget(targets, input)).toEqual({ status: 'invalid_target', input }),
  )
})
