import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_BACKEND_DEVICE_ID, BOOKSTORE_BACKEND_SERVICE_ID } from './bookstoreBackend'
import { BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID, BOOKSTORE_SALE_TRANSACTION_ID } from './bookstoreCommerce'
import { RETAIL_CLEARING_ACCOUNT_ID, executeBookstoreSale } from './bookstoreSale'
import type { GameState } from './types'

const balanceOf = (state: GameState, accountId: string): number => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents

describe('executeBookstoreSale — success path', () => {
  it('consumes one inventory unit, moves exactly the current unit price, and appends exactly one Transaction and one CompletedSale', () => {
    const before = createInitialGameState()
    const result = executeBookstoreSale(before, BOOKSTORE_BRANCH_ID)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return

    const operations = result.state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(operations?.currentInventory).toBe(359)
    expect(balanceOf(result.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(80_000 - 2_000)
    expect(balanceOf(result.state, BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)).toBe(34_250 + 2_000)

    expect(result.state.dollarFinance.transactions.records).toHaveLength(2)
    const newTransaction = result.state.dollarFinance.transactions.records[1]
    expect(newTransaction).toEqual({
      id: 'dollar-transaction-0002',
      sourceAccountId: RETAIL_CLEARING_ACCOUNT_ID,
      destinationAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      amountCents: 2_000,
      sourceAccountReference: 'CD-9000-2000',
      destinationAccountReference: 'CD-3318-2204',
    })
    expect(result.transactionId).toBe(newTransaction.id)

    const commerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(commerce?.completedSales).toHaveLength(2)
    expect(commerce?.completedSales[1]).toEqual({ id: result.saleId, kind: 'book_sale', dollarTransactionId: newTransaction.id })
    expect(result.saleId).toBe('bookstore-sale-0002')

    // Existing authored historical sale and Transaction remain exactly as they were.
    expect(commerce?.completedSales[0]).toEqual(before.bookstoreCommerce.records[0].completedSales[0])
    expect(result.state.dollarFinance.transactions.records[0]).toEqual(before.dollarFinance.transactions.records.find(({ id }) => id === BOOKSTORE_SALE_TRANSACTION_ID))
  })

  it('reads the current represented price configuration rather than any historical Transaction or CompletedSale', () => {
    const initial = createInitialGameState()
    const repriced: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, unitPriceCents: 3_500 } : record),
      },
    }
    const result = executeBookstoreSale(repriced, BOOKSTORE_BRANCH_ID)
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
        nextSaleId: 47,
        records: [{
          branchId: BOOKSTORE_BRANCH_ID,
          settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
          unitPriceCents: 2_000,
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
    const first = executeBookstoreSale(createInitialGameState(), BOOKSTORE_BRANCH_ID)
    expect(first.status).toBe('sold')
    if (first.status !== 'sold') return
    const second = executeBookstoreSale(first.state, BOOKSTORE_BRANCH_ID)
    expect(second.status).toBe('sold')
    if (second.status !== 'sold') return
    expect(second.saleId).not.toBe(first.saleId)
    expect(second.transactionId).not.toBe(first.transactionId)
    const operations = second.state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(operations?.currentInventory).toBe(358)
  })
})

describe('executeBookstoreSale — atomic failure paths', () => {
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

  it('refuses at zero current inventory, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, currentInventory: 0 } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'out_of_stock', state })
    expect(result.state).toBe(state)
  })

  it('refuses at zero checkout capacity, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, checkoutCapacity: 0 } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'no_checkout_capacity', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Commerce does not exist for the Branch, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'commerce_not_found', state })
    expect(result.state).toBe(state)
  })

  it.each([
    ['zero', 0],
    ['negative', -2_000],
    ['fractional', 19.99],
    ['non-finite', Number.NaN],
  ])('refuses an invalid current unitPriceCents (%s), unchanged', (_label, unitPriceCents) => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, unitPriceCents } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'invalid_price', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the settlement Account does not resolve, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-does-not-exist' } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'settlement_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Backend has no represented record for the Branch, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreBackend: { records: initial.bookstoreBackend.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the backend Device is not network-usable, unchanged', () => {
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
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the backend Service is closed, unchanged', () => {
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
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Retail Clearing does not resolve, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.filter(({ id }) => id !== RETAIL_CLEARING_ACCOUNT_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'retail_clearing_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses with insufficient Retail Clearing funds, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.map((account) => account.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...account, balanceCents: 500 } : account) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID)
    expect(result).toEqual({ status: 'insufficient_funds', state })
    expect(result.state).toBe(state)
    // Retail Clearing is never magically replenished to cover the shortfall.
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
    // comfortably covers the current unit price, so this is not an insufficient-funds
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
