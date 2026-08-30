import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import {
  CREDENTIAL_ACCESS_MODULE_1_0, FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES, FLIPPER_1_0_CANONICAL_INSTALLATION,
  FLIPPER_INSTALLED_EXECUTABLE_PATH, ROLLBACK_MODULE_1_0, findInstalledFlipper, findLocalTechniqueTool,
  flipperSupportsTechnique, startFlipperModuleIntegration,
} from './flipper'
import {
  FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID, FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID,
  FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID,
} from './softwareReleaseContent'
import type { ExecutableFile, FlipperInstallation, GameState, SoftwareModuleFile } from './types'

function moduleFile(module: typeof CREDENTIAL_ACCESS_MODULE_1_0 | typeof ROLLBACK_MODULE_1_0, id: string): SoftwareModuleFile {
  return { kind: 'software_module', id, path: `/home/user/modules/${id}.mod`, ...module }
}
const credentialFile = moduleFile(CREDENTIAL_ACCESS_MODULE_1_0, 'module-credential')
const rollbackFile = moduleFile(ROLLBACK_MODULE_1_0, 'module-rollback')

function withHost(state = createInitialGameState(), installation: FlipperInstallation = FLIPPER_1_0_CANONICAL_INSTALLATION): GameState {
  const executable: ExecutableFile = {
    kind: 'executable', id: 'file-flipper-host', path: FLIPPER_INSTALLED_EXECUTABLE_PATH, programId: 'flipper',
    releaseId: installation.releaseId, buildId: installation.buildId, name: installation.name, version: installation.version, sizeBytes: installation.sizeBytes,
  }
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: [...state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper'), installation],
    filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files.filter((file) => file.path !== FLIPPER_INSTALLED_EXECUTABLE_PATH), executable] },
  } } }
}
function withModules(state = withHost()): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem,
    files: [...state.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module'), credentialFile, rollbackFile],
  } } } }
}
function start(state: GameState, fileId: string) {
  const result = startFlipperModuleIntegration(state, fileId)
  if (result.status !== 'started') throw new Error(result.status)
  return result
}
function complete(state: GameState, fileId: string): GameState { return advanceGameState(start(state, fileId).state, 60_000) }
function hostFile(state: GameState): ExecutableFile {
  return state.player.localDevice.filesystem.files.find((file): file is ExecutableFile => file.kind === 'executable' && file.programId === 'flipper')!
}

describe('standalone offensive module capability', () => {
  it('recognizes each exact authored standalone module without Flipper', () => {
    const state = withModules(createInitialGameState())
    expect(findInstalledFlipper(state.player.localDevice)).toBeUndefined()
    expect(findLocalTechniqueTool(state.player.localDevice, 'AUTH-017')).toEqual({ toolName: 'Standalone Module', moduleName: 'Credential Access Module' })
    expect(findLocalTechniqueTool(state.player.localDevice, 'UPD-001')).toEqual({ toolName: 'Standalone Module', moduleName: 'Rollback Module' })
  })

  it('allows unsupported copies to retain module identity without supplying either technique', () => {
    const base = createInitialGameState()
    const foreignCredential = { ...credentialFile, buildId: 'unsupported-credential-build' }
    const foreignRollback = { ...rollbackFile, releaseId: 'unsupported-rollback-release' }
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [foreignCredential, foreignRollback] } } } }
    expect(findLocalTechniqueTool(state.player.localDevice, 'AUTH-017')).toBeUndefined()
    expect(findLocalTechniqueTool(state.player.localDevice, 'UPD-001')).toBeUndefined()
  })
})

describe('concrete Flipper host integration', () => {
  it('keeps integratedModules as capability authority rather than inferring from build identity', () => {
    expect(flipperSupportsTechnique({ ...FLIPPER_1_0_CANONICAL_INSTALLATION, buildId: FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID }, 'AUTH-017')).toBe(false)
    expect(flipperSupportsTechnique({ ...FLIPPER_1_0_CANONICAL_INSTALLATION, integratedModules: ['credential-access'] }, 'AUTH-017')).toBe(true)
  })

  it('rejects missing, non-module, and unsupported concrete module artifacts without mutation', () => {
    const state = withModules()
    expect(startFlipperModuleIntegration(state, 'missing')).toEqual({ status: 'module_not_found', state })
    expect(startFlipperModuleIntegration(state, 'file-0001')).toEqual({ status: 'not_module_artifact', state })
    const altered = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.map((file) => file.id === rollbackFile.id && file.kind === 'software_module' ? { ...file, sizeBytes: file.sizeBytes + 1 } : file) } } } }
    expect(startFlipperModuleIntegration(altered, rollbackFile.id)).toEqual({ status: 'unsupported_module_build', state: altered })
  })

  it('binds admission to the exact installed host and managed executable without changing either before completion', () => {
    const state = withModules()
    const admitted = start(state, credentialFile.id)
    const process = admitted.state.process.processes.find(({ id }) => id === admitted.processId)
    expect(process).toMatchObject({ kind: 'flipper_module_integration', hostReleaseId: 'flipper-1.0', hostBuildId: 'build-flipper-1.0-base', hostSizeBytes: 4_000_000, hostFileId: 'file-flipper-host' })
    expect(findInstalledFlipper(admitted.state.player.localDevice)).toEqual(FLIPPER_1_0_CANONICAL_INSTALLATION)
    expect(hostFile(admitted.state)).toEqual(hostFile(state))
  })

  it('atomically updates InstalledSoftware and its managed artifact while preserving the source module', () => {
    const state = withModules()
    const done = complete(state, credentialFile.id)
    const installed = findInstalledFlipper(done.player.localDevice)!
    expect(installed).toMatchObject({ buildId: FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID, integratedModules: ['credential-access'], sizeBytes: FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES + CREDENTIAL_ACCESS_MODULE_1_0.sizeBytes })
    expect(hostFile(done)).toMatchObject({ releaseId: installed.releaseId, buildId: installed.buildId, sizeBytes: installed.sizeBytes })
    expect(done.player.localDevice.filesystem.files).toContainEqual(credentialFile)
    expect(flipperSupportsTechnique(installed, 'AUTH-017')).toBe(true)
  })

  it('does not duplicate capability, size, or build mutation on repetition', () => {
    const once = complete(withModules(), credentialFile.id)
    const before = findInstalledFlipper(once.player.localDevice)!
    expect(startFlipperModuleIntegration(once, credentialFile.id)).toEqual({ status: 'already_integrated', state: once })
    expect(findInstalledFlipper(once.player.localDevice)).toEqual(before)
    expect(hostFile(once).sizeBytes).toBe(before.sizeBytes)
  })

  it('reaches the same explicit combined build in both integration orders', () => {
    const credentialThenRollback = complete(complete(withModules(), credentialFile.id), rollbackFile.id)
    const rollbackThenCredential = complete(complete(withModules(), rollbackFile.id), credentialFile.id)
    for (const state of [credentialThenRollback, rollbackThenCredential]) {
      const installed = findInstalledFlipper(state.player.localDevice)!
      expect(installed).toMatchObject({ buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID, integratedModules: ['credential-access', 'rollback'], sizeBytes: 7_700_000 })
      expect(hostFile(state)).toMatchObject({ buildId: installed.buildId, sizeBytes: installed.sizeBytes })
    }
    expect(findInstalledFlipper(complete(withModules(), rollbackFile.id).player.localDevice)?.buildId).toBe(FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID)
  })

  it.each([
    ['installed host replacement', (state: GameState) => ({ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'flipper' ? { ...(software as FlipperInstallation), buildId: 'replacement-build' } : software) } } })],
    ['managed artifact replacement', (state: GameState) => ({ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.map((file) => file.id === 'file-flipper-host' && file.kind === 'executable' ? { ...file, id: 'replacement-host', buildId: 'replacement-build' } : file) } } } })],
  ])('does not transform a %s after admission', (_label, replace) => {
    const admitted = start(withModules(), credentialFile.id)
    const replaced = replace(admitted.state)
    const done = advanceGameState(replaced, 60_000)
    expect(findInstalledFlipper(done.player.localDevice)?.buildId).toBe(replaced.player.localDevice.installedSoftware.find(({ id }) => id === 'flipper')?.buildId)
    expect(done.process.processes.find(({ id }) => id === admitted.processId)).toMatchObject({ result: { status: expect.stringMatching(/host_(changed|unavailable)/) } })
    expect(done.player.localDevice.filesystem.files).toEqual(replaced.player.localDevice.filesystem.files)
  })

  it('keeps filesystem copy identity separate from module and build identity', () => {
    const copied = { ...credentialFile, id: 'module-credential-copy', path: '/tmp/credential-copy.mod' }
    const base = withModules()
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, copied] } } } }
    const done = complete(state, copied.id)
    expect(findInstalledFlipper(done.player.localDevice)?.buildId).toBe(FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID)
    expect(done.player.localDevice.filesystem.files).toContainEqual(credentialFile)
    expect(done.player.localDevice.filesystem.files).toContainEqual(copied)
  })

  it('rejects unsupported source host and mismatched managed artifact builds', () => {
    const unsupported = withModules(withHost(createInitialGameState(), { ...FLIPPER_1_0_CANONICAL_INSTALLATION, buildId: 'unknown-build' }))
    expect(startFlipperModuleIntegration(unsupported, credentialFile.id).status).toBe('unsupported_host_build')
    const base = withModules()
    const mismatch = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: base.player.localDevice.filesystem.files.map((file) => file.id === 'file-flipper-host' && file.kind === 'executable' ? { ...file, buildId: 'other-build' } : file) } } } }
    expect(startFlipperModuleIntegration(mismatch, credentialFile.id).status).toBe('managed_host_artifact_unavailable')
  })
})
