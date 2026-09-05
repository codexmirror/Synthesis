import type { BusinessBranchState, BusinessState, CompanyState, DollarFinancialAccount, DollarTransaction, GameState, LocalNetwork } from './types'

export const BOOKSTORE_COMPANY_ID = 'company-bookstore-01'
export const BOOKSTORE_COMPANY_NAME = 'Bookstore'
export const BOOKSTORE_BRANCH_ID = 'bookstore-branch-01'
export const BOOKSTORE_BRANCH_NAME = 'Bookstore Branch 01'
/** The existing represented foreign Network (`remote-segment-01`) this Branch explicitly operates through. */
export const BOOKSTORE_BRANCH_NETWORK_ID = 'network-foreign-001'
export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

export function createInitialBusinessState(): BusinessState {
  return {
    companies: [{ id: BOOKSTORE_COMPANY_ID, displayName: BOOKSTORE_COMPANY_NAME }],
    branches: [{
      id: BOOKSTORE_BRANCH_ID,
      displayName: BOOKSTORE_BRANCH_NAME,
      companyId: BOOKSTORE_COMPANY_ID,
      networkId: BOOKSTORE_BRANCH_NETWORK_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      completedSales: [{ id: BOOKSTORE_SALE_ID, kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
    }],
  }
}

/** One Business Branch resolved together with its Company and joined Civic Dollar-owned finance truth. */
export interface ResolvedBusinessBranch {
  readonly branch: BusinessBranchState
  readonly company: CompanyState
  readonly network: LocalNetwork
  readonly settlementAccount: DollarFinancialAccount
  readonly sales: readonly { readonly id: string; readonly kind: 'book_sale'; readonly transaction: DollarTransaction }[]
}

/**
 * The local Business operating context visible from a Business-capable server
 * connected to a represented technical site: every LocalNetwork the given
 * Device is actually a member of, and every Business Branch explicitly
 * associated with those Networks.
 *
 * `networks` is populated even where `branches` resolves to none — a Network
 * with no associated Branch is legitimate represented World Truth, not an
 * error. This never reads or grants `NetworkManagementAuthority`, DeviceAccess,
 * Discovery, or Knowledge; it reads only Network membership (World Truth) and
 * the Branch's own explicit `networkId` reference (Business-owned World
 * Truth).
 */
export function resolveBusinessOperatingContext(state: GameState, deviceId: string): {
  readonly networks: readonly LocalNetwork[]
  readonly branches: readonly ResolvedBusinessBranch[]
} {
  const networks = state.world.network.localNetworks.filter((network) => network.memberDeviceIds.includes(deviceId))
  const networkIds = new Set(networks.map((network) => network.id))
  const branches = state.business.branches
    .filter((branch) => networkIds.has(branch.networkId))
    .flatMap((branch): readonly ResolvedBusinessBranch[] => {
      const company = state.business.companies.find(({ id }) => id === branch.companyId)
      const network = networks.find(({ id }) => id === branch.networkId)
      const settlementAccount = state.dollarFinance.accounts.find(({ id }) => id === branch.settlementAccountId)
      if (!company || !network || !settlementAccount) return []
      const sales = branch.completedSales.flatMap((sale) => {
        const transaction = state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)
        return transaction ? [{ id: sale.id, kind: sale.kind, transaction }] : []
      })
      return [{ branch, company, network, settlementAccount, sales }]
    })
  return { networks, branches }
}
