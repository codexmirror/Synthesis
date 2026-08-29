/**
 * The stable identities of the concrete Firmware releases the world currently
 * represents.
 *
 * A Firmware release's `name` and `version` are mutable presentation
 * attributes (A01); its `id` is what it actually is. Anything that must decide
 * *which* operating environment a Device runs — rather than merely display it
 * — resolves that decision through these identities.
 *
 * This is deliberately three concrete constants, not a Firmware registry,
 * family model, capability table, or plugin surface (A16). A fourth represented
 * Firmware release adds a constant here and, where it needs one, a concrete
 * branch at the place that actually cares.
 */
export const NODE_OS_FIRMWARE_ID = 'firmware-node-os-v1'
export const RACK_OS_FIRMWARE_ID = 'firmware-rack-os-v1'
export const VEYRA_OS_FIRMWARE_ID = 'firmware-veyra-os-v4-1'
