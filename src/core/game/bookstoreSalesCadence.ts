import { BOOKSTORE_BRANCH_ID } from './business'
import { executeBookstoreSale } from './bookstoreSale'
import type { BookstoreBranchSalesCadenceRecord, BookstoreSalesCadenceState, GameState } from './types'

/**
 * The seeded Bookstore Branch's authored V1 cadence fixture: a sale
 * opportunity becomes due every 30 real represented seconds. This is an
 * authored fixture for this one Branch, not a universal law for every
 * Bookstore or Business.
 */
export const BOOKSTORE_BRANCH_SALE_OPPORTUNITY_INTERVAL_MS = 30_000

/**
 * Construct one Bookstore Branch sales cadence record with its canonical
 * numeric invariants enforced at construction, matching the existing
 * `createBookstoreBranchOperationsRecord` convention: both `opportunityIntervalMs`
 * and `remainingUntilOpportunityMs` must be positive finite numbers. A caller
 * that authors an impossible cadence (zero or negative interval) has a bug to
 * fix, not a value to have silently reinterpreted — a non-positive interval
 * would make opportunities due without any represented elapsed time passing.
 */
export function createBookstoreBranchSalesCadenceRecord(params: {
  readonly branchId: string
  readonly opportunityIntervalMs: number
  readonly remainingUntilOpportunityMs: number
}): BookstoreBranchSalesCadenceRecord {
  if (!Number.isFinite(params.opportunityIntervalMs) || params.opportunityIntervalMs <= 0) {
    throw new RangeError('Represented Bookstore sale opportunity interval must be a positive finite number')
  }
  if (!Number.isFinite(params.remainingUntilOpportunityMs) || params.remainingUntilOpportunityMs <= 0) {
    throw new RangeError('Represented Bookstore remaining-until-opportunity time must be a positive finite number')
  }
  return {
    branchId: params.branchId,
    opportunityIntervalMs: params.opportunityIntervalMs,
    remainingUntilOpportunityMs: params.remainingUntilOpportunityMs,
  }
}

export function createInitialBookstoreSalesCadenceState(): BookstoreSalesCadenceState {
  return {
    records: [createBookstoreBranchSalesCadenceRecord({
      branchId: BOOKSTORE_BRANCH_ID,
      opportunityIntervalMs: BOOKSTORE_BRANCH_SALE_OPPORTUNITY_INTERVAL_MS,
      remainingUntilOpportunityMs: BOOKSTORE_BRANCH_SALE_OPPORTUNITY_INTERVAL_MS,
    })],
  }
}

/**
 * Resolve the current sales cadence record for one Business Branch by stable
 * Branch ID, or `undefined` where this Branch has no such concrete cadence
 * represented at all — a legitimate structural state, not a defect. This is a
 * separate, optional join on top of generic Business Branch structural
 * identity, independent of `resolveBookstoreCommerceForBranch`,
 * `resolveBookstoreOperationsForBranch`, and `resolveBookstoreBackendForBranch`.
 */
export function resolveBookstoreSalesCadenceForBranch(state: GameState, branchId: string): BookstoreBranchSalesCadenceRecord | undefined {
  return state.bookstoreSalesCadence.records.find((candidate) => candidate.branchId === branchId)
}

function replaceCadenceRecord(state: GameState, next: BookstoreBranchSalesCadenceRecord): GameState {
  return {
    ...state,
    bookstoreSalesCadence: {
      records: state.bookstoreSalesCadence.records.map((record) => record.branchId === next.branchId ? next : record),
    },
  }
}

/**
 * Canonical advancement for every represented Bookstore sales cadence,
 * called from `advanceGameState` as the outermost composition so that a due
 * opportunity always observes the canonical World/Business truth that exists
 * at its own due time — never the truth from the start or the end of a large
 * `elapsedMs` alone.
 *
 * `advanceWorld` is the rest of canonical advancement (every other mechanic
 * `advanceGameState` composes), supplied by the caller rather than imported
 * directly, so this module never owns or reorders unrelated advancement — it
 * only decides *when* to interrupt that advancement to attempt one canonical
 * sale. A large `elapsedMs` is chronologically partitioned at each Branch's
 * own opportunity boundaries: `advanceWorld` is called once per boundary-free
 * segment, exactly as if a caller had made one `advanceGameState` call per
 * segment instead of one large call, so the two are equivalent whenever the
 * composed mechanics are themselves deterministic and partition-coherent
 * (as `advanceGameState`'s own module documentation already requires of its
 * per-Device causal composition).
 *
 * One due opportunity always calls the existing canonical
 * `executeBookstoreSale` exactly once for that Branch and is consumed
 * whether the sale succeeds or refuses — this function never inspects why a
 * sale did or did not complete, never retries a refused opportunity, and
 * never stores backlog, missed-opportunity, or waiting-customer state. The
 * next full cycle begins immediately after every due opportunity.
 */
export function advanceBookstoreSalesCadence(
  state: GameState,
  elapsedMs: number,
  advanceWorld: (state: GameState, elapsedMs: number) => GameState,
): GameState {
  // A record's `remainingUntilOpportunityMs` is always positive, so this is
  // empty whenever `elapsedMs` cannot reach any opportunity at all —
  // including `elapsedMs <= 0`, which then still calls `advanceWorld` exactly
  // once, matching this call's behavior before Sales Cadence existed.
  const dueRecords = state.bookstoreSalesCadence.records.filter((record) => record.remainingUntilOpportunityMs <= elapsedMs)
  if (dueRecords.length === 0) {
    const decremented: GameState = {
      ...state,
      bookstoreSalesCadence: {
        records: state.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: record.remainingUntilOpportunityMs - elapsedMs })),
      },
    }
    return advanceWorld(decremented, elapsedMs)
  }

  // Chronologically the earliest due opportunity across every cadence
  // record. `advanceWorld` only ever sees this smaller segment, so the
  // World/Business truth it produces is exactly the truth that exists at
  // this due instant — never truth from later in a larger `elapsedMs`.
  const segmentMs = Math.min(...dueRecords.map((record) => record.remainingUntilOpportunityMs))
  let nextState = advanceWorld(state, segmentMs)

  for (const record of nextState.bookstoreSalesCadence.records) {
    if (record.remainingUntilOpportunityMs !== segmentMs) {
      nextState = replaceCadenceRecord(nextState, { ...record, remainingUntilOpportunityMs: record.remainingUntilOpportunityMs - segmentMs })
      continue
    }
    // Consumed whether this attempt sells or refuses — the next full cycle begins immediately either way.
    const attempted = executeBookstoreSale(nextState, record.branchId)
    nextState = replaceCadenceRecord(attempted.state, { ...record, remainingUntilOpportunityMs: record.opportunityIntervalMs })
  }

  const remainingElapsedMs = elapsedMs - segmentMs
  // Only recurse when represented elapsed time is actually left to advance;
  // otherwise this segment's own `advanceWorld` call above is already the
  // one and only call this `elapsedMs` warrants.
  return remainingElapsedMs > 0 ? advanceBookstoreSalesCadence(nextState, remainingElapsedMs, advanceWorld) : nextState
}
