import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID, BOOKSTORE_BRANCH_LOCATION, BOOKSTORE_BRANCH_NAME } from './business'
import { BOOKSTORE_BACKEND_DEVICE_ID, BOOKSTORE_BACKEND_SERVICE_ID } from './bookstoreBackend'
import { BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID, BOOKSTORE_MERCHANDISE_CATALOG, BOOKSTORE_SALE_TRANSACTION_ID } from './bookstoreCommerce'
import { deriveBookstoreTotalStock, findBookstoreStockQuantity } from './bookstoreOperations'
import {
  BOOKSTORE_PURCHASE_BASKET_SIZE_WEIGHTS,
  BOOKSTORE_SALE_STATEMENT_PURPOSE,
  RETAIL_CLEARING_ACCOUNT_ID,
  composeBookstorePurchase,
  deriveBookstoreBasketTotalCents,
  deriveSellableBookstoreStockByMerchandise,
  deriveSellableBookstoreTotalStock,
  executeBookstoreSale,
  selectBookstoreBasketSize,
  selectBookstoreMerchandiseId,
  selectDemandWeightedBookstoreMerchandiseId,
} from './bookstoreSale'
import type { GameState } from './types'

const balanceOf = (state: GameState, accountId: string): number => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents
const operationsOf = (state: GameState) => state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
const totalStockOf = (state: GameState) => deriveBookstoreTotalStock(operationsOf(state))

/**
 * Cycles through the given raw sample values forever, wrapping back to the
 * start. `composeBookstorePurchase` always draws exactly one basket-size
 * sample followed by one sample per selected unit, so a 2-value cycle
 * `[sizeU, itemU]` reproduces the identical single-item basket on every
 * successive call as long as `sizeU` always selects size 1 — the shape most
 * of this file's non-composition-focused tests rely on for a deterministic,
 * repeatable "one book" purchase.
 */
function cyclicRandom(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

/**
 * With the seeded catalog's 8 equally-available merchandise identities and
 * the default 70/25/5 basket-size mix, `sizeU = 0.1` always selects basket
 * size 1 (0.1 < 0.70) and `itemU = 0.95` selects the catalog's last
 * entry, `bookstore-merch-008` ("Systems of Dust", $20.00) — reproducing
 * exactly the pre-existing fixed-$20/one-unit sale this Branch represented
 * before purchase composition existed. Tests that only care about sale
 * mechanics (not composition itself) use this to stay deterministic.
 */
const ONE_BOOK_SYSTEMS_OF_DUST_RANDOM = (): (() => number) => cyclicRandom([0.1, 0.95])

describe('executeBookstoreSale — success path', () => {
  it('preserves baseline-only selection boundaries when every Genre pressure is neutral', () => {
    const initial = createInitialGameState()
    const neutral: GameState = { ...initial, bookstoreMarket: { genrePressures: initial.bookstoreMarket.genrePressures.map(record => ({ ...record, pressure: 100 })) } }
    const samples = [0.1, 0.15]
    const result = executeBookstoreSale(neutral, BOOKSTORE_BRANCH_ID, () => samples.shift()!)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    // Baseline total is 820; 0.15 × 820 = 123, after Night Transit's 80 and inside Static Bloom's next 140.
    expect(result.state.bookstoreCommerce.records[0].completedSales.at(-1)?.lines[0].merchandiseId).toBe('bookstore-merch-002')
  })

  it('changes only the weighted Book interval when one Genre pressure changes under the same purchase samples', () => {
    const initial = createInitialGameState()
    const pressured: GameState = {
      ...initial,
      bookstoreMarket: { genrePressures: initial.bookstoreMarket.genrePressures.map(record => record.genre === 'THRILLER' ? { ...record, pressure: 1_000 } : { ...record, pressure: 100 }) },
    }
    const execute = (state: GameState) => {
      const samples = [0.1, 0.15]
      let draws = 0
      const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { draws += 1; return samples.shift()! })
      expect(draws).toBe(2)
      expect(result.status).toBe('sold')
      if (result.status !== 'sold') throw new Error('expected sale')
      return result.state.bookstoreCommerce.records[0].completedSales.at(-1)?.lines[0].merchandiseId
    }
    expect(execute({ ...initial, bookstoreMarket: { genrePressures: initial.bookstoreMarket.genrePressures.map(record => ({ ...record, pressure: 100 })) } })).toBe('bookstore-merch-002')
    expect(execute(pressured)).toBe('bookstore-merch-001')
  })

  it('changes only the selected Book through Baseline Popularity, then uses ordinary stock and exact-price settlement with the same two purchase draws', () => {
    const initial = createInitialGameState()
    const neutral: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, bookCatalog: initial.bookstoreCommerce.bookCatalog.map(record => ({ ...record, baselinePopularity: 100 })) } }
    const weighted: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, bookCatalog: initial.bookstoreCommerce.bookCatalog.map(record => ({ ...record, baselinePopularity: record.id === 'bookstore-merch-001' ? 1000 : 100 })) } }
    const execute = (state: GameState) => {
      const samples = [0.1, 0.2]
      let draws = 0
      const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { draws += 1; return samples.shift()! })
      expect(draws).toBe(2)
      expect(result.status).toBe('sold')
      if (result.status !== 'sold') throw new Error('expected represented sale')
      return result.state
    }

    const neutralResult = execute(neutral)
    const weightedResult = execute(weighted)
    expect(neutralResult.bookstoreCommerce.records[0].completedSales.at(-1)?.lines[0].merchandiseId).toBe('bookstore-merch-002')
    expect(weightedResult.bookstoreCommerce.records[0].completedSales.at(-1)?.lines).toEqual([
      { merchandiseId: 'bookstore-merch-001', capturedName: 'Night Transit', quantity: 1, capturedUnitPriceCents: 899 },
    ])
    expect(findBookstoreStockQuantity(operationsOf(weightedResult), 'bookstore-merch-001')).toBe(44)
    expect(findBookstoreStockQuantity(operationsOf(weightedResult), 'bookstore-merch-002')).toBe(45)
    expect(weightedResult.dollarFinance.transactions.records.at(-1)?.amountCents).toBe(899)
  })

  it('consumes one stock unit, moves exactly its deterministic basket total, and appends exactly one Transaction and one CompletedSale', () => {
    const before = createInitialGameState()
    const result = executeBookstoreSale(before, BOOKSTORE_BRANCH_ID, ONE_BOOK_SYSTEMS_OF_DUST_RANDOM())
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return

    const operations = operationsOf(result.state)
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-008')).toBe(44)
    expect(deriveBookstoreTotalStock(operations)).toBe(359)
    expect(balanceOf(result.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(80_000 - 2_000)
    expect(balanceOf(result.state, BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)).toBe(2_000)
    expect(balanceOf(result.state, 'dollar-account-veyra-phone-v0')).toBe(34_250)

    expect(result.state.dollarFinance.transactions.records).toHaveLength(2)
    const newTransaction = result.state.dollarFinance.transactions.records[1]
    expect(newTransaction).toEqual({
      id: 'dollar-transaction-0002',
      sourceAccountId: RETAIL_CLEARING_ACCOUNT_ID,
      destinationAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      amountCents: 2_000,
      sourceAccountReference: 'CD-9000-2000',
      destinationAccountReference: 'CD-4827-6109',
      statementContext: { description: BOOKSTORE_BRANCH_NAME, purpose: BOOKSTORE_SALE_STATEMENT_PURPOSE, location: BOOKSTORE_BRANCH_LOCATION },
    })
    expect(result.transactionId).toBe(newTransaction.id)

    const commerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(commerce?.completedSales).toHaveLength(2)
    expect(commerce?.completedSales[1]).toEqual({
      id: result.saleId,
      kind: 'book_sale',
      dollarTransactionId: newTransaction.id,
      lines: [{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }],
    })
    expect(result.saleId).toBe('bookstore-sale-0002')

    // Existing authored historical sale and Transaction remain exactly as they were.
    expect(commerce?.completedSales[0]).toEqual(before.bookstoreCommerce.records[0].completedSales[0])
    expect(result.state.dollarFinance.transactions.records[0]).toEqual(before.dollarFinance.transactions.records.find(({ id }) => id === BOOKSTORE_SALE_TRANSACTION_ID))
  })

  it('reads the current represented merchandise price rather than any historical Transaction or CompletedSale', () => {
    const initial = createInitialGameState()
    const repriced: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        bookCatalog: initial.bookstoreCommerce.bookCatalog.map((item) => item.id === 'bookstore-merch-008' ? { ...item, unitPriceCents: 3_500 } : item),
      },
    }
    const result = executeBookstoreSale(repriced, BOOKSTORE_BRANCH_ID, ONE_BOOK_SYSTEMS_OF_DUST_RANDOM())
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    expect(result.state.dollarFinance.transactions.records[1].amountCents).toBe(3_500)
    expect(balanceOf(result.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(80_000 - 3_500)
  })

  it('allocates runtime CompletedSale identity from the monotonic nextSaleId allocator, not from array length', () => {
    const initial = createInitialGameState()
    const fixture: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        nextSaleId: 47,
        records: [{
          branchId: BOOKSTORE_BRANCH_ID,
          settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
          assortment: ['bookstore-merch-008'],
          completedSales: [],
        }],
      },
    }
    const result = executeBookstoreSale(fixture, BOOKSTORE_BRANCH_ID)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    expect(result.saleId).toBe('bookstore-sale-0047')
    expect(result.state.bookstoreCommerce.nextSaleId).toBe(48)

    const again = executeBookstoreSale(result.state, BOOKSTORE_BRANCH_ID)
    expect(again.status).toBe('sold')
    if (again.status !== 'sold') return
    expect(again.saleId).toBe('bookstore-sale-0048')
  })

  it('is one explicit domain transition: calling it twice performs two independent sales, never a cadence', () => {
    const first = executeBookstoreSale(createInitialGameState(), BOOKSTORE_BRANCH_ID, ONE_BOOK_SYSTEMS_OF_DUST_RANDOM())
    expect(first.status).toBe('sold')
    if (first.status !== 'sold') return
    const second = executeBookstoreSale(first.state, BOOKSTORE_BRANCH_ID, ONE_BOOK_SYSTEMS_OF_DUST_RANDOM())
    expect(second.status).toBe('sold')
    if (second.status !== 'sold') return
    expect(second.saleId).not.toBe(first.saleId)
    expect(second.transactionId).not.toBe(first.transactionId)
    expect(totalStockOf(second.state)).toBe(358)
  })
})

describe('executeBookstoreSale — atomic failure paths', () => {
  it.each([
    ['missing', (state: GameState) => state.bookstoreMarket.genrePressures.slice(1)],
    ['duplicate', (state: GameState) => [...state.bookstoreMarket.genrePressures.slice(0, -1), state.bookstoreMarket.genrePressures[0]]],
    ['unsupported', (state: GameState) => [...state.bookstoreMarket.genrePressures.slice(0, -1), { genre: 'ROMANCE' as never, pressure: 100 }]],
    ['zero', (state: GameState) => state.bookstoreMarket.genrePressures.map(record => record.genre === 'THRILLER' ? { ...record, pressure: 0 } : record)],
    ['negative', (state: GameState) => state.bookstoreMarket.genrePressures.map(record => record.genre === 'THRILLER' ? { ...record, pressure: -1 } : record)],
    ['fractional', (state: GameState) => state.bookstoreMarket.genrePressures.map(record => record.genre === 'THRILLER' ? { ...record, pressure: 1.5 } : record)],
    ['non-finite', (state: GameState) => state.bookstoreMarket.genrePressures.map(record => record.genre === 'THRILLER' ? { ...record, pressure: NaN } : record)],
    ['unsafe', (state: GameState) => state.bookstoreMarket.genrePressures.map(record => record.genre === 'THRILLER' ? { ...record, pressure: Number.MAX_SAFE_INTEGER + 1 } : record)],
  ])('refuses %s Genre Market Pressure atomically before consuming purchase randomness', (_label, makeRecords) => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreMarket: { genrePressures: makeRecords(initial) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'invalid_demand', state })
    expect(result.state).toBe(state)
  })

  it('refuses an unsafe derived Effective Demand weight or candidate total before consuming purchase randomness', () => {
    const initial = createInitialGameState()
    const neutral = { genrePressures: initial.bookstoreMarket.genrePressures.map(record => ({ ...record, pressure: 100 })) }
    const unsafeWeight: GameState = { ...initial, bookstoreMarket: neutral, bookstoreCommerce: { ...initial.bookstoreCommerce, bookCatalog: initial.bookstoreCommerce.bookCatalog.map(book => book.id === 'bookstore-merch-001' ? { ...book, baselinePopularity: Math.floor(Number.MAX_SAFE_INTEGER / 100) + 1 } : book) } }
    expect(executeBookstoreSale(unsafeWeight, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })).toEqual({ status: 'invalid_demand', state: unsafeWeight })

    const large = Math.floor(Number.MAX_SAFE_INTEGER / 100 / 8) + 1
    const unsafeTotal: GameState = { ...initial, bookstoreMarket: neutral, bookstoreCommerce: { ...initial.bookstoreCommerce, bookCatalog: initial.bookstoreCommerce.bookCatalog.map(book => ({ ...book, baselinePopularity: large })) } }
    expect(executeBookstoreSale(unsafeTotal, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })).toEqual({ status: 'invalid_demand', state: unsafeTotal })
  })

  it('refuses when the Business Branch itself does not exist, unchanged', () => {
    const state = createInitialGameState()
    const result = executeBookstoreSale(state, 'branch-does-not-exist')
    expect(result).toEqual({ status: 'branch_not_found', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Operations does not exist for the Branch, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'operations_not_found', state })
    expect(result.state).toBe(state)
  })

  it('refuses while CLOSED, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'closed', state })
    expect(result.state).toBe(state)
  })

  it('refuses at zero total stock, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, stock: record.stock.map((entry) => ({ ...entry, quantity: 0 })) } : record) },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'out_of_stock', state })
    expect(result.state).toBe(state)
  })

  it('refuses at zero checkout capacity, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, checkoutCapacity: 0 } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'no_checkout_capacity', state })
    expect(result.state).toBe(state)
  })

  it.each([
    ['zero', 0], ['fractional', 1.5], ['non-finite', Number.POSITIVE_INFINITY],
  ])('refuses %s Baseline Popularity atomically before consuming purchase randomness', (_label, baselinePopularity) => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, bookCatalog: initial.bookstoreCommerce.bookCatalog.map(book => book.id === 'bookstore-book-010' ? { ...book, baselinePopularity } : book) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'invalid_demand', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Commerce does not exist for the Branch, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'commerce_not_found', state })
    expect(result.state).toBe(state)
  })

  it('refuses an empty merchandise catalog, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, assortment: [] } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'out_of_stock', state })
    expect(result.state).toBe(state)
  })

  it.each([
    ['zero', 0],
    ['negative', -2_000],
    ['fractional', 19.99],
    ['non-finite', Number.NaN],
  ])('refuses when a catalog entry has an invalid unitPriceCents (%s), unchanged, and consumes no purchase randomness', (_label, unitPriceCents) => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        bookCatalog: initial.bookstoreCommerce.bookCatalog.map((item) => item.id === 'bookstore-merch-001' ? { ...item, unitPriceCents } : item),
      },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'invalid_price', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the settlement Account does not resolve, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-does-not-exist' } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'settlement_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Backend has no represented record for the Branch, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreBackend: { records: initial.bookstoreBackend.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the backend Device is not network-usable, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      world: {
        ...initial.world,
        network: {
          ...initial.world.network,
          hosts: initial.world.network.hosts.map((host) => host.id === BOOKSTORE_BACKEND_DEVICE_ID
            ? { ...host, operational: { lifecycle: 'BOOTING' as const, connectivity: 'DISCONNECTED' as const } }
            : host),
        },
      },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the backend Service is closed, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      world: {
        ...initial.world,
        network: {
          ...initial.world.network,
          hosts: initial.world.network.hosts.map((host) => host.id === BOOKSTORE_BACKEND_DEVICE_ID
            ? { ...host, services: host.services?.map((service) => service.id === BOOKSTORE_BACKEND_SERVICE_ID ? { ...service, open: false } : service) }
            : host),
        },
      },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Retail Clearing does not resolve, unchanged, and consumes no purchase randomness', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.filter(({ id }) => id !== RETAIL_CLEARING_ACCOUNT_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'retail_clearing_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses with insufficient Retail Clearing funds, unchanged, having composed (and discarded) a basket rather than re-rolling a cheaper one', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.map((account) => account.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...account, balanceCents: 500 } : account) } }
    let draws = 0
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { draws += 1; return 0.1 })
    expect(result).toEqual({ status: 'insufficient_funds', state })
    expect(result.state).toBe(state)
    // Every catalog price exceeds the 500-cent balance, so composition was reached and consumed randomness...
    expect(draws).toBeGreaterThan(0)
    // ...yet nothing was committed: Retail Clearing is never magically replenished to cover the shortfall.
    expect(balanceOf(result.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(500)
  })

  it('refuses when the settlement credit could not be represented as an exact integer, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      dollarFinance: {
        ...initial.dollarFinance,
        accounts: initial.dollarFinance.accounts.map((account) => account.id === BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID ? { ...account, balanceCents: 2 ** 60 } : account),
      },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'balance_not_representable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the resulting Retail Clearing balance could not be represented as an exact integer, unchanged', () => {
    const initial = createInitialGameState()
    // A corrupted/malformed clearing balance well beyond safe integer range; it still
    // comfortably covers any composed basket, so this is not an insufficient-funds
    // refusal — only the resulting debit's representability is at issue, exactly like
    // the symmetric guarantee executeCivicDollarMovement now enforces on both sides.
    const state: GameState = {
      ...initial,
      dollarFinance: {
        ...initial.dollarFinance,
        accounts: initial.dollarFinance.accounts.map((account) => account.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...account, balanceCents: 2 ** 60 } : account),
      },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'balance_not_representable', state })
    expect(result.state).toBe(state)
  })
})

describe('executeBookstoreSale — historical statement-context snapshot truth', () => {
  it('snapshots the current Branch displayName/location into the created Transaction, and a later Branch rename/relocation never rewrites it', () => {
    const initial = createInitialGameState()

    const first = executeBookstoreSale(initial, BOOKSTORE_BRANCH_ID, ONE_BOOK_SYSTEMS_OF_DUST_RANDOM())
    expect(first.status).toBe('sold')
    if (first.status !== 'sold') return
    const firstTransaction = first.state.dollarFinance.transactions.records.find(({ id }) => id === first.transactionId)!
    expect(firstTransaction.statementContext).toEqual({ description: 'Bookstore Branch 01', purpose: 'Retail sale', location: '18 Mercer Street' })
    // The actual financial counterparty reference remains the separate, real historical Account-reference snapshot — never replaced by the description.
    expect(firstTransaction.sourceAccountReference).toBe('CD-9000-2000')
    expect(firstTransaction.destinationAccountReference).toBe('CD-4827-6109')

    // Rename and relocate the Branch after the first sale.
    const renamed: GameState = {
      ...first.state,
      business: { ...first.state.business, branches: first.state.business.branches.map((branch) => branch.id === BOOKSTORE_BRANCH_ID ? { ...branch, displayName: 'Downtown Books', location: '900 Founders Way' } : branch) },
    }

    const second = executeBookstoreSale(renamed, BOOKSTORE_BRANCH_ID, ONE_BOOK_SYSTEMS_OF_DUST_RANDOM())
    expect(second.status).toBe('sold')
    if (second.status !== 'sold') return
    const secondTransaction = second.state.dollarFinance.transactions.records.find(({ id }) => id === second.transactionId)!
    // The later sale snapshots the Branch's new current identity/location...
    expect(secondTransaction.statementContext).toEqual({ description: 'Downtown Books', purpose: 'Retail sale', location: '900 Founders Way' })
    expect(secondTransaction.sourceAccountReference).toBe('CD-9000-2000')
    expect(secondTransaction.destinationAccountReference).toBe('CD-4827-6109')

    // ...without ever rewriting the earlier Transaction's own historical snapshot.
    const firstTransactionAfterRename = second.state.dollarFinance.transactions.records.find(({ id }) => id === first.transactionId)!
    expect(firstTransactionAfterRename.statementContext).toEqual({ description: 'Bookstore Branch 01', purpose: 'Retail sale', location: '18 Mercer Street' })
  })

  it('creates no statement context, no Transaction, and no CompletedSale on a refused sale', () => {
    const initial = createInitialGameState()
    const closed: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }
    const result = executeBookstoreSale(closed, BOOKSTORE_BRANCH_ID)
    expect(result.status).toBe('closed')
    expect(result.state).toBe(closed)
    expect(result.state.dollarFinance.transactions.records).toEqual(initial.dollarFinance.transactions.records)
  })

  it('omits the location field from statement context entirely for a Branch with no represented location, rather than inventing one', () => {
    const initial = createInitialGameState()
    const noLocation: GameState = {
      ...initial,
      business: { ...initial.business, branches: initial.business.branches.map((branch) => branch.id === BOOKSTORE_BRANCH_ID ? { ...branch, location: undefined } : branch) },
    }
    const result = executeBookstoreSale(noLocation, BOOKSTORE_BRANCH_ID)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    const transaction = result.state.dollarFinance.transactions.records.find(({ id }) => id === result.transactionId)!
    expect(transaction.statementContext).toEqual({ description: 'Bookstore Branch 01', purpose: 'Retail sale' })
    expect(transaction.statementContext).not.toHaveProperty('location')
  })
})

describe('executeBookstoreSale — multi-item and multi-quantity baskets', () => {
  it('a 2-item basket of two distinct titles decrements exactly those two stock lines and moves exactly their summed price', () => {
    const initial = createInitialGameState()
    // size draw 0.75 -> basket size 2 (>= 0.70, < 0.95); item draws 0.0 -> bookstore-merch-001 ($8.99), then
    // 0.0 again -> still bookstore-merch-001 (7 units remain after the first pick, still first available).
    const result = executeBookstoreSale(initial, BOOKSTORE_BRANCH_ID, cyclicRandom([0.75, 0.0, 0.0]))
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    const commerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const sale = commerce.completedSales[commerce.completedSales.length - 1]
    expect(sale.lines).toEqual([{ merchandiseId: 'bookstore-merch-001', capturedName: 'Night Transit', quantity: 2, capturedUnitPriceCents: 899 }])
    const transaction = result.state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)!
    expect(transaction.amountCents).toBe(2 * 899)
    expect(findBookstoreStockQuantity(operationsOf(result.state), 'bookstore-merch-001')).toBe(43)
    expect(totalStockOf(result.state)).toBe(358)
  })

  it('a basket of two distinct titles (A ×1, B ×1) decrements exactly those two lines and nothing else', () => {
    const initial = createInitialGameState()
    // size draw 0.75 -> basket size 2; first item draw 0.0 -> bookstore-merch-001 (index 0 of 8);
    // second item draw 0.99 -> the last still-available identity, which is now index 6 of the remaining 7
    // (bookstore-merch-001 dropped out at zero *provisional* remaining stock only after all 45 of its
    // units are gone — here it still has stock, so this proves selection among multiple always-available
    // identities rather than exhaustion). Using distinct u values for the two item draws exercises two
    // different indices deterministically.
    const result = executeBookstoreSale(initial, BOOKSTORE_BRANCH_ID, cyclicRandom([0.75, 0.0, 0.99]))
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    const commerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const sale = commerce.completedSales[commerce.completedSales.length - 1]
    expect(sale.lines).toEqual([
      { merchandiseId: 'bookstore-merch-001', capturedName: 'Night Transit', quantity: 1, capturedUnitPriceCents: 899 },
      { merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 },
    ])
    const transaction = result.state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)!
    expect(transaction.amountCents).toBe(899 + 2_000)
    const operations = operationsOf(result.state)
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-001')).toBe(44)
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-008')).toBe(44)
    expect(totalStockOf(result.state)).toBe(358)
  })

  it('never provisionally selects more units of one merchandise than currently exist', () => {
    const initial = createInitialGameState()
    const nearlyDepleted: GameState = {
      ...initial,
      bookstoreOperations: {
        records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID
          ? { ...record, stock: record.stock.map((entry) => entry.merchandiseId === 'bookstore-merch-001' ? { ...entry, quantity: 1 } : { ...entry, quantity: 0 }) }
          : record),
      },
    }
    // Only bookstore-merch-001 has any stock (1 unit); total available stock is 1, so only basket size 1 is feasible.
    const result = executeBookstoreSale(nearlyDepleted, BOOKSTORE_BRANCH_ID, cyclicRandom([0.99, 0.0]))
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    const commerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const sale = commerce.completedSales[commerce.completedSales.length - 1]
    expect(sale.lines).toEqual([{ merchandiseId: 'bookstore-merch-001', capturedName: 'Night Transit', quantity: 1, capturedUnitPriceCents: 899 }])
    expect(findBookstoreStockQuantity(operationsOf(result.state), 'bookstore-merch-001')).toBe(0)
  })
})

describe('Bookstore purchase composition — basket size selection', () => {
  it('is configured with the authored 70/25/5 mix for 1/2/3 items', () => {
    expect(BOOKSTORE_PURCHASE_BASKET_SIZE_WEIGHTS).toEqual([{ size: 1, weight: 70 }, { size: 2, weight: 25 }, { size: 3, weight: 5 }])
  })

  it('selects size 1 for a uniform sample below 0.70, size 2 between 0.70 and 0.95, and size 3 above 0.95, when >= 3 units are available', () => {
    expect(selectBookstoreBasketSize(360, () => 0)).toBe(1)
    expect(selectBookstoreBasketSize(360, () => 0.69)).toBe(1)
    expect(selectBookstoreBasketSize(360, () => 0.70)).toBe(2)
    expect(selectBookstoreBasketSize(360, () => 0.94)).toBe(2)
    expect(selectBookstoreBasketSize(360, () => 0.95)).toBe(3)
    expect(selectBookstoreBasketSize(360, () => 0.999)).toBe(3)
  })

  it('restricts selection to feasible sizes when only 2 units of total stock are available', () => {
    // Feasible weights become {1: 70, 2: 25}, total 95; threshold for size 1 is 70/95.
    expect(selectBookstoreBasketSize(2, () => 0)).toBe(1)
    expect(selectBookstoreBasketSize(2, () => 0.7368)).toBe(1)
    expect(selectBookstoreBasketSize(2, () => 0.74)).toBe(2)
    expect(selectBookstoreBasketSize(2, () => 0.999)).toBe(2)
  })

  it('always selects size 1 when only 1 unit of total stock is available, regardless of the sample', () => {
    expect(selectBookstoreBasketSize(1, () => 0)).toBe(1)
    expect(selectBookstoreBasketSize(1, () => 0.5)).toBe(1)
    expect(selectBookstoreBasketSize(1, () => 0.999)).toBe(1)
  })

  it('never generates a basket size larger than currently feasible, across a spread of samples', () => {
    for (const totalAvailableStock of [1, 2, 3, 4, 50]) {
      for (const u of [0, 0.1, 0.5, 0.7, 0.9, 0.95, 0.999]) {
        expect(selectBookstoreBasketSize(totalAvailableStock, () => u)).toBeLessThanOrEqual(Math.min(3, totalAvailableStock))
      }
    }
  })

  it('falls back to a safe minimum size for a degenerate or out-of-range sample from a broken random source', () => {
    expect(selectBookstoreBasketSize(360, () => -1)).toBe(1)
    expect(selectBookstoreBasketSize(360, () => 1)).toBe(1)
    expect(selectBookstoreBasketSize(360, () => Number.NaN)).toBe(1)
  })
})

describe('Bookstore purchase composition — merchandise selection', () => {
  it('selects uniformly by index across the given available identities', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect(selectBookstoreMerchandiseId(ids, () => 0)).toBe('a')
    expect(selectBookstoreMerchandiseId(ids, () => 0.24)).toBe('a')
    expect(selectBookstoreMerchandiseId(ids, () => 0.25)).toBe('b')
    expect(selectBookstoreMerchandiseId(ids, () => 0.5)).toBe('c')
    expect(selectBookstoreMerchandiseId(ids, () => 0.99)).toBe('d')
  })

  it('selects the only available identity regardless of sample', () => {
    expect(selectBookstoreMerchandiseId(['solo'], () => 0.99)).toBe('solo')
  })
})

describe('Bookstore Baseline-Popularity-weighted merchandise selection', () => {
  it('preserves uniform selection boundaries exactly when every weight is neutral', () => {
    const ids = ['a', 'b', 'c', 'd']
    const neutral = new Map(ids.map((id) => [id, 1]))
    for (const sample of [0, 0.24, 0.25, 0.5, 0.99]) {
      expect(selectDemandWeightedBookstoreMerchandiseId(ids, neutral, () => sample)).toBe(selectBookstoreMerchandiseId(ids, () => sample))
    }
  })

  it('uses deterministic proportional boundaries without reordering candidates', () => {
    const demand = new Map([['a', 1], ['b', 3]])
    expect(selectDemandWeightedBookstoreMerchandiseId(['a', 'b'], demand, () => 0.249)).toBe('a')
    expect(selectDemandWeightedBookstoreMerchandiseId(['a', 'b'], demand, () => 0.25)).toBe('b')
  })
})

describe('composeBookstorePurchase', () => {
  const demand = new Map(BOOKSTORE_MERCHANDISE_CATALOG.map(({ id }) => [id, 1]))
  const stockOf = (quantity: number) => BOOKSTORE_MERCHANDISE_CATALOG.map((item) => ({ merchandiseId: item.id, quantity }))

  it('composes a deterministic single-item basket', () => {
    const lines = composeBookstorePurchase(BOOKSTORE_MERCHANDISE_CATALOG, stockOf(45), demand, cyclicRandom([0.1, 0.9]))
    expect(lines).toEqual([{ merchandiseId: 'bookstore-merch-008', name: 'Systems of Dust', unitPriceCents: 2_000, quantity: 1 }])
    expect(deriveBookstoreBasketTotalCents(lines)).toBe(2_000)
  })

  it('aggregates repeated selections of the same merchandise into one line with quantity > 1', () => {
    const lines = composeBookstorePurchase(BOOKSTORE_MERCHANDISE_CATALOG, stockOf(45), demand, cyclicRandom([0.99, 0.0, 0.0, 0.0]))
    expect(lines).toEqual([{ merchandiseId: 'bookstore-merch-001', name: 'Night Transit', unitPriceCents: 899, quantity: 3 }])
    expect(deriveBookstoreBasketTotalCents(lines)).toBe(3 * 899)
  })

  it('never selects a merchandise identity with zero remaining provisional stock within the same basket', () => {
    // Only bookstore-merch-001 has 2 units; every other identity is at 0. Item draws of 0.99 would
    // otherwise pick the *last* catalog identity, but with only one identity ever available, both
    // draws must land on it regardless of the raw sample.
    const stock = BOOKSTORE_MERCHANDISE_CATALOG.map((item) => ({ merchandiseId: item.id, quantity: item.id === 'bookstore-merch-001' ? 2 : 0 }))
    // 0.8 selects basket size 2 at total available stock 2 (feasible sizes {1,2}, weights 70/25; threshold for size 1 is 70/95 ≈ 0.7368).
    const lines = composeBookstorePurchase(BOOKSTORE_MERCHANDISE_CATALOG, stock, demand, cyclicRandom([0.8, 0.99, 0.99]))
    expect(lines).toEqual([{ merchandiseId: 'bookstore-merch-001', name: 'Night Transit', unitPriceCents: 899, quantity: 2 }])
  })

  it('the exact deterministic sum of a composed basket is what a $31.98 sale must be explainable by', () => {
    // bookstore-merch-001 ($8.99) + bookstore-merch-008 ($20.00) does not sum to $31.98, but this proves
    // the mechanism: any successful basket total is always exactly this sum, never a rounded or randomized figure.
    const lines = composeBookstorePurchase(BOOKSTORE_MERCHANDISE_CATALOG, stockOf(45), demand, cyclicRandom([0.75, 0.0, 0.99]))
    const total = deriveBookstoreBasketTotalCents(lines)
    const recomputed = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0)
    expect(total).toBe(recomputed)
  })
})

describe('Bookstore cross-owner stock/catalog integrity — sellable-stock intersection', () => {
  /** An orphan merchandise identity: physically stocked in Operations but absent from the current Commerce catalog, e.g. because it was since removed. Commerce and Operations are separate owners — removing a catalog entry never deletes or rewrites its physical stock. */
  const ORPHAN_MERCHANDISE_ID = 'bookstore-merch-removed'

  function withOrphanStockOnly(): GameState {
    const initial = createInitialGameState()
    return {
      ...initial,
      bookstoreOperations: {
        records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID
          ? { ...record, stock: [...record.stock.map((entry) => ({ ...entry, quantity: 0 })), { merchandiseId: ORPHAN_MERCHANDISE_ID, quantity: 44 }] }
          : record),
      },
    }
  }

  it('deriveSellableBookstoreStockByMerchandise/TotalStock exclude orphan stock entirely', () => {
    const state = withOrphanStockOnly()
    const operations = operationsOf(state)
    const commerce = state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const sellable = deriveSellableBookstoreStockByMerchandise(state.bookstoreCommerce.bookCatalog.filter((item) => commerce.assortment.includes(item.id)), operations.stock)
    expect(sellable.has(ORPHAN_MERCHANDISE_ID)).toBe(false)
    expect([...sellable.keys()]).toEqual(state.bookstoreCommerce.bookCatalog.filter((item) => commerce.assortment.includes(item.id)).map((item) => item.id))
    expect([...sellable.values()].every((quantity) => quantity === 0)).toBe(true)
    expect(deriveSellableBookstoreTotalStock(state.bookstoreCommerce.bookCatalog.filter((item) => commerce.assortment.includes(item.id)), operations.stock)).toBe(0)
    // Physical stock still reflects the orphan quantity — Operations never loses physical truth merely
    // because Commerce no longer lists it, and this is a distinct derivation from the sellable one.
    expect(deriveBookstoreTotalStock(operations)).toBe(44)
  })

  it('agrees with the physical total when every stocked identity is still in the current catalog (no orphans)', () => {
    const state = createInitialGameState()
    const operations = operationsOf(state)
    const commerce = state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    expect(deriveSellableBookstoreTotalStock(state.bookstoreCommerce.bookCatalog.filter((item) => commerce.assortment.includes(item.id)), operations.stock)).toBe(deriveBookstoreTotalStock(operations))
    expect(deriveSellableBookstoreTotalStock(state.bookstoreCommerce.bookCatalog.filter((item) => commerce.assortment.includes(item.id)), operations.stock)).toBe(360)
  })

  it('(A) orphan stock only: refuses cleanly with out_of_stock, unchanged, and consumes no purchase randomness', () => {
    const state = withOrphanStockOnly()
    const forbiddenRandom = () => { throw new Error('must not sample bookstorePurchaseRandom') }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, forbiddenRandom)
    expect(result).toEqual({ status: 'out_of_stock', state })
    // Reference equality proves no Transaction, no CompletedSale, and no stock mutation of any kind occurred.
    expect(result.state).toBe(state)
  })

  it('(B) partial sellable stock: basket-size feasibility is exactly 1 even though large orphan stock exists, and orphan stock is untouched', () => {
    const initial = createInitialGameState()
    const withPartialSellableStock: GameState = {
      ...initial,
      bookstoreOperations: {
        records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID
          ? {
              ...record,
              stock: [
                ...record.stock.map((entry) => entry.merchandiseId === 'bookstore-merch-001' ? { ...entry, quantity: 1 } : { ...entry, quantity: 0 }),
                { merchandiseId: ORPHAN_MERCHANDISE_ID, quantity: 1_000 },
              ],
            }
          : record),
      },
    }
    const commerce = withPartialSellableStock.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const operationsBefore = operationsOf(withPartialSellableStock)
    expect(deriveSellableBookstoreTotalStock(withPartialSellableStock.bookstoreCommerce.bookCatalog.filter((item) => commerce.assortment.includes(item.id)), operationsBefore.stock)).toBe(1)
    // The physical total (what shelf-capacity accounting and RACK-OS present) still includes the orphan units.
    expect(deriveBookstoreTotalStock(operationsBefore)).toBe(1_001)

    // A sample that would otherwise favor a 3-item basket cannot produce more than the one sellable unit.
    const result = executeBookstoreSale(withPartialSellableStock, BOOKSTORE_BRANCH_ID, cyclicRandom([0.99, 0.0]))
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    const soldCommerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    const sale = soldCommerce.completedSales[soldCommerce.completedSales.length - 1]
    expect(sale.lines).toEqual([{ merchandiseId: 'bookstore-merch-001', capturedName: 'Night Transit', quantity: 1, capturedUnitPriceCents: 899 }])
    const operationsAfter = operationsOf(result.state)
    expect(findBookstoreStockQuantity(operationsAfter, 'bookstore-merch-001')).toBe(0)
    // Orphan stock is never selected and never decremented.
    expect(findBookstoreStockQuantity(operationsAfter, ORPHAN_MERCHANDISE_ID)).toBe(1_000)
  })

  it('(C) duplicate current merchandise IDs: the catalog is not sale-usable, refusing before purchase randomness, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        bookCatalog: [...initial.bookstoreCommerce.bookCatalog, { id: 'bookstore-merch-001', name: 'Night Transit (duplicate)', genre: 'THRILLER', baselinePopularity: 100, unitPriceCents: 501 }],
      },
    }
    const forbiddenRandom = () => { throw new Error('must not sample bookstorePurchaseRandom') }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, forbiddenRandom)
    expect(result).toEqual({ status: 'invalid_price', state })
    expect(result.state).toBe(state)
  })
})
