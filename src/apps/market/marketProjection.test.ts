import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { purchaseMarketOffer } from '../../core/game/market'
import { startMarketPackageDownload } from '../../core/game/fileTransfer'
import { advanceGameState } from '../../core/game/gameAdvancement'
import type { GameState, MarketOffer } from '../../core/game/types'
import { deriveMarketView } from './marketProjection'

const GATE_SSH_1_3_2_OFFER = 'market-offer-gate-ssh-1.3.2'
const GATE_SSH_1_3_3_OFFER = 'market-offer-gate-ssh-1.3.3'

function withOffers(map: (offer: MarketOffer) => MarketOffer, base: GameState = createInitialGameState()): GameState {
  return { ...base, market: { ...base.market, offers: base.market.offers.map(map) } }
}

function funded(units: number, base: GameState = createInitialGameState()): GameState {
  return { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: units } }
}

function acquired(offerId: string, base: GameState): GameState {
  const purchase = purchaseMarketOffer(base, offerId)
  if (purchase.status !== 'purchased') throw new Error('expected purchased')
  const started = startMarketPackageDownload(purchase.state, offerId)
  if (started.status !== 'started') throw new Error('expected started')
  return advanceGameState(started.state, 60_000)
}

function entry(state: GameState, name: string) {
  const found = deriveMarketView(state).entries.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`no catalog entry named ${name}`)
  return found
}

describe('product grouping', () => {
  it('groups the offerings of one product into a single entry, in the order the operator lists them', () => {
    const view = deriveMarketView(createInitialGameState())
    expect(view.entries.map(({ name, kind }) => `${kind}:${name}`)).toEqual([
      'product:RATTLER', 'product:Flipper', 'product:NodeScan', 'product:NODE Miner', 'product:GateSSH', 'module:Rollback Module',
    ])
    const gateSsh = entry(createInitialGameState(), 'GateSSH')
    expect(gateSsh.productId).toBe('gate-ssh')
    expect(gateSsh.releases.map(({ offerId, version }) => [offerId, version])).toEqual([
      [GATE_SSH_1_3_2_OFFER, '1.3.2'],
      [GATE_SSH_1_3_3_OFFER, '1.3.3'],
    ])
  })

  it('never merges the metadata of two releases of one product', () => {
    const [stable, unstated] = entry(createInitialGameState(), 'GateSSH').releases
    expect(stable).toMatchObject({ version: '1.3.2', channel: 'stable', publisher: 'rack-systems', filename: 'gatessh-1.3.2.pkg', sizeBytes: 6_400_000 })
    // 1.3.3 represents neither a channel nor a publisher, and inherits neither.
    expect(unstated.channel).toBeUndefined()
    expect(unstated.publisher).toBeUndefined()
    expect(unstated).toMatchObject({ version: '1.3.3', filename: 'gatessh-1.3.3.pkg', sizeBytes: 6_600_000 })
  })

  it('keeps releases that state different display names for one product identity separate', () => {
    const renamed = withOffers((offer) => offer.id === GATE_SSH_1_3_3_OFFER && offer.distribution.artifact === 'software_package'
      ? { ...offer, distribution: { ...offer.distribution, name: 'GateSSH Pro' } } : offer)
    const names = deriveMarketView(renamed).entries.filter(({ productId }) => productId === 'gate-ssh').map(({ name }) => name)
    expect(names).toEqual(['GateSSH', 'GateSSH Pro'])
  })

  it('states the price range a product spans rather than one price for all of it', () => {
    const flat = entry(createInitialGameState(), 'GateSSH')
    expect([flat.lowestPriceNodeUnits, flat.highestPriceNodeUnits]).toEqual([10_000, 10_000])

    const varied = withOffers((offer) => offer.id === GATE_SSH_1_3_3_OFFER ? { ...offer, priceNodeUnits: 25_000 } : offer)
    const spread = entry(varied, 'GateSSH')
    expect([spread.lowestPriceNodeUnits, spread.highestPriceNodeUnits]).toEqual([10_000, 25_000])
  })
})

describe('product state summary', () => {
  it('reports the most advanced state and how many releases it actually covers', () => {
    expect(entry(createInitialGameState(), 'GateSSH').summary).toEqual({ state: 'AVAILABLE', count: 2, total: 2 })

    const held = acquired(GATE_SSH_1_3_2_OFFER, funded(30_000))
    expect(entry(held, 'GateSSH').summary).toEqual({ state: 'ON DEVICE', count: 1, total: 2 })

    const purchase = purchaseMarketOffer(held, GATE_SSH_1_3_3_OFFER)
    if (purchase.status !== 'purchased') throw new Error('expected purchased')
    // Possession outranks entitlement in the summary, and still says one of two.
    expect(entry(purchase.state, 'GateSSH').summary).toEqual({ state: 'ON DEVICE', count: 1, total: 2 })
  })
})

describe('modules stay distinct from products', () => {
  it('gives a module offering no product identity and never lists it among a product release set', () => {
    const view = deriveMarketView(createInitialGameState())
    const module = view.entries.find(({ kind }) => kind === 'module')!
    expect(module.productId).toBeUndefined()
    expect(module.hostProductId).toBe('flipper')
    // The host's own name, taken from the offerings that state it — never built from the ID.
    expect(module.hostName).toBe('Flipper')

    const flipper = entry(createInitialGameState(), 'Flipper')
    expect(flipper.releases.map(({ artifact }) => artifact)).toEqual(['software_package'])
    expect(flipper.moduleKeys).toEqual([module.key])
  })

  it('leaves a module without a host name when this Market does not list that product', () => {
    const withoutFlipper: GameState = (() => {
      const base = createInitialGameState()
      return { ...base, market: { ...base.market, offers: base.market.offers.filter(({ id }) => id !== 'market-offer-flipper-1.0') } }
    })()
    const module = deriveMarketView(withoutFlipper).entries.find(({ kind }) => kind === 'module')!
    expect(module.hostName).toBeUndefined()
    expect(module.hostProductId).toBe('flipper')
  })
})

describe('local Device presence is not a catalog', () => {
  it('states what the Device holds of a product without turning any of it into an offering', () => {
    // node-01 has NodeScan 1.0 installed and a NodeScan 1.2 package; this Market offers only 1.1.
    const nodeScan = entry(createInitialGameState(), 'NodeScan')
    expect(nodeScan.releases.map(({ version }) => version)).toEqual(['1.1'])
    expect(nodeScan.local).toEqual({
      installed: { version: '1.0', channel: 'standard' },
      packages: [{ version: '1.2', channel: 'standard', path: '/home/user/downloads/nodescan-1.2.pkg' }],
    })
  })

  it('leaves a locally held copy of an offered release to that offering alone', () => {
    // The seeded NODE Miner package is the offered release, so it reads as possession
    // of that offering rather than as a second, separate local release.
    const nodeMiner = entry(createInitialGameState(), 'NODE Miner')
    expect(nodeMiner.releases[0]).toMatchObject({ state: 'ON DEVICE', purchased: false })
    // Nothing is left over to state, so the product has no separate local presence at all.
    expect(nodeMiner.local).toBeUndefined()
  })

  it('reads only the local Device, never a represented remote one', () => {
    // srv-01 has GateSSH 1.3.2 installed and its package on disk; none of that is the
    // player's to see here, and the Market must never disclose it.
    expect(entry(createInitialGameState(), 'GateSSH').local).toBeUndefined()
  })
})

describe('distribution destinations', () => {
  it('presents exactly one represented source, taken from canonical operator state', () => {
    const base = createInitialGameState()
    const renamed: GameState = { ...base, market: { ...base.market, operator: { ...base.market.operator, name: 'Some Other Exchange' } } }
    const [represented, unrepresented] = deriveMarketView(renamed).sources

    expect(represented).toMatchObject({ id: base.market.operator.id, kind: 'represented', operatorName: 'Some Other Exchange', offeringCount: 7 })
    // The second destination is a stated absence: no operator, no offerings, nothing settleable.
    expect(unrepresented.kind).toBe('unrepresented')
    expect(unrepresented.operatorName).toBeUndefined()
    expect(unrepresented.offeringCount).toBe(0)
    expect(deriveMarketView(renamed).sources.filter(({ kind }) => kind === 'represented')).toHaveLength(1)
  })
})
