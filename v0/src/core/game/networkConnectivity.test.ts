import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'

const REMOTE_SEGMENT = 'network-foreign-001'
const HOME_NET = 'network-local-001'

function connectivityOf(state: ReturnType<typeof createInitialGameState>, hostId: string) {
  return state.world.network.hosts.find(({ id }) => id === hostId)?.operational.connectivity
}

describe('interruptLocalNetworkConnectivity', () => {
  it('affects only the actual canonical members of the interrupted Network', () => {
    const state = createInitialGameState()
    const interrupted = interruptLocalNetworkConnectivity(state, REMOTE_SEGMENT)

    expect(connectivityOf(interrupted, 'host-phone-001')).toBe('DISCONNECTED')
    expect(connectivityOf(interrupted, 'host-lan-002')).toBe('DISCONNECTED')
    // srv-01 and the local Device belong to home-net, not remote-segment-01, and must be untouched.
    expect(connectivityOf(interrupted, 'host-lan-001')).toBe('CONNECTED')
    expect(interrupted.player.localDevice.operational.connectivity).toBe('CONNECTED')
  })

  it('mutates only connectivity, never lifecycle, Firmware, or software state', () => {
    const state = createInitialGameState()
    const interrupted = interruptLocalNetworkConnectivity(state, REMOTE_SEGMENT)
    const before = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const after = interrupted.world.network.hosts.find(({ id }) => id === 'host-lan-002')!

    expect(after.operational.lifecycle).toBe('RUNNING')
    expect(after.installedSoftware).toBe(before.installedSoftware)
    expect(after.services).toBe(before.services)
    expect(after.firmware).toBe(before.firmware)
    expect(after.connectivityRecovery).toBeUndefined()
  })

  it('also disconnects the local Device when it is itself a member of the interrupted Network', () => {
    const state = createInitialGameState()
    const interrupted = interruptLocalNetworkConnectivity(state, HOME_NET)
    expect(interrupted.player.localDevice.operational.connectivity).toBe('DISCONNECTED')
    expect(connectivityOf(interrupted, 'host-lan-001')).toBe('DISCONNECTED')
  })

  it('is a no-op for an unknown Network id', () => {
    const state = createInitialGameState()
    expect(interruptLocalNetworkConnectivity(state, 'network-does-not-exist')).toBe(state)
  })

  it('does not duplicate or restart an already-interrupted Device: repeated interruption is idempotent', () => {
    const state = createInitialGameState()
    const once = interruptLocalNetworkConnectivity(state, REMOTE_SEGMENT)
    const twice = interruptLocalNetworkConnectivity(once, REMOTE_SEGMENT)
    expect(twice).toBe(once)
  })

  it('leaves an already-reconnecting or already-disconnected Device untouched rather than re-flipping it', () => {
    const state = createInitialGameState()
    const reconnecting = {
      ...state,
      world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-phone-001' ? { ...host, operational: { ...host.operational, connectivity: 'RECONNECTING' as const } } : host) } },
    }
    const result = interruptLocalNetworkConnectivity(reconnecting, REMOTE_SEGMENT)
    // srv-02 still moves from CONNECTED to DISCONNECTED, but the phone's own in-progress RECONNECTING is left alone.
    expect(connectivityOf(result, 'host-phone-001')).toBe('RECONNECTING')
    expect(connectivityOf(result, 'host-lan-002')).toBe('DISCONNECTED')
  })
})
