import { act, render, screen } from '@testing-library/react'
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
const ROLLBACK_OFFER = 'market-offer-flipper-rollback-module-1.0'
/** Every V1 offering's represented price: 0.01 NODE as canonical integer atomic units. */
const PRICE = MARKET_V1_OFFER_PRICE_NODE_UNITS

/** Reads canonical state directly so a test can prove what the interface actually changed. */
function StateProbe() {
  const state = useGameState()
  return <span data-testid="market-state">{JSON.stringify({
    balanceNodeUnits: state.nodeWallet.balanceNodeUnits,
    accounts: state.nodeEconomy.accounts.map(({ id, balanceNodeUnits }) => `${id}:${balanceNodeUnits}`),
    entitlements: state.market.purchases.entitlements.map(({ offerId }) => offerId),
    files: state.player.localDevice.filesystem.files.map(({ path }) => path),
    transfer: state.fileTransfer.active?.id ?? null,
    processes: state.process.processes.map(({ id }) => id),
    software: state.player.localDevice.installedSoftware.map(({ releaseId }) => releaseId),
  })}</span>
}

function probe(): { balanceNodeUnits: number; accounts: string[]; entitlements: string[]; files: string[]; transfer: string | null; processes: string[]; software: string[] } {
  return JSON.parse(screen.getByTestId('market-state').textContent ?? '')
}

function funded(units: number, base: GameState = createInitialGameState()): GameState {
  return { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: units } }
}

function purchased(offerId: string, base: GameState): GameState {
  const result = purchaseMarketOffer(base, offerId)
  if (result.status !== 'purchased') throw new Error('expected purchased')
  return result.state
}

function renderMarket(state: GameState) {
  return render(<GameProvider initialState={state}><Market /><StateProbe /></GameProvider>)
}

/** The offering's single canonical acquisition state, distinct from the separate PURCHASE fact below it. */
function stateRow() { return screen.getByText('STATE').parentElement! }

async function open(name: RegExp) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name }))
  return user
}

describe('Market catalog presentation', () => {
  it('lists every represented offering once with its own release, size and price', () => {
    renderMarket(createInitialGameState())
    expect(screen.getByText('5 OFFERINGS')).toBeInTheDocument()
    const rows = screen.getAllByRole('button').filter((button) => button.className === 'node-row')
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
      'NodeScan', 'NODE Miner', 'GateSSH', 'GateSSH', 'Rollback Module',
    ])
    expect(rows.map((row) => row.querySelector('small')?.textContent)).toEqual([
      '1.1 · EXPERIMENTAL · 18.4 MB · 0.01 NODE',
      '1.0 · UNOFFICIAL · 3.4 MB · 0.01 NODE',
      '1.3.2 · STABLE · 6.4 MB · 0.01 NODE',
      // GateSSH 1.3.3 states no channel: no accepted current truth represents one for this
      // exact release, so the row omits the segment rather than inheriting 1.3.2's.
      '1.3.3 · 6.6 MB · 0.01 NODE',
      // The Rollback Module's authored release states no channel either.
      '1.0 · 2.1 MB · 0.01 NODE',
    ])
  })

  it('derives the listed release facts and price from canonical state rather than hardcoding them', () => {
    const base = createInitialGameState()
    const altered: GameState = { ...base, market: { ...base.market, offers: base.market.offers.map((offer) => offer.id === NODESCAN_OFFER
      ? { ...offer, priceNodeUnits: 2 * NODE_UNITS_PER_NODE, distribution: { ...offer.distribution, version: '9.9', channel: 'nightly', sizeBytes: 1_000_000 } }
      : offer) } }
    renderMarket(altered)
    expect(screen.getByText('9.9 · NIGHTLY · 1 MB · 2 NODE')).toBeInTheDocument()
    expect(screen.queryByText(/1\.1 · EXPERIMENTAL/)).not.toBeInTheDocument()
  })

  it('presents the canonical NODE balance rather than a Market copy of it', () => {
    renderMarket(funded(4_281))
    expect(screen.getByText('0.004281 NODE')).toBeInTheDocument()
  })

  it('states that NODE-OS supplies the client while the represented operator sells the offerings', () => {
    const base = createInitialGameState()
    const renamed: GameState = { ...base, market: { ...base.market, operator: { ...base.market.operator, name: 'Some Other Exchange' } } }
    renderMarket(renamed)
    expect(screen.getByText('Some Other Exchange')).toBeInTheDocument()
    expect(screen.getByText(/NODE-OS provides this client\./)).toHaveTextContent('Some Other Exchange lists and sells these offerings')
  })

  it('keeps publisher provenance truthful per release, including honest absence', async () => {
    renderMarket(createInitialGameState())
    await open(/NODE Miner/)
    expect(screen.getByText('nm-dev')).toBeInTheDocument()
    expect(screen.getByText('Open Package Exchange')).toBeInTheDocument()

    const user = userEvent.setup()
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
    await open(/NODE Miner/)
    expect(screen.getByText('other-publisher')).toBeInTheDocument()
  })

  it('presents the Rollback Module with no invented channel or publisher', async () => {
    renderMarket(createInitialGameState())
    await open(/Rollback Module/)
    // No channel is stated, so the release line is version-only rather than a fabricated segment.
    expect(document.querySelector('.node-masthead-meta')).toHaveTextContent('1.0')
    expect(document.querySelector('.node-masthead-meta')).not.toHaveTextContent('·')
    expect(screen.getByText('NOT STATED')).toBeInTheDocument()
    expect(screen.getByText('Open Package Exchange')).toBeInTheDocument()
  })
})

describe('Market purchase', () => {
  it('rejects BUY with insufficient NODE, changing no balance and no entitlement', async () => {
    renderMarket(funded(PRICE - 1))
    await open(/NodeScan/)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /BUY/ }))
    expect(screen.getByText('INSUFFICIENT NODE')).toBeInTheDocument()
    expect(probe()).toMatchObject({ balanceNodeUnits: PRICE - 1, entitlements: [] })
    expect(probe().accounts).toContain('node-account-opx-v0:0')
  })

  it('debits the Wallet, credits the represented seller, and establishes exactly one entitlement', async () => {
    renderMarket(funded(3 * PRICE))
    await open(/NodeScan/)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'BUY · 0.01 NODE' }))
    expect(probe()).toMatchObject({
      balanceNodeUnits: 2 * PRICE,
      entitlements: [NODESCAN_OFFER],
      files: ['/home/user/welcome.txt', '/home/user/downloads/node-miner-1.0.pkg'],
      transfer: null,
      processes: [],
    })
    expect(probe().accounts).toContain('node-account-opx-v0:10000')
    expect(probe().accounts).toContain('node-account-nm-dev-v0:0')
    expect(probe().software).toEqual(['nodescan-1.0-standard', 'flipper-1.0'])
    // The lifecycle moves on, and DOWNLOAD is what becomes available — not INSTALL.
    expect(stateRow()).toHaveTextContent('PURCHASED')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('offers no DOWNLOAD before the offering is purchased', async () => {
    renderMarket(funded(3 * PRICE))
    await open(/NodeScan/)
    expect(screen.getByText('NOT PURCHASED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
  })

  it('never charges again for an entitlement already held', async () => {
    const state = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    renderMarket(state)
    await open(/NodeScan/)
    expect(screen.queryByRole('button', { name: /BUY/ })).not.toBeInTheDocument()
    expect(probe()).toMatchObject({ balanceNodeUnits: 2 * PRICE, entitlements: [NODESCAN_OFFER] })
  })
})

describe('Market download', () => {
  it('starts real elapsed transfer runtime instead of writing the package immediately', async () => {
    renderMarket(purchased(NODESCAN_OFFER, funded(3 * PRICE)))
    await open(/NodeScan/)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD' }))

    expect(probe().transfer).toBe('transfer-0001')
    expect(probe().files).not.toContain('/home/user/downloads/nodescan-exp-1.1.pkg')
    expect(probe().processes).toEqual([])
    expect(stateRow()).toHaveTextContent('DOWNLOADING')
    expect(screen.getByText(/Nothing is written to this Device until the transfer completes\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
  })

  it('derives its progress from the canonical transfer rather than a Market copy', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const started = startMarketPackageDownload(purchasedState, NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    const running: GameState = { ...started.state, fileTransfer: { ...started.state.fileTransfer, active: { ...started.state.fileTransfer.active!, bytesTransferred: 9_200_000 } } }
    renderMarket(running)
    await open(/NodeScan/)
    expect(stateRow()).toHaveTextContent('DOWNLOADING')
    expect(document.querySelector('.market-transfer .node-note')).toHaveTextContent('9.2 / 18.4 MB · 50%')
    expect(screen.getByRole('progressbar', { name: 'Download 50% complete' })).toBeInTheDocument()
  })

  it('shows the completed package as ON DEVICE with its real local path, and points at Files for installation', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const started = startMarketPackageDownload(purchasedState, NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceGameState(started.state, 60_000)
    renderMarket(completed)
    await open(/NodeScan/)
    expect(stateRow()).toHaveTextContent('ON DEVICE')
    expect(screen.getByText('/home/user/downloads/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(screen.getByText('The Market ends at acquisition. Install this package from Files.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('appears in Files as a pending incoming artifact that is not yet a filesystem entry', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const started = startMarketPackageDownload(purchasedState, NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    render(<GameProvider initialState={advanceGameState(started.state, 2_000)}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads/ }))
    // Only the existing package counts as an entry: nothing is written yet.
    expect(screen.getByText('1 ENTRY')).toBeInTheDocument()
    expect(screen.getByText(/INCOMING/)).toBeInTheDocument()
    expect(screen.getByText(/An incoming transfer is not written to this filesystem until it completes\./)).toBeInTheDocument()
  })

  it('reports a canonical admission failure as-is instead of faking progress', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const offline: GameState = { ...purchasedState, player: { ...purchasedState.player, localDevice: { ...purchasedState.player.localDevice, runtime: { ...purchasedState.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } }
    renderMarket(offline)
    await open(/NodeScan/)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD' }))
    expect(screen.getByText('LOCAL OFFLINE')).toBeInTheDocument()
    expect(probe().transfer).toBeNull()
  })
})

describe('possession, entitlement and the Files boundary', () => {
  it('never presents a package the Device merely holds as purchased', async () => {
    renderMarket(funded(3 * PRICE))
    await open(/NODE Miner/)
    expect(stateRow()).toHaveTextContent('ON DEVICE')
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
    await open(/NODE Miner/)
    expect(stateRow()).toHaveTextContent('PURCHASED')
    expect(screen.getByText('NONE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeInTheDocument()
  })

  it('hands the completed package to Files as an ordinary installable package', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const started = startMarketPackageDownload(purchasedState, NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceGameState(started.state, 60_000)
    render(<GameProvider initialState={completed}><Files /><StateProbe /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads/ }))
    await user.click(screen.getByRole('button', { name: /nodescan-exp-1\.1\.pkg/ }))
    expect(screen.getByRole('button', { name: 'INSTALL' })).toBeInTheDocument()
    expect(screen.getByText('1.1 · EXPERIMENTAL')).toBeInTheDocument()
  })
})

describe('Activity Monitor recognition', () => {
  it('observes the Market download as the one canonical Download runtime', () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const started = startMarketPackageDownload(purchasedState, NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    const running = advanceGameState(started.state, 2_000)
    render(<GameProvider initialState={running}><Processes /></GameProvider>)
    expect(screen.getByText('DOWNLOAD')).toBeInTheDocument()
    expect(screen.getByText('nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(screen.getByText('Open Package Exchange → node-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' })).toHaveTextContent('CANCEL')
  })

  it('cancels the Market download through the canonical transfer control without losing the entitlement', async () => {
    const purchasedState = purchased(NODESCAN_OFFER, funded(3 * PRICE))
    const started = startMarketPackageDownload(purchasedState, NODESCAN_OFFER)
    if (started.status !== 'started') throw new Error('expected started')
    render(<GameProvider initialState={advanceGameState(started.state, 2_000)}><Processes /><StateProbe /></GameProvider>)
    const user = userEvent.setup()
    await act(async () => { await user.click(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' })) })
    expect(probe()).toMatchObject({ transfer: null, entitlements: [NODESCAN_OFFER] })
    expect(probe().files).not.toContain('/home/user/downloads/nodescan-exp-1.1.pkg')
  })
})
