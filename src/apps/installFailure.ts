import type { InstallLocalSoftwarePackageResult, InstallRemoteSoftwarePackageResult } from '../core/game/softwareInstallation'

/**
 * Compact presentation of canonical software-installation admission failures,
 * shared by the local NODE-OS Install Review and the RACK-OS inline remote
 * confirmation.
 *
 * Neither surface revalidates installation itself: each forwards the exact
 * package path to the canonical operation for its target and reports whatever
 * that operation decided. The map is exhaustive over both result unions, so a
 * new core status is a compile error here rather than a silently unlabelled
 * state in a review.
 */
export type SoftwareInstallationFailure =
  | Exclude<InstallLocalSoftwarePackageResult, { status: 'started' }>
  | Exclude<InstallRemoteSoftwarePackageResult, { status: 'started' }>

const INSTALL_FAILURE_LABELS: Record<SoftwareInstallationFailure['status'], string> = {
  already_installed: 'ALREADY INSTALLED', already_installing: 'INSTALLATION ALREADY RUNNING', invalid_path: 'INVALID PATH',
  package_not_found: 'FILE NOT FOUND', package_not_file: 'NOT A FILE', not_software_package: 'NOT A SOFTWARE PACKAGE',
  unrecognized_package_extension: 'UNRECOGNIZED PACKAGE EXTENSION',
  install_path_occupied: 'INSTALLATION PATH OCCUPIED', insufficient_memory: 'INSUFFICIENT MEMORY',
  session_unavailable: 'SESSION UNAVAILABLE', target_offline: 'TARGET UNAVAILABLE',
  target_not_installable: 'TARGET CANNOT INSTALL SOFTWARE',
}

export function describeInstallFailure(result: SoftwareInstallationFailure): string {
  if (result.status === 'insufficient_memory') return `INSUFFICIENT MEMORY · REQUIRES ${result.requiredMiB} MiB`
  return INSTALL_FAILURE_LABELS[result.status]
}
