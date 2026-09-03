import { checkDestinationPlacement } from '../../core/game/filesystem'
import { deriveMarketDownloadDestinationPath } from '../../core/game/fileTransfer'
import { findLocalMarketArtifactCopy, isMarketOfferPurchased } from '../../core/game/market'
import type { GameState, MarketDistribution, MarketOffer } from '../../core/game/types'

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

/**
 * One concrete release this Market actually offers, with its own entitlement,
 * price, possession and action.
 *
 * Exactly one of these exists per represented `MarketOffer`, and nothing else
 * ever becomes one: an authored release, an InstalledSoftware entry or a
 * package already sitting on the Device is not an offering, and the catalog
 * never manufactures one to fill a selector.
 */
export interface MarketReleaseView {
  /** Stable offer identity — the entitlement identity, never a version string. */
  readonly offerId: string
  readonly name: string
  readonly version: string
  /** Present only where the represented release actually states a channel. */
  readonly channel?: string
  /** Present only where the represented release actually states provenance. */
  readonly publisher?: string
  readonly releaseId: string
  /** Which concrete artifact kind this offering distributes; a module is never an installable package. */
  readonly artifact: MarketDistribution['artifact']
  readonly filename: string
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

/**
 * What the local Device already holds of one product, read from the Device's
 * own canonical truth.
 *
 * It is deliberately *not* part of the catalog: none of it is for sale, none
 * of it is an offering, and none of it may ever be presented as one. It exists
 * so a product surface can answer "what do I already have of this?" without
 * inventing a Market offer for a release this Market does not distribute —
 * NodeScan 1.0 is installed here and 1.2 sits in downloads, while the one
 * NodeScan release this Market lists is 1.1.
 *
 * Only the local Device is read. Software installed on a represented remote
 * Device is observation truth owned by NodeScan and Knowledge, and the Market
 * must never disclose it.
 */
export interface MarketLocalPresence {
  /** The release of this product installed on the local Device, where one is. */
  readonly installed?: { readonly version: string; readonly channel?: string }
  /** Local package copies of releases this Market does not offer. */
  readonly packages: readonly { readonly version: string; readonly channel?: string; readonly path: string }[]
}

/**
 * A product-level summary of where its offered releases stand. `count` is how
 * many of the product's releases are in `state`, which lets a product with
 * several releases stay honest — one of two releases being on the Device is
 * not the product being on the Device.
 */
export interface MarketEntrySummary {
  readonly state: MarketAcquisitionState
  readonly count: number
  readonly total: number
}

/**
 * One catalog entry: a software product with the releases this Market offers
 * of it, or one module offering.
 *
 * `kind` keeps the distinction the domain makes. A `product` entry groups
 * `software_package` offerings by their represented `productId`; a `module`
 * entry is one `software_module` offering, which carries no `productId` at
 * all, can never produce InstalledSoftware, and is never a release of its host
 * product. Grouping is presentation only: it establishes no product registry
 * and reads nothing but the offerings themselves.
 */
export interface MarketCatalogEntry {
  /** Presentation grouping key. Not domain identity, and never an entitlement identity. */
  readonly key: string
  readonly kind: 'product' | 'module'
  /** The display name every offering grouped here states for itself. */
  readonly name: string
  /** Represented product identity; product entries only. */
  readonly productId?: string
  /** The product a module belongs to; module entries only. */
  readonly hostProductId?: string
  /** The host product's display name, where this Market also lists that product; module entries only. */
  readonly hostName?: string
  /** The releases of this entry the Market actually offers, in the order the operator lists them. */
  readonly releases: readonly MarketReleaseView[]
  readonly summary: MarketEntrySummary
  readonly lowestPriceNodeUnits: number
  readonly highestPriceNodeUnits: number
  /** Local Device truth about this product. Never an offering; product entries only. */
  readonly local?: MarketLocalPresence
  /** Keys of the module entries this Market offers for this product; product entries only. */
  readonly moduleKeys: readonly string[]
}

/**
 * A top-level distribution destination the client presents.
 *
 * `represented` is a Market this Device can actually reach — currently exactly
 * one, the operator held in canonical state. `unrepresented` is a stated
 * absence and nothing more: it holds no operator, no settlement address, no
 * offerings and no economic identity, and no action anywhere in the client is
 * bound to it. It exists so the client stops implying that one open exchange
 * is the whole of software distribution, and so a real second source can take
 * its place if one is ever represented.
 */
export type MarketSourceKind = 'represented' | 'unrepresented'

export interface MarketSourceView {
  readonly id: string
  readonly kind: MarketSourceKind
  /** What kind of distribution this destination is. */
  readonly title: string
  /** The represented party that operates it; a destination with no represented operator has none. */
  readonly operatorName?: string
  readonly offeringCount: number
}

/**
 * The publisher-operated distribution the client names and does not have.
 *
 * NODE-OS supplies the Market client; the one represented operator is an
 * independent exchange; a release's publisher is that release's own
 * provenance. No publisher, and no NODE first-party channel, operates a
 * represented source, so this destination lists nothing and can never be sold
 * from. Its `id` is a presentation key, deliberately not shaped like a
 * represented operator identity.
 */
export const UNREPRESENTED_PUBLISHER_SOURCE: MarketSourceView = {
  id: 'view-publisher-distribution',
  kind: 'unrepresented',
  title: 'PUBLISHER DISTRIBUTION',
  offeringCount: 0,
}

export interface MarketView {
  readonly operatorName: string
  readonly clientDeviceName: string
  readonly balanceNodeUnits: number
  readonly sources: readonly MarketSourceView[]
  readonly entries: readonly MarketCatalogEntry[]
}

function deriveReleaseView(state: GameState, offer: MarketOffer): MarketReleaseView {
  const local = state.player.localDevice
  const purchased = isMarketOfferPurchased(state.market, offer.id)
  const localCopy = findLocalMarketArtifactCopy(local.filesystem, offer)
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
    ...(offer.distribution.artifact === 'software_package' && offer.distribution.channel ? { channel: offer.distribution.channel } : {}),
    ...(offer.distribution.artifact === 'software_package' && offer.distribution.publisher ? { publisher: offer.distribution.publisher } : {}),
    releaseId: offer.distribution.releaseId,
    artifact: offer.distribution.artifact,
    filename: offer.distribution.filename,
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

/** Most-advanced first: the state a product-level summary reports. */
const SUMMARY_PRIORITY: readonly MarketAcquisitionState[] = ['DOWNLOADING', 'ON DEVICE', 'PURCHASED', 'AVAILABLE']

function summarize(releases: readonly MarketReleaseView[]): MarketEntrySummary {
  const state = SUMMARY_PRIORITY.find((candidate) => releases.some((release) => release.state === candidate)) ?? 'AVAILABLE'
  return { state, count: releases.filter((release) => release.state === state).length, total: releases.length }
}

/**
 * What the local Device already holds of one product.
 *
 * Package copies of releases this Market *does* offer are deliberately left
 * out: those already read as `ON DEVICE` on the offering itself, and repeating
 * them here would blur possession into the catalog. What remains is the honest
 * remainder — releases the player holds that this Market does not sell.
 */
function deriveLocalPresence(state: GameState, productId: string, offeredReleaseIds: ReadonlySet<string>): MarketLocalPresence | undefined {
  const local = state.player.localDevice
  const installed = local.installedSoftware.find((software) => software.id === productId)
  const packages = local.filesystem.files.flatMap((file) => file.kind === 'software_package' && file.productId === productId && !offeredReleaseIds.has(file.releaseId)
    ? [{ version: file.version, ...(file.channel ? { channel: file.channel } : {}), path: file.path }]
    : [])
  if (!installed && packages.length === 0) return undefined
  return {
    ...(installed ? { installed: { version: installed.version, ...(installed.channel ? { channel: installed.channel } : {}) } } : {}),
    packages,
  }
}

/**
 * Group the represented offerings into the products and modules a player
 * actually thinks in, without merging anything the domain keeps separate.
 *
 * Packages group by represented `productId`; the group also requires one
 * agreed display name, so two releases claiming different names for one
 * product stay visibly separate rather than one silently speaking for the
 * other. Every release keeps its own price, size, channel, publisher,
 * entitlement, possession and action: nothing is inherited from a sibling.
 */
function deriveCatalogEntries(state: GameState): readonly MarketCatalogEntry[] {
  const grouped = new Map<string, { kind: 'product' | 'module'; name: string; productId?: string; hostProductId?: string; offers: MarketOffer[] }>()
  for (const offer of state.market.offers) {
    const { distribution } = offer
    const key = distribution.artifact === 'software_package'
      ? `product:${distribution.productId}:${distribution.name}`
      // A module has no product identity at all, so it groups by its own stable module identity.
      : `module:${distribution.moduleId}:${distribution.name}`
    const existing = grouped.get(key)
    if (existing) { existing.offers.push(offer); continue }
    grouped.set(key, distribution.artifact === 'software_package'
      ? { kind: 'product', name: distribution.name, productId: distribution.productId, offers: [offer] }
      : { kind: 'module', name: distribution.name, hostProductId: distribution.hostProductId, offers: [offer] })
  }

  const entries = [...grouped].map(([key, group]) => {
    const releases = group.offers.map((offer) => deriveReleaseView(state, offer))
    const prices = releases.map((release) => release.priceNodeUnits)
    const local = group.productId === undefined
      ? undefined
      : deriveLocalPresence(state, group.productId, new Set(releases.map((release) => release.releaseId)))
    return {
      key,
      kind: group.kind,
      name: group.name,
      ...(group.productId ? { productId: group.productId } : {}),
      ...(group.hostProductId ? { hostProductId: group.hostProductId } : {}),
      releases,
      summary: summarize(releases),
      lowestPriceNodeUnits: Math.min(...prices),
      highestPriceNodeUnits: Math.max(...prices),
      ...(local ? { local } : {}),
      moduleKeys: [] as readonly string[],
    } satisfies MarketCatalogEntry
  })

  // A module offering is presented near the product it belongs to, and stays a
  // module: the cross-reference points at the separate module entry rather
  // than folding it into that product's releases.
  return entries.map((entry) => {
    if (entry.kind === 'product') {
      return { ...entry, moduleKeys: entries.filter((candidate) => candidate.kind === 'module' && candidate.hostProductId === entry.productId).map((candidate) => candidate.key) }
    }
    // The host's display name is the one its own offerings state, where this
    // Market lists them at all; it is never invented from the product ID.
    const host = entries.find((candidate) => candidate.kind === 'product' && candidate.productId === entry.hostProductId)
    return host ? { ...entry, hostName: host.name } : entry
  })
}

/**
 * The whole Market surface as a projection over canonical state. It owns no
 * balance, purchase, download, transfer-progress or installation state of its
 * own: every value here is read fresh from the domain that owns it.
 */
export function deriveMarketView(state: GameState): MarketView {
  const entries = deriveCatalogEntries(state)
  return {
    operatorName: state.market.operator.name,
    clientDeviceName: state.player.localDevice.displayName,
    balanceNodeUnits: state.nodeWallet.balanceNodeUnits,
    sources: [
      {
        id: state.market.operator.id,
        kind: 'represented',
        // What this one represented operator is: a broad/open exchange applying no
        // curation, certification or support of its own. It is stated here rather
        // than read from state because no represented source state exists to read —
        // a second source would need canonical operator/source truth first.
        title: 'OPEN EXCHANGE',
        operatorName: state.market.operator.name,
        offeringCount: state.market.offers.length,
      },
      UNREPRESENTED_PUBLISHER_SOURCE,
    ],
    entries,
  }
}
