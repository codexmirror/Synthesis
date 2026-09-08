import { resolveCompanyTreasuryAccount } from '../../core/game/business'
import { findBookstoreCommerceRecord, resolveBookstoreBookById } from '../../core/game/bookstoreCommerce'
import { deriveBookstoreTotalStock, resolveBookstoreOperationsForBranch } from '../../core/game/bookstoreOperations'
import { deriveBookstoreIncomingStock, deriveBookstoreIncomingStockForBook, deriveBookstoreLastAcquisitionCost, deriveBookstoreMaxOrderableCases } from '../../core/game/bookstoreRestock'
import { resolveSoleCompanyAdministrationContextForOperatedRemoteDevice } from '../../core/game/companyAdministration'
import type { BookstoreSupplyOffer, GameState } from '../../core/game/types'

/**
 * What the Business client may currently state, projected from canonical
 * state on every render.
 *
 * This module owns nothing. Company authority comes from the Business-owned
 * Company Administration Session, funds from the Company's own current
 * Treasury designation and its Civic Dollar Account, inventory from Bookstore
 * Operations, and offers and orders from Bookstore Restock. Nothing here is
 * stored, cached, or duplicated, so a sale, an order, an advancing delivery or
 * a revoked authority is reflected the next time this runs.
 */
export type VeyraBusinessProjection =
  /** This Device administers no Company at all: no Company truth and no action may be presented. */
  | { readonly status: 'no_company_access' }
  /** This Device administers more than one Company; choosing between them is unimplemented, never guessed. */
  | { readonly status: 'company_selection_unsupported' }
  | { readonly status: 'company'; readonly company: VeyraBusinessCompanyView; readonly branch?: VeyraBusinessBranchView }

export interface VeyraBusinessCompanyView {
  readonly displayName: string
  /**
   * The Company's current Treasury balance in canonical cents, absent where
   * the Treasury designation or its Account does not resolve unambiguously.
   * It is never substituted with the phone's own Wallet Account.
   */
  readonly fundsCents?: number
}

export interface VeyraBusinessBranchView {
  readonly branchId: string
  readonly displayName: string
  readonly location?: string
  readonly inventory: VeyraBusinessInventoryView
  readonly offers: readonly VeyraBusinessOfferView[]
  readonly orders: readonly VeyraBusinessOrderView[]
}

export interface VeyraBusinessInventoryView {
  /** Current sellable stock on the shelves; in-transit units are deliberately not part of it. */
  readonly totalStock: number
  readonly shelfCapacity: number
  /** Units already paid for and still in transit; they reserve shelf capacity but cannot be sold. */
  readonly incomingStock: number
  readonly titleCount: number
  readonly items: readonly VeyraBusinessProductView[]
}
export interface VeyraBusinessProductView {
  readonly merchandiseId: string; readonly name: string; readonly genre: string
  readonly retailPriceCents: number; readonly baselinePopularity: number
  readonly quantity: number; readonly incomingQuantity: number; readonly lastAcquisitionCostCents?: number
}

export interface VeyraBusinessOfferView {
  readonly id: string
  readonly displayName: string
  /** Stable identity of the represented Company selling this offer. */
  readonly sellerCompanyId: string
  readonly sellerDisplayName: string
  readonly kind: BookstoreSupplyOffer['kind']
  readonly caseSize: number
  readonly casePriceCents: number
  readonly maxOrderableCases: number
  readonly averageUnitCostCents: number
  readonly deliveryDurationMs: number
  readonly sourceableBooks: readonly { readonly merchandiseId: string; readonly name: string }[]
}

export interface VeyraBusinessOrderView {
  readonly id: string
  /** The order's own captured meaning, never re-resolved from current offers or catalog names. */
  readonly offerDisplayName: string
  readonly sellerDisplayName: string
  readonly totalUnits: number
  readonly status: 'IN_TRANSIT' | 'DELIVERED'
  /** Represented delivery time still to run; present only while the order is actually in transit. */
  readonly remainingDeliveryMs?: number
}

export function projectVeyraBusiness(state: GameState): VeyraBusinessProjection {
  const administration = resolveSoleCompanyAdministrationContextForOperatedRemoteDevice(state)
  if (administration.status === 'ambiguous') return { status: 'company_selection_unsupported' }
  if (administration.status === 'unavailable') return { status: 'no_company_access' }

  const company: VeyraBusinessCompanyView = {
    displayName: administration.company.displayName,
    fundsCents: resolveCompanyTreasuryAccount(state, administration.company.id)?.balanceCents,
  }
  const branch = resolveSupportedBookstoreBranch(state, administration.company.id)
  return { status: 'company', company, branch }
}

/**
 * The one Bookstore Branch this Company currently has that Business V1 can
 * actually manage: it must belong to the administered Company and represent
 * both the Bookstore commerce and Bookstore operations records this surface
 * reads. Zero or several resolve as unavailable rather than choosing one, and
 * Branch selection is deliberately unimplemented.
 */
function resolveSupportedBookstoreBranch(state: GameState, companyId: string): VeyraBusinessBranchView | undefined {
  const supported = state.business.branches
    .filter((branch) => branch.companyId === companyId)
    .flatMap((branch) => {
      const commerce = findBookstoreCommerceRecord(state, branch.id)
      const operations = resolveBookstoreOperationsForBranch(state, branch.id)
      return commerce && operations ? [{ branch, commerce, operations }] : []
    })
  if (supported.length !== 1) return undefined
  const { branch, commerce, operations } = supported[0]

  const merchandiseName = (merchandiseId: string) => resolveBookstoreBookById(state.bookstoreCommerce.bookCatalog, merchandiseId)?.name
  const assortment = new Set(commerce.assortment)

  return {
    branchId: branch.id,
    displayName: branch.displayName,
    location: branch.location,
    inventory: {
      totalStock: deriveBookstoreTotalStock(operations),
      shelfCapacity: operations.shelfCapacity,
      incomingStock: deriveBookstoreIncomingStock(state, branch.id),
      titleCount: commerce.assortment.filter((id, index) => commerce.assortment.indexOf(id) === index && Boolean(merchandiseName(id))).length,
      items: commerce.assortment.flatMap((merchandiseId) => {
        const book = resolveBookstoreBookById(state.bookstoreCommerce.bookCatalog, merchandiseId)
        return book && assortment.has(merchandiseId) ? [{ merchandiseId, name: book.name, genre: book.genre, retailPriceCents: book.unitPriceCents, baselinePopularity: book.baselinePopularity, quantity: operations.stock.find((entry) => entry.merchandiseId === merchandiseId)?.quantity ?? 0, incomingQuantity: deriveBookstoreIncomingStockForBook(state, branch.id, merchandiseId), lastAcquisitionCostCents: deriveBookstoreLastAcquisitionCost(state, branch.id, merchandiseId) }] : []
      }),
    },
    // Every currently represented supply offer, in represented order. An offer
    // whose seller Company does not resolve is not presented at all rather
    // than presented without whose offer it is.
    offers: state.bookstoreRestock.offers.flatMap((offer) => {
      const sellers = state.business.companies.filter(({ id }) => id === offer.sellerCompanyId)
      return sellers.length === 1 ? [projectOffer(state, branch.id, offer, sellers[0].id, sellers[0].displayName, merchandiseName)] : []
    }),
    orders: state.bookstoreRestock.orders
      .filter((order) => order.buyerBranchId === branch.id)
      .map((order) => ({
        id: order.id,
        offerDisplayName: order.capturedOfferDisplayName,
        sellerDisplayName: order.capturedSellerDisplayName,
        totalUnits: order.lines.reduce((sum, line) => sum + line.quantity, 0),
        status: order.status,
        remainingDeliveryMs: order.status === 'IN_TRANSIT' ? order.remainingDeliveryMs : undefined,
      })),
  }
}

function projectOffer(state: GameState, branchId: string, offer: BookstoreSupplyOffer, sellerCompanyId: string, sellerDisplayName: string, merchandiseName: (merchandiseId: string) => string | undefined): VeyraBusinessOfferView {
  return {
    id: offer.id,
    displayName: offer.displayName,
    sellerCompanyId,
    sellerDisplayName,
    kind: offer.kind,
    caseSize: offer.caseSize,
    casePriceCents: offer.casePriceCents,
    maxOrderableCases: deriveBookstoreMaxOrderableCases(state, branchId, offer),
    averageUnitCostCents: offer.casePriceCents / offer.caseSize,
    deliveryDurationMs: offer.deliveryDurationMs,
    sourceableBooks: offer.sourceableMerchandiseIds.flatMap((merchandiseId) => { const name = merchandiseName(merchandiseId); return name ? [{ merchandiseId, name }] : [] }),
  }
}
