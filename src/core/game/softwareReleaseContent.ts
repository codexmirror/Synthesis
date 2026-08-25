export interface SoftwareCapabilityDescription {
  readonly label: string
  readonly description: string
}

export interface SoftwareReleaseDocumentation {
  readonly about: string
  readonly capabilities: readonly SoftwareCapabilityDescription[]
  readonly changes: readonly string[]
}

/**
 * Immutable authored facts for one represented software release.
 *
 * This content may author initial concrete state and descriptive presentation,
 * but it is never authoritative for gameplay capability checks.
 */
export interface SoftwareReleaseContent {
  readonly productId: string
  readonly releaseId: string
  readonly name: string
  readonly version: string
  readonly channel?: string
  readonly publisher?: string
  readonly documentation: SoftwareReleaseDocumentation
}

export const NODESCAN_1_0_STANDARD_RELEASE_ID = 'nodescan-1.0-standard' as const
export const NODESCAN_1_1_EXPERIMENTAL_RELEASE_ID = 'nodescan-1.1-experimental' as const
export const BASIC_CREDENTIAL_TOOLKIT_1_0_RELEASE_ID = 'basic-credential-toolkit-1.0' as const
export const NODE_MINER_1_0_RELEASE_ID = 'node-miner-1.0' as const

export const NODESCAN_1_0_STANDARD = {
  productId: 'nodescan', releaseId: NODESCAN_1_0_STANDARD_RELEASE_ID,
  name: 'NodeScan', version: '1.0', channel: 'standard',
  documentation: {
    about: 'Standard NODE-OS network reconnaissance software.',
    capabilities: [
      { label: 'NETWORK SCAN', description: 'Discover represented networks, devices, relationships and exposed Services.' },
      { label: 'SERVICE ANALYSIS', description: 'Investigate known Service endpoints for represented weaknesses.' },
    ],
    changes: ['Initial standard NODE-OS release.'],
  },
} as const satisfies SoftwareReleaseContent

export const NODESCAN_1_1_EXPERIMENTAL = {
  productId: 'nodescan', releaseId: NODESCAN_1_1_EXPERIMENTAL_RELEASE_ID,
  name: 'NodeScan', version: '1.1', channel: 'experimental',
  documentation: {
    about: 'Experimental NodeScan release with extended target inspection.',
    capabilities: [
      { label: 'NETWORK SCAN', description: 'Discover represented networks, devices, relationships and exposed Services.' },
      { label: 'TARGET INSPECT', description: 'Observe represented Device and already-known Service fingerprints.' },
      { label: 'SERVICE ANALYSIS', description: 'Investigate known Service endpoints for represented weaknesses.' },
    ],
    changes: ['Target Inspect', 'Firmware fingerprinting', 'Compute classification', 'Service implementation fingerprinting', 'Authentication observation'],
  },
} as const satisfies SoftwareReleaseContent

export const BASIC_CREDENTIAL_TOOLKIT_1_0 = {
  productId: 'basic-credential-toolkit', releaseId: BASIC_CREDENTIAL_TOOLKIT_1_0_RELEASE_ID,
  name: 'Basic Credential Toolkit', version: '1.0',
  documentation: {
    about: 'Credential-focused offensive toolkit for represented authentication techniques.',
    capabilities: [
      { label: 'CREDENTIAL ACCESS', description: 'Attempt supported known authentication weaknesses.' },
      { label: 'AUTH-017 SUPPORT', description: 'Supports the represented AUTH-017 technique.' },
    ],
    changes: ['Initial release.'],
  },
} as const satisfies SoftwareReleaseContent

export const NODE_MINER_1_0 = {
  productId: 'node-miner', releaseId: NODE_MINER_1_0_RELEASE_ID,
  name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev',
  documentation: {
    about: 'Unofficial NODE mining software that converts Device compute into NODE production.',
    capabilities: [
      { label: 'NODE MINING', description: 'Run continuous compute-driven NODE production.' },
      { label: 'PAYOUT CONFIGURATION', description: 'Run with an explicitly configured NODE payout address.' },
    ],
    changes: ['Initial unofficial release.'],
  },
} as const satisfies SoftwareReleaseContent

/** The complete authored V1 content set, used only for authoring and descriptive projection. */
export const AUTHORED_SOFTWARE_RELEASES: readonly SoftwareReleaseContent[] = [
  NODESCAN_1_0_STANDARD,
  NODESCAN_1_1_EXPERIMENTAL,
  BASIC_CREDENTIAL_TOOLKIT_1_0,
  NODE_MINER_1_0,
]
