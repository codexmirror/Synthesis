import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import {
  CREDENTIAL_ACCESS_MODULE_1_0, FLIPPER_1_0_CANONICAL_INSTALLATION,
  FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES, ROLLBACK_MODULE_1_0,
  findInstalledFlipper, flipperSupportsTechnique, startFlipperModuleIntegration,
} from './flipper'
import { FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID, FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID, FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID } from './softwareReleaseContent'
import type { GameState, SoftwareModuleFile } from './types'

function withHost(state = createInitialGameState()): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: [...state.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION],
  } } }
}
function artifact(module: typeof CREDENTIAL_ACCESS_MODULE_1_0 | typeof ROLLBACK_MODULE_1_0, id: string): SoftwareModuleFile {
  return { kind: 'software_module', id, path: `/home/user/modules/${id}.mod`, ...module }
}
function integrate(state: GameState, id: string): GameState {
  const started = startFlipperModuleIntegration(state, id)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 60_000)
}

describe('Flipper acquisition and concrete build progression', () => {
  it('starts with a standalone Credential Access Module and no installed Flipper', () => {
    const state = createInitialGameState()
    expect(findInstalledFlipper(state.player.localDevice)).toBeUndefined()
    expect(state.player.localDevice.filesystem.files).toContainEqual(expect.objectContaining(CREDENTIAL_ACCESS_MODULE_1_0))
  })

  it('the acquired canonical host is module-free and supplies no technique', () => {
    expect(FLIPPER_1_0_CANONICAL_INSTALLATION).toMatchObject({ integratedModules: [], sizeBytes: FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES })
    expect(flipperSupportsTechnique(FLIPPER_1_0_CANONICAL_INSTALLATION, 'AUTH-017')).toBe(false)
  })

  it('integrates either owned standalone module into an explicit stronger build', () => {
    const credential = createInitialGameState().player.localDevice.filesystem.files.find((file) => file.kind === 'software_module')!
    const credentialBuild = integrate(withHost(), credential.id)
    expect(findInstalledFlipper(credentialBuild.player.localDevice)).toMatchObject({
      buildId: FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID, integratedModules: ['credential-access'],
      sizeBytes: FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES + CREDENTIAL_ACCESS_MODULE_1_0.sizeBytes,
    })

    const rollbackFile = artifact(ROLLBACK_MODULE_1_0, 'rollback')
    const base = withHost()
    const rollbackState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, rollbackFile] } } } }
    const rollbackBuild = integrate(rollbackState, rollbackFile.id)
    expect(findInstalledFlipper(rollbackBuild.player.localDevice)).toMatchObject({ buildId: FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID, integratedModules: ['rollback'] })
  })

  it('integrates both modules in either order into the same authored strongest build without consuming artifacts', () => {
    const rollbackFile = artifact(ROLLBACK_MODULE_1_0, 'rollback')
    const base = withHost()
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, rollbackFile] } } } }
    const credential = state.player.localDevice.filesystem.files.find((file) => file.kind === 'software_module' && file.moduleId === 'credential-access')!
    const done = integrate(integrate(state, rollbackFile.id), credential.id)
    expect(findInstalledFlipper(done.player.localDevice)).toMatchObject({ buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID, integratedModules: ['credential-access', 'rollback'] })
    expect(done.player.localDevice.filesystem.files).toContainEqual(rollbackFile)
  })

  it('requires a host, exact authored module build, and rejects reintegration', () => {
    const initial = createInitialGameState()
    const credential = initial.player.localDevice.filesystem.files.find((file) => file.kind === 'software_module')!
    expect(startFlipperModuleIntegration(initial, credential.id).status).toBe('host_not_installed')
    const host = withHost()
    const foreign = { ...credential, buildId: 'foreign' }
    const state = { ...host, player: { ...host.player, localDevice: { ...host.player.localDevice, filesystem: { ...host.player.localDevice.filesystem, files: host.player.localDevice.filesystem.files.map((file) => file.id === credential.id ? foreign : file) } } } }
    expect(startFlipperModuleIntegration(state, credential.id).status).toBe('unsupported_module_build')
    const done = integrate(host, credential.id)
    expect(startFlipperModuleIntegration(done, credential.id).status).toBe('already_integrated')
  })
})
