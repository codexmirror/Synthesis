import { NODE_UNITS_PER_NODE } from './nodeMiner'
import { GATE_SSH_1_3_2_RELEASE_ID, GATE_SSH_1_3_3_RELEASE_ID, GATE_SSH_PRODUCT_ID } from './serviceImplementations'
import { NODESCAN_1_1_EXPERIMENTAL, NODE_MINER_1_0, ROLLBACK_EXPLOIT_TOOLKIT_1_0 } from './softwareReleaseContent'
import type { FilesystemState, GameState, MarketOffer, MarketPurchase, MarketState, SoftwarePackageFile } from './types'

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
        id: 'market-offer-nodescan-1.1-experimental',
        priceNodeUnits: NODE_UNITS_PER_NODE,
        distribution: {
          filename: 'nodescan-exp-1.1.pkg',
          releaseId: NODESCAN_1_1_EXPERIMENTAL.releaseId, productId: NODESCAN_1_1_EXPERIMENTAL.productId,
          name: NODESCAN_1_1_EXPERIMENTAL.name, version: NODESCAN_1_1_EXPERIMENTAL.version, channel: NODESCAN_1_1_EXPERIMENTAL.channel,
          sizeBytes: 18_400_000,
        },
      },
      {
        id: 'market-offer-node-miner-1.0',
        priceNodeUnits: NODE_UNITS_PER_NODE,
        distribution: {
          filename: 'node-miner-1.0.pkg',
          releaseId: NODE_MINER_1_0.releaseId, productId: NODE_MINER_1_0.productId,
          name: NODE_MINER_1_0.name, version: NODE_MINER_1_0.version, channel: NODE_MINER_1_0.channel,
          publisher: NODE_MINER_1_0.publisher,
          sizeBytes: 3_400_000,
        },
      },
      {
        id: 'market-offer-gate-ssh-1.3.2',
        priceNodeUnits: NODE_UNITS_PER_NODE,
        distribution: {
          filename: 'gatessh-1.3.2.pkg',
          releaseId: GATE_SSH_1_3_2_RELEASE_ID, productId: GATE_SSH_PRODUCT_ID,
          name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems',
          sizeBytes: 6_400_000,
        },
      },
      {
        // The already-represented GateSSH 1.3.3 release, now distributable as a concrete package.
        id: 'market-offer-gate-ssh-1.3.3',
        priceNodeUnits: NODE_UNITS_PER_NODE,
        distribution: {
          filename: 'gatessh-1.3.3.pkg',
          releaseId: GATE_SSH_1_3_3_RELEASE_ID, productId: GATE_SSH_PRODUCT_ID,
          name: 'GateSSH', version: '1.3.3', channel: 'stable', publisher: 'rack-systems',
          sizeBytes: 6_600_000,
        },
      },
      {
        // The already-authored Rollback Exploit Toolkit release, now distributable as a concrete
        // package. It states no publisher because none is represented for it; the Market presents
        // that absence rather than inventing provenance to fill the field.
        id: 'market-offer-rollback-exploit-toolkit-1.0',
        priceNodeUnits: NODE_UNITS_PER_NODE,
        distribution: {
          filename: 'rollback-exploit-toolkit-1.0.pkg',
          releaseId: ROLLBACK_EXPLOIT_TOOLKIT_1_0.releaseId, productId: ROLLBACK_EXPLOIT_TOOLKIT_1_0.productId,
          name: ROLLBACK_EXPLOIT_TOOLKIT_1_0.name, version: ROLLBACK_EXPLOIT_TOOLKIT_1_0.version, channel: 'unofficial',
          sizeBytes: 2_100_000,
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
 * The concrete local package copy of an offering's release, if one is
 * currently present anywhere on the given filesystem.
 *
 * Possession is derived from filesystem truth by release identity, never
 * stored as a Market flag and never inferred from a path: a copy that is
 * deleted stops being possessed, and a copy the player already had was never
 * bought.
 */
export function findLocalMarketPackageCopy(filesystem: FilesystemState, offer: MarketOffer): SoftwarePackageFile | undefined {
  return filesystem.files.find((file): file is SoftwarePackageFile =>
    file.kind === 'software_package'
    && file.productId === offer.distribution.productId
    && file.releaseId === offer.distribution.releaseId)
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
 * one purchase entitlement is established. Any rejection leaves every one of
 * those untouched.
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
      nodeWallet: { ...state.nodeWallet, balanceNodeUnits: state.nodeWallet.balanceNodeUnits - offer.priceNodeUnits },
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
