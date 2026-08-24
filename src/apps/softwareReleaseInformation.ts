export interface SoftwareReleaseInformation {
  readonly releaseId: string
  readonly about: string
  readonly capabilities: readonly { readonly label: string; readonly description: string }[]
  readonly changes: readonly string[]
}

const releases: Record<string, SoftwareReleaseInformation> = {
  'nodescan-1.0-standard': {
    releaseId: 'nodescan-1.0-standard',
    about: 'Standard NODE-OS network reconnaissance software.',
    capabilities: [
      { label: 'NETWORK SCAN', description: 'Discover represented networks, devices, relationships and exposed Services.' },
      { label: 'SERVICE ANALYSIS', description: 'Investigate known Service endpoints for represented weaknesses.' },
    ],
    changes: ['Initial standard NODE-OS release.'],
  },
  'nodescan-1.1-experimental': {
    releaseId: 'nodescan-1.1-experimental',
    about: 'Experimental NodeScan release with extended target inspection.',
    capabilities: [
      { label: 'NETWORK SCAN', description: 'Discover represented networks, devices, relationships and exposed Services.' },
      { label: 'TARGET INSPECT', description: 'Observe represented Device and already-known Service fingerprints.' },
      { label: 'SERVICE ANALYSIS', description: 'Investigate known Service endpoints for represented weaknesses.' },
    ],
    changes: ['Target Inspect', 'Firmware fingerprinting', 'Compute classification', 'Service implementation fingerprinting', 'Authentication observation'],
  },
  'basic-credential-toolkit-1.0': {
    releaseId: 'basic-credential-toolkit-1.0',
    about: 'Credential-focused offensive toolkit for represented authentication techniques.',
    capabilities: [
      { label: 'CREDENTIAL ACCESS', description: 'Attempt supported known authentication weaknesses.' },
      { label: 'AUTH-017 SUPPORT', description: 'Supports the represented AUTH-017 technique.' },
    ],
    changes: ['Initial release.'],
  },
  'node-miner-1.0': {
    releaseId: 'node-miner-1.0',
    about: 'Unofficial NODE mining software that converts Device compute into NODE production.',
    capabilities: [
      { label: 'NODE MINING', description: 'Run continuous compute-driven NODE production.' },
      { label: 'PAYOUT CONFIGURATION', description: 'Run with an explicitly configured NODE payout address.' },
    ],
    changes: ['Initial unofficial release.'],
  },
}

/** Descriptive player-facing copy only; gameplay must not branch on this map. */
export function getSoftwareReleaseInformation(releaseId: string): SoftwareReleaseInformation | undefined {
  return releases[releaseId]
}
