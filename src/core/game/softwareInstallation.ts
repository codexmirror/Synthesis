import { checkDestinationPlacement, getFilesystemFile } from './filesystem'
import { NODE_MINER_EXECUTABLE_SIZE_BYTES, NODE_MINER_INSTALLED_EXECUTABLE_PATH, NODE_MINER_PROGRAM_ID } from './nodeMiner'
import { startProcess } from './processes'
import type { ExecutableFile, GameState, InstalledSoftware, SoftwarePackageFile } from './types'

export const SOFTWARE_INSTALLATION_WORK_REQUIRED = 600
export const SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB = 256

export type InstallLocalSoftwarePackageResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string; readonly productId: 'nodescan' | 'node-miner'; readonly name: string; readonly version: string; readonly channel: string }
  | { readonly status: 'already_installed' | 'already_installing' | 'invalid_path' | 'package_not_found' | 'package_not_file' | 'not_software_package' | 'unsupported_package' | 'install_path_occupied'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * Admit one represented package from the player's current local Device
 * filesystem into a real finite software-installation `GameProcess`,
 * sharing the same Device CPU/RAM contention every other local Process
 * uses. Admission validates current world truth exactly once, at this
 * instant, and snapshots only the package facts completion will need;
 * it applies none of installation's consequences immediately.
 * InstalledSoftware, the NODE Miner executable, and the source package
 * itself are all untouched until the Process completes (see
 * `resolveCompletedSoftwareInstallations`).
 */
export function installLocalSoftwarePackage(state: GameState, packagePath: string): InstallLocalSoftwarePackageResult {
  const resolved = getFilesystemFile(state.player.localDevice.filesystem, packagePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path', state }
  if (resolved.status === 'not_found') return { status: 'package_not_found', state }
  if (resolved.status === 'not_file') return { status: 'package_not_file', state }
  if (resolved.file.kind !== 'software_package') return { status: 'not_software_package', state }
  const packageFile = resolved.file
  if (packageFile.productId !== 'nodescan' && packageFile.productId !== NODE_MINER_PROGRAM_ID) return { status: 'unsupported_package', state }

  const device = state.player.localDevice
  const existing = device.installedSoftware.find(({ id }) => id === packageFile.productId)
  if (existing?.releaseId === packageFile.releaseId) return { status: 'already_installed', state }

  const alreadyInstalling = state.process.processes.some((process) => process.kind === 'software_installation' && process.status === 'running' && process.executorDeviceId === device.id && process.productId === packageFile.productId)
  if (alreadyInstalling) return { status: 'already_installing', state }

  if (packageFile.productId === NODE_MINER_PROGRAM_ID && checkDestinationPlacement(device.filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH) !== 'ok') {
    return { status: 'install_path_occupied', state }
  }

  const started = startProcess(state.process, device, {
    label: 'SOFTWARE INSTALLATION',
    workRequired: SOFTWARE_INSTALLATION_WORK_REQUIRED,
    ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }

  const productId: 'nodescan' | 'node-miner' = packageFile.productId
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic'
    ? {
        ...process,
        kind: 'software_installation' as const,
        productId,
        releaseId: packageFile.releaseId,
        name: packageFile.name,
        version: packageFile.version,
        channel: packageFile.channel,
        ...(packageFile.publisher ? { publisher: packageFile.publisher } : {}),
      }
    : process)
  return {
    status: 'started',
    processId: started.processId,
    productId, name: packageFile.name, version: packageFile.version, channel: packageFile.channel,
    state: { ...state, process: { ...started.state, processes } },
  }
}

/**
 * Owned by software installation: resolves every completed, unresolved
 * local software-installation Process against current world truth exactly
 * once, applying the same InstalledSoftware consequence the previous
 * synchronous installer applied — and, for NODE Miner, creating the same
 * concrete executable at its deterministic canonical path. The
 * `!process.result` guard (the same pattern `resolveCompletedServiceAnalysis`
 * and `resolveCompletedCredentialAccess` use) makes repeated advancement
 * after completion a no-op. A destination that became occupied after
 * admission is re-checked here too, so NODE Miner is never partially
 * installed or overwritten; the Process instead carries a truthful failed
 * result.
 */
export function resolveCompletedSoftwareInstallations(state: GameState): GameState {
  const device = state.player.localDevice
  let installedSoftware = device.installedSoftware
  let filesystem = device.filesystem
  let changed = false

  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'software_installation' || process.status !== 'completed' || process.result || process.executorDeviceId !== device.id) return process
    changed = true

    if (process.productId !== NODE_MINER_PROGRAM_ID) {
      installedSoftware = applyInstalledSoftwareRelease(installedSoftware, { id: 'nodescan', releaseId: process.releaseId, name: process.name, version: process.version, channel: process.channel })
      return { ...process, result: { status: 'installed' as const } }
    }

    if (checkDestinationPlacement(filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH) !== 'ok') return { ...process, result: { status: 'install_path_occupied' as const } }

    const executable: ExecutableFile = {
      kind: 'executable',
      id: `file-${String(filesystem.nextFileId).padStart(4, '0')}`,
      path: NODE_MINER_INSTALLED_EXECUTABLE_PATH,
      programId: NODE_MINER_PROGRAM_ID,
      releaseId: process.releaseId,
      name: process.name,
      version: process.version,
      sizeBytes: NODE_MINER_EXECUTABLE_SIZE_BYTES,
    }
    filesystem = { nextFileId: filesystem.nextFileId + 1, files: [...filesystem.files, executable] }
    installedSoftware = applyInstalledSoftwareRelease(installedSoftware, {
      id: 'node-miner', releaseId: process.releaseId, name: process.name, version: process.version, channel: process.channel,
      ...(process.publisher ? { publisher: process.publisher } : {}),
    })
    return { ...process, result: { status: 'installed' as const } }
  })

  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    player: { ...state.player, localDevice: { ...device, installedSoftware, filesystem } },
  }
}

function applyInstalledSoftwareRelease(installedSoftware: readonly InstalledSoftware[], installation: InstalledSoftware): readonly InstalledSoftware[] {
  const index = installedSoftware.findIndex(({ id }) => id === installation.id)
  return index === -1 ? [...installedSoftware, installation] : installedSoftware.map((software, i) => i === index ? installation : software)
}
