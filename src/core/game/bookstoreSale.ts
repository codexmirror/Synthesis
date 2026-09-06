import { appendCompletedBookstoreSale, findBookstoreCommerceRecord, isValidBookstoreSaleValueMix, selectBookstoreSaleValueBand } from './bookstoreCommerce'
import { resolveBookstoreBackendForBranch } from './bookstoreBackend'
import { decrementBookstoreInventory, resolveBookstoreOperationsForBranch } from './bookstoreOperations'
import { executeCivicDollarMovement } from './dollarFinance'
import type { BookstoreSaleValueBand, GameState } from './types'

/** The neutral aggregate Civic Dollar payment source for retail customers who are not individually simulated. An ordinary Account: no Credential, Session, Device, or represented Customer identity, and never magically replenished. */
export const RETAIL_CLEARING_ACCOUNT_ID = 'dollar-account-retail-clearing-v0'

/** The fixed, deterministic V1 statement-context purpose label for every canonical Bookstore sale. Never randomized or generated. */
export const BOOKSTORE_SALE_STATEMENT_PURPOSE = 'Retail sale'

export type ExecuteBookstoreSaleResult =
  | { readonly status: 'sold'; readonly state: GameState; readonly saleId: string; readonly transactionId: string; readonly saleValueBand: BookstoreSaleValueBand }
  | {
      readonly status:
        | 'branch_not_found'
        | 'operations_not_found'
        | 'closed'
        | 'out_of_stock'
        | 'no_checkout_capacity'
        | 'commerce_not_found'
        | 'invalid_sale_value_mix'
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
 * inventory, checkout capacity, OPEN/CLOSED, current `saleValueMix`,
 * settlement Account, backend availability, and the Retail Clearing source —
 * resolves from current canonical state; none of it is a parameter, so no
 * caller can choose a value, an Account, or a backend.
 *
 * Every value-independent prerequisite (Branch existence, Operations,
 * Commerce, sale-value-mix configuration validity, settlement Account
 * resolution, backend availability, Retail Clearing resolution) is
 * conclusively checked first and can refuse the attempt without ever
 * touching `bookstoreSaleValueRandom`. Only once every one of those resolves
 * does this draw exactly one sample from `bookstoreSaleValueRandom` and
 * select exactly one LOW/STANDARD/HIGH band (`selectBookstoreSaleValueBand`)
 * for this attempt. That selected band's exact integer-cent amount is then
 * used for every remaining amount-dependent check (sufficient Retail
 * Clearing funds, representable resulting balances) — a refusal at this
 * stage never re-draws, never falls back to a cheaper band, and never
 * compensates a later draw; a selected HIGH attempt may refuse where a LOW
 * attempt would have been fundable, and that refusal is exactly as atomic as
 * every other refusal here.
 *
 * One sale means exactly one inventory unit, exactly one Civic Dollar
 * Transaction moving exactly the selected band's amount from Retail
 * Clearing to the current settlement Account, and exactly one appended
 * CompletedSale retaining that band and referencing the Transaction by
 * stable ID. That Transaction is created with a historical
 * statement-context snapshot of the Branch's current `displayName`/`location`
 * plus the fixed `Retail sale` purpose — captured once, at this exact
 * moment, never re-read afterwards. Every legitimate refusal is preflighted
 * before anything is committed, so a failed attempt always returns the
 * original pre-attempt `GameState` unchanged: there is no partially applied
 * sale, and no failure path can produce an inventory decrement without its
 * Transaction, a Transaction without a CompletedSale, or a CompletedSale
 * without inventory decrement.
 *
 * This is one explicit domain transition, not a cadence: nothing here
 * decides *when* a sale is attempted, and calling this twice is two
 * independent explicit attempts, each drawing its own independent sale-value
 * sample.
 */
export function executeBookstoreSale(state: GameState, branchId: string, bookstoreSaleValueRandom: () => number = Math.random): ExecuteBookstoreSaleResult {
  const branch = state.business.branches.find((candidate) => candidate.id === branchId)
  if (!branch) return { status: 'branch_not_found', state }

  const operations = resolveBookstoreOperationsForBranch(state, branchId)
  if (!operations) return { status: 'operations_not_found', state }
  if (!operations.open) return { status: 'closed', state }
  if (operations.currentInventory <= 0) return { status: 'out_of_stock', state }
  if (operations.checkoutCapacity <= 0) return { status: 'no_checkout_capacity', state }

  const commerce = findBookstoreCommerceRecord(state, branchId)
  if (!commerce) return { status: 'commerce_not_found', state }
  if (!isValidBookstoreSaleValueMix(commerce.saleValueMix)) return { status: 'invalid_sale_value_mix', state }

  const settlementAccount = state.dollarFinance.accounts.find(({ id }) => id === commerce.settlementAccountId)
  if (!settlementAccount) return { status: 'settlement_unavailable', state }

  const backend = resolveBookstoreBackendForBranch(state, branchId)
  if (!backend || !backend.available) return { status: 'backend_unavailable', state }

  const retailClearingAccount = state.dollarFinance.accounts.find(({ id }) => id === RETAIL_CLEARING_ACCOUNT_ID)
  if (!retailClearingAccount) return { status: 'retail_clearing_unavailable', state }
  // Retail Clearing settled into itself is not a legitimate settlement configuration for this sale.
  if (retailClearingAccount.id === settlementAccount.id) return { status: 'settlement_unavailable', state }

  // Every value-independent condition above is conclusively resolved; exactly one sale-value sample is
  // drawn here, never earlier and never again for this attempt, regardless of what happens next.
  const saleValueBand = selectBookstoreSaleValueBand(commerce.saleValueMix, bookstoreSaleValueRandom())
  const amountCents = commerce.saleValueMix[saleValueBand].amountCents

  if (retailClearingAccount.balanceCents < amountCents) return { status: 'insufficient_funds', state }
  // Both resulting balances the canonical Civic Dollar movement will commit are preflighted here,
  // exactly mirroring executeCivicDollarMovement's own symmetric source/destination representability guarantee —
  // so that call is already proven safe and cannot itself refuse.
  if (!Number.isSafeInteger(retailClearingAccount.balanceCents - amountCents)) return { status: 'balance_not_representable', state }
  if (!Number.isSafeInteger(settlementAccount.balanceCents + amountCents)) return { status: 'balance_not_representable', state }

  // Snapshot the Branch's current represented identity/location at the moment of the sale — historical statement
  // context, never a live reference: a later Branch rename or relocation must never rewrite this Transaction.
  const movement = executeCivicDollarMovement(state, retailClearingAccount.id, settlementAccount.id, amountCents, {
    description: branch.displayName,
    purpose: BOOKSTORE_SALE_STATEMENT_PURPOSE,
    ...(branch.location ? { location: branch.location } : {}),
  })
  if (movement.status !== 'moved') {
    // Every refusable condition was already preflighted above; an unexpected refusal here is defensive only,
    // and still preserves atomicity by returning the original pre-attempt state.
    return { status: 'insufficient_funds', state }
  }

  const inventoryDecremented = decrementBookstoreInventory(movement.state, branchId)
  const { state: finalState, saleId } = appendCompletedBookstoreSale(inventoryDecremented, branchId, movement.transaction.id, saleValueBand)

  return { status: 'sold', state: finalState, saleId, transactionId: movement.transaction.id, saleValueBand }
}
