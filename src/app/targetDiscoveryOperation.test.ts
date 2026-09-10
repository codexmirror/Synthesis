import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { scanNetworkTarget } from '../core/game/scan'
import { rememberScan } from '../core/game/discovery'
import { startServiceAnalysis } from '../core/game/serviceAnalysis'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createFindTargets, createRefreshNetwork } from './targetDiscoveryOperation'



function store(initial: GameState) {
  let state = initial
  return { read: () => state, write: (next: GameState) => { state = next }, get current() { return state } }
}



function withoutNodeScan(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
}

function knownRemote(state: GameState): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, 'remote-segment-01'), state.player.localDevice.id)
  for (const device of discovery.devices) {
    discovery = rememberScan(discovery, scanNetworkTarget(targets, device.address), state.player.localDevice.id)
  }
  return { ...state, discovery }
}

/** `knownRemote` plus one legitimate Endpoint Analysis of host-lan-002's SSH service, the only route to remembered implementation evidence in Recon V2. */
function knownRemoteWithAnalyzedEndpoint(state: GameState): GameState {
  const scanned = knownRemote(state)
  const analysis = startServiceAnalysis(scanned, 'host-lan-002', 'service-ssh-002')
  if (analysis.status !== 'started') throw new Error(analysis.status)
  return advanceGameState(analysis.state, 20_000)
}



describe('findTargets', () => {
  it('performs exactly one SELF Host Scan without enumerating the Network', async () => {
    const state = store(createInitialGameState())
    const result = await createFindTargets(state.read, state.write)()

    expect(result).toEqual({ status: 'observed', networksKnown: 1, targetsKnown: 1 })
    expect(state.current.discovery.networks.map(({ name, membersObserved }) => [name, membersObserved])).toEqual([[undefined, false]])
    expect(state.current.discovery.devices.map(({ id, servicesObserved }) => [id, servicesObserved])).toEqual([['router-home-001', false]])
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
  it('repeats the canonical Network Scan and refreshes only Network-Scan-owned evidence', async () => {
    const initial = knownRemote(createInitialGameState())
    const changed = { ...initial, world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.map((host) => host.id === 'host-lan-003' ? { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } } : host) } } }
    const state = store(changed)

    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-003')).toBeDefined()
    expect(await createRefreshNetwork(state.read, state.write)('network-foreign-001')).toEqual({ status: 'refreshed' })
    expect(state.current.discovery.networks.find(({ id }) => id === 'network-foreign-001')?.membersObserved).toBe(true)
    expect(state.current.process.processes).toEqual([])
  })

  it('never deepens a remembered Host beyond Network Scan ownership, even where NodeScan 1.2 is installed', async () => {
    const initial = knownRemote(createInitialGameState())
    const changed = { ...initial, world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, displayName: 'Changed hidden name' } : host) } } }
    const state = store(changed)

    await createRefreshNetwork(state.read, state.write)('network-foreign-001')
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-002')?.inspect).toBeUndefined()
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-002')?.services.some((service) => service.inspect)).toBe(false)
  })

  it('preserves, but never refreshes, remembered Endpoint Analysis evidence a prior legitimate Analyze produced', async () => {
    const initial = knownRemoteWithAnalyzedEndpoint(createInitialGameState())
    const before = initial.discovery.devices.find(({ id }) => id === 'host-lan-002')!.services.find(({ id }) => id === 'service-ssh-002')!.inspect
    expect(before?.implementation).toEqual({ name: 'GateSSH', version: '1.3.3' })
    // World Truth changes underneath the remembered fingerprint; refresh must not silently observe it.
    const changed = { ...initial, world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, services: host.services?.map((service) => service.id === 'service-ssh-002' ? { ...service, implementation: { ...service.implementation, version: '1.4.0' } } : service) } : host) } } }
    const state = store(changed)

    expect(await createRefreshNetwork(state.read, state.write)('network-foreign-001')).toEqual({ status: 'refreshed' })
    const after = state.current.discovery.devices.find(({ id }) => id === 'host-lan-002')!.services.find(({ id }) => id === 'service-ssh-002')!.inspect
    expect(after).toEqual(before)
  })

  it('requires an installed NodeScan release', async () => {
    const state = store(withoutNodeScan(knownRemote(createInitialGameState())))
    expect(await createRefreshNetwork(state.read, state.write)('network-foreign-001')).toEqual({ status: 'software_unavailable' })
  })

  it('reports unknown_network for a Network the player does not remember', async () => {
    const state = store(createInitialGameState())
    expect(await createRefreshNetwork(state.read, state.write)('network-never-seen')).toEqual({ status: 'unknown_network' })
  })
})
