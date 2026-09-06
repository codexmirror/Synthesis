import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_BACKEND_DEVICE_ID } from './bookstoreBackend'
import {
  BOOKSTORE_BRANCH_SALE_OPPORTUNITY_INTERVAL_MS,
  createBookstoreBranchSalesCadenceRecord,
  resolveBookstoreSalesCadenceForBranch,
} from './bookstoreSalesCadence'
import { advanceGameState } from './gameAdvancement'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'
import type { GameState } from './types'

const REMOTE_SEGMENT = 'network-foreign-001'

function cadenceOf(state: GameState) {
  return resolveBookstoreSalesCadenceForBranch(state, BOOKSTORE_BRANCH_ID)!
}

function inventoryOf(state: GameState): number {
  return state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!.currentInventory
}

function salesCountOf(state: GameState): number {
  return state.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!.completedSales.length
}

function transactionCountOf(state: GameState): number {
  return state.dollarFinance.transactions.records.length
}

function hostOperational(state: GameState, deviceId: string) {
  return state.world.network.hosts.find(({ id }) => id === deviceId)!.operational
}

describe('Bookstore Sales Cadence — initial state and schema', () => {
  it('seeds the Bookstore Branch with a full 30-second cycle and creates no runtime sale', () => {
    const state = createInitialGameState()
    expect(state.bookstoreSalesCadence.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      opportunityIntervalMs: 30_000,
      remainingUntilOpportunityMs: 30_000,
    }])
    expect(BOOKSTORE_BRANCH_SALE_OPPORTUNITY_INTERVAL_MS).toBe(30_000)
    expect(salesCountOf(state)).toBe(1)
    expect(inventoryOf(state)).toBe(360)
  })

  it('rejects a non-positive opportunityIntervalMs at construction', () => {
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, opportunityIntervalMs: 0, remainingUntilOpportunityMs: 30_000 })).toThrow(RangeError)
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, opportunityIntervalMs: -1, remainingUntilOpportunityMs: 30_000 })).toThrow(RangeError)
  })

  it('rejects a non-positive remainingUntilOpportunityMs at construction', () => {
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, opportunityIntervalMs: 30_000, remainingUntilOpportunityMs: 0 })).toThrow(RangeError)
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, opportunityIntervalMs: 30_000, remainingUntilOpportunityMs: -1 })).toThrow(RangeError)
  })

  it('resolves undefined for a Branch with no represented cadence record', () => {
    const state = createInitialGameState()
    expect(resolveBookstoreSalesCadenceForBranch(state, 'branch-does-not-exist')).toBeUndefined()
  })
})

describe('Bookstore Sales Cadence — boundary advancement', () => {
  it('creates no sale at initial-state construction or a zero-elapsed advancement', () => {
    const state = createInitialGameState()
    const advanced = advanceGameState(state, 0)
    expect(salesCountOf(advanced)).toBe(1)
    expect(inventoryOf(advanced)).toBe(360)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(30_000)
  })

  it('advancing 29,999 ms creates no sale and leaves exactly 1 ms until the first opportunity', () => {
    const advanced = advanceGameState(createInitialGameState(), 29_999)
    expect(salesCountOf(advanced)).toBe(1)
    expect(inventoryOf(advanced)).toBe(360)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(1)
  })

  it('advancing the final 1 ms makes exactly one opportunity due', () => {
    const atOneMsLeft = advanceGameState(createInitialGameState(), 29_999)
    const advanced = advanceGameState(atOneMsLeft, 1)
    expect(salesCountOf(advanced)).toBe(2)
    expect(inventoryOf(advanced)).toBe(359)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(30_000)
  })

  it('advancing exactly 30,000 ms from the seed makes exactly one opportunity due and starts a fresh 30,000 ms cycle', () => {
    const advanced = advanceGameState(createInitialGameState(), 30_000)
    expect(salesCountOf(advanced)).toBe(2)
    expect(inventoryOf(advanced)).toBe(359)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(30_000)
  })
})

describe('Bookstore Sales Cadence — one due opportunity is exactly one canonical sale attempt', () => {
  it('a successful opportunity produces exactly the existing executeBookstoreSale consequences', () => {
    const before = createInitialGameState()
    const after = advanceGameState(before, 30_000)

    expect(inventoryOf(after)).toBe(inventoryOf(before) - 1)
    const retailClearingBefore = before.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')!.balanceCents
    const retailClearingAfter = after.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')!.balanceCents
    expect(retailClearingAfter).toBe(retailClearingBefore - 2_000)
    const settlementBefore = before.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')!.balanceCents
    const settlementAfter = after.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')!.balanceCents
    expect(settlementAfter).toBe(settlementBefore + 2_000)

    expect(transactionCountOf(after)).toBe(transactionCountOf(before) + 1)
    const newTransaction = after.dollarFinance.transactions.records[after.dollarFinance.transactions.records.length - 1]
    const commerce = after.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    expect(commerce.completedSales).toHaveLength(2)
    expect(commerce.completedSales[1]).toEqual({ id: commerce.completedSales[1].id, kind: 'book_sale', dollarTransactionId: newTransaction.id })

    // Existing authored historical sale and Transaction remain unchanged.
    expect(commerce.completedSales[0]).toEqual(before.bookstoreCommerce.records[0].completedSales[0])
    expect(after.dollarFinance.transactions.records[0]).toEqual(before.dollarFinance.transactions.records[0])
  })
})

describe('Bookstore Sales Cadence — refused opportunities are lost, never queued or retried', () => {
  it('a refused opportunity (CLOSED) creates no sale, no Transaction, no CompletedSale, and does not alter inventory, but is still consumed', () => {
    const initial = createInitialGameState()
    const closed: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }

    const after = advanceGameState(closed, 30_000)
    expect(salesCountOf(after)).toBe(1)
    expect(inventoryOf(after)).toBe(360)
    expect(transactionCountOf(after)).toBe(transactionCountOf(closed))
    // The opportunity is nevertheless consumed: the next ordinary cadence cycle has begun.
    expect(cadenceOf(after).remainingUntilOpportunityMs).toBe(30_000)
  })

  it('restoring a failed prerequisite after a missed opportunity does not trigger an immediate retry or recovery burst', () => {
    const initial = createInitialGameState()
    const closed: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }

    const afterMissedOpportunity = advanceGameState(closed, 30_000)
    expect(salesCountOf(afterMissedOpportunity)).toBe(1)

    // The prerequisite is restored well before the next full cycle elapses.
    const reopened: GameState = { ...afterMissedOpportunity, bookstoreOperations: { records: afterMissedOpportunity.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: true } : record) } }
    const shortlyAfterReopening = advanceGameState(reopened, 1)
    expect(salesCountOf(shortlyAfterReopening)).toBe(1)
    expect(inventoryOf(shortlyAfterReopening)).toBe(360)
    expect(cadenceOf(shortlyAfterReopening).remainingUntilOpportunityMs).toBe(29_999)

    // The ordinary next cycle — not an immediate catch-up — is what eventually produces a sale.
    const atNextOrdinaryCycle = advanceGameState(shortlyAfterReopening, 29_999)
    expect(salesCountOf(atNextOrdinaryCycle)).toBe(2)
    expect(inventoryOf(atNextOrdinaryCycle)).toBe(359)
  })
})

describe('Bookstore Sales Cadence — large elapsed steps contain multiple chronological opportunities', () => {
  it('a stable 60,000 ms advancement from a fresh full cycle processes exactly two due opportunities', () => {
    const after = advanceGameState(createInitialGameState(), 60_000)
    expect(salesCountOf(after)).toBe(3)
    expect(inventoryOf(after)).toBe(358)
    expect(cadenceOf(after).remainingUntilOpportunityMs).toBe(30_000)
  })

  it('a large single step agrees exactly with an equivalent chronological partition', () => {
    const seed = createInitialGameState()
    const largeStep = advanceGameState(seed, 60_000)
    const partitioned = advanceGameState(advanceGameState(seed, 30_000), 30_000)
    expect(largeStep).toEqual(partitioned)
  })
})

describe('Bookstore Sales Cadence — causal boundary: opportunities observe Backend truth at their own due time', () => {
  /**
   * A compact fixture built from real Device connectivity-recovery mechanics
   * (`interruptLocalNetworkConnectivity` + srv-02's own REBOOT_ON_DISCONNECT
   * recovery cycle: 4,000 ms SHUTTING_DOWN + 6,000 ms BOOTING = 10,000 ms
   * total), composed with a bespoke 6,000 ms cadence interval so that the
   * first due opportunity (t=6,000) falls inside that recovery window while
   * the second (t=12,000) falls after it completes — without inventing a
   * shadow backend flag.
   */
  function disruptedFixtureWithCompactCadence(): GameState {
    const initial = createInitialGameState()
    const compactCadence: GameState = {
      ...initial,
      bookstoreSalesCadence: {
        records: [createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, opportunityIntervalMs: 6_000, remainingUntilOpportunityMs: 6_000 })],
      },
    }
    return interruptLocalNetworkConnectivity(compactCadence, REMOTE_SEGMENT)
  }

  it('confirms the fixture: srv-02 is disconnected but has not yet reached BOOTING', () => {
    const fixture = disruptedFixtureWithCompactCadence()
    expect(hostOperational(fixture, BOOKSTORE_BACKEND_DEVICE_ID).connectivity).toBe('DISCONNECTED')
  })

  it('the earlier due opportunity observes the Backend unavailable (mid-reboot) and refuses; the later one observes it recovered and succeeds', () => {
    const fixture = disruptedFixtureWithCompactCadence()

    const afterFirstOpportunity = advanceGameState(fixture, 6_000)
    expect(salesCountOf(afterFirstOpportunity)).toBe(1)
    expect(inventoryOf(afterFirstOpportunity)).toBe(360)
    expect(hostOperational(afterFirstOpportunity, BOOKSTORE_BACKEND_DEVICE_ID).lifecycle).not.toBe('RUNNING')
    expect(cadenceOf(afterFirstOpportunity).remainingUntilOpportunityMs).toBe(6_000)

    const afterSecondOpportunity = advanceGameState(afterFirstOpportunity, 6_000)
    expect(hostOperational(afterSecondOpportunity, BOOKSTORE_BACKEND_DEVICE_ID)).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(salesCountOf(afterSecondOpportunity)).toBe(2)
    expect(inventoryOf(afterSecondOpportunity)).toBe(359)
  })

  it('one 12,000 ms step agrees exactly with the equivalent 6,000 ms + 6,000 ms chronological partition', () => {
    const fixture = disruptedFixtureWithCompactCadence()
    const largeStep = advanceGameState(fixture, 12_000)
    const partitioned = advanceGameState(advanceGameState(fixture, 6_000), 6_000)
    expect(largeStep).toEqual(partitioned)

    // The single large step itself must show the same one-refusal-then-one-sale causal result,
    // proving it did not blindly observe only the start-of-interval or end-of-interval truth.
    expect(salesCountOf(largeStep)).toBe(2)
    expect(inventoryOf(largeStep)).toBe(359)
  })
})
