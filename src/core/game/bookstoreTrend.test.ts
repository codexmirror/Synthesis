import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { deriveBookstoreTrendPhase, isValidActiveBookstoreTrend } from './bookstoreTrend'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import { BOOKSTORE_BRANCH_ID } from './business'
import type { GameState } from './types'

function boundaryState(): GameState {
  const state = createInitialGameState()
  return {
    ...state,
    bookstoreTrend: { active: { ...state.bookstoreTrend.active!, remainingDurationMs: 150 } },
    bookstoreSalesCadence: { records: state.bookstoreSalesCadence.records.map(record => ({ ...record, remainingUntilOpportunityMs: 100 })) },
  }
}

function advanceAcrossBoundary(state: GameState, partitions: readonly number[]) {
  let demandDraws = 0
  let purchaseDraws = 0
  const nextIntervalAt100Ms = 1 - Math.exp(-100 / 360_000)
  const purchaseSamples = [0, 0.28]
  const demandRandom = () => { demandDraws += 1; return nextIntervalAt100Ms }
  const purchaseRandom = () => { purchaseDraws += 1; return purchaseSamples[(purchaseDraws - 1) % purchaseSamples.length] }
  const result = partitions.reduce<GameState>((current, elapsed) => advanceGameState(current, elapsed, () => 0, demandRandom, purchaseRandom), state)
  return { result, demandDraws, purchaseDraws }
}

describe('Bookstore Trend lifecycle', () => {
  it('seeds the one causal Science Fiction Trend and derives exact phase boundaries', () => {
    const state = createInitialGameState()
    expect(state.bookstoreTrend.active).toEqual({
      id: 'bookstore-trend-science-fiction-buy-pressure-v0', genre: 'SCIENCE_FICTION', activePressure: 120,
      totalDurationMs: 3_600_000, remainingDurationMs: 3_240_000,
    })
    expect(deriveBookstoreTrendPhase(state.bookstoreTrend.active!)).toBe('EMERGING')
    expect(deriveBookstoreTrendPhase({ ...state.bookstoreTrend.active!, remainingDurationMs: 2_880_000 })).toBe('ESTABLISHED')
    expect(deriveBookstoreTrendPhase({ ...state.bookstoreTrend.active!, remainingDurationMs: 900_000 })).toBe('LATE')
    expect(isValidActiveBookstoreTrend({ ...state.bookstoreTrend.active!, remainingDurationMs: 0 })).toBe(false)
    expect(deriveBookstoreTrendPhase({ ...state.bookstoreTrend.active!, totalDurationMs: Number.NaN })).toBeUndefined()
  })

  it('completes once to neutral pressure and never creates a successor', () => {
    const initial = createInitialGameState()
    const complete = advanceGameState(initial, 3_240_000, () => 0, () => 0.5, () => 0)
    expect(complete.bookstoreTrend.active).toBeNull()
    expect(complete.bookstoreMarket.genrePressures.find(x => x.genre === 'SCIENCE_FICTION')?.pressure).toBe(100)
    const again = advanceGameState(complete, 60_000, () => 0, () => 0.5, () => 0)
    expect(again.bookstoreTrend.active).toBeNull()
    expect(again.bookstoreMarket.genrePressures.find(x => x.genre === 'SCIENCE_FICTION')?.pressure).toBe(100)
  })

  it('is equivalent across a completion between sale opportunities', () => {
    const start = createInitialGameState()
    const large = advanceGameState(start, 3_500_000, () => 0, () => 0.5, () => 0.2)
    const partitioned = advanceGameState(advanceGameState(start, 3_200_000, () => 0, () => 0.5, () => 0.2), 300_000, () => 0, () => 0.5, () => 0.2)
    expect(withoutBookstoreBackgroundTiming(partitioned)).toEqual(withoutBookstoreBackgroundTiming(large))
    expect(partitioned.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs)
      .toBeCloseTo(large.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs, 8)
  })

  it('lets ordinary sales observe active then neutral Pressure across the exact Trend boundary', () => {
    const start = boundaryState()
    const large = advanceAcrossBoundary(start, [250])
    const partitioned = advanceAcrossBoundary(start, [150, 100])
    const neutralStart = {
      ...start,
      bookstoreTrend: { active: null },
      bookstoreMarket: { genrePressures: start.bookstoreMarket.genrePressures.map(record => record.genre === 'SCIENCE_FICTION' ? { ...record, pressure: 100 } : record) },
    }
    const neutral = advanceAcrossBoundary(neutralStart, [250])
    const newSaleNames = (state: typeof large.result) => state.bookstoreCommerce.records
      .find(record => record.branchId === BOOKSTORE_BRANCH_ID)!.completedSales.slice(-2).map(sale => sale.lines[0].capturedName)

    // 0.28 lands in Static Bloom's weighted interval only while Science
    // Fiction has Pressure 120; after completion the same draw lands in Glass District.
    expect(newSaleNames(large.result)).toEqual(['Static Bloom', 'Glass District'])
    expect(newSaleNames(neutral.result)).toEqual(['Glass District', 'Glass District'])
    expect(large.result.bookstoreTrend.active).toBeNull()
    expect(large.result.bookstoreMarket.genrePressures.find(record => record.genre === 'SCIENCE_FICTION')?.pressure).toBe(100)

    // Trend lifecycle adds no RNG and does not change cadence sampling or the
    // one-item basket's one size + one selection draw semantics.
    expect({ demandDraws: large.demandDraws, purchaseDraws: large.purchaseDraws }).toEqual({ demandDraws: 2, purchaseDraws: 4 })
    expect(neutral.demandDraws).toBe(large.demandDraws)
    expect(neutral.purchaseDraws).toBe(large.purchaseDraws)
    expect(neutral.result.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs)
      .toBeCloseTo(large.result.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs, 8)

    expect(partitioned.demandDraws).toBe(large.demandDraws)
    expect(partitioned.purchaseDraws).toBe(large.purchaseDraws)
    expect(withoutBookstoreBackgroundTiming(partitioned.result)).toEqual(withoutBookstoreBackgroundTiming(large.result))
    expect(partitioned.result.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs)
      .toBeCloseTo(large.result.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs, 8)
  })
})
