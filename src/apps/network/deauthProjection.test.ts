import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { FLIPPER_1_0_CANONICAL_INSTALLATION } from '../../core/game/flipper'
import { selectTarget } from './targetProjection'

function knownRemote() {
  const base = createInitialGameState()
  const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: [...base.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION] } } }
  const discovery = rememberScan(state.discovery, scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, 'remote-segment-01'), state.player.localDevice.id)
  return { ...state, discovery }
}

describe('NodeScan DEAUTH projection', () => {
  it('forms an explicitly Network-scoped action from remembered topology only', () => {
    const state = knownRemote()
    const action = selectTarget(state, 'host-lan-002')?.offensiveActions.find(({ technique }) => technique === 'DEAUTH')
    expect(action).toEqual({ technique: 'DEAUTH', provider: 'deauth.ext', running: false, route: { networkId: 'network-foreign-001', networkName: 'remote-segment-01', contextDeviceId: 'host-lan-002' } })

    const hiddenMembershipChanged = { ...state, world: { ...state.world, network: { ...state.world.network, localNetworks: state.world.network.localNetworks.map((network) => network.id === 'network-foreign-001' ? { ...network, memberDeviceIds: [] } : network) } } }
    expect(selectTarget(hiddenMembershipChanged, 'host-lan-002')?.offensiveActions.find(({ technique }) => technique === 'DEAUTH')).toEqual(action)
  })

  it('removes the action with either represented provider cause', () => {
    const state = knownRemote()
    const noExtension = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.filter((file) => file.kind !== 'deauth_extension') } } } }
    const noFlipper = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper') } } }
    expect(selectTarget(noExtension, 'host-lan-002')?.offensiveActions.some(({ technique }) => technique === 'DEAUTH')).toBe(false)
    expect(selectTarget(noFlipper, 'host-lan-002')?.offensiveActions.some(({ technique }) => technique === 'DEAUTH')).toBe(false)
  })
})
