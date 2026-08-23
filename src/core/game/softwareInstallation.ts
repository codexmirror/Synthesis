import { checkDestinationPlacement, getFilesystemFile } from './filesystem'
import { NODE_MINER_EXECUTABLE_SIZE_BYTES, NODE_MINER_INSTALLED_EXECUTABLE_PATH, NODE_MINER_PROGRAM_ID } from './nodeMiner'
import type { ExecutableFile, GameState, NodeScanInstallation, SoftwarePackageFile } from './types'

export type InstallLocalSoftwarePackageResult =
  | { readonly status: 'installed'; readonly state: GameState; readonly productId: 'nodescan'; readonly releaseId: string; readonly name: string; readonly version: string; readonly channel: string; readonly previousReleaseId?: string }
  | { readonly status: 'installed'; readonly state: GameState; readonly productId: 'node-miner'; readonly releaseId: string; readonly name: string; readonly version: string; readonly executablePath: string; readonly previousReleaseId?: string }
  | { readonly status: 'already_installed' | 'invalid_path' | 'package_not_found' | 'package_not_file' | 'not_software_package' | 'unsupported_package' | 'install_path_occupied'; readonly state: GameState }

/** Install one represented package from the player's current local Device filesystem. */
export function installLocalSoftwarePackage(state: GameState, packagePath: string): InstallLocalSoftwarePackageResult {
  const resolved = getFilesystemFile(state.player.localDevice.filesystem, packagePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path', state }
  if (resolved.status === 'not_found') return { status: 'package_not_found', state }
  if (resolved.status === 'not_file') return { status: 'package_not_file', state }
  if (resolved.file.kind !== 'software_package') return { status: 'not_software_package', state }
  const packageFile = resolved.file

  if (packageFile.productId === 'nodescan') return installNodeScanPackage(state, packageFile)
  if (packageFile.productId === NODE_MINER_PROGRAM_ID) return installNodeMinerPackage(state, packageFile)
  return { status: 'unsupported_package', state }
}

function installNodeScanPackage(state: GameState, packageFile: SoftwarePackageFile): InstallLocalSoftwarePackageResult {
  const installedSoftware = state.player.localDevice.installedSoftware
  const existingIndex = installedSoftware.findIndex(({ id }) => id === packageFile.productId)
  const existing = existingIndex === -1 ? undefined : installedSoftware[existingIndex]
  if (existing?.releaseId === packageFile.releaseId) return { status: 'already_installed', state }

  const installation: NodeScanInstallation = {
    id: 'nodescan',
    releaseId: packageFile.releaseId,
    name: packageFile.name,
    version: packageFile.version,
    channel: packageFile.channel,
  }
  const nextInstalledSoftware = existingIndex === -1
    ? [...installedSoftware, installation]
    : installedSoftware.map((software, index) => index === existingIndex ? installation : software)
  const nextState: GameState = {
    ...state,
    player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: nextInstalledSoftware } },
  }
  return { status: 'installed', state: nextState, productId: 'nodescan', releaseId: installation.releaseId, name: installation.name, version: installation.version, channel: installation.channel, ...(existing ? { previousReleaseId: existing.releaseId } : {}) }
}

/**
 * Installing NODE Miner has two truthful consequences: Device-owned
 * installed-software state records the release, and a concrete NODE Miner
 * `ExecutableFile` is created at the deterministic installed-program path.
 * The package artifact itself is left untouched. Installation never starts
 * a Process — RUN remains a separate later admission step over the
 * resulting executable.
 */
function installNodeMinerPackage(state: GameState, packageFile: SoftwarePackageFile): InstallLocalSoftwarePackageResult {
  const filesystem = state.player.localDevice.filesystem
  const installedSoftware = state.player.localDevice.installedSoftware
  const existingIndex = installedSoftware.findIndex(({ id }) => id === packageFile.productId)
  const existing = existingIndex === -1 ? undefined : installedSoftware[existingIndex]
  if (existing?.releaseId === packageFile.releaseId) return { status: 'already_installed', state }

  const placement = checkDestinationPlacement(filesystem, NODE_MINER_INSTALLED_EXECUTABLE_PATH)
  if (placement !== 'ok') return { status: 'install_path_occupied', state }

  const executable: ExecutableFile = {
    kind: 'executable',
    id: `file-${String(filesystem.nextFileId).padStart(4, '0')}`,
    path: NODE_MINER_INSTALLED_EXECUTABLE_PATH,
    programId: NODE_MINER_PROGRAM_ID,
    releaseId: packageFile.releaseId,
    name: packageFile.name,
    version: packageFile.version,
    sizeBytes: NODE_MINER_EXECUTABLE_SIZE_BYTES,
  }

  const installation = { id: 'node-miner' as const, releaseId: packageFile.releaseId, name: packageFile.name, version: packageFile.version }
  const nextInstalledSoftware = existingIndex === -1
    ? [...installedSoftware, installation]
    : installedSoftware.map((software, index) => index === existingIndex ? installation : software)

  const nextState: GameState = {
    ...state,
    player: {
      ...state.player,
      localDevice: {
        ...state.player.localDevice,
        installedSoftware: nextInstalledSoftware,
        filesystem: { nextFileId: filesystem.nextFileId + 1, files: [...filesystem.files, executable] },
      },
    },
  }
  return { status: 'installed', state: nextState, productId: 'node-miner', releaseId: installation.releaseId, name: installation.name, version: installation.version, executablePath: executable.path, ...(existing ? { previousReleaseId: existing.releaseId } : {}) }
}
