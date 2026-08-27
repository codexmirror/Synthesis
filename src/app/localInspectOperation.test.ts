import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { rememberScan } from '../core/game/discovery'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createLocalInspectTarget } from './localInspectOperation'

function knownState(): GameState {
  const state = createInitialGameState()
  const discovery = rememberScan(state.discovery, scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, 'home-net'), state.player.localDevice.id)
  return withNodeScan11({ ...state, discovery })
}

function scannedState(address = '198.51.100.47'): GameState {
  const state = knownState()
  return { ...state, discovery: rememberScan(state.discovery, scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, address), state.player.localDevice.id) }
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

function withNodeScan10(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      localDevice: {
        ...state.player.localDevice,
        installedSoftware: state.player.localDevice.installedSoftware.map((software) =>
          software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.0-standard', version: '1.0', channel: 'standard' } : software),
      },
    },
  }
}

describe('player-facing Inspect operation', () => {
  it('rejects hidden addresses without revealing whether World Truth contains a host', () => {
    const state = withNodeScan11(createInitialGameState()); const write = vi.fn()
    const inspect = createLocalInspectTarget(() => state, write)
    expect(inspect('203.0.113.42')).toEqual({ status: 'unknown_target', input: '203.0.113.42' })
    expect(inspect('192.0.2.10')).toEqual({ status: 'unknown_target', input: '192.0.2.10' })
    expect(write).not.toHaveBeenCalled()
  })

  it('remembers Device evidence by stable ID and preserves it through failure', () => {
    let state = knownState(); const write = (next: typeof state) => { state = next }
    const inspect = createLocalInspectTarget(() => state, write)
    expect(inspect('198.51.100.47')).toMatchObject({ status: 'device', targetId: 'host-lan-001', deviceKind: 'server' })
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect).toMatchObject({ networkStatus: 'ONLINE', deviceKind: 'server' })
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
  it('preserves software-unavailable behavior when NodeScan is absent', () => {
    const base = scannedState()
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    expect(createLocalInspectTarget(() => state, vi.fn())('198.51.100.47')).toEqual({ status: 'software_unavailable' })
  })
  it('rejects Inspect under NodeScan 1.0 Standard without changing Discovery', () => {
    let state = withNodeScan10(scannedState()); const before = state.discovery
    const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    expect(inspect('198.51.100.47')).toEqual({ status: 'capability_unavailable' })
    expect(state.discovery).toBe(before)
  })

  it('fingerprints only already-known SSH and HTTP services without revealing weaknesses', () => {
    let state = withNodeScan11(scannedState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('198.51.100.47')
    expect(state.discovery.devices[0].services).toMatchObject([
      { name: 'SSH', inspect: { implementation: { name: 'GateSSH', version: '1.3.2' }, authentication: 'Credential' } },
      { name: 'HTTP', inspect: { implementation: { name: 'Basic HTTP', version: '1.0' } } },
    ])
    expect(state.knowledge.discoveredVulnerabilities).toEqual([])
    expect(JSON.stringify(state.discovery)).not.toContain('AUTH-017')

    let shallow = withNodeScan11(knownState()); const shallowInspect = createLocalInspectTarget(() => shallow, (next) => { shallow = next })
    shallowInspect('198.51.100.47')
    expect(shallow.discovery.devices[0].services).toEqual([])
  })

  it('observes patched GateSSH and RackUpdate on remote srv-02', () => {
    let state = withNodeScan11(scannedState('203.0.113.42')); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('203.0.113.42')
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-002')?.services[0].inspect).toEqual({
      implementation: { name: 'GateSSH', version: '1.3.3' }, authentication: 'Credential',
    })
  })

  it('derives authentication from credential access when the Service display name changes', () => {
    let state = withNodeScan11(scannedState())
    const host = state.world.network.hosts[0]
    state = {
      ...state,
      world: {
        network: {
          ...state.world.network,
          hosts: [{
            ...host,
            services: host.services?.map((service) => service.id === 'service-ssh-001'
              ? { ...service, name: 'Remote Login' }
              : service),
          }, ...state.world.network.hosts.slice(1)],
        },
      },
    }
    const inspect = createLocalInspectTarget(() => state, (next) => { state = next })

    inspect('198.51.100.47')

    expect(state.discovery.devices[0].services.find(({ id }) => id === 'service-ssh-001')?.inspect).toEqual({
      implementation: { name: 'GateSSH', version: '1.3.2' }, authentication: 'Credential',
    })
  })

  it('keeps historical Service observations until a successful enhanced re-inspection refreshes them', () => {
    let state = withNodeScan11(scannedState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('198.51.100.47')
    const host = state.world.network.hosts[0]
    const services = host.services!.map((service) => service.id === 'service-ssh-001'
      ? { ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.4.0', version: '1.4.0' }, credentialAccess: { privilege: 'USER' as const } }
      : service)
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, services }, ...state.world.network.hosts.slice(1)] } } }
    expect(state.discovery.devices[0].services[0].inspect).toMatchObject({ implementation: { version: '1.3.2' }, authentication: 'Credential' })
    inspect('198.51.100.47')
    expect(state.discovery.devices[0].services[0].inspect).toMatchObject({ implementation: { version: '1.4.0' }, authentication: 'Credential' })

    const remembered = structuredClone(state.discovery)
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...state.world.network.hosts[0], online: false }, ...state.world.network.hosts.slice(1)] } } }
    expect(inspect('198.51.100.47')).toEqual({ status: 'no_response', address: '198.51.100.47' })
    expect(state.discovery).toEqual(remembered)
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

  it('preserves enhanced memory while Inspect is unavailable and refreshes it after 1.1 is restored', () => {
    let state = withNodeScan11(knownState()); const inspect = createLocalInspectTarget(() => state, (next) => { state = next })
    inspect('198.51.100.47')

    const originalEnhanced = state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect?.enhanced
    state = withNodeScan10(state)

    const host = state.world.network.hosts[0]
    const hardware = host.hardware!
    state = { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, firmware: { id: 'firmware-changed', name: 'CHANGED-OS', version: '9.9' }, hardware: { ...hardware, cpu: { ...hardware.cpu, computeCapacity: 100 } } }, ...state.world.network.hosts.slice(1)] } } }
    expect(inspect('198.51.100.47')).toEqual({ status: 'capability_unavailable' })
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect?.enhanced).toEqual(originalEnhanced)

    state = withNodeScan11(state)
    const enhancedResult = inspect('198.51.100.47')

    expect(enhancedResult).toMatchObject({
      enhanced: { firmware: { name: 'CHANGED-OS', version: '9.9' }, computeClass: 'LOW' },
    })
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.inspect?.enhanced).toEqual({
      firmware: { name: 'CHANGED-OS', version: '9.9' }, computeClass: 'LOW',
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
