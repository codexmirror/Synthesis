import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { rememberScan } from '../core/game/discovery'
import { scanNetworkTarget } from '../core/game/scan'
import { createLocalInspectTarget } from './localInspectOperation'

function knownState() {
  const state = createInitialGameState()
  const discovery = rememberScan(state.discovery, scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, 'home-net'), state.player.localDevice.id)
  return { ...state, discovery }
}

describe('player-facing Inspect operation', () => {
  it('rejects hidden addresses without revealing whether World Truth contains a host', () => {
    const state = createInitialGameState(); const write = vi.fn()
    const inspect = createLocalInspectTarget(() => state, write)
    expect(inspect('203.0.113.42')).toEqual({ status: 'unknown_target', input: '203.0.113.42' })
    expect(inspect('192.0.2.10')).toEqual({ status: 'unknown_target', input: '192.0.2.10' })
    expect(write).not.toHaveBeenCalled()
  })

  it('remembers shallow Device evidence by stable ID and preserves it through failure', () => {
    let state = knownState(); const write = (next: typeof state) => { state = next }
    const inspect = createLocalInspectTarget(() => state, write)
    expect(inspect('198.51.100.47')).toMatchObject({ status: 'device', targetId: 'host-lan-001', deviceKind: 'server' })
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect).toEqual({ networkStatus: 'ONLINE', deviceKind: 'server' })
    const host = state.world.network.hosts[0]
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, ip: '198.51.100.88', online: false }, ...state.world.network.hosts.slice(1)] } } }
    expect(inspect('198.51.100.47')).toEqual({ status: 'no_response', address: '198.51.100.47' })
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect?.deviceKind).toBe('server')
    expect(state.knowledge.discoveredVulnerabilities).toEqual([])
  })

  it('inspects a known network without members and keeps SELF intrinsic', () => {
    let state = knownState(); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    const network = inspect('home-net')
    expect(network).toMatchObject({ status: 'network', networkId: 'network-local-001', connected: true })
    expect(network).not.toHaveProperty('devices')
    expect(inspect(state.player.localDevice.network.ip)).toMatchObject({ status: 'device', scope: 'self' })
    expect(state.discovery.devices.some(({ id }) => id === state.player.localDevice.id)).toBe(false)
  })
})
