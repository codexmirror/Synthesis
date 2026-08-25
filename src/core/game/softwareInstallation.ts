import { checkDestinationPlacement, getFilesystemFile } from './filesystem'
import { NODE_MINER_EXECUTABLE_SIZE_BYTES, NODE_MINER_INSTALLED_EXECUTABLE_PATH, NODE_MINER_PROGRAM_ID } from './nodeMiner'
import { startProcess } from './processes'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { ExecutableFile, FilesystemState, GameState, HardwareState, InstalledSoftware, NetworkHost, ProcessState, RuntimeState, SoftwareInstallationProcess, SoftwareInstallationResult } from './types'

export const SOFTWARE_INSTALLATION_WORK_REQUIRED = 600
export const SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB = 256

/**
 * Admission failures that depend only on the concrete package and the target
 * Device, and therefore mean exactly the same thing for the player's local
 * Device and for a represented remote Device.
 */
type SoftwareInstallationAdmissionFailure =
  | 'already_installed' | 'already_installing' | 'invalid_path' | 'package_not_found'
  | 'package_not_file' | 'not_software_package' | 'unrecognized_package_extension' | 'install_path_occupied'

/** Failures that only exist for a remote target, resolved before the package is even considered. */
type RemoteInstallationTargetFailure = 'session_unavailable' | 'target_offline' | 'target_not_installable'

interface StartedInstallation {
  readonly status: 'started'
  readonly processId: string
  readonly productId: string
  readonly name: string
  readonly version: string
  readonly channel: string
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
  if (!isRecognizedSoftwarePackagePath(packageFile.path)) return { status: 'unrecognized_package_extension' }

  const existing = target.installedSoftware.find(({ id }) => id === packageFile.productId)
  if (existing?.releaseId === packageFile.releaseId) return { status: 'already_installed' }

  const alreadyInstalling = process.processes.some((candidate) => candidate.kind === 'software_installation' && candidate.status === 'running' && candidate.executorDeviceId === target.id && candidate.productId === packageFile.productId)
  if (alreadyInstalling) return { status: 'already_installing' }

  if (packageFile.productId === NODE_MINER_PROGRAM_ID && checkDestinationPlacement(target.filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH) !== 'ok') {
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
        name: packageFile.name,
        version: packageFile.version,
        channel: packageFile.channel,
        ...(packageFile.publisher ? { publisher: packageFile.publisher } : {}),
      }
    : candidate)

  return {
    status: 'started',
    processId: started.processId,
    productId: packageFile.productId, name: packageFile.name, version: packageFile.version, channel: packageFile.channel,
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
  if (!remote.target.online) return { status: 'target_offline', state }
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
 */
function resolveRemoteInstallationTarget(host: NetworkHost): SoftwareInstallationTarget | undefined {
  if (!host.filesystem || !host.installedSoftware || !host.hardware || !host.runtime) return undefined
  return { id: host.id, filesystem: host.filesystem, installedSoftware: host.installedSoftware, hardware: host.hardware, runtime: host.runtime }
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
    const applied = applyInstallationCompletion({ filesystem: host.filesystem, installedSoftware: host.installedSoftware }, process)
    hosts = hosts.map((candidate) => candidate.id === host.id ? { ...candidate, filesystem: applied.filesystem, installedSoftware: applied.installedSoftware } : candidate)
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
  const installation: InstalledSoftware = {
    id: process.productId, releaseId: process.releaseId, name: process.name, version: process.version, channel: process.channel,
    ...(process.publisher ? { publisher: process.publisher } : {}),
  }

  if (process.productId !== NODE_MINER_PROGRAM_ID) {
    return { filesystem: device.filesystem, installedSoftware: applyInstalledSoftwareRelease(device.installedSoftware, installation), result: { status: 'installed' } }
  }

  if (checkDestinationPlacement(device.filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH) !== 'ok') {
    return { ...device, result: { status: 'install_path_occupied' } }
  }

  const executable: ExecutableFile = {
    kind: 'executable',
    id: `file-${String(device.filesystem.nextFileId).padStart(4, '0')}`,
    path: NODE_MINER_INSTALLED_EXECUTABLE_PATH,
    programId: NODE_MINER_PROGRAM_ID,
    releaseId: process.releaseId,
    name: process.name,
    version: process.version,
    sizeBytes: NODE_MINER_EXECUTABLE_SIZE_BYTES,
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
