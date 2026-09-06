import { BOOKSTORE_BRANCH_ID } from './business'
import { executeBookstoreSale } from './bookstoreSale'
import type { BookstoreBranchSalesCadenceRecord, BookstoreSalesCadenceState, GameState } from './types'

const HOUR_MS = 3_600_000

/**
 * The seeded Bookstore Branch's authored V1 demand fixture: this Branch's
 * location/context is authored to produce 10 opportunities per represented
 * hour before any Store attractiveness effect. This is an authored fixture
 * for this one Branch, not a universal law for every Bookstore or Business.
 */
export const BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR = 10

/**
 * The seeded Bookstore Branch's authored V1 attractiveness fixture: neutral
 * (no effect on the location rate). Upgrades are the accepted future path to
 * changing this value; none are implemented in this slice.
 */
export const BOOKSTORE_BRANCH_ATTRACTIVENESS_MULTIPLIER = 1.0

/**
 * Derive one Branch's current effective sale-opportunity rate, in
 * opportunities per represented hour, from its two represented demand
 * inputs. Always derived fresh from current configuration — never stored
 * redundantly on the record — so it can never drift from the inputs it
 * describes.
 */
export function deriveEffectiveBookstoreOpportunityRatePerHour(record: BookstoreBranchSalesCadenceRecord): number {
  return record.locationOpportunityRatePerHour * record.attractivenessMultiplier
}

/** The mean represented milliseconds between opportunities implied by one effective opportunities-per-hour rate. */
function deriveMeanBookstoreOpportunityIntervalMs(effectiveOpportunityRatePerHour: number): number {
  return HOUR_MS / effectiveOpportunityRatePerHour
}

/**
 * Sample one irregular next-opportunity interval from the given mean
 * interval, using inverse-CDF exponential sampling (`-mean * ln(1 - U)` for
 * `U` uniform on `[0, 1)`) so that a represented rate of N/hour means
 * approximately N opportunities per represented hour over time, while
 * individual gaps naturally vary.
 *
 * Defensive by construction: `random`'s contract matches `Math.random` —
 * a value in `[0, 1)` — but a value at or past either edge of that range
 * (including exactly `0`, which `Math.random` can legitimately return, and
 * which would otherwise sample a degenerate zero-length interval) is never
 * trusted blindly. Any input or resulting sample that is not a finite
 * positive number falls back to the mean interval itself, so this can never
 * hand back a zero, negative, or infinite countdown — no valid or broken
 * `Math.random`-style source can create a zero-time infinite opportunity
 * loop.
 */
function sampleBookstoreOpportunityIntervalMs(meanIntervalMs: number, random: () => number): number {
  const raw = random()
  const uniform = Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : 0.5
  const sampledMs = -meanIntervalMs * Math.log(1 - uniform)
  return Number.isFinite(sampledMs) && sampledMs > 0 ? sampledMs : meanIntervalMs
}

/**
 * Construct one Bookstore Branch sales cadence record with its canonical
 * numeric invariants enforced at construction, matching the existing
 * `createBookstoreBranchOperationsRecord` convention: `locationOpportunityRatePerHour`,
 * `attractivenessMultiplier`, and `remainingUntilOpportunityMs` must each be
 * positive finite numbers. A caller that authors impossible demand
 * configuration (zero, negative, non-finite) has a bug to fix, not a value
 * to have silently reinterpreted — a non-positive rate cannot derive a
 * finite mean interval, and a non-positive countdown would make an
 * opportunity due without any represented elapsed time passing.
 */
export function createBookstoreBranchSalesCadenceRecord(params: {
  readonly branchId: string
  readonly locationOpportunityRatePerHour: number
  readonly attractivenessMultiplier: number
  readonly remainingUntilOpportunityMs: number
}): BookstoreBranchSalesCadenceRecord {
  if (!Number.isFinite(params.locationOpportunityRatePerHour) || params.locationOpportunityRatePerHour <= 0) {
    throw new RangeError('Represented Bookstore location opportunity rate must be a positive finite number')
  }
  if (!Number.isFinite(params.attractivenessMultiplier) || params.attractivenessMultiplier <= 0) {
    throw new RangeError('Represented Bookstore attractiveness multiplier must be a positive finite number')
  }
  if (!Number.isFinite(params.remainingUntilOpportunityMs) || params.remainingUntilOpportunityMs <= 0) {
    throw new RangeError('Represented Bookstore remaining-until-opportunity time must be a positive finite number')
  }
  return {
    branchId: params.branchId,
    locationOpportunityRatePerHour: params.locationOpportunityRatePerHour,
    attractivenessMultiplier: params.attractivenessMultiplier,
    remainingUntilOpportunityMs: params.remainingUntilOpportunityMs,
  }
}

/**
 * There is no free or random sale at game construction: the first
 * `remainingUntilOpportunityMs` is seeded deterministically to the mean
 * interval implied by the authored starting demand (10/hour ->
 * 360,000 ms), never sampled. Stochastic sampling begins only once that
 * first opportunity is actually consumed.
 */
export function createInitialBookstoreSalesCadenceState(): BookstoreSalesCadenceState {
  const effectiveOpportunityRatePerHour = BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR * BOOKSTORE_BRANCH_ATTRACTIVENESS_MULTIPLIER
  return {
    records: [createBookstoreBranchSalesCadenceRecord({
      branchId: BOOKSTORE_BRANCH_ID,
      locationOpportunityRatePerHour: BOOKSTORE_BRANCH_LOCATION_OPPORTUNITY_RATE_PER_HOUR,
      attractivenessMultiplier: BOOKSTORE_BRANCH_ATTRACTIVENESS_MULTIPLIER,
      remainingUntilOpportunityMs: deriveMeanBookstoreOpportunityIntervalMs(effectiveOpportunityRatePerHour),
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
 * Schedule the next opportunity for one Branch immediately after its current
 * due opportunity was consumed. Demand configuration is read fresh from
 * `state` at this exact instant — never from the stale pre-attempt record —
 * so that a future Upgrade mechanic (not implemented in this slice) that
 * changes `locationOpportunityRatePerHour` or `attractivenessMultiplier`
 * during the same segment affects only the *next* schedule, never the
 * opportunity that was just consumed. Exactly one `random` sample is drawn
 * here per due opportunity, whether it sold or refused.
 */
function scheduleNextBookstoreOpportunity(state: GameState, branchId: string, staleRecord: BookstoreBranchSalesCadenceRecord, random: () => number): BookstoreBranchSalesCadenceRecord {
  const current = resolveBookstoreSalesCadenceForBranch(state, branchId) ?? staleRecord
  const meanIntervalMs = deriveMeanBookstoreOpportunityIntervalMs(deriveEffectiveBookstoreOpportunityRatePerHour(current))
  return { ...current, remainingUntilOpportunityMs: sampleBookstoreOpportunityIntervalMs(meanIntervalMs, random) }
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
 * per-Device causal composition) and the same `bookstoreDemandRandom`
 * sequence is supplied in both cases. Segments are walked iteratively rather
 * than recursively, so a large `elapsedMs` containing many due opportunities
 * advances in a bounded loop instead of consuming call-stack depth per
 * opportunity.
 *
 * One due opportunity always calls the existing canonical
 * `executeBookstoreSale` exactly once for that Branch and is consumed
 * whether the sale succeeds or refuses — this function never inspects why a
 * sale did or did not complete, never retries a refused opportunity, and
 * never stores backlog, missed-opportunity, or waiting-customer state.
 * Immediately after that one attempt, exactly one `bookstoreDemandRandom`
 * sample schedules the next interval from the Branch's current effective
 * opportunity rate (`scheduleNextBookstoreOpportunity`) — semantically
 * isolated from `credentialAccessRandom`, which `advanceWorld` may itself
 * consume for an unrelated mechanic during the same segment. Randomness is
 * sampled only here, exactly once per consumed opportunity: never on an
 * ordinary tick that leaves no opportunity due, and never merely because
 * `advanceGameState` was called.
 *
 * Cadence mutates canonical state only where represented cadence truth
 * actually advances: a non-positive `elapsedMs` has no timer to advance, and
 * a Branch with no represented cadence record at all has no cadence truth to
 * advance, so both delegate straight to `advanceWorld` without manufacturing
 * a synthetic `bookstoreSalesCadence` copy of their own — preserving
 * whatever state/reference behavior the rest of canonical advancement
 * legitimately produces on its own.
 */
export function advanceBookstoreSalesCadence(
  state: GameState,
  elapsedMs: number,
  advanceWorld: (state: GameState, elapsedMs: number) => GameState,
  bookstoreDemandRandom: () => number = Math.random,
): GameState {
  if (elapsedMs <= 0 || state.bookstoreSalesCadence.records.length === 0) return advanceWorld(state, elapsedMs)

  let currentState = state
  let remainingElapsedMs = elapsedMs

  while (remainingElapsedMs > 0) {
    // A record's `remainingUntilOpportunityMs` is always positive, so this is
    // empty whenever no record can reach a due opportunity within what is
    // left of the elapsed interval.
    const dueRecords = currentState.bookstoreSalesCadence.records.filter((record) => record.remainingUntilOpportunityMs <= remainingElapsedMs)
    if (dueRecords.length === 0) {
      const decremented: GameState = {
        ...currentState,
        bookstoreSalesCadence: {
          records: currentState.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: record.remainingUntilOpportunityMs - remainingElapsedMs })),
        },
      }
      currentState = advanceWorld(decremented, remainingElapsedMs)
      break
    }

    // Chronologically the earliest due opportunity across every cadence
    // record. `advanceWorld` only ever sees this smaller segment, so the
    // World/Business truth it produces is exactly the truth that exists at
    // this due instant — never truth from later in a larger `elapsedMs`.
    const segmentMs = Math.min(...dueRecords.map((record) => record.remainingUntilOpportunityMs))
    let nextState = advanceWorld(currentState, segmentMs)

    for (const record of nextState.bookstoreSalesCadence.records) {
      if (record.remainingUntilOpportunityMs !== segmentMs) {
        nextState = replaceCadenceRecord(nextState, { ...record, remainingUntilOpportunityMs: record.remainingUntilOpportunityMs - segmentMs })
        continue
      }
      // Consumed whether this attempt sells or refuses — the next interval is freshly sampled either way.
      const attempted = executeBookstoreSale(nextState, record.branchId)
      nextState = replaceCadenceRecord(attempted.state, scheduleNextBookstoreOpportunity(attempted.state, record.branchId, record, bookstoreDemandRandom))
    }

    currentState = nextState
    remainingElapsedMs -= segmentMs
  }

  return currentState
}
