import { describe, expect, it } from 'vitest'
import {
  ATLAS_DISTRIBUTION_COMPANY_ID,
  ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID,
  BOOKSTORE_BRANCH_ID,
  BOOKSTORE_COMPANY_ID,
  BOOKSTORE_TREASURY_ACCOUNT_ID,
  NORTHLINE_BOOK_SUPPLY_COMPANY_ID,
} from '../../core/game/business'
import { BOOKSTORE_COMPACT_REFILL_OFFER_ID, BOOKSTORE_STANDARD_REFILL_OFFER_ID } from '../../core/game/bookstoreRestock'
import { placeBookstoreRestockOrderFromOperatedRemoteDevice } from '../../core/game/companyAdministration'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { createInitialGameState } from '../../core/game/initialState'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import type { GameState } from '../../core/game/types'
import { projectVeyraBusiness } from './veyraBusiness'

const PHONE_ID = 'host-phone-001'
const OPS_ID = 'host-lan-003'

function operating(state: GameState, targetDeviceId = PHONE_ID, viaServiceId = 'service-ssh-003', address = '198.51.100.61'): GameState {
  const accessed: GameState = {
    ...state,
    deviceAccess: { nextId: 2, established: [{ id: `access-${targetDeviceId}`, sourceDeviceId: state.player.localDevice.id, targetDeviceId, viaServiceId, privilege: 'USER' }] },
  }
  const connected = connectRemoteFromObservation(accessed, { targetDeviceId, address })
  if (connected.status !== 'connected') throw new Error(connected.status)
  return connected.state
}

/** Real represented sales, exactly as the running world produces Bookstore Treasury money. */
function earnRestockPrice(state: GameState, sales = 7): GameState {
  let next = state
  for (let index = 0; index < sales; index += 1) {
    const samples = [0, 0.999999]
    const sale = executeBookstoreSale(next, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    if (sale.status !== 'sold') throw new Error(`sale ${index} refused: ${sale.status}`)
    next = sale.state
  }
  return next
}

const company = (state: GameState) => {
  const projection = projectVeyraBusiness(state)
  if (projection.status !== 'company') throw new Error(projection.status)
  return projection
}

describe('VEYRA Business projection', () => {
  it('resolves the Company from the operated Device’s own administration authority', () => {
    const state = operating(createInitialGameState())
    expect(company(state).company.displayName).toBe('Bookstore')

    // Not the Company's existence, the Branch, the Treasury or the Device type: the authority.
    const renamed: GameState = { ...state, business: { ...state.business, companies: state.business.companies.map((entry) =>
      entry.id === BOOKSTORE_COMPANY_ID ? { ...entry, displayName: 'Corner Books' } : entry) } }
    expect(company(renamed).company.displayName).toBe('Corner Books')
  })

  it('states honestly that there is nothing to manage, rather than exposing Company truth', () => {
    const state = operating(createInitialGameState())
    const withoutAuthority: GameState = { ...state, business: { ...state.business, administrationSessions: [] } }
    expect(projectVeyraBusiness(withoutAuthority)).toEqual({ status: 'no_company_access' })

    // The Company, its Treasury, the Branch, the offers and the phone's own Financial Session are all still represented.
    expect(withoutAuthority.business.companies).toHaveLength(3)
    expect(withoutAuthority.business.treasuryDesignations).toHaveLength(3)
    expect(withoutAuthority.dollarFinance.sessions.active.some(({ clientDeviceId }) => clientDeviceId === PHONE_ID)).toBe(true)
  })

  it('refuses to choose between several administered Companies', () => {
    const state = operating(createInitialGameState())
    const both: GameState = { ...state, business: { ...state.business, administrationSessions: [
      ...state.business.administrationSessions,
      { id: 'company-administration-session-atlas-phone-v0', clientDeviceId: PHONE_ID, companyId: ATLAS_DISTRIBUTION_COMPANY_ID },
    ] } }
    expect(projectVeyraBusiness(both)).toEqual({ status: 'company_selection_unsupported' })
  })

  it('does not treat a dangling or malformed relationship as a second administered Company', () => {
    const state = operating(createInitialGameState())
    const withDangling: GameState = { ...state, business: { ...state.business, administrationSessions: [
      ...state.business.administrationSessions,
      { id: 'company-administration-session-dangling-v0', clientDeviceId: PHONE_ID, companyId: 'company-missing' },
    ] } }
    // Still exactly the Bookstore Company, never the truthful "you manage several" refusal.
    expect(company(withDangling).company.displayName).toBe('Bookstore')

    const withDuplicatedAtlas: GameState = { ...state, business: { ...state.business, administrationSessions: [
      ...state.business.administrationSessions,
      { id: 'company-administration-session-atlas-a-v0', clientDeviceId: PHONE_ID, companyId: ATLAS_DISTRIBUTION_COMPANY_ID },
      { id: 'company-administration-session-atlas-b-v0', clientDeviceId: PHONE_ID, companyId: ATLAS_DISTRIBUTION_COMPANY_ID },
    ] } }
    expect(company(withDuplicatedAtlas).company.displayName).toBe('Bookstore')
  })

  it('reads Company Funds from the Company’s own Treasury designation, never the phone Wallet', () => {
    const earned = operating(earnRestockPrice(createInitialGameState()))
    const treasury = earned.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_TREASURY_ACCOUNT_ID)!
    const phoneAccount = earned.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')!
    expect(treasury.balanceCents).toBeGreaterThan(0)
    expect(treasury.balanceCents).not.toBe(phoneAccount.balanceCents)
    expect(company(earned).company.fundsCents).toBe(treasury.balanceCents)

    // Removing the designation makes funds unavailable; it never falls back to the phone's Account.
    const undesignated: GameState = { ...earned, business: { ...earned.business, treasuryDesignations: earned.business.treasuryDesignations.filter(({ companyId }) => companyId !== BOOKSTORE_COMPANY_ID) } }
    expect(company(undesignated).company.fundsCents).toBeUndefined()
    // And an ambiguous designation is equally unavailable rather than resolved.
    const ambiguous: GameState = { ...earned, business: { ...earned.business, treasuryDesignations: [...earned.business.treasuryDesignations, { companyId: BOOKSTORE_COMPANY_ID, accountId: ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID }] } }
    expect(company(ambiguous).company.fundsCents).toBeUndefined()
  })

  it('projects inventory, offers and orders from the owning Bookstore records', () => {
    const state = operating(createInitialGameState())
    const branch = company(state).branch!
    const operations = state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!

    expect(branch.branchId).toBe(BOOKSTORE_BRANCH_ID)
    expect(branch.displayName).toBe('Bookstore Branch 01')
    expect(branch.location).toBe('18 Mercer Street')
    expect(branch.inventory).toEqual({
      totalStock: 360,
      shelfCapacity: operations.shelfCapacity,
      incomingStock: 0,
      titleCount: 8,
      items: operations.stock.map((entry) => ({
        merchandiseId: entry.merchandiseId,
        name: expect.any(String),
        quantity: entry.quantity,
      })),
    })

    // All represented offers, with their own represented values rather than restated ones.
    expect(branch.offers).toHaveLength(8)
    expect(branch.offers.map(({ sellerDisplayName }) => sellerDisplayName)).toEqual([
      'Atlas Distribution', 'Atlas Distribution',
      'Northline Book Supply', 'Northline Book Supply', 'Northline Book Supply',
      'Northline Book Supply', 'Northline Book Supply', 'Northline Book Supply',
    ])
    expect(branch.offers.map(({ sellerCompanyId }) => sellerCompanyId)).toEqual([
      ATLAS_DISTRIBUTION_COMPANY_ID, ATLAS_DISTRIBUTION_COMPANY_ID,
      NORTHLINE_BOOK_SUPPLY_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID,
      NORTHLINE_BOOK_SUPPLY_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID,
    ])
    expect(branch.offers.map(({ averageUnitCostCents }) => averageUnitCostCents)).toEqual([875, 850, 1_000, 1_100, 1_050, 1_050, 1_100, 1_100])
    expect(branch.offers.map(({ displayName }) => displayName)).not.toContain('New Titles Pack')
    expect(branch.offers[0].lines).toHaveLength(8)
    expect(branch.orders).toEqual([])
  })

  it('follows an order through payment, transit and delivery without owning any of it', () => {
    const operated = operating(earnRestockPrice(createInitialGameState()))
    const fundsBefore = company(operated).company.fundsCents!
    const stockBefore = company(operated).branch!.inventory.totalStock

    const placed = placeBookstoreRestockOrderFromOperatedRemoteDevice(operated, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(placed.status).toBe('ordered')

    const ordered = company(placed.state)
    // Paid for, in transit, and not yet sellable.
    expect(ordered.company.fundsCents).toBe(fundsBefore - 14_000)
    expect(ordered.branch!.inventory.totalStock).toBe(stockBefore)
    expect(ordered.branch!.inventory.incomingStock).toBe(16)
    expect(ordered.branch!.orders).toEqual([{
      id: 'bookstore-restock-order-0001',
      offerDisplayName: 'Compact Shelf Refill',
      sellerDisplayName: 'Atlas Distribution',
      totalUnits: 16,
      status: 'IN_TRANSIT',
      remainingDeliveryMs: 1_800_000,
    }])

    // Captured order meaning, never re-resolved from current offers.
    const renamedOffer: GameState = { ...placed.state, bookstoreRestock: { ...placed.state.bookstoreRestock, offers: placed.state.bookstoreRestock.offers.map((offer) =>
      offer.id === BOOKSTORE_COMPACT_REFILL_OFFER_ID ? { ...offer, displayName: 'Renamed Bundle' } : offer) } }
    expect(company(renamedOffer).branch!.orders[0].offerDisplayName).toBe('Compact Shelf Refill')

    // Canonical advancement alone moves the order and the stock. The Branch's
    // own sales cadence legitimately sells during any advancement, so this one
    // pushes its next represented opportunity beyond the window rather than
    // proving the delivery consequence against a moving shelf.
    const quiet: GameState = { ...placed.state, bookstoreSalesCadence: { records: placed.state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 7_200_000 })) } }
    const midway = company(advanceGameState(quiet, 600_000)).branch!.orders[0]
    expect(midway.status).toBe('IN_TRANSIT')
    expect(midway.remainingDeliveryMs).toBe(1_200_000)

    const delivered = company(advanceGameState(quiet, 1_800_000)).branch!
    expect(delivered.orders[0]).toEqual({
      id: 'bookstore-restock-order-0001',
      offerDisplayName: 'Compact Shelf Refill',
      sellerDisplayName: 'Atlas Distribution',
      totalUnits: 16,
      status: 'DELIVERED',
      remainingDeliveryMs: undefined,
    })
    expect(delivered.inventory.incomingStock).toBe(0)
    expect(delivered.inventory.totalStock).toBe(stockBefore + 16)
  })

  it('keeps installed software, Company authority and the phone Financial Session independent', () => {
    const earned = operating(earnRestockPrice(createInitialGameState()))
    const signedOut: GameState = { ...earned, dollarFinance: { ...earned.dollarFinance, sessions: { ...earned.dollarFinance.sessions,
      active: earned.dollarFinance.sessions.active.filter(({ clientDeviceId }) => clientDeviceId !== PHONE_ID) } } }

    // With no Wallet Account on this phone at all, Business resolves exactly as before and the order still settles.
    const projected = company(signedOut)
    expect(projected.company.displayName).toBe('Bookstore')
    expect(projected.company.fundsCents).toBe(earned.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_TREASURY_ACCOUNT_ID)!.balanceCents)
    const placed = placeBookstoreRestockOrderFromOperatedRemoteDevice(signedOut, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(placed.status).toBe('ordered')
    expect(placed.state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')!.balanceCents)
      .toBe(earned.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')!.balanceCents)
  })

  it('presents no manageable Branch where a single supported one cannot be resolved', () => {
    const state = operating(createInitialGameState())
    const withoutOperations: GameState = { ...state, bookstoreOperations: { records: [] } }
    expect(company(withoutOperations).branch).toBeUndefined()
    expect(company(withoutOperations).company.displayName).toBe('Bookstore')

    const secondBranch: GameState = {
      ...state,
      business: { ...state.business, branches: [...state.business.branches, { ...state.business.branches[0], id: 'bookstore-branch-02', displayName: 'Bookstore Branch 02' }] },
      bookstoreCommerce: { ...state.bookstoreCommerce, records: [...state.bookstoreCommerce.records, { ...state.bookstoreCommerce.records[0], branchId: 'bookstore-branch-02' }] },
      bookstoreOperations: { records: [...state.bookstoreOperations.records, { ...state.bookstoreOperations.records[0], branchId: 'bookstore-branch-02' }] },
    }
    expect(company(secondBranch).branch).toBeUndefined()
  })

  it('is not resolvable for a Device that is merely operated', () => {
    const ops = operating(createInitialGameState(), OPS_ID, 'service-ssh-004', '203.0.113.43')
    expect(projectVeyraBusiness(ops)).toEqual({ status: 'no_company_access' })
    expect(projectVeyraBusiness(createInitialGameState())).toEqual({ status: 'no_company_access' })
  })
})

describe('VEYRA Business catalog disclosure boundary', () => {
  it('projects only carried Books in inventory while naming a non-carried Book referenced by an offer', () => {
    const state = operating(createInitialGameState())
    const terminalLight = state.bookstoreCommerce.bookCatalog.find(({ name }) => name === 'Terminal Light')!
    const offer = {
      id: 'test-terminal-offer', displayName: 'Terminal Light Delivery', sellerCompanyId: ATLAS_DISTRIBUTION_COMPANY_ID,
      lines: [{ merchandiseId: terminalLight.id, quantity: 3 }], totalPriceCents: 1_000, deliveryDurationMs: 60_000,
    }
    const projected = projectVeyraBusiness({ ...state, bookstoreRestock: { ...state.bookstoreRestock, offers: [offer] } })
    expect(projected.status).toBe('company')
    if (projected.status !== 'company' || !projected.branch) return
    expect(projected.branch.inventory.items.map(({ merchandiseId }) => merchandiseId)).not.toContain(terminalLight.id)
    expect(projected.branch.inventory.items).toHaveLength(8)
    expect(projected.branch.offers[0].lines).toEqual([{ merchandiseId: terminalLight.id, name: 'Terminal Light', quantity: 3 }])
  })

  it('keeps a carried zero-stock Book visible as distinct from a catalog-only Book', () => {
    const state = operating(createInitialGameState())
    const zeroed: GameState = { ...state, bookstoreOperations: { records: state.bookstoreOperations.records.map((record) => ({ ...record, stock: record.stock.map((entry) => entry.merchandiseId === 'bookstore-merch-001' ? { ...entry, quantity: 0 } : entry) })) } }
    const projected = projectVeyraBusiness(zeroed)
    expect(projected.status).toBe('company')
    if (projected.status !== 'company' || !projected.branch) return
    expect(projected.branch.inventory.items.find(({ merchandiseId }) => merchandiseId === 'bookstore-merch-001')?.quantity).toBe(0)
    expect(projected.branch.inventory.items.some(({ name }) => name === 'Terminal Light')).toBe(false)
  })

  it('does not present an ambiguous Catalog identity as a resolved offer title', () => {
    const state = operating(createInitialGameState())
    const ambiguous: GameState = {
      ...state,
      bookstoreCommerce: { ...state.bookstoreCommerce, bookCatalog: [...state.bookstoreCommerce.bookCatalog, { ...state.bookstoreCommerce.bookCatalog[0], name: 'Ambiguous Night Transit' }] },
    }
    const projected = projectVeyraBusiness(ambiguous)
    expect(projected.status).toBe('company')
    if (projected.status !== 'company' || !projected.branch) return
    expect(projected.branch.inventory.items.some(({ merchandiseId }) => merchandiseId === 'bookstore-merch-001')).toBe(false)
    expect(projected.branch.offers[0].lines.some(({ merchandiseId }) => merchandiseId === 'bookstore-merch-001')).toBe(false)
  })
})
