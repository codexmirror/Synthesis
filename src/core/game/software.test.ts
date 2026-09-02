import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { findInstalledNodeMiner, findInstalledNodeScan, nodeScanSupportsInspect, nodeScanSupportsIntegratedIntelligence, nodeScanSupportsLiveTopology } from './software'
import { findInstalledFlipper } from './flipper'

describe('installed software', () => {
  it('finds each concrete installation by stable product identity', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeScan(device)).toEqual(expect.objectContaining({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' }))
    expect(findInstalledFlipper(device)).toBeUndefined()
  })

  it('does not find NODE Miner installed on a fresh Device, since it starts only as a local package', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeMiner(device)).toBeUndefined()
  })

  it('grants Inspect only to the nodescan-1.1-experimental release', () => {
    expect(nodeScanSupportsInspect({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', buildId: 'build-fixture-v0', name: 'NodeScan', version: '1.0', channel: 'standard' })).toBe(false)
    expect(nodeScanSupportsInspect({ id: 'nodescan', releaseId: 'nodescan-1.1-experimental', buildId: 'build-fixture-v0', name: 'NodeScan', version: '1.1', channel: 'experimental' })).toBe(true)
    expect(nodeScanSupportsInspect({ id: 'nodescan', releaseId: 'nodescan-1.2-standard', buildId: 'build-fixture-v0', name: 'NodeScan', version: '1.2', channel: 'standard' })).toBe(true)
  })

  it('grants live topology and integrated intelligence only by the authored NodeScan 1.2 release identity', () => {
    const oneOne = { id: 'nodescan' as const, releaseId: 'nodescan-1.1-experimental', buildId: 'build-fixture-v0', name: 'NodeScan', version: '9.9', channel: 'experimental' }
    const oneTwo = { ...oneOne, releaseId: 'nodescan-1.2-standard', version: '0.1', channel: 'standard' }
    expect(nodeScanSupportsLiveTopology(oneOne)).toBe(false)
    expect(nodeScanSupportsIntegratedIntelligence(oneOne)).toBe(false)
    expect(nodeScanSupportsLiveTopology(oneTwo)).toBe(true)
    expect(nodeScanSupportsIntegratedIntelligence(oneTwo)).toBe(true)
  })
})
