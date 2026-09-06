import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID, BOOKSTORE_BRANCH_LOCATION, BOOKSTORE_BRANCH_NAME } from './business'
import {
  BOOKSTORE_BRANCH_SALE_VALUE_MIX,
  BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
  BOOKSTORE_SALE_TRANSACTION_ID,
  isValidBookstoreSaleValueMix,
  resolveBookstoreCommerceForBranch,
  selectBookstoreSaleValueBand,
} from './bookstoreCommerce'
import { BOOKSTORE_SALE_STATEMENT_PURPOSE } from './bookstoreSale'
import type { BookstoreSaleValueMix } from './types'

describe('bookstore commerce initial truth', () => {
  it('keeps one concrete branch-linked commerce record referencing the generic Branch by stable ID', () => {
    const state = createInitialGameState()
    expect(state.bookstoreCommerce.nextSaleId).toBe(2)
    expect(state.bookstoreCommerce.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      saleValueMix: BOOKSTORE_BRANCH_SALE_VALUE_MIX,
      completedSales: [{ id: 'bookstore-sale-0001', kind: 'book_sale', saleValueBand: 'STANDARD', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
    }])
  })

  it('seeds the exact represented LOW/STANDARD/HIGH sale-value distribution, with an expected attempted value of exactly $20.00', () => {
    expect(BOOKSTORE_BRANCH_SALE_VALUE_MIX).toEqual({
      LOW: { amountCents: 1_200, weight: 30 },
      STANDARD: { amountCents: 2_000, weight: 50 },
      HIGH: { amountCents: 3_200, weight: 20 },
    })
    const { LOW, STANDARD, HIGH } = BOOKSTORE_BRANCH_SALE_VALUE_MIX
    const totalWeight = LOW.weight + STANDARD.weight + HIGH.weight
    const expectedValueCents = (LOW.weight / totalWeight) * LOW.amountCents
      + (STANDARD.weight / totalWeight) * STANDARD.amountCents
      + (HIGH.weight / totalWeight) * HIGH.amountCents
    expect(expectedValueCents).toBe(2_000)
  })

  it('the seeded mix is a valid represented configuration', () => {
    expect(isValidBookstoreSaleValueMix(BOOKSTORE_BRANCH_SALE_VALUE_MIX)).toBe(true)
  })
})

describe('selectBookstoreSaleValueBand — deterministic boundaries', () => {
  it.each([
    [0, 'LOW'],
    [0.1, 'LOW'],
    [0.2999999, 'LOW'],
    [0.3, 'STANDARD'],
    [0.5, 'STANDARD'],
    [0.7999999, 'STANDARD'],
    [0.8, 'HIGH'],
    [0.9, 'HIGH'],
    [0.9999999, 'HIGH'],
  ] as const)('selects %s -> %s for the seeded 30/50/20 mix', (u, expected) => {
    expect(selectBookstoreSaleValueBand(BOOKSTORE_BRANCH_SALE_VALUE_MIX, u)).toBe(expected)
  })

  it('re-derives boundaries fresh from a different, still-valid mix rather than hardcoding 30/50/20', () => {
    const evenMix: BookstoreSaleValueMix = {
      LOW: { amountCents: 1_000, weight: 1 },
      STANDARD: { amountCents: 2_000, weight: 1 },
      HIGH: { amountCents: 3_000, weight: 1 },
    }
    expect(selectBookstoreSaleValueBand(evenMix, 0.1)).toBe('LOW')
    expect(selectBookstoreSaleValueBand(evenMix, 0.4)).toBe('STANDARD')
    expect(selectBookstoreSaleValueBand(evenMix, 0.7)).toBe('HIGH')
  })

  it('tolerates a degenerate/out-of-range random sample by resolving to the last band, never throwing', () => {
    expect(selectBookstoreSaleValueBand(BOOKSTORE_BRANCH_SALE_VALUE_MIX, Number.NaN)).toBe('HIGH')
    expect(selectBookstoreSaleValueBand(BOOKSTORE_BRANCH_SALE_VALUE_MIX, 1)).toBe('HIGH')
    expect(selectBookstoreSaleValueBand(BOOKSTORE_BRANCH_SALE_VALUE_MIX, 1.5)).toBe('HIGH')
  })
})

describe('isValidBookstoreSaleValueMix — configuration invariants', () => {
  const valid = BOOKSTORE_BRANCH_SALE_VALUE_MIX

  it.each([
    ['zero amount', { ...valid, LOW: { ...valid.LOW, amountCents: 0 } }],
    ['negative amount', { ...valid, LOW: { ...valid.LOW, amountCents: -1_200 } }],
    ['fractional amount', { ...valid, LOW: { ...valid.LOW, amountCents: 1_200.5 } }],
    ['non-finite amount', { ...valid, LOW: { ...valid.LOW, amountCents: Number.NaN } }],
    ['zero weight', { ...valid, STANDARD: { ...valid.STANDARD, weight: 0 } }],
    ['negative weight', { ...valid, STANDARD: { ...valid.STANDARD, weight: -50 } }],
    ['non-finite weight', { ...valid, HIGH: { ...valid.HIGH, weight: Number.POSITIVE_INFINITY } }],
  ] as const)('rejects an impossible configuration (%s) rather than normalizing or falling back to STANDARD', (_label, mix) => {
    expect(isValidBookstoreSaleValueMix(mix)).toBe(false)
  })
})

describe('bookstore commerce initial finance truth', () => {
  it('links the one book sale to one real incoming $20 Transaction and coherent current balances', () => {
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

  it('authors no Petra complaint or Technician response for the incoming sale', () => {
    const state = createInitialGameState()
    expect(state.petraCompanyChat.messages).toEqual([])
    expect(state.technicianReaction.pending).toBeNull()
  })
})

describe('resolveBookstoreCommerceForBranch', () => {
  it('resolves current settlement Account and completed sale for the bookstore Branch', () => {
    const state = createInitialGameState()
    const commerce = resolveBookstoreCommerceForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(commerce?.settlementAccount.accountReference).toBe('CD-3318-2204')
    expect(commerce?.saleValueMix).toEqual(BOOKSTORE_BRANCH_SALE_VALUE_MIX)
    expect(commerce?.sales).toHaveLength(1)
    expect(commerce?.sales[0].saleValueBand).toBe('STANDARD')
    expect(commerce?.sales[0].transaction.amountCents).toBe(2_000)
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
})
