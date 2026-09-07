import { describe, expect, it } from 'vitest'
import { ATLAS_DISTRIBUTION_COMPANY_ID, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPANY_ID, BOOKSTORE_TREASURY_ACCOUNT_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID } from './business'
import { executeBookstoreSale } from './bookstoreSale'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_COMPACT_REFILL_OFFER_ID, BOOKSTORE_NORTHLINE_NEW_TITLES_OFFER_ID, BOOKSTORE_STANDARD_REFILL_OFFER_ID, deriveBookstoreIncomingStock, placeBookstoreRestockOrder } from './bookstoreRestock'
import { deriveBookstoreTotalStock, findBookstoreStockQuantity } from './bookstoreOperations'
import type { GameState } from './types'

const lastBook = () => {
  const samples = [0, 0.999999]
  return () => samples.shift() ?? 0
}

function earn(state: GameState, sales: number): GameState {
  let next = state
  for (let index = 0; index < sales; index += 1) {
    const result = executeBookstoreSale(next, BOOKSTORE_BRANCH_ID, lastBook())
    if (result.status !== 'sold') throw new Error(`sale ${index} refused: ${result.status}`)
    next = result.state
  }
  return next
}

function balance(state: GameState, id: string): number {
  return state.dollarFinance.accounts.find((account) => account.id === id)!.balanceCents
}

describe('Bookstore restock represented truth', () => {
  it('seeds the unchanged Atlas offers and one ordinary Northline offer', () => {
    const state = createInitialGameState()
    expect(state.bookstoreRestock.offers).toHaveLength(3)
    expect(state.bookstoreRestock.offers.map((offer) => ({ id: offer.id, seller: offer.sellerCompanyId, units: offer.lines.reduce((sum, line) => sum + line.quantity, 0), price: offer.totalPriceCents, duration: offer.deliveryDurationMs }))).toEqual([
      { id: BOOKSTORE_COMPACT_REFILL_OFFER_ID, seller: ATLAS_DISTRIBUTION_COMPANY_ID, units: 16, price: 14_000, duration: 1_800_000 },
      { id: BOOKSTORE_STANDARD_REFILL_OFFER_ID, seller: ATLAS_DISTRIBUTION_COMPANY_ID, units: 40, price: 34_000, duration: 3_600_000 },
      { id: BOOKSTORE_NORTHLINE_NEW_TITLES_OFFER_ID, seller: NORTHLINE_BOOK_SUPPLY_COMPANY_ID, units: 12, price: 12_000, duration: 2_700_000 },
    ])
    const intendedIds = [
      'bookstore-merch-001', 'bookstore-merch-002', 'bookstore-merch-003', 'bookstore-merch-004',
      'bookstore-merch-005', 'bookstore-merch-006', 'bookstore-merch-007', 'bookstore-merch-008',
    ]
    expect(state.bookstoreRestock.offers[0].lines).toEqual(intendedIds.map((merchandiseId) => ({ merchandiseId, quantity: 2 })))
    expect(state.bookstoreRestock.offers[1].lines).toEqual(intendedIds.map((merchandiseId) => ({ merchandiseId, quantity: 5 })))
    expect(state.bookstoreRestock.offers[2].lines).toEqual([
      { merchandiseId: 'bookstore-book-010', quantity: 3 },
      { merchandiseId: 'bookstore-book-009', quantity: 3 },
      { merchandiseId: 'bookstore-book-011', quantity: 3 },
      { merchandiseId: 'bookstore-book-013', quantity: 3 },
    ])
  })

  it('fails closed atomically when global Book identity is ambiguous', () => {
    const funded = earn(createInitialGameState(), 7)
    const input: GameState = {
      ...funded,
      bookstoreCommerce: {
        ...funded.bookstoreCommerce,
        bookCatalog: [...funded.bookstoreCommerce.bookCatalog, { ...funded.bookstoreCommerce.bookCatalog[0], name: 'Ambiguous Night Transit' }],
      },
    }
    const before = structuredClone(input)
    const result = placeBookstoreRestockOrder(input, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result).toEqual({ status: 'invalid_offer', state: input })
    expect(result.state).toBe(input)
    expect(result.state).toEqual(before)
  })

  it('uses represented sales revenue to atomically pay the current Company Treasuries and capture one in-transit historical order', () => {
    const earned = earn(createInitialGameState(), 7)
    expect(balance(earned, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(14_000)
    const stockBefore = deriveBookstoreTotalStock(earned.bookstoreOperations.records[0])
    const transactionsBefore = earned.dollarFinance.transactions.records.length
    const result = placeBookstoreRestockOrder(earned, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result.status).toBe('ordered')
    if (result.status !== 'ordered') throw new Error('expected order')
    expect(balance(result.state, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(0)
    expect(balance(result.state, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(14_000)
    expect(balance(result.state, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(0)
    expect(result.state.dollarFinance.transactions.records).toHaveLength(transactionsBefore + 1)
    expect(result.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, destinationAccountId: ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, amountCents: 14_000 })
    expect(deriveBookstoreTotalStock(result.state.bookstoreOperations.records[0])).toBe(stockBefore)
    expect(deriveBookstoreIncomingStock(result.state, BOOKSTORE_BRANCH_ID)).toBe(16)
    expect(result.state.bookstoreRestock.orders[0]).toMatchObject({
      status: 'IN_TRANSIT', buyerBranchId: BOOKSTORE_BRANCH_ID,
      sellerCompanyId: ATLAS_DISTRIBUTION_COMPANY_ID, capturedSellerDisplayName: 'Atlas Distribution',
      offerId: BOOKSTORE_COMPACT_REFILL_OFFER_ID, capturedOfferDisplayName: 'Compact Shelf Refill',
      capturedDeliveryDurationMs: 1_800_000, remainingDeliveryMs: 1_800_000,
      dollarTransactionId: result.transactionId,
    })
    expect(result.state.bookstoreRestock.orders[0]).not.toHaveProperty('totalPriceCents')
  })

  it('accumulates repeated Northline purchases only in Northline Treasury', () => {
    const funded = earn(createInitialGameState(), 12)
    const first = placeBookstoreRestockOrder(funded, BOOKSTORE_BRANCH_ID, BOOKSTORE_NORTHLINE_NEW_TITLES_OFFER_ID)
    if (first.status !== 'ordered') throw new Error('expected first Northline order')
    const second = placeBookstoreRestockOrder(first.state, BOOKSTORE_BRANCH_ID, BOOKSTORE_NORTHLINE_NEW_TITLES_OFFER_ID)
    expect(second.status).toBe('ordered')
    if (second.status !== 'ordered') throw new Error('expected second Northline order')
    expect(balance(second.state, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(24_000)
    expect(balance(second.state, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(0)
    expect(second.state.dollarFinance.transactions.records.slice(-2).map(({ destinationAccountId, amountCents }) => ({ destinationAccountId, amountCents }))).toEqual([
      { destinationAccountId: NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID, amountCents: 12_000 },
      { destinationAccountId: NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID, amountCents: 12_000 },
    ])
  })

  it('resolves future purchase Accounts from Treasury designations, independently of Branch settlement', () => {
    const earned = earn(createInitialGameState(), 7)
    const changed: GameState = {
      ...earned,
      business: { ...earned.business, treasuryDesignations: earned.business.treasuryDesignations.map((designation) => designation.companyId === BOOKSTORE_COMPANY_ID ? { ...designation, accountId: 'dollar-account-local-v0' } : designation.companyId === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...designation, accountId: 'dollar-account-veyra-phone-v0' } : designation) },
      bookstoreCommerce: { ...earned.bookstoreCommerce, records: earned.bookstoreCommerce.records.map((record) => ({ ...record, settlementAccountId: 'dollar-account-retail-clearing-v0' })) },
    }
    const result = placeBookstoreRestockOrder(changed, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result.status).toBe('ordered')
    if (result.status !== 'ordered') throw new Error('expected order')
    expect(result.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ sourceAccountId: 'dollar-account-local-v0', destinationAccountId: 'dollar-account-veyra-phone-v0', amountCents: 14_000 })
    expect(balance(result.state, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(14_000)
  })

  it.each([
    ['insufficient funds', (_state: GameState) => createInitialGameState()],
    ['missing buyer Treasury', (state: GameState) => ({ ...state, business: { ...state.business, treasuryDesignations: state.business.treasuryDesignations.filter(({ companyId }) => companyId !== BOOKSTORE_COMPANY_ID) } })],
    ['missing seller Treasury', (state: GameState) => ({ ...state, business: { ...state.business, treasuryDesignations: state.business.treasuryDesignations.filter(({ companyId }) => companyId !== ATLAS_DISTRIBUTION_COMPANY_ID) } })],
    ['invalid offer composition', (state: GameState) => ({ ...state, bookstoreRestock: { ...state.bookstoreRestock, offers: state.bookstoreRestock.offers.map((offer) => offer.id === BOOKSTORE_COMPACT_REFILL_OFFER_ID ? { ...offer, lines: [{ merchandiseId: 'missing', quantity: 2 }] } : offer) } })],
    ['capacity exceeded', (state: GameState) => ({ ...state, bookstoreOperations: { records: state.bookstoreOperations.records.map((record) => ({ ...record, shelfCapacity: deriveBookstoreTotalStock(record) })) } })],
  ])('refuses %s without any partial consequence', (_label, arrange) => {
    const base = earn(createInitialGameState(), 7)
    const input = arrange(base)
    const before = structuredClone(input)
    const result = placeBookstoreRestockOrder(input, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result.status).not.toBe('ordered')
    expect(result.state).toBe(input)
    expect(result.state).toEqual(before)
  })

  it('reserves capacity across multiple in-transit orders and derives incoming stock rather than storing an aggregate', () => {
    const funded = earn(createInitialGameState(), 24)
    const first = placeBookstoreRestockOrder(funded, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    if (first.status !== 'ordered') throw new Error('expected first order')
    const second = placeBookstoreRestockOrder(first.state, BOOKSTORE_BRANCH_ID, BOOKSTORE_STANDARD_REFILL_OFFER_ID)
    expect(second.status).toBe('ordered')
    if (second.status !== 'ordered') throw new Error('expected second order')
    expect(second.state.bookstoreRestock.orders).toHaveLength(2)
    expect(deriveBookstoreIncomingStock(second.state, BOOKSTORE_BRANCH_ID)).toBe(56)
    expect(second.state.bookstoreRestock).not.toHaveProperty('incomingStock')
  })

  it('keeps captured order meaning unchanged when current offer, seller, and merchandise names change', () => {
    const placed = placeBookstoreRestockOrder(earn(createInitialGameState(), 7), BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    if (placed.status !== 'ordered') throw new Error('expected order')
    const historical = placed.state.bookstoreRestock.orders[0]
    const changed: GameState = {
      ...placed.state,
      business: { ...placed.state.business, companies: placed.state.business.companies.map((company) => company.id === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...company, displayName: 'Renamed Atlas' } : company) },
      bookstoreCommerce: { ...placed.state.bookstoreCommerce, bookCatalog: placed.state.bookstoreCommerce.bookCatalog.map((item) => ({ ...item, name: `Renamed ${item.id}` })) },
      bookstoreRestock: { ...placed.state.bookstoreRestock, offers: placed.state.bookstoreRestock.offers.map((offer) => ({ ...offer, displayName: 'Changed offer' })) },
    }
    expect(changed.bookstoreRestock.orders[0]).toBe(historical)
    expect(historical.capturedSellerDisplayName).toBe('Atlas Distribution')
    expect(historical.capturedOfferDisplayName).toBe('Compact Shelf Refill')
    expect(historical.lines[0].capturedMerchandiseDisplayName).toBe('Night Transit')
  })

  it('delivers captured quantities exactly once and those ordinary units are consumed by later sales', () => {
    const placed = placeBookstoreRestockOrder(earn(createInitialGameState(), 7), BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    if (placed.status !== 'ordered') throw new Error('expected order')
    const isolated: GameState = { ...placed.state, bookstoreSalesCadence: { records: placed.state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 10_000_000 })) } }
    const before = findBookstoreStockQuantity(isolated.bookstoreOperations.records[0], 'bookstore-merch-008')
    const delivered = advanceGameState(isolated, 1_800_000, () => 0.5, () => 0.5, lastBook())
    expect(delivered.bookstoreRestock.orders[0]).toMatchObject({ status: 'DELIVERED', remainingDeliveryMs: 0 })
    expect(findBookstoreStockQuantity(delivered.bookstoreOperations.records[0], 'bookstore-merch-008')).toBe(before + 2)
    const further = advanceGameState(delivered, 1, () => 0.5, () => 0.5, lastBook())
    expect(findBookstoreStockQuantity(further.bookstoreOperations.records[0], 'bookstore-merch-008')).toBe(before + 2)
    const sale = executeBookstoreSale(further, BOOKSTORE_BRANCH_ID, lastBook())
    expect(sale.status).toBe('sold')
    if (sale.status !== 'sold') throw new Error('expected sale')
    expect(findBookstoreStockQuantity(sale.state.bookstoreOperations.records[0], 'bookstore-merch-008')).toBe(before + 1)
  })

  it('orders delivery before a later sale opportunity and is equivalent under large and partitioned advancement', () => {
    const placed = placeBookstoreRestockOrder(earn(createInitialGameState(), 7), BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    if (placed.status !== 'ordered') throw new Error('expected order')
    const timed: GameState = { ...placed.state, bookstoreSalesCadence: { records: placed.state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 2_100_000 })) } }
    const large = advanceGameState(timed, 2_400_000, () => 0.5, () => 0.999, lastBook())
    let partitioned = advanceGameState(timed, 600_000, () => 0.5, () => 0.999, lastBook())
    partitioned = advanceGameState(partitioned, 1_200_000, () => 0.5, () => 0.999, lastBook())
    partitioned = advanceGameState(partitioned, 600_000, () => 0.5, () => 0.999, lastBook())
    expect(partitioned).toEqual(large)
    expect(large.bookstoreRestock.orders[0].status).toBe('DELIVERED')
    expect(large.bookstoreCommerce.records[0].completedSales).toHaveLength(timed.bookstoreCommerce.records[0].completedSales.length + 1)
  })
})

describe('Bookstore assortment expansion', () => {
  it('routes Northline orders through ordinary settlement, delivery, assortment, and sale paths', () => {
    const initial = createInitialGameState()
    const funded = earn(initial, 6)
    expect(balance(funded, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(12_000)
    expect(funded.bookstoreCommerce.records[0].assortment).toHaveLength(8)

    const transactionsBefore = funded.dollarFinance.transactions.records.length
    const placed = placeBookstoreRestockOrder(funded, BOOKSTORE_BRANCH_ID, BOOKSTORE_NORTHLINE_NEW_TITLES_OFFER_ID)
    expect(placed.status).toBe('ordered')
    if (placed.status !== 'ordered') throw new Error('expected Northline order')
    expect(balance(placed.state, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(0)
    expect(balance(placed.state, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(12_000)
    expect(balance(placed.state, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(0)
    expect(placed.state.dollarFinance.transactions.records).toHaveLength(transactionsBefore + 1)
    expect(placed.state.dollarFinance.transactions.records.at(-1)).toMatchObject({
      sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID,
      destinationAccountId: NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID,
      amountCents: 12_000,
    })
    expect(placed.state.bookstoreRestock.orders.at(-1)).toMatchObject({
      status: 'IN_TRANSIT', sellerCompanyId: NORTHLINE_BOOK_SUPPLY_COMPANY_ID,
      capturedSellerDisplayName: 'Northline Book Supply', capturedOfferDisplayName: 'New Titles Pack',
      capturedDeliveryDurationMs: 2_700_000, remainingDeliveryMs: 2_700_000,
    })
    expect(deriveBookstoreIncomingStock(placed.state, BOOKSTORE_BRANCH_ID)).toBe(12)
    expect(placed.state.bookstoreCommerce.records[0].assortment).toHaveLength(8)
    for (const id of ['bookstore-book-010', 'bookstore-book-009', 'bookstore-book-011', 'bookstore-book-013']) {
      expect(findBookstoreStockQuantity(placed.state.bookstoreOperations.records[0], id)).toBe(0)
    }

    const historical = placed.state.bookstoreRestock.orders.at(-1)!
    const renamed: GameState = {
      ...placed.state,
      business: { ...placed.state.business, companies: placed.state.business.companies.map((company) => company.id === NORTHLINE_BOOK_SUPPLY_COMPANY_ID ? { ...company, displayName: 'Renamed Northline' } : company) },
      bookstoreCommerce: { ...placed.state.bookstoreCommerce, bookCatalog: placed.state.bookstoreCommerce.bookCatalog.map((book) => book.id === 'bookstore-book-010' ? { ...book, name: 'Renamed Terminal Light' } : book) },
      bookstoreRestock: { ...placed.state.bookstoreRestock, offers: placed.state.bookstoreRestock.offers.map((offer) => offer.id === BOOKSTORE_NORTHLINE_NEW_TITLES_OFFER_ID ? { ...offer, displayName: 'Changed Pack' } : offer) },
    }
    expect(renamed.bookstoreRestock.orders.at(-1)).toBe(historical)
    expect(historical.lines[0].capturedMerchandiseDisplayName).toBe('Terminal Light')

    const isolated: GameState = { ...placed.state, bookstoreSalesCadence: { records: placed.state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 10_000_000 })) } }
    const delivered = advanceGameState(isolated, 2_700_000, () => 0.5, () => 0.5, () => 0.5)
    expect(delivered.bookstoreCommerce.records[0].assortment).toHaveLength(12)
    expect(deriveBookstoreIncomingStock(delivered, BOOKSTORE_BRANCH_ID)).toBe(0)
    for (const id of ['bookstore-book-010', 'bookstore-book-009', 'bookstore-book-011', 'bookstore-book-013']) {
      expect(findBookstoreStockQuantity(delivered.bookstoreOperations.records[0], id)).toBe(3)
    }

    const samples = [0, 0.76]
    const sold = executeBookstoreSale(delivered, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    expect(sold.status).toBe('sold')
    if (sold.status !== 'sold') throw new Error('expected sale of newly carried title')
    expect(findBookstoreStockQuantity(sold.state.bookstoreOperations.records[0], 'bookstore-book-010')).toBe(2)
    expect(sold.state.bookstoreCommerce.records[0].completedSales.at(-1)?.lines).toEqual([
      { merchandiseId: 'bookstore-book-010', capturedName: 'Terminal Light', quantity: 1, capturedUnitPriceCents: 1_649 },
    ])
  })

  it('keeps a represented non-carried Book unavailable until its exact-once canonical delivery', () => {
    const terminalLightId = 'bookstore-book-010'
    const funded = earn(createInitialGameState(), 7)
    expect(funded.bookstoreCommerce.bookCatalog.find(({ id }) => id === terminalLightId)?.name).toBe('Terminal Light')
    expect(funded.bookstoreCommerce.bookCatalog).toHaveLength(24)
    expect(funded.bookstoreCommerce.records[0].assortment).not.toContain(terminalLightId)
    expect(findBookstoreStockQuantity(funded.bookstoreOperations.records[0], terminalLightId)).toBe(0)

    const offerId = 'test-terminal-light-offer'
    const offered: GameState = {
      ...funded,
      bookstoreRestock: { ...funded.bookstoreRestock, offers: [...funded.bookstoreRestock.offers, {
        id: offerId, displayName: 'Terminal Light Delivery', sellerCompanyId: ATLAS_DISTRIBUTION_COMPANY_ID,
        lines: [{ merchandiseId: terminalLightId, quantity: 3 }], totalPriceCents: 14_000, deliveryDurationMs: 60_000,
      }] },
    }
    const placed = placeBookstoreRestockOrder(offered, BOOKSTORE_BRANCH_ID, offerId)
    expect(placed.status).toBe('ordered')
    if (placed.status !== 'ordered') throw new Error('expected order')
    expect(placed.state.bookstoreCommerce.records[0].assortment).not.toContain(terminalLightId)
    expect(findBookstoreStockQuantity(placed.state.bookstoreOperations.records[0], terminalLightId)).toBe(0)
    expect(placed.state.bookstoreRestock.orders.at(-1)?.lines).toEqual([{
      merchandiseId: terminalLightId, capturedMerchandiseDisplayName: 'Terminal Light', quantity: 3,
    }])

    const delivered = advanceGameState(placed.state, 60_000, () => 0.5, () => 0.5, lastBook())
    expect(delivered.bookstoreCommerce.records[0].assortment.filter((id) => id === terminalLightId)).toHaveLength(1)
    expect(findBookstoreStockQuantity(delivered.bookstoreOperations.records[0], terminalLightId)).toBe(3)
    const repeated = advanceGameState(delivered, 60_000, () => 0.5, () => 0.5, lastBook())
    expect(repeated.bookstoreCommerce.records[0].assortment.filter((id) => id === terminalLightId)).toHaveLength(1)
    expect(findBookstoreStockQuantity(repeated.bookstoreOperations.records[0], terminalLightId)).toBe(3)
  })
})
