import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID, BOOKSTORE_SALE_TRANSACTION_ID, resolveBookstoreCommerceForBranch } from './bookstoreCommerce'

describe('bookstore commerce initial truth', () => {
  it('keeps one concrete branch-linked commerce record referencing the generic Branch by stable ID', () => {
    const state = createInitialGameState()
    expect(state.bookstoreCommerce.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      completedSales: [{ id: 'bookstore-sale-0001', kind: 'book_sale', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
    }])
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

describe('resolveBookstoreCommerceForBranch', () => {
  it('resolves current settlement Account and completed sale for the bookstore Branch', () => {
    const state = createInitialGameState()
    const commerce = resolveBookstoreCommerceForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(commerce?.settlementAccount.accountReference).toBe('CD-3318-2204')
    expect(commerce?.sales).toHaveLength(1)
    expect(commerce?.sales[0].transaction.amountCents).toBe(2_000)
  })

  it('resolves undefined for a Branch with no represented commerce record — a legitimate structural state, not a defect', () => {
    const state = createInitialGameState()
    expect(resolveBookstoreCommerceForBranch(state, 'branch-with-no-commerce')).toBeUndefined()
  })

  it('keeps completed-sale settlement historical when the current destination changes', () => {
    const initial = createInitialGameState()
    const transactionBefore = initial.dollarFinance.transactions.records.find(({ id }) => id === BOOKSTORE_SALE_TRANSACTION_ID)!
    const changed = {
      ...initial,
      bookstoreCommerce: { records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-local-v0' } : record) },
    }

    const commerce = resolveBookstoreCommerceForBranch(changed, BOOKSTORE_BRANCH_ID)
    expect(commerce?.settlementAccount.accountReference).toBe('CD-1042-7781')
    expect(commerce?.sales).toHaveLength(1)
    expect(commerce?.sales[0].transaction).toBe(transactionBefore)
    expect(commerce?.sales[0].transaction.amountCents).toBe(2_000)
    expect(commerce?.sales[0].transaction.destinationAccountReference).toBe('CD-3318-2204')
    expect(changed.dollarFinance.transactions.records).toBe(initial.dollarFinance.transactions.records)
    expect(changed.dollarFinance.transactions.records[0]).toEqual(transactionBefore)
  })

  it('resolves undefined where the record names a settlement Account that no longer exists, rather than fabricating one', () => {
    const initial = createInitialGameState()
    const dangling = {
      ...initial,
      bookstoreCommerce: { records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-does-not-exist' } : record) },
    }
    expect(resolveBookstoreCommerceForBranch(dangling, BOOKSTORE_BRANCH_ID)).toBeUndefined()
  })
})
