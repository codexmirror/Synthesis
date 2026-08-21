import type { BasicCredentialToolkitInstallation, LocalDeviceState, NodeScanInstallation } from './types'

export function findInstalledNodeScan(device: LocalDeviceState): NodeScanInstallation | undefined {
  return device.installedSoftware.find((software): software is NodeScanInstallation => software.id === 'nodescan')
}

export function findInstalledBasicCredentialToolkit(device: LocalDeviceState): BasicCredentialToolkitInstallation | undefined {
  return device.installedSoftware.find((software): software is BasicCredentialToolkitInstallation => software.id === 'basic-credential-toolkit')
}
