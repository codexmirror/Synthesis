import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { installLocalSoftwarePackage } from './softwareInstallation'
import type { GameState, SoftwarePackageFile } from './types'

const path = '/home/user/downloads/nodescan.weird'
const packageFile: SoftwarePackageFile = { kind: 'software_package', id: 'file-package', path, releaseId: 'build-a91f7', productId: 'nodescan', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }

function withFiles(files: GameState['player']['localDevice']['filesystem']['files']): GameState {
  const state = createInitialGameState()
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files } } } }
}

describe('installLocalSoftwarePackage', () => {
  it.each([
    ['relative.pkg', 'invalid_path'],
    ['/missing.pkg', 'package_not_found'],
    ['/home', 'package_not_file'],
  ] as const)('returns %s without mutation', (requestedPath, status) => {
    const state = withFiles([{ kind: 'text', id: 'file-fixture-text', path: '/home/user/readme.txt', content: '' }])
    expect(installLocalSoftwarePackage(state, requestedPath)).toEqual({ status, state })
  })

  it('validates canonical file kind and product identity rather than filename or display name', () => {
    const text = withFiles([{ kind: 'text', id: 'file-fixture-text', path: '/home/user/nodescan.pkg', content: '' }])
    expect(installLocalSoftwarePackage(text, '/home/user/nodescan.pkg')).toEqual({ status: 'not_software_package', state: text })
    const unsupportedFile = { ...packageFile, productId: 'other-product' }
    const unsupported = withFiles([unsupportedFile])
    expect(installLocalSoftwarePackage(unsupported, path)).toEqual({ status: 'unsupported_package', state: unsupported })
  })

  it('projects explicit metadata with opaque release identity, preserves package, Process, unrelated software, and ordering', () => {
    const state = withFiles([packageFile])
    const result = installLocalSoftwarePackage(state, path)
    expect(result).toMatchObject({ status: 'installed', productId: 'nodescan', releaseId: 'build-a91f7', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', previousReleaseId: 'nodescan-1.0-standard' })
    expect(result.state).not.toBe(state)
    expect(result.state.player.localDevice.installedSoftware).toEqual([
      { id: 'nodescan', releaseId: 'build-a91f7', name: 'Canonical Scanner', version: '1.1', channel: 'experimental' },
      state.player.localDevice.installedSoftware[1],
    ])
    expect(result.state.player.localDevice.filesystem.files[0]).toBe(packageFile)
    expect(result.state.process).toBe(state.process)
    expect(result.state.world).toBe(state.world)
  })

  it('uses releaseId alone for sameness and replaces any different release without version ordering', () => {
    const same = withFiles([{ ...packageFile, releaseId: 'nodescan-1.0-standard', name: 'Malformed Metadata', version: '99' }])
    expect(installLocalSoftwarePackage(same, path)).toEqual({ status: 'already_installed', state: same })
    const lowerLooking = withFiles([{ ...packageFile, releaseId: 'different-build', version: '0.1', channel: 'modified' }])
    expect(installLocalSoftwarePackage(lowerLooking, path).state.player.localDevice.installedSoftware[0]).toMatchObject({ releaseId: 'different-build', version: '0.1', channel: 'modified' })
  })

  it('appends NodeScan when absent while preserving unrelated software', () => {
    const base = withFiles([packageFile])
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    const result = installLocalSoftwarePackage(state, path)
    expect(result.state.player.localDevice.installedSoftware).toEqual([base.player.localDevice.installedSoftware[1], expect.objectContaining({ id: 'nodescan', releaseId: 'build-a91f7' })])
  })

  it('cannot install a package that exists only on a remote filesystem', () => {
    const state = createInitialGameState()
    const remotePath = '/opt/packages/nodescan-exp-1.1.pkg'
    expect(state.world.network.hosts[0].filesystem?.files.some(({ path }) => path === remotePath)).toBe(true)
    expect(installLocalSoftwarePackage(state, remotePath)).toEqual({ status: 'package_not_found', state })
  })
})
