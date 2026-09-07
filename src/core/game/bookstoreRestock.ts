import { ATLAS_DISTRIBUTION_COMPANY_ID } from './business'
import { BOOKSTORE_INITIAL_ASSORTMENT, findBookstoreCommerceRecord } from './bookstoreCommerce'
import { deriveBookstoreTotalStock, incrementBookstoreStock, resolveBookstoreOperationsForBranch } from './bookstoreOperations'
import { settleValidatedCompanyPurchase } from './businessPurchaseSettlement'
import type { BookstoreRestockOrder, BookstoreRestockState, BookstoreSupplyOffer, GameState } from './types'

export const BOOKSTORE_COMPACT_REFILL_OFFER_ID = 'bookstore-supply-offer-atlas-compact-v0'
export const BOOKSTORE_STANDARD_REFILL_OFFER_ID = 'bookstore-supply-offer-atlas-standard-v0'

function authoredOffer(id: string, displayName: string, quantity: number, totalPriceCents: number, deliveryDurationMs: number): BookstoreSupplyOffer {
  return { id, displayName, sellerCompanyId: ATLAS_DISTRIBUTION_COMPANY_ID, lines: BOOKSTORE_INITIAL_ASSORTMENT.map((merchandiseId) => ({ merchandiseId, quantity })), totalPriceCents, deliveryDurationMs }
}

export function createInitialBookstoreRestockState(): BookstoreRestockState {
  return {
    nextOrderId: 1,
    offers: [
      authoredOffer(BOOKSTORE_COMPACT_REFILL_OFFER_ID, 'Compact Shelf Refill', 2, 14_000, 1_800_000),
      authoredOffer(BOOKSTORE_STANDARD_REFILL_OFFER_ID, 'Standard Shelf Refill', 5, 34_000, 3_600_000),
    ],
    orders: [],
  }
}

export type PlaceBookstoreRestockOrderResult =
  | { readonly status: 'ordered'; readonly state: GameState; readonly orderId: string; readonly transactionId: string }
  | { readonly status: 'branch_unavailable' | 'commerce_unavailable' | 'operations_unavailable' | 'offer_unavailable' | 'seller_unavailable' | 'invalid_offer' | 'capacity_exceeded' | 'payment_refused'; readonly state: GameState }

function validOfferForBranch(state: GameState, branchId: string, offer: BookstoreSupplyOffer): boolean {
  const commerce = findBookstoreCommerceRecord(state, branchId)
  const operations = resolveBookstoreOperationsForBranch(state, branchId)
  if (!commerce || !operations || !Number.isSafeInteger(offer.totalPriceCents) || offer.totalPriceCents <= 0 || !Number.isFinite(offer.deliveryDurationMs) || offer.deliveryDurationMs <= 0 || offer.lines.length === 0) return false
  const ids = offer.lines.map(({ merchandiseId }) => merchandiseId)
  if (new Set(ids).size !== ids.length) return false
  return offer.lines.every((line) => Number.isSafeInteger(line.quantity) && line.quantity > 0
    && state.bookstoreCommerce.bookCatalog.some(({ id }) => id === line.merchandiseId))
}

export function deriveBookstoreIncomingStock(state: GameState, branchId: string): number {
  return state.bookstoreRestock.orders
    .filter((order) => order.buyerBranchId === branchId && order.status === 'IN_TRANSIT')
    .flatMap((order) => order.lines)
    .reduce((sum, line) => sum + line.quantity, 0)
}

/** Bookstore-owned commercial validation and order capture; payment occurs only after all non-financial preflight succeeds. */
export function placeBookstoreRestockOrder(state: GameState, branchId: string, offerId: string): PlaceBookstoreRestockOrderResult {
  const branch = state.business.branches.find(({ id }) => id === branchId)
  if (!branch || !state.business.companies.some(({ id }) => id === branch.companyId)) return { status: 'branch_unavailable', state }
  const commerce = findBookstoreCommerceRecord(state, branchId)
  if (!commerce) return { status: 'commerce_unavailable', state }
  const operations = resolveBookstoreOperationsForBranch(state, branchId)
  if (!operations) return { status: 'operations_unavailable', state }
  const offers = state.bookstoreRestock.offers.filter(({ id }) => id === offerId)
  if (offers.length !== 1) return { status: 'offer_unavailable', state }
  const offer = offers[0]
  const sellers = state.business.companies.filter(({ id }) => id === offer.sellerCompanyId)
  if (sellers.length !== 1) return { status: 'seller_unavailable', state }
  if (!validOfferForBranch(state, branchId, offer)) return { status: 'invalid_offer', state }
  const proposedUnits = offer.lines.reduce((sum, line) => sum + line.quantity, 0)
  if (deriveBookstoreTotalStock(operations) + deriveBookstoreIncomingStock(state, branchId) + proposedUnits > operations.shelfCapacity) return { status: 'capacity_exceeded', state }

  const settlement = settleValidatedCompanyPurchase(state, branch.companyId, offer.sellerCompanyId, offer.totalPriceCents, { description: offer.displayName, purpose: 'Bookstore restock', location: branch.location })
  if (settlement.status !== 'settled') return { status: 'payment_refused', state }
  const orderId = `bookstore-restock-order-${String(state.bookstoreRestock.nextOrderId).padStart(4, '0')}`
  const lines = offer.lines.map((line) => ({
    merchandiseId: line.merchandiseId,
    capturedMerchandiseDisplayName: state.bookstoreCommerce.bookCatalog.find(({ id }) => id === line.merchandiseId)!.name,
    quantity: line.quantity,
  }))
  const order: BookstoreRestockOrder = {
    id: orderId, buyerBranchId: branchId, sellerCompanyId: offer.sellerCompanyId,
    capturedSellerDisplayName: sellers[0].displayName, offerId: offer.id,
    capturedOfferDisplayName: offer.displayName, lines,
    dollarTransactionId: settlement.transactionId,
    capturedDeliveryDurationMs: offer.deliveryDurationMs,
    remainingDeliveryMs: offer.deliveryDurationMs, status: 'IN_TRANSIT',
  }
  return {
    status: 'ordered', orderId, transactionId: settlement.transactionId,
    state: { ...settlement.state, bookstoreRestock: { ...settlement.state.bookstoreRestock, nextOrderId: state.bookstoreRestock.nextOrderId + 1, orders: [...state.bookstoreRestock.orders, order] } },
  }
}

/** Canonical elapsed-time delivery. Each order's captured stock consequence is applied only on its single IN_TRANSIT -> DELIVERED transition. */
export function advanceBookstoreRestockDeliveries(state: GameState, elapsedMs: number): GameState {
  if (elapsedMs <= 0 || !state.bookstoreRestock.orders.some(({ status }) => status === 'IN_TRANSIT')) return state
  let next = state
  for (const stale of state.bookstoreRestock.orders) {
    if (stale.status !== 'IN_TRANSIT') continue
    const remaining = stale.remainingDeliveryMs - elapsedMs
    if (remaining > 0) {
      next = { ...next, bookstoreRestock: { ...next.bookstoreRestock, orders: next.bookstoreRestock.orders.map((order) => order.id === stale.id ? { ...order, remainingDeliveryMs: remaining } : order) } }
      continue
    }
    next = incrementBookstoreStock(next, stale.buyerBranchId, stale.lines)
    next = { ...next, bookstoreCommerce: { ...next.bookstoreCommerce, records: next.bookstoreCommerce.records.map((record) => record.branchId === stale.buyerBranchId
      ? { ...record, assortment: [...record.assortment, ...stale.lines.map((line) => line.merchandiseId).filter((id) => !record.assortment.includes(id))] }
      : record) } }
    next = { ...next, bookstoreRestock: { ...next.bookstoreRestock, orders: next.bookstoreRestock.orders.map((order) => order.id === stale.id ? { ...order, remainingDeliveryMs: 0, status: 'DELIVERED' as const } : order) } }
  }
  return next
}
