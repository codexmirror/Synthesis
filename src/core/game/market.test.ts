import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { findLocalMarketPackageCopy, findMarketOffer, isMarketOfferPurchased, purchaseMarketOffer, MARKET_OPERATOR_SETTLEMENT_ADDRESS, MARKET_V1_OFFER_PRICE_NODE_UNITS } from './market'
import { NODE_UNITS_PER_NODE } from './nodeMiner'
import { advanceGameState } from './gameAdvancement'
import { startMarketPackageDownload } from './fileTransfer'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { findInstalledRollbackExploitToolkit, rollbackExploitToolkitSupports } from './software'
import { ROLLBACK_EXPLOIT_TOOLKIT_1_0 } from './softwareReleaseContent'
import type { GameState, SoftwarePackageFile } from './types'

const NODESCAN_OFFER = 'market-offer-nodescan-1.1-experimental'
const NODE_MINER_OFFER = 'market-offer-node-miner-1.0'
const GATE_SSH_1_3_3_OFFER = 'market-offer-gate-ssh-1.3.3'
const ROLLBACK_OFFER = 'market-offer-rollback-exploit-toolkit-1.0'
/** Every V1 offering's represented price: 0.01 NODE as canonical integer atomic units. */
const PRICE = MARKET_V1_OFFER_PRICE_NODE_UNITS

function funded(units: number, base: GameState = createInitialGameState()): GameState {
  return { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: units } }
}

function marketAccount(state: GameState) {
  return state.nodeEconomy.accounts.find(({ address }) => address === state.market.operator.settlementAddress)!
}

describe('Market catalog', () => {
  it('represents each required release exactly once, under stable offer identity', () => {
    const { offers } = createInitialGameState().market
    expect(offers.map(({ id }) => id)).toEqual([
      NODESCAN_OFFER, NODE_MINER_OFFER, 'market-offer-gate-ssh-1.3.2', GATE_SSH_1_3_3_OFFER, ROLLBACK_OFFER,
    ])
    expect(new Set(offers.map(({ id }) => id)).size).toBe(offers.length)
    expect(new Set(offers.map(({ distribution }) => distribution.releaseId)).size).toBe(offers.length)
  })

  it('prices every offering at exactly 0.01 NODE in canonical integer atomic units', () => {
    for (const offer of createInitialGameState().market.offers) {
      expect(offer.priceNodeUnits).toBe(10_000)
      // 0.01 NODE expressed canonically, never as a fractional NODE value.
      expect(offer.priceNodeUnits).toBe(NODE_UNITS_PER_NODE / 100)
      expect(Number.isSafeInteger(offer.priceNodeUnits)).toBe(true)
    }
  })

  it('is exactly the five intended V1 offerings, no more and no fewer', () => {
    const { offers } = createInitialGameState().market
    expect(offers).toHaveLength(5)
    expect(offers.map(({ distribution }) => distribution.productId)).toEqual([
      'nodescan', 'node-miner', 'gate-ssh', 'gate-ssh', 'rollback-exploit-toolkit',
    ])
  })

  it('distributes the Rollback Exploit Toolkit under its own already-authored release identity, with no invented channel or publisher', () => {
    const state = createInitialGameState()
    const distribution = findMarketOffer(state.market, ROLLBACK_OFFER)!.distribution
    expect(distribution).toMatchObject({
      productId: ROLLBACK_EXPLOIT_TOOLKIT_1_0.productId,
      releaseId: ROLLBACK_EXPLOIT_TOOLKIT_1_0.releaseId,
      name: ROLLBACK_EXPLOIT_TOOLKIT_1_0.name,
      version: ROLLBACK_EXPLOIT_TOOLKIT_1_0.version,
    })
    // Absence preserved as a genuinely missing key, never an empty-string or invented value.
    expect('channel' in distribution).toBe(false)
    expect('publisher' in distribution).toBe(false)
  })

  it('states each release provenance truthfully rather than flattening the catalog into one publisher', () => {
    const state = createInitialGameState()
    const distribution = (offerId: string) => findMarketOffer(state.market, offerId)!.distribution
    // Third-party unofficial software, published by the build's own developer identity.
    expect(distribution(NODE_MINER_OFFER)).toMatchObject({ channel: 'unofficial', publisher: 'nm-dev' })
    // Software originating from another product ecosystem, published by that ecosystem —
    // stated only where a represented package artifact actually claims it.
    expect(distribution('market-offer-gate-ssh-1.3.2')).toMatchObject({ channel: 'stable', publisher: 'rack-systems' })
    // No publisher is represented for these releases, so none is claimed — GateSSH 1.3.3
    // in particular does not inherit the provenance srv-01's own 1.3.2 package states.
    expect(distribution(NODESCAN_OFFER).publisher).toBeUndefined()
    expect(distribution(GATE_SSH_1_3_3_OFFER).publisher).toBeUndefined()
    // GateSSH 1.3.3 also carries no invented channel: no accepted current truth represents
    // one for this exact release, only for the distinct 1.3.2 package.
    expect(distribution(GATE_SSH_1_3_3_OFFER).channel).toBeUndefined()
    expect(distribution(ROLLBACK_OFFER).channel).toBeUndefined()
    expect(distribution(ROLLBACK_OFFER).publisher).toBeUndefined()
    // No offering is attributed to NODE, and the Market operator is nobody's publisher.
    expect(state.market.offers.map(({ distribution: item }) => item.publisher))
      .not.toContain(state.market.operator.name)
  })

  it('distributes the same represented artifacts that already exist elsewhere in the world', () => {
    const state = createInitialGameState()
    const packageAt = (files: readonly { readonly path: string }[], path: string) =>
      files.find((file) => file.path === path) as SoftwarePackageFile
    const srv01 = state.world.network.hosts[0].filesystem!.files
    const seededMiner = packageAt(state.player.localDevice.filesystem.files, '/home/user/downloads/node-miner-1.0.pkg')
    const nodeScan = packageAt(srv01, '/opt/packages/nodescan-exp-1.1.pkg')
    const gateSsh = packageAt(srv01, '/opt/packages/gatessh-1.3.2.pkg')
    const distributed = (offerId: string) => {
      const { filename, ...release } = findMarketOffer(state.market, offerId)!.distribution
      return { filename, release }
    }
    for (const [offerId, artifact] of [
      [NODESCAN_OFFER, nodeScan], [NODE_MINER_OFFER, seededMiner], ['market-offer-gate-ssh-1.3.2', gateSsh],
    ] as const) {
      const { filename, release } = distributed(offerId)
      const { kind, id, path, ...represented } = artifact
      expect(release).toEqual(represented)
      expect(path.endsWith(`/${filename}`)).toBe(true)
    }
  })

  it('keeps the Market operator distinct from the local Wallet and from every publisher', () => {
    const state = createInitialGameState()
    expect(state.market.operator.settlementAddress).not.toBe(state.nodeWallet.address)
    expect(marketAccount(state)).toMatchObject({ id: 'node-account-opx-v0', balanceNodeUnits: 0 })
    expect(state.market.operator.settlementAddress).toBe(MARKET_OPERATOR_SETTLEMENT_ADDRESS)
  })
})

describe('purchasing a Market offering', () => {
  it('rejects an unknown offering without mutation', () => {
    const state = funded(PRICE)
    const result = purchaseMarketOffer(state, 'market-offer-nonexistent')
    expect(result).toEqual({ status: 'unknown_offer', state })
    expect(result.state).toBe(state)
  })

  it('rejects insufficient NODE without changing balance or entitlement', () => {
    const state = funded(PRICE - 1)
    const result = purchaseMarketOffer(state, NODESCAN_OFFER)
    expect(result.status).toBe('insufficient_funds')
    expect(result.state).toBe(state)
    expect(result.state.nodeWallet.balanceNodeUnits).toBe(PRICE - 1)
    expect(marketAccount(result.state).balanceNodeUnits).toBe(0)
    expect(isMarketOfferPurchased(result.state.market, NODESCAN_OFFER)).toBe(false)
  })

  it('debits the Wallet, credits the represented Market operator, and establishes one entitlement', () => {
    const state = funded(2 * PRICE + 4_281)
    const result = purchaseMarketOffer(state, NODESCAN_OFFER)
    if (result.status !== 'purchased') throw new Error('expected purchased')
    expect(result.state.nodeWallet.balanceNodeUnits).toBe(PRICE + 4_281)
    expect(marketAccount(result.state).balanceNodeUnits).toBe(10_000)
    expect(result.purchase).toEqual({ id: 'market-purchase-0001', offerId: NODESCAN_OFFER, priceNodeUnits: 10_000 })
    expect(result.state.market.purchases).toEqual({ nextId: 2, entitlements: [result.purchase] })
    // The unrelated represented recipient is untouched: nothing is routed to the Miner developer account.
    expect(result.state.nodeEconomy.accounts.find(({ id }) => id === 'node-account-nm-dev-v0')!.balanceNodeUnits).toBe(0)
  })

  it('never charges twice for an entitlement already held', () => {
    const state = funded(5 * PRICE)
    const first = purchaseMarketOffer(state, NODESCAN_OFFER)
    if (first.status !== 'purchased') throw new Error('expected purchased')
    const second = purchaseMarketOffer(first.state, NODESCAN_OFFER)
    expect(second.status).toBe('already_purchased')
    expect(second.state).toBe(first.state)
    expect(second.state.nodeWallet.balanceNodeUnits).toBe(4 * PRICE)
    expect(second.state.market.purchases.entitlements).toHaveLength(1)
  })

  it('rejects the purchase when no represented recipient holds the operator address', () => {
    const base = funded(PRICE)
    const state: GameState = { ...base, nodeEconomy: { accounts: base.nodeEconomy.accounts.filter(({ id }) => id !== 'node-account-opx-v0') } }
    const result = purchaseMarketOffer(state, NODESCAN_OFFER)
    expect(result.status).toBe('recipient_unavailable')
    expect(result.state).toBe(state)
    expect(result.state.nodeWallet.balanceNodeUnits).toBe(PRICE)
  })

  it('charges the offering its own represented price rather than a hardcoded one', () => {
    // Deliberately not the current V1 price: commerce must follow the represented
    // offering, so this would fail if any operation assumed 10,000 units.
    const base = funded(3 * NODE_UNITS_PER_NODE)
    const state: GameState = { ...base, market: { ...base.market, offers: base.market.offers.map((offer) => offer.id === NODESCAN_OFFER ? { ...offer, priceNodeUnits: 2 * NODE_UNITS_PER_NODE } : offer) } }
    const result = purchaseMarketOffer(state, NODESCAN_OFFER)
    if (result.status !== 'purchased') throw new Error('expected purchased')
    expect(result.state.nodeWallet.balanceNodeUnits).toBe(NODE_UNITS_PER_NODE)
    expect(marketAccount(result.state).balanceNodeUnits).toBe(2 * NODE_UNITS_PER_NODE)
    expect(result.purchase.priceNodeUnits).toBe(2 * NODE_UNITS_PER_NODE)
  })

  it('rejects a balance one unit below the represented price and admits it at exactly the price', () => {
    expect(purchaseMarketOffer(funded(9_999), NODESCAN_OFFER).status).toBe('insufficient_funds')
    const exact = purchaseMarketOffer(funded(10_000), NODESCAN_OFFER)
    if (exact.status !== 'purchased') throw new Error('expected purchased')
    expect(exact.state.nodeWallet.balanceNodeUnits).toBe(0)
    expect(marketAccount(exact.state).balanceNodeUnits).toBe(10_000)
  })

  it('refuses to settle a non-integer represented price rather than creating fractional NODE', () => {
    const base = funded(3 * NODE_UNITS_PER_NODE)
    const state: GameState = { ...base, market: { ...base.market, offers: base.market.offers.map((offer) => offer.id === NODESCAN_OFFER ? { ...offer, priceNodeUnits: 1.5 } : offer) } }
    expect(() => purchaseMarketOffer(state, NODESCAN_OFFER)).toThrow(RangeError)
  })

  it('creates no package, no installed software, no Process and no transfer', () => {
    const state = funded(PRICE)
    const result = purchaseMarketOffer(state, NODESCAN_OFFER)
    if (result.status !== 'purchased') throw new Error('expected purchased')
    expect(result.state.player.localDevice.filesystem).toBe(state.player.localDevice.filesystem)
    expect(result.state.player.localDevice.installedSoftware).toBe(state.player.localDevice.installedSoftware)
    expect(result.state.process).toBe(state.process)
    expect(result.state.fileTransfer).toBe(state.fileTransfer)
    // Advancing time never turns a purchase into an artifact by itself.
    const advanced = advanceGameState(result.state, 120_000)
    expect(advanced.player.localDevice.filesystem.files).toHaveLength(state.player.localDevice.filesystem.files.length)
    expect(advanced.fileTransfer.active).toBeNull()
  })

  it('records no Wallet activity for NODE the Wallet did not receive', () => {
    const state = funded(PRICE)
    const result = purchaseMarketOffer(state, NODESCAN_OFFER)
    if (result.status !== 'purchased') throw new Error('expected purchased')
    expect(result.state.nodeWallet.activity).toEqual(state.nodeWallet.activity)
  })
})

describe('possession and entitlement', () => {
  it('never fabricates entitlement from a package the Device already physically holds', () => {
    const state = createInitialGameState()
    const offer = findMarketOffer(state.market, NODE_MINER_OFFER)!
    expect(findLocalMarketPackageCopy(state.player.localDevice.filesystem, offer)?.path).toBe('/home/user/downloads/node-miner-1.0.pkg')
    expect(isMarketOfferPurchased(state.market, NODE_MINER_OFFER)).toBe(false)
    expect(state.market.purchases.entitlements).toEqual([])
  })

  it('derives possession from filesystem truth by release identity, not from a stored flag', () => {
    const state = createInitialGameState()
    const nodeScanOffer = findMarketOffer(state.market, NODESCAN_OFFER)!
    expect(findLocalMarketPackageCopy(state.player.localDevice.filesystem, nodeScanOffer)).toBeUndefined()

    const copiedElsewhere: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: {
      nextFileId: 4,
      files: [...state.player.localDevice.filesystem.files, {
        kind: 'software_package', id: 'file-0003', path: '/home/user/keep/nodescan-exp-1.1.pkg',
        ...(({ filename, ...release }) => release)(nodeScanOffer.distribution),
      }],
    } } } }
    expect(findLocalMarketPackageCopy(copiedElsewhere.player.localDevice.filesystem, nodeScanOffer)?.path).toBe('/home/user/keep/nodescan-exp-1.1.pkg')

    const removed: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: {
      ...state.player.localDevice.filesystem,
      files: state.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_package'),
    } } } }
    expect(findLocalMarketPackageCopy(removed.player.localDevice.filesystem, findMarketOffer(state.market, NODE_MINER_OFFER)!)).toBeUndefined()
  })
})

describe('Rollback Exploit Toolkit acquisition path', () => {
  it('BUY -> DOWNLOAD -> completion -> Files INSTALL yields the exact InstalledSoftware the existing UPD-001 gating already recognizes, with no Market-specific installation logic', () => {
    const purchase = purchaseMarketOffer(funded(2 * PRICE), ROLLBACK_OFFER)
    if (purchase.status !== 'purchased') throw new Error('expected purchased')

    const download = startMarketPackageDownload(purchase.state, ROLLBACK_OFFER)
    if (download.status !== 'started') throw new Error('expected started')
    const downloaded = advanceGameState(download.state, 60_000)
    expect(downloaded.fileTransfer.active).toBeNull()

    // Completion creates one ordinary local package, and only one, under this product's own identity.
    const packages = downloaded.player.localDevice.filesystem.files.filter((file): file is SoftwarePackageFile =>
      file.kind === 'software_package' && file.productId === ROLLBACK_EXPLOIT_TOOLKIT_1_0.productId)
    expect(packages).toHaveLength(1)
    const packageFile = packages[0]
    expect(packageFile).toMatchObject({ releaseId: ROLLBACK_EXPLOIT_TOOLKIT_1_0.releaseId, version: ROLLBACK_EXPLOIT_TOOLKIT_1_0.version })
    // Absence survives the whole transfer: no channel or publisher was fabricated along the way.
    expect('channel' in packageFile).toBe(false)
    expect('publisher' in packageFile).toBe(false)

    // The existing, unmodified Files/INSTALL admission — nothing Market-specific.
    const install = installLocalSoftwarePackage(downloaded, packageFile.path)
    if (install.status !== 'started') throw new Error('expected started')
    const installedState = advanceGameState(install.state, 60_000)

    const installation = findInstalledRollbackExploitToolkit(installedState.player.localDevice)
    expect(installation).toBeDefined()
    expect(installation!.releaseId).toBe(ROLLBACK_EXPLOIT_TOOLKIT_1_0.releaseId)
    expect(installation!.channel).toBeUndefined()
    expect(installation!.publisher).toBeUndefined()
    // The already-implemented UPD-001 capability check now recognizes this installed tool
    // through the ordinary lifecycle alone, with no RackUpdate-specific code touched by this PR.
    expect(rollbackExploitToolkitSupports(installation!, 'UPD-001')).toBe(true)
  })
})
