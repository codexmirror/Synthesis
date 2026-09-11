import { describe, expect, it, vi } from 'vitest'
import { ATLAS_DISTRIBUTION_COMPANY_ID, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPANY_ID, BOOKSTORE_TREASURY_ACCOUNT_ID } from './business'
import { BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID, BOOKSTORE_BACKEND_DEVICE_ID, BOOKSTORE_BACKEND_SERVICE_ID } from './bookstoreBackend'
import { BOOKSTORE_HOUSE_COFFEE_ID, selectBookstoreCoffeePurchaseMode } from './bookstoreCoffee'
import { resolveBookstoreCommerceForBranch } from './bookstoreCommerce'
import { purchaseBookstoreCoffeeMachineForDevice, purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice } from './companyAdministration'
import { executeCivicDollarMovement } from './dollarFinance'
import { executeBookstoreSale, RETAIL_CLEARING_ACCOUNT_ID } from './bookstoreSale'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState, GAME_STATE_VERSION } from './initialState'
import type { GameState } from './types'

const branchId = BOOKSTORE_BRANCH_ID
const phoneId = 'host-phone-001'
const balance = (s: GameState, id: string) => s.dollarFinance.accounts.find(a => a.id === id)!.balanceCents
const operations = (s: GameState) => s.bookstoreOperations.records[0]
const sales = (s: GameState) => s.bookstoreCommerce.records[0].completedSales
const buy = (s: GameState) => purchaseBookstoreCoffeeMachineForDevice(s, phoneId, branchId)
const never = () => { throw new Error('Unexpected random draw') }
function sequence(values: readonly number[]) {
  let index = 0
  return vi.fn(() => values[index++ % values.length])
}
function funded() {
  const result = executeCivicDollarMovement(createInitialGameState(), 'dollar-account-local-v0', BOOKSTORE_TREASURY_ACCOUNT_ID, 25_000)
  if (result.status !== 'moved') throw new Error(result.status)
  return result.state
}
function installed() {
  const result = buy(funded())
  if (result.status !== 'installed') throw new Error(result.status)
  return result.state
}
function noBooks(s: GameState): GameState {
  return { ...s, bookstoreOperations: { records: s.bookstoreOperations.records.map(o => ({ ...o, stock: o.stock.map(line => ({ ...line, quantity: 0 })) })) } }
}
function checkout(s: GameState, mode: number, gratuity = sequence([0]), books = sequence([0, 0.999999])) {
  return executeBookstoreSale(s, branchId, books, gratuity, () => mode)
}

describe('Bookstore Coffee Machine purchase', () => {
  it('seeds no machine, a distinct Coffee offering and unchanged historical sale in the new schema', () => {
    const state = createInitialGameState()
    expect(state.version).toBe(GAME_STATE_VERSION)
    expect(GAME_STATE_VERSION).toBe(90)
    expect(operations(state).coffeeMachine).toBeUndefined()
    expect(state.bookstoreCommerce.coffeeOffering).toEqual({ id: BOOKSTORE_HOUSE_COFFEE_ID, name: 'House Coffee', unitPriceCents: 350 })
    expect(state.bookstoreCommerce.bookCatalog.some(book => book.id === BOOKSTORE_HOUSE_COFFEE_ID)).toBe(false)
    expect(sales(state)).toEqual([{ id: 'bookstore-sale-0001', kind: 'book_sale', dollarTransactionId: 'dollar-transaction-0001', lines: [{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2000 }] }])
  })

  it('pays exactly $250 between current Company Treasuries, installs persistently and creates no revenue or authority', () => {
    const before = funded()
    const result = buy(before)
    expect(result.status).toBe('installed')
    if (result.status !== 'installed') throw new Error(result.status)
    expect(balance(result.state, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(0)
    expect(balance(result.state, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(25_000)
    expect(result.state.dollarFinance.transactions.records).toHaveLength(before.dollarFinance.transactions.records.length + 1)
    expect(result.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ id: result.transactionId, sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, destinationAccountId: ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, amountCents: 25_000, statementContext: { description: 'Atlas Distribution', purpose: 'Coffee Machine' } })
    expect(operations(result.state).coffeeMachine).toEqual({ id: `bookstore-coffee-machine-${branchId}`, purchaseTransactionId: result.transactionId })
    expect(operations(result.state).stock).toBe(operations(before).stock)
    expect(result.state.bookstoreCommerce).toBe(before.bookstoreCommerce)
    expect(result.state.business).toBe(before.business)
    expect(result.state.dollarFinance.sessions).toBe(before.dollarFinance.sessions)
    expect(result.state.dollarFinance.credentials).toBe(before.dollarFinance.credentials)
    expect(balance(result.state, BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID))
    const ticked = advanceGameState(result.state, 1000, never, never, never, never, never)
    expect(operations(ticked).coffeeMachine).toEqual(operations(result.state).coffeeMachine)
    expect(ticked.dollarFinance).toBe(result.state.dollarFinance)
    expect(JSON.parse(JSON.stringify(ticked)).bookstoreOperations.records[0].coffeeMachine).toEqual(operations(result.state).coffeeMachine)
  })

  it('resolves Treasury designations instead of settlement or personal financial sessions', () => {
    const base = funded()
    const alternative = { id: 'alternative-atlas-treasury', accountReference: 'CD-TEST', balanceCents: 0 }
    const state: GameState = { ...base,
      dollarFinance: { ...base.dollarFinance, accounts: [...base.dollarFinance.accounts, alternative], sessions: { ...base.dollarFinance.sessions, active: [] } },
      business: { ...base.business, treasuryDesignations: base.business.treasuryDesignations.map(d => d.companyId === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...d, accountId: alternative.id } : d) },
      bookstoreCommerce: { ...base.bookstoreCommerce, records: base.bookstoreCommerce.records.map(c => ({ ...c, settlementAccountId: 'missing-settlement' })) },
    }
    const result = buy(state)
    expect(result.status).toBe('installed')
    expect(balance(result.state, alternative.id)).toBe(25_000)
    expect(balance(result.state, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(0)
  })

  it('refuses insufficient funds, unauthorized devices, absent remote context, and duplicates without partial state', () => {
    const empty = createInitialGameState()
    expect(buy(empty)).toEqual({ status: 'payment_refused', state: empty })
    const ready = funded()
    expect(purchaseBookstoreCoffeeMachineForDevice(ready, ready.player.localDevice.id, branchId)).toEqual({ status: 'administration_unavailable', state: ready })
    expect(purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice(ready, branchId)).toEqual({ status: 'session_unavailable', state: ready })
    const done = buy(ready).state
    expect(buy(done)).toEqual({ status: 'already_installed', state: done })
    expect(buy(done).state).toBe(done)
  })

  const invalid: readonly [string, (s: GameState) => GameState][] = [
    ['missing branch', s => ({ ...s, business: { ...s.business, branches: [] } })],
    ['duplicate branch', s => ({ ...s, business: { ...s.business, branches: [...s.business.branches, s.business.branches[0]] } })],
    ['missing buyer company', s => ({ ...s, business: { ...s.business, companies: s.business.companies.filter(c => c.id !== BOOKSTORE_COMPANY_ID) } })],
    ['duplicate buyer company', s => ({ ...s, business: { ...s.business, companies: [...s.business.companies, s.business.companies[0]] } })],
    ['missing Atlas', s => ({ ...s, business: { ...s.business, companies: s.business.companies.filter(c => c.id !== ATLAS_DISTRIBUTION_COMPANY_ID) } })],
    ['duplicate Atlas', s => ({ ...s, business: { ...s.business, companies: [...s.business.companies, s.business.companies.find(c => c.id === ATLAS_DISTRIBUTION_COMPANY_ID)!] } })],
    ['missing operations', s => ({ ...s, bookstoreOperations: { records: [] } })],
    ['duplicate operations', s => ({ ...s, bookstoreOperations: { records: [...s.bookstoreOperations.records, operations(s)] } })],
    ['missing commerce', s => ({ ...s, bookstoreCommerce: { ...s.bookstoreCommerce, records: [] } })],
    ['missing administration', s => ({ ...s, business: { ...s.business, administrationSessions: [] } })],
    ['missing buyer Treasury', s => ({ ...s, business: { ...s.business, treasuryDesignations: s.business.treasuryDesignations.filter(d => d.companyId !== BOOKSTORE_COMPANY_ID) } })],
    ['missing seller Treasury', s => ({ ...s, business: { ...s.business, treasuryDesignations: s.business.treasuryDesignations.filter(d => d.companyId !== ATLAS_DISTRIBUTION_COMPANY_ID) } })],
    ['dangling Treasury', s => ({ ...s, dollarFinance: { ...s.dollarFinance, accounts: s.dollarFinance.accounts.filter(a => a.id !== ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID) } })],
    ['ambiguous Treasury', s => ({ ...s, business: { ...s.business, treasuryDesignations: [...s.business.treasuryDesignations, s.business.treasuryDesignations[0]] } })],
    ['same Account', s => ({ ...s, business: { ...s.business, treasuryDesignations: s.business.treasuryDesignations.map(d => d.companyId === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...d, accountId: BOOKSTORE_TREASURY_ACCOUNT_ID } : d) } })],
    ['unrepresentable credit', s => ({ ...s, dollarFinance: { ...s.dollarFinance, accounts: s.dollarFinance.accounts.map(a => a.id === ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID ? { ...a, balanceCents: Number.MAX_SAFE_INTEGER } : a) } })],
  ]
  it.each(invalid)('atomically refuses %s', (_, change) => {
    const state = change(funded())
    const snapshot = structuredClone(state)
    const result = buy(state)
    expect(result.status).not.toBe('installed')
    expect(result.state).toBe(state)
    expect(state).toEqual(snapshot)
  })
})

describe('Coffee purchase composition and gratuity', () => {
  it('preserves initial Book composition and tip semantics without drawing Coffee RNG', () => {
    const state = createInitialGameState()
    const books = sequence([0.8, 0, 0.999999])
    const gratuity = sequence([0.75, 0.4])
    const result = executeBookstoreSale(state, branchId, books, gratuity, never)
    expect(result.status).toBe('sold')
    expect(sales(result.state).at(-1)).toMatchObject({ kind: 'book_sale', lines: [
      { merchandiseId: 'bookstore-merch-001', quantity: 1, capturedUnitPriceCents: 899 },
      { merchandiseId: 'bookstore-merch-008', quantity: 1, capturedUnitPriceCents: 2000 },
    ] })
    expect(books).toHaveBeenCalledTimes(3)
    expect(gratuity).toHaveBeenCalledTimes(2)
  })

  it.each([[0, 'books_only'], [0.599999999, 'books_only'], [0.6, 'books_and_coffee'], [0.899999999, 'books_and_coffee'], [0.9, 'coffee_only'], [0.999999999, 'coffee_only']] as const)('selects mode at %s as %s', (sample, expected) => {
    const random = vi.fn(() => sample)
    expect(selectBookstoreCoffeePurchaseMode(random)).toBe(expected)
    expect(random).toHaveBeenCalledTimes(1)
  })

  it.each([[0.1, 'book_sale', 2899, 2], [0.6, 'book_and_coffee_sale', 3249, 3], [0.9, 'coffee_sale', 350, 1]] as const)('settles exact composition for mode %s', (mode, kind, amount, lineCount) => {
    const before = installed()
    const books = sequence([0.8, 0, 0.999999])
    const result = checkout(before, mode, sequence([0]), books)
    expect(result.status).toBe('sold')
    const sale = sales(result.state).at(-1)!
    expect(sale.kind).toBe(kind)
    expect(sale.lines).toHaveLength(lineCount)
    expect(sale.lines.reduce((sum, l) => sum + l.quantity * l.capturedUnitPriceCents, 0)).toBe(amount)
    expect(result.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ sourceAccountId: RETAIL_CLEARING_ACCOUNT_ID, destinationAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, amountCents: amount })
    expect(balance(result.state, BOOKSTORE_TREASURY_ACCOUNT_ID) - balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(amount)
    expect(balance(result.state, BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID))
    expect(books).toHaveBeenCalledTimes(mode === 0.9 ? 0 : 3)
    if (mode !== 0.1) expect(sale.lines.at(-1)).toEqual({ merchandiseId: BOOKSTORE_HOUSE_COFFEE_ID, capturedName: 'House Coffee', quantity: 1, capturedUnitPriceCents: 350 })
    expect(operations(result.state).stock.reduce((sum, l) => sum + l.quantity, 0)).toBe(mode === 0.9 ? 360 : 358)
    expect(sales(result.state)[0]).toBe(sales(before)[0])
  })

  it('sells Coffee with zero Book stock, no Book catalog/demand and no Book RNG', () => {
    const base = noBooks(installed())
    const state = { ...base, bookstoreCommerce: { ...base.bookstoreCommerce, bookCatalog: [] }, bookstoreMarket: { genrePressures: [] } }
    const result = executeBookstoreSale(state, branchId, never, () => 0, () => 0.9)
    expect(result.status).toBe('sold')
    expect(operations(result.state)).toBe(operations(state))
    expect(sales(result.state).at(-1)?.kind).toBe('coffee_sale')
  })

  it.each([0, 0.6])('loses unfulfillable Book-dependent mode %s without reroll or gratuity', mode => {
    const state = noBooks(installed())
    const coffee = sequence([mode, 0.9])
    const result = executeBookstoreSale(state, branchId, never, never, coffee)
    expect(result).toEqual({ status: 'out_of_stock', state })
    expect(coffee).toHaveBeenCalledTimes(1)
  })

  it.each([[0.1, 0.75], [0.6, 0.5], [0.9, 0.65]])('uses actual composition for mode %s occurrence boundary %s', (mode, threshold) => {
    const before = installed()
    for (const [sample, tips] of [[0, false], [threshold - 1e-9, false], [threshold, true], [0.99999999, true]] as const) {
      const random = sequence([sample, 0])
      const result = checkout(before, mode, random)
      expect(result.status).toBe('sold')
      expect(Boolean(sales(result.state).at(-1)?.gratuityTransactionId)).toBe(tips)
      expect(random).toHaveBeenCalledTimes(tips ? 2 : 1)
    }
  })

  it.each([[0, 10], [1 / 3 - 1e-9, 10], [1 / 3, 15], [2 / 3 - 1e-9, 15], [2 / 3, 20], [0.999999, 20]])('keeps equal tip-tier boundary %s at %s percent of the whole settled purchase', (sample, percent) => {
    for (const mode of [0.1, 0.6, 0.9]) {
      const before = installed()
      const result = checkout(before, mode, sequence([0.99, sample]))
      const sale = sales(result.state).at(-1)!
      const merchandise = result.state.dollarFinance.transactions.records.find(t => t.id === sale.dollarTransactionId)!
      const tip = result.state.dollarFinance.transactions.records.find(t => t.id === sale.gratuityTransactionId)!
      const expected = Math.floor((merchandise.amountCents * percent + 50) / 100)
      expect(tip.id).not.toBe(merchandise.id)
      expect(tip).toMatchObject({ sourceAccountId: RETAIL_CLEARING_ACCOUNT_ID, destinationAccountId: BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID, amountCents: expected })
      expect(merchandise.destinationAccountId).toBe(BOOKSTORE_TREASURY_ACCOUNT_ID)
      expect(balance(result.state, BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID) - balance(before, BOOKSTORE_GRATUITY_DESTINATION_ACCOUNT_ID)).toBe(expected)
    }
  })

  it('captures current Coffee price/name once and keeps existing sales unchanged after repricing', () => {
    const state = installed()
    const first = checkout(state, 0.9).state
    const renamed: GameState = { ...first, bookstoreCommerce: { ...first.bookstoreCommerce, coffeeOffering: { ...first.bookstoreCommerce.coffeeOffering, name: 'Renamed Coffee', unitPriceCents: 400 } } }
    const second = checkout(renamed, 0.9).state
    expect(sales(second).at(-2)).toEqual(sales(first).at(-1))
    expect(sales(second).at(-1)?.lines[0]).toMatchObject({ capturedName: 'Renamed Coffee', capturedUnitPriceCents: 400 })
    expect(resolveBookstoreCommerceForBranch(second, branchId)?.sales.at(-2)?.transaction.amountCents).toBe(350)
  })

  it.each(['device', 'service'] as const)('refuses Coffee checkout when the Backend %s is unavailable', cause => {
    const before = installed()
    const state: GameState = { ...before, world: { network: { ...before.world.network, hosts: before.world.network.hosts.map(h => h.id === BOOKSTORE_BACKEND_DEVICE_ID ? {
      ...h, ...(cause === 'device' ? { operational: { ...h.operational, connectivity: 'DISCONNECTED' as const } } : { services: h.services?.map(s => s.id === BOOKSTORE_BACKEND_SERVICE_ID ? { ...s, open: false } : s) }),
    } : h) } } }
    const result = executeBookstoreSale(state, branchId, never, never, () => 0.9)
    expect(result).toEqual({ status: 'backend_unavailable', state })
  })

  it('does not reroll unaffordable Coffee or evaluate gratuity on refusal', () => {
    const base = installed()
    const state: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: base.dollarFinance.accounts.map(a => a.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...a, balanceCents: 349 } : a) } }
    const coffee = sequence([0.9, 0])
    expect(executeBookstoreSale(state, branchId, never, never, coffee)).toEqual({ status: 'insufficient_funds', state })
    expect(coffee).toHaveBeenCalledTimes(1)
  })
})

describe('Coffee semantic RNG channels and chronological cadence', () => {
  it('draws only demand, Coffee and gratuity at a due Coffee-only sale; draws none on an ordinary tick', () => {
    const state = installed()
    const demand = sequence([1 - Math.exp(-1)])
    const coffee = sequence([0.9])
    const tip = sequence([0.65, 0.5])
    const ticked = advanceGameState(state, 1000, never, demand, never, tip, coffee)
    expect(demand).not.toHaveBeenCalled()
    expect(coffee).not.toHaveBeenCalled()
    expect(tip).not.toHaveBeenCalled()
    const due = advanceGameState(ticked, 359000, never, demand, never, tip, coffee)
    expect(demand).toHaveBeenCalledTimes(1)
    expect(coffee).toHaveBeenCalledTimes(1)
    expect(tip).toHaveBeenCalledTimes(2)
    expect(sales(due).at(-1)?.kind).toBe('coffee_sale')
  })

  it('never draws Coffee for due opportunities before installation', () => {
    const state = createInitialGameState()
    const books = sequence([0, 0.999999])
    const next = advanceGameState(state, 720000, never, () => 1 - Math.exp(-1), books, () => 0, never)
    expect(sales(next)).toHaveLength(3)
    expect(books).toHaveBeenCalledTimes(4)
  })

  it('preserves complete state and every RNG sequence under large versus partitioned advancement', () => {
    const state = installed()
    function channels() { return { demand: sequence([1 - Math.exp(-1)]), books: sequence([0.8, 0, 0.999999, 0.1, 0.4]), coffee: sequence([0.1, 0.6, 0.9]), tip: sequence([0.1, 0.9, 0.4, 0.65, 0.8]) } }
    const a = channels(), b = channels()
    const step = (s: GameState, ms: number, c: ReturnType<typeof channels>) => advanceGameState(s, ms, never, c.demand, c.books, c.tip, c.coffee)
    const large = step(state, 3600000, a)
    let partitioned = state
    for (let i = 0; i < 30; i++) partitioned = step(partitioned, 120000, b)
    expect(partitioned).toEqual(large)
    for (const key of ['demand', 'books', 'coffee', 'tip'] as const) expect(a[key].mock.results).toEqual(b[key].mock.results)
    expect(a.coffee).toHaveBeenCalledTimes(10)
    expect(new Set(sales(large).map(s => s.kind))).toEqual(new Set(['book_sale', 'book_and_coffee_sale', 'coffee_sale']))
  })
})
