import { BOOKSTORE_BRANCH_ID } from './business'
import type { BookstoreBranchOperationsRecord, BookstoreOperationsState, GameState } from './types'

/**
 * `bookstore-branch-01`'s authored initial operations configuration/runtime
 * state — fixture values only, not a generation range, minimum, maximum, or
 * economic tier. A conservative shape suitable for understanding the
 * BUSINESS application: comfortably open, well short of full shelves, with a
 * couple of usable checkout positions.
 */
const BOOKSTORE_BRANCH_INITIAL_SHELF_CAPACITY = 480
const BOOKSTORE_BRANCH_INITIAL_CHECKOUT_CAPACITY = 2
const BOOKSTORE_BRANCH_INITIAL_INVENTORY = 360
const BOOKSTORE_BRANCH_INITIAL_OPEN = true

export function createInitialBookstoreOperationsState(): BookstoreOperationsState {
  return {
    records: [createBookstoreBranchOperationsRecord({
      branchId: BOOKSTORE_BRANCH_ID,
      shelfCapacity: BOOKSTORE_BRANCH_INITIAL_SHELF_CAPACITY,
      checkoutCapacity: BOOKSTORE_BRANCH_INITIAL_CHECKOUT_CAPACITY,
      open: BOOKSTORE_BRANCH_INITIAL_OPEN,
      currentInventory: BOOKSTORE_BRANCH_INITIAL_INVENTORY,
    })],
  }
}

/** A represented Bookstore capacity/inventory quantity must be finite and never negative. */
function isValidBookstoreQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/**
 * Construct one Bookstore Branch operations record with the canonical
 * numeric invariants enforced at construction, rather than trusted to every
 * caller: `shelfCapacity`, `checkoutCapacity`, and `currentInventory` must
 * each be a finite number >= 0, and `currentInventory` must never exceed
 * `shelfCapacity`. This is the one sanctioned way to author a
 * `BookstoreBranchOperationsRecord`, used identically for the seeded Branch
 * and for any other Bookstore Branch — nothing here reads or branches on a
 * specific Branch identity.
 *
 * Invalid input throws a `RangeError` rather than being silently clamped or
 * normalized, matching the repository's existing convention for canonical
 * capacity/quantity construction (for example
 * `deriveEffectiveTransferRateBytesPerSecond` in `networkTransferCapacity.ts`
 * and `purchaseMarketOffer` in `market.ts`): a caller that authors impossible
 * canonical state has a bug to fix, not a value to have quietly reinterpreted
 * for it.
 */
export function createBookstoreBranchOperationsRecord(params: {
  readonly branchId: string
  readonly shelfCapacity: number
  readonly checkoutCapacity: number
  readonly open: boolean
  readonly currentInventory: number
}): BookstoreBranchOperationsRecord {
  if (!isValidBookstoreQuantity(params.shelfCapacity)) {
    throw new RangeError('Represented Bookstore shelf capacity must be a finite number >= 0')
  }
  if (!isValidBookstoreQuantity(params.checkoutCapacity)) {
    throw new RangeError('Represented Bookstore checkout capacity must be a finite number >= 0')
  }
  if (!isValidBookstoreQuantity(params.currentInventory)) {
    throw new RangeError('Represented Bookstore current inventory must be a finite number >= 0')
  }
  if (params.currentInventory > params.shelfCapacity) {
    throw new RangeError('Represented Bookstore current inventory must not exceed shelf capacity')
  }
  return {
    branchId: params.branchId,
    shelfCapacity: params.shelfCapacity,
    checkoutCapacity: params.checkoutCapacity,
    open: params.open,
    currentInventory: params.currentInventory,
  }
}

/**
 * Resolve the current Bookstore operations record for one Business Branch by
 * stable Branch ID, or `undefined` where this Branch has no such concrete
 * operations subsystem represented at all — a legitimate structural state,
 * not a defect. This is a separate, optional join on top of generic Business
 * Branch structural identity (`resolveBusinessOperatingContext` in
 * `business.ts`) and is independent of `resolveBookstoreCommerceForBranch`:
 * a Branch may have either, both, or neither represented.
 */
export function resolveBookstoreOperationsForBranch(state: GameState, branchId: string): BookstoreBranchOperationsRecord | undefined {
  return state.bookstoreOperations.records.find((candidate) => candidate.branchId === branchId)
}
