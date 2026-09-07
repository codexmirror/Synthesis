import type { InstalledSoftware } from './types'

/**
 * The concrete represented Business client software.
 *
 * Business is ordinary Device-owned `InstalledSoftware` like GateSSH or
 * AuthGuard: a product, one release, and one concrete build. It is emphatically
 * not VEYRA Firmware, a Firmware capability flag, a launcher entry, an
 * entitlement, or a Company authority — a Device that holds this installation
 * can *present* the Business client, and nothing more. Whether that client then
 * has any Company to manage is the separate question
 * `companyAdministration.ts` answers.
 *
 * There is currently no acquisition path: no package artifact, Market offer,
 * download, or installation history is represented for it, exactly as the world
 * simply starts with GateSSH already installed on the servers that run it.
 */
export const BUSINESS_PRODUCT_ID = 'business'
export const BUSINESS_1_0_RELEASE_ID = 'business-1.0'
export const BUSINESS_1_0_BUILD_ID = 'build-business-1.0-v0'

export const BUSINESS_1_0_INSTALLATION: InstalledSoftware = {
  id: BUSINESS_PRODUCT_ID, releaseId: BUSINESS_1_0_RELEASE_ID, buildId: BUSINESS_1_0_BUILD_ID,
  name: 'Business', version: '1.0',
}

/**
 * Whether this Device's own software inventory actually contains the
 * represented Business client, by stable product identity rather than by
 * display name. A Device that represents no inventory at all simply holds
 * none.
 */
export function findInstalledBusinessSoftware(device: { readonly installedSoftware?: readonly InstalledSoftware[] }): InstalledSoftware | undefined {
  return device.installedSoftware?.find(({ id }) => id === BUSINESS_PRODUCT_ID)
}
