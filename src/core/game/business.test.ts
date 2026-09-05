import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  BOOKSTORE_BRANCH_NETWORK_ID,
  BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
  BOOKSTORE_COMPANY_ID,
  BOOKSTORE_SALE_TRANSACTION_ID,
  resolveBusinessOperatingContext,
} from './business'

const HOME_NET_ID = 'network-local-001'
const NODE_01_ID = 'device-local-v0'
const SRV_01_ID = 'host-lan-001'
const SRV_02_ID = 'host-lan-002'

describe('business domain initial truth', () => {
  it('keeps one stable Company independent from Branch, Network, Device and settlement Account', () => {
    const state = createInitialGameState()
    expect(state.business.companies).toEqual([{ id: BOOKSTORE_COMPANY_ID, displayName: 'Bookstore' }])
    expect(state.business.companies[0].id).not.toBe(BOOKSTORE_BRANCH_NETWORK_ID)
    expect(state.business.companies[0].id).not.toBe(SRV_02_ID)
    expect(state.business.companies[0].id).not.toBe(BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)
  })

  it('keeps one stable Branch with its own identity, explicit Company relationship and explicit Network relationship', () => {
    const state = createInitialGameState()
    expect(state.business.branches).toHaveLength(1)
    const branch = state.business.branches[0]
    expect(branch).toMatchObject({
      id: 'bookstore-branch-01', displayName: 'Bookstore Branch 01',
      companyId: BOOKSTORE_COMPANY_ID, networkId: BOOKSTORE_BRANCH_NETWORK_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
    })
    expect(branch.id).not.toBe(branch.companyId)
    expect(branch.id).not.toBe(branch.networkId)
    expect(branch.id).not.toBe(branch.settlementAccountId)
    expect(branch.id).not.toBe(state.player.id)
    // No operationsDeviceId dependency remains anywhere in the Business domain.
    expect(branch).not.toHaveProperty('operationsDeviceId')
    expect(branch.completedSales).toEqual([
      { id: 'bookstore-sale-0001', kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID },
    ])
  })

  it('links the one book sale to one real incoming $20 Transaction and coherent current balances', () => {
    const state = createInitialGameState()
    const transaction = state.dollarFinance.transactions.records.find(({ id }) => id === BOOKSTORE_SALE_TRANSACTION_ID)
    expect(state.dollarFinance.transactions).toMatchObject({ nextId: 2 })
    expect(transaction).toEqual({
      id: BOOKSTORE_SALE_TRANSACTION_ID,
      sourceAccountId: 'dollar-account-retail-clearing-v0',
      destinationAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      amountCents: 2_000,
      sourceAccountReference: 'CD-9000-2000',
      destinationAccountReference: 'CD-3318-2204',
    })
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')?.balanceCents).toBe(80_000)
    expect(state.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)?.balanceCents).toBe(34_250)
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-local-v0')?.balanceCents).toBe(125_000)
    expect(transaction).not.toHaveProperty('memo')
    expect(transaction).not.toHaveProperty('category')
  })

  it('authors no Petra complaint or Technician response for the incoming sale', () => {
    const state = createInitialGameState()
    expect(state.petraCompanyChat.messages).toEqual([])
    expect(state.technicianReaction.pending).toBeNull()
  })
})

describe('resolveBusinessOperatingContext', () => {
  it('resolves the represented bookstore Branch for a Device whose Network membership matches the explicit Branch → Network relationship, with no operationsDeviceId involved', () => {
    const state = createInitialGameState()
    const context = resolveBusinessOperatingContext(state, SRV_02_ID)
    expect(context.networks.map(({ id }) => id)).toEqual([BOOKSTORE_BRANCH_NETWORK_ID])
    expect(context.branches).toHaveLength(1)
    const resolved = context.branches[0]
    expect(resolved.branch.id).toBe('bookstore-branch-01')
    expect(resolved.company).toEqual({ id: BOOKSTORE_COMPANY_ID, displayName: 'Bookstore' })
    expect(resolved.network.id).toBe(BOOKSTORE_BRANCH_NETWORK_ID)
    expect(resolved.settlementAccount.accountReference).toBe('CD-3318-2204')
    expect(resolved.sales[0].transaction.amountCents).toBe(2_000)
  })

  it('resolves zero Business Branches for a Device on a Network with none — a legitimate state, not an error', () => {
    const state = createInitialGameState()
    // node-01 and srv-01 are both members of home-net, which has no associated Business Branch.
    const nodeContext = resolveBusinessOperatingContext(state, NODE_01_ID)
    expect(nodeContext.networks.map(({ id }) => id)).toEqual([HOME_NET_ID])
    expect(nodeContext.branches).toEqual([])
    const srv01Context = resolveBusinessOperatingContext(state, SRV_01_ID)
    expect(srv01Context.networks.map(({ id }) => id)).toEqual([HOME_NET_ID])
    expect(srv01Context.branches).toEqual([])
  })

  it('resolves no Network context at all for a Device with no represented Network membership', () => {
    const state = createInitialGameState()
    const context = resolveBusinessOperatingContext(state, 'host-training-002')
    expect(context.networks).toEqual([])
    expect(context.branches).toEqual([])
  })

  it('grants no NetworkManagementAuthority, DeviceAccess, or ownership merely from Network membership', () => {
    const state = createInitialGameState()
    const before = { networkManagement: state.networkManagement, deviceAccess: state.deviceAccess, discovery: state.discovery, knowledge: state.knowledge }
    resolveBusinessOperatingContext(state, SRV_02_ID)
    // Reading is non-mutating; nothing about it could have changed these, but assert the domains explicitly stay separate concerns.
    expect(state.networkManagement).toEqual(before.networkManagement)
    expect(state.deviceAccess).toEqual(before.deviceAccess)
    expect(state.discovery).toEqual(before.discovery)
    expect(state.knowledge).toEqual(before.knowledge)
    // srv-02's Network has no explicit NetworkManagementAuthority relationship at all.
    expect(state.networkManagement.established.some((authority) => authority.networkId === BOOKSTORE_BRANCH_NETWORK_ID)).toBe(false)
  })

  it('keeps completed-sale settlement historical when the current destination changes', () => {
    const initial = createInitialGameState()
    const transactionBefore = initial.dollarFinance.transactions.records.find(({ id }) => id === BOOKSTORE_SALE_TRANSACTION_ID)!
    const changed = {
      ...initial,
      business: { ...initial.business, branches: initial.business.branches.map((branch) => branch.id === 'bookstore-branch-01' ? { ...branch, settlementAccountId: 'dollar-account-local-v0' } : branch) },
    }

    const context = resolveBusinessOperatingContext(changed, SRV_02_ID)
    const resolved = context.branches[0]
    expect(resolved.settlementAccount.accountReference).toBe('CD-1042-7781')
    expect(resolved.sales).toHaveLength(1)
    expect(resolved.sales[0].transaction).toBe(transactionBefore)
    expect(resolved.sales[0].transaction.amountCents).toBe(2_000)
    expect(resolved.sales[0].transaction.destinationAccountReference).toBe('CD-3318-2204')
    expect(changed.dollarFinance.transactions.records).toBe(initial.dollarFinance.transactions.records)
    expect(changed.dollarFinance.transactions.records[0]).toEqual(transactionBefore)
  })

  it('multiplicity: two Branches may reference the same Network without identity collision, a Company may own more than one Branch, and resolution returns every relevant Branch rather than assuming one', () => {
    const initial = createInitialGameState()
    const secondCompanyId = 'company-fixture-second'
    const secondBranchOnSameNetwork = {
      id: 'branch-fixture-second', displayName: 'Fixture Branch Two',
      companyId: secondCompanyId, networkId: BOOKSTORE_BRANCH_NETWORK_ID,
      settlementAccountId: 'dollar-account-local-v0', completedSales: [],
    }
    const secondBranchOfSameCompany = {
      id: 'branch-fixture-third', displayName: 'Fixture Branch Three',
      companyId: BOOKSTORE_COMPANY_ID, networkId: 'network-local-001',
      settlementAccountId: 'dollar-account-local-v0', completedSales: [],
    }
    const state = {
      ...initial,
      business: {
        companies: [...initial.business.companies, { id: secondCompanyId, displayName: 'Fixture Co' }],
        branches: [...initial.business.branches, secondBranchOnSameNetwork, secondBranchOfSameCompany],
      },
    }

    // Two Branches on the same Network resolve independently, with no overwrite.
    const context = resolveBusinessOperatingContext(state, SRV_02_ID)
    expect(context.branches.map((resolved) => resolved.branch.id).sort()).toEqual(['bookstore-branch-01', 'branch-fixture-second'])
    expect(context.branches.find((resolved) => resolved.branch.id === 'branch-fixture-second')?.company.displayName).toBe('Fixture Co')
    expect(context.branches.find((resolved) => resolved.branch.id === 'bookstore-branch-01')?.company.displayName).toBe('Bookstore')

    // The original Company now owns two Branches on two different Networks.
    expect(state.business.branches.filter((branch) => branch.companyId === BOOKSTORE_COMPANY_ID).map(({ id }) => id).sort())
      .toEqual(['bookstore-branch-01', 'branch-fixture-third'])

    // A Device on home-net resolves the fixture Branch placed there, unaffected by the other Network's Branches.
    const homeContext = resolveBusinessOperatingContext(state, NODE_01_ID)
    expect(homeContext.branches.map((resolved) => resolved.branch.id)).toEqual(['branch-fixture-third'])
  })
})
