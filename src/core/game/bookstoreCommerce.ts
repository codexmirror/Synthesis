import { BOOKSTORE_BRANCH_ID } from './business'
import type { BookstoreBranchCommerceRecord, BookstoreCommerceState, BookstoreSaleValueBand, BookstoreSaleValueMix, DollarFinancialAccount, DollarTransaction, GameState } from './types'

export const BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const BOOKSTORE_SALE_ID = 'bookstore-sale-0001'
export const BOOKSTORE_SALE_TRANSACTION_ID = 'dollar-transaction-0001'

/** The stable band order every cumulative-weight derivation walks, LOW to HIGH. Never reordered — it defines which boundary each band owns. */
const BOOKSTORE_SALE_VALUE_BANDS: readonly BookstoreSaleValueBand[] = ['LOW', 'STANDARD', 'HIGH']

/**
 * Current represented Bookstore aggregate sale-value distribution. V1 has no
 * product catalogue, SKU, category, basket size, discount, tax, fee, or
 * per-item pricing — this is the one distribution a Bookstore Branch sale
 * draws its attempted value from. LOW/STANDARD/HIGH are aggregate economic
 * outcome bands, not Product, merchandise-quality, or customer tiers: a LOW
 * sale does not represent a cheap book, and a HIGH sale does not represent a
 * premium product.
 *
 * The configured weights (30/50/20) give this distribution's expected
 * attempted value as exactly $20.00:
 *
 *   0.30 × $12.00 + 0.50 × $20.00 + 0.20 × $32.00 = $20.00
 *
 * That expected-value statement describes only the configured attempted-sale
 * distribution, before any downstream value-dependent refusal. It does not
 * mean realized completed-sale revenue must itself average $20.00 — a
 * selected HIGH attempt that Retail Clearing cannot fund simply refuses
 * (never re-drawn, never downgraded to LOW/STANDARD), so realized revenue can
 * legitimately diverge from this configured mean.
 */
export const BOOKSTORE_BRANCH_SALE_VALUE_MIX: BookstoreSaleValueMix = {
  LOW: { amountCents: 1_200, weight: 30 },
  STANDARD: { amountCents: 2_000, weight: 50 },
  HIGH: { amountCents: 3_200, weight: 20 },
}

function sumBookstoreSaleValueMixWeight(mix: BookstoreSaleValueMix): number {
  return BOOKSTORE_SALE_VALUE_BANDS.reduce((total, band) => total + mix[band].weight, 0)
}

/**
 * True only when every band's amount is a positive safe integer and every
 * band's weight is a positive finite number whose total is itself a positive
 * finite number — the minimum a well-defined weighted selection needs. An
 * impossible configuration (a non-finite or non-positive weight, a
 * non-integer or non-positive amount, or a total weight that overflows or
 * collapses to zero) is never silently normalized, clamped, or reinterpreted
 * into something selectable; sale execution refuses outright instead.
 */
export function isValidBookstoreSaleValueMix(mix: BookstoreSaleValueMix): boolean {
  const totalWeight = sumBookstoreSaleValueMixWeight(mix)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return false
  return BOOKSTORE_SALE_VALUE_BANDS.every((band) => {
    const config = mix[band]
    return Number.isSafeInteger(config.amountCents) && config.amountCents > 0 && Number.isFinite(config.weight) && config.weight > 0
  })
}

/**
 * Select exactly one represented Bookstore sale-value band for one
 * normalized uniform value `u` in `[0, 1)`. Cumulative weight boundaries are
 * derived fresh from the given mix's own weights, walked in fixed LOW ->
 * STANDARD -> HIGH order, rather than hardcoded to the seeded 30/50/20 — a
 * different, still-valid mix selects correctly through the same boundaries.
 * For the seeded configuration this resolves exactly:
 *
 *   u ∈ [0.00, 0.30) -> LOW
 *   u ∈ [0.30, 0.80) -> STANDARD
 *   u ∈ [0.80, 1.00) -> HIGH
 *
 * The caller is responsible for having already validated `mix` with
 * `isValidBookstoreSaleValueMix`; an invalid mix has no well-defined
 * boundaries to select against. A degenerate `u` from a broken random source
 * (NaN, or at/past the `[0, 1)` contract) still resolves to the last band
 * (`HIGH`) rather than throwing, exactly mirroring how the existing Bookstore
 * demand sampler tolerates a broken `Math.random`-style source — this is a
 * defense against bad randomness, never a fallback for bad configuration.
 */
export function selectBookstoreSaleValueBand(mix: BookstoreSaleValueMix, u: number): BookstoreSaleValueBand {
  const totalWeight = sumBookstoreSaleValueMixWeight(mix)
  let cumulativeWeight = 0
  for (const band of BOOKSTORE_SALE_VALUE_BANDS) {
    cumulativeWeight += mix[band].weight
    if (u < cumulativeWeight / totalWeight) return band
  }
  return 'HIGH'
}

export function createInitialBookstoreCommerceState(): BookstoreCommerceState {
  return {
    nextSaleId: 2,
    records: [{
      branchId: BOOKSTORE_BRANCH_ID,
      settlementAccountId: BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID,
      saleValueMix: BOOKSTORE_BRANCH_SALE_VALUE_MIX,
      completedSales: [{ id: BOOKSTORE_SALE_ID, kind: 'book_sale', saleValueBand: 'STANDARD', dollarTransactionId: BOOKSTORE_SALE_TRANSACTION_ID }],
    }],
  }
}

/** Raw branch-linked commerce record lookup, independent of any Civic Dollar join — the smallest lookup sale execution needs to tell "no commerce record represented" apart from "settlement Account does not resolve." */
export function findBookstoreCommerceRecord(state: GameState, branchId: string): BookstoreBranchCommerceRecord | undefined {
  return state.bookstoreCommerce.records.find((candidate) => candidate.branchId === branchId)
}

/**
 * Append exactly one new `book_sale` CompletedSale to one Branch's commerce
 * record, referencing the given Provider-owned Transaction by stable ID
 * only — never duplicating its amount or any other money truth — and
 * retaining exactly which sale-value band this completed sale represented.
 * Allocates the new CompletedSale's stable ID from the state-level monotonic
 * `nextSaleId` allocator, following the existing Transaction/Session
 * allocation pattern; it is never derived from array length, time, or
 * randomness. The caller is responsible for having already established that
 * `branchId` names an existing commerce record — this assumes it.
 */
export function appendCompletedBookstoreSale(state: GameState, branchId: string, dollarTransactionId: string, saleValueBand: BookstoreSaleValueBand): { readonly state: GameState; readonly saleId: string } {
  const saleId = `bookstore-sale-${String(state.bookstoreCommerce.nextSaleId).padStart(4, '0')}`
  const records = state.bookstoreCommerce.records.map((record) => record.branchId === branchId
    ? { ...record, completedSales: [...record.completedSales, { id: saleId, kind: 'book_sale' as const, saleValueBand, dollarTransactionId }] }
    : record)
  return {
    saleId,
    state: { ...state, bookstoreCommerce: { nextSaleId: state.bookstoreCommerce.nextSaleId + 1, records } },
  }
}

/** Concrete bookstore commerce resolved for one Branch: current settlement Account and completed sale history, joined against Civic-Dollar-owned Accounts and Transactions. Civic Dollar remains the sole owner of Accounts, balances, Credentials, Financial Sessions, and Transactions; this only projects the stable references the branch-linked record already holds. */
export interface ResolvedBookstoreCommerce {
  readonly settlementAccount: DollarFinancialAccount
  /** Current configured sale-value distribution, projected verbatim from the branch-linked record — needs no Civic Dollar join. Compact operator-facing presentation of this belongs to RACK-OS BUSINESS, never a player-facing probability dashboard. */
  readonly saleValueMix: BookstoreSaleValueMix
  readonly sales: readonly { readonly id: string; readonly kind: 'book_sale'; readonly saleValueBand: BookstoreSaleValueBand; readonly transaction: DollarTransaction }[]
}

/**
 * Resolve the current bookstore commerce record for one Business Branch by
 * stable Branch ID, or `undefined` where this Branch has no such concrete
 * commerce subsystem represented at all — a legitimate structural state, not
 * a defect. This is a separate, optional join on top of generic Business
 * Branch structural identity (`resolveBusinessOperatingContext` in
 * `business.ts`), never a condition that resolver itself depends on.
 */
export function resolveBookstoreCommerceForBranch(state: GameState, branchId: string): ResolvedBookstoreCommerce | undefined {
  const record = state.bookstoreCommerce.records.find((candidate) => candidate.branchId === branchId)
  if (!record) return undefined
  const settlementAccount = state.dollarFinance.accounts.find(({ id }) => id === record.settlementAccountId)
  if (!settlementAccount) return undefined
  const sales = record.completedSales.flatMap((sale) => {
    const transaction = state.dollarFinance.transactions.records.find(({ id }) => id === sale.dollarTransactionId)
    return transaction ? [{ id: sale.id, kind: sale.kind, saleValueBand: sale.saleValueBand, transaction }] : []
  })
  return { settlementAccount, saleValueMix: record.saleValueMix, sales }
}

/** A compact operator-facing percentage for one band of a given mix, e.g. `30` for a 30-weight band out of a 100 total. Presentation-only derivation, never stored. */
export function formatBookstoreSaleValueBandPercentage(mix: BookstoreSaleValueMix, band: BookstoreSaleValueBand): string {
  const totalWeight = sumBookstoreSaleValueMixWeight(mix)
  return String(Number(((mix[band].weight / totalWeight) * 100).toFixed(2)))
}
