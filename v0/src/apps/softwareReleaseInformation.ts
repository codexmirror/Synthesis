import { AUTHORED_SOFTWARE_RELEASES } from '../core/game/softwareReleaseContent'

export interface SoftwareReleaseInformation {
  readonly releaseId: string
  readonly about: string
  readonly capabilities: readonly { readonly label: string; readonly description: string }[]
  readonly changes: readonly string[]
}

/** Thin presentation projection over authored descriptive content. */
export function getSoftwareReleaseInformation(releaseId: string): SoftwareReleaseInformation | undefined {
  const release = AUTHORED_SOFTWARE_RELEASES.find((candidate) => candidate.releaseId === releaseId)
  return release ? { releaseId: release.releaseId, ...release.documentation } : undefined
}
