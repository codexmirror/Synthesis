import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_MERCHANDISE_CATALOG } from './bookstoreCommerce'
import type { BookstoreBranchOperationsRecord, BookstoreMerchandiseStockRecord, BookstoreOperationsState, GameState } from './types'

/**
 * `bookstore-branch-01`'s authored initial operations configuration/runtime
 * state — fixture values only, not a generation range, minimum, maximum, or
 * economic tier. A conservative shape suitable for understanding the
 * BUSINESS application: comfortably open, well short of full shelves, with a
 * couple of usable checkout positions. 45 units of each of the 8 authored
 * catalog entries sums to exactly the same 360 initial total units this
 * Branch represented before item-level stock existed.
 */
const BOOKSTORE_BRANCH_INITIAL_SHELF_CAPACITY = 480
const BOOKSTORE_BRANCH_INITIAL_CHECKOUT_CAPACITY = 2
const BOOKSTORE_BRANCH_INITIAL_STOCK_PER_MERCHANDISE = 45
const BOOKSTORE_BRANCH_INITIAL_OPEN = true

export function createInitialBookstoreOperationsState(): BookstoreOperationsState {
  return {
    records: [createBookstoreBranchOperationsRecord({
      branchId: BOOKSTORE_BRANCH_ID,
      shelfCapacity: BOOKSTORE_BRANCH_INITIAL_SHELF_CAPACITY,
      checkoutCapacity: BOOKSTORE_BRANCH_INITIAL_CHECKOUT_CAPACITY,
      open: BOOKSTORE_BRANCH_INITIAL_OPEN,
      stock: BOOKSTORE_MERCHANDISE_CATALOG.map((item) => ({ merchandiseId: item.id, quantity: BOOKSTORE_BRANCH_INITIAL_STOCK_PER_MERCHANDISE })),
    })],
  }
}

/** A represented Bookstore capacity quantity must be finite and never negative. */
function isValidBookstoreQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/** A represented Bookstore per-merchandise stock quantity must be a non-negative integer. */
function isValidBookstoreStockQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/**
 * Construct one Bookstore Branch operations record with the canonical
 * numeric invariants enforced at construction, rather than trusted to every
 * caller: `shelfCapacity` and `checkoutCapacity` must each be a finite number
 * >= 0; every `stock` quantity must be a non-negative integer, referenced by
 * a unique merchandise ID; and the sum of every stock quantity must never
 * exceed `shelfCapacity`. This is the one sanctioned way to author a
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
  readonly stock: readonly BookstoreMerchandiseStockRecord[]
}): BookstoreBranchOperationsRecord {
  if (!isValidBookstoreQuantity(params.shelfCapacity)) {
    throw new RangeError('Represented Bookstore shelf capacity must be a finite number >= 0')
  }
  if (!isValidBookstoreQuantity(params.checkoutCapacity)) {
    throw new RangeError('Represented Bookstore checkout capacity must be a finite number >= 0')
  }
  if (!params.stock.every((entry) => isValidBookstoreStockQuantity(entry.quantity))) {
    throw new RangeError('Represented Bookstore per-merchandise stock quantity must be a non-negative integer')
  }
  if (new Set(params.stock.map((entry) => entry.merchandiseId)).size !== params.stock.length) {
    throw new RangeError('Represented Bookstore stock must reference each merchandise identity at most once')
  }
  const totalStock = params.stock.reduce((sum, entry) => sum + entry.quantity, 0)
  if (totalStock > params.shelfCapacity) {
    throw new RangeError('Represented Bookstore total stock must not exceed shelf capacity')
  }
  return {
    branchId: params.branchId,
    shelfCapacity: params.shelfCapacity,
    checkoutCapacity: params.checkoutCapacity,
    open: params.open,
    stock: params.stock,
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

/**
 * Derive one operations record's current total sellable stock by summing
 * every represented per-merchandise quantity. Always derived fresh — never
 * stored redundantly as a second mutable aggregate alongside item-level
 * stock, so the two can never drift apart.
 */
export function deriveBookstoreTotalStock(operations: BookstoreBranchOperationsRecord): number {
  return operations.stock.reduce((sum, entry) => sum + entry.quantity, 0)
}

/** The current represented stock quantity for one merchandise identity, or 0 where none is represented at all. */
export function findBookstoreStockQuantity(operations: BookstoreBranchOperationsRecord, merchandiseId: string): number {
  return operations.stock.find((entry) => entry.merchandiseId === merchandiseId)?.quantity ?? 0
}

/**
 * Consume exactly the given per-merchandise quantities from one Branch's
 * operations record — the exact represented consequence of one purchased
 * basket. The caller is responsible for having already established that
 * `branchId` names an existing operations record with sufficient stock for
 * every line — this assumes it rather than re-validating, since it is only
 * ever called as a deterministic consequence already proven safe by sale
 * preflight and provisional purchase composition.
 */
export function decrementBookstoreStock(state: GameState, branchId: string, lines: readonly { readonly merchandiseId: string; readonly quantity: number }[]): GameState {
  const decrements = new Map(lines.map((line) => [line.merchandiseId, line.quantity]))
  return {
    ...state,
    bookstoreOperations: {
      records: state.bookstoreOperations.records.map((record) => record.branchId === branchId
        ? { ...record, stock: record.stock.map((entry) => decrements.has(entry.merchandiseId) ? { ...entry, quantity: entry.quantity - decrements.get(entry.merchandiseId)! } : entry) }
        : record),
    },
  }
}

/** Apply one already-validated delivered restock to the owning operations record. */
export function incrementBookstoreStock(state: GameState, branchId: string, lines: readonly { readonly merchandiseId: string; readonly quantity: number }[]): GameState {
  const increments = new Map(lines.map((line) => [line.merchandiseId, line.quantity]))
  return {
    ...state,
    bookstoreOperations: {
      records: state.bookstoreOperations.records.map((record) => record.branchId === branchId
        ? { ...record, stock: record.stock.map((entry) => increments.has(entry.merchandiseId) ? { ...entry, quantity: entry.quantity + increments.get(entry.merchandiseId)! } : entry) }
        : record),
    },
  }
}
