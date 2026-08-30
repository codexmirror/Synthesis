import { GATE_SSH_1_3_2_BUILD_ID, GATE_SSH_1_3_2_RELEASE_ID, GATE_SSH_1_3_3_BUILD_ID, GATE_SSH_1_3_3_RELEASE_ID, GATE_SSH_PRODUCT_ID } from './serviceImplementations'
import { FLIPPER_1_0, NODESCAN_1_1_EXPERIMENTAL, NODE_MINER_1_0 } from './softwareReleaseContent'
import { ROLLBACK_MODULE_1_0 } from './flipper'
import type { FilesystemFile, FilesystemState, GameState, MarketOffer, MarketPurchase, MarketState } from './types'
import { debitNodeWalletMarketPurchase } from './nodeEconomy'

/**
 * The NODE address the represented Market operator settles purchases into.
 * It points at the operator's own represented `NodeAccount` (seeded in
 * `nodeEconomy`), which is what makes a purchase reach real economic state
 * instead of disappearing. It is an addressing attribute, never identity.
 */
export const MARKET_OPERATOR_SETTLEMENT_ADDRESS = 'node-addr-4c71e8b0a3'

/** Stable identity of the one represented Market operator currently reachable. */
export const MARKET_OPERATOR_ID = 'market-operator-opx-v0'

/**
 * What the represented Market operator currently charges for each V1
 * offering: 10,000 canonical atomic NODE units, which existing presentation
 * formats as `0.01 NODE` (see `NODE_UNITS_PER_NODE` in nodeMiner.ts).
 *
 * It is a concrete current tuning of what this operator asks, authored as an
 * integer like every other canonical NODE amount — never a fractional NODE
 * value, a presentation override, or a price policy. Each offering still
 * carries its own `priceNodeUnits`, and every operation reads that offering's
 * own price rather than this constant.
 */
export const MARKET_V1_OFFER_PRICE_NODE_UNITS = 10_000

/**
 * The concrete broad/open software Market represented by V1.
 *
 * It is deliberately one Market operated by one represented party, not a
 * source, channel, storefront or catalog framework. NODE-OS supplies the
 * client that presents it; this operator lists and sells the offerings and
 * receives the NODE they cost; each offering's publisher, where one is
 * represented at all, is the release's own separate provenance.
 *
 * The distribution facts below deliberately repeat the represented package
 * artifacts that already exist elsewhere in the world (srv-01's NodeScan and
 * GateSSH packages, node-01's seeded NODE Miner package) rather than deriving
 * one from the other: each is its own concrete artifact truth. Focused tests
 * pin them to each other so the two authoring sites cannot silently diverge.
 */
export function createInitialMarketState(): MarketState {
  return {
    operator: { id: MARKET_OPERATOR_ID, name: 'Open Package Exchange', settlementAddress: MARKET_OPERATOR_SETTLEMENT_ADDRESS },
    // The endpoint's own represented capability. It is not a Device and holds no LocalNetwork membership.
    distributionCapacity: { uploadBytesPerSecond: 4_194_304, downloadBytesPerSecond: 4_194_304 },
    offers: [
      {
        id: 'market-offer-flipper-1.0', priceNodeUnits: MARKET_V1_OFFER_PRICE_NODE_UNITS,
        distribution: { artifact: 'software_package', filename: 'flipper-1.0.pkg', releaseId: FLIPPER_1_0.releaseId, buildId: FLIPPER_1_0.buildId,
          productId: FLIPPER_1_0.productId, name: FLIPPER_1_0.name, version: FLIPPER_1_0.version, channel: FLIPPER_1_0.channel,
          publisher: FLIPPER_1_0.publisher, sizeBytes: 4_000_000 },
      },
      {
        id: 'market-offer-nodescan-1.1-experimental',
        priceNodeUnits: MARKET_V1_OFFER_PRICE_NODE_UNITS,
        distribution: {
          artifact: 'software_package',
          filename: 'nodescan-exp-1.1.pkg',
          releaseId: NODESCAN_1_1_EXPERIMENTAL.releaseId, buildId: NODESCAN_1_1_EXPERIMENTAL.buildId, productId: NODESCAN_1_1_EXPERIMENTAL.productId,
          name: NODESCAN_1_1_EXPERIMENTAL.name, version: NODESCAN_1_1_EXPERIMENTAL.version, channel: NODESCAN_1_1_EXPERIMENTAL.channel,
          sizeBytes: 18_400_000,
        },
      },
      {
        id: 'market-offer-node-miner-1.0',
        priceNodeUnits: MARKET_V1_OFFER_PRICE_NODE_UNITS,
        distribution: {
          artifact: 'software_package',
          filename: 'node-miner-1.0.pkg',
          releaseId: NODE_MINER_1_0.releaseId, buildId: NODE_MINER_1_0.buildId, productId: NODE_MINER_1_0.productId,
          name: NODE_MINER_1_0.name, version: NODE_MINER_1_0.version, channel: NODE_MINER_1_0.channel,
          publisher: NODE_MINER_1_0.publisher,
          sizeBytes: 3_400_000,
        },
      },
      {
        id: 'market-offer-gate-ssh-1.3.2',
        priceNodeUnits: MARKET_V1_OFFER_PRICE_NODE_UNITS,
        distribution: {
          artifact: 'software_package',
          filename: 'gatessh-1.3.2.pkg',
          releaseId: GATE_SSH_1_3_2_RELEASE_ID, buildId: GATE_SSH_1_3_2_BUILD_ID, productId: GATE_SSH_PRODUCT_ID,
          name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems',
          sizeBytes: 6_400_000,
        },
      },
      {
        // The already-represented GateSSH 1.3.3 release, distributable as a concrete package for
        // the first time. It states no channel and no publisher: no accepted current truth (not
        // even the Service implementation it patches) represents either for this exact release,
        // only srv-01's own distinct 1.3.2 package artifact does — and one release's stated
        // provenance is not the product's, so 1.3.3 does not inherit it.
        id: 'market-offer-gate-ssh-1.3.3',
        priceNodeUnits: MARKET_V1_OFFER_PRICE_NODE_UNITS,
        distribution: {
          artifact: 'software_package',
          filename: 'gatessh-1.3.3.pkg',
          releaseId: GATE_SSH_1_3_3_RELEASE_ID, buildId: GATE_SSH_1_3_3_BUILD_ID, productId: GATE_SSH_PRODUCT_ID,
          name: 'GateSSH', version: '1.3.3',
          sizeBytes: 6_600_000,
        },
      },
      {
        // The concrete Rollback Module artifact, offered by the same represented Market
        // operator that previously distributed the standalone rollback toolkit. It is a
        // module input for Flipper, not an installable application: buying and downloading
        // it produces one ordinary filesystem artifact and no InstalledSoftware at all.
        // Its authored module release states no channel and no publisher, so none is invented here.
        id: 'market-offer-flipper-rollback-module-1.0',
        priceNodeUnits: MARKET_V1_OFFER_PRICE_NODE_UNITS,
        distribution: {
          artifact: 'software_module',
          filename: 'flipper-rollback-module-1.0.mod',
          hostProductId: ROLLBACK_MODULE_1_0.hostProductId, moduleId: ROLLBACK_MODULE_1_0.moduleId,
          releaseId: ROLLBACK_MODULE_1_0.releaseId, buildId: ROLLBACK_MODULE_1_0.buildId,
          name: ROLLBACK_MODULE_1_0.name, version: ROLLBACK_MODULE_1_0.version,
          sizeBytes: ROLLBACK_MODULE_1_0.sizeBytes,
        },
      },
    ],
    purchases: { nextId: 1, entitlements: [] },
  }
}

export function findMarketOffer(market: MarketState, offerId: string): MarketOffer | undefined {
  return market.offers.find(({ id }) => id === offerId)
}

/** Whether a canonical purchase entitlement for this offering currently exists. */
export function isMarketOfferPurchased(market: MarketState, offerId: string): boolean {
  return market.purchases.entitlements.some((entitlement) => entitlement.offerId === offerId)
}

/**
 * The concrete local copy of an offering's artifact, if one is currently
 * present anywhere on the given filesystem.
 *
 * Possession is derived from filesystem truth by artifact kind plus release
 * and build identity, never stored as a Market flag and never inferred from a
 * path: a copy that is deleted stops being possessed, and a copy the player
 * already had was never bought.
 */
export function findLocalMarketArtifactCopy(filesystem: FilesystemState, offer: MarketOffer): FilesystemFile | undefined {
  const { distribution } = offer
  return filesystem.files.find((file) => {
    if (file.kind !== distribution.artifact) return false
    if (file.kind === 'software_package' && distribution.artifact === 'software_package') return file.productId === distribution.productId && file.releaseId === distribution.releaseId && file.buildId === distribution.buildId
    if (file.kind === 'software_module' && distribution.artifact === 'software_module') return file.moduleId === distribution.moduleId && file.releaseId === distribution.releaseId && file.buildId === distribution.buildId
    return false
  })
}

export type PurchaseMarketOfferResult =
  | { readonly status: 'purchased'; readonly state: GameState; readonly purchase: MarketPurchase }
  | { readonly status: 'unknown_offer' | 'already_purchased' | 'insufficient_funds' | 'recipient_unavailable'; readonly state: GameState }

/**
 * Buy one represented Market offering with canonical NODE.
 *
 * The whole settlement is one atomic canonical mutation: the local Wallet is
 * debited exactly the offering's represented price, the represented Market
 * operator's own NODE account is credited exactly that amount, and exactly
 * one purchase entitlement is established, and one Wallet activity record is
 * appended. Any rejection leaves every one of those untouched.
 *
 * It deliberately does not create a filesystem artifact, install anything,
 * start a Process, or start a transfer: DOWNLOAD stays a separate later
 * action gated on the entitlement this establishes.
 */
export function purchaseMarketOffer(state: GameState, offerId: string): PurchaseMarketOfferResult {
  const market = state.market
  const offer = findMarketOffer(market, offerId)
  if (!offer) return { status: 'unknown_offer', state }
  if (!Number.isSafeInteger(offer.priceNodeUnits) || offer.priceNodeUnits <= 0) {
    throw new RangeError('A represented Market price must be a positive safe integer of atomic NODE units')
  }
  if (isMarketOfferPurchased(market, offerId)) return { status: 'already_purchased', state }
  // The seller must be a represented recipient other than the buyer's own Wallet;
  // NODE never leaves the Wallet without arriving somewhere real.
  const recipients = state.nodeEconomy.accounts.filter(({ address }) => address === market.operator.settlementAddress)
  if (recipients.length !== 1 || state.nodeWallet.address === market.operator.settlementAddress) return { status: 'recipient_unavailable', state }
  if (state.nodeWallet.balanceNodeUnits < offer.priceNodeUnits) return { status: 'insufficient_funds', state }

  const purchase: MarketPurchase = {
    id: `market-purchase-${String(market.purchases.nextId).padStart(4, '0')}`,
    offerId: offer.id,
    priceNodeUnits: offer.priceNodeUnits,
  }
  return {
    status: 'purchased',
    purchase,
    state: {
      ...state,
      nodeWallet: debitNodeWalletMarketPurchase(state.nodeWallet, {
        purchaseId: purchase.id,
        offerId: offer.id,
        releaseId: offer.distribution.releaseId,
        releaseName: offer.distribution.name,
        releaseVersion: offer.distribution.version,
        amountNodeUnits: offer.priceNodeUnits,
      }),
      nodeEconomy: {
        ...state.nodeEconomy,
        accounts: state.nodeEconomy.accounts.map((account) => account.address === market.operator.settlementAddress
          ? { ...account, balanceNodeUnits: account.balanceNodeUnits + offer.priceNodeUnits }
          : account),
      },
      market: { ...market, purchases: { nextId: market.purchases.nextId + 1, entitlements: [...market.purchases.entitlements, purchase] } },
    },
  }
}
