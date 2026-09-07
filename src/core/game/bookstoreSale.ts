import { appendCompletedBookstoreSale, findBookstoreCommerceRecord, isBookstoreMerchandiseCatalogSufficient } from './bookstoreCommerce'
import { resolveBookstoreBackendForBranch } from './bookstoreBackend'
import { decrementBookstoreStock, resolveBookstoreOperationsForBranch } from './bookstoreOperations'
import { executeCivicDollarMovement } from './dollarFinance'
import type { BookstoreMerchandiseRecord, BusinessBranchSaleLine, GameState } from './types'

/** The neutral aggregate Civic Dollar payment source for retail customers who are not individually simulated. An ordinary Account: no Credential, Session, Device, or represented Customer identity, and never magically replenished. */
export const RETAIL_CLEARING_ACCOUNT_ID = 'dollar-account-retail-clearing-v0'

/** The fixed, deterministic V1 statement-context purpose label for every canonical Bookstore sale. Never randomized or generated. */
export const BOOKSTORE_SALE_STATEMENT_PURPOSE = 'Retail sale'

/**
 * V1's authored Bookstore-local basket-size mix: how many represented units a
 * provisional purchase composition contains, before stock feasibility is
 * applied. This is a concrete approximation of currently unsimulated
 * Bookstore purchasing behavior — not a generic Customer rule, universal
 * commerce rule, Customer class, or represented preference model — and it is
 * never generalized beyond this one Bookstore mechanic.
 */
export const BOOKSTORE_PURCHASE_BASKET_SIZE_WEIGHTS: readonly { readonly size: number; readonly weight: number }[] = [
  { size: 1, weight: 70 },
  { size: 2, weight: 25 },
  { size: 3, weight: 5 },
]

/** One line of a provisional purchase composition: current represented merchandise identity/name/price at the moment of composition, and the quantity selected into this basket. */
export interface ComposedBookstorePurchaseLine {
  readonly merchandiseId: string
  readonly name: string
  readonly unitPriceCents: number
  readonly quantity: number
}

/** Clamp a random source's raw sample into the half-open `[0, 1)` interval this module's selection functions require, defending against a degenerate or out-of-range value from a broken source by falling back to `0` — the same conservative-fallback convention `bookstoreSalesCadence.ts` uses for its own sampler. */
function uniformSample(random: () => number): number {
  const raw = random()
  return Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : 0
}

/**
 * Select one provisional basket item-count from the configured 70/25/5 mix,
 * restricted to sizes that are actually feasible given `totalAvailableStock`
 * (a basket can never be sized larger than the represented stock actually on
 * hand). Exactly one `random` sample is drawn for this step itself, whether
 * one, two, or three sizes are currently feasible; a composed N-item basket
 * then draws exactly one further sample per selected unit
 * (`selectBookstoreMerchandiseId`), so a full basket consumes exactly
 * `1 + N` purchase samples overall. `totalAvailableStock` can therefore
 * legitimately change which sizes are feasible — and so which `N` gets
 * selected — as stock changes; large-step and partitioned advancement stay
 * equivalent not because total draw count is independent of stock, but
 * because both observe the same chronological stock/catalog state at each
 * opportunity and consume the same semantic purchase-random sequence in the
 * same causal order.
 *
 * `totalAvailableStock` must be > 0; callers only reach this after preflight
 * has already established at least one currently sellable unit of stock
 * exists (the intersection of current Commerce merchandise and positive
 * Operations stock — see `deriveSellableBookstoreTotalStock`).
 */
export function selectBookstoreBasketSize(totalAvailableStock: number, random: () => number): number {
  const feasible = BOOKSTORE_PURCHASE_BASKET_SIZE_WEIGHTS.filter((entry) => entry.size <= totalAvailableStock)
  const totalWeight = feasible.reduce((sum, entry) => sum + entry.weight, 0)
  const uniform = uniformSample(random)
  let cumulative = 0
  for (const entry of feasible) {
    cumulative += entry.weight
    if (uniform < cumulative / totalWeight) return entry.size
  }
  // Defensive fallback for floating-point edge cases at the top of the range; the loop above always returns for any uniform value strictly less than 1.
  return feasible[feasible.length - 1].size
}

/**
 * Select one merchandise identity uniformly at random from the currently
 * available (positive remaining provisional stock) candidates. A simple
 * neutral Bookstore-local selection — never a Customer preference,
 * bestseller weight, popularity score, or marketing affinity.
 */
export function selectBookstoreMerchandiseId(availableIds: readonly string[], random: () => number): string {
  const uniform = uniformSample(random)
  const index = Math.min(availableIds.length - 1, Math.floor(uniform * availableIds.length))
  return availableIds[index]
}

/**
 * The current stock actually purchasable through one Branch's *current*
 * represented merchandise catalog, by merchandise ID: the intersection of
 * catalog identity and positive physical Operations stock. Physical stock
 * for a merchandise identity no longer listed in the current catalog
 * ("orphan" stock — Commerce and Operations are separate owners, and
 * removing a catalog entry never deletes or rewrites its physical stock) is
 * deliberately excluded here, so it can never inflate purchase feasibility
 * or be selected into a basket. This is distinct from
 * `deriveBookstoreTotalStock` (`bookstoreOperations.ts`), which remains the
 * *physical* total used for shelf-capacity accounting and RACK-OS's total
 * STOCK presentation — that derivation is intentionally unaware of the
 * current catalog.
 */
export function deriveSellableBookstoreStockByMerchandise(
  merchandise: readonly BookstoreMerchandiseRecord[],
  stock: readonly { readonly merchandiseId: string; readonly quantity: number }[],
): ReadonlyMap<string, number> {
  return new Map(merchandise.map((item) => [item.id, stock.find((entry) => entry.merchandiseId === item.id)?.quantity ?? 0]))
}

/** The total current stock actually purchasable through one Branch's current represented merchandise catalog — see `deriveSellableBookstoreStockByMerchandise`. */
export function deriveSellableBookstoreTotalStock(
  merchandise: readonly BookstoreMerchandiseRecord[],
  stock: readonly { readonly merchandiseId: string; readonly quantity: number }[],
): number {
  return [...deriveSellableBookstoreStockByMerchandise(merchandise, stock).values()].reduce((sum, quantity) => sum + quantity, 0)
}

/**
 * Compose one provisional Bookstore purchase: a basket item-count drawn from
 * the configured 70/25/5 mix (restricted to currently feasible sizes, using
 * currently *sellable* stock — above — never raw physical stock), then that
 * many individual unit selections, each drawn uniformly from whichever
 * currently sellable merchandise identities still have positive
 * *provisional* remaining stock at that point in the basket's own
 * construction — so a single basket can never provisionally select more
 * units of one merchandise than currently exist, and orphan stock for
 * merchandise the current catalog no longer lists is never selectable at
 * all. Repeated selections of the same merchandise are aggregated into one
 * resulting line with `quantity > 1`.
 *
 * This is the one point in Bookstore sale execution that consumes purchase
 * randomness, and it never chooses an amount in cents, a LOW/STANDARD/HIGH
 * band, or any other monetary outcome directly — only which currently
 * available represented merchandise, and how many units of it, ends up in the
 * basket. The caller derives the actual monetary total deterministically from
 * the returned lines.
 *
 * Callers are responsible for having already established that `merchandise`
 * is a structurally sufficient catalog and that currently sellable stock
 * (`deriveSellableBookstoreTotalStock`) is positive; this assumes both, and
 * never reaches an empty candidate set on a structurally valid call.
 */
export function composeBookstorePurchase(
  merchandise: readonly BookstoreMerchandiseRecord[],
  stock: readonly { readonly merchandiseId: string; readonly quantity: number }[],
  random: () => number,
): readonly ComposedBookstorePurchaseLine[] {
  const remaining = new Map(deriveSellableBookstoreStockByMerchandise(merchandise, stock))
  const totalAvailableStock = [...remaining.values()].reduce((sum, quantity) => sum + quantity, 0)
  const basketSize = selectBookstoreBasketSize(totalAvailableStock, random)

  const quantitiesById = new Map<string, number>()
  for (let unit = 0; unit < basketSize; unit += 1) {
    const availableIds = merchandise.filter((item) => (remaining.get(item.id) ?? 0) > 0).map((item) => item.id)
    const selectedId = selectBookstoreMerchandiseId(availableIds, random)
    remaining.set(selectedId, remaining.get(selectedId)! - 1)
    quantitiesById.set(selectedId, (quantitiesById.get(selectedId) ?? 0) + 1)
  }

  return merchandise
    .filter((item) => quantitiesById.has(item.id))
    .map((item) => ({ merchandiseId: item.id, name: item.name, unitPriceCents: item.unitPriceCents, quantity: quantitiesById.get(item.id)! }))
}

/** The deterministic basket total, in integer cents: `Σ(quantity × unitPriceCents)` — exact safe-integer arithmetic, never a randomized or separately configured amount. */
export function deriveBookstoreBasketTotalCents(lines: readonly ComposedBookstorePurchaseLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0)
}

export type ExecuteBookstoreSaleResult =
  | { readonly status: 'sold'; readonly state: GameState; readonly saleId: string; readonly transactionId: string }
  | {
      readonly status:
        | 'branch_not_found'
        | 'operations_not_found'
        | 'closed'
        | 'out_of_stock'
        | 'no_checkout_capacity'
        | 'commerce_not_found'
        | 'invalid_price'
        | 'settlement_unavailable'
        | 'backend_unavailable'
        | 'retail_clearing_unavailable'
        | 'insufficient_funds'
        | 'balance_not_representable'
      readonly state: GameState
    }

/**
 * Execute one canonical Bookstore sale for one Business Branch, identified
 * only by stable Branch ID. Every other fact a sale needs — current
 * per-merchandise stock, checkout capacity, OPEN/CLOSED, the current
 * represented merchandise catalog, settlement Account, backend availability,
 * and the Retail Clearing source — resolves from current canonical state;
 * none of it is a parameter, so no caller can choose a price, a basket, an
 * Account, or a backend.
 *
 * Every prerequisite that makes a sale impossible independently of what gets
 * purchased is preflighted first, so that a conclusively refused attempt
 * never consumes `bookstorePurchaseRandom` at all: Branch existence,
 * Operations existence/OPEN, a structurally sufficient current merchandise
 * catalog (Commerce), at least one currently *sellable* unit of stock — the
 * intersection of that catalog and physical Operations stock
 * (`deriveSellableBookstoreTotalStock`), never raw physical stock alone, so
 * stock orphaned by a since-removed catalog entry can neither inflate
 * feasibility nor be selected — checkout capacity, settlement structure,
 * Backend availability, and Retail Clearing existence/distinctness. Only
 * once every one of those resolves does this compose exactly one
 * provisional purchase (`composeBookstorePurchase`) — the one point
 * purchase randomness is consumed. That basket's deterministic total
 * (`deriveBookstoreBasketTotalCents`) is then the *only* further reason a
 * sale might still refuse (insufficient funds or unrepresentable balances);
 * such a refusal never re-rolls a cheaper or different basket; the originally
 * composed basket is simply not committed.
 *
 * A successful sale is one atomic represented purchase: exact stock
 * decrements for every purchased merchandise line, exactly one Civic Dollar
 * Transaction moving exactly the basket's deterministic total from Retail
 * Clearing to the current settlement Account, and exactly one appended
 * CompletedSale — carrying its own immutable captured purchase lines —
 * referencing that Transaction by stable ID. That Transaction is created with
 * a historical statement-context snapshot of the Branch's current
 * `displayName`/`location` plus the fixed `Retail sale` purpose — captured
 * once, at this exact moment, never re-read afterwards. Every legitimate
 * refusal is preflighted or provisional before anything is committed, so a
 * failed attempt always returns the original pre-attempt `GameState`
 * unchanged: there is no partially applied sale, no persisted provisional
 * basket, and no failure path can produce a stock decrement without its
 * Transaction, a Transaction without a CompletedSale, or a CompletedSale
 * without its stock decrement.
 *
 * This is one explicit domain transition, not a cadence: nothing here
 * decides *when* a sale is attempted, and calling this twice is two
 * independent explicit attempts.
 */
export function executeBookstoreSale(state: GameState, branchId: string, bookstorePurchaseRandom: () => number = Math.random): ExecuteBookstoreSaleResult {
  const branch = state.business.branches.find((candidate) => candidate.id === branchId)
  if (!branch) return { status: 'branch_not_found', state }

  const operations = resolveBookstoreOperationsForBranch(state, branchId)
  if (!operations) return { status: 'operations_not_found', state }
  if (!operations.open) return { status: 'closed', state }

  const commerce = findBookstoreCommerceRecord(state, branchId)
  if (!commerce) return { status: 'commerce_not_found', state }
  if (!isBookstoreMerchandiseCatalogSufficient(commerce.merchandise)) return { status: 'invalid_price', state }

  // Sellable stock — the intersection of the current catalog and physical Operations stock — is what
  // purchase feasibility must be measured against, never physical stock alone: stock for a merchandise
  // identity the current catalog no longer lists ("orphan" stock) must never inflate feasibility or be
  // reachable by composition. `deriveBookstoreTotalStock(operations)` remains the separate physical total
  // used for shelf-capacity accounting and RACK-OS's STOCK presentation; it is deliberately not read here.
  const sellableTotalStock = deriveSellableBookstoreTotalStock(commerce.merchandise, operations.stock)
  if (sellableTotalStock <= 0) return { status: 'out_of_stock', state }
  if (operations.checkoutCapacity <= 0) return { status: 'no_checkout_capacity', state }

  const settlementAccount = state.dollarFinance.accounts.find(({ id }) => id === commerce.settlementAccountId)
  if (!settlementAccount) return { status: 'settlement_unavailable', state }

  const backend = resolveBookstoreBackendForBranch(state, branchId)
  if (!backend || !backend.available) return { status: 'backend_unavailable', state }

  const retailClearingAccount = state.dollarFinance.accounts.find(({ id }) => id === RETAIL_CLEARING_ACCOUNT_ID)
  if (!retailClearingAccount) return { status: 'retail_clearing_unavailable', state }
  // Retail Clearing settled into itself is not a legitimate settlement configuration for this sale.
  if (retailClearingAccount.id === settlementAccount.id) return { status: 'settlement_unavailable', state }

  // Every prerequisite independent of what gets purchased has now resolved. This is the one
  // point that consumes bookstorePurchaseRandom — a conclusive refusal above never reaches it.
  const basket = composeBookstorePurchase(commerce.merchandise, operations.stock, bookstorePurchaseRandom)
  const basketTotalCents = deriveBookstoreBasketTotalCents(basket)
  if (!Number.isSafeInteger(basketTotalCents) || basketTotalCents <= 0) return { status: 'invalid_price', state }

  if (retailClearingAccount.balanceCents < basketTotalCents) return { status: 'insufficient_funds', state }
  // Both resulting balances the canonical Civic Dollar movement will commit are preflighted here,
  // exactly mirroring executeCivicDollarMovement's own symmetric source/destination representability guarantee —
  // so that call is already proven safe and cannot itself refuse.
  if (!Number.isSafeInteger(retailClearingAccount.balanceCents - basketTotalCents)) return { status: 'balance_not_representable', state }
  if (!Number.isSafeInteger(settlementAccount.balanceCents + basketTotalCents)) return { status: 'balance_not_representable', state }

  // Snapshot the Branch's current represented identity/location at the moment of the sale — historical statement
  // context, never a live reference: a later Branch rename or relocation must never rewrite this Transaction.
  const movement = executeCivicDollarMovement(state, retailClearingAccount.id, settlementAccount.id, basketTotalCents, {
    description: branch.displayName,
    purpose: BOOKSTORE_SALE_STATEMENT_PURPOSE,
    ...(branch.location ? { location: branch.location } : {}),
  })
  if (movement.status !== 'moved') {
    // Every refusable condition was already preflighted above; an unexpected refusal here is defensive only,
    // and still preserves atomicity by returning the original pre-attempt state. The composed basket is not re-rolled.
    return { status: 'insufficient_funds', state }
  }

  const stockDecremented = decrementBookstoreStock(movement.state, branchId, basket)
  const lines: readonly BusinessBranchSaleLine[] = basket.map((line) => ({
    merchandiseId: line.merchandiseId,
    capturedName: line.name,
    quantity: line.quantity,
    capturedUnitPriceCents: line.unitPriceCents,
  }))
  const { state: finalState, saleId } = appendCompletedBookstoreSale(stockDecremented, branchId, movement.transaction.id, lines)

  return { status: 'sold', state: finalState, saleId, transactionId: movement.transaction.id }
}
