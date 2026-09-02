import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { FLIPPER_1_0_CANONICAL_INSTALLATION } from '../../core/game/flipper'
import type { GameState } from '../../core/game/types'
import { deriveFlipperArsenal } from './arsenalProjection'

function withFlipper(state = createInitialGameState()): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: [...state.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION],
  } } }
}

describe('Flipper arsenal projection', () => {
  it('derives ACCESS → CREDENTIAL ACCESS from exact represented providers', () => {
    expect(deriveFlipperArsenal(withFlipper().player.localDevice)).toEqual([{
      area: 'ACCESS', family: 'CREDENTIAL ACCESS', providers: [
        { id: 'credential-access-module', name: 'Credential Access Module', version: '1.0', form: 'SOFTWARE MODULE', integration: 'AVAILABLE TO INTEGRATE' },
        { id: 'keyprobe', name: 'KeyProbe', version: '1.0', form: 'INSTALLED SOFTWARE', integration: 'COMPATIBLE' },
      ],
    }])
  })

  it('removes providers with their represented causes and fabricates no empty future branch', () => {
    const state = withFlipper()
    const device = { ...state.player.localDevice,
      installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'keyprobe'),
      filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.filter(({ kind }) => kind !== 'software_module') },
    }
    expect(deriveFlipperArsenal(device)).toEqual([])
  })

  it('requires the exact represented KeyProbe release/build for compatibility', () => {
    const state = withFlipper()
    const device = { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) =>
      software.id === 'keyprobe' ? { ...software, buildId: 'unrepresented-build' } : software) }
    expect(deriveFlipperArsenal(device)[0].providers.map(({ id }) => id)).toEqual(['credential-access-module'])
  })
})
