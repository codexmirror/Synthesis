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
 * identity into pretending it was always the newer one. RACK-OS 1.0 and
 * RACK-OS 1.1 Business are the same relationship for the represented server
 * operating system: 1.0 remains exactly the release it always was, and the
 * newer one is its own separate release rather than a renamed 1.0.
 *
 * This is deliberately five concrete constants, not a Firmware registry,
 * family model, edition matrix, capability table, update catalogue or plugin
 * surface (A16). A sixth represented Firmware release adds a constant here
 * and, where it needs one, a concrete branch at the place that actually cares.
 */
export const NODE_OS_FIRMWARE_ID = 'firmware-node-os-v1'
export const RACK_OS_FIRMWARE_ID = 'firmware-rack-os-v1'
export const RACK_OS_1_1_BUSINESS_FIRMWARE_ID = 'firmware-rack-os-v1-1-business'
export const VEYRA_OS_4_1_FIRMWARE_ID = 'firmware-veyra-os-v4-1'
export const VEYRA_OS_4_2_FIRMWARE_ID = 'firmware-veyra-os-v4-2'

/**
 * Whether a Firmware identity is one of the two represented RACK-OS releases.
 *
 * The two releases present very differently, but they are the same operating
 * system: anything asking "is this a RACK-OS Device" — the Shell choosing an
 * operating surface, a package stating which Firmware it requires — must
 * answer from these stable identities and never from the mutable display name
 * or version (A01). It is deliberately one explicit disjunction over the two
 * concrete releases, not a Firmware family registry.
 */
export function isRackOsFirmwareId(firmwareId: string | undefined): boolean {
  return firmwareId === RACK_OS_FIRMWARE_ID || firmwareId === RACK_OS_1_1_BUSINESS_FIRMWARE_ID
}
