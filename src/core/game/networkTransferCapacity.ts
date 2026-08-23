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
  if (!isValidCapacityValue(source.uploadBytesPerSecond)) {
    throw new RangeError('Source upload capacity must be a finite value greater than zero')
  }
  if (!isValidCapacityValue(destination.downloadBytesPerSecond)) {
    throw new RangeError('Destination download capacity must be a finite value greater than zero')
  }
  return Math.min(source.uploadBytesPerSecond, destination.downloadBytesPerSecond)
}
