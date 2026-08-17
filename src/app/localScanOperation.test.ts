import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createLocalScanTarget } from './localScanOperation'

describe('local Scan application operation', () => {
  it('returns the existing structured domain observation', async () => {
    const state = createInitialGameState()
    const scanTarget = createLocalScanTarget(() => state)

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
    const scanTarget = createLocalScanTarget(() => state)
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
      devices: [{ targetId: state.player.localDevice.id }],
    })
  })

  it('commits observation and Discovery as one synchronous application transition', async () => {
    let state = createInitialGameState()
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })
    const pending = scanTarget(state.player.localDevice.network.ip)
    expect(state.discovery.networks.map((network) => network.name)).toEqual(['home-net'])
    await pending
  })

  it('merges back-to-back observations from latest canonical Discovery without lost updates', async () => {
    let state = createInitialGameState()
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })
    const first = scanTarget('home-net')
    const second = scanTarget('198.51.100.47')
    await Promise.all([first, second])
    expect(state.discovery.networks.map((network) => network.name)).toContain('home-net')
    expect(state.discovery.devices.map((device) => device.address)).toContain('198.51.100.47')
    expect(state.discovery.services.map((service) => service.name)).toEqual(['SSH', 'HTTP'])
  })
})
