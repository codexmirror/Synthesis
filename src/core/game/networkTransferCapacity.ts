import type { NetworkTransferCapacity } from './types'

function isValidCapacityValue(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** A represented transfer-capacity value must be finite and greater than zero. */
export function isValidNetworkTransferCapacity(capacity: Readonly<NetworkTransferCapacity>): boolean {
  return isValidCapacityValue(capacity.txBytesPerSecond) && isValidCapacityValue(capacity.rxBytesPerSecond)
}

/**
 * Derive the effective byte rate between two endpoint capacities. This is the
 * narrower of the source's transmit capacity and the destination's receive
 * capacity; it does not consider availability, usage, distance, or any other
 * runtime state.
 */
export function deriveEffectiveTransferRateBytesPerSecond(
  source: Readonly<NetworkTransferCapacity>,
  destination: Readonly<NetworkTransferCapacity>,
): number {
  if (!isValidCapacityValue(source.txBytesPerSecond)) {
    throw new RangeError('Source transmit capacity must be a finite value greater than zero')
  }
  if (!isValidCapacityValue(destination.rxBytesPerSecond)) {
    throw new RangeError('Destination receive capacity must be a finite value greater than zero')
  }
  return Math.min(source.txBytesPerSecond, destination.rxBytesPerSecond)
}
