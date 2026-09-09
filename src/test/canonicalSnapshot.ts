import type { GameState } from '../core/game/types'

/**
 * Bookstore Sales Cadence's `remainingUntilOpportunityMs` is genuine
 * canonical state that keeps advancing with real represented elapsed time
 * regardless of what a test scenario is actually exercising (`GameContext`'s
 * own scheduler drives canonical advancement from real wall-clock time). A
 * test that snapshots canonical `GameState` to prove some unrelated
 * interaction touched nothing else should not fail merely because that one
 * continuously-ticking field legitimately moved forward in the background
 * while the test ran.
 *
 * This normalizes only that one field, to a fixed deterministic value,
 * before such a comparison — it deliberately preserves everything else about
 * cadence's represented shape (record presence/count, `branchId`,
 * `locationOpportunityRatePerHour`, `attractivenessMultiplier`, and
 * ordering), so a test using this still catches a real regression that
 * added, removed, or reconfigured a cadence record, rather than only
 * ignoring legitimate background timing.
 */
export function withoutBookstoreCadenceTiming<T extends { readonly bookstoreSalesCadence?: GameState['bookstoreSalesCadence']; readonly bookstoreTrend?: GameState['bookstoreTrend'] }>(state: T): T {
  if (!state.bookstoreSalesCadence) return state
  const normalized = {
    ...state,
    bookstoreSalesCadence: {
      records: state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 0 })),
    },
  }
  return normalized.bookstoreTrend?.active ? {
    ...normalized,
    bookstoreTrend: { active: { ...normalized.bookstoreTrend.active, remainingDurationMs: 0 } },
  } : normalized
}
