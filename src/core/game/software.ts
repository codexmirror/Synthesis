import type { BasicCredentialToolkitInstallation, LocalDeviceState, NodeScanInstallation } from './types'

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
