import { startProcess } from './processes'
import { FLIPPER_1_0, FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID, FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID, FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID } from './softwareReleaseContent'
import type { ExecutableFile, FlipperInstallation, FlipperModuleId, FlipperModuleIntegrationProcess, GameState, LocalDeviceState, SoftwareModuleFile } from './types'

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

/** Canonical module order; it is the stable order `integratedModules` is stated in. */
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
 * The two concrete standalone module builds currently represented.
 */
export const CREDENTIAL_ACCESS_MODULE_1_0 = {
  moduleId: 'credential-access', hostProductId: FLIPPER_PRODUCT_ID,
  releaseId: 'flipper-credential-access-module-1.0', buildId: 'build-flipper-credential-access-module-1.0-v0',
  name: FLIPPER_MODULE_NAME['credential-access'], version: '1.0', sizeBytes: 1_600_000,
} as const satisfies Omit<SoftwareModuleFile, 'kind' | 'id' | 'path'>

export const ROLLBACK_MODULE_1_0 = {
  moduleId: 'rollback',
  hostProductId: FLIPPER_PRODUCT_ID,
  releaseId: 'flipper-rollback-module-1.0',
  buildId: 'build-flipper-rollback-module-1.0-v0',
  name: FLIPPER_MODULE_NAME.rollback,
  version: '1.0',
  sizeBytes: 2_100_000,
} as const satisfies Omit<SoftwareModuleFile, 'kind' | 'id' | 'path'>

/** Represented size of the distributable module-free Flipper host. */
export const FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES = 4_000_000
export const FLIPPER_INSTALLED_EXECUTABLE_PATH = '/home/user/apps/flipper'
export const FLIPPER_EXECUTABLE_SIZE_BYTES = 4_000_000

export const FLIPPER_MODULE_INTEGRATION_WORK_REQUIRED = 900
export const FLIPPER_MODULE_INTEGRATION_RAM_REQUIRED_MIB = 512

/** The concrete installation produced by the Market package: a module-free host. */
export const FLIPPER_1_0_CANONICAL_INSTALLATION: FlipperInstallation = {
  id: FLIPPER_PRODUCT_ID,
  releaseId: FLIPPER_1_0.releaseId,
  buildId: FLIPPER_1_0.buildId,
  name: FLIPPER_1_0.name,
  version: FLIPPER_1_0.version,
  channel: FLIPPER_1_0.channel,
  publisher: FLIPPER_1_0.publisher,
  integratedModules: [],
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

/** A concrete owned standalone module or integrated Flipper build that can execute a technique. */
export function findLocalTechniqueTool(device: Pick<LocalDeviceState, 'installedSoftware' | 'filesystem'>, vulnerabilityId: string): { readonly toolName: string; readonly moduleName: string } | undefined {
  const flipper = findInstalledFlipper(device)
  const moduleId = FLIPPER_MODULE_IDS.find((id) => FLIPPER_MODULE_TECHNIQUE[id] === vulnerabilityId)
  if (!moduleId) return undefined
  if (flipper?.integratedModules.includes(moduleId)) return { toolName: flipper.name, moduleName: FLIPPER_MODULE_NAME[moduleId] }
  const artifact = findLocalFlipperModuleArtifacts(device).find((file) => file.moduleId === moduleId && isSupportedFlipperModuleArtifact(file))
  return artifact ? { toolName: 'Standalone Module', moduleName: artifact.name } : undefined
}

/** Every currently possessed module artifact on a filesystem, in filesystem order. */
export function findLocalFlipperModuleArtifacts(device: Pick<LocalDeviceState, 'filesystem'>): readonly SoftwareModuleFile[] {
  return device.filesystem.files.filter((file): file is SoftwareModuleFile =>
    file.kind === 'software_module' && file.hostProductId === FLIPPER_PRODUCT_ID)
}

function authoredModuleFor(moduleId: FlipperModuleId): typeof CREDENTIAL_ACCESS_MODULE_1_0 | typeof ROLLBACK_MODULE_1_0 {
  return moduleId === 'credential-access' ? CREDENTIAL_ACCESS_MODULE_1_0 : ROLLBACK_MODULE_1_0
}

/**
 * Whether a concrete module artifact is the exact currently represented
 * build Flipper recognizes for its `moduleId` — the one recognition rule
 * `startFlipperModuleIntegration` admits on and every other consumer
 * (standalone technique lookup, player-facing disclosure) reuses rather than
 * re-deriving. A foreign or hypothetical build carrying the same `moduleId`
 * is never treated as equivalent.
 */
export function isSupportedFlipperModuleArtifact(file: Pick<SoftwareModuleFile, 'moduleId' | 'releaseId' | 'buildId' | 'version' | 'sizeBytes'>): boolean {
  const authored = authoredModuleFor(file.moduleId)
  return file.releaseId === authored.releaseId && file.buildId === authored.buildId
    && file.version === authored.version && file.sizeBytes === authored.sizeBytes
}

/** Every currently possessed module artifact this Flipper actually recognizes as an integration candidate. */
export function findCompatibleLocalFlipperModuleArtifacts(device: Pick<LocalDeviceState, 'filesystem'>): readonly SoftwareModuleFile[] {
  return findLocalFlipperModuleArtifacts(device).filter(isSupportedFlipperModuleArtifact)
}

export type FlipperModuleDisclosureStatus = 'integrated' | 'integrating' | 'available'

/** One player-facing MODULES row: everything the surface may state about one module. */
export interface FlipperModuleDisclosureRow {
  readonly moduleId: FlipperModuleId
  readonly name: string
  readonly technique: string
  readonly status: FlipperModuleDisclosureStatus
  /** Present exactly when this Device possesses the exact compatible artifact — including after integration, since it is never consumed. */
  readonly artifact?: SoftwareModuleFile
}

/**
 * The complete current MODULES disclosure, and nothing beyond it: a module
 * already in `integratedModules`, or one this Device currently possesses an
 * exact compatible artifact for. An authored module the player has neither
 * integrated nor found a compatible artifact for is never listed — this is
 * the one place that decides what MODULES may show, so React never
 * re-derives module compatibility or enumerates the authored catalog itself.
 */
export function deriveFlipperModuleDisclosure(
  flipper: FlipperInstallation,
  device: Pick<LocalDeviceState, 'filesystem'>,
  integrating: FlipperModuleIntegrationProcess | undefined,
): readonly FlipperModuleDisclosureRow[] {
  const compatible = findCompatibleLocalFlipperModuleArtifacts(device)
  return FLIPPER_MODULE_IDS
    .filter((moduleId) => flipper.integratedModules.includes(moduleId) || compatible.some((file) => file.moduleId === moduleId))
    .map((moduleId) => {
      const status: FlipperModuleDisclosureStatus = flipper.integratedModules.includes(moduleId)
        ? 'integrated'
        : integrating?.moduleId === moduleId ? 'integrating' : 'available'
      return {
        moduleId,
        name: FLIPPER_MODULE_NAME[moduleId],
        technique: FLIPPER_MODULE_TECHNIQUE[moduleId],
        status,
        artifact: compatible.find((file) => file.moduleId === moduleId),
      }
    })
}

export function findRunningFlipperModuleIntegration(state: Pick<GameState, 'player' | 'process'>): FlipperModuleIntegrationProcess | undefined {
  return state.process.processes.find((process): process is FlipperModuleIntegrationProcess =>
    process.kind === 'flipper_module_integration' && process.status === 'running' && process.executorDeviceId === state.player.localDevice.id)
}

export type StartFlipperModuleIntegrationResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string; readonly moduleId: FlipperModuleId; readonly moduleName: string }
  | { readonly status: 'module_not_found' | 'not_module_artifact' | 'incompatible_host' | 'host_not_installed' | 'unsupported_host_build' | 'managed_host_artifact_unavailable' | 'unsupported_module_build' | 'already_integrated' | 'already_integrating'; readonly state: GameState }
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
  if (!isSupportedFlipperBuild(flipper)) return { status: 'unsupported_host_build', state }
  const managedHost = findManagedFlipperExecutable(device, flipper)
  if (!managedHost) return { status: 'managed_host_artifact_unavailable', state }

  // V1 recognizes exactly the currently represented concrete build of each
  // artifact-drivable module. A different build carrying the same `moduleId`
  // (a future or hypothetical Rollback Module release, for instance) is not
  // silently treated as equivalent — recognition is by exact release and
  // build identity, the same way ordinary package installation recognizes an
  // artifact's path rather than inferring compatibility from its kind alone.
  if (!isSupportedFlipperModuleArtifact(file)) return { status: 'unsupported_module_build', state }

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
        hostReleaseId: flipper.releaseId,
        hostBuildId: flipper.buildId,
        hostSizeBytes: flipper.sizeBytes,
        hostFileId: managedHost.id,
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
 * The transformation is concrete and applied atomically to the host installation
 * and its admitted managed executable:
 * the release stays Flipper 1.0, the integrated module set gains exactly this
 * module, the represented size grows by exactly the module's own represented
 * size, and the build identity becomes the one explicit build V1 represents
 * for that resulting module set (see `FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID`)
 * — never a value composed at runtime from the module set. The source
 * artifact is untouched — it was an admission input, not fuel.
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
    const managedHost = localDevice.filesystem.files.find((file): file is ExecutableFile => file.id === process.hostFileId && file.kind === 'executable')
    if (!managedHost) return { ...process, result: { status: 'host_unavailable' as const } }
    if (!isSupportedFlipperBuild(flipper) || flipper.releaseId !== process.hostReleaseId || flipper.buildId !== process.hostBuildId || flipper.sizeBytes !== process.hostSizeBytes
      || managedHost.programId !== FLIPPER_PRODUCT_ID || managedHost.releaseId !== process.hostReleaseId
      || managedHost.buildId !== process.hostBuildId || managedHost.sizeBytes !== process.hostSizeBytes) {
      return { ...process, result: { status: 'host_changed' as const } }
    }
    if (flipper.integratedModules.includes(process.moduleId)) return { ...process, result: { status: 'already_integrated' as const } }

    const integratedModules = FLIPPER_MODULE_IDS.filter((moduleId) => moduleId === process.moduleId || flipper.integratedModules.includes(moduleId))
    // V1 represents exactly two concrete Flipper builds. Admission already
    // recognized this artifact as the one currently represented Rollback
    // Module build, so completing its integration always produces the one
    // explicit build authored for that outcome; a hypothetical future module
    // would need its own authored transition rather than a generic rule.
    const buildId = integratedModules.length === 2
      ? FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID
      : process.moduleId === 'credential-access'
        ? FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID
        : FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID
    const integrated: FlipperInstallation = {
      ...flipper,
      buildId,
      integratedModules,
      sizeBytes: flipper.sizeBytes + process.moduleSizeBytes,
    }
    localDevice = {
      ...localDevice,
      installedSoftware: localDevice.installedSoftware.map((software) => software.id === flipper.id ? integrated : software),
      filesystem: { ...localDevice.filesystem, files: localDevice.filesystem.files.map((file) => file.id === managedHost.id
        ? { ...managedHost, buildId: integrated.buildId, sizeBytes: integrated.sizeBytes }
        : file) },
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

function findManagedFlipperExecutable(device: Pick<LocalDeviceState, 'filesystem'>, flipper: FlipperInstallation): ExecutableFile | undefined {
  return device.filesystem.files.find((file): file is ExecutableFile => file.kind === 'executable'
    && file.path === FLIPPER_INSTALLED_EXECUTABLE_PATH && file.programId === FLIPPER_PRODUCT_ID
    && file.releaseId === flipper.releaseId && file.buildId === flipper.buildId && file.sizeBytes === flipper.sizeBytes)
}

function isSupportedFlipperBuild(flipper: FlipperInstallation): boolean {
  const modules = flipper.integratedModules
  if (flipper.releaseId !== FLIPPER_1_0.releaseId) return false
  if (modules.length === 0) return flipper.buildId === FLIPPER_1_0.buildId && flipper.sizeBytes === FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES
  if (modules.length === 1 && modules[0] === 'credential-access') return flipper.buildId === FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID && flipper.sizeBytes === FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES + CREDENTIAL_ACCESS_MODULE_1_0.sizeBytes
  if (modules.length === 1 && modules[0] === 'rollback') return flipper.buildId === FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID && flipper.sizeBytes === FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES + ROLLBACK_MODULE_1_0.sizeBytes
  return modules.length === 2 && modules[0] === 'credential-access' && modules[1] === 'rollback'
    && flipper.buildId === FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID
    && flipper.sizeBytes === FLIPPER_1_0_CANONICAL_BUILD_SIZE_BYTES + CREDENTIAL_ACCESS_MODULE_1_0.sizeBytes + ROLLBACK_MODULE_1_0.sizeBytes
}
