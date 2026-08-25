import type { InstallLocalSoftwarePackageResult } from '../core/game/softwareInstallation'

/**
 * Compact presentation of canonical software-installation admission failures.
 *
 * Install Review does not revalidate installation itself: it forwards the
 * exact package path to `installLocalSoftwarePackage` and reports whatever
 * that operation decided. The map is exhaustive over the result union, so a
 * new core status is a compile error here rather than a silently unlabelled
 * state in the review.
 */
export type InstallLocalSoftwarePackageFailure = Exclude<InstallLocalSoftwarePackageResult, { status: 'started' }>

const INSTALL_FAILURE_LABELS: Record<InstallLocalSoftwarePackageFailure['status'], string> = {
  already_installed: 'ALREADY INSTALLED', already_installing: 'INSTALLATION ALREADY RUNNING', invalid_path: 'INVALID PATH',
  package_not_found: 'FILE NOT FOUND', package_not_file: 'NOT A FILE', not_software_package: 'NOT A SOFTWARE PACKAGE',
  unrecognized_package_extension: 'UNRECOGNIZED PACKAGE EXTENSION',
  install_path_occupied: 'INSTALLATION PATH OCCUPIED', insufficient_memory: 'INSUFFICIENT MEMORY',
}

export function describeInstallFailure(result: InstallLocalSoftwarePackageFailure): string {
  if (result.status === 'insufficient_memory') return `INSUFFICIENT MEMORY · REQUIRES ${result.requiredMiB} MiB`
  return INSTALL_FAILURE_LABELS[result.status]
}
