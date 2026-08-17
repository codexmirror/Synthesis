import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createLocalScanTarget } from './localScanOperation'

describe('local Scan application operation', () => {
  it('returns the existing structured domain observation', () => {
    const state = createInitialGameState()
    const scanTarget = createLocalScanTarget(() => state)

    expect(scanTarget('home-net')).toEqual(scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, 'home-net'))
    expect(scanTarget('198.51.100.47')).toEqual(scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, '198.51.100.47'))
  })

  it('reads current canonical state for every request instead of capturing initial World', () => {
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

    expect(scanTarget(host.ip)).toEqual({ status: 'no_response', address: host.ip })
    expect(scanTarget('home-net')).toMatchObject({
      status: 'network',
      devices: [{ targetId: state.player.localDevice.id }],
    })
  })
})
