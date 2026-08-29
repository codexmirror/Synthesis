import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createLocalScanTarget } from './localScanOperation'

describe('local Scan application operation', () => {
  it('returns the existing structured domain observation', async () => {
    let state = createInitialGameState()
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })

    expect(await scanTarget('home-net')).toEqual(scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, 'home-net'))
    expect(await scanTarget('198.51.100.47')).toEqual(scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, '198.51.100.47'))
  })

  it('reads current canonical state for every request instead of capturing initial World', async () => {
    let state: GameState = createInitialGameState()
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })
    const host = state.world.network.hosts[0]
    state = {
      ...state,
      world: {
        network: {
          ...state.world.network,
          hosts: [{ ...host, online: false }, ...state.world.network.hosts.slice(1)],
        },
      },
    }

    expect(await scanTarget(host.ip)).toEqual({ status: 'no_response', address: host.ip })
    expect(await scanTarget('home-net')).toMatchObject({
      status: 'network',
      // srv-01 is offline; SELF and the phone still respond.
      devices: [{ targetId: state.player.localDevice.id }, { targetId: 'host-phone-001' }],
    })
  })

  it('does not observe or mutate Discovery without NodeScan installed', async () => {
    let state = createInitialGameState()
    state = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    const before = state.discovery
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })
    expect(await scanTarget('home-net')).toEqual({ status: 'software_unavailable' })
    expect(state.discovery).toBe(before)
  })
})

it('merges back-to-back observations against the latest canonical Discovery', async () => {
  let state = createInitialGameState()
  const scan = createLocalScanTarget(() => state, (next) => { state = next })
  await scan(state.player.localDevice.network.ip)
  await scan('home-net')
  expect(state.discovery.networks).toMatchObject([{ name: 'home-net', membersObserved: true }])
  expect(state.discovery.networkDeviceRelations).toHaveLength(3)
  expect(state.discovery.devices).toMatchObject([{ id: 'host-lan-001', servicesObserved: false }, { id: 'host-phone-001', servicesObserved: false }])
})
