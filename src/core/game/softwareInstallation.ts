import { checkDestinationPlacement, getFilesystemFile } from './filesystem'
import { NODE_OS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID } from './firmwareIdentity'
import { AUTH_GUARD_PRODUCT_ID } from './authGuard'
import { NODE_MINER_EXECUTABLE_SIZE_BYTES, NODE_MINER_INSTALLED_EXECUTABLE_PATH, NODE_MINER_PROGRAM_ID } from './nodeMiner'
import { startProcess } from './processes'
import { resolveActiveRemoteTarget } from './remoteSession'
import { GATE_SSH_PRODUCT_ID } from './serviceImplementations'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import type { ExecutableFile, FilesystemState, FlipperInstallation, GameProcess, GameState, HardwareState, InstalledSoftware, NetworkHost, ProcessState, RuntimeState, SoftwareInstallationProcess, SoftwareInstallationResult } from './types'
import { FLIPPER_EXECUTABLE_SIZE_BYTES, FLIPPER_INSTALLED_EXECUTABLE_PATH, FLIPPER_PRODUCT_ID } from './flipper'
import { RATTLER_EXECUTABLE_SIZE_BYTES, RATTLER_INSTALLED_EXECUTABLE_PATH, RATTLER_PRODUCT_ID, RATTLER_PROGRAM_ID } from './rattler'

export const SOFTWARE_INSTALLATION_WORK_REQUIRED = 600
export const SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB = 256

/**
 * Admission failures that depend only on the concrete package and the target
 * Device, and therefore mean exactly the same thing for the player's local
 * Device and for a represented remote Device.
 */
type SoftwareInstallationAdmissionFailure =
  | 'already_installed' | 'already_installing' | 'invalid_path' | 'package_not_found'
  | 'package_not_file' | 'not_software_package' | 'unrecognized_package_extension' | 'install_path_occupied' | 'incompatible_firmware'

/** Failures that only exist for a remote target, resolved before the package is even considered. */
type RemoteInstallationTargetFailure = 'session_unavailable' | 'target_offline' | 'target_not_installable'

interface StartedInstallation {
  readonly status: 'started'
  readonly processId: string
  readonly productId: string
  readonly name: string
  readonly version: string
  /** Present only when the source package stated a channel. */
  readonly channel?: string
}

export type InstallLocalSoftwarePackageResult =
  | (StartedInstallation & { readonly state: GameState })
  | { readonly status: SoftwareInstallationAdmissionFailure; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

export type InstallRemoteSoftwarePackageResult =
  | (StartedInstallation & { readonly state: GameState })
  | { readonly status: SoftwareInstallationAdmissionFailure | RemoteInstallationTargetFailure; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/** The one concrete path suffix normal software package installation recognizes, case-sensitive under the current path model. */
const RECOGNIZED_PACKAGE_PATH_SUFFIX = '.pkg'

/**
 * Whether an artifact's *current* concrete path is recognized by normal
 * Software Package installation.
 *
 * Recognition is not artifact identity. A `software_package` copied to
 * `/srv/hidden.123` keeps its `productId`, `releaseId`, name, version and
 * size — FileTransfer preserves intrinsic source semantics and the exact
 * destination path the player chose — but installation no longer recognizes
 * that path as a normal installable package. Only the artifact's own path is
 * consulted; nothing about the package is rewritten either way.
 */
export function isRecognizedSoftwarePackagePath(path: string): boolean {
  return path.endsWith(RECOGNIZED_PACKAGE_PATH_SUFFIX)
}

/**
 * Exactly what software installation needs from the Device it installs onto:
 * stable identity, the filesystem the package is resolved from and the
 * managed executable would be written to, the installed-software inventory
 * completion updates, and the hardware/runtime the work executes on.
 *
 * `LocalDeviceState` structurally satisfies this already, and a concretely
 * represented `NetworkHost` is narrowed into it by
 * `resolveRemoteInstallationTarget`. It is deliberately private to this
 * module: it is the shape of one mechanic's target, not a repository-wide
 * Device abstraction.
 */
interface SoftwareInstallationTarget {
  readonly id: string
  readonly filesystem: FilesystemState
  readonly installedSoftware: readonly InstalledSoftware[]
  readonly hardware: HardwareState
  readonly runtime: Pick<RuntimeState, 'baselineCpuLoad' | 'baselineRamUsage'>
  readonly firmware: { readonly id: string }
}

export type SoftwarePackageEligibility =
  | { readonly status: 'installable' }
  | { readonly status: 'installed' | 'installing' | 'unrecognized' }
  | { readonly status: 'incompatible'; readonly requiredFirmware: 'NODE-OS' | 'RACK-OS' }

/** Products whose ordinary installation currently requires NODE-OS specifically. Not a requirements framework — a narrow named list of the concrete products that carry this one rule. */
const NODE_OS_ONLY_PRODUCT_IDS: readonly string[] = ['nodescan', FLIPPER_PRODUCT_ID, RATTLER_PRODUCT_ID]

/**
 * Narrow pure projection shared by admission and package surfaces. NodeScan
 * and Flipper are the concrete products whose ordinary installation
 * currently requires a particular Firmware; this is intentionally not a
 * requirements framework.
 */
export function deriveSoftwarePackageEligibility(
  file: { readonly path: string; readonly productId: string; readonly releaseId: string; readonly buildId: string },
  target: { readonly id: string; readonly firmware: { readonly id: string }; readonly installedSoftware: readonly InstalledSoftware[] },
  process: ProcessState,
): SoftwarePackageEligibility {
  if (!isRecognizedSoftwarePackagePath(file.path)) return { status: 'unrecognized' }
  if (target.installedSoftware.find(({ id }) => id === file.productId)?.buildId === file.buildId) return { status: 'installed' }
  if (process.processes.some((candidate) => candidate.kind === 'software_installation' && candidate.status === 'running' && candidate.executorDeviceId === target.id && candidate.productId === file.productId)) return { status: 'installing' }
  if (NODE_OS_ONLY_PRODUCT_IDS.includes(file.productId) && target.firmware.id !== NODE_OS_FIRMWARE_ID) return { status: 'incompatible', requiredFirmware: 'NODE-OS' }
  if (file.productId === AUTH_GUARD_PRODUCT_ID && target.firmware.id !== RACK_OS_FIRMWARE_ID) return { status: 'incompatible', requiredFirmware: 'RACK-OS' }
  return { status: 'installable' }
}

/** What completion actually mutates on the Device that owns the installation. */
interface InstallationOwnedState {
  readonly filesystem: FilesystemState
  readonly installedSoftware: readonly InstalledSoftware[]
}

type AdmitInstallationResult =
  | (StartedInstallation & { readonly process: ProcessState })
  | { readonly status: SoftwareInstallationAdmissionFailure }
  | { readonly status: 'insufficient_memory'; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * The one shared admission path from a concrete package artifact to real
 * finite installation work on the Device that owns it.
 *
 * Every requirement is resolved against `target` alone — the package is read
 * from the target's filesystem, sameness and duplicate-work checks are scoped
 * to the target's own inventory and running Processes, and RAM admission uses
 * the target's own hardware. Admission validates current world truth exactly
 * once, at this instant, and snapshots only the package facts completion will
 * need; it applies none of installation's consequences immediately.
 */
function admitSoftwareInstallation(process: ProcessState, target: SoftwareInstallationTarget, packagePath: string): AdmitInstallationResult {
  const resolved = getFilesystemFile(target.filesystem, packagePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path' }
  if (resolved.status === 'not_found') return { status: 'package_not_found' }
  if (resolved.status === 'not_file') return { status: 'package_not_file' }
  if (resolved.file.kind !== 'software_package') return { status: 'not_software_package' }
  const packageFile = resolved.file
  const eligibility = deriveSoftwarePackageEligibility(packageFile, target, process)
  if (eligibility.status === 'unrecognized') return { status: 'unrecognized_package_extension' }
  if (eligibility.status === 'installed') return { status: 'already_installed' }
  if (eligibility.status === 'installing') return { status: 'already_installing' }
  if (eligibility.status === 'incompatible') return { status: 'incompatible_firmware' }

  if (packageFile.productId === NODE_MINER_PROGRAM_ID && checkDestinationPlacement(target.filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH) !== 'ok') {
    return { status: 'install_path_occupied' }
  }
  if (packageFile.productId === RATTLER_PRODUCT_ID && checkDestinationPlacement(target.filesystem, RATTLER_INSTALLED_EXECUTABLE_PATH) !== 'ok') {
    return { status: 'install_path_occupied' }
  }

  const started = startProcess(process, target, {
    label: 'SOFTWARE INSTALLATION',
    workRequired: SOFTWARE_INSTALLATION_WORK_REQUIRED,
    ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { status: 'insufficient_memory', requiredMiB: started.requiredMiB, availableMiB: started.availableMiB }

  const processes = started.state.processes.map((candidate) => candidate.id === started.processId && candidate.kind === 'generic'
    ? {
        ...candidate,
        kind: 'software_installation' as const,
        productId: packageFile.productId,
        releaseId: packageFile.releaseId,
        buildId: packageFile.buildId,
        name: packageFile.name,
        version: packageFile.version,
        ...(packageFile.channel ? { channel: packageFile.channel } : {}),
        ...(packageFile.publisher ? { publisher: packageFile.publisher } : {}),
      }
    : candidate)

  return {
    status: 'started',
    processId: started.processId,
    productId: packageFile.productId, name: packageFile.name, version: packageFile.version,
    ...(packageFile.channel ? { channel: packageFile.channel } : {}),
    process: { ...started.state, processes },
  }
}

/**
 * Admit one represented package from the player's current local Device
 * filesystem into a real finite software-installation `GameProcess` executed
 * by that same local Device.
 *
 * InstalledSoftware, the NODE Miner executable, and the source package itself
 * are all untouched until the Process completes (see
 * `resolveCompletedSoftwareInstallations`).
 */
export function installLocalSoftwarePackage(state: GameState, packagePath: string): InstallLocalSoftwarePackageResult {
  const admitted = admitSoftwareInstallation(state.process, state.player.localDevice, packagePath)
  if (admitted.status !== 'started') return { ...admitted, state }
  const { process, ...started } = admitted
  return { ...started, state: { ...state, process } }
}

/**
 * Admit one represented package that already exists on the Device the player
 * is currently operating through RACK-OS into real finite installation work
 * executed by *that* Device.
 *
 * The target is never supplied by presentation: it is resolved only through
 * the canonical operating context, RemoteSession -> DeviceAccess -> target
 * Device, and then narrowed to a Device that actually represents an
 * installable filesystem, software inventory and hardware/runtime. The
 * currently represented USER authority of that access relationship is
 * sufficient in V1 because no finer permission state exists.
 *
 * The Session is admission authority and operating context only. Nothing
 * about the resulting Process references it, so disconnecting ends
 * observation without cancelling Device-owned work already underway.
 */
export function installRemoteSoftwarePackage(state: GameState, packagePath: string): InstallRemoteSoftwarePackageResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  if (!isDeviceNetworkUsable(remote.target.operational)) return { status: 'target_offline', state }
  const target = resolveRemoteInstallationTarget(remote.target)
  if (!target) return { status: 'target_not_installable', state }
  const admitted = admitSoftwareInstallation(state.process, target, packagePath)
  if (admitted.status !== 'started') return { ...admitted, state }
  const { process, ...started } = admitted
  return { ...started, state: { ...state, process } }
}

/**
 * Narrow a represented host into an installation target. A host that owns no
 * software inventory, filesystem or compute resources cannot install software
 * and is not given a fabricated one to make the shapes match.
 *
 * `installedSoftware: []` and an absent `installedSoftware` are different
 * truths: the first is a Device that represents an inventory which happens to
 * be empty, the second a Device that represents no installable software state
 * at all. Only the first can install software.
 */
function resolveRemoteInstallationTarget(host: NetworkHost): SoftwareInstallationTarget | undefined {
  if (!host.filesystem || !host.installedSoftware || !host.hardware || !host.runtime) return undefined
  if (!host.firmware) return undefined
  return { id: host.id, filesystem: host.filesystem, installedSoftware: host.installedSoftware, hardware: host.hardware, runtime: host.runtime, firmware: host.firmware }
}

/**
 * Whether a represented host currently represents the state remote
 * installation needs at all — the same rule `installRemoteSoftwarePackage`
 * admits on, exposed so a surface can present that condition truthfully
 * instead of restating the rule or fabricating an empty inventory to stand in
 * for an absent one.
 */
export function representsInstallableSoftwareState(host: NetworkHost): boolean {
  return resolveRemoteInstallationTarget(host) !== undefined
}

/**
 * Owned by software installation: resolves every completed, unresolved
 * software-installation Process against current world truth exactly once. The
 * `!process.result` guard (the same pattern `resolveCompletedServiceAnalysis`
 * and `resolveCompletedCredentialAccess` use) makes repeated advancement
 * after completion a no-op.
 *
 * The consequence is applied to the Device named by `executorDeviceId` — the
 * Device that actually performed the work — never implicitly to the player's
 * local Device. Stable Device identity is the only authority here: the
 * package path, the address that was connected, the Session, and the current
 * interface are all irrelevant by this point.
 */
export function resolveCompletedSoftwareInstallations(state: GameState): GameState {
  let localDevice = state.player.localDevice
  let hosts = state.world.network.hosts
  let changed = false

  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'software_installation' || process.status !== 'completed' || process.result) return process
    changed = true

    if (process.executorDeviceId === localDevice.id) {
      const applied = applyInstallationCompletion(localDevice, process)
      localDevice = { ...localDevice, filesystem: applied.filesystem, installedSoftware: applied.installedSoftware }
      return { ...process, result: applied.result }
    }

    const host = hosts.find(({ id }) => id === process.executorDeviceId)
    if (!host?.filesystem || !host.installedSoftware) return { ...process, result: { status: 'target_unavailable' as const } }
    const managedGateSsh = process.productId === GATE_SSH_PRODUCT_ID
      ? host.services?.find(({ implementation }) => implementation.productId === GATE_SSH_PRODUCT_ID)
      : undefined
    // GateSSH installation owns a paired consequence on represented servers.
    // If that concrete Service disappeared, apply neither half.
    if (process.productId === GATE_SSH_PRODUCT_ID && !managedGateSsh) return { ...process, result: { status: 'target_unavailable' as const } }
    const applied = applyInstallationCompletion({ filesystem: host.filesystem, installedSoftware: host.installedSoftware }, process)
    const services = managedGateSsh ? host.services!.map((service) => service.id === managedGateSsh.id
      ? { ...service, implementation: { productId: GATE_SSH_PRODUCT_ID, releaseId: process.releaseId, buildId: process.buildId, name: process.name, version: process.version } }
      : service) : host.services
    hosts = hosts.map((candidate) => candidate.id === host.id ? { ...candidate, filesystem: applied.filesystem, installedSoftware: applied.installedSoftware, services } : candidate)
    return { ...process, result: applied.result }
  })

  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    player: localDevice === state.player.localDevice ? state.player : { ...state.player, localDevice },
    world: hosts === state.world.network.hosts ? state.world : { ...state.world, network: { ...state.world.network, hosts } },
  }
}

/**
 * The concrete consequence of one completed installation, applied to the
 * owning Device's own filesystem and installed-software inventory.
 *
 * Ordinary completion creates or replaces InstalledSoftware for the exact
 * snapshotted product and nothing else — no executable, command, capability
 * or Process merely because software is now installed. NODE Miner remains an
 * explicit additional consequence rather than a generic install hook, and its
 * managed executable is created in *this* Device's filesystem: a destination
 * that became occupied after admission is re-checked here too, so it is never
 * partially installed or overwritten.
 */
function applyInstallationCompletion(device: InstallationOwnedState, process: SoftwareInstallationProcess): InstallationOwnedState & { readonly result: SoftwareInstallationResult } {
  const installation = (process.productId === FLIPPER_PRODUCT_ID ? ({
    id: FLIPPER_PRODUCT_ID, releaseId: process.releaseId, buildId: process.buildId, name: process.name, version: process.version,
    ...(process.channel ? { channel: process.channel } : {}), ...(process.publisher ? { publisher: process.publisher } : {}),
    integratedModules: [], sizeBytes: FLIPPER_EXECUTABLE_SIZE_BYTES,
  } satisfies FlipperInstallation) : {
    id: process.productId, releaseId: process.releaseId, buildId: process.buildId, name: process.name, version: process.version,
    ...(process.channel ? { channel: process.channel } : {}),
    ...(process.publisher ? { publisher: process.publisher } : {}),
  }) as InstalledSoftware

  if (process.productId !== NODE_MINER_PROGRAM_ID && process.productId !== FLIPPER_PRODUCT_ID && process.productId !== RATTLER_PRODUCT_ID) {
    return { filesystem: device.filesystem, installedSoftware: applyInstalledSoftwareRelease(device.installedSoftware, installation), result: { status: 'installed' } }
  }

  const executablePath = process.productId === FLIPPER_PRODUCT_ID
    ? FLIPPER_INSTALLED_EXECUTABLE_PATH
    : process.productId === RATTLER_PRODUCT_ID ? RATTLER_INSTALLED_EXECUTABLE_PATH : NODE_MINER_INSTALLED_EXECUTABLE_PATH
  if (checkDestinationPlacement(device.filesystem, executablePath) !== 'ok') {
    return { ...device, result: { status: 'install_path_occupied' } }
  }

  const executable: ExecutableFile = {
    kind: 'executable',
    id: `file-${String(device.filesystem.nextFileId).padStart(4, '0')}`,
    path: executablePath,
    programId: process.productId === RATTLER_PRODUCT_ID ? RATTLER_PROGRAM_ID : process.productId,
    releaseId: process.releaseId,
    buildId: process.buildId,
    name: process.name,
    version: process.version,
    sizeBytes: process.productId === FLIPPER_PRODUCT_ID
      ? FLIPPER_EXECUTABLE_SIZE_BYTES
      : process.productId === RATTLER_PRODUCT_ID ? RATTLER_EXECUTABLE_SIZE_BYTES : NODE_MINER_EXECUTABLE_SIZE_BYTES,
  }
  return {
    filesystem: { nextFileId: device.filesystem.nextFileId + 1, files: [...device.filesystem.files, executable] },
    installedSoftware: applyInstalledSoftwareRelease(device.installedSoftware, installation),
    result: { status: 'installed' },
  }
}

function applyInstalledSoftwareRelease(installedSoftware: readonly InstalledSoftware[], installation: InstalledSoftware): readonly InstalledSoftware[] {
  const index = installedSoftware.findIndex(({ id }) => id === installation.id)
  return index === -1 ? [...installedSoftware, installation] : installedSoftware.map((software, i) => i === index ? installation : software)
}

/**
 * Remote Software Installation is the one concrete operation that currently
 * finishes on an executor Device other than the player's own, so this
 * lifecycle rule belongs to that mechanic and is deliberately scoped to it.
 * It is not a general policy for every future non-local Process kind: what a
 * hypothetical remote Service Analysis, Credential Access or generic Process
 * should do when it ends is that mechanic's decision to make, not this one's.
 */
export function isRemoteSoftwareInstallationCompletion(process: GameProcess, localDeviceId: string): boolean {
  return process.kind === 'software_installation' && process.status === 'completed' && process.executorDeviceId !== localDeviceId
}

/**
 * A remote software installation has already applied its concrete consequence
 * to the Device that performed it (`resolveCompletedSoftwareInstallations`
 * runs earlier at this same boundary), and Recent Activity is deliberately the
 * local Device's own runtime observation: the NODE-OS Activity Monitor observes
 * only `player.localDevice`, and both its CLEAR and REMOVE controls are scoped
 * to that executor.
 *
 * Retaining that finished Process would therefore be canonical history no
 * interface can present or clear — and it would consume a bounded local Recent
 * Activity slot invisibly. It instead leaves the scheduler at the same boundary
 * local work is archived at. A running remote installation stays canonical for
 * exactly as long as it is actually running.
 */
export function releaseRemoteSoftwareInstallationCompletions(state: GameState): GameState {
  const localDeviceId = state.player.localDevice.id
  const processes = state.process.processes.filter((process) => !isRemoteSoftwareInstallationCompletion(process, localDeviceId))
  if (processes.length === state.process.processes.length) return state
  return { ...state, process: { ...state.process, processes } }
}
