import type { InstalledSoftware, LocalDeviceState, NodeMinerInstallation, NodeScanInstallation } from './types'
import { NODESCAN_1_0_STANDARD, NODESCAN_1_0_STANDARD_RELEASE_ID, NODESCAN_1_1_EXPERIMENTAL_RELEASE_ID } from './softwareReleaseContent'

export { NODESCAN_1_0_STANDARD_RELEASE_ID } from './softwareReleaseContent'

/** The concrete protected baseline NodeScan installation restored whenever an override release is removed. */
export const NODESCAN_1_0_STANDARD_INSTALLATION: NodeScanInstallation = {
  id: NODESCAN_1_0_STANDARD.productId,
  releaseId: NODESCAN_1_0_STANDARD.releaseId,
  buildId: NODESCAN_1_0_STANDARD.buildId,
  name: NODESCAN_1_0_STANDARD.name,
  version: NODESCAN_1_0_STANDARD.version,
  channel: NODESCAN_1_0_STANDARD.channel,
}

export function findInstalledNodeScan(device: LocalDeviceState): NodeScanInstallation | undefined {
  return device.installedSoftware.find((software): software is NodeScanInstallation => software.id === 'nodescan')
}

/** Whether the installed NodeScan release supplies the player-facing Inspect capability. */
export function nodeScanSupportsInspect(installation: NodeScanInstallation): boolean {
  return installation.releaseId === NODESCAN_1_1_EXPERIMENTAL_RELEASE_ID
}

export function findInstalledNodeMiner(device: { readonly installedSoftware?: readonly InstalledSoftware[] }): NodeMinerInstallation | undefined {
  return device.installedSoftware?.find((software): software is NodeMinerInstallation => software.id === 'node-miner')
}
