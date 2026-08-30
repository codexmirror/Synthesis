import { checkDestinationPlacement } from '../../core/game/filesystem'
import { deriveMarketDownloadDestinationPath } from '../../core/game/fileTransfer'
import { findLocalMarketPackageCopy, isMarketOfferPurchased } from '../../core/game/market'
import type { GameState, MarketOffer } from '../../core/game/types'

/**
 * The acquisition lifecycle one Market offering is currently in, derived
 * entirely from canonical state: the represented purchase entitlement, the
 * single canonical FileTransfer, and the local Device's own filesystem. The
 * Market stores none of it.
 */
export type MarketAcquisitionState = 'AVAILABLE' | 'PURCHASED' | 'DOWNLOADING' | 'ON DEVICE'

export type MarketPrimaryAction = 'BUY' | 'DOWNLOAD' | 'NONE'

export interface MarketTransferProgress {
  readonly bytesTransferred: number
  readonly bytesTotal: number
  readonly percent: number
}

export interface MarketOfferView {
  readonly offerId: string
  readonly name: string
  readonly version: string
  readonly channel: string
  /** Present only where the represented release actually states provenance. */
  readonly publisher?: string
  readonly releaseId: string
  readonly packageFilename: string
  readonly sizeBytes: number
  readonly priceNodeUnits: number
  readonly state: MarketAcquisitionState
  /** Canonical entitlement, deliberately separate from physical possession below. */
  readonly purchased: boolean
  /** Where a copy of this release currently sits on the local Device, if one does. */
  readonly localCopyPath?: string
  readonly destinationPath: string
  /** An unrelated artifact currently occupies the V1 download destination. */
  readonly destinationOccupied: boolean
  readonly transfer?: MarketTransferProgress
  readonly action: MarketPrimaryAction
}

export interface MarketView {
  readonly operatorName: string
  readonly clientDeviceName: string
  readonly balanceNodeUnits: number
  readonly offers: readonly MarketOfferView[]
}

function deriveOfferView(state: GameState, offer: MarketOffer): MarketOfferView {
  const local = state.player.localDevice
  const purchased = isMarketOfferPurchased(state.market, offer.id)
  const localCopy = findLocalMarketPackageCopy(local.filesystem, offer)
  const destinationPath = deriveMarketDownloadDestinationPath(offer)
  const active = state.fileTransfer.active
  const transfer = active?.origin === 'market_distribution' && active.offerId === offer.id
    ? {
      bytesTransferred: active.bytesTransferred,
      bytesTotal: active.bytesTotal,
      // Floor rather than round: running work must never read as complete.
      percent: active.bytesTotal > 0 ? Math.floor(active.bytesTransferred / active.bytesTotal * 100) : 0,
    }
    : undefined
  const destinationOccupied = !localCopy && checkDestinationPlacement(local.filesystem, destinationPath) !== 'ok'
  const acquisition: MarketAcquisitionState = transfer ? 'DOWNLOADING' : localCopy ? 'ON DEVICE' : purchased ? 'PURCHASED' : 'AVAILABLE'
  return {
    offerId: offer.id,
    name: offer.distribution.name,
    version: offer.distribution.version,
    channel: offer.distribution.channel,
    ...(offer.distribution.publisher ? { publisher: offer.distribution.publisher } : {}),
    releaseId: offer.distribution.releaseId,
    packageFilename: offer.distribution.filename,
    sizeBytes: offer.distribution.sizeBytes,
    priceNodeUnits: offer.priceNodeUnits,
    state: acquisition,
    purchased,
    ...(localCopy ? { localCopyPath: localCopy.path } : {}),
    destinationPath,
    destinationOccupied,
    ...(transfer ? { transfer } : {}),
    // Possession never implies entitlement, so an unbought offering keeps offering BUY
    // even when a copy of the same release is already present.
    action: transfer ? 'NONE' : !purchased ? 'BUY' : localCopy || destinationOccupied ? 'NONE' : 'DOWNLOAD',
  }
}

/**
 * The whole Market surface as a projection over canonical state. It owns no
 * balance, purchase, download, transfer-progress or installation state of its
 * own: every value here is read fresh from the domain that owns it.
 */
export function deriveMarketView(state: GameState): MarketView {
  return {
    operatorName: state.market.operator.name,
    clientDeviceName: state.player.localDevice.displayName,
    balanceNodeUnits: state.nodeWallet.balanceNodeUnits,
    offers: state.market.offers.map((offer) => deriveOfferView(state, offer)),
  }
}
