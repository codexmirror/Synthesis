import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_BACKEND_DEVICE_ID } from './bookstoreBackend'
import {
  advanceBookstoreSalesCadence,
  BOOKSTORE_BRANCH_ATTRACTIVENESS_MULTIPLIER,
  BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR,
  createBookstoreBranchSalesCadenceRecord,
  deriveEffectiveBookstoreOpportunityRatePerHour,
  resolveBookstoreSalesCadenceForBranch,
} from './bookstoreSalesCadence'
import { deriveBookstoreTotalStock } from './bookstoreOperations'
import { advanceGameState } from './gameAdvancement'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import type { GameState } from './types'

const REMOTE_SEGMENT = 'network-foreign-001'
const HOUR_MS = 3_600_000

function cadenceOf(state: GameState) {
  return resolveBookstoreSalesCadenceForBranch(state, BOOKSTORE_BRANCH_ID)!
}

function inventoryOf(state: GameState): number {
  return deriveBookstoreTotalStock(state.bookstoreOperations.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!)
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

/** The same exponential inverse-CDF formula the implementation uses, reproduced here so tests can assert exact scheduled intervals from a controlled `u`, without importing implementation-private helpers. */
function exponentialSampleMs(meanIntervalMs: number, u: number): number {
  return -meanIntervalMs * Math.log(1 - u)
}

/** A deterministic Bookstore random source that always returns the same controlled value, for scenarios that need one predictable sampled interval. */
function constantRandom(u: number): () => number {
  return () => u
}

/** A deterministic Bookstore random source that replays a fixed sequence (holding its last value once exhausted), for proving large-step/partitioned equivalence under one shared deterministic sequence. */
function fixedSequenceRandom(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[Math.min(index, values.length - 1)]
    index += 1
    return value
  }
}

/**
 * A deterministic Bookstore purchase-random source that cycles endlessly
 * through the given raw samples. With the seeded 8-title catalog and the
 * default 70/25/5 basket-size mix, `[0.1, 0.9]` always composes basket size 1
 * (0.1 < 0.70) of the catalog's last entry, `bookstore-merch-008` ("Systems
 * of Dust", $20.00) — reproducing exactly the fixed-$20/one-unit sale this
 * Branch represented before purchase composition existed, so cadence tests
 * that only care about when or whether a sale happens (not what basket
 * composes it) can stay deterministic without recomputing basket math.
 */
function cyclicPurchaseRandom(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

const ONE_BOOK_PURCHASE_RANDOM = (): (() => number) => cyclicPurchaseRandom([0.1, 0.95])

/** A random source that fails the test immediately if ever called — proves a given advancement consumes no purchase randomness at all. */
function forbiddenRandom(): () => number {
  return () => { throw new Error('must not sample bookstorePurchaseRandom') }
}

/**
 * A single continuous elapsed run and its equivalent chronological partition can each accumulate
 * the exact same sampled intervals through a different floating-point addition/subtraction path
 * (one continuous running total vs. a value carried across separate calls), so their in-flight
 * `remainingUntilOpportunityMs` can differ by ordinary floating-point rounding noise even when both
 * consumed the exact same random sequence in the exact same causal order. Measured noise for the
 * magnitudes these tests use is on the order of 1e-10 ms; this tolerance is generous by several
 * orders of magnitude over that while remaining many orders of magnitude below anything that could
 * ever matter to represented gameplay timing (whole milliseconds).
 */
const CADENCE_COUNTDOWN_FLOATING_POINT_TOLERANCE_MS = 1e-6

/** Canonical countdown truth must still agree between an equivalent large-step and partitioned run — just not to the bit — so this is asserted on its own, separately from `withoutBookstoreBackgroundTiming`'s exact comparison of everything else. */
function expectCadenceCountdownsToAgree(a: GameState, b: GameState): void {
  expect(Math.abs(cadenceOf(a).remainingUntilOpportunityMs - cadenceOf(b).remainingUntilOpportunityMs)).toBeLessThan(CADENCE_COUNTDOWN_FLOATING_POINT_TOLERANCE_MS)
}

const INITIAL_MEAN_INTERVAL_MS = HOUR_MS / (BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR * BOOKSTORE_BRANCH_ATTRACTIVENESS_MULTIPLIER)

describe('Bookstore Sales Cadence — initial state and schema', () => {
  it('seeds the Bookstore Branch with the authored V1 demand fixture and creates no runtime sale', () => {
    const state = createInitialGameState()
    expect(state.bookstoreSalesCadence.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      locationOpportunityRatePerHour: 10,
      attractivenessMultiplier: 1.0,
      remainingUntilOpportunityMs: 360_000,
    }])
    expect(BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR).toBe(10)
    expect(BOOKSTORE_BRANCH_ATTRACTIVENESS_MULTIPLIER).toBe(1.0)
    expect(deriveEffectiveBookstoreOpportunityRatePerHour(cadenceOf(state))).toBe(10)
    expect(INITIAL_MEAN_INTERVAL_MS).toBe(360_000)
    expect(salesCountOf(state)).toBe(1)
    expect(inventoryOf(state)).toBe(360)
  })

  it('rejects a non-positive locationOpportunityRatePerHour at construction', () => {
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 0, attractivenessMultiplier: 1.0, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: -1, attractivenessMultiplier: 1.0, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
  })

  it('rejects a non-positive attractivenessMultiplier at construction', () => {
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 10, attractivenessMultiplier: 0, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 10, attractivenessMultiplier: -1, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
  })

  it('rejects a non-positive remainingUntilOpportunityMs at construction', () => {
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 10, attractivenessMultiplier: 1.0, remainingUntilOpportunityMs: 0 })).toThrow(RangeError)
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 10, attractivenessMultiplier: 1.0, remainingUntilOpportunityMs: -1 })).toThrow(RangeError)
  })

  it('resolves undefined for a Branch with no represented cadence record', () => {
    const state = createInitialGameState()
    expect(resolveBookstoreSalesCadenceForBranch(state, 'branch-does-not-exist')).toBeUndefined()
  })
})

describe('Bookstore Sales Cadence — boundary advancement', () => {
  it('creates no sale at initial-state construction or a zero-elapsed advancement, and consumes no demand or purchase randomness', () => {
    const state = createInitialGameState()
    const advanced = advanceGameState(state, 0, Math.random, () => { throw new Error('must not sample') }, forbiddenRandom())
    expect(salesCountOf(advanced)).toBe(1)
    expect(inventoryOf(advanced)).toBe(360)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(360_000)
  })

  it('advancing 359,999 ms creates no sale, consumes no demand or purchase randomness, and leaves exactly 1 ms until the first opportunity', () => {
    const advanced = advanceGameState(createInitialGameState(), 359_999, Math.random, () => { throw new Error('must not sample') }, forbiddenRandom())
    expect(salesCountOf(advanced)).toBe(1)
    expect(inventoryOf(advanced)).toBe(360)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(1)
  })

  it('advancing the final 1 ms makes exactly one opportunity due and samples exactly one new interval', () => {
    const atOneMsLeft = advanceGameState(createInitialGameState(), 359_999)
    let samples = 0
    const advanced = advanceGameState(atOneMsLeft, 1, Math.random, () => { samples += 1; return 0.4 }, ONE_BOOK_PURCHASE_RANDOM())
    expect(samples).toBe(1)
    expect(salesCountOf(advanced)).toBe(2)
    expect(inventoryOf(advanced)).toBe(359)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.4))
  })

  it('advancing exactly 360,000 ms from the seed makes exactly one opportunity due and schedules a fresh sampled interval', () => {
    let samples = 0
    const advanced = advanceGameState(createInitialGameState(), 360_000, Math.random, () => { samples += 1; return 0.25 }, ONE_BOOK_PURCHASE_RANDOM())
    expect(samples).toBe(1)
    expect(salesCountOf(advanced)).toBe(2)
    expect(inventoryOf(advanced)).toBe(359)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.25))
  })

  it('works with the production default Math.random, always producing a finite positive next interval', () => {
    const advanced = advanceGameState(createInitialGameState(), 360_000)
    expect(salesCountOf(advanced)).toBe(2)
    expect(Number.isFinite(cadenceOf(advanced).remainingUntilOpportunityMs)).toBe(true)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBeGreaterThan(0)
  })
})

describe('Bookstore Sales Cadence — one due opportunity is exactly one canonical sale attempt', () => {
  it('a successful opportunity produces exactly the existing executeBookstoreSale consequences', () => {
    const before = createInitialGameState()
    const after = advanceGameState(before, 360_000, Math.random, () => 0.3, ONE_BOOK_PURCHASE_RANDOM())

    expect(inventoryOf(after)).toBe(inventoryOf(before) - 1)
    const retailClearingBefore = before.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')!.balanceCents
    const retailClearingAfter = after.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-retail-clearing-v0')!.balanceCents
    expect(retailClearingAfter).toBe(retailClearingBefore - 2_000)
    const settlementBefore = before.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-bookstore-treasury-v0')!.balanceCents
    const settlementAfter = after.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-bookstore-treasury-v0')!.balanceCents
    expect(settlementAfter).toBe(settlementBefore + 2_000)

    expect(transactionCountOf(after)).toBe(transactionCountOf(before) + 1)
    const newTransaction = after.dollarFinance.transactions.records[after.dollarFinance.transactions.records.length - 1]
    const commerce = after.bookstoreCommerce.records.find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!
    expect(commerce.completedSales).toHaveLength(2)
    expect(commerce.completedSales[1]).toEqual({
      id: commerce.completedSales[1].id,
      kind: 'book_sale',
      dollarTransactionId: newTransaction.id,
      lines: [{ merchandiseId: 'bookstore-merch-008', capturedName: 'Systems of Dust', quantity: 1, capturedUnitPriceCents: 2_000 }],
    })

    // Existing authored historical sale and Transaction remain unchanged.
    expect(commerce.completedSales[0]).toEqual(before.bookstoreCommerce.records[0].completedSales[0])
    expect(after.dollarFinance.transactions.records[0]).toEqual(before.dollarFinance.transactions.records[0])
  })
})

describe('Bookstore Sales Cadence — refused opportunities are lost, never queued or retried', () => {
  it('a refused opportunity (CLOSED) creates no sale, no Transaction, no CompletedSale, does not alter inventory, consumes no purchase randomness, but is still consumed and samples exactly one new demand interval', () => {
    const initial = createInitialGameState()
    const closed: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }

    let samples = 0
    const after = advanceGameState(closed, 360_000, Math.random, () => { samples += 1; return 0.6 }, forbiddenRandom())
    expect(samples).toBe(1)
    expect(salesCountOf(after)).toBe(1)
    expect(inventoryOf(after)).toBe(360)
    expect(transactionCountOf(after)).toBe(transactionCountOf(closed))
    // The opportunity is nevertheless consumed: a fresh interval has been sampled for the next ordinary cycle.
    expect(cadenceOf(after).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.6))
  })

  it('restoring a failed prerequisite after a missed opportunity does not trigger an immediate retry or recovery burst', () => {
    const initial = createInitialGameState()
    const closed: GameState = { ...initial, bookstoreOperations: { records: initial.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: false } : record) } }

    const afterMissedOpportunity = advanceGameState(closed, 360_000, Math.random, () => 0.5, forbiddenRandom())
    expect(salesCountOf(afterMissedOpportunity)).toBe(1)
    const scheduledIntervalMs = exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.5)

    // The prerequisite is restored well before the next full cycle elapses.
    const reopened: GameState = { ...afterMissedOpportunity, bookstoreOperations: { records: afterMissedOpportunity.bookstoreOperations.records.map((record) => record.branchId === BOOKSTORE_BRANCH_ID ? { ...record, open: true } : record) } }
    const shortlyAfterReopening = advanceGameState(reopened, 1, Math.random, () => { throw new Error('must not sample before the scheduled boundary') }, forbiddenRandom())
    expect(salesCountOf(shortlyAfterReopening)).toBe(1)
    expect(inventoryOf(shortlyAfterReopening)).toBe(360)
    expect(cadenceOf(shortlyAfterReopening).remainingUntilOpportunityMs).toBe(scheduledIntervalMs - 1)

    // The ordinary next cycle — not an immediate catch-up — is what eventually produces a sale.
    const atNextOrdinaryCycle = advanceGameState(shortlyAfterReopening, scheduledIntervalMs - 1, Math.random, () => 0.2, ONE_BOOK_PURCHASE_RANDOM())
    expect(salesCountOf(atNextOrdinaryCycle)).toBe(2)
    expect(inventoryOf(atNextOrdinaryCycle)).toBe(359)
  })
})

describe('Bookstore Sales Cadence — repeated ordinary ticks never resample', () => {
  it('many small advancements before the due boundary consume no Bookstore demand or purchase randomness at all', () => {
    let samples = 0
    const demandRandom = () => { samples += 1; return 0.5 }
    let state = createInitialGameState()
    for (let tick = 0; tick < 100; tick += 1) state = advanceGameState(state, 250, Math.random, demandRandom, forbiddenRandom())
    // 100 * 250ms = 25,000ms, well short of the seeded 360,000ms first opportunity.
    expect(samples).toBe(0)
    expect(salesCountOf(state)).toBe(1)
    expect(cadenceOf(state).remainingUntilOpportunityMs).toBe(360_000 - 25_000)
  })
})

describe('Bookstore Sales Cadence — irregular sampled arrivals', () => {
  it('two different controlled random samples produce different next opportunity intervals for the same represented demand rate', () => {
    const seed = createInitialGameState()
    const lower = advanceGameState(seed, 360_000, Math.random, () => 0.2)
    const higher = advanceGameState(seed, 360_000, Math.random, () => 0.8)

    expect(cadenceOf(lower).remainingUntilOpportunityMs).not.toBe(cadenceOf(higher).remainingUntilOpportunityMs)
    expect(cadenceOf(lower).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.2))
    expect(cadenceOf(higher).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.8))
    // Both branches still represent the identical demand rate; only the sampled instant differs.
    expect(deriveEffectiveBookstoreOpportunityRatePerHour(cadenceOf(lower))).toBe(deriveEffectiveBookstoreOpportunityRatePerHour(cadenceOf(higher)))
  })

  it('defends against a degenerate zero-length sample from a valid Math.random-style source', () => {
    const advanced = advanceGameState(createInitialGameState(), 360_000, Math.random, () => 0)
    expect(Number.isFinite(cadenceOf(advanced).remainingUntilOpportunityMs)).toBe(true)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBeGreaterThan(0)
  })

  it('defends against an out-of-range sample (>= 1) from a broken random source', () => {
    const advanced = advanceGameState(createInitialGameState(), 360_000, Math.random, () => 1)
    expect(Number.isFinite(cadenceOf(advanced).remainingUntilOpportunityMs)).toBe(true)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBeGreaterThan(0)
  })
})

describe('Bookstore Sales Cadence — derived demand invariant (overflow/underflow protection)', () => {
  it('rejects a configuration whose individually valid factors overflow the derived effective rate to Infinity', () => {
    // 1e200 and 1e200 are each an ordinary positive finite number on their own; their product is not.
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 1e200, attractivenessMultiplier: 1e200, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
  })

  it('rejects a configuration whose individually valid factors underflow the derived effective rate to 0', () => {
    // 1e-200 and 1e-200 are each an ordinary positive finite number on their own; their product underflows to exactly 0.
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 1e-200, attractivenessMultiplier: 1e-200, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
  })

  it('rejects a configuration whose validly finite positive effective rate still overflows the derived mean interval to Infinity', () => {
    // 1e-300 * 1e-10 = 1e-310: a legitimately finite, positive effective rate on its own (this test
    // confirms that first), but dividing the represented hour by it overflows past Number.MAX_VALUE —
    // proving the separate mean-interval check catches what the effective-rate check alone would miss.
    const locationOpportunityRatePerHour = 1e-300
    const attractivenessMultiplier = 1e-10
    const effectiveRate = locationOpportunityRatePerHour * attractivenessMultiplier
    expect(Number.isFinite(effectiveRate)).toBe(true)
    expect(effectiveRate).toBeGreaterThan(0)
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour, attractivenessMultiplier, remainingUntilOpportunityMs: 360_000 })).toThrow(RangeError)
  })

  it('accepts an ordinary large-but-sane rate/multiplier pair without throwing, so the new check is not overzealous', () => {
    expect(() => createBookstoreBranchSalesCadenceRecord({ branchId: BOOKSTORE_BRANCH_ID, locationOpportunityRatePerHour: 100_000, attractivenessMultiplier: 10, remainingUntilOpportunityMs: 1 })).not.toThrow()
  })

  it('rejects at scheduling time too: a due opportunity backed by demand configuration that bypassed the constructor and derives an invalid rate throws rather than silently producing an invalid countdown', () => {
    const initial = createInitialGameState()
    // Directly reconfigures the record (as a future Upgrade mechanic might, or as this exact
    // fixture does deliberately) so this exercises `scheduleNextBookstoreOpportunity`'s own
    // validation, independent of `createBookstoreBranchSalesCadenceRecord`'s construction-time check.
    const invalidlyConfigured: GameState = {
      ...initial,
      bookstoreSalesCadence: {
        records: initial.bookstoreSalesCadence.records.map((record) => ({
          ...record,
          locationOpportunityRatePerHour: 1e200,
          attractivenessMultiplier: 1e200,
          remainingUntilOpportunityMs: 1,
        })),
      },
    }
    expect(() => advanceGameState(invalidlyConfigured, 1)).toThrow(RangeError)
  })
})

describe('Bookstore Sales Cadence — demand inputs affect only opportunity timing', () => {
  function withAttractiveness(multiplier: number): GameState {
    const initial = createInitialGameState()
    return {
      ...initial,
      bookstoreSalesCadence: {
        records: [createBookstoreBranchSalesCadenceRecord({
          branchId: BOOKSTORE_BRANCH_ID,
          locationOpportunityRatePerHour: BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR,
          attractivenessMultiplier: multiplier,
          remainingUntilOpportunityMs: HOUR_MS / (BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR * multiplier),
        })],
      },
    }
  }

  it('doubling attractivenessMultiplier doubles the effective rate and halves the mean sampled interval, without touching purchase composition or fulfillment rules', () => {
    const baseline = withAttractiveness(1.0)
    const moreAttractive = withAttractiveness(2.0)

    expect(deriveEffectiveBookstoreOpportunityRatePerHour(cadenceOf(baseline))).toBe(10)
    expect(deriveEffectiveBookstoreOpportunityRatePerHour(cadenceOf(moreAttractive))).toBe(20)

    const u = 0.4
    const baselineAfter = advanceGameState(baseline, cadenceOf(baseline).remainingUntilOpportunityMs, Math.random, () => u, ONE_BOOK_PURCHASE_RANDOM())
    const moreAttractiveAfter = advanceGameState(moreAttractive, cadenceOf(moreAttractive).remainingUntilOpportunityMs, Math.random, () => u, ONE_BOOK_PURCHASE_RANDOM())

    const baselineMeanMs = HOUR_MS / 10
    const moreAttractiveMeanMs = HOUR_MS / 20
    expect(cadenceOf(baselineAfter).remainingUntilOpportunityMs).toBe(exponentialSampleMs(baselineMeanMs, u))
    expect(cadenceOf(moreAttractiveAfter).remainingUntilOpportunityMs).toBe(exponentialSampleMs(moreAttractiveMeanMs, u))
    expect(cadenceOf(moreAttractiveAfter).remainingUntilOpportunityMs).toBeLessThan(cadenceOf(baselineAfter).remainingUntilOpportunityMs)

    // Sale composition, inventory consequence, and fulfillment rules are entirely unaffected by demand configuration:
    // identical purchase randomness produces an identical basket and settlement amount either way.
    const baselineNewTransaction = baselineAfter.dollarFinance.transactions.records[baselineAfter.dollarFinance.transactions.records.length - 1]
    const moreAttractiveNewTransaction = moreAttractiveAfter.dollarFinance.transactions.records[moreAttractiveAfter.dollarFinance.transactions.records.length - 1]
    expect(baselineNewTransaction.amountCents).toBe(moreAttractiveNewTransaction.amountCents)
    expect(inventoryOf(baselineAfter)).toBe(inventoryOf(moreAttractiveAfter))
    expect(salesCountOf(baselineAfter)).toBe(salesCountOf(moreAttractiveAfter))
  })

  it('does not retroactively rescale an already-scheduled countdown when demand configuration changes', () => {
    const seeded = createInitialGameState()
    const partiallyElapsed = advanceGameState(seeded, 100_000)
    expect(cadenceOf(partiallyElapsed).remainingUntilOpportunityMs).toBe(260_000)

    // Reconfigure demand (as a future Upgrade might) without consuming the current opportunity.
    const reconfigured: GameState = {
      ...partiallyElapsed,
      bookstoreSalesCadence: {
        records: partiallyElapsed.bookstoreSalesCadence.records.map((record) => ({ ...record, attractivenessMultiplier: 5.0 })),
      },
    }
    // The already-scheduled countdown is untouched by the reconfiguration itself.
    expect(cadenceOf(reconfigured).remainingUntilOpportunityMs).toBe(260_000)

    // Advancing less than the remaining countdown still simply decrements it — no magical rescaling to the new rate.
    const stillWaiting = advanceGameState(reconfigured, 100_000, Math.random, () => { throw new Error('must not sample before the already-scheduled opportunity is due') })
    expect(cadenceOf(stillWaiting).remainingUntilOpportunityMs).toBe(160_000)

    // Only once that already-scheduled opportunity is actually consumed does the next schedule read the new configuration.
    const consumed = advanceGameState(stillWaiting, 160_000, Math.random, () => 0.3)
    const newEffectiveRate = 10 * 5.0
    const newMeanMs = HOUR_MS / newEffectiveRate
    expect(cadenceOf(consumed).remainingUntilOpportunityMs).toBe(exponentialSampleMs(newMeanMs, 0.3))
  })
})

describe('Bookstore Sales Cadence — randomness is independent from Credential Access', () => {
  it('a due Bookstore opportunity never consumes credentialAccessRandom', () => {
    const advanced = advanceGameState(
      createInitialGameState(),
      360_000,
      () => { throw new Error('must not touch credentialAccessRandom') },
      () => 0.42,
    )
    expect(salesCountOf(advanced)).toBe(2)
    expect(cadenceOf(advanced).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.42))
  })
})

describe('Bookstore Sales Cadence — purchase randomness is independent from demand and Credential Access', () => {
  it('a due Bookstore opportunity draws its purchase composition from its own bookstorePurchaseRandom channel, never demand or Credential Access', () => {
    let demandDraws = 0
    let purchaseDraws = 0
    const advanced = advanceGameState(
      createInitialGameState(),
      360_000,
      () => { throw new Error('must not touch credentialAccessRandom') },
      () => { demandDraws += 1; return 0.42 },
      () => { purchaseDraws += 1; return 0.1 },
    )
    expect(demandDraws).toBe(1)
    // One basket-size draw plus one item-selection draw for the deterministic single-item basket this composes.
    expect(purchaseDraws).toBe(2)
    expect(salesCountOf(advanced)).toBe(2)
  })
})

describe('Bookstore Sales Cadence — large elapsed steps contain multiple chronological opportunities', () => {
  it('chaining two due opportunities (each freshly sampled) processes exactly two canonical sale attempts', () => {
    const afterFirst = advanceGameState(createInitialGameState(), 360_000, Math.random, () => 0.3, ONE_BOOK_PURCHASE_RANDOM())
    // Advancing exactly the freshly scheduled countdown — not a reconstructed sum — keeps this
    // boundary check free of floating-point addition/subtraction round-trip error.
    const secondIntervalMs = cadenceOf(afterFirst).remainingUntilOpportunityMs
    const afterSecond = advanceGameState(afterFirst, secondIntervalMs, Math.random, () => 0.3, ONE_BOOK_PURCHASE_RANDOM())
    expect(salesCountOf(afterSecond)).toBe(3)
    expect(inventoryOf(afterSecond)).toBe(358)
    expect(cadenceOf(afterSecond).remainingUntilOpportunityMs).toBe(exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.3))
  })

  it('a large single step agrees with an equivalent chronological partition under the same deterministic random sequences', () => {
    const seed = createInitialGameState()
    const sequenceValues = [0.15, 0.55, 0.35, 0.75, 0.05]
    const purchaseSequenceValues = [0.1, 0.9, 0.75, 0.2, 0.4, 0.6, 0.3, 0.8, 0.05, 0.99]

    const largeStep = advanceGameState(seed, 1_200_000, Math.random, fixedSequenceRandom(sequenceValues), fixedSequenceRandom(purchaseSequenceValues))

    const sharedRandom = fixedSequenceRandom(sequenceValues)
    const sharedPurchaseRandom = fixedSequenceRandom(purchaseSequenceValues)
    const partitioned = advanceGameState(advanceGameState(seed, 600_000, Math.random, sharedRandom, sharedPurchaseRandom), 600_000, Math.random, sharedRandom, sharedPurchaseRandom)

    // Every canonical business/world consequence — sales, stock, finance, Backend, World —
    // is required to agree exactly between the two runs.
    expect(withoutBookstoreBackgroundTiming(largeStep)).toEqual(withoutBookstoreBackgroundTiming(partitioned))
    // The countdown itself is canonical runtime truth, not something to ignore: the two runs reach
    // the split point via different floating-point accumulation paths (one continuous 1,200,000 ms
    // run vs. two 600,000 ms runs), so it is asserted separately, within ordinary floating-point
    // tolerance, rather than folded into the exact comparison above or dropped entirely.
    expectCadenceCountdownsToAgree(largeStep, partitioned)
  })
})

describe('Bookstore Sales Cadence — causal boundary: opportunities observe Backend truth at their own due time', () => {
  /**
   * A compact fixture built from real Device connectivity-recovery mechanics
   * (`interruptLocalNetworkConnectivity` + srv-02's own REBOOT_ON_DISCONNECT
   * recovery cycle: 4,000 ms SHUTTING_DOWN + 6,000 ms BOOTING = 10,000 ms
   * total), composed with a bespoke demand rate whose mean interval is
   * exactly 6,000 ms (`locationOpportunityRatePerHour = 600`) so that the
   * first due opportunity (t=6,000, seeded directly as canonical runtime
   * state rather than sampled) falls inside that recovery window, while the
   * second — sampled from a controlled `u` chosen to land comfortably after
   * recovery completes — falls after it, without inventing a shadow backend
   * flag.
   */
  const COMPACT_LOCATION_RATE_PER_HOUR = 600 // mean interval = 3,600,000 / 600 = 6,000 ms
  const FIRST_INTERVAL_MS = 6_000
  const SECOND_SAMPLE_U = 0.7
  const SECOND_INTERVAL_MS = exponentialSampleMs(FIRST_INTERVAL_MS, SECOND_SAMPLE_U)
  // Stateless: the same behavior every call, so it is safe to reuse across the large-step and partitioned branches without sharing one instance.
  const purchaseRandom = () => 0.15

  function disruptedFixtureWithCompactCadence(): GameState {
    const initial = createInitialGameState()
    const compactCadence: GameState = {
      ...initial,
      bookstoreSalesCadence: {
        records: [createBookstoreBranchSalesCadenceRecord({
          branchId: BOOKSTORE_BRANCH_ID,
          locationOpportunityRatePerHour: COMPACT_LOCATION_RATE_PER_HOUR,
          attractivenessMultiplier: 1.0,
          remainingUntilOpportunityMs: FIRST_INTERVAL_MS,
        })],
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

    const afterFirstOpportunity = advanceGameState(fixture, FIRST_INTERVAL_MS, Math.random, constantRandom(SECOND_SAMPLE_U), purchaseRandom)
    expect(salesCountOf(afterFirstOpportunity)).toBe(1)
    expect(inventoryOf(afterFirstOpportunity)).toBe(360)
    expect(hostOperational(afterFirstOpportunity, BOOKSTORE_BACKEND_DEVICE_ID).lifecycle).not.toBe('RUNNING')
    expect(cadenceOf(afterFirstOpportunity).remainingUntilOpportunityMs).toBe(SECOND_INTERVAL_MS)

    const afterSecondOpportunity = advanceGameState(afterFirstOpportunity, SECOND_INTERVAL_MS, Math.random, constantRandom(SECOND_SAMPLE_U), purchaseRandom)
    expect(hostOperational(afterSecondOpportunity, BOOKSTORE_BACKEND_DEVICE_ID)).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(salesCountOf(afterSecondOpportunity)).toBe(2)
    expect(inventoryOf(afterSecondOpportunity)).toBe(359)
  })

  it('one large step agrees with the equivalent chronological partition, under the same causal result', () => {
    const fixture = disruptedFixtureWithCompactCadence()
    const largeStep = advanceGameState(fixture, FIRST_INTERVAL_MS + SECOND_INTERVAL_MS, Math.random, constantRandom(SECOND_SAMPLE_U), purchaseRandom)
    const partitioned = advanceGameState(advanceGameState(fixture, FIRST_INTERVAL_MS, Math.random, constantRandom(SECOND_SAMPLE_U), purchaseRandom), SECOND_INTERVAL_MS, Math.random, constantRandom(SECOND_SAMPLE_U), purchaseRandom)
    // See the analogous note above: every canonical consequence besides the countdown must agree
    // exactly, and the countdown itself must still agree within ordinary floating-point tolerance.
    expect(withoutBookstoreBackgroundTiming(largeStep)).toEqual(withoutBookstoreBackgroundTiming(partitioned))
    expectCadenceCountdownsToAgree(largeStep, partitioned)

    // The single large step itself must show the same one-refusal-then-one-sale causal result,
    // proving it did not blindly observe only the start-of-interval or end-of-interval truth.
    expect(salesCountOf(largeStep)).toBe(2)
    expect(inventoryOf(largeStep)).toBe(359)
  })
})

describe('Bookstore Sales Cadence — stack-safe processing of many due opportunities', () => {
  /** The rest of canonical advancement, stubbed to a no-op so this proof exercises only cadence's own opportunity-boundary walk, not thousands of expensive full-pipeline passes. */
  const identityWorld = (state: GameState, _elapsedMs: number): GameState => state

  it('consumes tens of thousands of due opportunities in one call without a recursive stack failure, preserving a valid positive cadence remainder', () => {
    const opportunities = 100_000
    const subsequentIntervalMs = exponentialSampleMs(INITIAL_MEAN_INTERVAL_MS, 0.5)
    const elapsedMs = INITIAL_MEAN_INTERVAL_MS + opportunities * subsequentIntervalMs
    const seed = createInitialGameState()

    let result: GameState | undefined
    expect(() => { result = advanceBookstoreSalesCadence(seed, elapsedMs, identityWorld, () => 0.5, ONE_BOOK_PURCHASE_RANDOM()) }).not.toThrow()

    // Every sampled subsequent interval used the same fixed random value, so a correct walk always
    // lands on a fresh, valid, positive countdown no larger than one full freshly sampled interval —
    // exactly how many of the ~100,000 segments floating-point accumulation lands on relative to this
    // chosen `elapsedMs` is not itself the point being proven here (see the dedicated boundary and
    // partition-equivalence tests above for exact single/double-opportunity boundaries).
    const remaining = cadenceOf(result!).remainingUntilOpportunityMs
    expect(Number.isFinite(remaining)).toBe(true)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(subsequentIntervalMs + 1)
    // Every opportunity really attempted a canonical sale, each deterministically composing the same
    // one-unit $20 basket, until Retail Clearing's seeded 80,000 cents ran out (40 sales), then kept
    // being consumed as ordinary insufficient-funds refusals — proving the loop walked tens of
    // thousands of segments rather than stopping early.
    expect(salesCountOf(result!)).toBe(41)
    expect(inventoryOf(result!)).toBe(320)
  })
})

describe('Bookstore Sales Cadence — no-op state semantics', () => {
  const identityWorld = (state: GameState, _elapsedMs: number): GameState => state

  it('delegates straight through with no synthetic cadence mutation at zero elapsed time', () => {
    const state = createInitialGameState()
    expect(advanceBookstoreSalesCadence(state, 0, identityWorld)).toBe(state)
  })

  it('delegates straight through with no synthetic cadence mutation when no Bookstore cadence record is represented', () => {
    const initial = createInitialGameState()
    const noCadence: GameState = { ...initial, bookstoreSalesCadence: { records: [] } }
    expect(advanceBookstoreSalesCadence(noCadence, 5_000, identityWorld)).toBe(noCadence)
  })

  it('returns exactly what advanceWorld produces for both no-op paths, without additional wrapping', () => {
    const state = createInitialGameState()
    const marker: GameState = { ...state, recentActivity: { entries: [] } }
    const stubWorld = (_state: GameState, _elapsedMs: number): GameState => marker

    expect(advanceBookstoreSalesCadence(state, 0, stubWorld)).toBe(marker)

    const noCadence: GameState = { ...state, bookstoreSalesCadence: { records: [] } }
    expect(advanceBookstoreSalesCadence(noCadence, 5_000, stubWorld)).toBe(marker)
  })

  it('still advances the real countdown for positive elapsed time once at least one cadence record exists', () => {
    const state = createInitialGameState()
    const result = advanceBookstoreSalesCadence(state, 1, identityWorld)
    expect(result).not.toBe(state)
    expect(cadenceOf(result).remainingUntilOpportunityMs).toBe(359_999)
  })
})
