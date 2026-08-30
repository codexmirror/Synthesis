import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { findInstalledNodeMiner, findInstalledNodeScan, nodeScanSupportsInspect } from './software'
import { findInstalledFlipper, flipperSupportsTechnique } from './flipper'

describe('installed software', () => {
  it('finds each concrete installation by stable product identity', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeScan(device)).toEqual(expect.objectContaining({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' }))
    expect(findInstalledFlipper(device)).toEqual(expect.objectContaining({ id: 'flipper', releaseId: 'flipper-1.0', name: 'Flipper', version: '1.0', integratedModules: ['credential-access'] }))
    const flipper = findInstalledFlipper(device)!
    expect(flipperSupportsTechnique(flipper, 'AUTH-017')).toBe(true)
    // The canonical build does not integrate the Rollback Module, so it supports neither UPD-001 nor anything unrepresented.
    expect(flipperSupportsTechnique(flipper, 'UPD-001')).toBe(false)
    expect(flipperSupportsTechnique(flipper, 'UNRELATED-001')).toBe(false)
  })

  it('does not find NODE Miner installed on a fresh Device, since it starts only as a local package', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeMiner(device)).toBeUndefined()
  })

  it('grants Inspect only to the nodescan-1.1-experimental release', () => {
    expect(nodeScanSupportsInspect({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', buildId: 'build-fixture-v0', name: 'NodeScan', version: '1.0', channel: 'standard' })).toBe(false)
    expect(nodeScanSupportsInspect({ id: 'nodescan', releaseId: 'nodescan-1.1-experimental', buildId: 'build-fixture-v0', name: 'NodeScan', version: '1.1', channel: 'experimental' })).toBe(true)
  })
})
