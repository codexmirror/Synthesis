import type { BasicCredentialToolkitInstallation, LocalDeviceState, NodeMinerInstallation, NodeScanInstallation } from './types'

/** The protected baseline NodeScan release bundled with NODE-OS 1.0. Never removable. */
export const NODESCAN_1_0_STANDARD_RELEASE_ID = 'nodescan-1.0-standard' as const

/** The concrete protected baseline NodeScan installation restored whenever an override release is removed. */
export const NODESCAN_1_0_STANDARD_INSTALLATION: NodeScanInstallation = { id: 'nodescan', releaseId: NODESCAN_1_0_STANDARD_RELEASE_ID, name: 'NodeScan', version: '1.0', channel: 'standard' }

export function findInstalledNodeScan(device: LocalDeviceState): NodeScanInstallation | undefined {
  return device.installedSoftware.find((software): software is NodeScanInstallation => software.id === 'nodescan')
}

/** The installed NodeScan release that legitimately supports Enhanced Inspect. */
export function nodeScanSupportsEnhancedInspect(installation: NodeScanInstallation): boolean {
  return installation.releaseId === 'nodescan-1.1-experimental'
}

export function findInstalledBasicCredentialToolkit(device: LocalDeviceState): BasicCredentialToolkitInstallation | undefined {
  return device.installedSoftware.find((software): software is BasicCredentialToolkitInstallation => software.id === 'basic-credential-toolkit')
}

/** Concrete technique support supplied by Basic Credential Toolkit 1.0. */
export function basicCredentialToolkitSupports(installation: BasicCredentialToolkitInstallation, vulnerabilityId: string): boolean {
  return installation.releaseId === 'basic-credential-toolkit-1.0' && vulnerabilityId === 'AUTH-017'
}

export function findInstalledNodeMiner(device: LocalDeviceState): NodeMinerInstallation | undefined {
  return device.installedSoftware.find((software): software is NodeMinerInstallation => software.id === 'node-miner')
}
