import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { rememberScan } from '../core/game/discovery'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createFindTargets, createSweepTarget } from './targetSweepOperation'

const SRV_01 = { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }

function store(initial: GameState) {
  let state = initial
  return { read: () => state, write: (next: GameState) => { state = next }, get current() { return state } }
}

function withNodeScan11(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software) } } }
}

function withoutNodeScan(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
}

function withRam(state: GameState, capacityMiB: number): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, ram: { name: `${capacityMiB} MiB`, capacityMiB } } } } }
}

/** Discovery as it stands after the player has looked around once. */
function found(state: GameState): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  return { ...state, discovery }
}

describe('findTargets', () => {
  it('observes SELF relationships and then the members of every Network it now knows', async () => {
    const state = store(createInitialGameState())
    const result = await createFindTargets(state.read, state.write)()

    expect(result).toEqual({ status: 'observed', networksKnown: 1, targetsKnown: 2 })
    expect(state.current.discovery.networks.map(({ name, membersObserved }) => [name, membersObserved])).toEqual([['home-net', true]])
    expect(state.current.discovery.devices.map(({ id, servicesObserved }) => [id, servicesObserved])).toEqual([['host-lan-001', false], ['host-phone-001', false]])
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
    const state = store({ ...offline, player: { ...offline.player, localDevice: { ...offline.player.localDevice, runtime: { ...offline.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } })
    expect(await createFindTargets(state.read, state.write)()).toEqual({ status: 'no_response' })
    expect(state.current.discovery.networks).toEqual([])
  })
})

describe('sweepTarget', () => {
  it('observes Services and starts one canonical investigation per remembered Service', async () => {
    const state = store(found(createInitialGameState()))
    const result = await createSweepTarget(state.read, state.write)(SRV_01)

    expect(result).toEqual({ status: 'observed', servicesObserved: 2, analysesStarted: 2, insufficientMemory: false })
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-001')!.services.map(({ name }) => name)).toEqual(['SSH', 'HTTP'])
    expect(state.current.process.processes.map((process) => [process.kind, process.status])).toEqual([['service_analysis', 'running'], ['service_analysis', 'running']])
  })

  it('performs no Inspect under a release that does not supply it', async () => {
    const state = store(found(createInitialGameState()))
    await createSweepTarget(state.read, state.write)(SRV_01)
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-001')!.inspect).toBeUndefined()
  })

  it('performs Enhanced Inspect where the installed release supplies it', async () => {
    const state = store(found(withNodeScan11(createInitialGameState())))
    await createSweepTarget(state.read, state.write)(SRV_01)

    const device = state.current.discovery.devices.find(({ id }) => id === 'host-lan-001')!
    expect(device.inspect?.deviceKind).toBe('server')
    expect(device.inspect?.enhanced?.firmware).toEqual({ name: 'RACK-OS', version: '1.0' })
    expect(device.services.find(({ name }) => name === 'SSH')!.inspect?.implementation).toEqual({ name: 'GateSSH', version: '1.3.2' })
  })

  it('leaves remembered information untouched when the target does not respond', async () => {
    const known = found(createInitialGameState())
    const offline = { ...known, world: { network: { ...known.world.network, hosts: known.world.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, online: false } : host) } } }
    const state = store(offline)

    expect(await createSweepTarget(state.read, state.write)(SRV_01)).toEqual({ status: 'no_response' })
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-001')!.servicesObserved).toBe(false)
    expect(state.current.process.processes).toEqual([])
  })

  it('investigates nothing on this target when another Device now answers its remembered address', async () => {
    const known = found(createInitialGameState())
    const moved = { ...known, world: { network: { ...known.world.network, hosts: known.world.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, id: 'host-replacement' } : host) } } }
    const state = store(moved)

    expect(await createSweepTarget(state.read, state.write)(SRV_01)).toEqual({ status: 'observed', servicesObserved: 0, analysesStarted: 0, insufficientMemory: false })
    expect(state.current.process.processes).toEqual([])
    // The observation itself was legitimate and is remembered as its own Device.
    expect(state.current.discovery.devices.some(({ id }) => id === 'host-replacement')).toBe(true)
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-001')!.servicesObserved).toBe(false)
  })

  it('starts what represented memory carries and reports the contention on the rest', async () => {
    // 1 GiB leaves room for exactly one 768 MiB Service Analysis.
    const state = store(withRam(found(createInitialGameState()), 1024))

    expect(await createSweepTarget(state.read, state.write)(SRV_01)).toEqual({ status: 'observed', servicesObserved: 2, analysesStarted: 1, insufficientMemory: true })
    expect(state.current.process.processes).toHaveLength(1)
  })

  it('still observes when no investigation can start at all', async () => {
    const state = store(withRam(found(createInitialGameState()), 512))

    expect(await createSweepTarget(state.read, state.write)(SRV_01)).toEqual({ status: 'observed', servicesObserved: 2, analysesStarted: 0, insufficientMemory: true })
    expect(state.current.process.processes).toEqual([])
    // The Scan itself still happened: contention is a Process limit, not an observation limit.
    expect(state.current.discovery.devices.find(({ id }) => id === 'host-lan-001')!.servicesObserved).toBe(true)
  })

  it('requires an installed NodeScan release', async () => {
    const state = store(withoutNodeScan(found(createInitialGameState())))
    expect(await createSweepTarget(state.read, state.write)(SRV_01)).toEqual({ status: 'software_unavailable' })
  })
})
