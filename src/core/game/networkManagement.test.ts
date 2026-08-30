import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { hasNetworkManagementAuthority, resolveManagedNetworks } from './networkManagement'

describe('networkManagement', () => {
  it('seeds the local Device with explicit legitimate management authority over home-net only', () => {
    const state = createInitialGameState()
    const localDeviceId = state.player.localDevice.id
    expect(hasNetworkManagementAuthority(state, localDeviceId, 'network-local-001')).toBe(true)
    expect(hasNetworkManagementAuthority(state, localDeviceId, 'network-foreign-001')).toBe(false)
    expect(resolveManagedNetworks(state, localDeviceId).map((network) => network.id)).toEqual(['network-local-001'])
  })

  it('never grants management authority merely from Network membership', () => {
    const state = createInitialGameState()
    // host-lan-001 (srv-01) is a member of home-net but was never granted management authority over it.
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain('host-lan-001')
    expect(hasNetworkManagementAuthority(state, 'host-lan-001', 'network-local-001')).toBe(false)
    expect(resolveManagedNetworks(state, 'host-lan-001')).toEqual([])
    // host-phone-001 and host-lan-002 are members of remote-segment-01 but hold no authority over it either.
    expect(state.world.network.localNetworks[1].memberDeviceIds).toEqual(['host-phone-001', 'host-lan-002'])
    expect(hasNetworkManagementAuthority(state, 'host-phone-001', 'network-foreign-001')).toBe(false)
    expect(hasNetworkManagementAuthority(state, 'host-lan-002', 'network-foreign-001')).toBe(false)
  })

  it('leaves remote-segment-01 unadministrable by the local Device in the initial world', () => {
    const state = createInitialGameState()
    const localDeviceId = state.player.localDevice.id
    expect(hasNetworkManagementAuthority(state, localDeviceId, 'network-foreign-001')).toBe(false)
    expect(resolveManagedNetworks(state, localDeviceId).some((network) => network.id === 'network-foreign-001')).toBe(false)
  })

  it('stops resolving management truth once the relationship is removed', () => {
    const base = createInitialGameState()
    const localDeviceId = base.player.localDevice.id
    const withoutAuthority = { ...base, networkManagement: { ...base.networkManagement, established: [] } }
    expect(hasNetworkManagementAuthority(withoutAuthority, localDeviceId, 'network-local-001')).toBe(false)
    expect(resolveManagedNetworks(withoutAuthority, localDeviceId)).toEqual([])
  })
})
