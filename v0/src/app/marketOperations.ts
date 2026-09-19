import { purchaseMarketOffer, type PurchaseMarketOfferResult } from '../core/game/market'
import { startMarketPackageDownload, type StartMarketPackageDownloadResult } from '../core/game/fileTransfer'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createMarketActions(accessor: GameStateAccessor) {
  return {
    purchaseMarketOffer(offerId: string): PurchaseMarketOfferResult {
      return commitResult(accessor, purchaseMarketOffer(accessor.read(), offerId))
    },
    startMarketPackageDownload(offerId: string): StartMarketPackageDownloadResult {
      return commitResult(accessor, startMarketPackageDownload(accessor.read(), offerId))
    },
  }
}
