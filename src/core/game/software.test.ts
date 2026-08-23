import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { basicCredentialToolkitSupports, findInstalledBasicCredentialToolkit, findInstalledNodeMiner, findInstalledNodeScan, nodeScanSupportsEnhancedInspect } from './software'

describe('installed software', () => {
  it('finds each concrete installation by stable product identity', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeScan(device)).toEqual({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' })
    expect(findInstalledBasicCredentialToolkit(device)).toEqual({ id: 'basic-credential-toolkit', releaseId: 'basic-credential-toolkit-1.0', name: 'Basic Credential Toolkit', version: '1.0' })
    const toolkit = findInstalledBasicCredentialToolkit(device)!
    expect(basicCredentialToolkitSupports(toolkit, 'AUTH-017')).toBe(true)
    expect(basicCredentialToolkitSupports(toolkit, 'UNRELATED-001')).toBe(false)
  })

  it('does not find NODE Miner installed on a fresh Device, since it starts only as a local package', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeMiner(device)).toBeUndefined()
  })

  it('grants enhanced Inspect depth only to the nodescan-1.1-experimental release', () => {
    expect(nodeScanSupportsEnhancedInspect({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' })).toBe(false)
    expect(nodeScanSupportsEnhancedInspect({ id: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' })).toBe(true)
  })
})
