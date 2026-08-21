import { getFilesystemFile } from './filesystem'
import type { GameState, NodeScanInstallation } from './types'

export type InstallLocalSoftwarePackageResult =
  | { readonly status: 'installed'; readonly state: GameState; readonly productId: 'nodescan'; readonly releaseId: string; readonly name: string; readonly version: string; readonly channel: string; readonly previousReleaseId?: string }
  | { readonly status: 'already_installed' | 'invalid_path' | 'package_not_found' | 'package_not_file' | 'not_software_package' | 'unsupported_package'; readonly state: GameState }

/** Install one represented package from the player's current local Device filesystem. */
export function installLocalSoftwarePackage(state: GameState, packagePath: string): InstallLocalSoftwarePackageResult {
  const resolved = getFilesystemFile(state.player.localDevice.filesystem, packagePath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path', state }
  if (resolved.status === 'not_found') return { status: 'package_not_found', state }
  if (resolved.status === 'not_file') return { status: 'package_not_file', state }
  if (resolved.file.kind !== 'software_package') return { status: 'not_software_package', state }
  if (resolved.file.productId !== 'nodescan') return { status: 'unsupported_package', state }
  const packageFile = resolved.file

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
