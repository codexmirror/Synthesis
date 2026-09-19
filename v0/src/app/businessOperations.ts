import { purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice, placeBookstoreRestockOrderFromOperatedRemoteDevice, requestBookstoreMarketReportFromOperatedRemoteDevice, type PlaceOperatedBookstoreRestockOrderResult, type RequestOperatedBookstoreMarketReportResult } from '../core/game/companyAdministration'
import type { BookstoreOrderDecisions, BookstoreOrderProposal } from '../core/game/bookstoreRestock'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createBusinessActions(accessor: GameStateAccessor) {
  return {
    purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice(branchId: string) {
      return commitResult(accessor, purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice(accessor.read(), branchId))
    },
    /**
     * Deliberately only Branch and offer identity: the acting Device comes from
     * the active Remote Session inside the domain operation, the Branch names
     * the buying Company, the offer names the seller and the exact commercial
     * terms, and Company Administration decides whether that Device may submit
     * this at all. No caller can name a Company, a Treasury, a destination
     * Account, or an amount.
     */
    placeBookstoreRestockOrderFromOperatedRemoteDevice(branchId: string, decisions: BookstoreOrderDecisions, reviewedProposal: BookstoreOrderProposal): PlaceOperatedBookstoreRestockOrderResult {
      return commitResult(accessor, placeBookstoreRestockOrderFromOperatedRemoteDevice(accessor.read(), branchId, decisions, reviewedProposal))
    },
    requestBookstoreMarketReportFromOperatedRemoteDevice(branchId: string): RequestOperatedBookstoreMarketReportResult {
      return commitResult(accessor, requestBookstoreMarketReportFromOperatedRemoteDevice(accessor.read(), branchId))
    },
  }
}
