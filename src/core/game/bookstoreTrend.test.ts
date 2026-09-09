import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { deriveBookstoreTrendPhase, isValidActiveBookstoreTrend } from './bookstoreTrend'
import { withoutBookstoreCadenceTiming } from '../../test/canonicalSnapshot'

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
    expect(withoutBookstoreCadenceTiming(partitioned)).toEqual(withoutBookstoreCadenceTiming(large))
    expect(partitioned.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs)
      .toBeCloseTo(large.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs, 8)
  })
})
