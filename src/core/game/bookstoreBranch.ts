import type { BookstoreBranchState, DollarFinancialAccount, DollarTransaction, GameState, InstalledSoftware } from './types'

export const BOOKSTORE_BRANCH_ID = 'bookstore-branch-01'
export const BOOKSTORE_BRANCH_NAME = 'Bookstore Branch 01'
export const BOOKSTORE_BRANCH_OPERATIONS_DEVICE_ID = 'host-lan-002'
export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

export const BRANCH_OPS_INSTALLATION: InstalledSoftware = {
  id: 'branch-ops',
  releaseId: 'branch-ops-1.0',
  buildId: 'build-branch-ops-1.0-v0',
  name: 'BranchOps',
  version: '1.0',
  channel: 'stable',
  publisher: 'Neutral Systems',
}

export function createInitialBookstoreBranchState(): BookstoreBranchState {
  return {
    id: BOOKSTORE_BRANCH_ID,
    displayName: BOOKSTORE_BRANCH_NAME,
    operationsDeviceId: BOOKSTORE_BRANCH_OPERATIONS_DEVICE_ID,
    settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
    completedSales: [{ id: BOOKSTORE_SALE_ID, kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
  }
}

/** Live, read-only truth available through operating the Device that actually hosts BranchOps. */
export function resolveBookstoreBranchOperations(state: GameState, deviceId: string): {
  readonly branch: BookstoreBranchState
  readonly software: InstalledSoftware
  readonly settlementAccount: DollarFinancialAccount
  readonly sales: readonly { readonly id: string; readonly kind: 'book_sale'; readonly transaction: DollarTransaction }[]
} | undefined {
  const branch = state.bookstoreBranch
  if (branch.operationsDeviceId !== deviceId) return undefined
  const host = state.world.network.hosts.find(({ id }) => id === deviceId)
  const software = host?.installedSoftware?.find(({ id, releaseId, buildId }) =>
    id === BRANCH_OPS_INSTALLATION.id
    && releaseId === BRANCH_OPS_INSTALLATION.releaseId
    && buildId === BRANCH_OPS_INSTALLATION.buildId)
  if (!software) return undefined
  const settlementAccount = state.dollarFinance.accounts.find(({ id }) => id === branch.settlementAccountId)
  if (!settlementAccount) return undefined
  const sales = branch.completedSales.flatMap((sale) => {
    const transaction = state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)
    return transaction?.destinationAccountId === branch.settlementAccountId
      ? [{ id: sale.id, kind: sale.kind, transaction }]
      : []
  })
  return { branch, software, settlementAccount, sales }
}
