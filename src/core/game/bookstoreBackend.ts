import { BOOKSTORE_BRANCH_ID } from './business'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { BOOKSTORE_BACKEND_1_0_BUILD_ID, BOOKSTORE_BACKEND_1_0_RELEASE_ID, BOOKSTORE_BACKEND_PRODUCT_ID } from './serviceImplementations'
import type { BookstoreBackendState, GameState } from './types'

/** The seeded technical backend's real represented location: the concrete srv-02 Device and its own concrete Service. */
export const BOOKSTORE_BACKEND_DEVICE_ID = 'host-lan-002'
export const BOOKSTORE_BACKEND_SERVICE_ID = 'service-bookstore-backend-002'
export const BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'

export function createInitialBookstoreBackendState(): BookstoreBackendState {
  return {
    records: [{
      branchId: BOOKSTORE_BRANCH_ID,
      deviceId: BOOKSTORE_BACKEND_DEVICE_ID,
      serviceId: BOOKSTORE_BACKEND_SERVICE_ID,
      gratuityDestinationAccountId: BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID,
    }],
  }
}

/**
 * The Bookstore backend resolved for one Business Branch, together with the
 * truthful availability its referenced Device/Service currently supports.
 * `name`/`version` are this Service's own represented implementation
 * identity, not this record's or the Branch's presentation.
 */
export interface ResolvedBookstoreBackend {
  readonly deviceId: string
  readonly serviceId: string
  readonly name: string
  readonly version: string
  readonly available: boolean
  /** The uniquely resolved Provider-owned Account configured for gratuities, or undefined when routing truth fails closed. */
  readonly gratuityDestinationAccountId?: string
}

/**
 * Resolve the current Bookstore backend for one Business Branch by stable
 * Branch ID, or `undefined` where this Branch has no such concrete backend
 * represented at all — a legitimate structural state, not a defect. This is
 * a separate, optional join on top of generic Business Branch structural
 * identity (`resolveBusinessOperatingContext` in `business.ts`) and is
 * independent of `resolveBookstoreCommerceForBranch` and
 * `resolveBookstoreOperationsForBranch`: a Branch may have any combination of
 * the three, or none.
 *
 * The record itself names only stable Device/Service identity; the actual
 * Device and Service it references are resolved fresh from canonical World
 * Truth (`state.world.network.hosts`), and `available` is derived from that
 * Device's own `isDeviceNetworkUsable` operational truth together with the
 * Service's own `open` truth — never a stored status flag that could drift
 * from either. Where the referenced Device or Service no longer resolves at
 * all (a data-integrity condition, not ordinary offline/closed truth), this
 * also resolves `undefined` rather than fabricating an OFFLINE backend for a
 * reference that no longer exists.
 */
export function resolveBookstoreBackendForBranch(state: GameState, branchId: string): ResolvedBookstoreBackend | undefined {
  const record = state.bookstoreBackend.records.find((candidate) => candidate.branchId === branchId)
  if (!record) return undefined
  const device = state.world.network.hosts.find(({ id }) => id === record.deviceId)
  if (!device) return undefined
  const service = device.services?.find(({ id }) => id === record.serviceId)
  if (!service) return undefined
  const gratuityDestinations = state.dollarFinance.accounts.filter(({ id }) => id === record.gratuityDestinationAccountId)
  return {
    deviceId: device.id,
    serviceId: service.id,
    name: service.implementation.name,
    version: service.implementation.version,
    available: isDeviceNetworkUsable(device.operational) && service.open,
    ...(gratuityDestinations.length === 1 ? { gratuityDestinationAccountId: gratuityDestinations[0].id } : {}),
  }
}

/** Referenced by `initialState.ts` to author the seeded backend's concrete Service implementation identity coherently with `resolveBookstoreBackendForBranch`'s expectations. */
export const BOOKSTORE_BACKEND_IMPLEMENTATION = {
  productId: BOOKSTORE_BACKEND_PRODUCT_ID,
  releaseId: BOOKSTORE_BACKEND_1_0_RELEASE_ID,
  buildId: BOOKSTORE_BACKEND_1_0_BUILD_ID,
  name: 'Bookstore Backend',
  version: '1.0',
} as const
