import { BOOKSTORE_BRANCH_ID } from './business'
import type { BookstoreBranchCommerceRecord, BookstoreCommerceState, DollarFinancialAccount, DollarTransaction, GameState } from './types'

export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

/**
 * Current represented Bookstore sale price. V1 has no product catalogue,
 * SKU, category, basket size, discount, tax, fee, or dynamic pricing — this
 * is the one price a Bookstore Branch sale moves. It happens to equal the
 * historical authored sale amount; the two truths remain independent, and
 * sale execution always reads this current configuration, never the
 * historical Transaction.
 */
export const BOOKSTORE_BRANCH_UNIT_PRICE_CENTS = 2_000

export function createInitialBookstoreCommerceState(): BookstoreCommerceState {
  return {
    nextSaleId: 2,
    records: [{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      unitPriceCents: BOOKSTORE_BRANCH_UNIT_PRICE_CENTS,
      completedSales: [{ id: BOOKSTORE_SALE_ID, kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
    }],
  }
}

/** Raw branch-linked commerce record lookup, independent of any Civic Dollar join — the smallest lookup sale execution needs to tell "no commerce record represented" apart from "settlement Account does not resolve." */
export function findBookstoreCommerceRecord(state: GameState, branchId: string): BookstoreBranchCommerceRecord | undefined {
  return state.bookstoreCommerce.records.find((candidate) => candidate.branchId === branchId)
}

/**
 * Append exactly one new `book_sale` CompletedSale to one Branch's commerce
 * record, referencing the given Provider-owned Transaction by stable ID
 * only — never duplicating its amount or any other money truth. Allocates
 * the new CompletedSale's stable ID from the state-level monotonic
 * `nextSaleId` allocator, following the existing Transaction/Session
 * allocation pattern; it is never derived from array length, time, or
 * randomness. The caller is responsible for having already established that
 * `branchId` names an existing commerce record — this assumes it.
 */
export function appendCompletedBookstoreSale(state: GameState, branchId: string, dollarTransactionId: string): { readonly state: GameState; readonly saleId: string } {
  const saleId = `bookstore-sale-${String(state.bookstoreCommerce.nextSaleId).padStart(4, '0')}`
  const records = state.bookstoreCommerce.records.map((record) => record.branchId === branchId
    ? { ...record, completedSales: [...record.completedSales, { id: saleId, kind: 'book_sale' as const, dollarTransactionId }] }
    : record)
  return {
    saleId,
    state: { ...state, bookstoreCommerce: { nextSaleId: state.bookstoreCommerce.nextSaleId + 1, records } },
  }
}

/** Concrete bookstore commerce resolved for one Branch: current settlement Account and completed sale history, joined against Civic-Dollar-owned Accounts and Transactions. Civic Dollar remains the sole owner of Accounts, balances, Credentials, Financial Sessions, and Transactions; this only projects the stable references the branch-linked record already holds. */
export interface ResolvedBookstoreCommerce {
  readonly settlementAccount: DollarFinancialAccount
  readonly sales: readonly { readonly id: string; readonly kind: 'book_sale'; readonly transaction: DollarTransaction }[]
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
    return transaction ? [{ id: sale.id, kind: sale.kind, transaction }] : []
  })
  return { settlementAccount, sales }
}
