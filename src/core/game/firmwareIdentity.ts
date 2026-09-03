/**
 * The stable identities of the concrete Firmware releases the world currently
 * represents.
 *
 * A Firmware release's `name` and `version` are mutable presentation
 * attributes (A01); its `id` is what it actually is. Anything that must decide
 * *which* operating environment a Device runs — rather than merely display it
 * — resolves that decision through these identities.
 *
 * VEYRA OS 4.1 and VEYRA OS 4.2 are two distinct releases of the same
 * consumer operating system, each with its own stable identity: installing the
 * newer one replaces which release a Device owns, and never rewrites the older
 * identity into pretending it was always the newer one.
 *
 * This is deliberately four concrete constants, not a Firmware registry,
 * family model, capability table, update catalogue or plugin surface (A16). A
 * fifth represented Firmware release adds a constant here and, where it needs
 * one, a concrete branch at the place that actually cares.
 */
export const NODE_OS_FIRMWARE_ID = 'firmware-node-os-v1'
export const RACK_OS_FIRMWARE_ID = 'firmware-rack-os-v1'
export const VEYRA_OS_4_1_FIRMWARE_ID = 'firmware-veyra-os-v4-1'
export const VEYRA_OS_4_2_FIRMWARE_ID = 'firmware-veyra-os-v4-2'
