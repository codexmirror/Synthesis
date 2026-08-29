import type { NetworkTransferCapacity } from './types'

function isValidCapacityValue(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** A represented transfer-capacity value must be finite and greater than zero. */
export function isValidNetworkTransferCapacity(capacity: Readonly<NetworkTransferCapacity>): boolean {
  return isValidCapacityValue(capacity.uploadBytesPerSecond) && isValidCapacityValue(capacity.downloadBytesPerSecond)
}

/**
 * Derive the effective byte rate between two endpoint capacities, interpreted
 * from each Device's own perspective. This is the narrower of the source's
 * upload capacity and the destination's download capacity; it does not
 * consider availability, usage, distance, or any other runtime state.
 */
export function deriveEffectiveTransferRateBytesPerSecond(
  source: Readonly<NetworkTransferCapacity>,
  destination: Readonly<NetworkTransferCapacity>,
): number {
  if (!isValidNetworkTransferCapacity(source)) {
    throw new RangeError('Source capacity must have finite upload and download values greater than zero')
  }
  if (!isValidNetworkTransferCapacity(destination)) {
    throw new RangeError('Destination capacity must have finite upload and download values greater than zero')
  }
  return Math.min(source.uploadBytesPerSecond, destination.downloadBytesPerSecond)
}

/**
 * Derive the effective byte rate for a transfer whose source and
 * destination Devices belong to two different represented LocalNetworks.
 * Every represented bottleneck participates: the source Device's own
 * upload capability, the source Network's external upload capability, the
 * destination Network's external download capability, and the destination
 * Device's own download capability. This deliberately does not apply when
 * both endpoints share one LocalNetwork — a same-Network transfer is
 * decided by `deriveEffectiveTransferRateBytesPerSecond` alone, because
 * LocalNetwork transfer capacity represents external connectivity, not
 * internal LAN/switch fabric.
 */
export function deriveCrossNetworkTransferRateBytesPerSecond(
  sourceDeviceCapacity: Readonly<NetworkTransferCapacity>,
  sourceNetworkCapacity: Readonly<NetworkTransferCapacity>,
  destinationNetworkCapacity: Readonly<NetworkTransferCapacity>,
  destinationDeviceCapacity: Readonly<NetworkTransferCapacity>,
): number {
  if (!isValidNetworkTransferCapacity(sourceDeviceCapacity)) {
    throw new RangeError('Source Device capacity must have finite upload and download values greater than zero')
  }
  if (!isValidNetworkTransferCapacity(sourceNetworkCapacity)) {
    throw new RangeError('Source Network capacity must have finite upload and download values greater than zero')
  }
  if (!isValidNetworkTransferCapacity(destinationNetworkCapacity)) {
    throw new RangeError('Destination Network capacity must have finite upload and download values greater than zero')
  }
  if (!isValidNetworkTransferCapacity(destinationDeviceCapacity)) {
    throw new RangeError('Destination Device capacity must have finite upload and download values greater than zero')
  }
  return Math.min(
    sourceDeviceCapacity.uploadBytesPerSecond,
    sourceNetworkCapacity.uploadBytesPerSecond,
    destinationNetworkCapacity.downloadBytesPerSecond,
    destinationDeviceCapacity.downloadBytesPerSecond,
  )
}
