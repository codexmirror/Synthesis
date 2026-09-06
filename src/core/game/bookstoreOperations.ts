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

/**
 * Construct one Bookstore Branch operations record with the represented
 * inventory-never-exceeds-shelf-capacity invariant enforced at construction,
 * rather than trusted to every caller. This is the one sanctioned way to
 * author a `BookstoreBranchOperationsRecord`, used identically for the seeded
 * Branch and for any other Bookstore Branch — nothing here reads or branches
 * on a specific Branch identity.
 */
export function createBookstoreBranchOperationsRecord(params: {
  readonly branchId: string
  readonly shelfCapacity: number
  readonly checkoutCapacity: number
  readonly open: boolean
  readonly currentInventory: number
}): BookstoreBranchOperationsRecord {
  return {
    branchId: params.branchId,
    shelfCapacity: params.shelfCapacity,
    checkoutCapacity: params.checkoutCapacity,
    open: params.open,
    currentInventory: Math.min(params.currentInventory, params.shelfCapacity),
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
