import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import type { GameState } from '../../core/game/types'
import { selectManagedNetworks } from './networkProjection'

/**
 * The management projection owns what authority legitimately supplies about a
 * Network the local Device administers. NodeScan presents it
 * (`src/apps/network/Network.test.tsx`); this file holds the information
 * boundary itself, independently of any surface.
 */
function withActivity(): GameState {
  const base = createInitialGameState()
  const homeNet = base.world.network.localNetworks[0]
  return {
    ...base,
    world: {
      ...base.world,
      network: {
        ...base.world.network,
        localNetworks: [
          {
            ...homeNet,
            activityHistory: {
              nextId: 4,
              records: [
                { id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'internal', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', sourceAddress: base.player.localDevice.network.ip, targetAddress: '198.51.100.47', serviceId: 'service-ssh-001', serviceName: 'SSH', result: 'SUCCESS' },
                { id: 'net-activity-0002', kind: 'file_transfer', perspective: 'internal', sourceDeviceId: 'host-lan-001', destinationDeviceId: base.player.localDevice.id, sourceAddress: '198.51.100.47', destinationAddress: base.player.localDevice.network.ip, bytesTransferred: 2048, result: 'COMPLETED' },
                { id: 'net-activity-0003', kind: 'package_submission', perspective: 'outbound', sourceDeviceId: base.player.localDevice.id, destinationDeviceId: 'host-lan-002', sourceAddress: base.player.localDevice.network.ip, destinationAddress: '203.0.113.42', bytesTransferred: 512, result: 'INTERRUPTED' },
              ],
            },
          },
          ...base.world.network.localNetworks.slice(1),
        ],
      },
    },
  }
}

describe('managed Network projection', () => {
  it('projects exactly the authorized home-net Network, with its represented name and external capacity', () => {
    expect(selectManagedNetworks(createInitialGameState())).toEqual([{
      id: 'network-local-001',
      name: 'home-net',
      // Symmetric represented maximum capability, not current throughput.
      connectivity: { uploadBytesPerSecond: 16_777_216, downloadBytesPerSecond: 16_777_216 },
      // home-net has exactly two members: the local Device and host-lan-001 (srv-01).
      memberCount: 2,
      activity: [],
    }])
  })

  it('states a coarse member count without enumerating member identity', () => {
    const [network] = selectManagedNetworks(createInitialGameState())
    const projected = JSON.stringify(network)
    expect(network.memberCount).toBe(2)
    for (const hidden of ['srv-01', '198.51.100.47', 'host-lan-001', 'service-ssh-001', 'RACK-OS']) {
      expect(projected, `${hidden} must not reach a managed-Network projection`).not.toContain(hidden)
    }
  })

  it('projects activity from each record’s own observable fields, never internal Device or Service IDs', () => {
    const [network] = selectManagedNetworks(withActivity())
    expect(network.activity).toEqual([
      { id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'internal', sourceAddress: '198.51.100.23', destinationAddress: '198.51.100.47', serviceName: 'SSH', bytesTransferred: undefined, result: 'SUCCESS' },
      { id: 'net-activity-0002', kind: 'file_transfer', perspective: 'internal', sourceAddress: '198.51.100.47', destinationAddress: '198.51.100.23', serviceName: undefined, bytesTransferred: 2048, result: 'COMPLETED' },
      { id: 'net-activity-0003', kind: 'package_submission', perspective: 'outbound', sourceAddress: '198.51.100.23', destinationAddress: '203.0.113.42', serviceName: undefined, bytesTransferred: 512, result: 'INTERRUPTED' },
    ])
    const projected = JSON.stringify(network.activity)
    for (const hidden of ['host-lan-001', 'host-lan-002', 'device-local-v0', 'service-ssh-001']) {
      expect(projected).not.toContain(hidden)
    }
  })

  it('projects nothing once the authority relationship is removed, though Network membership is untouched', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, networkManagement: { ...base.networkManagement, established: [] } }
    // Membership itself is untouched World Truth; only the explicit authority relationship was removed.
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain(state.player.localDevice.id)
    expect(selectManagedNetworks(state)).toEqual([])
  })

  it('never projects a Network the local Device merely knows about or belongs to without authority', () => {
    const state = createInitialGameState()
    expect(selectManagedNetworks(state).map(({ id }) => id)).toEqual(['network-local-001'])
    expect(selectManagedNetworks(state).some(({ name }) => name === 'remote-segment-01')).toBe(false)
  })
})
