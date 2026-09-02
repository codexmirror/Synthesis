import type { InstalledSoftware, NetworkService } from './types'
import { GATE_SSH_1_3_3_BUILD_ID, GATE_SSH_1_3_3_RELEASE_ID, GATE_SSH_PRODUCT_ID } from './serviceImplementations'

export const AUTH_GUARD_PRODUCT_ID = 'auth-guard'
export const AUTH_GUARD_1_0_RELEASE_ID = 'auth-guard-1.0'
export const AUTH_GUARD_1_0_BUILD_ID = 'build-auth-guard-1.0-v0'

export const AUTH_GUARD_1_0_INSTALLATION: InstalledSoftware = {
  id: AUTH_GUARD_PRODUCT_ID, releaseId: AUTH_GUARD_1_0_RELEASE_ID, buildId: AUTH_GUARD_1_0_BUILD_ID,
  name: 'AuthGuard', version: '1.0', publisher: 'rack-systems',
}

/** The one authored compatibility relationship AuthGuard currently represents. */
export function authGuard10ProtectsGateSsh133(installed: readonly InstalledSoftware[] | undefined, service: NetworkService): boolean {
  return Boolean(installed?.some(({ id, releaseId, buildId }) => id === AUTH_GUARD_PRODUCT_ID && releaseId === AUTH_GUARD_1_0_RELEASE_ID && buildId === AUTH_GUARD_1_0_BUILD_ID)
    && service.implementation.productId === GATE_SSH_PRODUCT_ID
    && service.implementation.releaseId === GATE_SSH_1_3_3_RELEASE_ID
    && service.implementation.buildId === GATE_SSH_1_3_3_BUILD_ID)
}
