import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { copyFilesystemFileToPath } from './filesystem'
import {
  FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES,
  FLIPPER_MODULE_INTEGRATION_RAM_REQUIRED_MIB,
  FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED,
  FLIPPER_PRODUCT_ID,
  ROLLBACK_MODULE_1_0,
  findInstalledFlipper,
  findLocalFlipperModuleArtifacts,
  flipperSupportsTechnique,
  resolveCompletedFlipperModuleIntegrations,
  startFlipperModuleIntegration,
} from './flipper'
import { FLIPPER_1_0_CANONICAL_BUILD_ID, FLIPPER_1_0_RELEASE_ID, FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID } from './softwareReleaseContent'
import type { FlipperInstallation, FlipperModuleIntegrationProcess, GameState, SoftwareModuleFile } from './types'

const ROLLBACK_ARTIFACT: SoftwareModuleFile = {
  kind: 'software_module', id: 'file-module-rollback', path: '/home/user/downloads/flipper-rollback-module-1.0.mod',
  ...ROLLBACK_MODULE_1_0,
}

function withModuleArtifact(state = createInitialGameState(), file: SoftwareModuleFile = ROLLBACK_ARTIFACT): GameState {
  const filesystem = state.player.localDevice.filesystem
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...filesystem, files: [...filesystem.files, file] } } } }
}

function flipper(state: GameState): FlipperInstallation {
  const installation = findInstalledFlipper(state.player.localDevice)
  if (!installation) throw new Error('expected an installed Flipper')
  return installation
}

function integrated(state: GameState, fileId = ROLLBACK_ARTIFACT.id): GameState {
  const started = startFlipperModuleIntegration(state, fileId)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 60_000)
}

describe('Flipper as the installed offensive product', () => {
  it('is the one installed offensive product, integrating the Credential Access Module in its canonical build', () => {
    const installation = flipper(createInitialGameState())
    expect(installation).toMatchObject({
      id: FLIPPER_PRODUCT_ID, releaseId: FLIPPER_1_0_RELEASE_ID, buildId: FLIPPER_1_0_CANONICAL_BUILD_ID,
      integratedModules: ['credential-access'], sizeBytes: FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES,
    })
    expect(flipperSupportsTechnique(installation, 'AUTH-017')).toBe(true)
    expect(flipperSupportsTechnique(installation, 'UPD-001')).toBe(false)
  })

  it('reads capability from the integrated module set, never from build identity', () => {
    // Same modules, a deliberately unrelated build ID: capability is unchanged.
    const renamedBuild: FlipperInstallation = { ...flipper(createInitialGameState()), buildId: 'build-flipper-synthetic-alternate' }
    expect(flipperSupportsTechnique(renamedBuild, 'AUTH-017')).toBe(true)
    expect(flipperSupportsTechnique(renamedBuild, 'UPD-001')).toBe(false)

    // The canonical build ID with no module actually integrated supports nothing.
    const emptied: FlipperInstallation = { ...flipper(createInitialGameState()), integratedModules: [] }
    expect(flipperSupportsTechnique(emptied, 'AUTH-017')).toBe(false)
  })

  it('represents exactly two concrete Flipper 1.0 builds, each an explicit authored identity', () => {
    expect(FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID).not.toBe(FLIPPER_1_0_CANONICAL_BUILD_ID)
  })
})

describe('Flipper module integration admission', () => {
  it('admits finite work and changes no capability, build, size or artifact before completion', () => {
    const state = withModuleArtifact()
    const before = flipper(state)
    const started = startFlipperModuleIntegration(state, ROLLBACK_ARTIFACT.id)
    if (started.status !== 'started') throw new Error(started.status)

    const process = started.state.process.processes.find(({ id }) => id === started.processId) as FlipperModuleIntegrationProcess
    expect(process).toMatchObject({
      kind: 'flipper_module_integration', status: 'running', label: 'MODULE INTEGRATION',
      executorDeviceId: state.player.localDevice.id,
      hostProductId: FLIPPER_PRODUCT_ID, moduleId: 'rollback', sourceFileId: ROLLBACK_ARTIFACT.id,
      moduleReleaseId: ROLLBACK_MODULE_1_0.releaseId, moduleBuildId: ROLLBACK_MODULE_1_0.buildId,
      moduleSizeBytes: ROLLBACK_MODULE_1_0.sizeBytes,
      workRequired: FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED, ramRequiredMiB: FLIPPER_MODULE_INTEGRATION_RAM_REQUIRED_MIB,
    })

    // Nothing about the host has moved yet.
    expect(flipper(started.state)).toEqual(before)
    expect(flipperSupportsTechnique(flipper(started.state), 'UPD-001')).toBe(false)
    // Partial elapsed work is still not the consequence.
    const partial = advanceGameState(started.state, 1_000)
    expect(partial.process.processes[0].status).toBe('running')
    expect(flipper(partial)).toEqual(before)
  })

  it('refuses an artifact that is not a possessed compatible module, changing nothing', () => {
    const state = withModuleArtifact()
    expect(startFlipperModuleIntegration(state, 'file-does-not-exist')).toEqual({ status: 'module_not_found', state })
    // The seeded NODE Miner package is an ordinary package, not a module input.
    expect(startFlipperModuleIntegration(state, 'file-0002')).toEqual({ status: 'not_module_artifact', state })
    const withoutFlipper: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== FLIPPER_PRODUCT_ID) } } }
    expect(startFlipperModuleIntegration(withoutFlipper, ROLLBACK_ARTIFACT.id)).toEqual({ status: 'host_not_installed', state: withoutFlipper })
  })

  it('never treats a different build carrying the same moduleId as the represented Rollback Module build, changing nothing', () => {
    // Same module identity, a hypothetical different concrete build — never silently equivalent.
    const foreignBuild: SoftwareModuleFile = { ...ROLLBACK_ARTIFACT, id: 'file-module-foreign', buildId: 'build-flipper-rollback-module-9.9-v0' }
    const state = withModuleArtifact(createInitialGameState(), foreignBuild)
    expect(startFlipperModuleIntegration(state, foreignBuild.id)).toEqual({ status: 'unsupported_module_build', state })

    // Same build identity, a hypothetical different release — also never equivalent.
    const foreignRelease: SoftwareModuleFile = { ...ROLLBACK_ARTIFACT, id: 'file-module-foreign-release', releaseId: 'flipper-rollback-module-9.9' }
    const withForeignRelease = withModuleArtifact(createInitialGameState(), foreignRelease)
    expect(startFlipperModuleIntegration(withForeignRelease, foreignRelease.id)).toEqual({ status: 'unsupported_module_build', state: withForeignRelease })

    // The exact currently represented build is unaffected by either rejection.
    expect(startFlipperModuleIntegration(withModuleArtifact(), ROLLBACK_ARTIFACT.id).status).toBe('started')
  })
})

describe('Flipper module integration completion', () => {
  it('transforms the installed Flipper into a different build of the same release, exactly once', () => {
    const state = withModuleArtifact()
    const before = flipper(state)
    const after = integrated(state)
    const host = flipper(after)

    // Same product and same release; a new concrete build that explicitly names its module set.
    expect(host.id).toBe(before.id)
    expect(host.releaseId).toBe(FLIPPER_1_0_RELEASE_ID)
    expect(host.version).toBe(before.version)
    expect(host.buildId).not.toBe(before.buildId)
    expect(host.buildId).toBe(FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID)
    expect(host.integratedModules).toEqual(['credential-access', 'rollback'])
    expect(host.sizeBytes).toBe(FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES + ROLLBACK_MODULE_1_0.sizeBytes)

    // Credential Access is retained, and UPD-001 support is now genuinely present.
    expect(flipperSupportsTechnique(host, 'AUTH-017')).toBe(true)
    expect(flipperSupportsTechnique(host, 'UPD-001')).toBe(true)

    // One product, not two: no module ever becomes InstalledSoftware of its own.
    expect(after.player.localDevice.installedSoftware.map(({ id }) => id)).toEqual(['nodescan', FLIPPER_PRODUCT_ID])

    // Further advancement never re-applies the consequence.
    expect(flipper(advanceGameState(after, 60_000))).toEqual(host)

    const process = after.process.processes.find((candidate) => candidate.kind === 'flipper_module_integration')
    expect(process).toMatchObject({ status: 'completed', result: { status: 'integrated', buildId: host.buildId } })
  })

  it('leaves the source module artifact an ordinary, still-owned filesystem possession', () => {
    const state = withModuleArtifact()
    const after = integrated(state)
    expect(after.player.localDevice.filesystem.files.find(({ id }) => id === ROLLBACK_ARTIFACT.id)).toEqual(ROLLBACK_ARTIFACT)
    expect(after.player.localDevice.filesystem.nextFileId).toBe(state.player.localDevice.filesystem.nextFileId)

    // And deleting it afterwards costs the player nothing already integrated.
    const deleted: GameState = { ...after, player: { ...after.player, localDevice: { ...after.player.localDevice, filesystem: { ...after.player.localDevice.filesystem, files: after.player.localDevice.filesystem.files.filter(({ id }) => id !== ROLLBACK_ARTIFACT.id) } } } }
    expect(flipperSupportsTechnique(flipper(deleted), 'UPD-001')).toBe(true)
  })

  it('never duplicates a module, grows the build again, or fabricates a further build on a repeated attempt', () => {
    const after = integrated(withModuleArtifact())
    const host = flipper(after)

    // Admission refuses the same artifact outright.
    expect(startFlipperModuleIntegration(after, ROLLBACK_ARTIFACT.id)).toEqual({ status: 'already_integrated', state: after })

    // A second concrete copy of the same module is still the same module.
    const copy = copyFilesystemFileToPath(ROLLBACK_ARTIFACT, after.player.localDevice.filesystem, '/home/user/keep/rollback.mod')
    if (copy.status !== 'copied') throw new Error(copy.status)
    const withCopy: GameState = { ...after, player: { ...after.player, localDevice: { ...after.player.localDevice, filesystem: copy.filesystem } } }
    expect(startFlipperModuleIntegration(withCopy, copy.file.id)).toEqual({ status: 'already_integrated', state: withCopy })

    // And a completed Process that was admitted before the module arrived resolves truthfully
    // rather than mutating the host a second time.
    const stale: GameState = {
      ...after,
      process: { ...after.process, processes: [{
        kind: 'flipper_module_integration', id: 'process-stale', label: 'MODULE INTEGRATION', status: 'completed',
        executorDeviceId: after.player.localDevice.id, ramRequiredMiB: FLIPPER_MODULE_INTEGRATION_RAM_REQUIRED_MIB,
        workRequired: FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED, workCompleted: FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED,
        hostProductId: FLIPPER_PRODUCT_ID, moduleId: 'rollback', sourceFileId: ROLLBACK_ARTIFACT.id,
        moduleReleaseId: ROLLBACK_MODULE_1_0.releaseId, moduleBuildId: ROLLBACK_MODULE_1_0.buildId,
        moduleName: ROLLBACK_MODULE_1_0.name, moduleVersion: ROLLBACK_MODULE_1_0.version, moduleSizeBytes: ROLLBACK_MODULE_1_0.sizeBytes,
      }] },
    }
    const resolved = resolveCompletedFlipperModuleIntegrations(stale)
    expect(resolved.process.processes[0]).toMatchObject({ result: { status: 'already_integrated' } })
    expect(flipper(resolved)).toEqual(host)
  })

  it('keeps filesystem copy identity separate from module and build identity', () => {
    const state = withModuleArtifact()
    const copy = copyFilesystemFileToPath(ROLLBACK_ARTIFACT, state.player.localDevice.filesystem, '/home/user/keep/rollback.mod')
    if (copy.status !== 'copied') throw new Error(copy.status)
    // A copy gets its own concrete file identity and location, and nothing else changes.
    expect(copy.file.id).not.toBe(ROLLBACK_ARTIFACT.id)
    expect(copy.file.path).toBe('/home/user/keep/rollback.mod')
    expect({ ...copy.file, id: ROLLBACK_ARTIFACT.id, path: ROLLBACK_ARTIFACT.path }).toEqual(ROLLBACK_ARTIFACT)

    // Integrating the copy produces exactly the build integrating the original would have.
    const withCopy: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: copy.filesystem } } }
    const fromCopy = flipper(integrated(withCopy, copy.file.id))
    const fromOriginal = flipper(integrated(state))
    expect(fromCopy.buildId).toBe(fromOriginal.buildId)
    expect(fromCopy.integratedModules).toEqual(fromOriginal.integratedModules)
    expect(fromCopy.sizeBytes).toBe(fromOriginal.sizeBytes)
  })

  it('exposes only compatible possessed module artifacts to the integration path', () => {
    const state = withModuleArtifact()
    expect(findLocalFlipperModuleArtifacts(state.player.localDevice)).toEqual([ROLLBACK_ARTIFACT])
    expect(findLocalFlipperModuleArtifacts(createInitialGameState().player.localDevice)).toEqual([])
  })
})
