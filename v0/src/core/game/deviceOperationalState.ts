import type { DeviceOperationalState } from './types'

/**
 * The one canonical usability derivation shared across every Network,
 * Access, and Transfer mechanic that used to check `NetworkHost.online` or
 * `RuntimeState.networkStatus`. A Device is usable for ordinary network
 * interaction only while it is both `RUNNING` and `CONNECTED`; a Device
 * mid-reboot or mid-reconnect is truthfully unusable without either
 * dimension needing to know about the other.
 */
export function isDeviceNetworkUsable(operational: DeviceOperationalState): boolean {
  return operational.lifecycle === 'RUNNING' && operational.connectivity === 'CONNECTED'
}

/**
 * Presentation label for a Device's own network status, preserving the
 * existing ONLINE/OFFLINE surface vocabulary (System, Home, StatusBar,
 * SystemBar, terminal `status`) without exposing the underlying two-
 * dimensional truth to those surfaces.
 */
export function deriveNetworkStatusLabel(operational: DeviceOperationalState): 'ONLINE' | 'OFFLINE' {
  return isDeviceNetworkUsable(operational) ? 'ONLINE' : 'OFFLINE'
}
