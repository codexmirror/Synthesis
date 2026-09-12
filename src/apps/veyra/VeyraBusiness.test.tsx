import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import {
  ATLAS_DISTRIBUTION_COMPANY_ID,
  ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID,
  BOOKSTORE_BRANCH_ID,
  BOOKSTORE_TREASURY_ACCOUNT_ID,
  NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID,
} from '../../core/game/business'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { requestBookstoreMarketReportFromOperatedRemoteDevice } from '../../core/game/companyAdministration'
import { BUSINESS_PRODUCT_ID } from '../../core/game/businessSoftware'
import { createInitialGameState } from '../../core/game/initialState'
import { connectRemoteFromObservation, resolveActiveRemoteTarget } from '../../core/game/remoteSession'
import { Shell } from '../../shell/Shell'
import { VeyraOS } from './VeyraOS'
import { VeyraBusiness } from './VeyraBusiness'
import type { GameState } from '../../core/game/types'
import type { EditingViewportState } from '../../shell/useEditingViewport'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'

let viewport: EditingViewportState
const endEditing = vi.fn()
vi.mock('../../shell/useEditingViewport', () => ({
  useEditingViewport: () => ({ ...viewport, endEditing }),
}))

const PHONE_DEVICE_ID = 'host-phone-001'
const PHONE_ADDRESS = '10.42.0.61'
const PHONE_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'

/** The phone's private segment is reachable only by pivoting through already-compromised srv-02, its Gateway's sole exposed edge. */
function phoneConnectedState(state = createInitialGameState()): GameState {
  const accessed: GameState = {
    ...state,
    deviceAccess: { nextId: 3, established: [
      { id: 'access-server', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' },
      { id: 'access-phone', sourceDeviceId: state.player.localDevice.id, targetDeviceId: PHONE_DEVICE_ID, viaServiceId: 'service-ssh-003', privilege: 'USER' },
    ] },
  }
  return connectRemoteFromObservation(accessed, { targetDeviceId: PHONE_DEVICE_ID, address: PHONE_ADDRESS }).state
}

/** Real represented Bookstore sales — the way this Company actually comes to have money. */
function earnRestockPrice(state: GameState, sales = 7): GameState {
  let next = state
  for (let index = 0; index < sales; index += 1) {
    const samples = [0, 0.999999]
    const sale = executeBookstoreSale(next, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    if (sale.status !== 'sold') throw new Error(`sale ${index} refused: ${sale.status}`)
    next = sale.state
  }
  return next
}

function State() {
  return <output data-testid="state">{JSON.stringify(useGameState())}</output>
}

const canonical = (): GameState => JSON.parse(screen.getByTestId('state').textContent ?? '')
/**
 * The same canonical state with only Sales Cadence's continuously advancing
 * countdown normalized, for the "this interaction changed nothing else"
 * comparisons: that field legitimately moves under GameProvider's own
 * advancement while a test runs.
 */
const canonicalSettled = (): GameState => withoutBookstoreBackgroundTiming(canonical())
const balance = (state: GameState, accountId: string) => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents
const totalStock = (state: GameState) => state.bookstoreOperations.records
  .find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!.stock.reduce((sum, entry) => sum + entry.quantity, 0)

async function openBusiness(state = phoneConnectedState(), user = userEvent.setup()) {
  render(<GameProvider initialState={state}><Shell /><State /></GameProvider>)
  await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))
  await user.click(screen.getByRole('button', { name: 'Business' }))
  return user
}

beforeEach(() => {
  endEditing.mockClear()
  viewport = {
    hostHeight: 780, editTop: 0, editHeight: 780, editing: false,
    editingPresentation: false, presentationPhase: 'normal',
    targetViewportTop: 0, shellTop: 0, shellBottom: 780,
    presentationTop: 0, presentationHeight: 780, recoveryReady: true,
    viewportLifecycle: 'active',
  }
})

describe('VEYRA Business presence', () => {
  it('follows the represented installation, not Company authority or Firmware', async () => {
    const user = userEvent.setup()
    const withoutSoftware = phoneConnectedState()
    const uninstalled: GameState = { ...withoutSoftware, world: { ...withoutSoftware.world, network: { ...withoutSoftware.world.network,
      hosts: withoutSoftware.world.network.hosts.map((host) => host.id === PHONE_DEVICE_ID ? { ...host, installedSoftware: [] } : host) } } }
    render(<GameProvider initialState={uninstalled}><Shell /><State /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))

    const home = screen.getByRole('region', { name: 'Home' })
    expect(within(home).queryByRole('button', { name: 'Business' })).toBeNull()
    // The Company Administration truth underneath is untouched by removing the software.
    expect(canonical().business.administrationSessions).toEqual(uninstalled.business.administrationSessions)
  })

  it('stays on Home while the Device holds no Company authority at all', async () => {
    const connected = phoneConnectedState()
    const withoutAuthority: GameState = { ...connected, business: { ...connected.business, administrationSessions: [] } }
    await openBusiness(withoutAuthority)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('No company access available.')
    // No Company truth and no action are exposed.
    expect(business.textContent).not.toContain('Bookstore')
    expect(business.textContent).not.toContain('Atlas')
    expect(within(business).queryByRole('button')).toBeNull()
  })

  it('refuses to choose when the Device administers several Companies', async () => {
    const connected = phoneConnectedState()
    const both: GameState = { ...connected, business: { ...connected.business, administrationSessions: [
      ...connected.business.administrationSessions,
      { id: 'company-administration-session-atlas-phone-v0', clientDeviceId: PHONE_DEVICE_ID, companyId: ATLAS_DISTRIBUTION_COMPANY_ID },
    ] } }
    await openBusiness(both)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('more than one company')
    expect(business.textContent).not.toContain('Mixed Shelf Refill')
  })

  it('stops presenting Business if the installation stops being represented while it is open', async () => {
    // The same mounted phone throughout, so the open Business surface — not a
    // fresh one — is what loses the software underneath it.
    const state = phoneConnectedState()
    const context = resolveActiveRemoteTarget(state)!
    const user = userEvent.setup()
    const props = { hidden: false, onReturnLocal: () => {}, editingRecoveryReady: true, onEndEditing: () => {} }
    const { rerender } = render(<GameProvider initialState={state}><VeyraOS context={context} {...props} /><State /></GameProvider>)

    await user.click(screen.getByRole('button', { name: 'Business' }))
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()

    const uninstalled = { ...context, target: { ...context.target, installedSoftware: [] } }
    rerender(<GameProvider initialState={state}><VeyraOS context={uninstalled} {...props} /><State /></GameProvider>)
    expect(screen.queryByRole('region', { name: 'Business' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
    // Losing the client software is not losing the Company relationship.
    expect(canonical().business.administrationSessions).toEqual(state.business.administrationSessions)
  })
})

describe('VEYRA Business surface', () => {
  it('opens a button-driven Market Analyst that observes only on an explicit request', async () => {
    const user = await openBusiness()
    const business = screen.getByRole('region', { name: 'Business' })
    await user.click(within(business).getByRole('button', { name: /Market Analyst/i }))
    const analyst = screen.getByRole('region', { name: 'Market Analyst' })

    // Opening states what a report contains and observes nothing at all.
    expect(canonical().knowledge.bookstoreMarket?.reports).toHaveLength(0)
    expect(within(analyst).queryByRole('textbox')).toBeNull()
    expect(within(analyst).queryByRole('spinbutton')).toBeNull()
    expect(analyst).toHaveTextContent('Ask for a report')
    // The intro describes the global captured genre-condition set truthfully:
    // it must not claim the reported genres are scoped to this branch, and
    // must not imply a standout requires positive physical stock.
    expect(analyst).not.toHaveTextContent(/genres this branch carries/)
    expect(analyst).not.toHaveTextContent('you stock')
    expect(analyst).toHaveTextContent('any title this branch carries')

    await user.click(within(analyst).getByRole('button', { name: /Request market report/ }))
    expect(canonical().knowledge.bookstoreMarket?.reports).toHaveLength(1)
    expect(analyst).toHaveTextContent('Latest reading · Report 1')
    expect(analyst).toHaveTextContent('Buy pressure is high in Science Fiction.')
    expect(analyst).toHaveTextContent('A trend is running in Science Fiction, and it has only recently emerged.')
    expect(analyst).toHaveTextContent('Static Bloom stands out among the books this branch carries.')

    // The captured conditions stay individually visible without one sentence each.
    for (const genre of ['Science Fiction', 'Thriller', 'Mystery', 'Literary Fiction']) {
      expect(within(analyst).getByText(genre)).toBeInTheDocument()
    }
    expect(within(analyst).getAllByText(/Buy pressure is/)).toHaveLength(1)
    expect(analyst).not.toHaveTextContent(/Pressure 120|Demand 16800/)

    await user.click(within(analyst).getByRole('button', { name: /Refresh market report/ }))
    expect(canonical().knowledge.bookstoreMarket?.reports).toHaveLength(2)
    expect(analyst).toHaveTextContent('Latest reading · Report 2')
    await user.click(within(analyst).getByRole('button', { name: 'Back to Business' }))
    expect(screen.queryByRole('region', { name: 'Market Analyst' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
  })

  it('keeps every earlier report individually recoverable, in order, saying what it captured', async () => {
    const first = requestBookstoreMarketReportFromOperatedRemoteDevice(phoneConnectedState(), BOOKSTORE_BRANCH_ID)
    if (first.status !== 'generated') throw new Error(first.status)
    const reportA = first.state.knowledge.bookstoreMarket.reports[0]
    const established = advanceGameState(first.state, 360_000, () => 0, () => 0.5, () => 0)
    expect(established.bookstoreTrend.active?.remainingDurationMs).toBe(2_880_000)

    const detail = { marketAnalyst: true } as const
    const view = render(<GameProvider initialState={established}><VeyraBusiness detail={detail} onDetail={() => {}} /><State /></GameProvider>)
    const analyst = screen.getByRole('region', { name: 'Market Analyst' })
    expect(analyst).toHaveTextContent('Latest reading · Report 1')
    expect(analyst).toHaveTextContent('it has only recently emerged')
    expect(analyst).not.toHaveTextContent('it has been active for a while')
    expect(canonical().knowledge.bookstoreMarket.reports).toEqual([reportA])

    // Reopening is Browse, not Observe: live ESTABLISHED truth does not alter Report A.
    view.unmount()
    render(<GameProvider initialState={established}><VeyraBusiness detail={detail} onDetail={() => {}} /><State /></GameProvider>)
    const reopened = screen.getByRole('region', { name: 'Market Analyst' })
    expect(reopened).toHaveTextContent('it has only recently emerged')
    expect(canonical().knowledge.bookstoreMarket.reports).toEqual([reportA])

    const user = userEvent.setup()
    await user.click(within(reopened).getByRole('button', { name: /Refresh market report/ }))
    expect(canonical().knowledge.bookstoreMarket.reports).toHaveLength(2)
    expect(canonical().knowledge.bookstoreMarket.reports[0]).toEqual(reportA)

    // The new reading leads; the old one is history rather than a second wall of text.
    expect(within(reopened).getByLabelText('Report 2')).toHaveTextContent('it has been active for a while')
    expect(reopened).not.toHaveTextContent('it has only recently emerged')

    // History is a disclosure over real reports, and opening it observes nothing.
    await user.click(within(reopened).getByRole('button', { name: /1 earlier report/ }))
    await user.click(within(reopened).getByRole('button', { name: /^Report 1/ }))
    const recovered = within(reopened).getByLabelText('Report 1')
    expect(recovered).toHaveTextContent('it has only recently emerged')
    expect(recovered).not.toHaveTextContent('it has been active for a while')
    expect(canonical().knowledge.bookstoreMarket.reports).toHaveLength(2)
    expect(canonical().knowledge.bookstoreMarket.reports[0]).toEqual(reportA)
  })

  it('moves the VEYRA navigation band up the real Business hierarchy, not to the Business root', async () => {
    const user = await openBusiness()
    // The navigation band's own control; each surface's local one names its parent.
    const navBack = () => screen.getByRole('button', { name: 'Back' })

    await user.click(screen.getByRole('button', { name: /View inventory/i }))
    await user.click(screen.getByRole('button', { name: /Northbound/ }))
    expect(screen.getByRole('region', { name: 'Product detail' })).toBeInTheDocument()

    // Product Detail is a child of Inventory, so this is where BACK belongs.
    await user.click(navBack())
    expect(screen.getByRole('region', { name: 'Inventory' })).toBeInTheDocument()
    await user.click(navBack())
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
    await user.click(navBack())
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()

    // A detail reached from the root still returns to the root.
    await user.click(screen.getByRole('button', { name: 'Business' }))
    await user.click(screen.getByRole('button', { name: /Market Analyst/i }))
    await user.click(navBack())
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()

    // Navigation is presentation: none of it observed anything or moved money.
    expect(canonical().knowledge.bookstoreMarket?.reports).toHaveLength(0)
  })

  it('opens each surface at its own top while keeping a browse position in Inventory', async () => {
    const user = await openBusiness()
    const region = document.querySelector('.veyra-viewport') as HTMLElement

    // The player has scrolled the Business root, then opens Inventory.
    region.scrollTop = 260
    await user.click(screen.getByRole('button', { name: /View inventory/i }))
    expect(screen.getByRole('region', { name: 'Inventory' })).toBeInTheDocument()
    expect(region.scrollTop).toBe(0)

    // Browsing several Books in succession keeps the list where it was.
    region.scrollTop = 180
    await user.click(screen.getByRole('button', { name: /Northbound/ }))
    expect(region.scrollTop).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(region.scrollTop).toBe(180)
    await user.click(screen.getByRole('button', { name: /Glass District/ }))
    expect(region.scrollTop).toBe(0)
    await user.click(within(screen.getByRole('region', { name: 'Product detail' })).getByRole('button', { name: 'Back to Inventory' }))
    expect(region.scrollTop).toBe(180)

    // The root resumes too, and a surface opened from it still starts at its top.
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
    expect(region.scrollTop).toBe(260)
    await user.click(screen.getByRole('button', { name: /Market Analyst/i }))
    expect(region.scrollTop).toBe(0)

    // Requesting a report is not navigation: the surface must not jump under the player.
    region.scrollTop = 90
    await user.click(screen.getByRole('button', { name: /Request market report/ }))
    expect(canonical().knowledge.bookstoreMarket?.reports).toHaveLength(1)
    expect(region.scrollTop).toBe(90)

    // Leaving for Home keeps nothing: Business opens at its top again.
    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Business' }))
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
    expect(region.scrollTop).toBe(0)
  })

  it('presents Company, Branch, funds, inventory, supply and orders from represented truth', async () => {
    const user = await openBusiness(phoneConnectedState(earnRestockPrice(createInitialGameState())))
    const business = screen.getByRole('region', { name: 'Business' })
    const state = canonical()

    expect(business).toHaveTextContent('Bookstore')
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('18 Mercer Street')
    // Company funds are the Company Treasury balance, never the phone's own Account.
    expect(business).toHaveTextContent(`$${(balance(state, BOOKSTORE_TREASURY_ACCOUNT_ID) / 100).toFixed(2)}`)
    expect(business.textContent).not.toContain('CD-3318-2204')
    expect(business).not.toHaveTextContent('Night Transit')
    await user.click(within(business).getByRole('button', { name: /View inventory/i }))
    expect(screen.getByRole('region', { name: 'Inventory' })).toHaveTextContent('Night Transit')
    await user.click(screen.getByRole('button', { name: /Night Transit/ }))
    const product = screen.getByRole('region', { name: 'Product detail' })
    expect(product).toHaveTextContent('Thriller')
    expect(product).toHaveTextContent('Retail price$8.99')
    expect(product).toHaveTextContent('Last acquisition costNot recorded')
    expect(product).toHaveTextContent('In stock45')
    expect(product).toHaveTextContent('Incoming0')
    expect(product).toHaveTextContent('Popularity80')
    expect(product).not.toHaveTextContent(/margin|trend|effective demand/i)
    await user.click(within(product).getByRole('button', { name: 'Back to Inventory' }))
    expect(screen.getByRole('region', { name: 'Inventory' })).toBeInTheDocument()
    expect(business).toHaveTextContent('Mixed Shelf Refill')
    expect(business).toHaveTextContent('Atlas Distribution')
    expect(business).toHaveTextContent('$140.00')
    expect(business).toHaveTextContent('30 minutes')
    expect(business).toHaveTextContent('Title Case')
    expect(business).toHaveTextContent('$63.00')
    expect(within(business).getAllByRole('button').filter(button => /units \/ case/.test(button.textContent ?? ''))).toHaveLength(2)
    expect(business.textContent).not.toContain('/unit')
    expect(business.textContent).not.toContain('New Titles Pack')

    // No invented metric of any kind.
    expect(business.textContent).not.toMatch(/health|efficiency|forecast|projected|profit|margin|rating|valuation|recommend/i)
    // No technical or authority context.
    expect(business.textContent).not.toContain(PHONE_DEVICE_ID)
    expect(business.textContent).not.toContain(PHONE_ADDRESS)
    expect(business.textContent).not.toContain('company-administration-session')
  })

  it('presents funds as unavailable rather than substituting an Account', async () => {
    const connected = phoneConnectedState(earnRestockPrice(createInitialGameState()))
    const undesignated: GameState = { ...connected, business: { ...connected.business,
      treasuryDesignations: connected.business.treasuryDesignations.filter(({ companyId }) => companyId !== 'company-bookstore-01') } }
    await openBusiness(undesignated)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('Unavailable')
    expect(business.textContent).not.toContain(`$${(balance(undesignated, PHONE_ACCOUNT_ID) / 100).toFixed(2)}`)
  })

  it('keeps exactly two quiet rows without supplier grouping headings', async () => {
    const connected = phoneConnectedState(earnRestockPrice(createInitialGameState()))
    const sameNames: GameState = {
      ...connected,
      business: {
        ...connected.business,
        companies: connected.business.companies.map((company) =>
          company.id === ATLAS_DISTRIBUTION_COMPANY_ID ? { ...company, displayName: 'Northline Book Supply' } : company),
      },
    }
    await openBusiness(sameNames)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(within(business).getAllByRole('button').filter(button => /units \/ case/.test(button.textContent ?? ''))).toHaveLength(2)
    expect(screen.queryByRole('region', { name: /offers/ })).not.toBeInTheDocument()
  })

  it('reviews an offer without mutating any canonical state', async () => {
    const user = await openBusiness(phoneConnectedState(earnRestockPrice(createInitialGameState())))
    const before = canonicalSettled()

    await user.click(screen.getByRole('button', { name: /Mixed Shelf Refill/ }))
    const review = screen.getByRole('region', { name: 'Review order' })
    expect(review).toHaveTextContent('Atlas Distribution')
    expect(review).toHaveTextContent('$140.00')
    expect(review).toHaveTextContent('16 units')
    expect(review).toHaveTextContent('30 minutes')
    expect(review).toHaveTextContent('$8.75 / unit')
    expect(review).toHaveTextContent('Night Transit')
    expect(canonicalSettled()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
    expect(canonicalSettled()).toEqual(before)

    await user.click(screen.getByRole('button', { name: /Title Case/ }))
    const northlineReview = screen.getByRole('region', { name: 'Review order' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Book' }), 'bookstore-book-010')
    expect(northlineReview).toHaveTextContent('Northline Book Supply')
    expect(northlineReview).toHaveTextContent('$63.00')
    expect(northlineReview).toHaveTextContent('6 units')
    expect(northlineReview).toHaveTextContent('45 minutes')
    expect(northlineReview).toHaveTextContent('$10.50 / unit')
    expect(northlineReview).toHaveTextContent('Terminal Light')
    expect(northlineReview).toHaveTextContent('Winter Circuit')
    expect(canonicalSettled()).toEqual(before)
  })

  it('refuses honestly and changes nothing when the Company cannot pay', async () => {
    // No sales have happened, so the Bookstore Treasury is empty.
    const user = await openBusiness()
    await user.click(screen.getByRole('button', { name: /Mixed Shelf Refill/ }))
    const before = canonical()

    await user.click(screen.getByRole('button', { name: 'Place order' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The payment for this order was refused.')
    const after = canonical()
    expect(after.bookstoreRestock.orders).toEqual([])
    expect(after.dollarFinance.transactions.records).toEqual(before.dollarFinance.transactions.records)
    expect(balance(after, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID))
    expect(balance(after, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(balance(before, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID))
    expect(totalStock(after)).toBe(totalStock(before))
  })

  it('exposes no management truth or action once Company authority is gone', async () => {
    const connected = phoneConnectedState(earnRestockPrice(createInitialGameState()))
    const withoutAuthority: GameState = { ...connected, business: { ...connected.business, administrationSessions: [] } }
    await openBusiness(withoutAuthority)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('No company access available.')
    expect(business.textContent).not.toContain('Mixed Shelf Refill')
    // Wallet, whose basis is the untouched Financial Session, is still on Home.
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('runs the whole represented Northline loop through the authorized Business path', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const funded = earnRestockPrice(createInitialGameState())
      const user = await openBusiness(phoneConnectedState(funded), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
      const before = canonical()
      expect(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBeGreaterThanOrEqual(6_300)
      const phoneBefore = balance(before, PHONE_ACCOUNT_ID)
      const stockBefore = totalStock(before)

      await user.click(screen.getByRole('button', { name: /Title Case/ }))
      await user.selectOptions(screen.getByRole('combobox', { name: 'Book' }), 'bookstore-book-010')
      await user.click(screen.getByRole('button', { name: 'Place order' }))

      // The order exists, the Bookstore Treasury paid Northline exactly, and the phone Account funded nothing.
      const placed = canonical()
      expect(placed.bookstoreRestock.orders).toHaveLength(1)
      expect(placed.bookstoreRestock.orders[0].status).toBe('IN_TRANSIT')
      expect(balance(placed, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID) - 6_300)
      expect(balance(placed, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(balance(before, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID) + 6_300)
      expect(balance(placed, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(balance(before, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID))
      expect(balance(placed, PHONE_ACCOUNT_ID)).toBe(phoneBefore)
      expect(placed.dollarFinance.transactions.records.at(-1)).toMatchObject({
        sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, destinationAccountId: NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID, amountCents: 6_300,
      })
      // Paid for is not yet sellable.
      expect(totalStock(placed)).toBe(stockBefore)

      const ordered = screen.getByRole('region', { name: 'Business' })
      expect(ordered).toHaveTextContent('Order placed with Northline Book Supply.')
      expect(ordered).toHaveTextContent('In transit')
      expect(ordered).toHaveTextContent('Title Case')

      // Canonical advancement alone delivers it; the client causes nothing.
      await act(async () => { vi.advanceTimersByTime(2_700_000) })
      const delivered = canonical()
      expect(delivered.bookstoreRestock.orders[0].status).toBe('DELIVERED')
      expect(screen.getByRole('region', { name: 'Business' })).toHaveTextContent('Delivered')
      // Delivery landed in Bookstore Operations, which ordinary sales then keep consuming.
      expect(delivered.bookstoreRestock.orders[0].lines.reduce((sum, line) => sum + line.quantity, 0)).toBe(6)
      expect(delivered.bookstoreCommerce.records[0].assortment).toHaveLength(9)
      const purchasedUnits = delivered.bookstoreCommerce.records[0].completedSales
        .slice(before.bookstoreCommerce.records[0].completedSales.length)
        .reduce((sum, sale) => sum + sale.lines.reduce((units, line) => units + line.quantity, 0), 0)
      expect(totalStock(delivered)).toBe(stockBefore + 6 - purchasedUnits)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-resolves a carried Product Detail from no history through transit and delivery', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const funded = earnRestockPrice(createInitialGameState())
      // Closing the Branch suppresses unrelated sale cadence while preserving
      // the ordinary authorized procurement and canonical delivery paths.
      const controlled: GameState = { ...funded, bookstoreOperations: { records: funded.bookstoreOperations.records.map(record => ({ ...record, open: false })) } }
      const user = await openBusiness(phoneConnectedState(controlled), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
      const stock = (state: GameState) => state.bookstoreOperations.records[0].stock.find(line => line.merchandiseId === 'bookstore-merch-006')!.quantity
      const stockBefore = stock(canonical())

      await user.click(screen.getByRole('button', { name: /View inventory/i }))
      await user.click(screen.getByRole('button', { name: /Northbound/ }))
      let product = screen.getByRole('region', { name: 'Product detail' })
      expect(product).toHaveTextContent('Literary Fiction')
      expect(product).toHaveTextContent('Retail price$15.99')
      expect(product).toHaveTextContent('Last acquisition costNot recorded')
      expect(product).toHaveTextContent('Incoming0')
      expect(product).toHaveTextContent('Popularity100')

      await user.click(within(product).getByRole('button', { name: 'Back to Inventory' }))
      await user.click(within(screen.getByRole('region', { name: 'Inventory' })).getByRole('button', { name: 'Back to Business' }))
      await user.click(screen.getByRole('button', { name: /Title Case/ }))
      await user.selectOptions(screen.getByRole('combobox', { name: 'Book' }), 'bookstore-merch-006')
      await user.click(screen.getByRole('button', { name: 'Place order' }))
      await user.click(screen.getByRole('button', { name: /View inventory/i }))
      await user.click(screen.getByRole('button', { name: /Northbound/ }))
      product = screen.getByRole('region', { name: 'Product detail' })
      expect(product).toHaveTextContent(`In stock${stockBefore}`)
      expect(product).toHaveTextContent('Incoming6')
      expect(product).toHaveTextContent('Last acquisition costNot recorded')

      await act(async () => { vi.advanceTimersByTime(2_700_000) })
      product = screen.getByRole('region', { name: 'Product detail' })
      expect(product).toHaveTextContent(`In stock${stockBefore + 6}`)
      expect(product).toHaveTextContent('Incoming0')
      expect(product).toHaveTextContent('Last acquisition cost$10.50')
      expect(product).toHaveTextContent('Literary Fiction')
      expect(product).toHaveTextContent('Retail price$15.99')
      expect(product).toHaveTextContent('Popularity100')
      expect(product).not.toHaveTextContent(/margin|trend|effective demand/i)
      expect(product).not.toHaveTextContent('Terminal Light')
      await user.click(within(product).getByRole('button', { name: 'Back to Inventory' }))
      expect(screen.getByRole('region', { name: 'Inventory' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('never gives the client a way to name money, an Account or a Company', async () => {
    await openBusiness(phoneConnectedState(earnRestockPrice(createInitialGameState())))
    const business = screen.getByRole('region', { name: 'Business' })

    // No transfer, sign-in or arbitrary-amount affordance exists anywhere on this surface.
    expect(within(business).queryByRole('textbox')).toBeNull()
    expect(within(business).queryByRole('button', { name: /send|receive|transfer|sign in/i })).toBeNull()
    expect(business.textContent).not.toContain(BOOKSTORE_TREASURY_ACCOUNT_ID)
    expect(business.textContent).not.toContain('CD-4827-6109')
    // Opening Business creates no Financial Session of any kind.
    expect(canonical().dollarFinance.sessions.active.map(({ clientDeviceId }) => clientDeviceId)).toEqual(['device-local-v0', PHONE_DEVICE_ID])
    expect(canonical().dollarFinance.sessions.active.every(({ accountId }) => accountId !== BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(true)
    expect(BUSINESS_PRODUCT_ID).toBe('business')
  })
})


describe('VEYRA Coffee Machine management', () => {
  it('shows seller, exact price and capability, then installs through the authorized operation', async () => {
    const before = earnRestockPrice(phoneConnectedState(), 13)
    const user = await openBusiness(before)
    const coffee = screen.getByRole('region', { name: 'Coffee Machine' })
    expect(coffee).toHaveTextContent('Atlas Distribution')
    expect(coffee).toHaveTextContent('$250.00')
    expect(coffee).toHaveTextContent('Enables Coffee service at this branch')
    expect(coffee).toHaveTextContent('House Coffee · $3.50')
    expect(canonical().bookstoreOperations.records[0].coffeeMachine).toBeUndefined()
    await user.click(within(coffee).getByRole('button', { name: /Buy and install Coffee Machine/ }))
    expect(coffee).toHaveTextContent('Installed')
    expect(coffee).toHaveTextContent('Coffee service available at this branch')
    expect(within(coffee).queryByRole('button')).toBeNull()
    const after = canonical()
    expect(balance(after, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID) - 25000)
    expect(balance(after, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(25000)
    expect(after.bookstoreOperations.records[0].coffeeMachine?.purchaseTransactionId).toBe(after.dollarFinance.transactions.records.at(-1)?.id)
    expect(after.bookstoreCommerce).toEqual(before.bookstoreCommerce)
    expect(balance(after, PHONE_ACCOUNT_ID)).toBe(balance(before, PHONE_ACCOUNT_ID))
  })

  it('reports refused payment without showing installed service or changing canonical state', async () => {
    const state = phoneConnectedState()
    const user = await openBusiness(state)
    const before = canonicalSettled()
    await user.click(screen.getByRole('button', { name: /Buy and install Coffee Machine/ }))
    expect(within(screen.getByRole('region', { name: 'Business' })).getByRole('status')).toHaveTextContent('payment for the Coffee Machine was refused')
    expect(canonicalSettled()).toEqual(before)
    expect(screen.getByRole('region', { name: 'Coffee Machine' })).not.toHaveTextContent('Coffee service available')
  })
})
