import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  AUTHORED_SOFTWARE_RELEASES,
  FLIPPER_1_0,
  NODESCAN_1_0_STANDARD,
  NODESCAN_1_1_EXPERIMENTAL,
  NODE_MINER_1_0,
} from './softwareReleaseContent'
import { FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES } from './flipper'

describe('authored software release content', () => {
  it('owns the five current releases under their exact stable release IDs', () => {
    expect(AUTHORED_SOFTWARE_RELEASES.map(({ releaseId }) => releaseId)).toEqual([
      'nodescan-1.0-standard',
      'nodescan-1.1-experimental',
      'flipper-1.0',
      'node-miner-1.0',
      'release-rattler-1.0-v0',
    ])
  })

  it('authors one distinct stable canonical build identity for every current release', () => {
    const buildIds = AUTHORED_SOFTWARE_RELEASES.map(({ buildId }) => buildId)
    expect(new Set(buildIds).size).toBe(buildIds.length)
    expect(AUTHORED_SOFTWARE_RELEASES.every(({ releaseId, buildId }) => releaseId !== buildId)).toBe(true)
  })

  it('authors self-contained ordinary metadata snapshots into initial installed software', () => {
    const installed = createInitialGameState().player.localDevice.installedSoftware
    expect(installed.find(({ id }) => id === NODESCAN_1_0_STANDARD.productId)).toEqual({
      id: NODESCAN_1_0_STANDARD.productId, releaseId: NODESCAN_1_0_STANDARD.releaseId,
      buildId: NODESCAN_1_0_STANDARD.buildId, name: NODESCAN_1_0_STANDARD.name, version: NODESCAN_1_0_STANDARD.version,
      channel: NODESCAN_1_0_STANDARD.channel,
    })
    // Flipper is authored but deliberately not initially installed.
    expect(installed.find(({ id }) => id === FLIPPER_1_0.productId)).toBeUndefined()
  })

  it('authors package metadata without replacing concrete artifact truth', () => {
    const state = createInitialGameState()
    const miner = state.player.localDevice.filesystem.files.find(({ id }) => id === 'file-0002')
    expect(miner).toEqual({
      kind: 'software_package', id: 'file-0002', path: '/home/user/downloads/node-miner-1.0.pkg',
      productId: NODE_MINER_1_0.productId, releaseId: NODE_MINER_1_0.releaseId,
      buildId: NODE_MINER_1_0.buildId, name: NODE_MINER_1_0.name, version: NODE_MINER_1_0.version, channel: NODE_MINER_1_0.channel,
      publisher: NODE_MINER_1_0.publisher, sizeBytes: 3_400_000,
    })
    const remote = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.filesystem?.files.find(({ id }) => id === 'file-0002')
    expect(remote).toEqual({
      kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg',
      productId: NODESCAN_1_1_EXPERIMENTAL.productId, releaseId: NODESCAN_1_1_EXPERIMENTAL.releaseId,
      buildId: NODESCAN_1_1_EXPERIMENTAL.buildId, name: NODESCAN_1_1_EXPERIMENTAL.name, version: NODESCAN_1_1_EXPERIMENTAL.version,
      channel: NODESCAN_1_1_EXPERIMENTAL.channel, sizeBytes: 18_400_000,
    })
  })
})
