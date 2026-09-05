import { BOOKSTORE_BRANCH_ID } from './business'
import type { BookstoreCommerceState, DollarFinancialAccount, DollarTransaction, GameState } from './types'

export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

export function createInitialBookstoreCommerceState(): BookstoreCommerceState {
  return {
    records: [{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      completedSales: [{ id: BOOKSTORE_SALE_ID, kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
    }],
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
