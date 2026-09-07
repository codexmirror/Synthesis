import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID, BOOKSTORE_BRANCH_LOCATION, BOOKSTORE_BRANCH_NAME } from './business'
import { BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID, BOOKSTORE_MERCHANDISE_CATALOG, BOOKSTORE_SALE_TRANSACTION_ID, isBookstoreMerchandiseCatalogSufficient, resolveBookstoreCommerceForBranch } from './bookstoreCommerce'
import { BOOKSTORE_SALE_STATEMENT_PURPOSE } from './bookstoreSale'

describe('bookstore commerce initial truth', () => {
  it('keeps one concrete branch-linked commerce record referencing the generic Branch by stable ID', () => {
    const state = createInitialGameState()
    expect(state.bookstoreCommerce.nextSaleId).toBe(2)
    expect(state.bookstoreCommerce.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      merchandise: BOOKSTORE_MERCHANDISE_CATALOG,
      completedSales: [{
        id: 'bookstore-sale-0001',
        kind: 'book_sale',
        dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID,
        lines: [{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }],
      }],
    }])
  })

  it('seeds exactly eight authored merchandise identities with the specified names and integer-cent prices', () => {
    expect(BOOKSTORE_MERCHANDISE_CATALOG).toEqual([
      { id: 'bookstore-merch-001', name: 'Night Transit', unitPriceCents: 899 },
      { id: 'bookstore-merch-002', name: 'Static Bloom', unitPriceCents: 1_099 },
      { id: 'bookstore-merch-003', name: 'Glass District', unitPriceCents: 1_299 },
      { id: 'bookstore-merch-004', name: 'The Quiet Archive', unitPriceCents: 1_399 },
      { id: 'bookstore-merch-005', name: 'After the Relay', unitPriceCents: 1_499 },
      { id: 'bookstore-merch-006', name: 'Northbound', unitPriceCents: 1_599 },
      { id: 'bookstore-merch-007', name: 'A Map of Empty Rooms', unitPriceCents: 1_799 },
      { id: 'bookstore-merch-008', name: 'Systems of Dust', unitPriceCents: 2_000 },
    ])
  })

  it('gives every catalog entry a unique stable identity and a positive safe-integer price', () => {
    const ids = BOOKSTORE_MERCHANDISE_CATALOG.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of BOOKSTORE_MERCHANDISE_CATALOG) {
      expect(Number.isSafeInteger(item.unitPriceCents)).toBe(true)
      expect(item.unitPriceCents).toBeGreaterThan(0)
    }
  })

  it('links the seeded historical sale to one real incoming $20 Transaction and coherent current balances', () => {
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
      statementContext: { description: BOOKSTORE_BRANCH_NAME, purpose: BOOKSTORE_SALE_STATEMENT_PURPOSE, location: BOOKSTORE_BRANCH_LOCATION },
    })
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')?.balanceCents).toBe(80_000)
    expect(state.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)?.balanceCents).toBe(34_250)
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-local-v0')?.balanceCents).toBe(125_000)
    expect(transaction).not.toHaveProperty('memo')
    expect(transaction).not.toHaveProperty('category')
  })

  it('explains the seeded historical sale as exactly 1 × bookstore-merch-008 captured at $20.00, summing to the referenced Transaction amount', () => {
    const state = createInitialGameState()
    const record = state.bookstoreCommerce.records.find((candidate) => candidate.branchId === BOOKSTORE_BRANCH_ID)!
    const sale = record.completedSales[0]
    expect(sale.lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }])
    const transaction = state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)!
    const lineSum = sale.lines.reduce((sum, line) => sum + line.quantity * line.capturedUnitPriceCents, 0)
    expect(lineSum).toBe(transaction.amountCents)
  })

  it('authors no Petra complaint or Technician response for the incoming sale', () => {
    const state = createInitialGameState()
    expect(state.petraCompanyChat.messages).toEqual([])
    expect(state.technicianReaction.pending).toBeNull()
  })
})

describe('isBookstoreMerchandiseCatalogSufficient', () => {
  it('accepts the seeded catalog', () => {
    expect(isBookstoreMerchandiseCatalogSufficient(BOOKSTORE_MERCHANDISE_CATALOG)).toBe(true)
  })

  it('rejects an empty catalog', () => {
    expect(isBookstoreMerchandiseCatalogSufficient([])).toBe(false)
  })

  it.each([
    ['zero', 0],
    ['negative', -2_000],
    ['fractional', 19.99],
    ['non-finite', Number.NaN],
  ])('rejects a catalog containing an invalid unitPriceCents (%s)', (_label, unitPriceCents) => {
    const broken = [...BOOKSTORE_MERCHANDISE_CATALOG.slice(0, -1), { id: 'bookstore-merch-008', name: 'Systems of Dust', unitPriceCents }]
    expect(isBookstoreMerchandiseCatalogSufficient(broken)).toBe(false)
  })
})

describe('resolveBookstoreCommerceForBranch', () => {
  it('resolves current merchandise catalog, settlement Account, and completed sale for the bookstore Branch', () => {
    const state = createInitialGameState()
    const commerce = resolveBookstoreCommerceForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(commerce?.merchandise).toEqual(BOOKSTORE_MERCHANDISE_CATALOG)
    expect(commerce?.settlementAccount.accountReference).toBe('CD-3318-2204')
    expect(commerce?.sales).toHaveLength(1)
    expect(commerce?.sales[0].transaction.amountCents).toBe(2_000)
    expect(commerce?.sales[0].lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }])
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
      bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-local-v0' } : record) },
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
      bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-does-not-exist' } : record) },
    }
    expect(resolveBookstoreCommerceForBranch(dangling, BOOKSTORE_BRANCH_ID)).toBeUndefined()
  })

  it('renaming/repricing current merchandise never rewrites a prior CompletedSale, and a later sale captures the new current values', () => {
    const initial = createInitialGameState()
    const repriced = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID
          ? { ...record, merchandise: record.merchandise.map((item) => item.id === 'bookstore-merch-008' ? { ...item, name: 'Systems of Dust (Second Edition)', unitPriceCents: 2_500 } : item) }
          : record),
      },
    }
    const oldSale = resolveBookstoreCommerceForBranch(repriced, BOOKSTORE_BRANCH_ID)!.sales[0]
    expect(oldSale.lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }])
    expect(oldSale.transaction.amountCents).toBe(2_000)
    const newCatalogEntry = repriced.bookstoreCommerce.records[0].merchandise.find(({ id }) => id === 'bookstore-merch-008')!
    expect(newCatalogEntry.name).toBe('Systems of Dust (Second Edition)')
    expect(newCatalogEntry.unitPriceCents).toBe(2_500)
  })
})
