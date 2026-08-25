import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  AUTHORED_SOFTWARE_RELEASES,
  BASIC_CREDENTIAL_TOOLKIT_1_0,
  NODESCAN_1_0_STANDARD,
  NODESCAN_1_1_EXPERIMENTAL,
  NODE_MINER_1_0,
} from './softwareReleaseContent'

describe('authored software release content', () => {
  it('owns the four current releases under their exact stable release IDs', () => {
    expect(AUTHORED_SOFTWARE_RELEASES.map(({ releaseId }) => releaseId)).toEqual([
      'nodescan-1.0-standard',
      'nodescan-1.1-experimental',
      'basic-credential-toolkit-1.0',
      'node-miner-1.0',
    ])
  })

  it('authors self-contained ordinary metadata snapshots into initial installed software', () => {
    const installed = createInitialGameState().player.localDevice.installedSoftware
    expect(installed.find(({ id }) => id === NODESCAN_1_0_STANDARD.productId)).toEqual({
      id: NODESCAN_1_0_STANDARD.productId, releaseId: NODESCAN_1_0_STANDARD.releaseId,
      name: NODESCAN_1_0_STANDARD.name, version: NODESCAN_1_0_STANDARD.version,
      channel: NODESCAN_1_0_STANDARD.channel,
    })
    expect(installed.find(({ id }) => id === BASIC_CREDENTIAL_TOOLKIT_1_0.productId)).toEqual({
      id: BASIC_CREDENTIAL_TOOLKIT_1_0.productId, releaseId: BASIC_CREDENTIAL_TOOLKIT_1_0.releaseId,
      name: BASIC_CREDENTIAL_TOOLKIT_1_0.name, version: BASIC_CREDENTIAL_TOOLKIT_1_0.version,
    })
  })

  it('authors package metadata without replacing concrete artifact truth', () => {
    const state = createInitialGameState()
    const miner = state.player.localDevice.filesystem.files.find(({ id }) => id === 'file-0002')
    expect(miner).toEqual({
      kind: 'software_package', id: 'file-0002', path: '/home/user/downloads/node-miner-1.0.pkg',
      productId: NODE_MINER_1_0.productId, releaseId: NODE_MINER_1_0.releaseId,
      name: NODE_MINER_1_0.name, version: NODE_MINER_1_0.version, channel: NODE_MINER_1_0.channel,
      publisher: NODE_MINER_1_0.publisher, sizeBytes: 3_400_000,
    })
    const remote = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.filesystem?.files.find(({ id }) => id === 'file-0002')
    expect(remote).toEqual({
      kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg',
      productId: NODESCAN_1_1_EXPERIMENTAL.productId, releaseId: NODESCAN_1_1_EXPERIMENTAL.releaseId,
      name: NODESCAN_1_1_EXPERIMENTAL.name, version: NODESCAN_1_1_EXPERIMENTAL.version,
      channel: NODESCAN_1_1_EXPERIMENTAL.channel, sizeBytes: 18_400_000,
    })
  })
})
