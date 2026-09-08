import { BOOKSTORE_BRANCH_ID } from './business'
import type { BookstoreBranchCommerceRecord, BookstoreBookRecord, BookstoreCommerceState, BusinessBranchSaleLine, DollarFinancialAccount, DollarTransaction, GameState } from './types'

export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-bookstore-treasury-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

/**
 * The Bookstore domain's authored V1 represented Book Catalog —
 * a small concrete fixture, not a generic Product/SKU/catalogue framework.
 * Each entry carries stable identity, a current human-readable name, one broad
 * Bookstore Genre, and a current unit price in integer cents: no ISBN, author, publisher,
 * tax, cost basis, supplier, margin, quality tier, or dynamic
 * pricing. Revenue is never a primitive stored independently of this
 * catalog — a sale's amount is always the deterministic sum of the
 * merchandise actually purchased, read fresh from here at the moment of
 * purchase composition.
 */
export const BOOKSTORE_BOOK_CATALOG: readonly BookstoreBookRecord[] = [
  { id: 'bookstore-merch-001', baselinePopularity: 80, name: 'Night Transit', genre: 'THRILLER', unitPriceCents: 899 },
  { id: 'bookstore-merch-002', baselinePopularity: 140, name: 'Static Bloom', genre: 'SCIENCE_FICTION', unitPriceCents: 1_099 },
  { id: 'bookstore-merch-003', baselinePopularity: 100, name: 'Glass District', genre: 'MYSTERY', unitPriceCents: 1_299 },
  { id: 'bookstore-merch-004', baselinePopularity: 120, name: 'The Quiet Archive', genre: 'MYSTERY', unitPriceCents: 1_399 },
  { id: 'bookstore-merch-005', baselinePopularity: 90, name: 'After the Relay', genre: 'LITERARY_FICTION', unitPriceCents: 1_499 },
  { id: 'bookstore-merch-006', baselinePopularity: 100, name: 'Northbound', genre: 'LITERARY_FICTION', unitPriceCents: 1_599 },
  { id: 'bookstore-merch-007', baselinePopularity: 110, name: 'A Map of Empty Rooms', genre: 'LITERARY_FICTION', unitPriceCents: 1_799 },
  { id: 'bookstore-merch-008', baselinePopularity: 80, name: 'Systems of Dust', genre: 'SCIENCE_FICTION', unitPriceCents: 2_000 },
  { id: 'bookstore-book-009', baselinePopularity: 130, name: 'Red Harbor', genre: 'THRILLER', unitPriceCents: 1_249 },
  { id: 'bookstore-book-010', baselinePopularity: 180, name: 'Terminal Light', genre: 'SCIENCE_FICTION', unitPriceCents: 1_649 },
  { id: 'bookstore-book-011', baselinePopularity: 90, name: 'Field Notes', genre: 'LITERARY_FICTION', unitPriceCents: 999 },
  { id: 'bookstore-book-012', baselinePopularity: 140, name: 'Winter Circuit', genre: 'SCIENCE_FICTION', unitPriceCents: 1_549 },
  { id: 'bookstore-book-013', baselinePopularity: 120, name: 'Borrowed Signal', genre: 'LITERARY_FICTION', unitPriceCents: 1_399 },
  { id: 'bookstore-book-014', baselinePopularity: 100, name: 'Low Orbit', genre: 'SCIENCE_FICTION', unitPriceCents: 1_199 },
  { id: 'bookstore-book-015', baselinePopularity: 90, name: 'The Last Platform', genre: 'LITERARY_FICTION', unitPriceCents: 1_799 },
  { id: 'bookstore-book-016', baselinePopularity: 110, name: 'Copper Rain', genre: 'THRILLER', unitPriceCents: 1_299 },
  { id: 'bookstore-book-017', baselinePopularity: 100, name: 'Distant Current', genre: 'SCIENCE_FICTION', unitPriceCents: 1_499 },
  { id: 'bookstore-book-018', baselinePopularity: 130, name: 'Signal House', genre: 'MYSTERY', unitPriceCents: 1_899 },
  { id: 'bookstore-book-019', baselinePopularity: 80, name: 'The Pale Exchange', genre: 'THRILLER', unitPriceCents: 1_449 },
  { id: 'bookstore-book-020', baselinePopularity: 120, name: 'Midnight Index', genre: 'MYSTERY', unitPriceCents: 1_599 },
  { id: 'bookstore-book-021', baselinePopularity: 90, name: 'Concrete Sky', genre: 'LITERARY_FICTION', unitPriceCents: 1_349 },
  { id: 'bookstore-book-022', baselinePopularity: 100, name: 'Rooms Without Doors', genre: 'MYSTERY', unitPriceCents: 1_749 },
  { id: 'bookstore-book-023', baselinePopularity: 130, name: 'Silent Frequency', genre: 'SCIENCE_FICTION', unitPriceCents: 1_529 },
  { id: 'bookstore-book-024', baselinePopularity: 110, name: 'East of the Grid', genre: 'SCIENCE_FICTION', unitPriceCents: 1_929 },
]

/** Mercer Street's authored Branch assortment, independent from Catalog ordering. */
export const BOOKSTORE_INITIAL_ASSORTMENT: readonly string[] = [
  'bookstore-merch-001',
  'bookstore-merch-002',
  'bookstore-merch-003',
  'bookstore-merch-004',
  'bookstore-merch-005',
  'bookstore-merch-006',
  'bookstore-merch-007',
  'bookstore-merch-008',
]
/** Compatibility name for the original eight-title authored set. */
export const BOOKSTORE_MERCHANDISE_CATALOG = BOOKSTORE_INITIAL_ASSORTMENT.map((id) => resolveBookstoreBookById(BOOKSTORE_BOOK_CATALOG, id)!)

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
    bookCatalog: BOOKSTORE_BOOK_CATALOG,
    nextSaleId: 2,
    records: [{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      assortment: BOOKSTORE_INITIAL_ASSORTMENT,
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
 * structurally sufficient to compose a purchase from: at least one entry,
 * every entry's `unitPriceCents` a positive safe integer, and every entry's
 * stable `id` unique within the catalog — matching the same
 * no-duplicate-identity convention `createBookstoreBranchOperationsRecord`
 * already enforces for per-merchandise stock. A duplicate stable ID would
 * make Map-keyed selection, aggregation, and historical-line semantics
 * ambiguous (which entry's name/price actually applies?), so it is rejected
 * here rather than left to resolve arbitrarily. This is a structural
 * precondition, independent of stock or any other prerequisite — it never
 * reads `BookstoreBranchOperationsRecord` stock.
 */
export function isBookstoreMerchandiseCatalogSufficient(merchandise: readonly BookstoreBookRecord[]): boolean {
  if (merchandise.length === 0) return false
  if (!merchandise.every((item) => Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents > 0)) return false
  return new Set(merchandise.map((item) => item.id)).size === merchandise.length
}

/** Resolve one stable Book identity only when Catalog truth provides exactly one match. */
export function resolveBookstoreBookById(catalog: readonly BookstoreBookRecord[], bookId: string): BookstoreBookRecord | undefined {
  const matches = catalog.filter(({ id }) => id === bookId)
  return matches.length === 1 ? matches[0] : undefined
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
    state: { ...state, bookstoreCommerce: { ...state.bookstoreCommerce, nextSaleId: state.bookstoreCommerce.nextSaleId + 1, records } },
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
  readonly merchandise: readonly BookstoreBookRecord[]
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
  const assortment = new Set(record.assortment)
  return { merchandise: state.bookstoreCommerce.bookCatalog.filter((book) => assortment.has(book.id)), settlementAccount, sales }
}
