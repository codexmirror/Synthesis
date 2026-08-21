import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { findInstalledBasicCredentialToolkit, findInstalledNodeScan } from './software'

describe('installed software', () => {
  it('finds each concrete installation by stable product identity', () => {
    const device = createInitialGameState().player.localDevice
    expect(findInstalledNodeScan(device)).toEqual({ id: 'nodescan', name: 'NodeScan', version: '1.0', channel: 'standard' })
    expect(findInstalledBasicCredentialToolkit(device)).toEqual({ id: 'basic-credential-toolkit', name: 'Basic Credential Toolkit', version: '1.0' })
  })
})
