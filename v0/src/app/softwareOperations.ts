import { installLocalSoftwarePackage, installRemoteSoftwarePackage, type InstallLocalSoftwarePackageResult, type InstallRemoteSoftwarePackageResult } from '../core/game/softwareInstallation'
import { removeInstalledSoftware, type RemoveInstalledSoftwareResult } from '../core/game/softwareRemoval'
import type { InstalledSoftware } from '../core/game/types'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createSoftwareActions(accessor: GameStateAccessor) {
  return {
    installLocalSoftwarePackage(path: string): InstallLocalSoftwarePackageResult {
      return commitResult(accessor, installLocalSoftwarePackage(accessor.read(), path))
    },
    installRemoteSoftwarePackage(path: string): InstallRemoteSoftwarePackageResult {
      return commitResult(accessor, installRemoteSoftwarePackage(accessor.read(), path))
    },
    removeInstalledSoftware(productId: InstalledSoftware['id']): RemoveInstalledSoftwareResult {
      return commitResult(accessor, removeInstalledSoftware(accessor.read(), productId))
    },
  }
}
