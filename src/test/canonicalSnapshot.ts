import type { GameState } from '../core/game/types'

/**
 * Bookstore Sales Cadence's `remainingUntilOpportunityMs` and the active
 * Bookstore Trend's `remainingDurationMs` are independent canonical timing
 * fields that genuinely advance with represented elapsed time,
 * regardless of what a test scenario is actually exercising (`GameContext`'s
 * own scheduler drives canonical advancement from real wall-clock time). A
 * test that snapshots canonical `GameState` to prove some unrelated
 * interaction touched nothing else should not fail merely because those
 * continuously ticking fields legitimately moved forward in the background
 * while the test ran.
 *
 * This normalizes only those two countdown fields to fixed deterministic values
 * before such a comparison — it deliberately preserves everything else about
 * cadence's represented shape (record presence/count, `branchId`,
 * `locationOpportunityRatePerHour`, `attractivenessMultiplier`, and
 * ordering), plus every non-timing Trend field, so a test using this still catches a real regression that
 * added, removed, or reconfigured a cadence record, rather than only
 * ignoring legitimate background timing.
 */
export function withoutBookstoreBackgroundTiming<T extends { readonly bookstoreSalesCadence?: GameState['bookstoreSalesCadence']; readonly bookstoreTrend?: GameState['bookstoreTrend'] }>(state: T): T {
  const normalized = state.bookstoreSalesCadence ? {
    ...state,
    bookstoreSalesCadence: {
      records: state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 0 })),
    },
  } : state
  return normalized.bookstoreTrend?.active ? {
    ...normalized,
    bookstoreTrend: { active: { ...normalized.bookstoreTrend.active, remainingDurationMs: 0 } },
  } : normalized
}
