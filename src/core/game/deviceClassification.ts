import type { DeviceClassification, DeviceType } from './types'

/**
 * NodeScan 1.2's classification mapping: the smallest useful set, drawn
 * directly from the currently represented `DeviceType` taxonomy rather than
 * an invented one. A Device with no represented `DeviceType` (or one this
 * slice does not map) classifies as nothing — presentation's own fallback
 * ("UNKNOWN DEVICE") handles that, not this function.
 */
export function classifyDeviceKind(deviceType: DeviceType | undefined): DeviceClassification | undefined {
  switch (deviceType) {
    case 'SERVER': return 'SERVER'
    case 'PHONE': return 'MOBILE DEVICE'
    case 'NODE': return 'WORKSTATION'
    default: return undefined
  }
}
