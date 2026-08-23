import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { rememberScan } from '../core/game/discovery'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createLocalInspectTarget } from './localInspectOperation'

function knownState(): GameState {
  const state = createInitialGameState()
  const discovery = rememberScan(state.discovery, scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, 'home-net'), state.player.localDevice.id)
  return { ...state, discovery }
}

function withNodeScan11(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      localDevice: {
        ...state.player.localDevice,
        installedSoftware: state.player.localDevice.installedSoftware.map((software) =>
          software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software),
      },
    },
  }
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

  it('preserves positive memory when an online Device moves away from its remembered selector', () => {
    let state = knownState(); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    expect(inspect('198.51.100.47')).toMatchObject({ status: 'device', targetId: 'host-lan-001' })
    const remembered = structuredClone(state.discovery)
    const host = state.world.network.hosts[0]
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, ip: '198.51.100.88', online: true }, ...state.world.network.hosts.slice(1)] } } }

    expect(inspect('198.51.100.47')).toEqual({ status: 'no_response', address: '198.51.100.47' })
    expect(state.discovery).toEqual(remembered)
    expect(JSON.stringify(state.discovery)).not.toContain('198.51.100.88')
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

describe('NodeScan 1.1 Experimental Enhanced Inspect', () => {
  it('keeps NodeScan 1.0 Standard on shallow Inspect evidence only', () => {
    let state = knownState(); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    const result = inspect('198.51.100.47')
    expect(result).toMatchObject({ status: 'device', targetId: 'host-lan-001', deviceKind: 'server' })
    expect(result).not.toHaveProperty('enhanced')
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect).toEqual({ networkStatus: 'ONLINE', deviceKind: 'server' })
  })

  it('uses the same Inspect operation to return and remember richer evidence once 1.1 Experimental is installed', () => {
    let state = withNodeScan11(knownState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    const result = inspect('198.51.100.47')
    expect(result).toMatchObject({
      status: 'device', targetId: 'host-lan-001', deviceKind: 'server',
      enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' },
    })
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect).toEqual({
      networkStatus: 'ONLINE', deviceKind: 'server',
      enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' },
    })
  })

  it('does not silently rewrite remembered enhanced evidence when hidden World Truth later changes', () => {
    let state = withNodeScan11(knownState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('198.51.100.47')
    const remembered = structuredClone(state.discovery)

    const host = state.world.network.hosts[0]
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, firmware: { id: 'firmware-changed', name: 'CHANGED-OS', version: '9.9' } }, ...state.world.network.hosts.slice(1)] } } }

    expect(state.discovery).toEqual(remembered)
  })

  it('refreshes remembered evidence on a legitimate re-inspection with 1.1 Experimental', () => {
    let state = withNodeScan11(knownState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('198.51.100.47')

    const host = state.world.network.hosts[0]
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, firmware: { id: 'firmware-changed', name: 'CHANGED-OS', version: '9.9' } }, ...state.world.network.hosts.slice(1)] } } }
    inspect('198.51.100.47')

    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect).toMatchObject({
      enhanced: { firmware: { name: 'CHANGED-OS', version: '9.9' } },
    })
  })

  it('preserves stale-selector protection when NodeScan 1.1 Experimental is installed', () => {
    let state = withNodeScan11(knownState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('198.51.100.47')
    const remembered = structuredClone(state.discovery)
    const host = state.world.network.hosts[0]
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, ip: '198.51.100.88', online: true }, ...state.world.network.hosts.slice(1)] } } }

    expect(inspect('198.51.100.47')).toEqual({ status: 'no_response', address: '198.51.100.47' })
    expect(state.discovery).toEqual(remembered)
    expect(JSON.stringify(state.discovery)).not.toContain('198.51.100.88')
  })
})
