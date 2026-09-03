import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { purchaseMarketOffer } from '../../core/game/market'
import { startMarketPackageDownload } from '../../core/game/fileTransfer'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { MARKET_V1_OFFER_PRICE_NODE_UNITS } from '../../core/game/market'
import { NODE_UNITS_PER_NODE } from '../../core/game/nodeMiner'
import type { GameState } from '../../core/game/types'
import { Market } from './Market'
import { Processes } from '../processes/Processes'
import { Files } from '../files/Files'

const NODESCAN_OFFER = 'market-offer-nodescan-1.1-experimental'
const NODE_MINER_OFFER = 'market-offer-node-miner-1.0'
const GATE_SSH_1_3_2_OFFER = 'market-offer-gate-ssh-1.3.2'
const GATE_SSH_1_3_3_OFFER = 'market-offer-gate-ssh-1.3.3'
const ROLLBACK_OFFER = 'market-offer-flipper-rollback-module-1.0'
/** Every V1 offering's represented price: 0.01 NODE as canonical integer atomic units. */
const PRICE = MARKET_V1_OFFER_PRICE_NODE_UNITS

/** Reads canonical state directly so a test can prove what the interface actually changed. */
function StateProbe() {
  const state = useGameState()
  return <>
    <span data-testid="market-state">{JSON.stringify({
      balanceNodeUnits: state.nodeWallet.balanceNodeUnits,
      accounts: state.nodeEconomy.accounts.map(({ id, balanceNodeUnits }) => `${id}:${balanceNodeUnits}`),
      entitlements: state.market.purchases.entitlements.map(({ offerId }) => offerId),
      files: state.player.localDevice.filesystem.files.map(({ path }) => path),
      transfer: state.fileTransfer.active?.id ?? null,
      processes: state.process.processes.map(({ id }) => id),
      software: state.player.localDevice.installedSoftware.map(({ releaseId }) => releaseId),
    })}</span>
    <span data-testid="whole-state">{JSON.stringify(state)}</span>
  </>
}

function probe(): { balanceNodeUnits: number; accounts: string[]; entitlements: string[]; files: string[]; transfer: string | null; processes: string[]; software: string[] } {
  return JSON.parse(screen.getByTestId('market-state').textContent ?? '')
}

function wholeState() { return screen.getByTestId('whole-state').textContent ?? '' }

function funded(units: number, base: GameState = createInitialGameState()): GameState {
  return { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: units } }
}

function purchased(offerId: string, base: GameState): GameState {
  const result = purchaseMarketOffer(base, offerId)
  if (result.status !== 'purchased') throw new Error('expected purchased')
  return result.state
}

/** Buys and fully downloads one offering through the canonical operations. */
function acquired(offerId: string, base: GameState): GameState {
  const started = startMarketPackageDownload(purchased(offerId, base), offerId)
  if (started.status !== 'started') throw new Error('expected started')
  return advanceGameState(started.state, 60_000)
}

function renderMarket(state: GameState) {
  return render(<GameProvider initialState={state}><Market /><StateProbe /></GameProvider>)
}

/** The catalog's product and module entries, in listed order. */
function entries() { return [...document.querySelectorAll('.mk-entry')] as HTMLElement[] }

function entryNames() { return entries().map((entry) => entry.querySelector('.mk-entry-name')?.textContent) }

/** The acquisition state of the release currently selected on a product surface. */
function releaseState() { return document.querySelector('.mk-release-state')?.textContent }

/** The release options a product surface offers, as `version` + its own state or channel. */
function releaseOptions() {
  return [...document.querySelectorAll('.mk-release-option')].map((option) => [option.querySelector('strong')?.textContent, option.querySelector('small')?.textContent])
}

async function openEntry(name: RegExp) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name }))
  return user
}

describe('Market catalog', () => {
  it('lists one entry per software product, not one per offering', () => {
    renderMarket(createInitialGameState())
    // Seven represented offerings, five products and one module offering.
    expect(screen.getByText('5 PRODUCTS')).toBeInTheDocument()
    expect(entryNames()).toEqual(['RATTLER', 'Flipper', 'NodeScan', 'NODE Miner', 'GateSSH', 'Rollback Module'])
    // The two GateSSH offerings are one product, summarized rather than merged.
    const gateSsh = entries().find((entry) => entry.querySelector('.mk-entry-name')?.textContent === 'GateSSH')!
    expect(gateSsh.querySelector('.mk-entry-meta')).toHaveTextContent('2 RELEASES · 1.3.2, 1.3.3')
  })

  it('states each single-release product with its own release facts and price', () => {
    renderMarket(createInitialGameState())
    const nodeScan = entries().find((entry) => entry.querySelector('.mk-entry-name')?.textContent === 'NodeScan')!
    expect(nodeScan.querySelector('.mk-entry-meta')).toHaveTextContent('1.1 · EXPERIMENTAL · 18.4 MB')
    expect(nodeScan.querySelector('.mk-entry-price')).toHaveTextContent('0.01 NODE')
  })

  it('keeps a module offering in its own group and never as a product', () => {
    renderMarket(createInitialGameState())
    expect(screen.getByText('1 OFFERING')).toBeInTheDocument()
    const rollback = entries().find((entry) => entry.querySelector('.mk-entry-name')?.textContent === 'Rollback Module')!
    expect(rollback.querySelector('.mk-entry-meta')).toHaveTextContent('MODULE FOR FLIPPER · 1.0 · 2.1 MB')
    // The module's authored release states no channel, and none is inherited from Flipper's.
    expect(rollback.querySelector('.mk-entry-meta')).not.toHaveTextContent('STANDARD')
  })

  it('derives the listed release facts and price from canonical state rather than hardcoding them', () => {
    const base = createInitialGameState()
    const altered: GameState = { ...base, market: { ...base.market, offers: base.market.offers.map((offer) => offer.id === NODESCAN_OFFER
      ? { ...offer, priceNodeUnits: 2 * NODE_UNITS_PER_NODE, distribution: { ...offer.distribution, version: '9.9', channel: 'nightly', sizeBytes: 1_000_000 } }
      : offer) } }
    renderMarket(altered)
    expect(screen.getByText('9.9 · NIGHTLY · 1 MB')).toBeInTheDocument()
    expect(screen.getByText('2 NODE')).toBeInTheDocument()
    expect(screen.queryByText(/1\.1 · EXPERIMENTAL/)).not.toBeInTheDocument()
  })

  it('states the price range a product actually spans when its releases differ', () => {
    const base = createInitialGameState()
    const altered: GameState = { ...base, market: { ...base.market, offers: base.market.offers.map((offer) => offer.id === GATE_SSH_1_3_3_OFFER
      ? { ...offer, priceNodeUnits: 2 * PRICE } : offer) } }
    renderMarket(altered)
    const gateSsh = entries().find((entry) => entry.querySelector('.mk-entry-name')?.textContent === 'GateSSH')!
    expect(gateSsh.querySelector('.mk-entry-price')).toHaveTextContent('0.01–0.02 NODE')
  })

  it('summarizes a product honestly when only some of its releases are held', () => {
    renderMarket(acquired(GATE_SSH_1_3_2_OFFER, funded(3 * PRICE)))
    const gateSsh = entries().find((entry) => entry.querySelector('.mk-entry-name')?.textContent === 'GateSSH')!
    // One of the two offered GateSSH releases is on the Device; the product is not.
    expect(gateSsh.querySelector('.node-chip')).toHaveTextContent('ON DEVICE 1/2')
  })

  it('presents the canonical NODE balance rather than a Market copy of it', () => {
    renderMarket(funded(4_281))
    expect(document.querySelector('.mk-balance')).toHaveTextContent('0.004281 NODE')
  })

  it('states that NODE-OS supplies the client while the represented operator sells the offerings', () => {
    const base = createInitialGameState()
    const renamed: GameState = { ...base, market: { ...base.market, operator: { ...base.market.operator, name: 'Some Other Exchange' } } }
    renderMarket(renamed)
    expect(document.querySelector('.node-masthead-subject')).toHaveTextContent('Some Other Exchange')
    expect(screen.getByText(/NODE-OS provides this client\./)).toHaveTextContent('Some Other Exchange lists and sells these offerings')
  })
})

describe('top-level distribution destinations', () => {
  it('presents exactly one represented Market and states that no publisher distribution exists', async () => {
    renderMarket(createInitialGameState())
    expect(screen.getByText('1 REPRESENTED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /OPEN EXCHANGE 7 OFFERINGS/ })).toHaveAttribute('aria-pressed', 'true')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /PUBLISHER DISTRIBUTION/ }))
    expect(screen.getByText('NO PUBLISHER-OPERATED DISTRIBUTION IS REPRESENTED')).toBeInTheDocument()
    // A destination with no represented operator lists nothing and sells nothing.
    expect(entries()).toEqual([])
    expect(screen.queryByRole('button', { name: /BUY/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'VIEW OPEN EXCHANGE' }))
    expect(entryNames()).toContain('GateSSH')
  })

  it('changes no canonical state by switching destination', async () => {
    renderMarket(createInitialGameState())
    const before = wholeState()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /PUBLISHER DISTRIBUTION/ }))
    expect(wholeState()).toBe(before)
  })
})

describe('product to release navigation', () => {
  it('exposes both represented GateSSH offerings without merging their metadata', async () => {
    renderMarket(createInitialGameState())
    await openEntry(/GateSSH/)
    expect(screen.getByRole('heading', { name: 'GateSSH' })).toBeInTheDocument()
    expect(screen.getByText('SOFTWARE PRODUCT · 2 RELEASES OFFERED')).toBeInTheDocument()
    // 1.3.2 states a channel; 1.3.3 represents none and inherits none.
    expect(releaseOptions()).toEqual([['1.3.2', 'STABLE'], ['1.3.3', undefined]])

    // The first listed release opens selected, with only its own facts.
    expect(document.querySelector('.mk-release-version')).toHaveTextContent('1.3.2')
    expect(document.querySelector('.mk-release-channel')).toHaveTextContent('STABLE')
    expect(screen.getByText('rack-systems')).toBeInTheDocument()
    expect(screen.getByText('gatessh-1.3.2.pkg')).toBeInTheDocument()
    expect(screen.getByText('6.4 MB')).toBeInTheDocument()
  })

  it('switches every stated fact to the exact offering when another release is selected', async () => {
    renderMarket(createInitialGameState())
    const user = await openEntry(/GateSSH/)
    await user.click(screen.getByRole('button', { name: /^1\.3\.3/ }))

    expect(document.querySelector('.mk-release-version')).toHaveTextContent('1.3.3')
    // 1.3.3 represents neither channel nor publisher, and takes neither from 1.3.2.
    expect(document.querySelector('.mk-release-channel')).toBeNull()
    expect(screen.getByText('NOT STATED')).toBeInTheDocument()
    expect(screen.queryByText('rack-systems')).not.toBeInTheDocument()
    expect(screen.getByText('gatessh-1.3.3.pkg')).toBeInTheDocument()
    expect(screen.queryByText('gatessh-1.3.2.pkg')).not.toBeInTheDocument()
    expect(screen.getByText('6.6 MB')).toBeInTheDocument()
  })

  it('acts on exactly the selected release, not on its sibling', async () => {
    renderMarket(funded(3 * PRICE))
    const user = await openEntry(/GateSSH/)
    await user.click(screen.getByRole('button', { name: /^1\.3\.3/ }))
    await user.click(screen.getByRole('button', { name: 'BUY · 0.01 NODE' }))

    expect(probe()).toMatchObject({ balanceNodeUnits: 2 * PRICE, entitlements: [GATE_SSH_1_3_3_OFFER] })
    expect(releaseState()).toBe('PURCHASED')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeInTheDocument()

    // The sibling release keeps its own untouched state.
    await user.click(screen.getByRole('button', { name: /^1\.3\.2/ }))
    expect(releaseState()).toBe('AVAILABLE')
    expect(screen.getByRole('button', { name: 'BUY · 0.01 NODE' })).toBeInTheDocument()
  })

  it('marks per-release acquisition state in the selector so several versions stay legible', async () => {
    renderMarket(acquired(GATE_SSH_1_3_3_OFFER, funded(3 * PRICE)))
    await openEntry(/GateSSH/)
    expect(releaseOptions()).toEqual([['1.3.2', 'STABLE'], ['1.3.3', 'ON DEVICE']])
  })

  it('changes no canonical state by browsing a product or selecting a release', async () => {
    renderMarket(createInitialGameState())
    const before = wholeState()
    const user = await openEntry(/GateSSH/)
    await user.click(screen.getByRole('button', { name: /^1\.3\.3/ }))
    await user.click(screen.getByRole('button', { name: /Back to the Market catalog/ }))
    expect(wholeState()).toBe(before)
  })
})

describe('offerings versus what the Device already holds', () => {
  it('never turns a locally held or installed release into a purchasable offering', async () => {
    // node-01 has NodeScan 1.0 installed and a NodeScan 1.2 package in downloads;
    // this Market distributes only 1.1, so only 1.1 is ever selectable here.
    renderMarket(createInitialGameState())
    await openEntry(/NodeScan/)
    expect(screen.getByText('SOFTWARE PRODUCT · 1 RELEASE OFFERED')).toBeInTheDocument()
    expect(releaseOptions()).toEqual([])
    expect(document.querySelector('.mk-release-version')).toHaveTextContent('1.1')

    const local = screen.getByText('ON THIS DEVICE').parentElement!.nextElementSibling!
    expect(within(local as HTMLElement).getByText('INSTALLED').parentElement).toHaveTextContent('1.0 · STANDARD')
    expect(within(local as HTMLElement).getByText('LOCAL PACKAGE').parentElement).toHaveTextContent('1.2 · STANDARD · /home/user/downloads/nodescan-1.2.pkg')
    expect(screen.getByText(/is not an offering/)).toHaveTextContent('This Market distributes only the release above.')

    // Nothing about local possession is buyable, and only the one offering has an action.
    expect(screen.getAllByRole('button', { name: /BUY/ })).toHaveLength(1)
  })

  it('states no local presence for a product the Device holds nothing of', async () => {
    renderMarket(createInitialGameState())
    await openEntry(/GateSSH/)
    expect(screen.queryByText('ON THIS DEVICE')).not.toBeInTheDocument()
  })

  it('never presents a package the Device merely holds as purchased', async () => {
    renderMarket(funded(3 * PRICE))
    await openEntry(/NODE Miner/)
    expect(releaseState()).toBe('ON DEVICE')
    expect(screen.getByText('NOT PURCHASED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'BUY · 0.01 NODE' })).toBeInTheDocument()
    expect(probe().entitlements).toEqual([])
  })

  it('re-offers DOWNLOAD from the surviving entitlement once the local copy is gone', async () => {
    const base = purchased(NODE_MINER_OFFER, funded(3 * PRICE))
    const lost: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: {
      ...base.player.localDevice.filesystem,
      files: base.player.localDevice.filesystem.files.filter(({ path }) => path !== '/home/user/downloads/node-miner-1.0.pkg'),
    } } } }
    renderMarket(lost)
    await openEntry(/NODE Miner/)
    expect(releaseState()).toBe('PURCHASED')
    expect(screen.getByText('NONE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeInTheDocument()
  })
})

describe('modules are not product releases', () => {
  it('reaches the module offering from its host product without folding it into that product', async () => {
    renderMarket(createInitialGameState())
    const user = await openEntry(/^Flipper/)
    // Flipper's own offered releases never include the module.
    expect(screen.getByText('SOFTWARE PRODUCT · 1 RELEASE OFFERED')).toBeInTheDocument()
    expect(screen.getByText(/A module extends Flipper\./)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Rollback Module/ }))
    expect(screen.getByRole('heading', { name: 'Rollback Module' })).toBeInTheDocument()
    expect(screen.getByText('MODULE FOR FLIPPER · 1 RELEASE OFFERED')).toBeInTheDocument()
    expect(screen.getByText('MODULE')).toBeInTheDocument()
    expect(screen.queryByText('PACKAGE')).not.toBeInTheDocument()
    expect(screen.getByText(/never becomes installed software/)).toBeInTheDocument()
  })

  it('presents the Rollback Module with no invented channel or publisher', async () => {
    renderMarket(createInitialGameState())
    await openEntry(/Rollback Module/)
    expect(document.querySelector('.mk-release-version')).toHaveTextContent('1.0')
    expect(document.querySelector('.mk-release-channel')).toBeNull()
    expect(screen.getByText('NOT STATED')).toBeInTheDocument()
    expect(screen.getByText('Open Package Exchange')).toBeInTheDocument()
  })

  it('points a downloaded module at Flipper rather than at Files', async () => {
    renderMarket(acquired(ROLLBACK_OFFER, funded(3 * PRICE)))
    await openEntry(/Rollback Module/)
    expect(releaseState()).toBe('ON DEVICE')
    expect(screen.getByText('The Market ends at acquisition. Open Flipper to integrate this module.')).toBeInTheDocument()
    expect(screen.queryByText(/Install this package from Files/)).not.toBeInTheDocument()
  })
})

describe('publisher, seller and client stay separate', () => {
  it('keeps publisher provenance truthful per release, including honest absence', async () => {
    renderMarket(createInitialGameState())
    const user = await openEntry(/NODE Miner/)
    expect(screen.getByText('nm-dev')).toBeInTheDocument()
    expect(screen.getByText('Open Package Exchange')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Back to the Market catalog/ }))
    await user.click(screen.getByRole('button', { name: /NodeScan/ }))
    // No publisher is represented for this release, so none is invented.
    expect(screen.getByText('NOT STATED')).toBeInTheDocument()
    expect(screen.queryByText('nm-dev')).not.toBeInTheDocument()
  })

  it('presents the publisher a release actually states rather than a fixed one', async () => {
    const base = createInitialGameState()
    const altered: GameState = { ...base, market: { ...base.market, offers: base.market.offers.map((offer) => offer.id === NODE_MINER_OFFER
      ? { ...offer, distribution: { ...offer.distribution, publisher: 'other-publisher' } } : offer) } }
    renderMarket(altered)
    await openEntry(/NODE Miner/)
    expect(screen.getByText('other-publisher')).toBeInTheDocument()
  })
})

describe('Market purchase', () => {
  it('rejects BUY with insufficient NODE, changing no balance and no entitlement', async () => {
    renderMarket(funded(PRICE - 1))
    const user = await openEntry(/NodeScan/)
    await user.click(screen.getByRole('button', { name: /BUY/ }))
    expect(screen.getByText('INSUFFICIENT NODE')).toBeInTheDocument()
    expect(probe()).toMatchObject({ balanceNodeUnits: PRICE - 1, entitlements: [] })
    expect(probe().accounts).toContain('node-account-opx-v0:0')
  })

  it('debits the Wallet, credits the represented seller, and establishes exactly one entitlement', async () => {
    renderMarket(funded(3 * PRICE))
    const softwareBeforePurchase = probe().software
    const user = await openEntry(/NodeScan/)
    await user.click(screen.getByRole('button', { name: 'BUY · 0.01 NODE' }))
    expect(probe()).toMatchObject({
      balanceNodeUnits: 2 * PRICE,
      entitlements: [NODESCAN_OFFER],
      files: ['/home/user/welcome.txt', '/home/user/downloads/node-miner-1.0.pkg', '/home/user/downloads/credential-access-1.0.mod', '/home/user/downloads/deauth.ext', '/home/user/downloads/nodescan-1.2.pkg'],
      transfer: null,
      processes: [],
    })
    expect(probe().accounts).toContain('node-account-opx-v0:10000')
    expect(probe().accounts).toContain('node-account-nm-dev-v0:0')
    // Purchase establishes an entitlement; it neither installs nor removes software.
    expect(probe().software).toEqual(softwareBeforePurchase)
    // The lifecycle moves on, and DOWNLOAD is what becomes available — not INSTALL.
    expect(releaseState()).toBe('PURCHASED')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('offers no DOWNLOAD before the offering is purchased', async () => {
    renderMarket(funded(3 * PRICE))
    await openEntry(/NodeScan/)
    expect(screen.getByText('NOT PURCHASED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
  })

  it('never charges again for an entitlement already held', async () => {
    renderMarket(purchased(NODESCAN_OFFER, funded(3 * PRICE)))
    await openEntry(/NodeScan/)
    expect(screen.queryByRole('button', { name: /BUY/ })).not.toBeInTheDocument()
    expect(probe()).toMatchObject({ balanceNodeUnits: 2 * PRICE, entitlements: [NODESCAN_OFFER] })
  })
})

describe('Market download', () => {
  it('starts real elapsed transfer runtime instead of writing the package immediately', async () => {
    renderMarket(purchased(NODESCAN_OFFER, funded(3 * PRICE)))
    const user = await openEntry(/NodeScan/)
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD' }))

    expect(probe().transfer).toBe('transfer-0001')
    expect(probe().files).not.toContain('/home/user/downloads/nodescan-exp-1.1.pkg')
    expect(probe().processes).toEqual([])
    expect(releaseState()).toBe('DOWNLOADING')
    expect(screen.getByText(/Nothing is written to this Device until the transfer completes\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
  })

  it('derives its progress from the canonical transfer rather than a Market copy', async () => {
    const started = startMarketPackageDownload(purchased(NODESCAN_OFFER, funded(3 * PRICE)), NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    const running: GameState = { ...started.state, fileTransfer: { ...started.state.fileTransfer, active: { ...started.state.fileTransfer.active!, bytesTransferred: 9_200_000 } } }
    renderMarket(running)
    await openEntry(/NodeScan/)
    expect(releaseState()).toBe('DOWNLOADING')
    expect(document.querySelector('.mk-transfer .node-note')).toHaveTextContent('9.2 / 18.4 MB · 50%')
    expect(screen.getByRole('progressbar', { name: 'Download 50% complete' })).toBeInTheDocument()
  })

  it('shows the completed package as ON DEVICE with its real local path, and points at Files for installation', async () => {
    renderMarket(acquired(NODESCAN_OFFER, funded(3 * PRICE)))
    await openEntry(/NodeScan/)
    expect(releaseState()).toBe('ON DEVICE')
    expect(screen.getByText('PACKAGE')).toBeInTheDocument()
    expect(screen.getByText('/home/user/downloads/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(screen.getByText('The Market ends at acquisition. Install this package from Files.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('appears in Files as a pending incoming artifact that is not yet a filesystem entry', async () => {
    const started = startMarketPackageDownload(purchased(NODESCAN_OFFER, funded(3 * PRICE)), NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    render(<GameProvider initialState={advanceGameState(started.state, 2_000)}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads/ }))
    // Only the four existing loose artifacts count as entries: the incoming artifact is not written yet.
    expect(screen.getByText('4 ENTRIES')).toBeInTheDocument()
    expect(screen.getByText(/INCOMING/)).toBeInTheDocument()
    expect(screen.getByText(/An incoming transfer is not written to this filesystem until it completes\./)).toBeInTheDocument()
  })

  it('states an occupied destination rather than hiding why DOWNLOAD is unavailable', async () => {
    const base = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const occupied: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: {
      ...base.player.localDevice.filesystem,
      files: [...base.player.localDevice.filesystem.files, { kind: 'text', id: 'file-9001', path: '/home/user/downloads/nodescan-exp-1.1.pkg', content: 'unrelated' }],
    } } } }
    renderMarket(occupied)
    await openEntry(/NodeScan/)
    expect(releaseState()).toBe('PURCHASED')
    expect(screen.getByText('DESTINATION OCCUPIED · /home/user/downloads/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
  })

  it('reports a canonical admission failure as-is instead of faking progress', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const offline: GameState = { ...purchasedState, player: { ...purchasedState.player, localDevice: { ...purchasedState.player.localDevice, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } } } }
    renderMarket(offline)
    const user = await openEntry(/NodeScan/)
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD' }))
    expect(screen.getByText('LOCAL OFFLINE')).toBeInTheDocument()
    expect(probe().transfer).toBeNull()
  })

  it('hands the completed package to Files as an ordinary installable package', async () => {
    render(<GameProvider initialState={acquired(NODESCAN_OFFER, funded(3 * PRICE))}><Files /><StateProbe /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads/ }))
    await user.click(screen.getByRole('button', { name: /nodescan-exp-1\.1\.pkg/ }))
    expect(screen.getByRole('button', { name: 'INSTALL' })).toBeInTheDocument()
    expect(screen.getByText('1.1 · EXPERIMENTAL')).toBeInTheDocument()
  })
})

describe('Activity Monitor recognition', () => {
  it('observes the Market download as the one canonical Download runtime', () => {
    const started = startMarketPackageDownload(purchased(NODESCAN_OFFER, funded(3 * PRICE)), NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    render(<GameProvider initialState={advanceGameState(started.state, 2_000)}><Processes /></GameProvider>)
    expect(screen.getByText('DOWNLOAD')).toBeInTheDocument()
    expect(screen.getByText('nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(screen.getByText('Open Package Exchange → node-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' })).toHaveTextContent('CANCEL')
  })

  it('cancels the Market download through the canonical transfer control without losing the entitlement', async () => {
    const started = startMarketPackageDownload(purchased(NODESCAN_OFFER, funded(3 * PRICE)), NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    render(<GameProvider initialState={advanceGameState(started.state, 2_000)}><Processes /><StateProbe /></GameProvider>)
    const user = userEvent.setup()
    await act(async () => { await user.click(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' })) })
    expect(probe()).toMatchObject({ transfer: null, entitlements: [NODESCAN_OFFER] })
    expect(probe().files).not.toContain('/home/user/downloads/nodescan-exp-1.1.pkg')
  })
})
