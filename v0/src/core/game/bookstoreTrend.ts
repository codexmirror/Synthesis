import { BOOKSTORE_BOOK_GENRES, BOOKSTORE_SCIENCE_FICTION_ACTIVE_TREND_PRESSURE } from './bookstoreMarket'
import type { ActiveBookstoreTrend, BookstoreTrendPhase, BookstoreTrendState, GameState } from './types'

export const BOOKSTORE_SCIENCE_FICTION_TREND_ID = 'bookstore-trend-science-fiction-buy-pressure-v0'
export const BOOKSTORE_TREND_TOTAL_DURATION_MS = 3_600_000
export const BOOKSTORE_TREND_INITIAL_REMAINING_DURATION_MS = 3_240_000
export const BOOKSTORE_TREND_ACTIVE_PRESSURE = BOOKSTORE_SCIENCE_FICTION_ACTIVE_TREND_PRESSURE

export function createInitialBookstoreTrendState(): BookstoreTrendState {
  return { active: {
    id: BOOKSTORE_SCIENCE_FICTION_TREND_ID,
    genre: 'SCIENCE_FICTION',
    activePressure: BOOKSTORE_TREND_ACTIVE_PRESSURE,
    totalDurationMs: BOOKSTORE_TREND_TOTAL_DURATION_MS,
    remainingDurationMs: BOOKSTORE_TREND_INITIAL_REMAINING_DURATION_MS,
  } }
}

export function isValidActiveBookstoreTrend(trend: ActiveBookstoreTrend): boolean {
  return typeof trend.id === 'string' && trend.id.length > 0
    && BOOKSTORE_BOOK_GENRES.includes(trend.genre)
    && Number.isSafeInteger(trend.activePressure) && trend.activePressure > 0
    && Number.isSafeInteger(trend.totalDurationMs) && trend.totalDurationMs > 0
    // Canonical cadence boundaries can divide an integer-millisecond caller
    // step at a fractional millisecond; remaining time therefore stays exact
    // and finite rather than being rounded at each partition.
    && Number.isFinite(trend.remainingDurationMs) && trend.remainingDurationMs > 0
    && trend.remainingDurationMs <= trend.totalDurationMs
}

/** Phase is observation-time derivation only; malformed or completed truth produces none. */
export function deriveBookstoreTrendPhase(trend: ActiveBookstoreTrend): BookstoreTrendPhase | undefined {
  if (!isValidActiveBookstoreTrend(trend)) return undefined
  const elapsed = trend.totalDurationMs - trend.remainingDurationMs
  if (elapsed * 100 >= trend.totalDurationMs * 75) return 'LATE'
  if (elapsed * 100 >= trend.totalDurationMs * 20) return 'ESTABLISHED'
  return 'EMERGING'
}

/** Canonical represented-time lifecycle. Completion has one narrow consequence and no successor. */
export function advanceBookstoreTrend(state: GameState, elapsedMs: number): GameState {
  const trend = state.bookstoreTrend.active
  if (!trend || !isValidActiveBookstoreTrend(trend) || elapsedMs <= 0 || !Number.isFinite(elapsedMs)) return state
  const remainingDurationMs = Math.max(0, trend.remainingDurationMs - elapsedMs)
  if (remainingDurationMs > 0) {
    return { ...state, bookstoreTrend: { active: { ...trend, remainingDurationMs } } }
  }
  return {
    ...state,
    bookstoreTrend: { active: null },
    bookstoreMarket: { genrePressures: state.bookstoreMarket.genrePressures.map(record =>
      record.genre === trend.genre ? { ...record, pressure: 100 } : record) },
  }
}
