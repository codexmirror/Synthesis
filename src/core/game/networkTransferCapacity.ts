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
