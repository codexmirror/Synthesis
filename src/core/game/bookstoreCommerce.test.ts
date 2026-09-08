import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID, BOOKSTORE_BRANCH_LOCATION, BOOKSTORE_BRANCH_NAME } from './business'
import { BOOKSTORE_BOOK_CATALOG, BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID, BOOKSTORE_INITIAL_ASSORTMENT, BOOKSTORE_MERCHANDISE_CATALOG, BOOKSTORE_SALE_TRANSACTION_ID, isBookstoreMerchandiseCatalogSufficient, resolveBookstoreCommerceForBranch } from './bookstoreCommerce'
import { BOOKSTORE_SALE_STATEMENT_PURPOSE, executeBookstoreSale , resolveValidBookstorePopularity } from './bookstoreSale'
import type { GameState } from './types'

/**
 * Plays back a fixed sequence of raw samples, holding the last value once
 * exhausted. With the seeded 8-title catalog and the default 70/25/5
 * basket-size mix, `[0.1, 0.95]` deterministically composes a single-item
 * basket of the catalog's last entry (`bookstore-merch-008`) — one
 * basket-size draw (0.1 < 0.70 selects size 1) plus one item-selection draw
 * (0.95 falls in the final Demand-weighted interval).
 */
function fixedRandom(values: readonly number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

describe('bookstore commerce initial truth', () => {
  it('keeps one concrete branch-linked commerce record referencing the generic Branch by stable ID', () => {
    const state = createInitialGameState()
    expect(state.bookstoreCommerce.nextSaleId).toBe(2)
    expect(state.bookstoreCommerce.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      assortment: [
        'bookstore-merch-001', 'bookstore-merch-002', 'bookstore-merch-003', 'bookstore-merch-004',
        'bookstore-merch-005', 'bookstore-merch-006', 'bookstore-merch-007', 'bookstore-merch-008',
      ],
      completedSales: [{
        id: 'bookstore-sale-0001',
        kind: 'book_sale',
        dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID,
        lines: [{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }],
      }],
    }])
  })

  it('authors Mercer Street assortment explicitly by the intended stable Book identities', () => {
    expect(BOOKSTORE_INITIAL_ASSORTMENT).toEqual([
      'bookstore-merch-001', 'bookstore-merch-002', 'bookstore-merch-003', 'bookstore-merch-004',
      'bookstore-merch-005', 'bookstore-merch-006', 'bookstore-merch-007', 'bookstore-merch-008',
    ])
  })

  it('seeds exactly eight authored merchandise identities with the specified names and integer-cent prices', () => {
    expect(BOOKSTORE_MERCHANDISE_CATALOG.map(({ id, name, unitPriceCents }) => ({ id, name, unitPriceCents }))).toEqual([
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

  it('authors exactly one broad Genre and one valid current Demand weight for all 24 Books', () => {
    expect(BOOKSTORE_BOOK_CATALOG.map(({ name, genre }) => [name, genre])).toEqual([
      ['Night Transit', 'THRILLER'], ['Static Bloom', 'SCIENCE_FICTION'], ['Glass District', 'MYSTERY'], ['The Quiet Archive', 'MYSTERY'],
      ['After the Relay', 'LITERARY_FICTION'], ['Northbound', 'LITERARY_FICTION'], ['A Map of Empty Rooms', 'LITERARY_FICTION'], ['Systems of Dust', 'SCIENCE_FICTION'],
      ['Red Harbor', 'THRILLER'], ['Terminal Light', 'SCIENCE_FICTION'], ['Field Notes', 'LITERARY_FICTION'], ['Winter Circuit', 'SCIENCE_FICTION'],
      ['Borrowed Signal', 'LITERARY_FICTION'], ['Low Orbit', 'SCIENCE_FICTION'], ['The Last Platform', 'LITERARY_FICTION'], ['Copper Rain', 'THRILLER'],
      ['Distant Current', 'SCIENCE_FICTION'], ['Signal House', 'MYSTERY'], ['The Pale Exchange', 'THRILLER'], ['Midnight Index', 'MYSTERY'],
      ['Concrete Sky', 'LITERARY_FICTION'], ['Rooms Without Doors', 'MYSTERY'], ['Silent Frequency', 'SCIENCE_FICTION'], ['East of the Grid', 'SCIENCE_FICTION'],
    ])
    expect(Object.fromEntries(BOOKSTORE_BOOK_CATALOG.map(({ id, baselinePopularity }) => [id, baselinePopularity]))).toEqual({
      'bookstore-merch-001': 80, 'bookstore-merch-002': 140, 'bookstore-merch-003': 100, 'bookstore-merch-004': 120,
      'bookstore-merch-005': 90, 'bookstore-merch-006': 100, 'bookstore-merch-007': 110, 'bookstore-merch-008': 80,
      'bookstore-book-009': 130, 'bookstore-book-010': 180, 'bookstore-book-011': 90, 'bookstore-book-012': 140,
      'bookstore-book-013': 120, 'bookstore-book-014': 100, 'bookstore-book-015': 90, 'bookstore-book-016': 110,
      'bookstore-book-017': 100, 'bookstore-book-018': 130, 'bookstore-book-019': 80, 'bookstore-book-020': 120,
      'bookstore-book-021': 90, 'bookstore-book-022': 100, 'bookstore-book-023': 130, 'bookstore-book-024': 110,
    })
    expect(BOOKSTORE_BOOK_CATALOG.every(({ baselinePopularity }) => Number.isSafeInteger(baselinePopularity) && baselinePopularity > 0)).toBe(true)
    expect(createInitialGameState().bookstoreCommerce).not.toHaveProperty('bookDemand')
  })

  it('resolves the same Baseline Popularity by stable Book identity when Catalog order changes', () => {
    const resolved = resolveValidBookstorePopularity([...BOOKSTORE_BOOK_CATALOG].reverse())
    expect(resolved?.get('bookstore-merch-001')).toBe(80)
    expect(resolved?.get('bookstore-book-010')).toBe(180)
    expect(resolved?.get('bookstore-book-024')).toBe(110)
  })

  it('gives every catalog entry a unique stable identity and a positive safe-integer price', () => {
    expect(BOOKSTORE_BOOK_CATALOG).toHaveLength(24)
    const ids = BOOKSTORE_BOOK_CATALOG.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of BOOKSTORE_BOOK_CATALOG) {
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
      destinationAccountId: 'dollar-account-veyra-phone-v0',
      amountCents: 2_000,
      sourceAccountReference: 'CD-9000-2000',
      destinationAccountReference: 'CD-3318-2204',
      statementContext: { description: BOOKSTORE_BRANCH_NAME, purpose: BOOKSTORE_SALE_STATEMENT_PURPOSE, location: BOOKSTORE_BRANCH_LOCATION },
    })
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')?.balanceCents).toBe(80_000)
    expect(state.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)?.balanceCents).toBe(0)
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')?.balanceCents).toBe(34_250)
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
    const broken = [...BOOKSTORE_MERCHANDISE_CATALOG.slice(0, -1), { id: 'bookstore-merch-008', name: 'Systems of Dust', genre: 'SCIENCE_FICTION' as const, baselinePopularity: 80, unitPriceCents }]
    expect(isBookstoreMerchandiseCatalogSufficient(broken)).toBe(false)
  })

  it('rejects a catalog containing a duplicate stable merchandise ID, even where every individual price is otherwise valid', () => {
    const duplicated = [
      ...BOOKSTORE_MERCHANDISE_CATALOG,
      { id: 'bookstore-merch-001', name: 'Night Transit (duplicate entry)', genre: 'THRILLER' as const, baselinePopularity: 100, unitPriceCents: 999 },
    ]
    expect(isBookstoreMerchandiseCatalogSufficient(duplicated)).toBe(false)
  })

  it('rejects two duplicate IDs even when they are the only two entries', () => {
    const onlyDuplicates = [
      { id: 'fixture-merch-a', name: 'Fixture A', genre: 'MYSTERY' as const, baselinePopularity: 100, unitPriceCents: 500 },
      { id: 'fixture-merch-a', name: 'Fixture A (again)', genre: 'MYSTERY' as const, baselinePopularity: 100, unitPriceCents: 700 },
    ]
    expect(isBookstoreMerchandiseCatalogSufficient(onlyDuplicates)).toBe(false)
  })
})

describe('resolveBookstoreCommerceForBranch', () => {
  it('resolves current merchandise catalog, settlement Account, and completed sale for the bookstore Branch', () => {
    const state = createInitialGameState()
    const commerce = resolveBookstoreCommerceForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(commerce?.merchandise).toEqual(BOOKSTORE_MERCHANDISE_CATALOG)
    expect(commerce?.settlementAccount.accountReference).toBe('CD-4827-6109')
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

  it('renaming/repricing current merchandise never rewrites a prior CompletedSale, a later real sale captures the new current values, and removing that merchandise afterwards still leaves every sale fully explainable', () => {
    const initial = createInitialGameState()

    // Rename and reprice the current catalog entry the historical sale used.
    const repriced: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        bookCatalog: initial.bookstoreCommerce.bookCatalog.map((item) => item.id === 'bookstore-merch-008' ? { ...item, name: 'Systems of Dust (Second Edition)', unitPriceCents: 2_500 } : item),
      },
    }

    // The already-completed historical sale is untouched by the current catalog change.
    const oldSaleAfterReprice = resolveBookstoreCommerceForBranch(repriced, BOOKSTORE_BRANCH_ID)!.sales[0]
    expect(oldSaleAfterReprice.lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }])
    expect(oldSaleAfterReprice.transaction.amountCents).toBe(2_000)

    // A real later sale, deterministically composing a single-item basket of the same merchandise
    // identity, captures the merchandise's new current name and price — not the earlier captured ones.
    const later = executeBookstoreSale(repriced, BOOKSTORE_BRANCH_ID, fixedRandom([0.1, 0.95]))
    expect(later.status).toBe('sold')
    if (later.status !== 'sold') return
    const laterCommerce = later.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const newSale = laterCommerce.completedSales[laterCommerce.completedSales.length - 1]
    expect(newSale.lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust (Second Edition)', quantity: 1, capturedUnitPriceCents: 2_500 }])
    const newTransaction = later.state.dollarFinance.transactions.records.find(({ id }) => id === newSale.dollarTransactionId)!
    expect(newTransaction.amountCents).toBe(2_500)

    // The earlier historical sale still remains exactly as it was, unaffected by the later real sale.
    expect(laterCommerce.completedSales[0].lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }])

    // Removing the merchandise from the current catalog entirely afterwards must never make either
    // sale inexplicable: current catalog state is never required to explain old sales.
    const removed: GameState = {
      ...later.state,
      bookstoreCommerce: {
        ...later.state.bookstoreCommerce,
        records: later.state.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, assortment: record.assortment.filter((id) => id !== 'bookstore-merch-008') } : record),
      },
    }
    const resolvedAfterRemoval = resolveBookstoreCommerceForBranch(removed, BOOKSTORE_BRANCH_ID)!
    expect(resolvedAfterRemoval.merchandise.some((item) => item.id === 'bookstore-merch-008')).toBe(false)
    for (const sale of resolvedAfterRemoval.sales) {
      const lineSum = sale.lines.reduce((sum, line) => sum + line.quantity * line.capturedUnitPriceCents, 0)
      expect(lineSum).toBe(sale.transaction.amountCents)
    }
    expect(resolvedAfterRemoval.sales[0].lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }])
    expect(resolvedAfterRemoval.sales[resolvedAfterRemoval.sales.length - 1].lines).toEqual([{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust (Second Edition)', quantity: 1, capturedUnitPriceCents: 2_500 }])
  })
})
