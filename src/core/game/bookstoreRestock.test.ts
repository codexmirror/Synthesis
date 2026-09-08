import { describe, expect, it } from 'vitest'
import { ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, BOOKSTORE_BRANCH_ID, BOOKSTORE_TREASURY_ACCOUNT_ID, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID } from './business'
import { createInitialGameState } from './initialState'
import { advanceBookstoreRestockDeliveries, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, deriveBookstoreMaxOrderableCases, NORTHLINE_SOURCEABLE_BOOK_IDS, placeBookstoreRestockOrder, proposeBookstoreRestockOrder } from './bookstoreRestock'
import { deriveBookstoreTotalStock, findBookstoreStockQuantity } from './bookstoreOperations'
import type { GameState } from './types'

function fund(state: GameState, cents = 100_000): GameState { return { ...state, dollarFinance: { ...state.dollarFinance, accounts: state.dollarFinance.accounts.map(a => a.id === BOOKSTORE_TREASURY_ACCOUNT_ID ? { ...a, balanceCents: cents } : a) } } }
const proposal = (state: GameState, offerId: string, caseCount: number, selectedMerchandiseId?: string) => { const result = proposeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, offerId, { caseCount, selectedMerchandiseId }); if (result.status !== 'proposed') throw new Error(result.status); return result.proposal }
const balance = (state: GameState, id: string) => state.dollarFinance.accounts.find(a => a.id === id)!.balanceCents

describe('Bookstore Case Procurement V1', () => {
  it('authors exactly two durable offers with fixed case truth and an explicit Northline set', () => {
    const offers = createInitialGameState().bookstoreRestock.offers
    expect(offers).toEqual([
      expect.objectContaining({ id: BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, displayName: 'Mixed Shelf Refill', kind: 'MIXED_SHELF_REFILL', caseSize: 16, casePriceCents: 14_000, deliveryDurationMs: 1_800_000, sourceableMerchandiseIds: [] }),
      expect.objectContaining({ id: BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, displayName: 'Title Case', kind: 'TITLE_CASE', caseSize: 6, casePriceCents: 6_300, deliveryDurationMs: 2_700_000, sourceableMerchandiseIds: [...NORTHLINE_SOURCEABLE_BOOK_IDS] }),
    ])
  })

  it('scales units and price by cases while capacity changes only the maximum', () => {
    const state = createInitialGameState(); const atlas = state.bookstoreRestock.offers[0]; const northline = state.bookstoreRestock.offers[1]
    expect(proposal(state, atlas.id, 3)).toMatchObject({ totalUnits: 48, totalPriceCents: 42_000 })
    expect(proposal(state, northline.id, 4, 'bookstore-book-010')).toMatchObject({ totalUnits: 24, totalPriceCents: 25_200 })
    const larger = { ...state, bookstoreOperations: { records: state.bookstoreOperations.records.map(r => ({ ...r, shelfCapacity: 1_000 })) } }
    expect(larger.bookstoreRestock.offers).toEqual(state.bookstoreRestock.offers)
    expect(deriveBookstoreMaxOrderableCases(larger, BOOKSTORE_BRANCH_ID, atlas)).toBe(Math.floor((1_000 - deriveBookstoreTotalStock(state.bookstoreOperations.records[0])) / 16))
    expect(deriveBookstoreMaxOrderableCases(larger, BOOKSTORE_BRANCH_ID, northline)).toBe(Math.floor((1_000 - deriveBookstoreTotalStock(state.bookstoreOperations.records[0])) / 6))
  })

  it('validates positive safe case counts and Northline sourceability', () => {
    const state = createInitialGameState()
    for (const caseCount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(proposeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, { caseCount }).status).toBe('invalid_decisions')
    expect(proposeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, { caseCount: 1, selectedMerchandiseId: 'bookstore-book-011' }).status).toBe('invalid_decisions')
  })

  it('allocates Atlas by physical plus incoming stock with stable-ID ties and ignores Demand', () => {
    const base = createInitialGameState(); const zeroed = { ...base, bookstoreOperations: { records: base.bookstoreOperations.records.map(r => ({ ...r, stock: r.stock.map(s => ({ ...s, quantity: 0 })).reverse() })) } }
    const first = proposal(zeroed, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    expect(first.lines.map(l => l.merchandiseId)).toEqual([...zeroed.bookstoreCommerce.records[0].assortment].sort())
    expect(first.lines.every(l => l.quantity === 2)).toBe(true)
    const changedDemand = { ...zeroed, bookstoreCommerce: { ...zeroed.bookstoreCommerce, bookDemand: zeroed.bookstoreCommerce.bookDemand.map(d => ({ ...d, weight: d.weight * 9 })) } }
    expect(proposal(changedDemand, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1).lines).toEqual(first.lines)
    const placed = placeBookstoreRestockOrder(fund(zeroed), BOOKSTORE_BRANCH_ID, { caseCount: 1 }, first)
    if (placed.status !== 'ordered') throw new Error(placed.status)
    expect(proposal(placed.state, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1).lines).toEqual(first.lines)
  })

  it('atomically refuses a stale Atlas proposal and settles exact current Company Treasuries otherwise', () => {
    const funded = fund(createInitialGameState()); const reviewed = proposal(funded, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 3)
    const changed = { ...funded, bookstoreOperations: { records: funded.bookstoreOperations.records.map(r => ({ ...r, stock: r.stock.map((s, i) => i === 0 ? { ...s, quantity: s.quantity - 1 } : s) })) } }
    const before = structuredClone(changed); expect(placeBookstoreRestockOrder(changed, BOOKSTORE_BRANCH_ID, { caseCount: 3 }, reviewed)).toEqual({ status: 'proposal_changed', state: changed }); expect(changed).toEqual(before)
    const placed = placeBookstoreRestockOrder(funded, BOOKSTORE_BRANCH_ID, { caseCount: 3 }, reviewed); if (placed.status !== 'ordered') throw new Error(placed.status)
    expect(balance(placed.state, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(58_000); expect(balance(placed.state, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(42_000)
    expect(placed.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, destinationAccountId: ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, amountCents: 42_000 })
    expect(placed.state.bookstoreRestock.orders[0].lines).toEqual(reviewed.lines)
  })

  it('uses one Northline path and adds an uncarried title only at exact-once delivery', () => {
    const funded = fund(createInitialGameState()); const reviewed = proposal(funded, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, 4, 'bookstore-book-010')
    const placed = placeBookstoreRestockOrder(funded, BOOKSTORE_BRANCH_ID, { caseCount: 4, selectedMerchandiseId: 'bookstore-book-010' }, reviewed); if (placed.status !== 'ordered') throw new Error(placed.status)
    expect(balance(placed.state, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(25_200); expect(placed.state.bookstoreCommerce.records[0].assortment).not.toContain('bookstore-book-010')
    const delivered = advanceBookstoreRestockDeliveries(placed.state, 2_700_000); expect(findBookstoreStockQuantity(delivered.bookstoreOperations.records[0], 'bookstore-book-010')).toBe(24); expect(delivered.bookstoreCommerce.records[0].assortment.filter(id => id === 'bookstore-book-010')).toHaveLength(1)
    expect(advanceBookstoreRestockDeliveries(delivered, 2_700_000)).toEqual(delivered)
  })
})
