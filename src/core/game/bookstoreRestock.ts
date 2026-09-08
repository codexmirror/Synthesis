import { ATLAS_DISTRIBUTION_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID } from './business'
import { findBookstoreCommerceRecord, isBookstoreMerchandiseCatalogSufficient, resolveBookstoreBookById } from './bookstoreCommerce'
import { deriveBookstoreTotalStock, incrementBookstoreStock, resolveBookstoreOperationsForBranch } from './bookstoreOperations'
import { settleValidatedCompanyPurchase } from './businessPurchaseSettlement'
import type { BookstoreRestockOrder, BookstoreRestockState, BookstoreSupplyOffer, GameState } from './types'

export const BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID = 'bookstore-supply-offer-atlas-mixed-shelf-refill-v0'
export const BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID = 'bookstore-supply-offer-northline-title-case-v0'
export const NORTHLINE_SOURCEABLE_BOOK_IDS = ['bookstore-merch-006', 'bookstore-merch-007', 'bookstore-book-010', 'bookstore-book-012', 'bookstore-book-018', 'bookstore-book-024'] as const

export function createInitialBookstoreRestockState(): BookstoreRestockState {
  return { nextOrderId: 1, offers: [
    { id: BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, displayName: 'Mixed Shelf Refill', sellerCompanyId: ATLAS_DISTRIBUTION_COMPANY_ID, kind: 'MIXED_SHELF_REFILL', caseSize: 16, casePriceCents: 14_000, deliveryDurationMs: 1_800_000, sourceableMerchandiseIds: [] },
    { id: BOOKSTORE_NORTHLINE_TITLE_CASE_OFFER_ID, displayName: 'Title Case', sellerCompanyId: NORTHLINE_BOOK_SUPPLY_COMPANY_ID, kind: 'TITLE_CASE', caseSize: 6, casePriceCents: 6_300, deliveryDurationMs: 2_700_000, sourceableMerchandiseIds: [...NORTHLINE_SOURCEABLE_BOOK_IDS] },
  ], orders: [] }
}

export interface BookstoreOrderDecisions { readonly caseCount: number; readonly selectedMerchandiseId?: string }
export interface BookstoreOrderProposal {
  readonly offerId: string; readonly sellerCompanyId: string; readonly caseCount: number; readonly selectedMerchandiseId?: string
  readonly lines: readonly { readonly merchandiseId: string; readonly capturedMerchandiseDisplayName: string; readonly quantity: number }[]
  readonly totalUnits: number; readonly totalPriceCents: number; readonly deliveryDurationMs: number; readonly maxOrderableCases: number
}
export type ProposeBookstoreOrderResult = { readonly status: 'proposed'; readonly proposal: BookstoreOrderProposal } | { readonly status: 'branch_unavailable' | 'commerce_unavailable' | 'operations_unavailable' | 'offer_unavailable' | 'seller_unavailable' | 'invalid_offer' | 'invalid_decisions' | 'capacity_exceeded' }
export type PlaceBookstoreRestockOrderResult = { readonly status: 'ordered'; readonly state: GameState; readonly orderId: string; readonly transactionId: string } | { readonly status: Exclude<ProposeBookstoreOrderResult['status'], 'proposed'> | 'proposal_changed' | 'payment_refused'; readonly state: GameState }

export function deriveBookstoreIncomingStock(state: GameState, branchId: string): number { return state.bookstoreRestock.orders.filter(o => o.buyerBranchId === branchId && o.status === 'IN_TRANSIT').flatMap(o => o.lines).reduce((n, l) => n + l.quantity, 0) }
export function deriveBookstoreMaxOrderableCases(state: GameState, branchId: string, offer: BookstoreSupplyOffer): number {
  const operations = resolveBookstoreOperationsForBranch(state, branchId)
  if (!operations || !Number.isSafeInteger(offer.caseSize) || offer.caseSize <= 0) return 0
  return Math.max(0, Math.floor((operations.shelfCapacity - deriveBookstoreTotalStock(operations) - deriveBookstoreIncomingStock(state, branchId)) / offer.caseSize))
}

function offerValid(state: GameState, offer: BookstoreSupplyOffer): boolean {
  if (!isBookstoreMerchandiseCatalogSufficient(state.bookstoreCommerce.bookCatalog) || !Number.isSafeInteger(offer.caseSize) || offer.caseSize <= 0 || !Number.isSafeInteger(offer.casePriceCents) || offer.casePriceCents <= 0 || !Number.isFinite(offer.deliveryDurationMs) || offer.deliveryDurationMs <= 0) return false
  if (offer.kind === 'MIXED_SHELF_REFILL') return offer.sourceableMerchandiseIds.length === 0
  if (offer.kind === 'TITLE_CASE') return offer.sourceableMerchandiseIds.length > 0 && new Set(offer.sourceableMerchandiseIds).size === offer.sourceableMerchandiseIds.length && offer.sourceableMerchandiseIds.every(id => resolveBookstoreBookById(state.bookstoreCommerce.bookCatalog, id))
  return false
}

export function proposeBookstoreRestockOrder(state: GameState, branchId: string, offerId: string, decisions: BookstoreOrderDecisions): ProposeBookstoreOrderResult {
  const branch = state.business.branches.find(b => b.id === branchId)
  if (!branch || !state.business.companies.some(c => c.id === branch.companyId)) return { status: 'branch_unavailable' }
  const commerce = findBookstoreCommerceRecord(state, branchId); if (!commerce) return { status: 'commerce_unavailable' }
  const operations = resolveBookstoreOperationsForBranch(state, branchId); if (!operations) return { status: 'operations_unavailable' }
  const matches = state.bookstoreRestock.offers.filter(o => o.id === offerId); if (matches.length !== 1) return { status: 'offer_unavailable' }
  const offer = matches[0]; if (state.business.companies.filter(c => c.id === offer.sellerCompanyId).length !== 1) return { status: 'seller_unavailable' }
  if (!offerValid(state, offer)) return { status: 'invalid_offer' }
  if (!Number.isSafeInteger(decisions.caseCount) || decisions.caseCount <= 0) return { status: 'invalid_decisions' }
  const maxOrderableCases = deriveBookstoreMaxOrderableCases(state, branchId, offer); if (decisions.caseCount > maxOrderableCases) return { status: 'capacity_exceeded' }
  const totalUnits = offer.caseSize * decisions.caseCount; if (!Number.isSafeInteger(totalUnits) || !Number.isSafeInteger(offer.casePriceCents * decisions.caseCount)) return { status: 'invalid_decisions' }
  let quantities: Map<string, number>
  if (offer.kind === 'TITLE_CASE') {
    if (!decisions.selectedMerchandiseId || !offer.sourceableMerchandiseIds.includes(decisions.selectedMerchandiseId)) return { status: 'invalid_decisions' }
    quantities = new Map([[decisions.selectedMerchandiseId, totalUnits]])
  } else {
    const ids = [...new Set(commerce.assortment)].sort()
    if (!ids.length || ids.some(id => !resolveBookstoreBookById(state.bookstoreCommerce.bookCatalog, id))) return { status: 'invalid_offer' }
    const projected = new Map(ids.map(id => [id, (operations.stock.find(s => s.merchandiseId === id)?.quantity ?? 0) + state.bookstoreRestock.orders.filter(o => o.buyerBranchId === branchId && o.status === 'IN_TRANSIT').flatMap(o => o.lines).filter(l => l.merchandiseId === id).reduce((n, l) => n + l.quantity, 0)]))
    quantities = new Map()
    for (let unit = 0; unit < totalUnits; unit++) { const id = ids.reduce((best, id) => projected.get(id)! < projected.get(best)! ? id : best); projected.set(id, projected.get(id)! + 1); quantities.set(id, (quantities.get(id) ?? 0) + 1) }
  }
  const lines = [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([merchandiseId, quantity]) => ({ merchandiseId, capturedMerchandiseDisplayName: resolveBookstoreBookById(state.bookstoreCommerce.bookCatalog, merchandiseId)!.name, quantity }))
  return { status: 'proposed', proposal: { offerId, sellerCompanyId: offer.sellerCompanyId, caseCount: decisions.caseCount, selectedMerchandiseId: decisions.selectedMerchandiseId, lines, totalUnits, totalPriceCents: offer.casePriceCents * decisions.caseCount, deliveryDurationMs: offer.deliveryDurationMs, maxOrderableCases } }
}

export function placeBookstoreRestockOrder(state: GameState, branchId: string, decisions: BookstoreOrderDecisions, reviewedProposal: BookstoreOrderProposal): PlaceBookstoreRestockOrderResult {
  const proposed = proposeBookstoreRestockOrder(state, branchId, reviewedProposal.offerId, decisions)
  if (proposed.status !== 'proposed') return { status: proposed.status, state }
  if (JSON.stringify(proposed.proposal) !== JSON.stringify(reviewedProposal)) return { status: 'proposal_changed', state }
  const branch = state.business.branches.find(b => b.id === branchId)!; const offer = state.bookstoreRestock.offers.find(o => o.id === reviewedProposal.offerId)!; const seller = state.business.companies.find(c => c.id === offer.sellerCompanyId)!
  const settlement = settleValidatedCompanyPurchase(state, branch.companyId, offer.sellerCompanyId, proposed.proposal.totalPriceCents, { description: offer.displayName, purpose: 'Bookstore restock', location: branch.location })
  if (settlement.status !== 'settled') return { status: 'payment_refused', state }
  const orderId = `bookstore-restock-order-${String(state.bookstoreRestock.nextOrderId).padStart(4, '0')}`
  const order: BookstoreRestockOrder = { id: orderId, buyerBranchId: branchId, sellerCompanyId: offer.sellerCompanyId, capturedSellerDisplayName: seller.displayName, offerId: offer.id, capturedOfferDisplayName: offer.displayName, lines: proposed.proposal.lines, dollarTransactionId: settlement.transactionId, capturedDeliveryDurationMs: offer.deliveryDurationMs, remainingDeliveryMs: offer.deliveryDurationMs, status: 'IN_TRANSIT' }
  return { status: 'ordered', orderId, transactionId: settlement.transactionId, state: { ...settlement.state, bookstoreRestock: { ...settlement.state.bookstoreRestock, nextOrderId: state.bookstoreRestock.nextOrderId + 1, orders: [...state.bookstoreRestock.orders, order] } } }
}

export function advanceBookstoreRestockDeliveries(state: GameState, elapsedMs: number): GameState {
  if (elapsedMs <= 0) return state; let next = state
  for (const stale of state.bookstoreRestock.orders) { if (stale.status !== 'IN_TRANSIT') continue; const remaining = stale.remainingDeliveryMs - elapsedMs
    if (remaining > 0) { next = { ...next, bookstoreRestock: { ...next.bookstoreRestock, orders: next.bookstoreRestock.orders.map(o => o.id === stale.id ? { ...o, remainingDeliveryMs: remaining } : o) } }; continue }
    next = incrementBookstoreStock(next, stale.buyerBranchId, stale.lines)
    next = { ...next, bookstoreCommerce: { ...next.bookstoreCommerce, records: next.bookstoreCommerce.records.map(r => r.branchId === stale.buyerBranchId ? { ...r, assortment: [...r.assortment, ...stale.lines.map(l => l.merchandiseId).filter(id => !r.assortment.includes(id))] } : r) } }
    next = { ...next, bookstoreRestock: { ...next.bookstoreRestock, orders: next.bookstoreRestock.orders.map(o => o.id === stale.id ? { ...o, remainingDeliveryMs: 0, status: 'DELIVERED' as const } : o) } }
  } return next
}
