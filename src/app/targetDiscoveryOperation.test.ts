import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { createFindTargets } from './targetDiscoveryOperation'



function store(initial: GameState) {
  let state = initial
  return { read: () => state, write: (next: GameState) => { state = next }, get current() { return state } }
}



function withoutNodeScan(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
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
