import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  BOOKSTORE_BRANCH_OPERATIONS_DEVICE_ID,
  BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
  BOOKSTORE_SALE_TRANSACTION_ID,
  BRANCH_OPS_INSTALLATION,
  resolveBookstoreBranchOperations,
} from './bookstoreBranch'

describe('bookstore branch initial truth', () => {
  it('keeps one stable branch separate from its operations Device and settlement Account', () => {
    const state = createInitialGameState()
    expect(state.bookstoreBranch).toMatchObject({
      id: 'bookstore-branch-01', displayName: 'Bookstore Branch 01',
      operationsDeviceId: BOOKSTORE_BRANCH_OPERATIONS_DEVICE_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
    })
    expect(state.bookstoreBranch.id).not.toBe(state.bookstoreBranch.operationsDeviceId)
    expect(state.bookstoreBranch.id).not.toBe(state.bookstoreBranch.settlementAccountId)
    expect(state.bookstoreBranch.id).not.toBe(state.player.id)
    expect(state.bookstoreBranch.completedSales).toEqual([
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

  it('requires both the configured host and its concrete BranchOps installation', () => {
    const state = createInitialGameState()
    const operations = resolveBookstoreBranchOperations(state, BOOKSTORE_BRANCH_OPERATIONS_DEVICE_ID)
    expect(operations?.settlementAccount.accountReference).toBe('CD-3318-2204')
    expect(operations?.sales[0].transaction.amountCents).toBe(2_000)
    expect(resolveBookstoreBranchOperations(state, 'host-lan-001')).toBeUndefined()
    const host = state.world.network.hosts.find(({ id }) => id === BOOKSTORE_BRANCH_OPERATIONS_DEVICE_ID)!
    expect(host.installedSoftware).toContainEqual(BRANCH_OPS_INSTALLATION)
    expect(state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.installedSoftware).not.toContainEqual(BRANCH_OPS_INSTALLATION)
    const withoutSoftware = { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((candidate) => candidate.id === host.id ? { ...candidate, installedSoftware: candidate.installedSoftware?.filter(({ id }) => id !== BRANCH_OPS_INSTALLATION.id) } : candidate) } } }
    expect(resolveBookstoreBranchOperations(withoutSoftware, host.id)).toBeUndefined()
  })

  it('authors no Petra complaint or Technician response for the incoming sale', () => {
    const state = createInitialGameState()
    expect(state.petraCompanyChat.messages).toEqual([])
    expect(state.technicianReaction.pending).toBeNull()
  })
})
