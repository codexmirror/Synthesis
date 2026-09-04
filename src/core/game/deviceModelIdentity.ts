import type { DeviceModel } from './types'

/**
 * Stable identities for the three authored physical products currently in the
 * world. These concrete definitions are intentionally not a catalogue: a
 * Device references one directly, while an unauthored model remains absent.
 *
 * V1 ceilings equal each model's current represented capability. They are
 * descriptive constraints only and deliberately create no upgrade headroom.
 */
export const NODE_1_DEVICE_MODEL: DeviceModel = {
  id: 'device-model-node-1-v0',
  name: 'NODE 1',
  maximumComputeCapacity: 100,
  maximumNetworkCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 2_097_152 },
}

export const RACK_CORE_160_DEVICE_MODEL: DeviceModel = {
  id: 'device-model-rack-core-160-v0',
  name: 'RACK Core 160',
  maximumComputeCapacity: 160,
  maximumNetworkCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 },
}

export const RACK_CORE_120_DEVICE_MODEL: DeviceModel = {
  id: 'device-model-rack-core-120-v0',
  name: 'RACK Core 120',
  maximumComputeCapacity: 120,
  maximumNetworkCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 },
}
