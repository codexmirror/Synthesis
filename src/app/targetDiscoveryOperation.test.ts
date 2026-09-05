import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { scanNetworkTarget } from '../core/game/scan'
import { inspectKnownTarget } from '../core/game/inspect'
import { rememberInspect, rememberScan } from '../core/game/discovery'
import { createFindTargets, createRefreshNetwork } from './targetDiscoveryOperation'



function store(initial: GameState) {
  let state = initial
  return { read: () => state, write: (next: GameState) => { state = next }, get current() { return state } }
}



function withoutNodeScan(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
}

function withNodeScan(state: GameState, releaseId: string, version: string): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId, version } : software) } } }
}

function knownRemote(state: GameState): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, 'remote-segment-01'), state.player.localDevice.id)
  for (const device of discovery.devices) {
    discovery = rememberScan(discovery, scanNetworkTarget(targets, device.address), state.player.localDevice.id)
    discovery = rememberInspect(discovery, inspectKnownTarget(targets, discovery, device.address, 'enhanced'), state.player.localDevice.id)
  }
  return { ...state, discovery }
}





describe('findTargets', () => {
  it('observes SELF relationships and then the members of every Network it now knows', async () => {
    const state = store(createInitialGameState())
    const result = await createFindTargets(state.read, state.write)()

    expect(result).toEqual({ status: 'observed', networksKnown: 1, targetsKnown: 1 })
    expect(state.current.discovery.networks.map(({ name, membersObserved }) => [name, membersObserved])).toEqual([['home-net', true]])
    expect(state.current.discovery.devices.map(({ id, servicesObserved }) => [id, servicesObserved])).toEqual([['host-lan-001', false]])
  })

  it('never reaches beyond the Networks the player legitimately remembers', async () => {
    const state = store(createInitialGameState())
    await createFindTargets(state.read, state.write)()

    // srv-02 exists in the world and is not a member of any known Network.
    expect(state.current.world.network.hosts.some(({ id }) => id === 'host-lan-002')).toBe(true)
    expect(state.current.discovery.devices.some(({ id }) => id === 'host-lan-002')).toBe(false)
  })

  it('requires an installed NodeScan release', async () => {
    const state = store(withoutNodeScan(createInitialGameState()))
    expect(await createFindTargets(state.read, state.write)()).toEqual({ status: 'software_unavailable' })
    expect(state.current.discovery.networks).toEqual([])
  })

  it('reports no response when SELF is offline rather than inventing an observation', async () => {
    const offline = createInitialGameState()
    const state = store({ ...offline, player: { ...offline.player, localDevice: { ...offline.player.localDevice, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } } } })
    expect(await createFindTargets(state.read, state.write)()).toEqual({ status: 'no_response' })
    expect(state.current.discovery.networks).toEqual([])
  })
})

describe('refreshNetwork', () => {
  it('gives NodeScan 1.2 the authored Scan then Inspect composition without starting Analyze', async () => {
    const initial = knownRemote(withNodeScan(createInitialGameState(), 'nodescan-1.2-standard', '1.2'))
    const stale = initial.discovery.devices.find(({ id }) => id === 'host-lan-002')!.services.find(({ id }) => id === 'service-ssh-002')!.inspect!.implementation!.version
    const changed = { ...initial, world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, services: host.services?.map((service) => service.id === 'service-ssh-002' ? { ...service, implementation: { ...service.implementation, version: '1.4.0' } } : service) } : host) } } }
    const state = store(changed)

    expect(stale).not.toBe('1.4.0')
    expect(await createRefreshNetwork(state.read, state.write)('network-foreign-001')).toMatchObject({ status: 'refreshed', inspected: 2 })
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-002')!.services.find(({ id }) => id === 'service-ssh-002')!.inspect!.implementation!.version).toBe('1.4.0')
    expect(state.current.process.processes).toEqual([])
  })

  it('keeps NodeScan 1.1 refresh Scan-only and preserves historical Inspect evidence', async () => {
    const initial = knownRemote(withNodeScan(createInitialGameState(), 'nodescan-1.1-experimental', '1.1'))
    const before = initial.discovery.devices.find(({ id }) => id === 'host-lan-002')!.inspect
    const changed = { ...initial, world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, displayName: 'Changed hidden name' } : host) } } }
    const state = store(changed)

    expect(await createRefreshNetwork(state.read, state.write)('network-foreign-001')).toEqual({ status: 'refreshed', inspected: 0, unavailable: 0 })
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-002')!.inspect).toEqual(before)
  })

  it('continues inspecting other remembered members when one Device is unavailable', async () => {
    const initial = knownRemote(withNodeScan(createInitialGameState(), 'nodescan-1.2-standard', '1.2'))
    const changed = { ...initial, world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.map((host) =>
      host.id === 'host-lan-002' ? { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } }
        : host.id === 'host-phone-001' ? { ...host, displayName: 'Fresh Petra' } : host) } } }
    const state = store(changed)

    expect(await createRefreshNetwork(state.read, state.write)('network-foreign-001')).toEqual({ status: 'refreshed', inspected: 1, unavailable: 1 })
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-phone-001')?.inspect?.displayName).toBe('Fresh Petra')
  })
})
