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
  /** Stable identity of this release's currently authored canonical build. */
  readonly buildId: string
  readonly name: string
  readonly version: string
  readonly channel?: string
  readonly publisher?: string
  readonly documentation: SoftwareReleaseDocumentation
}

export const NODESCAN_1_0_STANDARD_RELEASE_ID = 'nodescan-1.0-standard' as const
export const NODESCAN_1_1_EXPERIMENTAL_RELEASE_ID = 'nodescan-1.1-experimental' as const
export const FLIPPER_1_0_RELEASE_ID = 'flipper-1.0' as const
export const NODE_MINER_1_0_RELEASE_ID = 'node-miner-1.0' as const

export const NODESCAN_1_0_STANDARD_BUILD_ID = 'build-nodescan-1.0-standard-v0' as const
export const NODESCAN_1_1_EXPERIMENTAL_BUILD_ID = 'build-nodescan-1.1-experimental-v0' as const
/** The distributable Flipper 1.0 host before any standalone modules are integrated. */
export const FLIPPER_1_0_CANONICAL_BUILD_ID = 'build-flipper-1.0-base' as const
export const FLIPPER_1_0_CREDENTIAL_ACCESS_INTEGRATED_BUILD_ID = 'build-flipper-1.0-credential-access' as const
export const FLIPPER_1_0_ROLLBACK_ONLY_INTEGRATED_BUILD_ID = 'build-flipper-1.0-rollback' as const
/**
 * The one other concrete Flipper 1.0 build V1 represents: the canonical build
 * with the Rollback Module integrated. `flipper.ts` produces it only when
 * completing integration of the currently represented Rollback Module 1.0
 * build; it is an explicit authored identity, not a value derived from module
 * IDs at runtime.
 */
export const FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID = 'build-flipper-1.0-credential-access-rollback' as const
export const NODE_MINER_1_0_BUILD_ID = 'build-node-miner-1.0-v0' as const
export const RATTLER_1_0_BUILD_ID = 'build-rattler-1.0-v0' as const

export const NODESCAN_1_0_STANDARD = {
  productId: 'nodescan', releaseId: NODESCAN_1_0_STANDARD_RELEASE_ID, buildId: NODESCAN_1_0_STANDARD_BUILD_ID,
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
  productId: 'nodescan', releaseId: NODESCAN_1_1_EXPERIMENTAL_RELEASE_ID, buildId: NODESCAN_1_1_EXPERIMENTAL_BUILD_ID,
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

export const FLIPPER_1_0 = {
  productId: 'flipper', releaseId: FLIPPER_1_0_RELEASE_ID, buildId: FLIPPER_1_0_CANONICAL_BUILD_ID,
  name: 'Flipper', version: '1.0', channel: 'standard', publisher: 'NODE',
  documentation: {
    about: 'Extensible NODE offensive and access tool. What it can execute is exactly the set of modules the installed build integrates.',
    capabilities: [
      { label: 'MODULE INTEGRATION', description: 'Integrate a locally possessed module artifact, producing a new build of this release.' },
      { label: 'INTEGRATED TECHNIQUES', description: 'Execute the represented techniques the integrated modules supply, against weaknesses already known.' },
    ],
    changes: ['Initial NODE release.', 'Standalone module integration.'],
  },
} as const satisfies SoftwareReleaseContent

export const NODE_MINER_1_0 = {
  productId: 'node-miner', releaseId: NODE_MINER_1_0_RELEASE_ID, buildId: NODE_MINER_1_0_BUILD_ID,
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

export const RATTLER_1_0 = {
  productId: 'rattler', releaseId: 'rattler-1.0', buildId: RATTLER_1_0_BUILD_ID,
  name: 'RATTLER', version: '1.0', channel: 'unofficial', publisher: 'NULL//WORKS',
  documentation: {
    about: 'Unofficial offensive software for creating target-bound payload artifacts for later deployment.',
    capabilities: [{ label: 'PAYLOAD CREATION', description: 'Create a deployable artifact bound to one legitimately known target Device.' }],
    changes: ['Initial unofficial release.', 'Target-bound payload artifact creation.'],
  },
} as const satisfies SoftwareReleaseContent

/** The complete authored V1 content set, used only for authoring and descriptive projection. */
export const AUTHORED_SOFTWARE_RELEASES: readonly SoftwareReleaseContent[] = [
  NODESCAN_1_0_STANDARD,
  NODESCAN_1_1_EXPERIMENTAL,
  FLIPPER_1_0,
  NODE_MINER_1_0,
  RATTLER_1_0,
]
