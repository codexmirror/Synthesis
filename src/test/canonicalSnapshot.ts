import type { GameState } from '../core/game/types'

/**
 * Bookstore Sales Cadence timing is genuine canonical state that keeps
 * advancing with real represented elapsed time regardless of what a test
 * scenario is actually exercising (`GameContext`'s own scheduler drives
 * canonical advancement from real wall-clock time). A test that snapshots
 * canonical `GameState` to prove some unrelated interaction touched nothing
 * else should not fail merely because that one continuously-ticking field
 * legitimately moved forward in the background while the test ran, so this
 * normalizes it away before such a comparison.
 */
export function withoutBookstoreCadenceTiming<T extends { readonly bookstoreSalesCadence?: GameState['bookstoreSalesCadence'] }>(state: T): T {
  if (!state.bookstoreSalesCadence) return state
  return { ...state, bookstoreSalesCadence: { records: [] } }
}
