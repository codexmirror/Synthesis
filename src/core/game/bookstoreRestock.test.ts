import { describe, expect, it } from 'vitest'
import { ATLAS_DISTRIBUTION_COMPANY_ID, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPANY_ID, BOOKSTORE_TREASURY_ACCOUNT_ID, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID } from './business'
import { executeBookstoreSale } from './bookstoreSale'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { advanceBookstoreRestockDeliveries, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, deriveBookstoreIncomingStockForBook, deriveBookstoreLastAcquisitionCost, deriveBookstoreMaxOrderableCases, NORTHLINE_SOURCEABLE_BOOK_IDS, placeBookstoreRestockOrder, proposeBookstoreRestockOrder } from './bookstoreRestock'
import { deriveBookstoreTotalStock, findBookstoreStockQuantity } from './bookstoreOperations'
import type { GameState } from './types'

function fund(state: GameState, cents = 100_000): GameState { return { ...state, dollarFinance: { ...state.dollarFinance, accounts: state.dollarFinance.accounts.map(a => a.id === BOOKSTORE_TREASURY_ACCOUNT_ID ? { ...a, balanceCents: cents } : a) } } }
const proposal = (state: GameState, offerId: string, caseCount: number, selectedMerchandiseId?: string) => { const result = proposeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, offerId, { caseCount, selectedMerchandiseId }); if (result.status !== 'proposed') throw new Error(result.status); return result.proposal }
const balance = (state: GameState, id: string) => state.dollarFinance.accounts.find(a => a.id === id)!.balanceCents
const lastBook = () => { const samples = [0, 0.999999]; return () => samples.shift() ?? 0 }

describe('Bookstore Case Procurement V1', () => {
  it('authors exactly two durable offers with fixed case truth and an explicit Northline set', () => {
    const offers = createInitialGameState().bookstoreRestock.offers
    expect(offers).toEqual([
      expect.objectContaining({ id: BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, displayName: 'Mixed Shelf Refill', kind: 'MIXED_SHELF_REFILL', caseSize: 16, casePriceCents: 14_000, deliveryDurationMs: 1_800_000, sourceableMerchandiseIds: [] }),
      expect.objectContaining({ id: BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, displayName: 'Title Case', kind: 'TITLE_CASE', caseSize: 6, casePriceCents: 6_300, deliveryDurationMs: 2_700_000, sourceableMerchandiseIds: [...NORTHLINE_SOURCEABLE_BOOK_IDS] }),
    ])
    expect(offers.every(offer => !('lines' in offer) && !('totalPriceCents' in offer))).toBe(true)
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

  it('allocates Atlas with stable-ID ties and ignores Baseline Popularity', () => {
    const base = createInitialGameState(); const zeroed = { ...base, bookstoreOperations: { records: base.bookstoreOperations.records.map(r => ({ ...r, stock: r.stock.map(s => ({ ...s, quantity: 0 })).reverse() })) } }
    const first = proposal(zeroed, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    expect(first.lines.map(l => l.merchandiseId)).toEqual([...zeroed.bookstoreCommerce.records[0].assortment].sort())
    expect(first.lines.every(l => l.quantity === 2)).toBe(true)
    const changedDemand = { ...zeroed, bookstoreCommerce: { ...zeroed.bookstoreCommerce, bookCatalog: zeroed.bookstoreCommerce.bookCatalog.map(d => ({ ...d, baselinePopularity: d.baselinePopularity * 9 })) } }
    expect(proposal(changedDemand, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1).lines).toEqual(first.lines)
  })

  it('changes Atlas allocation for differentiated per-Book incoming quantities from Northline', () => {
    const base = fund(createInitialGameState())
    const zeroed: GameState = { ...base, bookstoreOperations: { records: base.bookstoreOperations.records.map(record => ({ ...record, stock: record.stock.map(stock => ({ ...stock, quantity: 0 })) })) } }
    const northline = proposal(zeroed, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, 1, 'bookstore-merch-006')
    const placed = placeBookstoreRestockOrder(zeroed, BOOKSTORE_BRANCH_ID, { caseCount: 1, selectedMerchandiseId: 'bookstore-merch-006' }, northline)
    if (placed.status !== 'ordered') throw new Error(placed.status)
    const atlas = proposal(placed.state, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    expect(atlas.lines.map(({ merchandiseId, quantity }) => ({ merchandiseId, quantity }))).toEqual([
      { merchandiseId: 'bookstore-merch-001', quantity: 3 },
      { merchandiseId: 'bookstore-merch-002', quantity: 3 },
      { merchandiseId: 'bookstore-merch-003', quantity: 2 },
      { merchandiseId: 'bookstore-merch-004', quantity: 2 },
      { merchandiseId: 'bookstore-merch-005', quantity: 2 },
      { merchandiseId: 'bookstore-merch-007', quantity: 2 },
      { merchandiseId: 'bookstore-merch-008', quantity: 2 },
    ])
    expect(atlas.lines.some(line => line.merchandiseId === 'bookstore-merch-006')).toBe(false)
  })

  it('fails closed for malformed procurement kinds and malformed Catalog identity', () => {
    const state = createInitialGameState()
    const malformedKind: GameState = { ...state, bookstoreRestock: { ...state.bookstoreRestock, offers: state.bookstoreRestock.offers.map(offer => offer.id === BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID ? { ...offer, kind: 'UNKNOWN' as never } : offer) } }
    expect(proposeBookstoreRestockOrder(malformedKind, BOOKSTORE_BRANCH_ID, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, { caseCount: 1 }).status).toBe('invalid_offer')
    const ambiguousCatalog: GameState = { ...state, bookstoreCommerce: { ...state.bookstoreCommerce, bookCatalog: [...state.bookstoreCommerce.bookCatalog, { ...state.bookstoreCommerce.bookCatalog[0], name: 'Duplicate identity' }] } }
    expect(proposeBookstoreRestockOrder(ambiguousCatalog, BOOKSTORE_BRANCH_ID, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, { caseCount: 1 }).status).toBe('invalid_offer')
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

  it('resolves buyer and seller Accounts through current Treasury designations', () => {
    const base = fund(createInitialGameState())
    const changed: GameState = {
      ...base,
      business: { ...base.business, treasuryDesignations: base.business.treasuryDesignations.map(designation =>
        designation.companyId === BOOKSTORE_COMPANY_ID ? { ...designation, accountId: 'dollar-account-local-v0' }
          : designation.companyId === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...designation, accountId: 'dollar-account-veyra-phone-v0' } : designation) },
      dollarFinance: { ...base.dollarFinance, accounts: base.dollarFinance.accounts.map(account => account.id === 'dollar-account-local-v0' ? { ...account, balanceCents: 100_000 } : account) },
    }
    const reviewed = proposal(changed, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    const phoneBefore = balance(changed, 'dollar-account-veyra-phone-v0')
    const placed = placeBookstoreRestockOrder(changed, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, reviewed)
    if (placed.status !== 'ordered') throw new Error(placed.status)
    expect(placed.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ sourceAccountId: 'dollar-account-local-v0', destinationAccountId: 'dollar-account-veyra-phone-v0', amountCents: 14_000 })
    expect(balance(placed.state, 'dollar-account-local-v0')).toBe(86_000)
    expect(balance(placed.state, 'dollar-account-veyra-phone-v0')).toBe(phoneBefore + 14_000)
    expect(balance(placed.state, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(100_000)
  })

  it.each([
    ['missing buyer Treasury', (state: GameState) => ({ ...state, business: { ...state.business, treasuryDesignations: state.business.treasuryDesignations.filter(designation => designation.companyId !== BOOKSTORE_COMPANY_ID) } })],
    ['missing seller Treasury', (state: GameState) => ({ ...state, business: { ...state.business, treasuryDesignations: state.business.treasuryDesignations.filter(designation => designation.companyId !== ATLAS_DISTRIBUTION_COMPANY_ID) } })],
  ])('atomically refuses %s', (_label, arrange) => {
    const funded = fund(createInitialGameState())
    const reviewed = proposal(funded, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    const input = arrange(funded); const before = structuredClone(input)
    const result = placeBookstoreRestockOrder(input, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, reviewed)
    expect(result).toEqual({ status: 'payment_refused', state: input })
    expect(result.state).toBe(input); expect(result.state).toEqual(before)
  })

  it('refuses capacity before settlement without any partial consequence', () => {
    const funded = fund(createInitialGameState()); const reviewed = proposal(funded, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    const full: GameState = { ...funded, bookstoreOperations: { records: funded.bookstoreOperations.records.map(record => ({ ...record, shelfCapacity: deriveBookstoreTotalStock(record) })) } }
    const before = structuredClone(full)
    expect(placeBookstoreRestockOrder(full, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, reviewed)).toEqual({ status: 'capacity_exceeded', state: full })
    expect(full).toEqual(before)
  })

  it('keeps historical meaning and delivers captured lines after current truth changes', () => {
    const funded = fund(createInitialGameState()); const reviewed = proposal(funded, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    const placed = placeBookstoreRestockOrder(funded, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, reviewed); if (placed.status !== 'ordered') throw new Error(placed.status)
    const historical = placed.state.bookstoreRestock.orders[0]
    const changed: GameState = {
      ...placed.state,
      business: { ...placed.state.business, companies: placed.state.business.companies.map(company => company.id === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...company, displayName: 'Renamed Atlas' } : company) },
      bookstoreCommerce: { ...placed.state.bookstoreCommerce, bookCatalog: placed.state.bookstoreCommerce.bookCatalog.map(book => ({ ...book, name: `Renamed ${book.id}` })) },
      bookstoreRestock: { ...placed.state.bookstoreRestock, offers: placed.state.bookstoreRestock.offers.map(offer => offer.id === BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID ? { ...offer, displayName: 'Changed offer', caseSize: 32, casePriceCents: 1 } : offer) },
    }
    expect(changed.bookstoreRestock.orders[0]).toBe(historical)
    expect(historical.capturedSellerDisplayName).toBe('Atlas Distribution'); expect(historical.capturedOfferDisplayName).toBe('Mixed Shelf Refill'); expect(historical.lines).toEqual(reviewed.lines)
    const quantitiesBefore = new Map(changed.bookstoreOperations.records[0].stock.map(stock => [stock.merchandiseId, stock.quantity]))
    const delivered = advanceBookstoreRestockDeliveries(changed, historical.capturedDeliveryDurationMs)
    for (const line of historical.lines) expect(findBookstoreStockQuantity(delivered.bookstoreOperations.records[0], line.merchandiseId)).toBe(quantitiesBefore.get(line.merchandiseId)! + line.quantity)
    expect(advanceBookstoreRestockDeliveries(delivered, historical.capturedDeliveryDurationMs)).toEqual(delivered)
  })

  it('feeds delivered captured stock into the ordinary sale path', () => {
    const base = fund(createInitialGameState()); const reviewed = proposal(base, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, 1, 'bookstore-book-010')
    const placed = placeBookstoreRestockOrder(base, BOOKSTORE_BRANCH_ID, { caseCount: 1, selectedMerchandiseId: 'bookstore-book-010' }, reviewed); if (placed.status !== 'ordered') throw new Error(placed.status)
    const delivered = advanceBookstoreRestockDeliveries(placed.state, 2_700_000)
    const terminalOnly: GameState = { ...delivered, bookstoreOperations: { records: delivered.bookstoreOperations.records.map(record => ({ ...record, stock: record.stock.map(stock => stock.merchandiseId === 'bookstore-book-010' ? stock : { ...stock, quantity: 0 }) })) } }
    const sold = executeBookstoreSale(terminalOnly, BOOKSTORE_BRANCH_ID, () => 0)
    expect(sold.status).toBe('sold'); if (sold.status !== 'sold') throw new Error(sold.status)
    expect(findBookstoreStockQuantity(sold.state.bookstoreOperations.records[0], 'bookstore-book-010')).toBe(5)
  })

  it('keeps large and partitioned advancement equivalent when delivery precedes a sale opportunity', () => {
    const base = fund(createInitialGameState()); const reviewed = proposal(base, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    const placed = placeBookstoreRestockOrder(base, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, reviewed); if (placed.status !== 'ordered') throw new Error(placed.status)
    const timed: GameState = { ...placed.state, bookstoreSalesCadence: { records: placed.state.bookstoreSalesCadence.records.map(record => ({ ...record, remainingUntilOpportunityMs: 2_100_000 })) } }
    const large = advanceGameState(timed, 2_400_000, () => 0.5, () => 0.999, lastBook(), () => 0)
    let partitioned = advanceGameState(timed, 600_000, () => 0.5, () => 0.999, lastBook(), () => 0)
    partitioned = advanceGameState(partitioned, 1_200_000, () => 0.5, () => 0.999, lastBook(), () => 0)
    partitioned = advanceGameState(partitioned, 600_000, () => 0.5, () => 0.999, lastBook(), () => 0)
    expect(partitioned).toEqual(large); expect(large.bookstoreRestock.orders[0].status).toBe('DELIVERED')
    expect(large.bookstoreCommerce.records[0].completedSales).toHaveLength(timed.bookstoreCommerce.records[0].completedSales.length + 1)
  })

  it('does not duplicate the assortment relation after repeat Northline delivery', () => {
    let state = fund(createInitialGameState())
    for (let index = 0; index < 2; index++) {
      const reviewed = proposal(state, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, 1, 'bookstore-book-010')
      const placed = placeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, { caseCount: 1, selectedMerchandiseId: 'bookstore-book-010' }, reviewed); if (placed.status !== 'ordered') throw new Error(placed.status)
      state = advanceBookstoreRestockDeliveries(placed.state, 2_700_000)
    }
    expect(state.bookstoreCommerce.records[0].assortment.filter(id => id === 'bookstore-book-010')).toHaveLength(1)
    expect(findBookstoreStockQuantity(state.bookstoreOperations.records[0], 'bookstore-book-010')).toBe(12)
  })

  it('captures exact unit costs and assigns delivery chronology independently of placement order', () => {
    const initial = fund(createInitialGameState())
    // Northbound begins low enough that Atlas's normal projected-stock
    // allocator still includes it after Northline's six incoming units.
    let state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map(record => ({ ...record, stock: record.stock.map(line => line.merchandiseId === 'bookstore-merch-006' ? { ...line, quantity: 0 } : line) })) } }
    expect(deriveBookstoreLastAcquisitionCost(state, BOOKSTORE_BRANCH_ID, 'bookstore-merch-006')).toBeUndefined()
    const northlineProposal = proposal(state, BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, 1, 'bookstore-merch-006')
    const northline = placeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, { caseCount: 1, selectedMerchandiseId: 'bookstore-merch-006' }, northlineProposal)
    if (northline.status !== 'ordered') throw new Error(northline.status)
    state = northline.state
    const atlasProposal = proposal(state, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
    const atlas = placeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, atlasProposal)
    if (atlas.status !== 'ordered') throw new Error(atlas.status)
    state = atlas.state
    const northlineLine = state.bookstoreRestock.orders[0].lines.find(line => line.merchandiseId === 'bookstore-merch-006')
    const atlasLine = state.bookstoreRestock.orders[1].lines.find(line => line.merchandiseId === 'bookstore-merch-006')
    expect(northlineLine?.capturedUnitAcquisitionCostCents).toBe(1_050)
    expect(atlasLine?.capturedUnitAcquisitionCostCents).toBe(875)
    for (const order of state.bookstoreRestock.orders) {
      const transaction = state.dollarFinance.transactions.records.find(record => record.id === order.dollarTransactionId)!
      expect(order.lines.reduce((sum, line) => sum + line.quantity * line.capturedUnitAcquisitionCostCents, 0)).toBe(transaction.amountCents)
      expect(order.deliveredSequence).toBeUndefined()
    }
    expect(deriveBookstoreIncomingStockForBook(state, BOOKSTORE_BRANCH_ID, 'bookstore-merch-006')).toBeGreaterThan(0)
    const large = advanceBookstoreRestockDeliveries(state, 2_700_000)
    const atlasOrder = large.bookstoreRestock.orders.find(order => order.offerId === BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID)!
    const northlineOrder = large.bookstoreRestock.orders.find(order => order.offerId === BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID)!
    expect(atlasOrder.deliveredSequence).toBeLessThan(northlineOrder.deliveredSequence!)
    expect(deriveBookstoreLastAcquisitionCost(large, BOOKSTORE_BRANCH_ID, 'bookstore-merch-006')).toBe(1_050)
    const partitioned = advanceBookstoreRestockDeliveries(advanceBookstoreRestockDeliveries(state, 1_800_000), 900_000)
    expect(partitioned).toEqual(large)
    expect(advanceBookstoreRestockDeliveries(large, 1)).toEqual(large)
  })

  it('uses stable Order identity to sequence deliveries due at the same represented instant', () => {
    let state = fund(createInitialGameState())
    for (let index = 0; index < 2; index++) {
      const reviewed = proposal(state, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, 1)
      const placed = placeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, reviewed)
      if (placed.status !== 'ordered') throw new Error(placed.status)
      state = placed.state
    }
    // Array position is deliberately reversed; stable identity remains the tie-break.
    state = { ...state, bookstoreRestock: { ...state.bookstoreRestock, orders: [...state.bookstoreRestock.orders].reverse() } }
    const large = advanceBookstoreRestockDeliveries(state, 1_800_000)
    const ordered = [...large.bookstoreRestock.orders].sort((a, b) => a.id.localeCompare(b.id))
    expect(ordered[0].deliveredSequence).toBeLessThan(ordered[1].deliveredSequence!)
    const partitioned = advanceBookstoreRestockDeliveries(advanceBookstoreRestockDeliveries(state, 900_000), 900_000)
    expect(partitioned).toEqual(large)
  })

})
