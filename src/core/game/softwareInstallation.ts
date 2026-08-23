import { checkDestinationPlacement, getFilesystemFile } from './filesystem'
import { NODE_MINER_EXECUTABLE_SIZE_BYTES, NODE_MINER_INSTALLED_EXECUTABLE_PATH, NODE_MINER_PROGRAM_ID } from './nodeMiner'
import { deriveResourceUsage } from './processes'
import type { ExecutableFile, GameState, InstalledSoftware, SoftwareInstallationProcess } from './types'

export const SOFTWARE_INSTALLATION_WORK_REQUIRED = 600
export const SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB = 512

export type InstallLocalSoftwarePackageResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string; readonly productId: 'nodescan' | 'node-miner'; readonly releaseId: string; readonly name: string; readonly version: string; readonly channel: string }
  | { readonly status: 'already_installed' | 'already_installing' | 'invalid_path' | 'package_not_found' | 'package_not_file' | 'not_software_package' | 'unsupported_package' | 'install_path_occupied'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/** Admit installer work from a represented package on the current local Device. */
export function installLocalSoftwarePackage(state: GameState, packagePath: string): InstallLocalSoftwarePackageResult {
  const resolved = getFilesystemFile(state.player.localDevice.filesystem, packagePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path', state }
  if (resolved.status === 'not_found') return { status: 'package_not_found', state }
  if (resolved.status === 'not_file') return { status: 'package_not_file', state }
  if (resolved.file.kind !== 'software_package') return { status: 'not_software_package', state }
  const packageFile = resolved.file
  if (packageFile.productId !== 'nodescan' && packageFile.productId !== NODE_MINER_PROGRAM_ID) return { status: 'unsupported_package', state }
  const existing = state.player.localDevice.installedSoftware.find(({ id }) => id === packageFile.productId)
  if (existing?.releaseId === packageFile.releaseId) return { status: 'already_installed', state }
  if (state.process.processes.some((process) => process.kind === 'software_installation' && process.status === 'running' && process.productId === packageFile.productId)) return { status: 'already_installing', state }
  if (packageFile.productId === NODE_MINER_PROGRAM_ID && checkDestinationPlacement(state.player.localDevice.filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH) !== 'ok') return { status: 'install_path_occupied', state }
  const availableMiB = deriveResourceUsage(state.player.localDevice, state.process).availableRamMiB
  if (SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB > availableMiB) return { status: 'insufficient_memory', state, requiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB, availableMiB }
  const processId = `process-${String(state.process.nextId).padStart(4, '0')}`
  const process: SoftwareInstallationProcess = {
    kind: 'software_installation', id: processId, label: 'SOFTWARE INSTALLATION', executorDeviceId: state.player.localDevice.id,
    status: 'running', workRequired: SOFTWARE_INSTALLATION_WORK_REQUIRED, workCompleted: 0, ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB,
    productId: packageFile.productId, releaseId: packageFile.releaseId, name: packageFile.name, version: packageFile.version, channel: packageFile.channel,
    ...(packageFile.publisher ? { publisher: packageFile.publisher } : {}), sourceFileId: packageFile.id, sourcePath: packageFile.path,
    ...(packageFile.productId === NODE_MINER_PROGRAM_ID ? { destinationPath: NODE_MINER_INSTALLED_EXECUTABLE_PATH } : {}),
    ...(existing ? { previousReleaseId: existing.releaseId } : {}),
  }
  return { status: 'started', state: { ...state, process: { nextId: state.process.nextId + 1, processes: [...state.process.processes, process] } }, processId, productId: process.productId, releaseId: process.releaseId, name: process.name, version: process.version, channel: process.channel }
}

/** Apply a finished installer's snapshotted consequences once, marking its concrete result. */
export function resolveCompletedSoftwareInstallation(state: GameState, process: SoftwareInstallationProcess): { state: GameState; process: SoftwareInstallationProcess } {
  if (process.status !== 'completed' || process.result) return { state, process }
  const filesystem = state.player.localDevice.filesystem
  if (process.destinationPath && checkDestinationPlacement(filesystem, process.destinationPath) !== 'ok') return { state, process: { ...process, result: { status: 'install_path_occupied' } } }
  const installation: InstalledSoftware = process.productId === 'nodescan'
    ? { id: 'nodescan', releaseId: process.releaseId, name: process.name, version: process.version, channel: process.channel }
    : { id: 'node-miner', releaseId: process.releaseId, name: process.name, version: process.version, channel: process.channel, ...(process.publisher ? { publisher: process.publisher } : {}) }
  const installedSoftware = state.player.localDevice.installedSoftware
  const existingIndex = installedSoftware.findIndex(({ id }) => id === process.productId)
  const nextInstalledSoftware = existingIndex < 0 ? [...installedSoftware, installation] : installedSoftware.map((item, index) => index === existingIndex ? installation : item)
  let nextFilesystem = filesystem
  if (process.productId === 'node-miner') {
    const executable: ExecutableFile = { kind: 'executable', id: `file-${String(filesystem.nextFileId).padStart(4, '0')}`, path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, programId: NODE_MINER_PROGRAM_ID, releaseId: process.releaseId, name: process.name, version: process.version, sizeBytes: NODE_MINER_EXECUTABLE_SIZE_BYTES }
    nextFilesystem = { nextFileId: filesystem.nextFileId + 1, files: [...filesystem.files, executable] }
  }
  return {
    state: { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: nextInstalledSoftware, filesystem: nextFilesystem } } },
    process: { ...process, result: { status: 'installed', ...(process.destinationPath ? { executablePath: process.destinationPath } : {}) } },
  }
}
