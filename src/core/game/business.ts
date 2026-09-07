import type { BusinessBranchState, BusinessState, CompanyState, DollarFinancialAccount, GameState, LocalNetwork } from './types'

export const BOOKSTORE_COMPANY_ID = 'company-bookstore-01'
export const BOOKSTORE_COMPANY_NAME = 'Bookstore'
export const BOOKSTORE_TREASURY_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_BRANCH_ID = 'bookstore-branch-01'
export const BOOKSTORE_BRANCH_NAME = 'Bookstore Branch 01'
/** The existing represented foreign Network (`remote-segment-01`) this Branch explicitly operates through. */
export const BOOKSTORE_BRANCH_NETWORK_ID = 'network-foreign-001'
/** Current represented human-readable location/address this Branch operates from. Current mutable Branch truth, distinct from any Transaction's historical statement-context snapshot of it. */
export const BOOKSTORE_BRANCH_LOCATION = '18 Mercer Street'

export function createInitialBusinessState(): BusinessState {
  return {
    companies: [{ id: BOOKSTORE_COMPANY_ID, displayName: BOOKSTORE_COMPANY_NAME }],
    treasuryDesignations: [{ companyId: BOOKSTORE_COMPANY_ID, accountId: BOOKSTORE_TREASURY_ACCOUNT_ID }],
    branches: [{
      id: BOOKSTORE_BRANCH_ID,
      displayName: BOOKSTORE_BRANCH_NAME,
      location: BOOKSTORE_BRANCH_LOCATION,
      companyId: BOOKSTORE_COMPANY_ID,
      networkId: BOOKSTORE_BRANCH_NETWORK_ID,
    }],
  }
}

/**
 * Resolve the one current Civic Dollar Account designated as a Company's
 * treasury. Missing Companies, missing or ambiguous designations, and dangling
 * Account references all fail closed. Resolution neither reads nor creates any
 * Credential, Financial Session, saved sign-in, DeviceAccess or RemoteSession.
 */
export function resolveCompanyTreasuryAccount(state: GameState, companyId: string): DollarFinancialAccount | undefined {
  if (!state.business.companies.some(({ id }) => id === companyId)) return undefined
  const designations = state.business.treasuryDesignations.filter((designation) => designation.companyId === companyId)
  if (designations.length !== 1) return undefined
  const accounts = state.dollarFinance.accounts.filter(({ id }) => id === designations[0].accountId)
  return accounts.length === 1 ? accounts[0] : undefined
}

/**
 * One Business Branch resolved together with its owning Company and the
 * LocalNetwork it operates through. Structural identity only: whether this
 * Branch has any concrete commerce or operational subsystem represented is a
 * separate question, answered by that subsystem's own resolver (for example
 * `resolveBookstoreCommerceForBranch` in `bookstoreCommerce.ts`) — never by
 * this one.
 */
export interface ResolvedBusinessBranch {
  readonly branch: BusinessBranchState
  readonly company: CompanyState
  readonly network: LocalNetwork
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
 *
 * This is deliberately a structural-only resolution: it never reads Civic
 * Dollar or any concrete commerce/operational subsystem, and a Branch never
 * drops out of this result merely because it has no such subsystem
 * represented. Presentation composes this with a separate concrete resolver
 * (e.g. `resolveBookstoreCommerceForBranch`) only where it needs that
 * concrete information.
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
      if (!company || !network) return []
      return [{ branch, company, network }]
    })
  return { networks, branches }
}
