import { startProcess } from './processes'
import { FLIPPER_1_0, FLIPPER_1_0_RELEASE_ID } from './softwareReleaseContent'
import type { FlipperInstallation, FlipperModuleId, FlipperModuleIntegrationProcess, GameState, LocalDeviceState, SoftwareModuleFile } from './types'

/**
 * Flipper is the player's one extensible offensive/access tool, and the only
 * installed software product that supplies offensive technique support.
 *
 * A module is a concrete technique Flipper can integrate and then execute. It
 * is deliberately not a plugin framework, not a capability engine and not
 * software of its own: exactly two concrete modules exist, each supporting
 * exactly one already-represented technique, and integration is one concrete
 * mechanic rather than a general composition system.
 */
export const FLIPPER_PRODUCT_ID = 'flipper' as const

/** Canonical module order; it is the stable order integrated modules and derived build identity are stated in. */
export const FLIPPER_MODULE_IDS: readonly FlipperModuleId[] = ['credential-access', 'rollback']

/**
 * The one represented technique each concrete module supplies.
 *
 * These are the existing weakness identifiers owned by the access and service
 * systems. Possessing or integrating a module never discovers, fabricates or
 * implies Knowledge of them.
 */
export const FLIPPER_MODULE_TECHNIQUE: Readonly<Record<FlipperModuleId, string>> = {
  'credential-access': 'AUTH-017',
  rollback: 'UPD-001',
}

export const FLIPPER_MODULE_NAME: Readonly<Record<FlipperModuleId, string>> = {
  'credential-access': 'Credential Access Module',
  rollback: 'Rollback Module',
}

/**
 * The one concrete module artifact currently represented in the world.
 *
 * The Credential Access Module deliberately has no authored artifact: it is
 * already integrated into the canonical Flipper build, and no represented
 * acquisition path distributes it separately. Authoring one would be inventing
 * world state nothing produces.
 */
export const ROLLBACK_MODULE_1_0 = {
  moduleId: 'rollback',
  hostProductId: FLIPPER_PRODUCT_ID,
  releaseId: 'flipper-rollback-module-1.0',
  buildId: 'build-flipper-rollback-module-1.0-v0',
  name: FLIPPER_MODULE_NAME.rollback,
  version: '1.0',
  sizeBytes: 2_100_000,
} as const satisfies Omit<SoftwareModuleFile, 'kind' | 'id' | 'path'>

/** Represented size of the canonical Flipper 1.0 build, which integrates the Credential Access Module. */
export const FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES = 5_600_000

export const FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED = 900
export const FLIPPER_MODULE_INTEGRATION_RAM_REQUIRED_MIB = 512

/**
 * Stable identity of the concrete Flipper build that integrates exactly this
 * set of modules.
 *
 * It is derived rather than authored so that the same integrated module set
 * always names the same build: re-integrating a module Flipper already
 * contains cannot fabricate a further build. It records *which* build this is;
 * it is never read as capability. `flipperSupportsTechnique` reads
 * `integratedModules` alone.
 */
export function deriveFlipperBuildId(modules: readonly FlipperModuleId[]): string {
  const ordered = FLIPPER_MODULE_IDS.filter((moduleId) => modules.includes(moduleId))
  return `build-${FLIPPER_1_0_RELEASE_ID}-${ordered.join('+')}`
}

/** The concrete initial Flipper installation: release 1.0, canonical build, Credential Access integrated. */
export const FLIPPER_1_0_CANONICAL_INSTALLATION: FlipperInstallation = {
  id: FLIPPER_PRODUCT_ID,
  releaseId: FLIPPER_1_0.releaseId,
  buildId: FLIPPER_1_0.buildId,
  name: FLIPPER_1_0.name,
  version: FLIPPER_1_0.version,
  channel: FLIPPER_1_0.channel,
  publisher: FLIPPER_1_0.publisher,
  integratedModules: ['credential-access'],
  sizeBytes: FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES,
}

export function findInstalledFlipper(device: Pick<LocalDeviceState, 'installedSoftware'>): FlipperInstallation | undefined {
  return device.installedSoftware.find((software): software is FlipperInstallation => software.id === FLIPPER_PRODUCT_ID)
}

/**
 * Concrete technique support supplied by the modules this Flipper build
 * actually integrates.
 *
 * Capability is read from `integratedModules` alone. A build identity that
 * differs from the canonical one proves nothing on its own, and is never
 * consulted here.
 */
export function flipperSupportsTechnique(installation: FlipperInstallation, vulnerabilityId: string): boolean {
  return installation.integratedModules.some((moduleId) => FLIPPER_MODULE_TECHNIQUE[moduleId] === vulnerabilityId)
}

/** Every currently possessed module artifact on a filesystem, in filesystem order. */
export function findLocalFlipperModuleArtifacts(device: Pick<LocalDeviceState, 'filesystem'>): readonly SoftwareModuleFile[] {
  return device.filesystem.files.filter((file): file is SoftwareModuleFile =>
    file.kind === 'software_module' && file.hostProductId === FLIPPER_PRODUCT_ID)
}

export function findRunningFlipperModuleIntegration(state: Pick<GameState, 'player' | 'process'>): FlipperModuleIntegrationProcess | undefined {
  return state.process.processes.find((process): process is FlipperModuleIntegrationProcess =>
    process.kind === 'flipper_module_integration' && process.status === 'running' && process.executorDeviceId === state.player.localDevice.id)
}

export type StartFlipperModuleIntegrationResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string; readonly moduleId: FlipperModuleId; readonly moduleName: string }
  | { readonly status: 'module_not_found' | 'not_module_artifact' | 'incompatible_host' | 'host_not_installed' | 'already_integrated' | 'already_integrating'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * Admit integration of one concrete locally possessed module artifact into the
 * installed Flipper as real finite work on the local Device's own scheduler.
 *
 * Nothing is granted here: Flipper keeps its current build, its current size
 * and its current integrated modules until the Process completes. Admission
 * validates current truth exactly once, snapshots only the module facts
 * completion needs, and never consumes or alters the source artifact.
 */
export function startFlipperModuleIntegration(state: GameState, moduleFileId: string): StartFlipperModuleIntegrationResult {
  const device = state.player.localDevice
  const file = device.filesystem.files.find(({ id }) => id === moduleFileId)
  if (!file) return { status: 'module_not_found', state }
  if (file.kind !== 'software_module') return { status: 'not_module_artifact', state }
  if (file.hostProductId !== FLIPPER_PRODUCT_ID) return { status: 'incompatible_host', state }

  const flipper = findInstalledFlipper(device)
  if (!flipper) return { status: 'host_not_installed', state }
  if (flipper.integratedModules.includes(file.moduleId)) return { status: 'already_integrated', state }
  if (state.process.processes.some((process) => process.kind === 'flipper_module_integration' && process.status === 'running'
    && process.executorDeviceId === device.id && process.moduleId === file.moduleId)) {
    return { status: 'already_integrating', state }
  }

  const started = startProcess(state.process, device, {
    label: 'MODULE INTEGRATION',
    workRequired: FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED,
    ramRequiredMiB: FLIPPER_MODULE_INTEGRATION_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }

  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic'
    ? {
        ...process,
        kind: 'flipper_module_integration' as const,
        hostProductId: FLIPPER_PRODUCT_ID,
        moduleId: file.moduleId,
        moduleReleaseId: file.releaseId,
        moduleBuildId: file.buildId,
        moduleName: file.name,
        moduleVersion: file.version,
        moduleSizeBytes: file.sizeBytes,
        sourceFileId: file.id,
      }
    : process)

  return {
    status: 'started',
    processId: started.processId,
    moduleId: file.moduleId,
    moduleName: file.name,
    state: { ...state, process: { ...started.state, processes } },
  }
}

/**
 * Owned by Flipper: resolves every completed, unresolved module-integration
 * Process exactly once, guarded by the same `!process.result` pattern the
 * other completion resolvers use, so repeated advancement after completion
 * never re-applies a consequence.
 *
 * The transformation is concrete and applied to the host installation alone:
 * the release stays Flipper 1.0, the integrated module set gains exactly this
 * module, the represented size grows by exactly the module's own represented
 * size, and the build identity becomes the one that names that new module set.
 * The source artifact is untouched — it was an admission input, not fuel.
 */
export function resolveCompletedFlipperModuleIntegrations(state: GameState): GameState {
  let localDevice = state.player.localDevice
  let changed = false

  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'flipper_module_integration' || process.status !== 'completed' || process.result) return process
    changed = true

    // Integration currently only ever runs on the player's own Device, so a
    // Process whose executor is not that Device has no host to transform.
    const flipper = process.executorDeviceId === localDevice.id ? findInstalledFlipper(localDevice) : undefined
    if (!flipper) return { ...process, result: { status: 'host_unavailable' as const } }
    if (flipper.integratedModules.includes(process.moduleId)) return { ...process, result: { status: 'already_integrated' as const } }

    const integratedModules = FLIPPER_MODULE_IDS.filter((moduleId) => moduleId === process.moduleId || flipper.integratedModules.includes(moduleId))
    const integrated: FlipperInstallation = {
      ...flipper,
      buildId: deriveFlipperBuildId(integratedModules),
      integratedModules,
      sizeBytes: flipper.sizeBytes + process.moduleSizeBytes,
    }
    localDevice = {
      ...localDevice,
      installedSoftware: localDevice.installedSoftware.map((software) => software.id === flipper.id ? integrated : software),
    }
    return { ...process, result: { status: 'integrated' as const, buildId: integrated.buildId } }
  })

  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    player: localDevice === state.player.localDevice ? state.player : { ...state.player, localDevice },
  }
}
