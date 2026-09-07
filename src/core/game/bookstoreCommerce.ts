import { BOOKSTORE_BRANCH_ID } from './business'
import type { BookstoreBranchCommerceRecord, BookstoreCommerceState, BookstoreMerchandiseRecord, BusinessBranchSaleLine, DollarFinancialAccount, DollarTransaction, GameState } from './types'

export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

/**
 * The seeded Bookstore Branch's authored V1 represented merchandise catalog —
 * a small concrete fixture, not a generic Product/SKU/catalogue framework.
 * Each entry carries only stable identity, a current human-readable name, and
 * a current unit price in integer cents: no ISBN, author, genre, publisher,
 * tax, cost basis, supplier, margin, popularity, quality tier, or dynamic
 * pricing. Revenue is never a primitive stored independently of this
 * catalog — a sale's amount is always the deterministic sum of the
 * merchandise actually purchased, read fresh from here at the moment of
 * purchase composition.
 */
export const BOOKSTORE_MERCHANDISE_CATALOG: readonly BookstoreMerchandiseRecord[] = [
  { id: 'bookstore-merch-001', name: 'Night Transit', unitPriceCents: 899 },
  { id: 'bookstore-merch-002', name: 'Static Bloom', unitPriceCents: 1_099 },
  { id: 'bookstore-merch-003', name: 'Glass District', unitPriceCents: 1_299 },
  { id: 'bookstore-merch-004', name: 'The Quiet Archive', unitPriceCents: 1_399 },
  { id: 'bookstore-merch-005', name: 'After the Relay', unitPriceCents: 1_499 },
  { id: 'bookstore-merch-006', name: 'Northbound', unitPriceCents: 1_599 },
  { id: 'bookstore-merch-007', name: 'A Map of Empty Rooms', unitPriceCents: 1_799 },
  { id: 'bookstore-merch-008', name: 'Systems of Dust', unitPriceCents: 2_000 },
]

/**
 * The authored historical sale (`bookstore-sale-0001`) predates represented
 * purchase composition; its purchase is authored directly as current World
 * Truth, reconciled with the $20.00 historical Transaction it always
 * referenced, rather than reconstructed or re-derived: 1 × `Systems of Dust`
 * at its own captured $20.00 price.
 */
const BOOKSTORE_SALE_0001_LINES: readonly BusinessBranchSaleLine[] = [
  { merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 },
]

export function createInitialBookstoreCommerceState(): BookstoreCommerceState {
  return {
    nextSaleId: 2,
    records: [{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      merchandise: BOOKSTORE_MERCHANDISE_CATALOG,
      completedSales: [{ id: BOOKSTORE_SALE_ID, kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID, lines: BOOKSTORE_SALE_0001_LINES }],
    }],
  }
}

/** Raw branch-linked commerce record lookup, independent of any Civic Dollar join — the smallest lookup sale execution needs to tell "no commerce record represented" apart from "settlement Account does not resolve." */
export function findBookstoreCommerceRecord(state: GameState, branchId: string): BookstoreBranchCommerceRecord | undefined {
  return state.bookstoreCommerce.records.find((candidate) => candidate.branchId === branchId)
}

/**
 * Whether one Branch's current represented merchandise catalog is
 * structurally sufficient to compose a purchase from: at least one entry, and
 * every entry's `unitPriceCents` a positive safe integer. This is a
 * structural precondition, independent of stock or any other prerequisite —
 * it never reads `BookstoreBranchOperationsRecord` stock.
 */
export function isBookstoreMerchandiseCatalogSufficient(merchandise: readonly BookstoreMerchandiseRecord[]): boolean {
  return merchandise.length > 0 && merchandise.every((item) => Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents > 0)
}

/**
 * Append exactly one new `book_sale` CompletedSale to one Branch's commerce
 * record, referencing the given Provider-owned Transaction by stable ID
 * only — never duplicating its amount or any other money truth — together
 * with the immutable captured purchase-line truth that explains it. Allocates
 * the new CompletedSale's stable ID from the state-level monotonic
 * `nextSaleId` allocator, following the existing Transaction/Session
 * allocation pattern; it is never derived from array length, time, or
 * randomness. The caller is responsible for having already established that
 * `branchId` names an existing commerce record — this assumes it.
 */
export function appendCompletedBookstoreSale(state: GameState, branchId: string, dollarTransactionId: string, lines: readonly BusinessBranchSaleLine[]): { readonly state: GameState; readonly saleId: string } {
  const saleId = `bookstore-sale-${String(state.bookstoreCommerce.nextSaleId).padStart(4, '0')}`
  const records = state.bookstoreCommerce.records.map((record) => record.branchId === branchId
    ? { ...record, completedSales: [...record.completedSales, { id: saleId, kind: 'book_sale' as const, dollarTransactionId, lines }] }
    : record)
  return {
    saleId,
    state: { ...state, bookstoreCommerce: { nextSaleId: state.bookstoreCommerce.nextSaleId + 1, records } },
  }
}

/**
 * Concrete bookstore commerce resolved for one Branch: current represented
 * merchandise catalog, current settlement Account, and completed sale
 * history (each sale carrying its own immutable captured purchase lines),
 * joined against Civic-Dollar-owned Accounts and Transactions. Civic Dollar
 * remains the sole owner of Accounts, balances, Credentials, Financial
 * Sessions, and Transactions; this only projects the stable references the
 * branch-linked record already holds.
 */
export interface ResolvedBookstoreCommerce {
  readonly merchandise: readonly BookstoreMerchandiseRecord[]
  readonly settlementAccount: DollarFinancialAccount
  readonly sales: readonly { readonly id: string; readonly kind: 'book_sale'; readonly transaction: DollarTransaction; readonly lines: readonly BusinessBranchSaleLine[] }[]
}

/**
 * Resolve the current bookstore commerce record for one Business Branch by
 * stable Branch ID, or `undefined` where this Branch has no such concrete
 * commerce subsystem represented at all — a legitimate structural state, not
 * a defect. This is a separate, optional join on top of generic Business
 * Branch structural identity (`resolveBusinessOperatingContext` in
 * `business.ts`), never a condition that resolver itself depends on.
 */
export function resolveBookstoreCommerceForBranch(state: GameState, branchId: string): ResolvedBookstoreCommerce | undefined {
  const record = state.bookstoreCommerce.records.find((candidate) => candidate.branchId === branchId)
  if (!record) return undefined
  const settlementAccount = state.dollarFinance.accounts.find(({ id }) => id === record.settlementAccountId)
  if (!settlementAccount) return undefined
  const sales = record.completedSales.flatMap((sale) => {
    const transaction = state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)
    return transaction ? [{ id: sale.id, kind: sale.kind, transaction, lines: sale.lines }] : []
  })
  return { merchandise: record.merchandise, settlementAccount, sales }
}
