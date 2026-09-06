import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID, BOOKSTORE_BRANCH_LOCATION, BOOKSTORE_BRANCH_NAME } from './business'
import { BOOKSTORE_BACKEND_DEVICE_ID, BOOKSTORE_BACKEND_SERVICE_ID } from './bookstoreBackend'
import { BOOKSTORE_BRANCH_SALE_VALUE_MIX, BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID, BOOKSTORE_SALE_TRANSACTION_ID } from './bookstoreCommerce'
import { BOOKSTORE_SALE_STATEMENT_PURPOSE, RETAIL_CLEARING_ACCOUNT_ID, executeBookstoreSale } from './bookstoreSale'
import type { GameState } from './types'

const balanceOf = (state: GameState, accountId: string): number => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents

/** A uniform value landing inside the seeded mix's STANDARD boundary, [0.30, 0.80). */
const U_STANDARD = 0.5
/** A uniform value landing inside the seeded mix's LOW boundary, [0, 0.30). */
const U_LOW = 0.1
/** A uniform value landing inside the seeded mix's HIGH boundary, [0.80, 1). */
const U_HIGH = 0.9

describe('executeBookstoreSale — success path', () => {
  it('consumes one inventory unit, moves exactly the selected band amount, and appends exactly one Transaction and one CompletedSale', () => {
    const before = createInitialGameState()
    const result = executeBookstoreSale(before, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    expect(result.saleValueBand).toBe('STANDARD')

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
      statementContext: { description: BOOKSTORE_BRANCH_NAME, purpose: BOOKSTORE_SALE_STATEMENT_PURPOSE, location: BOOKSTORE_BRANCH_LOCATION },
    })
    expect(result.transactionId).toBe(newTransaction.id)

    const commerce = result.state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(commerce?.completedSales).toHaveLength(2)
    expect(commerce?.completedSales[1]).toEqual({ id: result.saleId, kind: 'book_sale', saleValueBand: 'STANDARD', dollarTransactionId: newTransaction.id })
    expect(result.saleId).toBe('bookstore-sale-0002')

    // Existing authored historical sale and Transaction remain exactly as they were.
    expect(commerce?.completedSales[0]).toEqual(before.bookstoreCommerce.records[0].completedSales[0])
    expect(result.state.dollarFinance.transactions.records[0]).toEqual(before.dollarFinance.transactions.records.find(({ id }) => id === BOOKSTORE_SALE_TRANSACTION_ID))
  })

  it.each([
    ['LOW', U_LOW, 1_200],
    ['STANDARD', U_STANDARD, 2_000],
    ['HIGH', U_HIGH, 3_200],
  ] as const)('a selected %s sale moves exactly its configured amount and decrements exactly one inventory unit', (band, u, amountCents) => {
    const before = createInitialGameState()
    const result = executeBookstoreSale(before, BOOKSTORE_BRANCH_ID, () => u)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    expect(result.saleValueBand).toBe(band)
    expect(result.state.dollarFinance.transactions.records.at(-1)?.amountCents).toBe(amountCents)
    expect(balanceOf(result.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(80_000 - amountCents)
    const operations = result.state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(operations?.currentInventory).toBe(359)
  })

  it('reads the current represented sale-value-mix configuration rather than any historical Transaction or CompletedSale', () => {
    const initial = createInitialGameState()
    const repriced: GameState = {
      ...initial,
      bookstoreCommerce: {
        ...initial.bookstoreCommerce,
        records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID
          ? { ...record, saleValueMix: { ...record.saleValueMix, STANDARD: { ...record.saleValueMix.STANDARD, amountCents: 3_500 } } }
          : record),
      },
    }
    const result = executeBookstoreSale(repriced, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
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
          saleValueMix: BOOKSTORE_BRANCH_SALE_VALUE_MIX,
          completedSales: [],
        }],
      },
    }
    const result = executeBookstoreSale(fixture, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    expect(result.saleId).toBe('bookstore-sale-0047')
    expect(result.state.bookstoreCommerce.nextSaleId).toBe(48)

    const again = executeBookstoreSale(result.state, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(again.status).toBe('sold')
    if (again.status !== 'sold') return
    expect(again.saleId).toBe('bookstore-sale-0048')
  })

  it('is one explicit domain transition: calling it twice performs two independent sales, never a cadence', () => {
    const first = executeBookstoreSale(createInitialGameState(), BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(first.status).toBe('sold')
    if (first.status !== 'sold') return
    const second = executeBookstoreSale(first.state, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(second.status).toBe('sold')
    if (second.status !== 'sold') return
    expect(second.saleId).not.toBe(first.saleId)
    expect(second.transactionId).not.toBe(first.transactionId)
    const operations = second.state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)
    expect(operations?.currentInventory).toBe(358)
  })

  it('draws exactly one sale-value random sample per attempt that reaches value resolution', () => {
    let samples = 0
    const result = executeBookstoreSale(createInitialGameState(), BOOKSTORE_BRANCH_ID, () => { samples += 1; return U_STANDARD })
    expect(result.status).toBe('sold')
    expect(samples).toBe(1)
  })
})

describe('executeBookstoreSale — atomic failure paths', () => {
  it('refuses when the Business Branch itself does not exist, unchanged, without consuming a sale-value sample', () => {
    const state = createInitialGameState()
    const result = executeBookstoreSale(state, 'branch-does-not-exist', () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'branch_not_found', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Operations does not exist for the Branch, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'operations_not_found', state })
    expect(result.state).toBe(state)
  })

  it('refuses while CLOSED, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'closed', state })
    expect(result.state).toBe(state)
  })

  it('refuses at zero current inventory, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, currentInventory: 0 } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'out_of_stock', state })
    expect(result.state).toBe(state)
  })

  it('refuses at zero checkout capacity, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, checkoutCapacity: 0 } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'no_checkout_capacity', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Commerce does not exist for the Branch, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'commerce_not_found', state })
    expect(result.state).toBe(state)
  })

  it.each([
    ['zero amount', { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX, LOW: { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX.LOW, amountCents: 0 } }],
    ['negative amount', { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX, LOW: { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX.LOW, amountCents: -1_200 } }],
    ['fractional amount', { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX, LOW: { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX.LOW, amountCents: 19.99 } }],
    ['non-finite amount', { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX, LOW: { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX.LOW, amountCents: Number.NaN } }],
    ['zero weight', { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX, STANDARD: { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX.STANDARD, weight: 0 } }],
    ['non-finite weight', { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX, HIGH: { ...BOOKSTORE_BRANCH_SALE_VALUE_MIX.HIGH, weight: Number.NaN } }],
  ] as const)('refuses an invalid current saleValueMix (%s), unchanged, without consuming a sale-value sample', (_label, saleValueMix) => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, saleValueMix } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'invalid_sale_value_mix', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the settlement Account does not resolve, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, settlementAccountId: 'dollar-account-does-not-exist' } : record) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'settlement_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when Bookstore Backend has no represented record for the Branch, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, bookstoreBackend: { records: initial.bookstoreBackend.records.filter((record) => record.branchId !== BOOKSTORE_BRANCH_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'backend_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the backend Device is not network-usable, unchanged, without consuming a sale-value sample', () => {
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

  it('refuses when the backend Service is closed, unchanged, without consuming a sale-value sample', () => {
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

  it('refuses when Retail Clearing does not resolve, unchanged, without consuming a sale-value sample', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.filter(({ id }) => id !== RETAIL_CLEARING_ACCOUNT_ID) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
    expect(result).toEqual({ status: 'retail_clearing_unavailable', state })
    expect(result.state).toBe(state)
  })

  it('refuses with insufficient Retail Clearing funds for the selected band, unchanged', () => {
    const initial = createInitialGameState()
    const state: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.map((account) => account.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...account, balanceCents: 500 } : account) } }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(result).toEqual({ status: 'insufficient_funds', state })
    expect(result.state).toBe(state)
    // Retail Clearing is never magically replenished to cover the shortfall.
    expect(balanceOf(result.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(500)
  })

  it('a selected HIGH sale may refuse for insufficient funds where a LOW sale on the same balance would have succeeded, and never falls back to LOW/STANDARD', () => {
    const initial = createInitialGameState()
    // Comfortably covers LOW (1,200) and STANDARD (2,000) but not HIGH (3,200).
    const constrained: GameState = { ...initial, dollarFinance: { ...initial.dollarFinance, accounts: initial.dollarFinance.accounts.map((account) => account.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...account, balanceCents: 1_500 } : account) } }

    const highAttempt = executeBookstoreSale(constrained, BOOKSTORE_BRANCH_ID, () => U_HIGH)
    expect(highAttempt).toEqual({ status: 'insufficient_funds', state: constrained })
    // Atomic: no inventory decrement, no Transaction, no CompletedSale for the refused HIGH attempt.
    expect(highAttempt.state).toBe(constrained)

    const lowAttempt = executeBookstoreSale(constrained, BOOKSTORE_BRANCH_ID, () => U_LOW)
    expect(lowAttempt.status).toBe('sold')
    if (lowAttempt.status !== 'sold') return
    expect(lowAttempt.saleValueBand).toBe('LOW')
    expect(balanceOf(lowAttempt.state, RETAIL_CLEARING_ACCOUNT_ID)).toBe(1_500 - 1_200)
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
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(result).toEqual({ status: 'balance_not_representable', state })
    expect(result.state).toBe(state)
  })

  it('refuses when the resulting Retail Clearing balance could not be represented as an exact integer, unchanged', () => {
    const initial = createInitialGameState()
    // A corrupted/malformed clearing balance well beyond safe integer range; it still
    // comfortably covers every selected band, so this is not an insufficient-funds
    // refusal — only the resulting debit's representability is at issue, exactly like
    // the symmetric guarantee executeCivicDollarMovement now enforces on both sides.
    const state: GameState = {
      ...initial,
      dollarFinance: {
        ...initial.dollarFinance,
        accounts: initial.dollarFinance.accounts.map((account) => account.id === RETAIL_CLEARING_ACCOUNT_ID ? { ...account, balanceCents: 2 ** 60 } : account),
      },
    }
    const result = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(result).toEqual({ status: 'balance_not_representable', state })
    expect(result.state).toBe(state)
  })
})

describe('executeBookstoreSale — historical statement-context snapshot truth', () => {
  it('snapshots the current Branch displayName/location into the created Transaction, and a later Branch rename/relocation never rewrites it', () => {
    const initial = createInitialGameState()

    const first = executeBookstoreSale(initial, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(first.status).toBe('sold')
    if (first.status !== 'sold') return
    const firstTransaction = first.state.dollarFinance.transactions.records.find(({ id }) => id === first.transactionId)!
    expect(firstTransaction.statementContext).toEqual({ description: 'Bookstore Branch 01', purpose: 'Retail sale', location: '18 Mercer Street' })
    // The actual financial counterparty reference remains the separate, real historical Account-reference snapshot — never replaced by the description.
    expect(firstTransaction.sourceAccountReference).toBe('CD-9000-2000')
    expect(firstTransaction.destinationAccountReference).toBe('CD-3318-2204')

    // Rename and relocate the Branch after the first sale.
    const renamed: GameState = {
      ...first.state,
      business: { ...first.state.business, branches: first.state.business.branches.map((branch) => branch.id === BOOKSTORE_BRANCH_ID ? { ...branch, displayName: 'Downtown Books', location: '900 Founders Way' } : branch) },
    }

    const second = executeBookstoreSale(renamed, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(second.status).toBe('sold')
    if (second.status !== 'sold') return
    const secondTransaction = second.state.dollarFinance.transactions.records.find(({ id }) => id === second.transactionId)!
    // The later sale snapshots the Branch's new current identity/location...
    expect(secondTransaction.statementContext).toEqual({ description: 'Downtown Books', purpose: 'Retail sale', location: '900 Founders Way' })
    expect(secondTransaction.sourceAccountReference).toBe('CD-9000-2000')
    expect(secondTransaction.destinationAccountReference).toBe('CD-3318-2204')

    // ...without ever rewriting the earlier Transaction's own historical snapshot.
    const firstTransactionAfterRename = second.state.dollarFinance.transactions.records.find(({ id }) => id === first.transactionId)!
    expect(firstTransactionAfterRename.statementContext).toEqual({ description: 'Bookstore Branch 01', purpose: 'Retail sale', location: '18 Mercer Street' })
  })

  it('creates no statement context, no Transaction, and no CompletedSale on a refused sale', () => {
    const initial = createInitialGameState()
    const closed: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }
    const result = executeBookstoreSale(closed, BOOKSTORE_BRANCH_ID, () => { throw new Error('must not sample') })
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
    const result = executeBookstoreSale(noLocation, BOOKSTORE_BRANCH_ID, () => U_STANDARD)
    expect(result.status).toBe('sold')
    if (result.status !== 'sold') return
    const transaction = result.state.dollarFinance.transactions.records.find(({ id }) => id === result.transactionId)!
    expect(transaction.statementContext).toEqual({ description: 'Bookstore Branch 01', purpose: 'Retail sale' })
    expect(transaction.statementContext).not.toHaveProperty('location')
  })
})
